import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {observer} from "mobx-react";
import {Text} from "@codemirror/state";

import cn from "@edgedb/common/utils/classNames";

import {CodeEditor, CodeEditorRef} from "@edgedb/code-editor";

import styles from "./repl.module.scss";

import {useDatabaseState, useTabState} from "../../state";
import {
  QueryEditor,
  QueryHistoryResultItem,
  QueryHistoryErrorItem,
  EditorKind,
} from "./state";

import {DatabaseTabSpec} from "../../components/databasePage";

import {Theme, useTheme} from "@edgedb/common/hooks/useTheme";

import SplitView from "@edgedb/common/ui/splitView";
import Button from "@edgedb/common/ui/button";
import {CustomScrollbars} from "@edgedb/common/ui/customScrollbar";

import {HistoryPanel} from "./history";
import ParamEditorPanel from "./paramEditor";
import {
  KebabMenuIcon,
  TabEditorIcon,
  MobileHistoryIcon,
  MobileRunIcon,
} from "../../icons";
import {useResize} from "@edgedb/common/hooks/useResize";
import {VisualQuerybuilder} from "../../components/visualQuerybuilder";
import Inspector from "@edgedb/inspector";
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

export const QueryEditorView = observer(function QueryEditorView() {
  const editorState = useTabState(QueryEditor);
  const splitViewState = editorState.splitView;

  const [_, theme] = useTheme();

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
                      <Button
                        className={styles.runBtn}
                        label="Run"
                        shortcut="Ctrl+Enter"
                        macShortcut="⌘+Enter"
                        disabled={!editorState.canRunQuery}
                        loading={editorState.queryRunning}
                        onClick={() => editorState.runQuery()}
                      />
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
          <QueryResult />,
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
        <button
          className={styles.mobileBtn}
          onClick={() => editorState.runQuery()}
          disabled={
            !editorState.canRunQuery || !!splitViewState.activeViewIndex
          }
        >
          <MobileRunIcon className={styles.mobileRunIcon} />
        </button>
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
      ? editorState.currentResult.explainState
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
  const [height, setHeight] = useState(0);
  useResize(ref, ({height}) => setHeight(height));

  return (
    <div ref={ref} style={{height: "100%", minWidth: 0, width: "100%"}}>
      <CustomScrollbars innerClass={inspectorStyles.innerWrapper}>
        <Inspector
          className={styles.inspector}
          state={state}
          height={height}
        />
      </CustomScrollbars>
    </div>
  );
});

const QueryResult = observer(function QueryResult() {
  const editorState = useTabState(QueryEditor);

  const result = editorState.currentResult;

  let content: JSX.Element | null = null;

  if (result instanceof QueryHistoryResultItem) {
    if (result.hasResult) {
      if (result.status === "EXPLAIN" || result.status === "ANALYZE QUERY") {
        content = <ExplainVis state={result.explainState} />;
      } else if (result.inspectorState) {
        content = (
          <ResultInspector
            key={result.$modelId}
            state={result.inspectorState}
          />
        );
      } else {
        content = (
          <div className={styles.inspectorLoading}>
            <Spinner size={24} />
          </div>
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

export const editorTabSpec: DatabaseTabSpec = {
  path: "editor",
  label: "Query Editor",
  icon: (active) => <TabEditorIcon active={active} />,
  usesSessionState: true,
  state: QueryEditor,
  element: <QueryEditorView />,
};

const QueryOptions = observer(function QueryOptions() {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const innerWidth = useRef(0);

  useResize(
    ref,
    (rect) => {
      if (ref.current) {
        if (!collapsed) {
          innerWidth.current = ref.current!.children[0].clientWidth;
        }
        const overflow = rect.width < innerWidth.current;
        if (collapsed !== overflow) {
          setCollapsed(overflow);
          setMenuOpen(false);
        }
      }
    },
    [collapsed]
  );

  useEffect(() => {
    if (menuOpen) {
      const listener = (e: MouseEvent) => {
        if (!menuRef.current?.contains(e.target as Node)) {
          setMenuOpen(false);
        }
      };
      window.addEventListener("click", listener, {capture: true});

      return () => {
        window.removeEventListener("click", listener, {capture: true});
      };
    }
  }, [menuOpen]);

  return (
    <div
      ref={ref}
      className={cn(styles.queryOptions, {
        [styles.collapsed]: collapsed,
      })}
    >
      <div
        ref={menuRef}
        className={cn(styles.queryOptionsWrapper, {
          [styles.menuOpen]: menuOpen,
        })}
      ></div>
      {collapsed ? (
        <div
          className={styles.overflowMenu}
          onClick={() => {
            setMenuOpen(!menuOpen);
          }}
        >
          <KebabMenuIcon />
        </div>
      ) : null}
    </div>
  );
});

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
