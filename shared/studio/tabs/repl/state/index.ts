import {action, observable} from "mobx";
import {
  Frozen,
  frozen,
  idProp,
  model,
  Model,
  modelAction,
  modelFlow,
  prop,
  _async,
  _await,
  createContext as createMobxContext,
  getSnapshot,
  fromSnapshot,
} from "mobx-keystone";
import {Text} from "@codemirror/state";
import {connCtx, dbCtx} from "../../../state";
import {
  ErrorDetails,
  extractErrorDetails,
} from "../../../utils/extractErrorDetails";
import {InspectorState} from "@edgedb/inspector/state";
import {ObservableLRU} from "../../../state/utils/lru";
import {decode, EdgeDBSet} from "../../../utils/decodeRawBuffer";
import {CommandResult, handleSlashCommand} from "./commands";
import {NavigateFunction} from "react-router";
import {RefObject} from "react";
import {VariableSizeList as List} from "react-window";
import {
  fetchReplHistory,
  fetchResultData,
  QueryResultData,
  storeReplHistoryItem,
} from "../../../idbStore";
import {instanceCtx} from "../../../state/instance";

function createInspector(result: EdgeDBSet) {
  const inspector = new InspectorState({});
  inspector.initData({data: result, codec: result._codec});
  return inspector;
}

@model("Repl/HistoryItem")
export class ReplHistoryItem extends Model({
  $modelId: idProp,
  query: prop<string>(),
  timestamp: prop<number>(),
  status: prop<string | null>(null),
  hasResult: prop<boolean | null>(null),
  error: prop<Frozen<ErrorDetails> | null>(null),
  commandResult: prop<Frozen<CommandResult> | null>(null),
}) {
  renderHeight: number | null = null;

  @modelAction
  setResult(status: string, hasResult: boolean) {
    this.hasResult = hasResult;
    this.status = status;
  }

  @modelAction
  setError(error: ErrorDetails) {
    this.error = frozen(error);
  }

  @modelAction
  setCommandResult(result: CommandResult) {
    this.commandResult = frozen(result);
  }

  get inspectorState() {
    const cache = inspectorCacheCtx.get(this)!;
    const state = cache.get(this.$modelId);
    if (!state) {
      fetchResultData(this.$modelId).then((resultData) => {
        if (resultData) {
          const inspector = createInspector(
            decode(resultData.outCodecBuf, resultData.resultBuf)!
          );
          cache.set(this.$modelId, inspector);
        }
      });
    }
    return state ?? null;
  }
}

export interface ReplSettings {
  retroMode: boolean;
}

const inspectorCacheCtx =
  createMobxContext<ObservableLRU<string, InspectorState>>();

@model("Repl")
export class Repl extends Model({
  queryHistory: prop<ReplHistoryItem[]>(() => [null as any]),
}) {
  onInit() {
    inspectorCacheCtx.set(this, this.resultInspectorCache);
  }

  navigation: NavigateFunction | null = null;

  @observable
  currentQuery = Text.empty;

  @action
  setCurrentQuery(query: Text) {
    this.currentQuery = query;
    this.historyCursor = -1;
  }

  initialScrollPos = 0;

  historyCursor = -1;
  draftQuery = Text.empty;

  navigateHistory(direction: 1 | -1) {
    let cursor =
      (this.historyCursor === -1
        ? this.queryHistory.length
        : this.historyCursor) + direction;

    if (cursor === this.queryHistory.length) {
      this.currentQuery = this.draftQuery;
      this.historyCursor = -1;
    } else {
      const historyItem = this.queryHistory[cursor];
      if (historyItem) {
        if (this.historyCursor === -1) {
          this.draftQuery = this.currentQuery;
        }
        this.currentQuery = Text.of(historyItem.query.split("\n"));
        this.historyCursor = cursor;
      }
    }
  }

  listRef: RefObject<List> | null = null;

  scrollToEnd() {
    const ref = (this.listRef?.current as any)._outerRef;
    ref.scrollTop = ref.scrollHeight;
  }

  resultInspectorCache = new ObservableLRU<string, InspectorState>(20);

  _fetchingHistory = false;

  @modelFlow
  fetchReplHistory = _async(function* (this: Repl) {
    if (this._fetchingHistory || this.queryHistory[0] !== null) {
      return;
    }
    this._fetchingHistory = true;
    const history = yield* _await(
      fetchReplHistory(
        instanceCtx.get(this)!.instanceName!,
        dbCtx.get(this)!.name,
        this.queryHistory[1]?.timestamp ?? Date.now(),
        50
      )
    );
    const finished = history.length < 50;
    this.queryHistory.splice(
      finished ? 0 : 1,
      finished ? 1 : 0,
      ...history.reverse().map((item) => fromSnapshot(item.data))
    );
    this._fetchingHistory = false;
  });

  @observable
  settings: ReplSettings = {
    retroMode: false,
  };

  @action
  updateSetting<T extends keyof ReplSettings>(key: T, value: ReplSettings[T]) {
    this.settings[key] = value;
  }

  @observable
  queryRunning = false;

  @modelFlow
  runQuery = _async(function* (this: Repl, queryStr?: string) {
    const conn = connCtx.get(this)!;

    const query = queryStr ?? this.currentQuery.toString().trim();

    if (!query) {
      return;
    }

    const historyItem = new ReplHistoryItem({
      query,
      timestamp: Date.now(),
    });
    this.queryHistory.push(historyItem);
    if (queryStr !== null) {
      this.currentQuery = Text.empty;
    }

    this.queryRunning = true;

    let resultData: QueryResultData | undefined = undefined;
    try {
      if (query.startsWith("\\") && !query.includes("\n")) {
        yield* _await(handleSlashCommand(query, this, historyItem));
      } else {
        const {result, outCodecBuf, resultBuf, capabilities, status} =
          yield* _await(conn.query(query, undefined, false));

        historyItem.setResult(status, !!result);
        if (result) {
          this.resultInspectorCache.set(
            historyItem.$modelId,
            createInspector(result)
          );

          resultData = {
            outCodecBuf,
            resultBuf,
          };
        }
      }
    } catch (err: any) {
      historyItem.setError(extractErrorDetails(err, query));
    }

    storeReplHistoryItem(
      historyItem.$modelId,
      {
        instanceId: instanceCtx.get(this)!.instanceName!,
        dbName: dbCtx.get(this)!.name,
        timestamp: historyItem.timestamp,
        data: getSnapshot(historyItem),
      },
      resultData
    );

    this.queryRunning = false;

    // const listRef = (this.listRef?.current as any)?._outerRef;
    // if (listRef) {
    //   setTimeout(() => (listRef.scrollTop = listRef.scrollHeight), 0);
    // }
  });
}
