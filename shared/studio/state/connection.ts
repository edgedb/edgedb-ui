import {action, computed} from "mobx";
import {
  createContext,
  model,
  Model,
  prop,
  _async,
  _await,
} from "mobx-keystone";

import {AuthenticationError} from "edgedb";
import {Session} from "edgedb/dist/options";
import LRU from "edgedb/dist/primitives/lru";
import {Capabilities} from "edgedb/dist/baseConn";
import {AdminUIFetchConnection} from "edgedb/dist/fetchConn";
import {Cardinality, OutputFormat, QueryOptions} from "edgedb/dist/ifaces";
import {ICodec} from "edgedb/dist/codecs/ifaces";

import {
  decode,
  EdgeDBSet,
  QueryParams,
  codecsRegistry,
} from "../utils/decodeRawBuffer";
import {instanceCtx} from "./instance";
import {sessionStateCtx} from "./sessionState";
import {splitQueryIntoStatements} from "../utils/syntaxTree";

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
  outCodecBuf: Uint8Array;
  resultBuf: Uint8Array;
  capabilities: number;
  status: string;
}

interface ParseResult {
  outCodecBuf: Uint8Array;
  duration: number;
}

type QueryKind = "query" | "parse" | "execute";

type QueryOpts = {
  newCodec?: boolean;
  ignoreSessionConfig?: boolean;
  implicitLimit?: bigint;
};

type PendingQuery = {
  query: string;
  params?: QueryParams;
  opts: QueryOpts;
  abortSignal: AbortSignal | null;
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

  private _codecCache = new LRU<string, [any, any, Uint8Array, number]>({
    capacity: 200,
  });
  private _queryQueue: PendingQuery[] = [];

  @computed
  get _state() {
    const sessionState = sessionStateCtx.get(this);

    let state = Session.defaults();

    if (sessionState?.activeState.globals.length) {
      state = state.withGlobals(
        sessionState.activeState.globals.reduce((globals, global) => {
          globals[global.name] = global.value;
          return globals;
        }, {} as {[key: string]: any})
      );
    }
    if (sessionState?.activeState.config.length) {
      state = state.withConfig(
        sessionState.activeState.config.reduce((configs, config) => {
          configs[config.name] = config.value;
          return configs;
        }, {} as {[key: string]: any})
      );
    }
    return state;
  }

  query(
    query: string,
    params?: QueryParams,
    opts: QueryOpts = {},
    abortSignal?: AbortSignal
  ): Promise<QueryResult> {
    return this._addQueryToQueue("query", query, params, abortSignal, opts);
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
    abortSignal: AbortSignal | null = null,
    opts: QueryOpts = {}
  ) {
    return new Promise<any>((resolve, reject) => {
      this._queryQueue.push({
        kind,
        query,
        params,
        opts,
        abortSignal,
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
          query.opts,
          query.params,
          query.abortSignal
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

  private checkAborted(abortSignal: AbortSignal | null) {
    if (abortSignal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
  }

  async _query(
    kind: QueryKind,
    queryString: string,
    opts: QueryOpts,
    params: QueryParams | undefined,
    abortSignal: AbortSignal | null
  ): Promise<QueryResult | ParseResult | void> {
    try {
      this.checkAborted(abortSignal);

      let state = this._state;

      if (opts.ignoreSessionConfig) {
        state = Session.defaults().withGlobals(state.globals);
      }

      if (kind === "execute") {
        await this.conn.rawExecute(
          queryString,
          state,
          undefined,
          undefined,
          undefined,
          undefined,
          abortSignal
        );
        return;
      }

      const statements = splitQueryIntoStatements(queryString);
      const lastStatement = statements[statements.length - 1];
      const isExplain = lastStatement && /^\s*analyze/i.test(lastStatement);

      if (isExplain) {
        console.log(
          "explain query; disabling typename injection + implicit limits"
        );
      }

      const startTime = performance.now();

      // @ts-ignore - Ignore _ is declared but not used error
      let inCodec, outCodec, outCodecBuf, capabilities, _;

      if (kind !== "parse" && this._codecCache.has(queryString)) {
        [inCodec, outCodec, outCodecBuf, capabilities] =
          this._codecCache.get(queryString)!;
      } else {
        [inCodec, outCodec, _, outCodecBuf, _, capabilities] =
          await this.conn.rawParse(
            queryString,
            state,
            isExplain ? {} : queryOptions,
            abortSignal
          );
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

      this.checkAborted(abortSignal);

      const resultBuf = await this.conn.rawExecute(
        queryString,
        state,
        outCodec,
        isExplain ? {} : {...queryOptions, implicitLimit: opts.implicitLimit},
        inCodec,
        params,
        abortSignal
      );
      const newOutCodec = (
        (this.conn as any).queryCodecCache as LRU<
          string,
          [number, ICodec, ICodec, number]
        >
      ).get(
        (this.conn as any)._getQueryCacheKey(
          queryString,
          OutputFormat.BINARY,
          Cardinality.MANY
        )
      )?.[2];
      if (newOutCodec && newOutCodec?.tid !== outCodec.tid) {
        this.checkAborted(abortSignal);
        [inCodec, outCodec, _, outCodecBuf, _, capabilities] =
          await this.conn.rawParse(
            queryString,
            state,
            isExplain ? {} : queryOptions,
            abortSignal
          );
        this._codecCache.set(queryString, [
          inCodec,
          outCodec,
          outCodecBuf,
          capabilities,
        ]);
      }

      const executeEndTime = performance.now();

      const duration = {
        prepare: Math.round(parseEndTime - startTime),
        execute: Math.round(executeEndTime - parseEndTime),
      };

      return {
        result: decode(outCodecBuf, resultBuf, opts.newCodec),
        duration,
        outCodecBuf,
        resultBuf,
        capabilities,
        status: (this.conn as any).lastStatus,
      };
    } catch (err) {
      if (err instanceof AuthenticationError) {
        instanceCtx.get(this)!._refreshAuthToken?.();
      }
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new DOMException("Query was canceled by user.", "AbortError");
      }
      throw err;
    }
  }
}
