import {performance} from "perf_hooks";

import * as edgedb from "edgedb";
import {PrepareMessageHeaders} from "edgedb/dist/src/ifaces";
import {parseConnectArguments, ConnectConfig} from "edgedb/dist/src/con_utils";

import {handle} from "../shared/typedIPC/main";

const queryHeaders: PrepareMessageHeaders = {
  implicitTypenames: "true",
  implicitTypeids: "true",
};

const connections = new Map<string, edgedb._RawConnection>();

function hrTime(): number {
  const [s, ns] = process.hrtime();
  return s * 1000 + ns / 1_000_000;
}

function sleep(durationMillis: number): Promise<void> {
  return new Promise((accept) => {
    setTimeout(() => accept(), durationMillis);
  });
}

async function connect(config: ConnectConfig): Promise<edgedb._RawConnection> {
  const _config = parseConnectArguments(config);

  const maxTime = hrTime() + (_config.waitUntilAvailable || 0);

  let iteration = 1;
  while (true) {
    for (const addr of _config.addrs) {
      try {
        // @ts-ignore
        const connection = await edgedb._RawConnection.connectWithTimeout(
          addr,
          _config
        );
        return connection;
      } catch (e) {
        if (e instanceof edgedb.ClientConnectionError) {
          if (e.hasTag(edgedb.SHOULD_RECONNECT)) {
            if (iteration > 1 && hrTime() > maxTime) {
              throw e;
            }
            continue;
          } else {
            throw e;
          }
        } else {
          throw e; // this shouldn't happen
        }
      }
    }

    iteration += 1;
    await sleep(Math.trunc(10 + Math.random() * 200));
  }
}

handle("createConnection", async (id, config) => {
  if (connections.has(id)) {
    await connections.get(id)?.close();
  }

  let conn: edgedb._RawConnection;
  switch (config.type) {
    case "manual": {
      const [host, port] = config.hostAndPort.trim().split(":");
      const portNum = parseInt(port, 10);
      conn = await connect({
        host,
        port: Number.isNaN(portNum) ? undefined : portNum,
        database: config.database,
        user: config.user,
        password: config.password || undefined,
      });
      break;
    }
    case "instance":
      conn = await connect({
        dsn: config.instanceName,
        database: config.database,
      });
      break;
  }

  connections.set(id, conn);
});

handle("closeConnection", async (id) => {
  const conn = connections.get(id);
  if (conn) {
    await conn.close();
    connections.delete(id);
  }
});

handle("query", async (connId, query) => {
  const conn = connections.get(connId);
  if (!conn) {
    throw new Error("Connection does not exist");
  }

  const startTime = performance.now();

  const [_, outCodecBuf] = await conn.rawParse(query, queryHeaders);

  const parseEndTime = performance.now();

  const resultBuf = await conn.rawExecute();

  const executeEndTime = performance.now();

  return {
    outCodecBuf,
    resultBuf,
    duration: {
      prepare: Math.round(parseEndTime - startTime),
      execute: Math.round(executeEndTime - parseEndTime),
    },
  };
});

handle("prepare", async (connId, query) => {
  const conn = connections.get(connId);
  if (!conn) {
    throw new Error("Connection does not exist");
  }

  const startTime = performance.now();

  const [inCodecBuf, outCodecBuf] = await conn.rawParse(query, queryHeaders);

  const parseEndTime = performance.now();

  return {
    inCodecBuf,
    outCodecBuf,
    duration: Math.round(parseEndTime - startTime),
  };
});

handle("execute", async (connId, encodedParams) => {
  const conn = connections.get(connId);
  if (!conn) {
    throw new Error("Connection does not exist");
  }

  const startTime = performance.now();

  const resultBuf = await conn.rawExecute(Buffer.from(encodedParams));

  const executeEndTime = performance.now();

  return {
    resultBuf,
    duration: Math.round(executeEndTime - startTime),
  };
});
