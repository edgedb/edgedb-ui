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

import {_createFetchClient} from "edgedb/dist/client";

import {
  decode,
  EdgeDBSet,
  QueryParams,
  encodeArgs,
} from "../../utils/decodeRawBuffer";

import {QueryDuration} from "src/interfaces/connection";

export type {QueryParams};

const ipc = {} as any;

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

type QueryKind = "query" | "prepare";

type PendingQuery = {
  query: string;
  params?: QueryParams;
  silent: boolean;
  reject: (error: Error) => void;
} & (
  | {kind: "query"; resolve: (result: QueryResult) => void}
  | {kind: "prepare"; resolve: (result: QueryResult) => void}
);

export enum TransactionState {
  Active,
  InError,
  Committed,
  Rolledback,
}

@model("TransactionState")
export class Transaction extends Model({
  state: prop<TransactionState>(TransactionState.Active).withSetter(),
}) {}

@model("Connection")
export class Connection extends Model({
  config: prop<ConnectConfig>(),
}) {
  @observable connecting = false;
  @observable isConnected = false;
  @observable errorMessage = "";

  @computed
  get transaction(): any {
    return;
    // return tabCtx.get(this)?.replView.currentTransaction;
  }

  client = _createFetchClient({
    address: ["localhost", 5656],
    database: this.config.database,
  });

  onAttachedToRootStore() {
    return () => {
      this.close();
    };
  }

  @modelFlow
  connect = _async(function* (this: Connection) {
    const id = this.$modelId;

    this.connecting = true;
    this.errorMessage = "";

    try {
      yield* _await(ipc.invoke("createConnection", id, {...this.config}));
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
  ): Promise<QueryResult | PrepareResult> {
    if (params || kind === "prepare") {
      throw new Error("Not implemented");
      const {
        inCodecBuf,
        outCodecBuf,
        duration: prepareDuration,
      } = await ipc.invoke("prepare", this.$modelId, queryString);

      if (kind === "prepare") {
        return {outCodecBuf, duration: prepareDuration};
      }

      const encodedParamsBuf = encodeArgs(inCodecBuf, params!);

      const {resultBuf, duration: executeDuration} = await ipc.invoke(
        "execute",
        this.$modelId,
        encodedParamsBuf
      );

      return {
        result: decode(outCodecBuf, resultBuf),
        duration: {prepare: prepareDuration, execute: executeDuration},
        outCodecBuf,
        resultBuf,
      };
    } else {
      // const {outCodecBuf, resultBuf, duration} = await ipc.invoke(
      //   "query",
      //   this.$modelId,
      //   queryString
      // );

      const result = await this.client.query<any>(queryString);

      return {
        result, //: decode(outCodecBuf, resultBuf),
        duration: 0,
        outCodecBuf: Buffer.alloc(0),
        resultBuf: Buffer.alloc(0),
      };
    }
  }

  @modelFlow
  close = _async(function* (this: Connection) {
    const id = this.$modelId;
    yield* _await(ipc.invoke("closeConnection", id));
    this.isConnected = false;
  });
}
