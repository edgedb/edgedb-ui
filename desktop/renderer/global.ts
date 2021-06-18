import {IWindowControls, SysInfo} from "../preload/interfaces";
import {RendererIPC} from "../shared/typedIPC/interfaces";

// eslint-disable-next-line
const context = window as any;

export const windowControls = context.windowControls as IWindowControls;

export const sysInfo = context.sysInfo as SysInfo;

export const ipc = context.ipc as RendererIPC;
