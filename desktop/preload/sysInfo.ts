import {SysInfo} from "./interfaces";

export const sysInfo: SysInfo = {
  isDev: process.argv.includes("ELECTRON_IS_DEV"),
  platform: process.platform,
};
