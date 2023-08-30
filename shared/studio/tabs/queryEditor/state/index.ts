import {ReplHistoryItem} from "../../repl/state";
import {action, computed, observable, reaction} from "mobx";
import {
  model,
  Model,
  ExtendedModel,
  prop,
  modelAction,
  modelFlow,
  _async,
  _await,
  ModelCreationData,
  Frozen,
  frozen,
  idProp,
  getSnapshot,
  createContext as createMobxContext,
  fromSnapshot,
  SnapshotOutOf,
} from "mobx-keystone";

import {Text} from "@codemirror/state";

import {InspectorState, Item} from "@edgedb/inspector/state";

import {
  storeQueryHistoryItem,
  fetchQueryHistory,
  fetchResultData,
  QueryResultData,
} from "../../../idbStore";

import {EdgeDBSet, decode} from "../../../utils/decodeRawBuffer";
import {
  ErrorDetails,
  extractErrorDetails,
} from "../../../utils/extractErrorDetails";

import {dbCtx, useTabState} from "../../../state";
import {connCtx} from "../../../state/connection";
import {instanceCtx} from "../../../state/instance";

import {SplitViewState} from "@edgedb/common/ui/splitView/model";
import {QueryParamsEditor, SerializedParamsData} from "./parameters";
import {getThumbnailData, ThumbnailData} from "./thumbnailGen";
import {QueryBuilderState} from "../../../components/visualQuerybuilder/state";
import {ObservableLRU} from "../../../state/utils/lru";
import {extendedViewerIds} from "../../../components/extendedViewers";
import {sessionStateCtx} from "../../../state/sessionState";
import {
  createExplainState,
  ExplainState,
  ExplainStateType,
} from "../../../components/explainVis/state";

export enum EditorKind {
  EdgeQL,
  VisualBuilder,
}

type HistoryItemQueryData =
  | {
      kind: EditorKind.EdgeQL;
      query: string;
      params: Frozen<SerializedParamsData> | null;
    }
  | {
      kind: EditorKind.VisualBuilder;
      state: SnapshotOutOf<QueryBuilderState>;
    };

export abstract class QueryHistoryItem extends Model({
  $modelId: idProp,
  queryData: prop<Frozen<HistoryItemQueryData>>(),
  timestamp: prop<number>(),
  thumbnailData: prop<Frozen<ThumbnailData>>(),
}) {
  showDateHeader = false;
}

@model("QueryEditor/HistoryDraftItem")
export class QueryHistoryDraftItem extends ExtendedModel(
  QueryHistoryItem,
  {}
) {}

const explainStateCache = new ObservableLRU<string, ExplainState>(10);

@model("QueryEditor/HistoryResultItem")
export class QueryHistoryResultItem extends ExtendedModel(QueryHistoryItem, {
  status: prop<string>(),
  hasResult: prop<boolean>(),
  implicitLimit: prop<number>(),
}) {
  get inspectorState() {
    const queryEditor = queryEditorCtx.get(this)!;
    const state = queryEditor.resultInspectorCache.get(this.$modelId);
    if (!state) {
      queryEditor.fetchResultData(this.$modelId, this.implicitLimit);
    }
    return state ?? null;
  }

  get explainState() {
    const state = explainStateCache.get(this.$modelId);

    if (!state) {
      fetchResultData(this.$modelId).then((resultData) => {
        if (resultData) {
          const explainState = createExplainState(
            decode(resultData.outCodecBuf, resultData.resultBuf)![0]
          );
          explainStateCache.set(this.$modelId, explainState);
        }
      });
    }
    return state ?? null;
  }
}

@model("QueryEditor/HistoryErrorItem")
export class QueryHistoryErrorItem extends ExtendedModel(QueryHistoryItem, {
  error: prop<Frozen<ErrorDetails>>(),
}) {}

function createInspector(
  result: EdgeDBSet,
  implicitLimit: number,
  openExtendedView: (item: Item) => void
) {
  const inspector = new InspectorState({implicitLimit, noMultiline: true});
  inspector.extendedViewIds = extendedViewerIds;
  inspector.openExtendedView = openExtendedView;
  inspector.initData({data: result, codec: result._codec});
  return inspector;
}

type QueryData = {
  [EditorKind.EdgeQL]: Text;
  [EditorKind.VisualBuilder]: QueryBuilderState;
};

export const queryEditorCtx = createMobxContext<QueryEditor>();

@model("QueryEditor")
export class QueryEditor extends Model({
  queryParamsEditor: prop(() => new QueryParamsEditor({})),

  splitView: prop(() => new SplitViewState({})),

  selectedEditor: prop<EditorKind>(EditorKind.EdgeQL).withSetter(),

  showHistory: prop(false),
  queryHistory: prop<QueryHistoryItem[]>(() => [null as any]),

  showExplain: prop(false).withSetter(),

  showQueryWindow: prop(true).withSetter(),
}) {
  @observable queryRunning = false;

  @observable.shallow
  currentQueryData: QueryData = {
    [EditorKind.EdgeQL]: Text.empty,
    [EditorKind.VisualBuilder]: new QueryBuilderState({}),
  };

  @observable
  queryIsEdited: {[key in EditorKind]: boolean} = {
    [EditorKind.EdgeQL]: false,
    [EditorKind.VisualBuilder]: false,
  };

  @observable.shallow
  currentResults: {
    [key in EditorKind]: QueryHistoryItem | null;
  } = {
    [EditorKind.EdgeQL]: null,
    [EditorKind.VisualBuilder]: null,
  };

  @computed
  get currentResult() {
    return this.currentResults[this.selectedEditor];
  }

  @computed
  get showEditorResultDecorations() {
    return !this.queryIsEdited[EditorKind.EdgeQL];
  }

  @action
  setEdgeQL(data: Text) {
    this.currentQueryData[EditorKind.EdgeQL] = data;
    this.queryIsEdited[EditorKind.EdgeQL] = true;
    this.historyCursor = -1;
  }

  onAttachedToRootStore() {
    const disposer = reaction(
      () => getSnapshot(this.currentQueryData[EditorKind.VisualBuilder]),
      () => {
        if (!this.showHistory) {
          this.queryIsEdited[EditorKind.VisualBuilder] = true;
        }
      }
    );

    return () => {
      disposer();
    };
  }

  @computed
  get canRunQuery() {
    return (
      !this.queryRunning &&
      (this.selectedEditor === EditorKind.EdgeQL
        ? !this.queryParamsEditor.hasErrors &&
          !!this.currentQueryData[EditorKind.EdgeQL].toString().trim()
        : this.currentQueryData[EditorKind.VisualBuilder].canRunQuery)
    );
  }

  onInit() {
    queryEditorCtx.set(this, this);
  }

  _fetchingHistory = false;

  @modelFlow
  fetchQueryHistory = _async(function* (this: QueryEditor) {
    if (this._fetchingHistory) {
      return;
    }
    this._fetchingHistory = true;
    const history = yield* _await(
      fetchQueryHistory(
        instanceCtx.get(this)!.instanceId!,
        dbCtx.get(this)!.name,
        this.queryHistory[this.queryHistory.length - 2]?.timestamp ??
          Date.now(),
        50
      )
    );

    let lastDate: [number, number, number] | null = null;
    if (this.queryHistory[this.queryHistory.length - 2]) {
      const date = new Date(
        this.queryHistory[this.queryHistory.length - 2].timestamp
      );
      lastDate = [date.getDate(), date.getMonth(), date.getFullYear()];
    }
    const items = new Array(history.length);
    for (let i = 0; i < history.length; i++) {
      const item = fromSnapshot<QueryHistoryItem>(history[i].data);
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

      items[i] = item;
    }

    this.queryHistory.splice(
      this.queryHistory.length - 1,
      history.length < 50 ? 1 : 0,
      ...items
    );
    this._fetchingHistory = false;
  });

  resultInspectorCache = new ObservableLRU<string, InspectorState>(20);

  @observable.ref
  extendedViewerItem: Item | null = null;

  @action
  setExtendedViewerItem(item: Item | null) {
    this.extendedViewerItem = item;
  }

  async fetchResultData(itemId: string, implicitLimit: number) {
    const resultData = await fetchResultData(itemId);
    if (resultData) {
      const inspector = createInspector(
        decode(resultData.outCodecBuf, resultData.resultBuf)!,
        implicitLimit,
        (item) => this.setExtendedViewerItem(item)
      );
      this.resultInspectorCache.set(itemId, inspector);
    }
  }

  @modelAction
  setShowHistory(show: boolean, restoreDraft = true) {
    this.showHistory = show;
    if (show) {
      this._saveDraftQueryData();
    } else {
      this.historyCursor = -1;

      if (restoreDraft) {
        this._restoreDraftQueryData();
      }
    }
  }

  @observable
  historyCursor = -1;

  draftQueryData: {
    selectedEditor: EditorKind;
    [EditorKind.EdgeQL]: {
      query: Text;
      params: Frozen<SerializedParamsData> | null;
      isEdited: boolean;
      result: QueryHistoryItem | null;
    };
    [EditorKind.VisualBuilder]: {
      state: QueryBuilderState;
      isEdited: boolean;
      result: QueryHistoryItem | null;
    };
  } | null = null;

  @action
  _saveDraftQueryData() {
    const current = this.currentQueryData;
    this.draftQueryData = {
      selectedEditor: this.selectedEditor,
      [EditorKind.EdgeQL]: {
        query: current[EditorKind.EdgeQL],
        params: this.queryParamsEditor.serializeParamsData(),
        isEdited: this.queryIsEdited[EditorKind.EdgeQL],
        result: this.currentResults[EditorKind.EdgeQL],
      },
      [EditorKind.VisualBuilder]: {
        state: current[EditorKind.VisualBuilder],
        isEdited: this.queryIsEdited[EditorKind.VisualBuilder],
        result: this.currentResults[EditorKind.VisualBuilder],
      },
    };
  }

  @action
  _restoreDraftQueryData() {
    this.historyCursor = -1;
    const draft = this.draftQueryData;
    if (draft) {
      this.currentQueryData = {
        [EditorKind.EdgeQL]: draft[EditorKind.EdgeQL].query,
        [EditorKind.VisualBuilder]: draft[EditorKind.VisualBuilder].state,
      };

      this.queryParamsEditor.restoreParamsData(
        draft[EditorKind.EdgeQL].params
      );

      this.setSelectedEditor(draft.selectedEditor);
      this.currentResults = {
        [EditorKind.EdgeQL]: draft[EditorKind.EdgeQL].result,
        [EditorKind.VisualBuilder]: draft[EditorKind.VisualBuilder].result,
      };
      this.queryIsEdited = {
        [EditorKind.EdgeQL]: draft[EditorKind.EdgeQL].isEdited,
        [EditorKind.VisualBuilder]: draft[EditorKind.VisualBuilder].isEdited,
      };
    }
  }

  @action
  loadFromRepl(item: ReplHistoryItem) {
    this.currentQueryData[EditorKind.EdgeQL] = Text.of(item.query.split("\n"));

    const historyItemData: ModelCreationData<QueryHistoryItem> = {
      $modelId: item.$modelId,
      timestamp: item.timestamp,
      thumbnailData: frozen(getThumbnailData({query: item.query})),
      queryData: frozen({
        query: item.query,
        params: null,
        kind: 0,
      }),
    };

    if (item.explainState)
      explainStateCache.set(item.$modelId, item.explainState);

    const historyItem = new QueryHistoryResultItem({
      ...historyItemData,
      hasResult: true,
      status: item.status!,
      implicitLimit: item.implicitLimit!,
    });

    this.currentResults[EditorKind.EdgeQL] = historyItem;

    this.queryIsEdited = {
      ...this.queryIsEdited,
      [EditorKind.EdgeQL]: false,
    };
    this.setSelectedEditor(EditorKind.EdgeQL);
  }

  @action
  previewHistoryItem(cursor: number) {
    if (cursor === this.historyCursor) {
      return;
    }

    if (cursor === -1) {
      this._restoreDraftQueryData();
    } else {
      const historyItem = this.queryHistory[cursor];
      if (historyItem == null) {
        return;
      }

      this.historyCursor = cursor;
      const queryData = historyItem.queryData;

      switch (queryData.data.kind) {
        case EditorKind.EdgeQL:
          this.currentQueryData[EditorKind.EdgeQL] = Text.of(
            queryData.data.query.split("\n")
          );
          this.queryParamsEditor.restoreParamsData(queryData.data.params);
          break;
        case EditorKind.VisualBuilder:
          this.currentQueryData[EditorKind.VisualBuilder] =
            fromSnapshot<QueryBuilderState>(queryData.data.state);
          break;
      }

      this.currentResults[queryData.data.kind] = historyItem;
      this.setSelectedEditor(queryData.data.kind);
      this.queryIsEdited = {
        [EditorKind.EdgeQL]: false,
        [EditorKind.VisualBuilder]: false,
      };
    }
  }

  @action
  loadHistoryItem(cursor: number = this.historyCursor) {
    this.previewHistoryItem(cursor);

    if (cursor !== -1) {
      this.saveDraftQueryToHistory();
    }

    this.setShowHistory(false, false);
  }

  navigateQueryHistory(direction: 1 | -1) {
    if (!this.queryHistory.length) {
      return;
    }

    const cursor = Math.max(
      -1,
      Math.min(this.historyCursor + direction, this.queryHistory.length - 1)
    );

    this.previewHistoryItem(cursor);
  }

  @modelAction
  addHistoryCell({
    queryData,
    timestamp,
    thumbnailData,
    ...data
  }: {
    queryData: HistoryItemQueryData;
    timestamp: number;
    thumbnailData: ThumbnailData;
  } & (
    | {
        result: EdgeDBSet | null;
        outCodecBuf: Uint8Array;
        resultBuf: Uint8Array;
        status: string;
        implicitLimit: number;
      }
    | {
        error: ErrorDetails;
      }
    | {}
  )) {
    const historyItemData: ModelCreationData<QueryHistoryItem> = {
      queryData: frozen(queryData),
      timestamp,
      thumbnailData: frozen(thumbnailData),
    };

    let historyItem: QueryHistoryItem;
    let resultData: QueryResultData | undefined = undefined;

    if ("error" in data) {
      historyItem = new QueryHistoryErrorItem({
        ...historyItemData,
        error: frozen(data.error),
      });
    } else if ("status" in data) {
      historyItem = new QueryHistoryResultItem({
        ...historyItemData,
        hasResult: data.result !== null,
        status: data.status,
        implicitLimit: data.implicitLimit,
      });
      if (data.result) {
        if (
          data.status === ExplainStateType.explain ||
          data.status === ExplainStateType.analyzeQuery
        ) {
          explainStateCache.set(
            historyItem.$modelId,
            createExplainState(data.result[0])
          );
        } else {
          this.resultInspectorCache.set(
            historyItem.$modelId,
            createInspector(data.result, data.implicitLimit, (item) =>
              this.setExtendedViewerItem(item)
            )
          );
        }
        resultData = {
          outCodecBuf: data.outCodecBuf,
          resultBuf: data.resultBuf,
        };
      }
    } else {
      historyItem = new QueryHistoryDraftItem(historyItemData);
    }

    storeQueryHistoryItem(
      historyItem.$modelId,
      {
        instanceId: instanceCtx.get(this)!.instanceId!,
        dbName: dbCtx.get(this)!.name,
        timestamp: timestamp,
        data: getSnapshot(historyItem),
      },
      resultData
    );

    if (this.queryHistory[0]) {
      const lastDate = new Date(this.queryHistory[0].timestamp);
      const date = new Date(timestamp);
      if (
        lastDate.getDate() !== date.getDate() ||
        lastDate.getMonth() !== date.getMonth() ||
        lastDate.getFullYear() !== date.getFullYear()
      ) {
        this.queryHistory[0].showDateHeader = true;
      }
    }

    this.queryHistory.unshift(historyItem);
    this.currentResults[queryData.kind] = historyItem;
  }

  @modelAction
  saveDraftQueryToHistory() {
    const draftQuery = this.draftQueryData;

    if (!draftQuery || !draftQuery[draftQuery.selectedEditor].isEdited) {
      return;
    }

    const kind = draftQuery.selectedEditor;
    let queryData: HistoryItemQueryData;

    const query =
      kind === EditorKind.EdgeQL
        ? draftQuery[EditorKind.EdgeQL].query.toString().trim()
        : kind === EditorKind.VisualBuilder
        ? draftQuery[EditorKind.VisualBuilder].state.query
        : null;

    switch (kind) {
      case EditorKind.EdgeQL: {
        const paramsData = draftQuery[EditorKind.EdgeQL].params;

        if (!query && !paramsData) return;

        queryData = {
          kind: EditorKind.EdgeQL,
          query: query!,
          params: paramsData,
        };
        break;
      }
      case EditorKind.VisualBuilder: {
        queryData = {
          kind: EditorKind.VisualBuilder,
          state: getSnapshot(draftQuery[EditorKind.VisualBuilder].state),
        };
        break;
      }
      default:
        return;
    }

    this.addHistoryCell({
      queryData,
      timestamp: Date.now(),
      thumbnailData: getThumbnailData({query: query!}),
    });
  }

  @modelFlow
  _runStatement = _async(function* (this: QueryEditor, query: string) {
    const conn = connCtx.get(this)!;

    const queryData: HistoryItemQueryData =
      this.selectedEditor === EditorKind.EdgeQL
        ? {
            kind: EditorKind.EdgeQL,
            query,
            params: this.queryParamsEditor.serializeParamsData(),
          }
        : {
            kind: EditorKind.VisualBuilder,
            state: getSnapshot(
              this.currentQueryData[EditorKind.VisualBuilder]
            ),
          };
    const timestamp = Date.now();
    const thumbnailData = getThumbnailData({query});
    const implicitLimit = sessionStateCtx
      .get(this)!
      .activeState.options.find((opt) => opt.name === "Implicit Limit")?.value;

    try {
      const {result, outCodecBuf, resultBuf, capabilities, status} =
        yield* _await(
          conn.query(
            query,
            this.selectedEditor === EditorKind.EdgeQL
              ? this.queryParamsEditor.getQueryArgs()
              : undefined,
            {
              implicitLimit:
                implicitLimit != null ? implicitLimit + BigInt(1) : undefined,
            }
          )
        );

      this.addHistoryCell({
        queryData,
        timestamp,
        thumbnailData,
        result,
        outCodecBuf,
        resultBuf,
        status,
        implicitLimit: Number(implicitLimit),
      });
      return {success: true, capabilities, status};
    } catch (e: any) {
      console.error(e);
      this.addHistoryCell({
        queryData,
        timestamp,
        thumbnailData,
        error: extractErrorDetails(e, query),
      });
    }
    return {success: false};
  });

  @modelFlow
  runQuery = _async(function* (this: QueryEditor) {
    if (!this.canRunQuery) {
      return;
    }

    const selectedEditor = this.selectedEditor;

    const query =
      selectedEditor === EditorKind.EdgeQL
        ? this.currentQueryData[EditorKind.EdgeQL].toString().trim()
        : selectedEditor === EditorKind.VisualBuilder
        ? this.currentQueryData[EditorKind.VisualBuilder].query
        : null;
    if (!query) return;

    this.queryRunning = true;

    const dbState = dbCtx.get(this)!;
    dbState.setLoadingTab(QueryEditor, true);

    const {capabilities, status} = yield* _await(this._runStatement(query));
    this.queryIsEdited[selectedEditor] = false;

    dbState.refreshCaches(capabilities ?? 0, status ? [status] : []);

    this.queryRunning = false;
    dbState.setLoadingTab(QueryEditor, false);
    this.setShowQueryWindow(false);
  });
}
