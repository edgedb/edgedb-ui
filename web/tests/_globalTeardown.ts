import {ChildProcess} from "node:child_process";

function killProcess(proc: ChildProcess, signal?: number | NodeJS.Signals) {
  return new Promise<void>((resolve) => {
    proc.once("close", () => {
      resolve();
    });

    proc.kill(signal);
    proc.stdio.forEach((io) => io?.destroy());
  });
}

export default async function globalTeardown() {
  const uiServerProc: ChildProcess = globalThis.uiServerProc;

  const waits: Promise<void>[] = [];

  if (uiServerProc) {
    console.log("Closing UI server...");
    waits.push(
      killProcess(uiServerProc).then(() => console.log("...UI server closed"))
    );
  }

  const gelServerProc: ChildProcess = globalThis.gelServerProc;

  if (gelServerProc) {
    console.log("Closing Gel server...");
    waits.push(
      killProcess(gelServerProc).then(() =>
        console.log("...Gel server closed")
      )
    );
  }

  await Promise.all(waits);
}
