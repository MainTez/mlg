const { app, BrowserWindow, shell, Menu } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

const APP_URL = process.env.ELECTRON_START_URL || "https://mlg-mu.vercel.app/";

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

  win.loadURL(APP_URL);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
};

app.whenReady().then(() => {
  app.setAppUserModelId("com.maintez.mlg");
  Menu.setApplicationMenu(null);
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
