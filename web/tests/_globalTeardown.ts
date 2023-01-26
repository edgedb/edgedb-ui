import {ChildProcess} from "child_process";

export default async function () {
  // @ts-ignore
  const uiServerProc: ChildProcess = globalThis.uiServerProc;

  if (uiServerProc) {
    console.log("Closing UI server...");
    uiServerProc.kill();
  }

  // @ts-ignore
  const edbServerProc: ChildProcess = globalThis.edgedbServerProc;

  if (edbServerProc) {
    console.log("Closing EdgeDB server...");
    edbServerProc.kill();
  }
}
