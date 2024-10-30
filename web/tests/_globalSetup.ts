import http from "http";
import {ChildProcess, spawn} from "child_process";

import createClient, {AccessError, UnknownDatabaseError} from "edgedb";
import Event from "edgedb/dist/primitives/event";

import {schemaScript} from "@edgedb/studio/tabs/dashboard/exampleSchema";

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

async function waitUntilAlive(
  check: () => Promise<boolean>,
  errMessage: string,
  event?: Event
) {
  for (let i = 0; i < STARTUP_TIMEOUT / 1000; i++) {
    if (await check()) {
      event?.set();
      return;
    }
    await sleep(1000);
  }
  if (event) {
    event.setError(errMessage);
  } else {
    throw new Error(errMessage);
  }
}

async function checkUIServerAlive() {
  return new Promise<boolean>((resolve) => {
    const req = http.get("http://127.0.0.1:3002/", (res) => {
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

async function checkConfigApplied() {
  try {
    const res = await fetch("http://localhost:5656/server-info");
    if (res.ok) {
      const info = await res.json();
      if (info.instance_config.cors_allow_origins.length > 0) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export default async function globalSetup() {
  console.log("\n");

  let edbServerProc: ChildProcess | null = null;
  const edbServerAlive = new Event();
  let usingExistingDevServer = false;

  if (await checkEdgeDBServerAlive()) {
    console.log("Re-using EdgeDB server already running on 5656");
    usingExistingDevServer = true;
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

    edbServerProc = spawn(srvcmd, args) as ChildProcess;
    edbServerProc.once("close", (code) => {
      if (!edbServerAlive.done) {
        edbServerAlive.setError(
          `EdgeDB server failed to start with exit code: ${code}`
        );
      }
    });
    waitUntilAlive(
      checkEdgeDBServerAlive,
      "EdgeDB server startup timed out",
      edbServerAlive
    );
  }

  let uiServerProc: ChildProcess | null = null;
  const uiServerAlive = new Event();

  if (await checkUIServerAlive()) {
    console.log("Re-using UI server already running on 3002");
    uiServerAlive.set();
  } else {
    console.log("Starting UI server...");
    uiServerProc = spawn("yarn", ["dev"], {
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
    waitUntilAlive(
      checkUIServerAlive,
      "UI server startup timed out",
      uiServerAlive
    );
  }

  await Promise.all([
    uiServerAlive.wait().then(() => {
      if (uiServerProc) console.log("...UI server running");
    }),
    edbServerAlive.wait().then(() => {
      if (edbServerProc) console.log("...EdgeDB server running");
    }),
  ]);

  console.log("Creating '_test' database...");
  const client = createClient({port: 5656, tlsSecurity: "insecure"});
  try {
    await client.execute("drop database _test");
  } catch (err) {
    if (!(err instanceof UnknownDatabaseError)) throw err;
  }
  await client.execute("create database _test");
  const testClient = createClient({
    port: 5656,
    tlsSecurity: "insecure",
    database: "_test",
  });
  for (let i = 0; i < 10; i++) {
    await sleep(500);

    try {
      await testClient.execute(schemaScript);
      if (!usingExistingDevServer) {
        await testClient.execute(
          `configure instance set cors_allow_origins := {'*'}`
        );
        await waitUntilAlive(checkConfigApplied, "Config apply timed out");
      }
      break;
    } catch (err) {
      if (!(err instanceof AccessError)) {
        throw err;
      }
    }
  }
  console.log("... Done");

  // @ts-ignore
  globalThis.uiServerProc = uiServerProc;
  // @ts-ignore
  globalThis.edgedbServerProc = edbServerProc;

  console.log("\n");
}
