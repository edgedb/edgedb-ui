import {action, computed, observable} from "mobx";
import {
  model,
  Model,
  ExtendedModel,
  prop,
  modelAction,
  modelFlow,
  _async,
  _await,
  findParent,
  ModelCreationData,
  Frozen,
  frozen,
  idProp,
} from "mobx-keystone";

import {Text} from "@codemirror/state";

import {InspectorState, resultGetterCtx} from "@edgedb/inspector/v2/state";

// import {
//   storeReplResult,
//   fetchReplResult,
//   removeReplResults,
// } from "../../../idbStore";

import {QueryDuration, Capabilities} from "../../../state/connection";

import {EdgeDBSet, decode} from "../../../utils/decodeRawBuffer";
import {
  ErrorDetails,
  extractErrorDetails,
} from "../../../utils/extractErrorDetails";
import {renderResultAsJson} from "../../../utils/renderJsonResult";

import {dbCtx} from "../../../state";
import {connCtx} from "../../../state/connection";
import {instanceCtx} from "../../../state/instance";

import {SplitViewState} from "@edgedb/common/ui/splitView/model";
import {
  serialiseParamsData,
  ParamsData,
  ReplQueryParamsEditor,
} from "./parameters";

@model("Repl/HistoryCell")
export class ReplHistoryCell extends Model({
  $modelId: idProp,
  query: prop<string>(),
  paramsData: prop<Frozen<ParamsData> | null>(null),
  timestamp: prop<number>(),
  duration: prop<number | QueryDuration>(),
  expanded: prop(false),
  renderHeight: prop<number>(64).withSetter(),
}) {
  @modelAction
  toggleExpanded() {
    this.expanded = !this.expanded;
  }

  edit() {
    const repl = findParent<Repl>(this, (parent) => parent instanceof Repl)!;
    repl.setCurrentQuery(Text.of(this.query.split("\n")));

    repl.queryParamsEditor.restoreParamsData(this.paramsData?.data);
  }

  copyToClipboard() {
    navigator.clipboard?.writeText(this.query);
  }
}

@model("Repl/ResultCell")
export class ReplResultCell extends ExtendedModel(ReplHistoryCell, {
  inspectorState: prop<InspectorState | null>(),
  status: prop<string>(),
}) {
  @observable.ref
  _result: EdgeDBSet | null = null;

  @action
  setResult(result: EdgeDBSet) {
    this._result = result;
  }

  onInit() {
    resultGetterCtx.set(this, async () => {
      if (this._result) {
        return {data: this._result, codec: this._result._codec};
      }
      const result = null as any; //await fetchReplResult(this.$modelId);
      const decodedResult =
        result && decode(result.outCodecBuf, result.resultBuf);
      if (decodedResult) {
        return {data: decodedResult, codec: decodedResult._codec};
      }
    });
  }

  copyAsJson() {
    navigator.clipboard?.writeText(
      renderResultAsJson(this._result, this._result!._codec)
    );
  }
}

@model("Repl/ErrorCell")
export class ReplErrorCell extends ExtendedModel(ReplHistoryCell, {
  error: prop<Frozen<ErrorDetails>>(),
}) {}

@model("Repl")
export class Repl extends Model({
  // currentQuery: prop("").withSetter(),
  queryParamsEditor: prop(() => new ReplQueryParamsEditor({})),

  queryHistory: prop<ReplHistoryCell[]>(() => []),

  splitView: prop(() => new SplitViewState({})),
  persistQuery: prop<boolean>(false).withSetter(),

  historyScrollPos: prop<number>(0).withSetter(),
}) {
  @observable queryRunning = false;

  @observable.ref
  currentQuery = Text.empty;

  @action
  setCurrentQuery(query: Text) {
    this.currentQuery = query;
  }

  @computed
  get canRunQuery() {
    return (
      !this.queryRunning &&
      !!this.currentQuery.toString().trim() &&
      !this.queryParamsEditor.hasErrors
    );
  }

  onAttachedToRootStore() {
    return () => {
      // removeReplResults(this.$modelId);
    };
  }

  historyCursor = -1;
  draftQuery = Text.empty;
  draftParams: ParamsData | null = null;

  navigateQueryHistory(direction: 1 | -1) {
    if (!this.queryHistory.length) {
      return;
    }

    const cursor = Math.max(
      -1,
      Math.min(this.historyCursor + direction, this.queryHistory.length - 1)
    );

    if (cursor !== this.historyCursor) {
      if (this.historyCursor === -1) {
        this.draftQuery = this.currentQuery;
        this.draftParams = this.queryParamsEditor.getParamsData();
      }

      this.historyCursor = cursor;
      if (cursor === -1) {
        this.setCurrentQuery(this.draftQuery);
        this.queryParamsEditor.restoreParamsData(
          this.draftParams ?? undefined
        );
      } else {
        const historyItem =
          this.queryHistory[this.queryHistory.length - 1 - cursor];
        this.setCurrentQuery(Text.of(historyItem.query.split("\n")));
        this.queryParamsEditor.restoreParamsData(historyItem.paramsData?.data);
      }
    }
  }

  @modelAction
  addHistoryCell({
    query,
    paramsData,
    timestamp,
    duration,
    ...data
  }: {
    query: string;
    paramsData: ParamsData | null;
    timestamp: number;
    duration: number | QueryDuration;
  } & (
    | {
        result: EdgeDBSet | null;
        outCodecBuf: Buffer;
        resultBuf: Buffer;
        status: string;
      }
    | {
        error: ErrorDetails;
      }
  )) {
    const historyCellData: ModelCreationData<ReplHistoryCell> = {
      query,
      paramsData: paramsData ? frozen(paramsData) : null,
      timestamp,
      duration,
    };

    let historyCell: ReplHistoryCell;

    if ("error" in data) {
      historyCell = new ReplErrorCell({
        ...historyCellData,
        error: frozen(data.error),
        expanded: true,
      });
    } else {
      historyCell = new ReplResultCell({
        ...historyCellData,
        inspectorState: data.result ? new InspectorState({}) : null,
        expanded: true,
        status: data.status,
      });
      if (data.result) {
        (historyCell as ReplResultCell).setResult(data.result);
        // storeReplResult(historyCell.$modelId, {
        //   replId: this.$modelId,
        //   outCodecBuf: data.outCodecBuf,
        //   resultBuf: data.resultBuf,
        // });
      }
    }

    this.queryHistory.push(historyCell);
  }

  @modelFlow
  _runStatement = _async(function* (
    this: Repl,
    query: string,
    paramsData: ParamsData | null
  ) {
    const conn = connCtx.get(this)!;

    const timestamp = Date.now();
    try {
      const {result, duration, outCodecBuf, resultBuf, capabilities, status} =
        yield* _await(
          conn.query(
            query,
            paramsData ? serialiseParamsData(paramsData) : undefined,
            false
          )
        );

      this.addHistoryCell({
        query,
        paramsData,
        timestamp,
        duration,
        result,
        outCodecBuf,
        resultBuf,
        status,
      });
      return {success: true, capabilities, status};
    } catch (e: any) {
      this.addHistoryCell({
        query,
        paramsData,
        timestamp,
        duration: Date.now() - timestamp,
        error: extractErrorDetails(e, query),
      });
    }
    return {success: false};
  });

  @modelFlow
  runQuery = _async(function* (this: Repl) {
    if (this.queryRunning || !this.canRunQuery) {
      return;
    }

    const query = this.currentQuery.toString().trim();
    if (!query) return;

    this.queryRunning = true;

    const paramsData = this.queryParamsEditor.getParamsData();

    const dbState = dbCtx.get(this)!;
    dbState.setLoadingTab(Repl, true);

    let allCapabilities = 0;
    const statuses = new Set<string>();

    const {success, capabilities, status} = yield* _await(
      this._runStatement(query, paramsData)
    );
    if (status) {
      statuses.add(status.toLowerCase());
      allCapabilities |= capabilities;
    }

    if (success && !this.persistQuery) {
      this.currentQuery = Text.empty;
      this.queryParamsEditor.clear();
      this.historyCursor = -1;
    }

    this.refreshCaches(allCapabilities, statuses);

    this.queryRunning = false;
    dbState.setLoadingTab(Repl, false);
  });

  refreshCaches(capabilities: number, statuses: Set<string>) {
    if (capabilities & Capabilities.DDL) {
      if (statuses.has("create database") || statuses.has("drop database")) {
        instanceCtx.get(this)!.fetchInstanceInfo();
      } else {
        const dbState = dbCtx.get(this)!;
        dbState.fetchSchemaData();
      }
    }
  }
}
