import {action, computed, observable} from "mobx";
import {model, Model, modelFlow, prop, _async, _await} from "mobx-keystone";

import {ipc} from "../../global";
import {
  decode,
  EdgeDBSet,
  QueryParams,
  encodeArgs,
} from "../../utils/decodeRawBuffer";

import {
  ConnectConfig,
  QueryDuration,
} from "../../../shared/interfaces/connections";
import {tabCtx} from ".";

export type {QueryParams};

interface QueryResult {
  result: EdgeDBSet | null;
  duration: QueryDuration;
  outCodecBuf: Buffer;
  resultBuf: Buffer;
}

interface PendingQuery {
  query: string;
  params?: QueryParams;
  silent: boolean;
  resolve: (result: QueryResult) => void;
  reject: (error: Error) => void;
}

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
  get transaction() {
    return tabCtx.get(this)?.replView.currentTransaction;
  }

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
    } catch (e) {
      console.error(e);
      this.errorMessage = e.message;
    } finally {
      this.connecting = false;
    }
  });

  @observable private _runningQuery = false;
  @observable runningQuery = false;

  private _queryQueue: PendingQuery[] = [];

  query(queryString: string, silent: boolean = false, params?: QueryParams) {
    return new Promise<QueryResult>((resolve, reject) => {
      this._queryQueue.push({
        query: queryString,
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
        const result = await this._query(query.query, query.params);
        query.resolve(result);
      } catch (e) {
        query.reject(e);
      }
      this._processQueryQueue();
    } else {
      this._runningQuery = false;
      this.runningQuery = false;
    }
  }

  async _query(
    queryString: string,
    params?: QueryParams
  ): Promise<QueryResult> {
    if (params) {
      const {
        inCodecBuf,
        outCodecBuf,
        duration: prepareDuration,
      } = await ipc.invoke("prepare", this.$modelId, queryString);

      const encodedParamsBuf = encodeArgs(inCodecBuf, params);

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
      const {outCodecBuf, resultBuf, duration} = await ipc.invoke(
        "query",
        this.$modelId,
        queryString
      );

      return {
        result: decode(outCodecBuf, resultBuf),
        duration,
        outCodecBuf,
        resultBuf,
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
