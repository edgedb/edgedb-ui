import {observer} from "mobx-react-lite";
import {DatabaseTabSpec} from "../../components/databasePage";
import {TabReplIcon} from "../../icons";
import {Repl, ReplHistoryItem as ReplHistoryItemState} from "./state";
import {VariableSizeList as List} from "react-window";

import styles from "./repl.module.scss";
import {
  forwardRef,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {useResize} from "@edgedb/common/hooks/useResize";
import {CodeEditorProps, createCodeEditor} from "@edgedb/code-editor";
import {useDatabaseState, useTabState} from "../../state";
import cn from "@edgedb/common/utils/classNames";
import CodeBlock from "@edgedb/common/ui/codeBlock";
import Inspector from "@edgedb/inspector";
import {renderCommandResult} from "./commands";
import {useNavigate} from "react-router-dom";
import Spinner from "@edgedb/common/ui/spinner";
import {useInitialValue} from "@edgedb/common/hooks/useInitialValue";

const outerElementType = forwardRef(({children, ...props}, ref) => (
  <div ref={ref as any} {...props}>
    {children}
    <ReplInput />
  </div>
));

const ReplView = observer(function ReplView() {
  const replState = useTabState(Repl);
  const dbState = useDatabaseState();

  replState.navigation = useNavigate();

  const listRef = useRef<List>(null);
  replState.listRef = listRef;

  const initialScrollPos = useInitialValue(() => replState.initialScrollPos);

  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useResize(containerRef, ({height}) => setHeight(height));

  return (
    <div
      ref={containerRef}
      className={cn("dark-theme", styles.repl, {
        [styles.retroMode]: replState.settings.retroMode,
      })}
    >
      <List
        ref={listRef}
        className={styles.listWrapper}
        outerElementType={outerElementType}
        initialScrollOffset={initialScrollPos}
        onScroll={({scrollOffset}) =>
          (replState.initialScrollPos = scrollOffset)
        }
        height={height}
        width="100%"
        itemCount={replState.queryHistory.length + 1}
        itemSize={(index) =>
          index === 0
            ? 320
            : replState.queryHistory[index - 1]?.renderHeight ?? 34
        }
      >
        {({index, style}) =>
          index === 0 ? (
            <ReplHeader />
          ) : replState.queryHistory[index - 1] ? (
            <ReplHistoryItem
              state={replState}
              listRef={listRef}
              index={index - 1}
              styleTop={style.top}
              dbName={dbState.name}
            />
          ) : (
            <HistoryLoader state={replState} styleTop={style.top} />
          )
        }
      </List>
    </div>
  );
});

export const replTabSpec: DatabaseTabSpec = {
  path: "repl",
  label: "REPL",
  icon: (active) => <TabReplIcon active={active} />,
  state: Repl,
  element: <ReplView />,
};

const ReplInput = observer(function ReplInput() {
  const replState = useTabState(Repl);
  const dbState = useDatabaseState();

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
          if (doc.lines === 1 && doc.line(1).text.trim().startsWith("\\")) {
            replState.runQuery();
            return true;
          }
          return false;
        },
      },
      {
        key: "Mod-ArrowUp",
        run: () => {
          replState.navigateHistory(-1);
          return true;
        },
      },
      {
        key: "Mod-ArrowDown",
        run: () => {
          replState.navigateHistory(1);
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

  useEffect(() => {
    replState.scrollToEnd();
  }, [replState.currentQuery.lines]);

  return (
    <div
      className={cn(styles.replInput, {
        [styles.hidden]: replState.queryRunning,
      })}
    >
      <CodeEditor
        // ref={codeEditorRef}
        code={replState.currentQuery}
        onChange={onChange}
        keybindings={keybindings}
        useDarkTheme
        noPadding
      />
    </div>
  );
});

const ReplHistoryItem = observer(function ReplHistoryItem({
  state,
  listRef,
  index,
  styleTop,
  dbName,
}: {
  state: Repl;
  listRef: RefObject<List>;
  index: number;
  styleTop: any;
  dbName: string;
}) {
  const item = state.queryHistory[index];

  const ref = useRef<HTMLDivElement>(null);

  useResize(ref, ({height}) => {
    const scrollEl = (listRef.current as any)?._outerRef;
    if (scrollEl) {
      console.log(
        `updating ${index} ${height + 24 - (item.renderHeight ?? 0)}`
      );
      scrollEl.scrollTop += height + 24 - (item.renderHeight ?? 0);
    }
    item.renderHeight = height + 24;
    listRef.current?.resetAfterIndex(index + 1);
  });

  let output: JSX.Element | null;

  if (item.error) {
    output = (
      <div className={styles.queryError}>
        <span className={styles.errorName}>{item.error.data.name}</span>:{" "}
        {item.error.data.msg}
        {item.error.data.hint ? (
          <div className={styles.errorHint}>Hint: {item.error.data.hint}</div>
        ) : null}
      </div>
    );
  } else if (item.status) {
    if (item.hasResult) {
      const inspectorState = item.inspectorState;
      output = inspectorState ? (
        <Inspector
          className={styles.inspector}
          state={item.inspectorState}
          disableVirtualisedRendering
        />
      ) : (
        <>loading ...</>
      );
    } else {
      output = <div className={styles.queryStatus}>OK: {item.status}</div>;
    }
  } else if (item.commandResult) {
    output = renderCommandResult(item.commandResult.data);
  } else {
    output = <div>running query...</div>;
  }

  return (
    <div ref={ref} className={styles.replHistoryItem} style={{top: styleTop}}>
      <div className={styles.historyQuery}>
        <div className={styles.historyPrompt}>
          {[
            `${dbName}>`,
            ...Array(item.query.split("\n").length - 1).fill(
              ".".repeat(dbName.length + 1)
            ),
          ].join("\n")}
        </div>

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
      </div>
      {output ? (
        <div
          className={styles.historyOutput}
          style={{paddingLeft: `${dbName.length + 2}ch`}}
        >
          {output}
        </div>
      ) : null}
    </div>
  );
});

function HistoryLoader({state, styleTop}: {state: Repl; styleTop: any}) {
  state.fetchReplHistory();
  return (
    <div className={styles.historyLoading} style={{top: styleTop}}>
      <Spinner size={24} strokeWidth={2} period={1} />
    </div>
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

function ReplHeader() {
  const replState = useTabState(Repl);

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
      </div>
    </div>
  );
}
