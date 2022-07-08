import {action, computed} from "mobx";
import {
  createContext,
  model,
  Model,
  prop,
  _async,
  _await,
} from "mobx-keystone";

import {Session} from "edgedb/dist/options";
import LRU from "edgedb/dist/primitives/lru";
import {Capabilities} from "edgedb/dist/baseConn";
import {AdminUIFetchConnection} from "edgedb/dist/fetchConn";
import {QueryOptions} from "edgedb/dist/ifaces";

import {
  decode,
  EdgeDBSet,
  QueryParams,
  codecsRegistry,
} from "../utils/decodeRawBuffer";

export {Capabilities};
export type {QueryParams};

export interface QueryDuration {
  prepare: number;
  execute: number;
}

export const connCtx = createContext<Connection>();

interface ConnectConfig {
  serverUrl: string;
  authToken: string;
  database: string;
  user: string;
}

interface QueryResult {
  result: EdgeDBSet | null;
  duration: QueryDuration;
  outCodecBuf: Buffer;
  resultBuf: Buffer;
  capabilities: number;
  status: string;
}

interface ParseResult {
  outCodecBuf: Buffer;
  duration: number;
}

type QueryKind = "query" | "parse" | "execute";

type PendingQuery = {
  query: string;
  params?: QueryParams;
  newCodec: boolean;
  reject: (error: Error) => void;
} & (
  | {kind: "query"; resolve: (result: QueryResult) => void}
  | {kind: "parse"; resolve: (result: QueryResult) => void}
  | {kind: "execute"; resolve: (result: void) => void}
);

const queryOptions: QueryOptions = {
  injectTypenames: true,
  injectTypeids: true,
  injectObjectids: true,
};

@model("Connection")
export class Connection extends Model({
  config: prop<ConnectConfig>(),
}) {
  conn = AdminUIFetchConnection.create(
    {
      address: this.config.serverUrl,
      database: this.config.database,
      user: this.config.user,
      token: this.config.authToken,
    },
    codecsRegistry
  );

  private _runningQuery = false;

  private _codecCache = new LRU<string, [any, any, Buffer, number]>({
    capacity: 200,
  });
  private _queryQueue: PendingQuery[] = [];

  @computed
  get _state() {
    let state = Session.defaults();
    return state;
  }

  query(
    query: string,
    params?: QueryParams,
    newCodec?: boolean
  ): Promise<QueryResult> {
    return this._addQueryToQueue("query", query, params, newCodec);
  }

  parse(query: string): Promise<ParseResult> {
    return this._addQueryToQueue("parse", query);
  }

  execute(script: string): Promise<void> {
    return this._addQueryToQueue("execute", script);
  }

  _addQueryToQueue(
    kind: QueryKind,
    query: string,
    params?: QueryParams,
    newCodec: boolean = false
  ) {
    return new Promise<any>((resolve, reject) => {
      this._queryQueue.push({
        kind,
        query,
        params,
        newCodec,
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
      try {
        const result = await this._query(
          query.kind,
          query.query,
          query.newCodec,
          query.params
        );
        query.resolve(result as any);
      } catch (e: any) {
        query.reject(e);
      }
      this._processQueryQueue();
    } else {
      this._runningQuery = false;
    }
  }

  async _query(
    kind: QueryKind,
    queryString: string,
    newCodec: boolean,
    params?: QueryParams
  ): Promise<QueryResult | ParseResult | void> {
    if (kind === "execute") {
      await this.conn.rawExecute(queryString, this._state);
      return;
    }

    const startTime = performance.now();

    let inCodec, outCodec, outCodecBuf, capabilities, _;

    if (this._codecCache.has(queryString)) {
      [inCodec, outCodec, outCodecBuf, capabilities] =
        this._codecCache.get(queryString)!;
    } else {
      [inCodec, outCodec, _, outCodecBuf, _, capabilities] =
        await this.conn.rawParse(queryString, this._state, queryOptions);
      this._codecCache.set(queryString, [
        inCodec,
        outCodec,
        outCodecBuf,
        capabilities,
      ]);
    }

    const parseEndTime = performance.now();

    if (kind === "parse") {
      return {outCodecBuf, duration: Math.round(parseEndTime - startTime)};
    }

    const resultBuf = await this.conn.rawExecute(
      queryString,
      this._state,
      outCodec,
      queryOptions,
      inCodec,
      params
    );

    const executeEndTime = performance.now();

    const duration = {
      prepare: Math.round(parseEndTime - startTime),
      execute: Math.round(executeEndTime - parseEndTime),
    };

    return {
      result: decode(outCodecBuf, resultBuf, newCodec),
      duration,
      outCodecBuf,
      resultBuf,
      capabilities,
      status: (this.conn as any).lastStatus,
    };
  }
}
