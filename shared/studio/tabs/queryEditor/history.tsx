import {observer} from "mobx-react-lite";
import {
  forwardRef,
  RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {VariableSizeList as List} from "react-window";

import Button from "@edgedb/common/ui/button";
import cn from "@edgedb/common/utils/classNames";

import {useTabState} from "../../state";
import {QueryEditor, QueryHistoryItem} from "./state";
import {currentTimestamp} from "./state/currentTimestamp";
import {renderThumbnail} from "./state/thumbnailGen";

import styles from "./repl.module.scss";
import {useResize} from "@edgedb/common/hooks/useResize";
import Spinner from "@edgedb/common/ui/spinner";

export const HistoryPanel = observer(function HistoryPanel() {
  const editorState = useTabState(QueryEditor);

  const ref = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(editorState.showHistory);
  const [visible, setVisible] = useState(showHistory);

  useLayoutEffect(() => {
    if (editorState.showHistory === showHistory) {
      return;
    }
    if (editorState.showHistory) {
      setShowHistory(true);
      requestAnimationFrame(() => {
        // forces reflow
        ref.current!.scrollTop;
        setVisible(true);
      });
    } else {
      setVisible(false);
      ref.current!.addEventListener(
        "transitionend",
        () => setShowHistory(false),
        {once: true}
      );
    }
  }, [editorState.showHistory]);

  return showHistory ? (
    <HistoryPanelInner ref={ref} state={editorState} visible={visible} />
  ) : null;
});

const HistoryPanelInner = observer(
  forwardRef<
    HTMLDivElement,
    {
      state: QueryEditor;
      visible: boolean;
    }
  >(function HistoryPanelInner({state, visible}, ref) {
    useEffect(() => {
      (ref as RefObject<HTMLDivElement>).current?.focus();
    }, []);

    const closeHistory = () => {
      state.setHistoryCursor(-1);
      state.setShowHistory(false);
    };

    return (
      <div
        ref={ref}
        className={cn(styles.history, {
          [styles.visible]: visible,
        })}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp") {
            state.navigateQueryHistory(-1);
          } else if (e.key === "ArrowDown") {
            state.navigateQueryHistory(1);
          } else if (e.key === "Enter") {
            state.setShowHistory(false, false);
          }
        }}
      >
        <HistoryList state={state} />
        <div className={styles.closeHistory}>
          <Button label={"Cancel"} onClick={closeHistory} />
        </div>
      </div>
    );
  })
);

const HistoryList = observer(function HistoryList({
  state,
}: {
  state: QueryEditor;
}) {
  const historyList = state.queryHistory;

  const listRef = useRef<List>(null);

  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useResize(ref, ({height}) => setHeight(height));

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      const index = state.historyCursor + 1;
      const itemTop = (list as any)._getItemStyle(index).top;
      const itemRelTop = itemTop - (list.state as any).scrollOffset;
      if (itemRelTop < 0) {
        list.scrollTo(itemTop);
      } else if (itemRelTop > height - 171) {
        list.scrollTo(itemTop - (height - 171));
      }
    }
  }, [state.historyCursor, height]);

  useEffect(() => {
    listRef.current?.resetAfterIndex(0);
  }, [historyList.length]);

  const loadQuery = (index: number) => {
    state.setShowHistory(false, false);
    state.setLoadedQueryIndex(index);
  };

  return (
    <div ref={ref} className={styles.historyListWrapper}>
      <List
        ref={listRef}
        className={styles.historyList}
        itemCount={historyList.length + 1}
        height={height}
        width="100%"
        estimatedItemSize={121}
        itemSize={(index) =>
          historyList[index - 1]?.showDateHeader ? 137 : 121
        }
      >
        {({index, style}) => (
          <HistoryItem
            state={state}
            index={index - 1}
            item={historyList[index - 1] ?? null}
            styleTop={style.top}
            loadQuery={loadQuery}
          />
        )}
      </List>
    </div>
  );
});

const HistoryItem = observer(function HistoryItem({
  state,
  index,
  item,
  styleTop,
  loadQuery,
}: {
  state: QueryEditor;
  index: number;
  item: QueryHistoryItem | null;
  styleTop: any;
  loadQuery: (index: number) => void;
}) {
  if (item == null && index !== -1) {
    state.fetchQueryHistory();
    return (
      <div style={{top: styleTop}} className={styles.historyLoading}>
        <Spinner size={30} strokeWidth={3} period={1} />
      </div>
    );
  }

  return (
    <div
      style={{top: styleTop}}
      className={cn(styles.historyItem, {
        [styles.selected]: state.historyCursor === index,
        [styles.draft]: !item,
        [styles.hasDateHeader]: !!item?.showDateHeader,
      })}
      onClick={() => state.setHistoryCursor(index)}
    >
      {item ? (
        <>
          {item.showDateHeader ? (
            <div className={styles.dateHeader}>
              {new Date(item.timestamp).toLocaleDateString()}
            </div>
          ) : null}
          {renderThumbnail(item.thumbnailData.data)}
          <div
            className={styles.timeLabel}
            title={new Date(item.timestamp).toLocaleString()}
          >
            <RelativeTime timestamp={item.timestamp} />
          </div>
          {state.loadedQueryIndex !== index && (
            <Button
              className={cn(styles.editButton, {
                [styles.visibleButton]: state.historyCursor === index,
              })}
              label={"Load"}
              onClick={() => loadQuery(index)}
            />
          )}
        </>
      ) : (
        "draft query"
      )}
    </div>
  );
});

const RelativeTime = observer(function RelativeTime({
  timestamp,
}: {
  timestamp: number;
}) {
  const cachedTime = useRef<string>();

  if (cachedTime.current) {
    return <>{cachedTime.current}</>;
  }

  const diff = (currentTimestamp.timestamp - timestamp) / 1000;
  if (diff < 60) {
    return <>{Math.floor(diff)}s ago</>;
  }
  if (diff < 3600) {
    return <>{Math.floor(diff / 60)}m ago</>;
  }

  const date = new Date(timestamp);
  cachedTime.current = date.toLocaleTimeString();
  return <>{cachedTime.current}</>;
});
