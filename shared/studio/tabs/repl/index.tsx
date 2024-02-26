import {
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {reaction} from "mobx";
import {observer} from "mobx-react-lite";

import {useInitialValue} from "@edgedb/common/hooks/useInitialValue";
import {useResize} from "@edgedb/common/hooks/useResize";
import {Theme, useTheme} from "@edgedb/common/hooks/useTheme";

import CodeBlock from "@edgedb/common/ui/codeBlock";
import {CustomScrollbars} from "@edgedb/common/ui/customScrollbar";
import Spinner from "@edgedb/common/ui/spinner";
import Button from "@edgedb/common/ui/button";
import cn from "@edgedb/common/utils/classNames";

import {
  CodeEditorProps,
  CodeEditorRef,
  createCodeEditor,
} from "@edgedb/code-editor";
import Inspector, {DEFAULT_ROW_HEIGHT} from "@edgedb/inspector";

import {DatabaseTabSpec} from "../../components/databasePage";
import {ExplainType, ExplainVis} from "../../components/explainVis";
import {ExplainCodeBlock} from "../../components/explainVis/codeblock";
import {
  ExplainHighlightsRef,
  ExplainHighlightsRenderer,
} from "../../components/explainVis/codeEditorContexts";
import {ExplainStateType} from "../../components/explainVis/state";
import {
  ExtendedViewerContext,
  ExtendedViewerRenderer,
} from "../../components/extendedViewers";
import {ArrowDown, TabReplIcon} from "../../icons";

import {useDatabaseState, useTabState} from "../../state";
import {
  defaultItemHeight,
  Repl,
  ReplHistoryItem as ReplHistoryItemState,
} from "./state";
import {QueryEditor} from "../queryEditor/state";
import {renderCommandResult} from "./commands";

import {useDBRouter} from "../../hooks/dbRoute";

import styles from "./repl.module.scss";
import {isEndOfStatement} from "./state/utils";
import {useIsMobile} from "@edgedb/common/hooks/useMobile";
import {RunButton} from "@edgedb/common/ui/mobile";

const ReplView = observer(function ReplView() {
  const replState = useTabState(Repl);

  replState.navigation = useDBRouter().navigate;

  const initialScrollPos = useInitialValue(() => replState.initialScrollPos);

  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useResize(containerRef, ({height}) => setHeight(height));

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape" && replState.extendedViewerItem) {
        replState.setExtendedViewerItem(null);
      }
    };

    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, []);

  return (
    <div className={styles.replWrapper}>
      <div
        style={{display: "contents"}}
        className={cn({"dark-theme": replState.settings.retroMode})}
      >
        <div
          ref={containerRef}
          className={cn(styles.repl, {
            [styles.retroMode]: replState.settings.retroMode,
            [styles.showExtendedResult]: replState.extendedViewerItem !== null,
          })}
        >
          <CustomScrollbars innerClass={styles.scrollInner} reverse>
            <ReplList height={height} initialScrollPos={initialScrollPos} />
          </CustomScrollbars>
        </div>
      </div>

      {replState.extendedViewerItem ? (
        <div className={styles.extendedViewerContainer}>
          <ExtendedViewerContext.Provider
            value={{
              closeExtendedView: () => replState.setExtendedViewerItem(null),
            }}
          >
            <ExtendedViewerRenderer item={replState.extendedViewerItem} />
          </ExtendedViewerContext.Provider>
        </div>
      ) : null}
    </div>
  );
});

const ReplList = observer(function ReplList({
  height,
  initialScrollPos,
}: {
  height: number;
  initialScrollPos: number;
}) {
  const replState = useTabState(Repl);
  const dbState = useDatabaseState();

  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = initialScrollPos;
    }
  }, []);

  const [renderHeader, setRenderHeader] = useState(true);
  const [visibleBounds, setVisibleBounds] = useState<[number, number, number]>(
    [0, 0, 0]
  );

  const isMobile = useIsMobile();

  const headerHeight =
    (isMobile ? 320 : 330) + (replState._hasUnfetchedHistory ? 34 : 0);

  useEffect(() => {
    replState.scrollRef = ref.current;
  }, [ref]);

  const updateVisibleBounds = useCallback(() => {
    const el = ref.current!;
    const scrollTop = el.scrollHeight + el.scrollTop - el.clientHeight;

    setRenderHeader(scrollTop < headerHeight + 100);

    const startIndex = Math.max(
      0,
      replState.itemHeights.getIndexAtHeight(
        Math.max(0, scrollTop - headerHeight)
      ) - 2
    );
    const endIndex = Math.min(
      replState.itemHeights.getIndexAtHeight(
        Math.max(0, scrollTop - headerHeight + ref.current!.clientHeight)
      ) + 2,
      replState.queryHistory.length - 1
    );

    setVisibleBounds((old) =>
      old[0] === startIndex && old[1] === endIndex
        ? old
        : [
            startIndex,
            endIndex,
            old[0] !== startIndex
              ? replState.itemHeights.getHeightAtIndex(startIndex)
              : old[2],
          ]
    );
  }, [height, headerHeight, replState.queryHistory.length]);

  useEffect(() => {
    const el = ref.current!;

    const listener = () => {
      replState.initialScrollPos = el.scrollTop;
      updateVisibleBounds();
    };
    el.addEventListener("scroll", listener, {passive: true});

    return () => {
      el.removeEventListener("scroll", listener);
    };
  }, [updateVisibleBounds]);

  useEffect(() => {
    updateVisibleBounds();
  }, [replState.itemHeights.totalHeight, height]);

  const items: JSX.Element[] = [];
  if (replState.queryHistory.length) {
    let top = visibleBounds[2] + headerHeight;
    for (let i = visibleBounds[0]; i <= visibleBounds[1]; i++) {
      const item = replState.queryHistory[i];
      items.push(
        <ReplHistoryItem
          key={item.$modelId}
          state={replState}
          index={i}
          item={item}
          styleTop={top}
          dbName={dbState.name}
        />
      );
      top += item.renderHeight ?? defaultItemHeight;
    }
  }

  return (
    <div ref={ref} className={styles.list} style={{height}}>
      <div className={styles.scrollInner}>
        <div
          className={styles.listInner}
          style={{height: replState.itemHeights.totalHeight + headerHeight}}
        >
          {renderHeader ? <ReplHeader /> : null}
          {items}
        </div>
        <ReplInput />
      </div>
      <RunButton
        onClick={() => replState.runQuery()}
        isLoading={replState.queryRunning}
        onCancel={
          replState._runningQuery instanceof AbortController
            ? () => (replState._runningQuery as AbortController)?.abort()
            : undefined
        }
        disabled={
          !replState.canRunQuery &&
          !(replState._runningQuery instanceof AbortController)
        }
        className={styles.runBtn}
      />
    </div>
  );
});

export const replTabSpec: DatabaseTabSpec = {
  path: "repl",
  label: "REPL",
  icon: (active) => <TabReplIcon active={active} />,
  usesSessionState: true,
  state: Repl,
  element: <ReplView />,
};

const ReplInput = observer(function ReplInput() {
  const replState = useTabState(Repl);
  const dbState = useDatabaseState();

  const [_, theme] = useTheme();

  const [CodeEditor] = useState(() =>
    createCodeEditor({
      highlightActiveLine: false,
      terminalCursor: true,
      formatLineNo: (lineNo) =>
        lineNo === 1
          ? `${dbState.name}>`
          : ".".repeat(dbState.name.length + 1),
    })
  );

  const ref = useRef<CodeEditorRef>();

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    if (replState._runningQuery instanceof AbortController) {
      const listener = (e: KeyboardEvent) => {
        if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
          (replState._runningQuery as AbortController)?.abort();
        }
      };
      window.addEventListener("keydown", listener, {capture: true});

      return () => {
        window.removeEventListener("keydown", listener, {capture: true});
      };
    }
  }, [replState._runningQuery]);

  const keybindings = useMemo<CodeEditorProps["keybindings"]>(
    () => [
      {
        key: "Mod-Enter",
        run: () => {
          replState.runQuery();
          return true;
        },
        preventDefault: true,
      },
      {
        key: "Enter",
        run: (editor) => {
          const doc = editor.state.doc;
          if (
            (doc.lines === 1 && doc.line(1).text.trim().startsWith("\\")) ||
            isEndOfStatement(
              editor.state.doc.toString(),
              editor.state.selection
            )
          ) {
            replState.runQuery();
            return true;
          }
          return false;
        },
      },
      {
        key: "Mod-ArrowUp",
        run: () => {
          replState.navigateHistory(1);
          return true;
        },
      },
      {
        key: "Mod-ArrowDown",
        run: () => {
          replState.navigateHistory(-1);
          return true;
        },
      },
    ],
    [replState]
  );

  const onChange = useCallback<CodeEditorProps["onChange"]>(
    (value) => replState.setCurrentQuery(value),
    [replState]
  );

  return (
    <div
      className={cn(styles.replInput, {
        [styles.hidden]: replState.queryRunning,
      })}
      onKeyDownCapture={
        replState.queryRunning
          ? (e) => {
              // prevent keypresses while hidden
              e.preventDefault();
              e.stopPropagation();
            }
          : undefined
      }
    >
      <CustomScrollbars
        className={styles.scrollWrapper}
        scrollClass="cm-scroller"
        innerClass="cm-content"
      >
        <CodeEditor
          ref={ref}
          code={replState.currentQuery}
          onChange={onChange}
          keybindings={keybindings}
          useDarkTheme={replState.settings.retroMode || theme === Theme.dark}
          noPadding
        />
      </CustomScrollbars>
    </div>
  );
});

const ReplHistoryItem = observer(function ReplHistoryItem({
  state,
  index,
  item,
  styleTop,
  dbName,
}: {
  state: Repl;
  index: number;
  item: ReplHistoryItemState;
  styleTop: any;
  dbName: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const replState = useTabState(Repl);
  const editorState = useTabState(QueryEditor);
  const isMobile = useIsMobile();
  let showExpandBtn = false;

  const {navigate, currentPath} = useDBRouter();

  const containerRef = useRef<HTMLDivElement>(null);

  const updateScroll = useRef(false);

  const runInEditor = () => {
    editorState.loadFromRepl(item);
    navigate(`${currentPath[0]}/editor`);
  };

  useEffect(() => {
    const disposer = reaction(
      () => item.inspectorState?._items.length,
      (curr, prev) => {
        if (prev && curr !== prev) {
          updateScroll.current = true;
        }
      }
    );

    return () => {
      disposer();
      item._inspector = null;
    };
  }, []);

  useResize(
    ref,
    ({height}) => {
      const paddedHeight = height + 16 + (item.showDateHeader ? 24 : 0);
      if (item.renderHeight !== paddedHeight) {
        if (item.renderHeight && state.scrollRef && updateScroll.current) {
          state.scrollRef.scrollTop += item.renderHeight - paddedHeight;

          updateScroll.current = false;
        }
        item.renderHeight = paddedHeight;
        state.itemHeights.updateItemHeight(index, paddedHeight);
      }
    },
    [item.showDateHeader]
  );

  let output: JSX.Element | null;

  const isExplain =
    item.status === ExplainStateType.explain ||
    item.status === ExplainStateType.analyzeQuery;

  if (item.error) {
    output = (
      <div className={styles.queryError}>
        <span className={styles.errorName}>{item.error.data.name}</span>:{" "}
        {item.error.data.msg}
        {item.error.data.details ? (
          <div className={styles.errorHint}>
            Details: {item.error.data.details}
          </div>
        ) : null}
        {item.error.data.hint ? (
          <div className={styles.errorHint}>Hint: {item.error.data.hint}</div>
        ) : null}
      </div>
    );
  } else if (item.status) {
    if (item.hasResult) {
      if (isExplain) {
        output = (
          <div className={styles.explain}>
            <Button
              label="VIEW FULL UI IN EDITOR"
              className={styles.runInEditorBtn}
              onClick={runInEditor}
            />
            <ExplainVis
              state={item.explainState}
              type={ExplainType.light}
              classes={styles.explainVis}
            />
          </div>
        );
      } else {
        const inspectorState = item.inspectorState;

        if (inspectorState) {
          const maxLines = item.showMore ? undefined : 16;

          showExpandBtn =
            !!maxLines && inspectorState.totalItemsLines > maxLines;

          output = (
            <Inspector
              disableVirtualisedRendering
              className={styles.inspector}
              state={item.inspectorState}
              maxLines={maxLines}
            />
          );
        } else {
          output = <>loading ...</>;
        }
      }
    } else {
      output = <div className={styles.queryStatus}>OK: {item.status}</div>;
    }
  } else if (item.commandResult) {
    output = renderCommandResult(item.commandResult.data);
  } else {
    output = (
      <>
        {!isMobile ? (
          <div className={styles.queryRunningSpinner} style={{marginLeft: 8}}>
            <Spinner size={18} />
            {replState._runningQuery instanceof AbortController ? (
              <div
                className={styles.queryCancelButton}
                onClick={() =>
                  (replState._runningQuery as AbortController).abort()
                }
              >
                Cancel query (Ctrl+C)
              </div>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  const queryLines = item.query.split("\n").length;
  const truncateQuery = !item.showFullQuery && queryLines > 20;

  const marginLeftRepl = isMobile
    ? "0px"
    : isExplain
    ? "16px"
    : `${dbName.length + 2}ch`;

  return (
    <div
      ref={ref}
      className={cn(styles.replHistoryItem, {
        [styles.showDateHeader]: item.showDateHeader,
        [styles.explain]: isExplain,
      })}
      style={{top: styleTop}}
    >
      {item.showDateHeader ? (
        <div className={styles.historyDateHeader}>
          {new Date(item.timestamp).toLocaleDateString()}
        </div>
      ) : null}
      <div
        className={cn(styles.historyQuery, {
          [styles.historyQueryExplain]: isExplain,
        })}
      >
        <div className={styles.historyPrompt}>
          {[
            `${dbName}>`,
            ...Array((truncateQuery ? 20 : queryLines) - 1).fill(
              ".".repeat(dbName.length + 1)
            ),
          ].join("\n")}
        </div>

        <CustomScrollbars
          className={styles.historyQueryCode}
          innerClass={styles.codeBlockContainer}
        >
          <div className={styles.scrollWrapper}>
            <div
              ref={containerRef}
              className={cn(styles.codeBlockContainer, {
                [styles.truncateQuery]: truncateQuery,
              })}
            >
              <QueryCodeBlock item={item} containerRef={containerRef} />
              {item.error?.data.range ? (
                <div
                  className={styles.codeBlockErrorLines}
                  style={{
                    top: `${
                      item.query.slice(0, item.error.data.range[0]).split("\n")
                        .length - 1
                    }em`,
                    height: `${
                      item.query
                        .slice(
                          item.error.data.range[0],
                          item.error.data.range[1]
                        )
                        .split("\n").length
                    }em`,
                  }}
                />
              ) : null}
            </div>
            {truncateQuery ? (
              <div className={styles.showFullQuery}>
                <Button
                  className={styles.showFullQueryBtn}
                  label="Show more"
                  icon={<ArrowDown />}
                  onClick={() => {
                    item.setShowFullQuery(true);
                    updateScroll.current = true;
                  }}
                />
              </div>
            ) : null}
          </div>
        </CustomScrollbars>
        <div className={styles.historyTime}>
          {new Date(item.timestamp).toLocaleTimeString()}
        </div>
      </div>
      {output ? (
        <CustomScrollbars
          className={styles.outputOuterWrapper}
          innerClass={styles.historyOutput}
          hideVertical
        >
          <div
            className={cn(styles.scrollWrapper, {
              [styles.sticky]: isExplain,
            })}
            style={
              showExpandBtn ? {maxHeight: 16 * DEFAULT_ROW_HEIGHT} : undefined
            }
          >
            <div
              className={cn(styles.historyOutput, {
                [styles.wrapContent]: item.error != null,
                [styles.explain]: isExplain,
              })}
              style={{
                marginLeft: marginLeftRepl,
              }}
            >
              {output}
            </div>
            {showExpandBtn ? (
              <div className={styles.showMore}>
                <button
                  onClick={() => {
                    item.setShowMore(true);
                    updateScroll.current = true;
                  }}
                >
                  show more...
                </button>
              </div>
            ) : null}
          </div>
        </CustomScrollbars>
      ) : null}
    </div>
  );
});

function QueryCodeBlock({
  item,
  containerRef,
}: {
  item: ReplHistoryItemState;
  containerRef: RefObject<HTMLElement>;
}) {
  const [ref, setRef] = useState<ExplainHighlightsRef | null>(null);
  const isExplain =
    item.status === "EXPLAIN" || item.status === "ANALYZE QUERY";

  const explainHighlightsRef = useCallback((node: any) => {
    if (node) {
      setRef(node);
    }
  }, []);

  useEffect(() => {
    if (ref && containerRef.current) {
      ref.updateContextRects(containerRef.current);
    }
  }, [ref]);

  return isExplain ? (
    <>
      <ExplainCodeBlock
        className={cn(styles.code)}
        code={item.query}
        explainContexts={item.explainState?.contextsByBufIdx[0] ?? []}
      />
      {item.explainState ? (
        <ExplainHighlightsRenderer
          ref={explainHighlightsRef}
          state={item.explainState}
          isEditor={false}
        />
      ) : null}
    </>
  ) : (
    <CodeBlock
      className={cn(styles.code)}
      code={item.query}
      customRanges={
        item.error?.data.range
          ? [
              {
                range: item.error.data.range,
                style: styles.errorUnderline,
              },
            ]
          : undefined
      }
    />
  );
}

const headerASCII = `
                                          /$$
                                         | $$
                                         | $$
 /$$$$$$$$ /$$$$$$$   /$$$$$$  /$$$$$$$$ | $$  /$$$$$$$  /$$$$$$$
| $$_____/| $$__  $$ /$$__  $$| $$_____/ | $$ | $$__  $$| $$__  $$
| $$      | $$  \\ $$| $$  \\__/| $$       | $$ | $$  \\ $$| $$  \\ $$
| $$$$$$  | $$  | $$| $$ /$$$$| $$$$$$   | $$ | $$  | $$| $$$$$$$
| $$___/  | $$  | $$| $$|_  $$| $$___/   | $$ | $$  | $$| $$__  $$
| $$      | $$  | $$| $$  \\ $$| $$       | $$ | $$  | $$| $$  \\ $$
| $$$$$$$$| $$$$$$$/|  $$$$$$/| $$$$$$$$ | $$ | $$$$$$$/| $$$$$$$/
|________/|_______/  \\______/ |________/ | $$ |_______/ |_______/
                                         | $$
                                         | $$
                                         |__/
`.replace(/\$+/g, "<span>$&</span>");

const ReplHeader = observer(function ReplHeader() {
  const replState = useTabState(Repl);

  useEffect(() => {
    if (replState._hasUnfetchedHistory && !replState._fetchingHistory) {
      replState.fetchReplHistory();
    }
  }, [replState._hasUnfetchedHistory, replState._fetchingHistory]);

  const ctrlKey = navigator.platform.toLowerCase().includes("mac")
    ? "Cmd"
    : "Ctrl";

  return (
    <div className={styles.replHeader}>
      <div
        className={styles.headerAscii}
        dangerouslySetInnerHTML={{__html: headerASCII}}
      />
      <div className={styles.headerMsg}>
        Welcome to EdgeDB repl, type{" "}
        <span onClick={() => replState.runQuery("\\help")}>\help</span> for
        commands list
        <br />
        Shortcuts: <i>{ctrlKey}+Enter</i> to run query,{" "}
        <i>{ctrlKey}+ArrowUp/Down</i> to navigate history
      </div>
      {replState._hasUnfetchedHistory ? (
        <div className={styles.historyLoading}>
          <Spinner size={24} strokeWidth={2} period={1} />
        </div>
      ) : null}
    </div>
  );
});
