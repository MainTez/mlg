const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronApp", {
  platform: process.platform,
  getOverlayShortcut: () => ipcRenderer.invoke("overlay:shortcut:get"),
  setOverlayShortcut: (shortcut) =>
    ipcRenderer.invoke("overlay:shortcut:set", shortcut),
  toggleOverlay: () => ipcRenderer.invoke("overlay:toggle")
});
