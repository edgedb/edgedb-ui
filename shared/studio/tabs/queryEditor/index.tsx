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
import {KebabMenuIcon, TabEditorIcon} from "../../icons";
import {useResize} from "@edgedb/common/hooks/useResize";
import {VisualQuerybuilder} from "../../components/visualQuerybuilder";
import Inspector from "@edgedb/inspector";
import {settingsState} from "../../state/settings";
import {
  ExtendedViewerContext,
  ExtendedViewerRenderer,
} from "../../components/extendedViewers";
import {InspectorState} from "@edgedb/inspector/state";
import inspectorStyles from "@edgedb/inspector/inspector.module.scss";
import Spinner from "@edgedb/common/ui/spinner";

export const QueryEditorView = observer(function QueryEditorView() {
  const dbState = useDatabaseState();
  const editorState = useTabState(QueryEditor);

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
                <QueryCodeEditor />
                <div className={styles.replEditorOverlays}>
                  <div className={styles.controls}>
                    {/* <QueryOptions /> */}
                    <Button
                      className={styles.runButton}
                      label="Run"
                      shortcut="Ctrl+Enter"
                      macShortcut="⌘+Enter"
                      disabled={!editorState.canRunQuery}
                      loading={editorState.queryRunning}
                      onClick={() => editorState.runQuery()}
                    />
                  </div>
                  <ParamEditorPanel />
                </div>
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

  const [_, theme] = useTheme();

  const codeEditorRef = useRef<CodeEditorRef>();

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
    (value: Text) => editorState.setCurrentQueryData(EditorKind.EdgeQL, value),
    [editorState]
  );

  useEffect(() => {
    codeEditorRef.current?.focus();
  }, []);

  return (
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
      />
    </CustomScrollbars>
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
      if (result.inspectorState) {
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
      content = <div className={styles.queryStatus}>OK: {result.status}</div>;
    }
  } else if (result instanceof QueryHistoryErrorItem) {
    content = (
      <div className={styles.queryError}>
        <span className={styles.errorName}>{result.error.data.name}</span>:{" "}
        {result.error.data.msg}
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
