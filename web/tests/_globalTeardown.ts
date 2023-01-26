import {ChildProcess} from "child_process";

function killProcess(proc: ChildProcess, signal?: number | NodeJS.Signals) {
  return new Promise<void>((resolve) => {
    proc.once("close", () => {
      resolve();
    });

    proc.kill(signal);
    proc.stdio.forEach((io) => io?.destroy());
  });
}

export default async function () {
  // @ts-ignore
  const uiServerProc: ChildProcess = globalThis.uiServerProc;

  const waits: Promise<void>[] = [];

  if (uiServerProc) {
    console.log("Closing UI server...");
    waits.push(
      killProcess(uiServerProc).then(() => console.log("...UI server closed"))
    );
  }

  // @ts-ignore
  const edbServerProc: ChildProcess = globalThis.edgedbServerProc;

  if (edbServerProc) {
    console.log("Closing EdgeDB server...");
    waits.push(
      killProcess(edbServerProc).then(() =>
        console.log("...EdgeDB server closed")
      )
    );
  }

  await Promise.all(waits);
}
