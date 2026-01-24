const {
  app,
  BrowserWindow,
  shell,
  Menu,
  globalShortcut,
  Tray,
  nativeImage,
  ipcMain
} = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

const APP_URL = process.env.ELECTRON_START_URL || "https://mlg-mu.vercel.app/";

let mainWindow = null;
let overlayWindow = null;
let tray = null;
let overlayShortcut = null;

const buildAppUrl = (path = "") => {
  if (!path) {
    return APP_URL;
  }
  return APP_URL.endsWith("/") ? `${APP_URL}${path}` : `${APP_URL}/${path}`;
};

const getTrayIconPath = () => {
  if (process.platform === "win32") {
    return path.join(__dirname, "../build/icon.ico");
  }
  return path.join(__dirname, "../build/icon.png");
};

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#0b0f14",
    icon: path.join(__dirname, "../build/icon.png"),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);
  mainWindow.setAutoHideMenuBar(true);

  mainWindow.loadURL(buildAppUrl());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
};

const buildTrayMenu = () => {
  const toggleLabel = overlayShortcut
    ? `Toggle Overlay (${overlayShortcut.replace("CommandOrControl", "Ctrl")})`
    : "Toggle Overlay";
  return Menu.buildFromTemplate([
    { label: toggleLabel, click: () => toggleOverlay() },
    {
      label: "Show App",
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() }
  ]);
};

const createTray = () => {
  if (tray) {
    return;
  }
  const trayIcon = nativeImage.createFromPath(getTrayIconPath());
  tray = new Tray(trayIcon);
  tray.setToolTip("MLG");
  tray.setContextMenu(buildTrayMenu());
  tray.on("double-click", () => toggleOverlay());
};

const registerOverlayShortcut = (preferredShortcut) => {
  const candidates = preferredShortcut
    ? [preferredShortcut]
    : ["CommandOrControl+O", "CommandOrControl+Shift+O", "Alt+Shift+O"];
  for (const accelerator of candidates) {
    if (!accelerator) {
      continue;
    }
    if (globalShortcut.register(accelerator, toggleOverlay)) {
      return accelerator;
    }
  }
  if (preferredShortcut) {
    return registerOverlayShortcut(null);
  }
  return null;
};

const updateOverlayShortcut = (shortcut) => {
  if (overlayShortcut) {
    globalShortcut.unregister(overlayShortcut);
  }
  overlayShortcut = registerOverlayShortcut(shortcut);
  if (tray) {
    tray.setContextMenu(buildTrayMenu());
  }
  return overlayShortcut;
};

const toggleOverlay = () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
    } else {
      overlayWindow.show();
      overlayWindow.focus();
      overlayWindow.moveTop();
    }
    return;
  }

  overlayWindow = new BrowserWindow({
    width: 520,
    height: 720,
    backgroundColor: "#0b0f14",
    icon: path.join(__dirname, "../build/icon.png"),
    autoHideMenuBar: true,
    alwaysOnTop: true,
    resizable: true,
    minimizable: false,
    skipTaskbar: true,
    show: false,
    fullscreenable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });
  overlayWindow.setMenu(null);
  overlayWindow.setMenuBarVisibility(false);
  overlayWindow.setAutoHideMenuBar(true);
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.loadURL(buildAppUrl("overlay"));
  overlayWindow.once("ready-to-show", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.show();
      overlayWindow.focus();
      overlayWindow.moveTop();
    }
  });
  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });
};

app.whenReady().then(() => {
  app.setAppUserModelId("com.maintez.mlg");
  Menu.setApplicationMenu(null);
  app.on("browser-window-created", (_event, window) => {
    window.setMenu(null);
    window.setMenuBarVisibility(false);
    window.setAutoHideMenuBar(true);
  });
  overlayShortcut = registerOverlayShortcut();
  createTray();
  createWindow();
  ipcMain.handle("overlay:shortcut:get", () => overlayShortcut);
  ipcMain.handle("overlay:shortcut:set", (_event, shortcut) => {
    const updated = updateOverlayShortcut(shortcut);
    if (!updated) {
      return { ok: false, error: "Shortcut unavailable." };
    }
    return { ok: true, shortcut: updated };
  });
  ipcMain.handle("overlay:toggle", () => {
    toggleOverlay();
    return true;
  });

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
