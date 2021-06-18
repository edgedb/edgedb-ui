import {openDB, DBSchema} from "idb";
import {SchemaData} from "../state/models/tab";

interface ReplResult {
  replId: string;
  outCodecBuf: Buffer;
  resultBuf: Buffer;
}

interface IDBStore extends DBSchema {
  replResults: {
    key: string;
    value: ReplResult;
    indexes: {
      replId: string;
    };
  };
  schemaData: {
    key: string;
    value: SchemaData;
  };
}

const db = openDB<IDBStore>("edbStudio", 1, {
  // eslint-disable-next-line
  upgrade(db, oldVersion) {
    switch (oldVersion) {
      case 0: {
        const replResultStore = db.createObjectStore("replResults");
        replResultStore.createIndex("replId", "replId");

        db.createObjectStore("schemaData");
      }
    }
  },
});

// repl results

export async function storeReplResult(resultId: string, result: ReplResult) {
  await (await db).add("replResults", result, resultId);
}

export async function fetchReplResult(resultId: string) {
  return (await db).get("replResults", resultId);
}

export async function removeReplResults(replId: string) {
  const tx = (await db).transaction("replResults", "readwrite");
  const resultIds = await tx.store.index("replId").getAllKeys(replId);
  await Promise.all([...resultIds.map((id) => tx.store.delete(id)), tx.done]);
}

// schema data

export async function storeSchemaData(tabId: string, schemaData: SchemaData) {
  await (await db).put("schemaData", schemaData, tabId);
}

export async function fetchSchemaData(tabId: string) {
  return (await db).get("schemaData", tabId);
}
