import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {observer} from "mobx-react-lite";
import {Text} from "@codemirror/state";

import cn from "@edgedb/common/utils/classNames";

import {CodeEditor, CodeEditorRef} from "@edgedb/code-editor";
import {RunButton} from "@edgedb/common/ui/mobile";

import styles from "./repl.module.scss";

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

import {Button} from "@edgedb/common/newui";

import {HistoryPanel} from "./history";
import ParamEditorPanel from "./paramEditor";
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

export const QueryEditorView = observer(function QueryEditorView() {
  const editorState = useTabState(QueryEditor);
  const splitViewState = editorState.splitView;

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
      <div className={styles.sidebar}>
        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            <div
              className={cn(styles.tab, {
                [styles.selected]:
                  editorState.selectedEditor === EditorKind.EdgeQL,
              })}
              onClick={() => editorState.setSelectedEditor(EditorKind.EdgeQL)}
            >
              <span>Editor</span>
              <EditorTabIcon />
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
              <span>Builder</span>
              <BuilderTabIcon />
            </div>
          </div>

          <div
            className={cn(styles.tab, styles.historyButton, {
              [styles.disabled]: editorState.queryHistory.length === 0,
            })}
            onClick={() => editorState.setShowHistory(true)}
          >
            <span>History</span>
          </div>
        </div>
        <HistoryPanel />
      </div>
      <SplitView
        className={styles.main}
        views={[
          <div className={styles.editorBlock}>
            {editorState.selectedEditor === EditorKind.EdgeQL ? (
              <>
                <div className={styles.editorBlockInner}>
                  <QueryCodeEditor />
                  <div className={styles.replEditorOverlays}>
                    <div className={styles.controls}>
                      {!editorState.queryRunning ? (
                        <Button
                          kind="primary"
                          className={styles.runBtn}
                          shortcut={{default: "Ctrl+Enter", macos: "⌘+Enter"}}
                          disabled={!editorState.canRunQuery}
                          onClick={() => editorState.runQuery()}
                        >
                          Run
                        </Button>
                      ) : (
                        <Button
                          kind="primary"
                          className={styles.runBtn}
                          shortcut="Ctrl+C"
                          loading={true}
                          onClick={() =>
                            editorState.runningQueryAbort?.abort()
                          }
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <ParamEditorPanel />
              </>
            ) : (
              <VisualQuerybuilder
                state={editorState.currentQueryData[EditorKind.VisualBuilder]}
              />
            )}
          </div>,
          editorState.currentResult ? (
            <QueryResult
              key={editorState.currentResult.$modelId}
              state={editorState}
              result={editorState.currentResult}
            />
          ) : (
            <></>
          ),
        ]}
        state={editorState.splitView}
        minViewSize={20}
      />
      <div className={styles.mobileOverlayControls}>
        <button
          className={styles.mobileBtn}
          onClick={() => editorState.setShowHistory(true)}
        >
          <MobileHistoryIcon className={styles.mobileHistoryIcon} />
        </button>

        <LabelsSwitch
          labels={["query", "result"]}
          value={
            splitViewState.activeViewIndex
              ? switchState.right
              : switchState.left
          }
          onChange={() =>
            splitViewState.setActiveViewIndex(
              splitViewState.activeViewIndex ? 0 : 1
            )
          }
        />
        <RunButton
          onClick={() => editorState.runQuery()}
          isLoading={editorState.queryRunning}
          onCancel={() => editorState.runningQueryAbort?.abort()}
          disabled={
            (!editorState.canRunQuery && !editorState.queryRunning) ||
            !!splitViewState.activeViewIndex
          }
        />
      </div>
      {editorState.showHistory && (
        <div className={styles.mobileHistory}>
          <p className={styles.title}>History</p>
          <HistoryPanel className={styles.historyPanel} />
        </div>
      )}
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
      {/* {editorState.showExplain &&
      (editorState.currentResult as QueryHistoryResultItem).explainState ? (
        <TestExplainVis
          closeExplain={() => editorState.setShowExplain(false)}
          explainOutput={
            (editorState.currentResult as QueryHistoryResultItem).explainState!
              .rawData
          }
        />
      ) : null} */}
    </div>
  );
});

const QueryCodeEditor = observer(function QueryCodeEditor() {
  const dbState = useDatabaseState();
  const editorState = useTabState(QueryEditor);
  const [ref, setRef] = useState<CodeEditorRef | null>(null);

  const [_, theme] = useTheme();

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
    (value: Text) => editorState.setEdgeQL(value),
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
          code={editorState.currentQueryData[EditorKind.EdgeQL]}
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
}: {
  state: QueryEditor;
  result: QueryHistoryItem;
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

  let content: JSX.Element | null = null;

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

        content = (
          <>
            <div
              className={cn(styles.resultHeader, {
                [styles.noBorder]: mode === OutputMode.Tree,
              })}
            >
              {toggleEl}
            </div>
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

  return <div className={styles.queryResult}>{content}</div>;
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
      <div className={styles.outputModeToggle}>
        <div
          className={cn(styles.label, {
            [styles.selected]: mode === OutputMode.Tree,
          })}
          onClick={() => setOutputMode(OutputMode.Tree)}
        >
          Tree
        </div>
        <div
          className={cn(styles.toggle, {
            [styles.rightSelected]: mode === OutputMode.Grid,
            [styles.disabled]: !tableOutputAvailable,
          })}
          onClick={() =>
            setOutputMode(
              outputMode === OutputMode.Grid
                ? OutputMode.Tree
                : OutputMode.Grid
            )
          }
        />
        <div
          className={cn(styles.label, {
            [styles.selected]: mode === OutputMode.Grid,
            [styles.disabled]: !tableOutputAvailable,
          })}
          onClick={() => setOutputMode(OutputMode.Grid)}
        >
          Table
        </div>
      </div>
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
