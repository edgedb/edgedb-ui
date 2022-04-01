import {action, computed, observable} from "mobx";
import {
  createContext,
  model,
  Model,
  modelFlow,
  prop,
  _async,
  _await,
} from "mobx-keystone";

import {FetchConnection} from "edgedb/dist/fetchConn";
import {PrepareMessageHeaders} from "edgedb/dist/ifaces";

import {
  decode,
  EdgeDBSet,
  QueryParams,
  encodeArgs,
  codecsRegistry,
} from "src/utils/decodeRawBuffer";

import {QueryDuration} from "src/interfaces/connection";

export type {QueryParams};

export const connCtx = createContext<Connection>();

interface ConnectConfig {
  database: string;
}

interface QueryResult {
  result: EdgeDBSet | null;
  duration: QueryDuration;
  outCodecBuf: Buffer;
  resultBuf: Buffer;
}

interface PrepareResult {
  outCodecBuf: Buffer;
  duration: number;
}

type QueryKind = "query" | "prepare" | "executeScript";

type PendingQuery = {
  query: string;
  params?: QueryParams;
  silent: boolean;
  reject: (error: Error) => void;
} & (
  | {kind: "query"; resolve: (result: QueryResult) => void}
  | {kind: "prepare"; resolve: (result: QueryResult) => void}
  | {kind: "executeScript"; resolve: (result: void) => void}
);

export enum TransactionState {
  Active,
  InError,
  Committed,
  Rolledback,
}

const queryHeaders: PrepareMessageHeaders = {
  implicitTypenames: "true",
  implicitTypeids: "true",
};

@model("TransactionState")
export class Transaction extends Model({
  state: prop<TransactionState>(TransactionState.Active).withSetter(),
}) {}

@model("Connection")
export class Connection extends Model({
  config: prop<ConnectConfig>(),
}) {
  @observable connecting = false;
  @observable isConnected = true;
  @observable errorMessage = "";

  @computed
  get transaction(): any {
    return;
    // return tabCtx.get(this)?.replView.currentTransaction;
  }

  conn = FetchConnection.create(
    {
      address:
        process.env.NODE_ENV === "development" ? ["localhost", 5656] : "",
      database: this.config.database,
    },
    codecsRegistry
  );

  onAttachedToRootStore() {
    return () => {
      this.close();
    };
  }

  @modelFlow
  connect = _async(function* (this: Connection) {
    this.connecting = true;
    this.errorMessage = "";

    try {
      // yield* _await(ipc.invoke("createConnection", id, {...this.config}));
      this.isConnected = true;
    } catch (e: any) {
      console.error(e);
      this.errorMessage = e.message;
    } finally {
      this.connecting = false;
    }
  });

  @observable private _runningQuery = false;
  @observable runningQuery = false;

  private _queryQueue: PendingQuery[] = [];

  query(
    query: string,
    silent: boolean = false,
    params?: QueryParams
  ): Promise<QueryResult> {
    return this._addQueryToQueue("query", query, silent, params);
  }

  prepare(query: string, silent: boolean = false): Promise<PrepareResult> {
    return this._addQueryToQueue("prepare", query, silent);
  }

  executeScript(script: string, silent: boolean = false): Promise<void> {
    return this._addQueryToQueue("executeScript", script, silent);
  }

  _addQueryToQueue(
    kind: QueryKind,
    query: string,
    silent: boolean,
    params?: QueryParams
  ) {
    return new Promise<any>((resolve, reject) => {
      this._queryQueue.push({
        kind,
        query,
        params,
        silent,
        resolve,
        reject,
      });

      if (!this._runningQuery) {
        this._processQueryQueue();
      }
    });
  }

  @action
  async _processQueryQueue() {
    const query = this._queryQueue.shift();
    if (query) {
      this._runningQuery = true;
      this.runningQuery = !query.silent;
      try {
        const result = await this._query(
          query.kind,
          query.query,
          query.params
        );
        query.resolve(result as any);
      } catch (e: any) {
        query.reject(e);
      }
      this._processQueryQueue();
    } else {
      this._runningQuery = false;
      this.runningQuery = false;
    }
  }

  async _query(
    kind: QueryKind,
    queryString: string,
    params?: QueryParams
  ): Promise<QueryResult | PrepareResult | void> {
    if (kind === "executeScript") {
      return await this.conn.rawExecuteScript(queryString);
    }

    const startTime = performance.now();

    const [inCodec, outCodec, inCodecBuf, outCodecBuf, protoVer] =
      await this.conn.rawParse(queryString, queryHeaders);

    const parseEndTime = performance.now();

    if (kind === "prepare") {
      return {outCodecBuf, duration: Math.round(parseEndTime - startTime)};
    }

    const resultBuf = await this.conn.rawExecute(
      queryString,
      outCodec,
      queryHeaders,
      inCodec,
      params
    );

    const executeEndTime = performance.now();

    const duration = {
      prepare: Math.round(parseEndTime - startTime),
      execute: Math.round(executeEndTime - parseEndTime),
    };

    return {
      result: decode(outCodecBuf, resultBuf),
      duration,
      outCodecBuf,
      resultBuf,
    };
  }

  @modelFlow
  close = _async(function* (this: Connection) {
    // yield* _await(ipc.invoke("closeConnection", id));
    this.isConnected = false;
  });
}
