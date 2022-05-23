import {openDB, DBSchema} from "idb";
import {SchemaData} from "../state/database";

// interface ReplResult {
//   replId: string;
//   outCodecBuf: Buffer;
//   resultBuf: Buffer;
// }

interface IDBStore extends DBSchema {
  // replResults: {
  //   key: string;
  //   value: ReplResult;
  //   indexes: {
  //     replId: string;
  //   };
  // };
  schemaData: {
    key: string;
    value: {instanceId: string; data: SchemaData};
    indexes: {
      byInstanceId: string;
    };
  };
}

const db = openDB<IDBStore>("EdgeDBStudio", 1, {
  upgrade(db, oldVersion) {
    switch (oldVersion) {
      case 0: {
        // const replResultStore = db.createObjectStore("replResults");
        // replResultStore.createIndex("replId", "replId");

        const schemaDataStore = db.createObjectStore("schemaData");
        schemaDataStore.createIndex("byInstanceId", "instanceId");
      }
    }
  },
});

// repl results

// export async function storeReplResult(resultId: string, result: ReplResult) {
//   await (await db).add("replResults", result, resultId);
// }

// export async function fetchReplResult(resultId: string) {
//   return (await db).get("replResults", resultId);
// }

// export async function removeReplResults(replId: string) {
//   const tx = (await db).transaction("replResults", "readwrite");
//   const resultIds = await tx.store.index("replId").getAllKeys(replId);
//   await Promise.all([...resultIds.map((id) => tx.store.delete(id)), tx.done]);
// }

// schema data

export async function storeSchemaData(
  dbName: string,
  instanceId: string,
  data: SchemaData
) {
  await (
    await db
  ).put("schemaData", {instanceId, data}, `${instanceId}/${dbName}`);
}

export async function fetchSchemaData(dbName: string, instanceId: string) {
  const result = await (await db).get("schemaData", `${instanceId}/${dbName}`);
  return result?.data;
}

export async function cleanupOldSchemaDataForInstance(
  instanceId: string,
  currentDbNames: string[]
) {
  const currentDbKeys = new Set(
    currentDbNames.map((dbName) => `${instanceId}/${dbName}`)
  );
  const tx = (await db).transaction("schemaData", "readwrite");
  const dbKeys = await tx.store.index("byInstanceId").getAllKeys(instanceId);
  await Promise.all([
    ...dbKeys
      .filter((dbKey) => !currentDbKeys.has(dbKey))
      .map((dbKey) => tx.store.delete(dbKey)),
    tx.done,
  ]);
}
