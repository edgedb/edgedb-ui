import {ipcMain, BrowserWindow, app} from "electron";

ipcMain.on("_windowControls/minimise", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on("_windowControls/close", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

ipcMain.on("_windowControls/toggleMaximised", (event) => {
  const currentWindow = BrowserWindow.fromWebContents(event.sender);
  if (currentWindow) {
    if (currentWindow.isMaximized()) {
      currentWindow.unmaximize();
    } else {
      currentWindow.maximize();
    }
  }
});

ipcMain.on("_windowControls/isMaximised", (event) => {
  event.returnValue = BrowserWindow.fromWebContents(
    event.sender
  )?.isMaximized();
});

app.on("browser-window-created", (event, browserWindow) => {
  browserWindow.on("maximize", () =>
    browserWindow.webContents.send("_windowControls/maximisedChanged", true)
  );
  browserWindow.on("unmaximize", () =>
    browserWindow.webContents.send("_windowControls/maximisedChanged", false)
  );
});
