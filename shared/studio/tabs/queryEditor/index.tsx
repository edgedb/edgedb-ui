import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {observer} from "mobx-react-lite";
import {Text} from "@codemirror/state";
import {sql, PostgreSQL} from "@codemirror/lang-sql";

import cn from "@edgedb/common/utils/classNames";

import {CodeEditorRef, createCodeEditor} from "@edgedb/code-editor";
import {RunButton} from "@edgedb/common/ui/mobile";

import styles from "./queryeditor.module.scss";

import {useDatabaseState, useTabState} from "../../state";
import {
  QueryEditor,
  QueryHistoryResultItem,
  QueryHistoryErrorItem,
  EditorKind,
  QueryHistoryItem,
  OutputMode,
  explainStateCache,
} from "./state";

import {DatabaseTabSpec} from "../../components/databasePage";

import {Theme, useTheme} from "@edgedb/common/hooks/useTheme";

import SplitView from "@edgedb/common/ui/splitView";
import {CustomScrollbars} from "@edgedb/common/ui/customScrollbar";

import {
  Button,
  HistoryIcon,
  IconToggle,
  RunIcon,
  SplitViewIcon,
  TableViewIcon,
  TreeViewIcon,
} from "@edgedb/common/newui";

import {HistoryPanel} from "./history";
import {ParamsEditorPanel} from "./paramEditor";
import {TabEditorIcon, MobileHistoryIcon} from "../../icons";
import {useResize} from "@edgedb/common/hooks/useResize";
import {VisualQuerybuilder} from "../../components/visualQuerybuilder";
import Inspector from "@edgedb/inspector";
import {ResultGrid} from "@edgedb/common/components/resultGrid";
import {
  ExtendedViewerContext,
  ExtendedViewerRenderer,
} from "../../components/extendedViewers";
import {InspectorState} from "@edgedb/inspector/state";
import inspectorStyles from "@edgedb/inspector/inspector.module.scss";
import Spinner from "@edgedb/common/ui/spinner";
import {ExplainVis} from "../../components/explainVis";
import {CodeEditorExplainContexts} from "../../components/explainVis/codeEditorContexts";
import {ExplainStateType} from "../../components/explainVis/state";
import {LabelsSwitch, switchState} from "@edgedb/common/ui/switch";
import {useIsMobile} from "@edgedb/common/hooks/useMobile";
import {EdgeDBSet} from "@edgedb/common/decodeRawBuffer";
import {ObjectCodec} from "edgedb/dist/codecs/object";
import {ICodec} from "edgedb/dist/codecs/ifaces";
import {SplitViewDirection} from "@edgedb/common/ui/splitView/model";
import {createPortal} from "react-dom";
import {RelativeTime} from "@edgedb/common/utils/relativeTime";

export const QueryEditorView = observer(function QueryEditorView() {
  const editorState = useTabState(QueryEditor);

  const outputModeTargetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        (e.key === "h" && (e.ctrlKey || e.metaKey)) ||
        (e.key === "Escape" && editorState.showHistory)
      ) {
        if (e.key === "h") {
          e.preventDefault();
        }
        editorState.setShowHistory(!editorState.showHistory);
      }
      if (e.key === "Escape" && editorState.extendedViewerItem) {
        editorState.setExtendedViewerItem(null);
      }
      if (e.key === "c" && e.ctrlKey && editorState.queryRunning) {
        editorState.runningQueryAbort?.abort();
      }
    };

    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [editorState.showHistory]);

  return (
    <div
      className={cn(styles.wrapper, {
        [styles.showExtendedResult]: editorState.extendedViewerItem !== null,
        [styles.showHistory]: editorState.showHistory,
      })}
    >
      <div className={styles.historyPanelWrapper}>
        <HistoryPanel className={styles.historyPanel} />
      </div>

      <div className={styles.mainPanel}>
        <div className={styles.header}>
          <div
            className={cn(styles.historyButton, {
              [styles.disabled]: editorState.queryHistory.length === 0,
            })}
            onClick={() => editorState.setShowHistory(true)}
          >
            <HistoryIcon />
          </div>

          <div className={styles.tabs}>
            <div
              className={cn(styles.tab, {
                [styles.selected]:
                  editorState.selectedEditor === EditorKind.EdgeQL,
              })}
              onClick={() => editorState.setSelectedEditor(EditorKind.EdgeQL)}
            >
              <span>EdgeQL</span>
              {/* <EditorTabIcon /> */}
            </div>
            <div
              className={cn(styles.tab, {
                [styles.selected]:
                  editorState.selectedEditor === EditorKind.VisualBuilder,
              })}
              onClick={() =>
                editorState.setSelectedEditor(EditorKind.VisualBuilder)
              }
            >
              <span>EdgeQL Builder</span>
              {/* <BuilderTabIcon /> */}
            </div>
            <div
              className={cn(styles.tab, {
                [styles.selected]:
                  editorState.selectedEditor === EditorKind.SQL,
              })}
              onClick={() => editorState.setSelectedEditor(EditorKind.SQL)}
            >
              <span>SQL</span>
            </div>
          </div>

          <div className={styles.controls}>
            <div ref={outputModeTargetRef} style={{display: "contents"}} />

            <IconToggle
              options={[
                {
                  key: SplitViewDirection.horizontal,
                  icon: <SplitViewIcon style={{transform: "rotate(90deg)"}} />,
                  label: "Split vertical",
                },
                {
                  key: SplitViewDirection.vertical,
                  icon: <SplitViewIcon />,
                  label: "Split horizontal",
                },
              ]}
              selectedOption={editorState.splitView.direction}
              onSelectOption={(direction) =>
                editorState.splitView.setDirection(direction)
              }
            />

            {!editorState.queryRunning ? (
              <Button
                kind="primary"
                className={styles.runBtn}
                shortcut={{
                  default: "Ctrl+Enter",
                  macos: "⌘+Enter",
                }}
                leftIcon={<RunIcon />}
                disabled={!editorState.canRunQuery}
                onClick={() => editorState.runQuery()}
              >
                Run
              </Button>
            ) : (
              <Button
                className={styles.cancelBtn}
                shortcut="Ctrl+C"
                leftIcon={<Spinner size={16} strokeWidth={1.5} />}
                onClick={() => editorState.runningQueryAbort?.abort()}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>

        <SplitView
          state={editorState.splitView}
          minViewSize={20}
          views={[
            <div
              className={cn(styles.editorBlock, {
                [styles.horizontalSplit]:
                  editorState.splitView.direction ===
                  SplitViewDirection.vertical,
              })}
            >
              {editorState.selectedEditor === EditorKind.EdgeQL ||
              editorState.selectedEditor === EditorKind.SQL ? (
                <>
                  <div className={styles.editorBlockInner}>
                    <QueryCodeEditor key={editorState.selectedEditor} />
                  </div>
                  <ParamsEditorPanel
                    state={editorState.paramsEditor!}
                    runQuery={() => editorState.runQuery()}
                    horizontalSplit={
                      editorState.splitView.direction ===
                      SplitViewDirection.vertical
                    }
                  />
                </>
              ) : (
                <VisualQuerybuilder
                  state={
                    editorState.currentQueryData[EditorKind.VisualBuilder]
                  }
                />
              )}
            </div>,
            <QueryResult
              key={editorState.currentResult?.$modelId}
              state={editorState}
              result={editorState.currentResult}
              outputModeTargetRef={outputModeTargetRef}
            />,
          ]}
        />
      </div>

      {editorState.extendedViewerItem ? (
        <div className={styles.extendedViewerContainer}>
          <ExtendedViewerContext.Provider
            value={{
              closeExtendedView: () => editorState.setExtendedViewerItem(null),
            }}
          >
            <ExtendedViewerRenderer item={editorState.extendedViewerItem} />
          </ExtendedViewerContext.Provider>
        </div>
      ) : null}
    </div>
  );
});

const QueryCodeEditor = observer(function QueryCodeEditor() {
  const dbState = useDatabaseState();
  const editorState = useTabState(QueryEditor);
  const [ref, setRef] = useState<CodeEditorRef | null>(null);

  const [_, theme] = useTheme();

  const CodeEditor = useMemo(() => {
    return createCodeEditor({
      language:
        editorState.selectedEditor === EditorKind.SQL
          ? sql({
              dialect: PostgreSQL,
            })
          : undefined,
    });
  }, [editorState.selectedEditor]);

  useEffect(() => {
    if (!editorState.showHistory) {
      ref?.focus();
    }
  }, [ref, editorState.showHistory]);

  const keybindings = useMemo(
    () => [
      {
        key: "Mod-Enter",
        run: () => {
          editorState.runQuery();
          return true;
        },
        preventDefault: true,
      },
    ],
    [editorState]
  );

  const onChange = useCallback(
    (value: Text) => editorState.setQueryText(value),
    [editorState]
  );

  const codeEditorRef = useCallback((ref: any) => {
    setRef(ref);
  }, []);

  const explainState =
    editorState.currentResult instanceof QueryHistoryResultItem &&
    (editorState.currentResult.status === ExplainStateType.explain ||
      editorState.currentResult.status === ExplainStateType.analyzeQuery)
      ? explainStateCache.get(editorState.currentResult.$modelId)
      : null;

  return (
    <>
      <CustomScrollbars
        className={styles.scrollWrapper}
        scrollClass="cm-scroller"
        innerClass="cm-content"
      >
        <CodeEditor
          ref={codeEditorRef}
          code={editorState.currentQueryText!}
          onChange={onChange}
          keybindings={keybindings}
          useDarkTheme={theme === Theme.dark}
          readonly={editorState.showHistory}
          schemaObjects={dbState.schemaData?.objectsByName}
          errorUnderline={
            editorState.showEditorResultDecorations &&
            editorState.currentResult instanceof QueryHistoryErrorItem
              ? editorState.currentResult.error.data.range
              : undefined
          }
          explainContexts={
            editorState.showEditorResultDecorations && explainState
              ? {
                  contexts: explainState.contextsByBufIdx,
                  buffers: explainState.buffers.data,
                }
              : undefined
          }
        />
      </CustomScrollbars>
      {ref && editorState.showEditorResultDecorations && explainState ? (
        <CodeEditorExplainContexts editorRef={ref} state={explainState} />
      ) : null}
    </>
  );
});

const ResultInspector = observer(function ResultInspector({
  state,
}: {
  state: InspectorState;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [height, setHeight] = useState(0);
  useResize(ref, ({height}) => setHeight(height));

  const [innerClass, setInnerClass] = useState<Element | null>(null);

  useEffect(() => {
    setInnerClass(
      ref.current!.querySelector(`.${inspectorStyles.innerWrapper}`)
    );
  }, [height]);

  return (
    <div ref={ref} style={{height: "100%", minWidth: 0, width: "100%"}}>
      <CustomScrollbars innerClass={innerClass}>
        <Inspector
          className={styles.inspector}
          state={state}
          height={height}
          bottomPadding={isMobile ? 60 : undefined}
        />
      </CustomScrollbars>
    </div>
  );
});

const QueryResult = observer(function QueryResult({
  state,
  result,
  outputModeTargetRef,
}: {
  state: QueryEditor;
  result: QueryHistoryItem | null;
  outputModeTargetRef: RefObject<HTMLDivElement>;
}) {
  const [data, setData] = useState<EdgeDBSet | null>(null);

  useEffect(() => {
    if (
      !data &&
      result instanceof QueryHistoryResultItem &&
      result.hasResult
    ) {
      state.getResultData(result.$modelId).then((data) => setData(data));
    }
  }, [data]);

  if (!result) {
    return null;
  }

  let content: JSX.Element | null = null;
  let headerContent = state.currentQueryEdited ? (
    <div className={styles.resultOutdatedNote}>Result outdated</div>
  ) : (
    <div
      className={styles.resultTimestampNote}
      title={new Date(result.timestamp).toLocaleString()}
    >
      <RelativeTime timestamp={result.timestamp} fullNames />
    </div>
  );

  if (result instanceof QueryHistoryResultItem) {
    if (result.hasResult) {
      if (data === null) {
        content = (
          <div className={styles.inspectorLoading}>
            <Spinner size={24} />
          </div>
        );
      } else if (
        result.status === "EXPLAIN" ||
        result.status === "ANALYZE QUERY"
      ) {
        content = <ExplainVis state={result.getExplainState(data)} />;
      } else {
        const {mode, toggleEl} = outputModeToggle(
          data._codec,
          state.outputMode,
          state.setOutputMode.bind(state)
        );

        headerContent = (
          <>
            {headerContent}
            {toggleEl}
          </>
        );

        content = (
          <>
            {mode === OutputMode.Grid ? (
              <ResultGrid state={result.getResultGridState(data)} />
            ) : (
              <ResultInspector state={result.getInspectorState(data)} />
            )}
          </>
        );
      }
    } else {
      content = (
        <div className={styles.queryStatus}>
          {result.status && "OK: "}
          {result.status}
        </div>
      );
    }
  } else if (result instanceof QueryHistoryErrorItem) {
    content = (
      <div className={styles.queryError}>
        <span className={styles.errorName}>{result.error.data.name}</span>:{" "}
        {result.error.data.msg}
        {result.error.data.details ? (
          <div className={styles.errorHint}>
            Details: {result.error.data.details}
          </div>
        ) : null}
        {result.error.data.hint ? (
          <div className={styles.errorHint}>
            Hint: {result.error.data.hint}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.queryResult}>
      {outputModeTargetRef.current
        ? createPortal(headerContent, outputModeTargetRef.current)
        : null}
      {content}
    </div>
  );
});

export function outputModeToggle(
  codec: ICodec,
  outputMode: OutputMode,
  setOutputMode: (mode: OutputMode) => void
) {
  const tableOutputAvailable = codec instanceof ObjectCodec;
  const mode = tableOutputAvailable ? outputMode : OutputMode.Tree;

  return {
    mode,
    toggleEl: (
      <IconToggle
        options={[
          {
            key: OutputMode.Tree,
            icon: <TreeViewIcon />,
            label: "Tree",
          },
          {
            key: OutputMode.Grid,
            icon: <TableViewIcon />,
            label: "Table",
            disabled: !tableOutputAvailable,
          },
        ]}
        selectedOption={mode}
        onSelectOption={setOutputMode}
      />
    ),
  };
}

export const editorTabSpec: DatabaseTabSpec = {
  path: "editor",
  label: "Editor",
  icon: (active) => <TabEditorIcon active={active} />,
  usesSessionState: true,
  state: QueryEditor,
  element: <QueryEditorView />,
};

function EditorTabIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1 0C0.447715 0 0 0.447715 0 1V15C0 15.5523 0.447715 16 1 16H15C15.5523 16 16 15.5523 16 15V1C16 0.447715 15.5523 0 15 0H1ZM12.7071 4.70711C13.0976 4.31658 13.0976 3.68342 12.7071 3.29289C12.3166 2.90237 11.6834 2.90237 11.2929 3.29289L5.29289 9.29289C4.90237 9.68342 4.90237 10.3166 5.29289 10.7071C5.68342 11.0976 6.31658 11.0976 6.70711 10.7071L12.7071 4.70711ZM4 13C4.55228 13 5 12.5523 5 12C5 11.4477 4.55228 11 4 11C3.44772 11 3 11.4477 3 12C3 12.5523 3.44772 13 4 13Z"
      />
    </svg>
  );
}

function BuilderTabIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1 0C0.447715 0 0 0.447715 0 1V15C0 15.5523 0.447715 16 1 16H15C15.5523 16 16 15.5523 16 15V1C16 0.447715 15.5523 0 15 0H1ZM3 4C3 3.44772 3.44772 3 4 3H9C9.55228 3 10 3.44772 10 4C10 4.55228 9.55228 5 9 5H4C3.44772 5 3 4.55228 3 4ZM3 8C3 7.44772 3.44772 7 4 7H12C12.5523 7 13 7.44772 13 8C13 8.55229 12.5523 9 12 9H4C3.44772 9 3 8.55229 3 8ZM4 11C3.44772 11 3 11.4477 3 12C3 12.5523 3.44772 13 4 13H10C10.5523 13 11 12.5523 11 12C11 11.4477 10.5523 11 10 11H4Z"
      />
    </svg>
  );
}
