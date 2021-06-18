import {execFile, spawn, ChildProcess} from "child_process";
import path from "path";

import {app} from "electron";
import isDev from "electron-is-dev";
import * as z from "zod";

import {
  handle,
  handleWithProgress,
  registerSubscription,
} from "../shared/typedIPC/main";
import {ServerType} from "../shared/interfaces/serverInstances";

const edgedbCliPath = isDev
  ? "edgedb"
  : path.join(app.getAppPath(), "../edgedb-cli");

async function runCliCommand(args: string[]) {
  return new Promise<{stdout: string; stderr: string}>((resolve, reject) => {
    try {
      execFile(
        edgedbCliPath,
        ["--no-version-check", ...args],
        {},
        (err, stdout, stderr) => {
          if (err) {
            reject(err);
          }
          resolve({stdout, stderr});
        }
      );
    } catch (e) {
      reject(e);
    }
  });
}

async function runCliCommandWithProgress(
  args: string[],
  onUpdate: (data: string) => void
) {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(edgedbCliPath, ["--no-version-check", ...args], {});

    proc.on("error", reject);

    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");

    proc.stdout.on("data", (data) => onUpdate(data));

    let error = "";
    proc.stderr.on("data", (data) => (error += data));

    proc.on("exit", (code) => {
      if (code !== 0) {
        reject(`Exited with code ${code}: ${error}`);
      } else {
        resolve();
      }
    });
  });
}

const instancesStatusValidator = z.array(
  z.object({
    name: z.string(),
    port: z.number(),
    "major-version": z.string(),
    status: z.enum(["running", "not running", "inactive"]),
    method: z.enum(["package", "docker"]),
  })
);

handle("getInstances", async () => {
  const {stdout} = await runCliCommand(["server", "status", "--json"]);

  if (!stdout) {
    return [];
  }

  return instancesStatusValidator
    .parse(JSON.parse(stdout))
    .map(({"major-version": version, ...fields}) => ({version, ...fields}));
});

const serverVersionsValidator = z.array(
  z.object({
    "major-version": z.string(),
    "latest-version": z.string(),
    "available-for-methods": z.array(z.enum(["package", "docker"])),
    installed: z.object({
      package: z.string().optional(),
      docker: z.string().optional(),
    }),
    "option-to-install": z.string(),
  })
);

handle("getServerVersions", async () => {
  const {stdout} = await runCliCommand(["server", "list-versions", "--json"]);

  if (!stdout) {
    return [];
  }

  return serverVersionsValidator.parse(JSON.parse(stdout)).flatMap((version) =>
    version["available-for-methods"].map((type) => ({
      version: version["major-version"],
      fullVersion: version.installed[type] ?? version["latest-version"],
      type: type as ServerType,
      installed: !!version.installed[type],
    }))
  );
});

handleWithProgress("installServer", async ({version, type}, onUpdate) => {
  await runCliCommandWithProgress(
    [
      "server",
      "install",
      "--method",
      type,
      ...(version === "nightly" ? ["--nightly"] : ["--version", version]),
    ],
    onUpdate
  );
});

handleWithProgress("uninstallServer", async ({version}, onUpdate) => {
  await runCliCommandWithProgress(
    [
      "server",
      "uninstall",
      ...(version === "nightly" ? ["--nightly"] : ["--version", version]),
    ],
    onUpdate
  );
});

handleWithProgress("initInstance", async ({name, version, type}, onUpdate) => {
  await runCliCommandWithProgress(
    ["server", "init", "--method", type, "--version", version, name],
    onUpdate
  );
});

handleWithProgress("destroyInstance", async ({name}, onUpdate) => {
  await runCliCommandWithProgress(["server", "destroy", name], onUpdate);
});

handle("startInstance", async (name) => {
  await runCliCommand(["server", "start", name]);
});

handle("stopInstance", async (name) => {
  await runCliCommand(["server", "stop", name]);
});

handle("restartInstance", async (name) => {
  await runCliCommand(["server", "restart", name]);
});

handleWithProgress("upgradeInstance", async ({name, toVersion}, onUpdate) => {
  await runCliCommandWithProgress(
    [
      "server",
      "upgrade",
      ...(toVersion === "nightly"
        ? ["--to-nightly"]
        : ["--to-version", toVersion]),
      name,
    ],
    onUpdate
  );
});

handleWithProgress("upgradeAllInstances", async ({nightly}, onUpdate) => {
  await runCliCommandWithProgress(
    ["server", "upgrade", ...(nightly ? ["--nightly"] : [])],
    onUpdate
  );
});

const runningProcesses = new Set<ChildProcess>();

registerSubscription("logs", async ({instanceName}, onUpdate) => {
  console.log(instanceName);

  const proc = spawn(edgedbCliPath, [
    "--no-version-check",
    "server",
    "logs",
    "--follow",
    instanceName,
  ]);

  runningProcesses.add(proc);

  proc.stderr.setEncoding("utf8");
  proc.stderr.on("data", (data) => {
    onUpdate(data);
  });

  proc.on("exit", () => {
    console.log("process exited");
    runningProcesses.delete(proc);
  });

  return () => {
    proc.kill();
  };
});

app.on("quit", () => {
  for (const proc of runningProcesses) {
    proc.kill();
  }
});
