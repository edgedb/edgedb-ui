import Event from "edgedb/dist/primitives/event";

import http from "http";

import {ChildProcess, spawn} from "child_process";

const STARTUP_TIMEOUT = 5 * 60_000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) =>
    setTimeout(() => {
      resolve();
    }, ms)
  );

function checkEdgeDBServerAlive() {
  return new Promise<boolean>((resolve) => {
    const req = http.get(
      "http://localhost:5656/server/status/alive",
      (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    );
    req.on("error", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitUntilAlive(check: () => Promise<boolean>, event: Event) {
  for (let i = 0; i < STARTUP_TIMEOUT / 1000; i++) {
    if (await check()) {
      event.set();
      return;
    }
    await sleep(1000);
  }
  event.setError("EdgeDB server startup timed out");
}

async function checkUIServerAlive() {
  return new Promise<boolean>((resolve) => {
    const req = http.get("http://127.0.0.1:3000/", (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    req.on("error", (err) => {
      req.destroy();
      resolve(false);
    });
  });
}

export default async function () {
  console.log("\n");

  let edbServerProc: ChildProcess | null = null;
  const edbServerAlive = new Event();

  if (await checkEdgeDBServerAlive()) {
    console.log("Re-using EdgeDB server already running on 5656");
    edbServerAlive.set();
  } else {
    console.log("Starting EdgeDB server...");

    const srvcmd = process.env.EDGEDB_SERVER_BIN ?? "edgedb-server";

    const args = process.env.CI
      ? [
          "--temp-dir",
          "--security=insecure_dev_mode",
          "--testmode",
          "--port=5656",
        ]
      : ["--devmode"];

    edbServerProc = spawn(srvcmd, args, {
      env: {...process.env, EDGEDB_DEBUG_HTTP_INJECT_CORS: "1"},
    }) as ChildProcess;
    edbServerProc.once("close", (code) => {
      if (!edbServerAlive.done) {
        edbServerAlive.setError(
          `EdgeDB server failed to start with exit code: ${code}`
        );
      }
    });
    waitUntilAlive(checkEdgeDBServerAlive, edbServerAlive);
  }

  let uiServerProc: ChildProcess | null = null;
  const uiServerAlive = new Event();

  if (await checkUIServerAlive()) {
    console.log("Re-using UI server already running on 3000");
    uiServerAlive.set();
  } else {
    console.log("Starting UI server...");
    uiServerProc = spawn("yarn", ["start"], {
      // @ts-ignore
      env: {...process.env, NODE_ENV: undefined},
    }) as ChildProcess;
    uiServerProc.once("close", (code) => {
      if (!uiServerAlive.done) {
        uiServerAlive.setError(
          `UI server failed to start with exit code: ${code}`
        );
      }
    });
    waitUntilAlive(checkUIServerAlive, uiServerAlive);
  }

  await Promise.all([
    uiServerAlive.wait().then(() => {
      if (uiServerProc) console.log("...UI server running");
    }),
    edbServerAlive.wait().then(() => {
      if (edbServerProc) console.log("...EdgeDB server running");
    }),
  ]);

  // @ts-ignore
  globalThis.uiServerProc = uiServerProc;
  // @ts-ignore
  globalThis.edgedbServerProc = edbServerProc;

  console.log("\n");
}
