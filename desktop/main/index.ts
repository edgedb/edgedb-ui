import {app, BrowserWindow} from "electron";
import windowStateKeeper from "electron-window-state";
import {autoUpdater} from "electron-updater";

import path from "path";
import isDev from "electron-is-dev";

import "./windowControls";
import "./connections";
import "./serverInstances";

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 900,
    defaultHeight: 680,
  });

  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    webPreferences: {
      additionalArguments: [
        isDev ? "ELECTRON_IS_DEV" : "ELECTRON_IS_PACKAGED",
      ],
      preload: path.resolve(__dirname, "../preload/index.js"),
    },
    frame: process.platform !== "win32",
    titleBarStyle: process.platform === "darwin" ? "hidden" : "default",
    backgroundColor: "#191919",
  });

  mainWindowState.manage(mainWindow);

  mainWindow.loadURL(
    isDev
      ? "http://localhost:3000"
      : `file://${path.join(__dirname, "../index.html")}`
  );

  mainWindow.on("closed", () => (mainWindow = null));
};

app.on("ready", () => {
  createWindow();

  if (isDev) {
    import("electron-devtools-installer").then((mod) => {
      mod.default(mod.REACT_DEVELOPER_TOOLS).catch((err) => {
        console.log("Could not install react devtools: ", err);
      });
    });
  }

  autoUpdater.checkForUpdatesAndNotify();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
