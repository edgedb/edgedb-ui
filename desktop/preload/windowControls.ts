import {ipcRenderer, IpcRendererEvent} from "electron";

import {IWindowControls} from "./interfaces";

export const windowControls: IWindowControls = {
  minimise() {
    ipcRenderer.send("_windowControls/minimise");
  },
  close() {
    ipcRenderer.send("_windowControls/close");
  },
  toggleMaximised() {
    ipcRenderer.send("_windowControls/toggleMaximised");
  },
  isMaximised() {
    return !!ipcRenderer.sendSync("_windowControls/isMaximised");
  },
  onMaximisedChange(listener: (maximised: boolean) => void) {
    const ipcListener = (event: IpcRendererEvent, maximised: boolean) => {
      listener(maximised);
    };

    ipcRenderer.on("_windowControls/maximisedChanged", ipcListener);

    return () => {
      ipcRenderer.removeListener(
        "_windowControls/maximisedChanged",
        ipcListener
      );
    };
  },
};
