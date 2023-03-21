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
  getParent,
  findParent,
} from "mobx-keystone";
import {Text} from "@codemirror/state";
import {connCtx, dbCtx} from "../../../state";
import {
  ErrorDetails,
  extractErrorDetails,
} from "../../../utils/extractErrorDetails";
import {InspectorState, Item} from "@edgedb/inspector/state";
import {ObservableLRU} from "../../../state/utils/lru";
import {decode, EdgeDBSet} from "../../../utils/decodeRawBuffer";
import {CommandResult, handleSlashCommand} from "./commands";
import {
  fetchReplHistory,
  fetchResultData,
  QueryResultData,
  storeReplHistoryItem,
} from "../../../idbStore";
import {instanceCtx} from "../../../state/instance";
import {extendedViewerIds} from "../../../components/extendedViewers";

import "./itemHeights";
import {ItemHeights} from "./itemHeights";
import {sessionStateCtx} from "../../../state/sessionState";
import {
  createExplainState,
  ExplainState,
  ExplainStateType,
} from "../../../components/explainVis/state";
import {NavigateFunction} from "../../../hooks/dbRoute";

export const defaultItemHeight = 85;

function createInspector(
  result: EdgeDBSet,
  implicitLimit: number | null,
  openExtendedView: (item: Item) => void
) {
  const inspector = new InspectorState({implicitLimit, noMultiline: true});
  inspector.extendedViewIds = extendedViewerIds;
  inspector.openExtendedView = openExtendedView;
  inspector.initData({data: result, codec: result._codec});
  return inspector;
}

@model("Repl/HistoryItem")
export class ReplHistoryItem extends Model({
  $modelId: idProp,
  query: prop<string>(),
  timestamp: prop<number>(),
  implicitLimit: prop<number | null>(null),
  status: prop<string | null>(null),
  hasResult: prop<boolean | null>(null),
  error: prop<Frozen<ErrorDetails> | null>(null),
  commandResult: prop<Frozen<CommandResult> | null>(null),
}) {
  renderHeight: number | null = null;
  showDateHeader: boolean = false;

  @observable
  showMore = false;

  @action
  setShowMore(val: boolean) {
    this.showMore = val;
  }

  @observable
  showFullQuery = false;

  @action
  setShowFullQuery(val: boolean) {
    this.showFullQuery = val;
  }

  @modelAction
  setResult(status: string, hasResult: boolean, implicitLimit: number) {
    this.hasResult = hasResult;
    this.status = status;
    this.implicitLimit = implicitLimit;
  }

  @modelAction
  setError(error: ErrorDetails) {
    this.error = frozen(error);
  }

  @modelAction
  setCommandResult(result: CommandResult) {
    this.commandResult = frozen(result);
  }

  _inspector: InspectorState | null = null;

  get inspectorState() {
    if (!this.hasResult) {
      return null;
    }
    if (this._inspector) {
      return this._inspector;
    }
    const cache = inspectorCacheCtx.get(this)!;
    const state = cache.get(this.$modelId);
    if (!state) {
      fetchResultData(this.$modelId).then((resultData) => {
        if (resultData) {
          const inspector = createInspector(
            decode(resultData.outCodecBuf, resultData.resultBuf)!,
            this.implicitLimit,
            (item) =>
              findParent<Repl>(
                this,
                (p) => p instanceof Repl
              )!.setExtendedViewerItem(item)
          );
          cache.set(this.$modelId, inspector);
        }
      });
    } else {
      this._inspector = state;
    }
    return state ?? null;
  }

  _explain: ExplainState | null = null;

  get explainState() {
    if (!this.hasResult) {
      return null;
    }

    if (this._explain) {
      return this._explain;
    }

    const explainCache = replExplainCacheCtx.get(this)!;
    const state = explainCache.get(this.$modelId);

    if (!state) {
      fetchResultData(this.$modelId).then((resultData) => {
        if (resultData) {
          const explainState = createExplainState(
            decode(resultData.outCodecBuf, resultData.resultBuf)![0]
          );
          explainCache.set(this.$modelId, explainState);
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

const replExplainCacheCtx =
  createMobxContext<ObservableLRU<string, ExplainState>>();

@model("Repl")
export class Repl extends Model({
  queryHistory: prop<ReplHistoryItem[]>(() => []),
}) {
  onInit() {
    inspectorCacheCtx.set(this, this.resultInspectorCache);
    replExplainCacheCtx.set(this, this.resultExplainCache);
  }

  navigation: NavigateFunction | null = null;

  itemHeights = new ItemHeights();

  scrollRef: HTMLDivElement | null = null;

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

  @action
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

  @observable.ref
  extendedViewerItem: Item | null = null;

  @action
  setExtendedViewerItem(item: Item | null) {
    this.extendedViewerItem = item;
  }

  resultInspectorCache = new ObservableLRU<string, InspectorState>(20);
  resultExplainCache = new ObservableLRU<string, ExplainState>(20);

  @observable
  _hasUnfetchedHistory = true;

  @observable
  _fetchingHistory = false;

  @modelFlow
  fetchReplHistory = _async(function* (this: Repl) {
    if (this._fetchingHistory || !this._hasUnfetchedHistory) {
      return;
    }
    this._fetchingHistory = true;
    const history = yield* _await(
      fetchReplHistory(
        instanceCtx.get(this)!.instanceName!,
        dbCtx.get(this)!.name,
        this.queryHistory[0]?.timestamp ?? Date.now(),
        50
      )
    );
    this._hasUnfetchedHistory = history.length === 50;

    let lastDate: [number, number, number] | null = null;

    const historyItems: ReplHistoryItem[] = Array(history.length);
    for (let i = history.length - 1; i >= 0; i--) {
      const item = fromSnapshot<ReplHistoryItem>(history[i].data);
      const date = new Date(item.timestamp);
      if (
        !lastDate ||
        lastDate[0] !== date.getDate() ||
        lastDate[1] !== date.getMonth() ||
        lastDate[2] !== date.getFullYear()
      ) {
        item.showDateHeader = true;
        lastDate = [date.getDate(), date.getMonth(), date.getFullYear()];
      }
      historyItems[history.length - 1 - i] = item;
    }
    if (this.queryHistory[0]) {
      const date = new Date(this.queryHistory[0].timestamp);
      if (
        lastDate &&
        lastDate[0] === date.getDate() &&
        lastDate[1] === date.getMonth() &&
        lastDate[2] === date.getFullYear()
      ) {
        this.queryHistory[0].showDateHeader = false;
      }
    }

    this.queryHistory.unshift(...historyItems);
    this.itemHeights.addHistoryItems(
      Array(history.length).fill(defaultItemHeight)
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
    const dbState = dbCtx.get(this)!;
    const conn = connCtx.get(this)!;

    const query = queryStr ?? this.currentQuery.toString().trim();

    if (!query) {
      return;
    }

    const historyItem = new ReplHistoryItem({
      query,
      timestamp: Date.now(),
    });

    if (this.queryHistory.length) {
      const prevDate = new Date(
        this.queryHistory[this.queryHistory.length - 1].timestamp
      );
      const currDate = new Date(historyItem.timestamp);
      historyItem.showDateHeader =
        prevDate.getDate() !== currDate.getDate() ||
        prevDate.getMonth() !== currDate.getMonth() ||
        prevDate.getFullYear() !== currDate.getFullYear();
    }

    this.queryHistory.push(historyItem);
    this.itemHeights.addItem(defaultItemHeight);
    if (queryStr !== null) {
      this.currentQuery = Text.empty;
    }

    this.queryRunning = true;
    this.historyCursor = -1;

    dbState.setLoadingTab(Repl, true);

    let resultData: QueryResultData | undefined = undefined;
    try {
      if (query.startsWith("\\") && !query.includes("\n")) {
        yield* _await(handleSlashCommand(query, this, historyItem));
      } else {
        const implicitLimit = sessionStateCtx
          .get(this)!
          .activeState.options.find(
            (opt) => opt.name === "Implicit Limit"
          )?.value;

        const {result, outCodecBuf, resultBuf, capabilities, status} =
          yield* _await(
            conn.query(query, undefined, {
              implicitLimit:
                implicitLimit != null ? implicitLimit + BigInt(1) : undefined,
            })
          );

        dbState.refreshCaches(capabilities, status ? [status] : []);

        historyItem.setResult(status, !!result, Number(implicitLimit));
        if (result) {
          if (
            status === ExplainStateType.explain ||
            status === ExplainStateType.analyzeQuery
          ) {
            this.resultExplainCache.set(
              historyItem.$modelId,
              createExplainState(result[0])
            );
          } else {
            this.resultInspectorCache.set(
              historyItem.$modelId,
              createInspector(result, Number(implicitLimit), (item) =>
                this.setExtendedViewerItem(item)
              )
            );
          }

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

    dbState.setLoadingTab(Repl, false);
    this.queryRunning = false;
  });
}
