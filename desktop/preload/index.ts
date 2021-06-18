import {contextBridge} from "electron";

import {windowControls} from "./windowControls";
import {sysInfo} from "./sysInfo";
import * as ipc from "../shared/typedIPC/renderer";

contextBridge.exposeInMainWorld("windowControls", windowControls);
contextBridge.exposeInMainWorld("sysInfo", sysInfo);
contextBridge.exposeInMainWorld("ipc", ipc);
