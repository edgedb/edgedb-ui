import {action, computed, observable} from "mobx";
import {
  model,
  Model,
  ExtendedModel,
  prop,
  modelAction,
  rootRef,
  Ref,
  modelFlow,
  _async,
  _await,
  findParent,
  ModelCreationData,
  getRefsResolvingTo,
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

import {QueryDuration} from "../../../state/connection";

import {EdgeDBSet, decode} from "../../../utils/decodeRawBuffer";
import {
  ErrorDetails,
  extractErrorDetails,
} from "../../../utils/extractErrorDetails";
import {renderResultAsJson} from "../../../utils/renderJsonResult";

import {splitQuery, Statement} from "./splitQuery";

import {dbCtx} from "../../../state";
import {connCtx} from "../../../state/connection";
import {SplitViewState} from "@edgedb/common/ui/splitView/model";
import {
  filterParamsData,
  ParamsData,
  ReplQueryParamsEditor,
} from "./parameters";

@model("Repl/HistoryCell")
export class ReplHistoryCell extends Model({
  $modelId: idProp,
  query: prop<string>(),
  timestamp: prop<number>(),
  duration: prop<number | QueryDuration>(),
  renderHeight: prop<number>(64).withSetter(),
}) {
  edit() {
    const repl = findParent<Repl>(this, (parent) => parent instanceof Repl)!;
    repl.setCurrentQuery(Text.of(this.query.split("\n")));

    repl.queryParamsEditor.restoreParamsData(
      this.scriptBlock?.paramsData?.data
    );
  }

  copyToClipboard() {
    navigator.clipboard?.writeText(this.query);
  }

  @computed
  get scriptBlock() {
    const ref = getRefsResolvingTo(this, scriptBlockCellRef).values().next()
      .value as Ref<ReplHistoryCell> | undefined;
    return (
      ref &&
      findParent<ReplHistoryScriptBlock>(
        ref,
        (parent) => parent instanceof ReplHistoryScriptBlock
      )
    );
  }

  @computed
  get isFirstInScriptBlock() {
    if (this.scriptBlock) {
      return this.scriptBlock.cells[0]?.current === this;
    }
    return false;
  }

  @computed
  get isLastInScriptBlock() {
    if (this.scriptBlock) {
      const cells = this.scriptBlock.cells;
      return cells[cells.length - 1].current === this;
    }
    return false;
  }
}

@model("Repl/ExpandableCell")
export class ReplExpandableCell extends ExtendedModel(ReplHistoryCell, {
  expanded: prop(false),
}) {
  @modelAction
  toggleExpanded() {
    this.expanded = !this.expanded;
  }
}

@model("Repl/ResultCell")
export class ReplResultCell extends ExtendedModel(ReplExpandableCell, {
  inspectorState: prop<InspectorState>(),
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
export class ReplErrorCell extends ExtendedModel(ReplExpandableCell, {
  error: prop<Frozen<ErrorDetails>>(),
}) {}

const scriptBlockCellRef = rootRef<ReplHistoryCell>("Repl/ScriptBlockCellRef");

@model("Repl/HistoryScriptBlock")
export class ReplHistoryScriptBlock extends Model({
  query: prop<string>(),
  paramsData: prop<Frozen<ParamsData> | null>(null),
  cells: prop<Ref<ReplHistoryCell>[]>(() => []),
}) {
  edit() {
    const repl = findParent<Repl>(this, (parent) => parent instanceof Repl)!;
    repl.setCurrentQuery(Text.of(this.query.split("\n")));
    repl.queryParamsEditor.restoreParamsData(this.paramsData?.data);
  }

  copyToClipboard() {
    navigator.clipboard?.writeText(this.query);
  }
}

@model("Repl")
export class Repl extends Model({
  // currentQuery: prop("").withSetter(),
  queryParamsEditor: prop(() => new ReplQueryParamsEditor({})),

  queryHistory: prop<ReplHistoryCell[]>(() => []),
  scriptBlocks: prop<ReplHistoryScriptBlock[]>(() => []),

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
    return !this.queryRunning && !!this.currentQuery.toString().trim();
  }

  onAttachedToRootStore() {
    return () => {
      // removeReplResults(this.$modelId);
    };
  }

  @modelAction
  addHistoryCell({
    statement,
    timestamp,
    duration,
    scriptBlock,
    ...data
  }: {
    statement: Statement;
    timestamp: number;
    duration: number | QueryDuration;
    scriptBlock: ReplHistoryScriptBlock | null;
  } & (
    | {
        result: EdgeDBSet | null;
        outCodecBuf: Buffer;
        resultBuf: Buffer;
      }
    | {
        error: ErrorDetails;
      }
  )) {
    const historyCellData: ModelCreationData<ReplHistoryCell> = {
      query: statement.displayExpression,
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
        inspectorState: new InspectorState({}),
        expanded: !!data.result,
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
    if (scriptBlock) {
      scriptBlock.cells.push(scriptBlockCellRef(historyCell));
    }
  }

  @modelFlow
  _runStatement = _async(function* (
    this: Repl,
    statement: Statement,
    scriptBlock: ReplHistoryScriptBlock | null = null
  ) {
    const conn = connCtx.get(this)!;

    const paramsData = scriptBlock?.paramsData?.data;

    const timestamp = Date.now();
    try {
      const {result, duration, outCodecBuf, resultBuf, capabilities, status} =
        yield* _await(
          conn.query(
            statement.expression,
            paramsData && filterParamsData(paramsData, statement.params)
          )
        );

      this.addHistoryCell({
        statement,
        timestamp,
        duration,
        result,
        outCodecBuf,
        resultBuf,
        scriptBlock,
      });
      return true;
    } catch (e: any) {
      this.addHistoryCell({
        statement,
        timestamp,
        duration: Date.now() - timestamp,
        error: extractErrorDetails(e, statement.expression),
        scriptBlock,
      });
    }
    return false;
  });

  @modelFlow
  runQuery = _async(function* (this: Repl) {
    if (this.queryRunning) {
      return;
    }

    const query = this.currentQuery.toString().trim();
    if (!query) return;

    this.queryRunning = true;
    let error = false;

    const paramsData = this.queryParamsEditor.getParamsData();

    const statements = splitQuery(query, paramsData);

    let scriptBlock: ReplHistoryScriptBlock | null = null;
    if (statements.length > 1 || paramsData !== null) {
      scriptBlock = new ReplHistoryScriptBlock({
        query,
        paramsData: paramsData ? frozen(paramsData) : null,
      });
      this.scriptBlocks.push(scriptBlock);
    }

    const dbState = dbCtx.get(this)!;
    dbState.setLoadingTab(Repl, true);
    for (const statement of statements) {
      const success = yield* _await(
        this._runStatement(statement, scriptBlock)
      );
      if (!success) {
        error = true;
        break;
      }
    }
    if (!error && !this.persistQuery) {
      this.currentQuery = Text.empty;
      this.queryParamsEditor.clear();
    }

    this.queryRunning = false;
    dbState.setLoadingTab(Repl, false);
  });
}
