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

import {EdgeDBSet, baseOptions, decode} from "../../../utils/decodeRawBuffer";
import {
  ErrorDetails,
  extractErrorDetails,
} from "../../../utils/extractErrorDetails";

import {dbCtx} from "../../../state";
import {connCtx} from "../../../state/connection";
import {instanceCtx} from "../../../state/instance";

import {
  SplitViewDirection,
  SplitViewState,
} from "@edgedb/common/ui/splitView/model";
import {
  paramsQueryCtx,
  QueryParamsEditor,
  SerializedParamsData,
} from "./parameters";
import {getThumbnailData, ThumbnailData} from "./thumbnailGen";
import {QueryBuilderState} from "../../../components/visualQuerybuilder/state";
import {ObservableLRU} from "../../../state/utils/lru";
import {extendedViewerIds} from "../../../components/extendedViewers";
import {sessionStateCtx} from "../../../state/sessionState";
import {
  createExplainState,
  ExplainState,
} from "../../../components/explainVis/state";
import {Language, ProtocolVersion} from "edgedb/dist/ifaces";
import {
  createResultGridState,
  ResultGridState,
} from "@edgedb/common/components/resultGrid";
import LRU from "edgedb/dist/primitives/lru";

export enum EditorKind {
  EdgeQL,
  VisualBuilder,
  SQL,
}

export enum OutputMode {
  Tree,
  Grid,
}

type HistoryItemQueryData =
  | {
      kind: EditorKind.EdgeQL | EditorKind.SQL;
      query: string;
      params: SerializedParamsData | null;
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

const resultInspectorCache = new LRU<string, InspectorState>({capacity: 10});
const resultGridStateCache = new LRU<string, ResultGridState>({capacity: 10});
export const explainStateCache = new ObservableLRU<string, ExplainState>(10);

@model("QueryEditor/HistoryResultItem")
export class QueryHistoryResultItem extends ExtendedModel(QueryHistoryItem, {
  status: prop<string>(),
  hasResult: prop<boolean>(),
  implicitLimit: prop<number>(),
}) {
  get queryEditor() {
    return queryEditorCtx.get(this)!;
  }

  getInspectorState(data: EdgeDBSet) {
    const queryEditor = this.queryEditor;

    let state = resultInspectorCache.get(this.$modelId);
    if (!state) {
      state = createInspector(data, this.implicitLimit, (item) =>
        queryEditor.setExtendedViewerItem(item)
      );
      resultInspectorCache.set(this.$modelId, state);
    }

    return state;
  }

  getResultGridState(data: EdgeDBSet) {
    let state = resultGridStateCache.get(this.$modelId);
    if (!state) {
      state = createResultGridState(data._codec, data);
      resultGridStateCache.set(this.$modelId, state);
    }

    return state;
  }

  getExplainState(data: EdgeDBSet) {
    let state = explainStateCache.get(this.$modelId);
    if (!state) {
      state = createExplainState(data[0]);
      explainStateCache.set(this.$modelId, state);
    }

    return state;
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
  [EditorKind.SQL]: Text;
  [EditorKind.VisualBuilder]: QueryBuilderState;
};

export const queryEditorCtx = createMobxContext<QueryEditor>();

@model("QueryEditor")
export class QueryEditor extends Model({
  _edgeqlParamsEditor: prop(
    () => new QueryParamsEditor({lang: Language.EDGEQL})
  ),
  _sqlParamsEditor: prop(() => new QueryParamsEditor({lang: Language.SQL})),

  selectedEditor: prop<EditorKind>(EditorKind.EdgeQL),

  showHistory: prop(false),
  queryHistory: prop<QueryHistoryItem[]>(() => [null as any]),

  showExplain: prop(false).withSetter(),
}) {
  @observable runningQueryAbort: AbortController | null = null;

  @computed get queryRunning() {
    return this.runningQueryAbort != null;
  }

  @computed
  get sqlModeSupported(): boolean {
    const serverVersion = instanceCtx.get(this)!.serverVersion;
    return !serverVersion || serverVersion.major >= 6;
  }

  @modelAction
  setSelectedEditor(kind: EditorKind) {
    if (kind === EditorKind.SQL && !this.sqlModeSupported) {
      return;
    }
    this.selectedEditor = kind;
  }

  @observable.shallow
  currentQueryData: QueryData = {
    [EditorKind.EdgeQL]: Text.empty,
    [EditorKind.SQL]: Text.empty,
    [EditorKind.VisualBuilder]: new QueryBuilderState({}),
  };

  @observable
  queryIsEdited: {[key in EditorKind]: boolean} = {
    [EditorKind.EdgeQL]: false,
    [EditorKind.SQL]: false,
    [EditorKind.VisualBuilder]: false,
  };

  @computed
  get currentQueryEdited() {
    return this.queryIsEdited[this.selectedEditor];
  }

  _splitViews: {[key in EditorKind]: SplitViewState} = {
    [EditorKind.EdgeQL]: new SplitViewState({}),
    [EditorKind.SQL]: new SplitViewState({
      direction: SplitViewDirection.vertical,
    }),
    [EditorKind.VisualBuilder]: new SplitViewState({}),
  };

  @computed
  get splitView() {
    return this._splitViews[this.selectedEditor];
  }

  @computed
  get paramsEditor() {
    return this.selectedEditor === EditorKind.EdgeQL
      ? this._edgeqlParamsEditor
      : this.selectedEditor === EditorKind.SQL
      ? this._sqlParamsEditor
      : null;
  }

  @observable.shallow
  currentResults: {
    [key in EditorKind]: QueryHistoryItem | null;
  } = {
    [EditorKind.EdgeQL]: null,
    [EditorKind.SQL]: null,
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

  @observable
  _outputMode: {[key in EditorKind]: OutputMode} = {
    [EditorKind.EdgeQL]: OutputMode.Tree,
    [EditorKind.SQL]: OutputMode.Grid,
    [EditorKind.VisualBuilder]: OutputMode.Tree,
  };

  @computed
  get outputMode() {
    return this._outputMode[this.selectedEditor];
  }

  @action
  setOutputMode(mode: OutputMode) {
    this._outputMode[this.selectedEditor] = mode;
  }

  @action
  setQueryText(data: Text) {
    if (this.selectedEditor === EditorKind.VisualBuilder) return;
    this.currentQueryData[this.selectedEditor] = data;
    this.queryIsEdited[this.selectedEditor] = true;
    this.historyCursor = -1;
  }

  @action
  setEdgeQLString(query: string) {
    this.currentQueryData[EditorKind.EdgeQL] = Text.of(query.split("\n"));
  }

  @computed
  get currentQueryText() {
    if (this.selectedEditor === EditorKind.VisualBuilder) return null;
    return this.currentQueryData[this.selectedEditor];
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
      !this.showHistory &&
      (this.selectedEditor === EditorKind.EdgeQL ||
      this.selectedEditor === EditorKind.SQL
        ? !this.paramsEditor!.hasErrors &&
          !!this.currentQueryText?.toString().trim()
        : this.currentQueryData[EditorKind.VisualBuilder].canRunQuery)
    );
  }

  onInit() {
    queryEditorCtx.set(this, this);

    paramsQueryCtx.setComputed(
      this._edgeqlParamsEditor,
      () => this.currentQueryData[EditorKind.EdgeQL]
    );
    paramsQueryCtx.setComputed(
      this._sqlParamsEditor,
      () => this.currentQueryData[EditorKind.SQL]
    );
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

  resultDataCache = new LRU<string, Promise<EdgeDBSet | null>>({capacity: 20});

  @observable.ref
  extendedViewerItem: Item | null = null;

  @action
  setExtendedViewerItem(item: Item | null) {
    this.extendedViewerItem = item;
  }

  async getResultData(itemId: string): Promise<EdgeDBSet | null> {
    let data = this.resultDataCache.get(itemId);
    if (!data) {
      data = fetchResultData(itemId).then((resultData) =>
        resultData
          ? decode(
              resultData.outCodecBuf,
              resultData.resultBuf,
              baseOptions,
              resultData.protoVer ?? [1, 0]
            )
          : null
      );
      this.resultDataCache.set(itemId, data);
    }
    return data;
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
      params: Frozen<SerializedParamsData | null>;
      isEdited: boolean;
      result: QueryHistoryItem | null;
    };
    [EditorKind.SQL]: {
      query: Text;
      params: Frozen<SerializedParamsData | null>;
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
        params: frozen(this._edgeqlParamsEditor.serializeParamsData()),
        isEdited: this.queryIsEdited[EditorKind.EdgeQL],
        result: this.currentResults[EditorKind.EdgeQL],
      },
      [EditorKind.SQL]: {
        query: current[EditorKind.SQL],
        params: frozen(this._sqlParamsEditor.serializeParamsData()),
        isEdited: this.queryIsEdited[EditorKind.SQL],
        result: this.currentResults[EditorKind.SQL],
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
        [EditorKind.SQL]: draft[EditorKind.SQL].query,
        [EditorKind.VisualBuilder]: draft[EditorKind.VisualBuilder].state,
      };

      this._edgeqlParamsEditor.restoreParamsData(
        draft[EditorKind.EdgeQL].params?.data
      );
      this._sqlParamsEditor.restoreParamsData(
        draft[EditorKind.SQL].params?.data
      );

      this.setSelectedEditor(draft.selectedEditor);
      this.currentResults = {
        [EditorKind.EdgeQL]: draft[EditorKind.EdgeQL].result,
        [EditorKind.SQL]: draft[EditorKind.SQL].result,
        [EditorKind.VisualBuilder]: draft[EditorKind.VisualBuilder].result,
      };
      this.queryIsEdited = {
        [EditorKind.EdgeQL]: draft[EditorKind.EdgeQL].isEdited,
        [EditorKind.SQL]: draft[EditorKind.SQL].isEdited,
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

    if (item._explainState) {
      explainStateCache.set(item.$modelId, item._explainState);
    }

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
        case EditorKind.SQL:
          this.currentQueryData[queryData.data.kind] = Text.of(
            queryData.data.query.split("\n")
          );
          (queryData.data.kind === EditorKind.SQL
            ? this._sqlParamsEditor
            : this._edgeqlParamsEditor
          ).restoreParamsData(queryData.data.params);
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
        [EditorKind.SQL]: false,
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
        protoVer: ProtocolVersion;
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
        this.resultDataCache.set(
          historyItem.$modelId,
          Promise.resolve(data.result)
        );
        resultData = {
          outCodecBuf: data.outCodecBuf,
          resultBuf: data.resultBuf,
          protoVer: data.protoVer,
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
      kind === EditorKind.EdgeQL || kind === EditorKind.SQL
        ? draftQuery[kind].query.toString().trim()
        : kind === EditorKind.VisualBuilder
        ? draftQuery[EditorKind.VisualBuilder].state.query
        : null;

    switch (kind) {
      case EditorKind.EdgeQL:
      case EditorKind.SQL: {
        const paramsData = draftQuery[kind].params;

        if (!query && !paramsData) return;

        queryData = {
          kind: kind,
          query: query!,
          params: paramsData?.data ?? null,
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
      this.selectedEditor === EditorKind.EdgeQL ||
      this.selectedEditor === EditorKind.SQL
        ? {
            kind: this.selectedEditor,
            query,
            params: this.paramsEditor!.serializeParamsData(),
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
      const {result, outCodecBuf, resultBuf, protoVer, capabilities, status} =
        yield* _await(
          conn.query(
            query,
            this.selectedEditor === EditorKind.EdgeQL ||
              this.selectedEditor === EditorKind.SQL
              ? this.paramsEditor!.getQueryArgs()
              : undefined,
            {
              implicitLimit:
                implicitLimit != null ? implicitLimit + BigInt(1) : undefined,
              replQueryTag: true,
            },
            this.runningQueryAbort?.signal,
            this.selectedEditor === EditorKind.SQL
              ? Language.SQL
              : Language.EDGEQL
          )
        );

      this.addHistoryCell({
        queryData,
        timestamp,
        thumbnailData,
        result,
        outCodecBuf,
        resultBuf,
        protoVer,
        status,
        implicitLimit: Number(implicitLimit),
      });
      return {success: true, capabilities, status};
    } catch (e: any) {
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
      selectedEditor === EditorKind.EdgeQL || selectedEditor === EditorKind.SQL
        ? this.currentQueryText?.toString().trim()
        : selectedEditor === EditorKind.VisualBuilder
        ? this.currentQueryData[EditorKind.VisualBuilder].query
        : null;
    if (!query) return;

    this.runningQueryAbort = new AbortController();

    const dbState = dbCtx.get(this)!;
    dbState.setLoadingTab(QueryEditor, true);

    const {capabilities, status} = yield* _await(this._runStatement(query));
    this.queryIsEdited[selectedEditor] = false;

    dbState.refreshCaches(capabilities ?? 0, status ? [status] : []);

    this.runningQueryAbort = null;
    dbState.setLoadingTab(QueryEditor, false);
    this.splitView.setActiveViewIndex(1);
  });
}
