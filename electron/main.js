const { app, BrowserWindow, shell, Menu, globalShortcut } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

const APP_URL = process.env.ELECTRON_START_URL || "https://mlg-mu.vercel.app/";

let overlayWindow = null;

const buildAppUrl = (path = "") => {
  if (!path) {
    return APP_URL;
  }
  return APP_URL.endsWith("/") ? `${APP_URL}${path}` : `${APP_URL}/${path}`;
};

const createWindow = () => {
  const win = new BrowserWindow({
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
  win.setMenuBarVisibility(false);
  win.setMenu(null);
  win.setAutoHideMenuBar(true);

  win.loadURL(buildAppUrl());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
};

const toggleOverlay = () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
    } else {
      overlayWindow.show();
      overlayWindow.focus();
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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });
  overlayWindow.setMenu(null);
  overlayWindow.setMenuBarVisibility(false);
  overlayWindow.setAutoHideMenuBar(true);
  overlayWindow.loadURL(buildAppUrl("overlay"));
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
  globalShortcut.register("CommandOrControl+Shift+O", () => {
    toggleOverlay();
  });
  createWindow();

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
});
