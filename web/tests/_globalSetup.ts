import http from "http";

import {ChildProcess, spawn} from "child_process";

const STARTUP_TIMEOUT = 60_000;

const sleep = (ms: number) =>
  new Promise<void>((resolve) =>
    setTimeout(() => {
      resolve();
    }, ms)
  );

function checkEdgeDBServerAlive() {
  return new Promise((resolve) => {
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

async function waitUntilEdgeDBServerAlive() {
  for (let i = 0; i < STARTUP_TIMEOUT / 1000; i++) {
    if (await checkEdgeDBServerAlive()) {
      return;
    }
    await sleep(1000);
  }
  throw new Error("EdgeDB server startup timed out");
}

async function checkUIServerAlive() {
  return new Promise((resolve) => {
    const req = http.get("http://localhost:3000/", (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    req.on("error", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitUntilUIServerAlive() {
  for (let i = 0; i < STARTUP_TIMEOUT / 1000; i++) {
    if (await checkUIServerAlive()) {
      return;
    }
    await sleep(1000);
  }
  throw new Error("UI server startup timed out");
}

export default async function () {
  console.log("\n");

  let edbServerProc: ChildProcess | null = null;

  if (await checkEdgeDBServerAlive()) {
    console.log("Re-using EdgeDB server already running on 5656");
  } else {
    console.log("Starting EdgeDB server...");

    edbServerProc = spawn("edgedb-server", ["--devmode"], {
      env: {...process.env, EDGEDB_DEBUG_HTTP_INJECT_CORS: "1"},
    }) as ChildProcess;
  }

  let uiServerProc: ChildProcess | null = null;

  if (await checkUIServerAlive()) {
    console.log("Re-using UI server already running on 3000");
  } else {
    console.log("Starting UI server...");
    uiServerProc = spawn("yarn", ["start"], {
      // @ts-ignore
      env: {...process.env, NODE_ENV: undefined},
    }) as ChildProcess;
  }

  await Promise.all([
    uiServerProc
      ? waitUntilUIServerAlive().then(() =>
          console.log("...UI server running")
        )
      : null,
    edbServerProc
      ? waitUntilEdgeDBServerAlive().then(() =>
          console.log("...EdgeDB server running")
        )
      : null,
  ]);

  // @ts-ignore
  globalThis.uiServerProc = uiServerProc;
  // @ts-ignore
  globalThis.edgedbServerProc = edbServerProc;

  console.log("\n");
}
