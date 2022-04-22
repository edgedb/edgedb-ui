import React, {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {observer} from "mobx-react";
import {VariableSizeList as List, ListChildComponentProps} from "react-window";

import {useInitialValue} from "@edgedb/common/hooks/useInitialValue";
import {useResize} from "@edgedb/common/hooks/useResize";

import styles from "./repl.module.scss";

import {ReplHistoryCell as ReplHistoryCellState} from "./state";
// import {Transaction} from "../../state/models/connection";

import ReplHistoryCell, {ReplTransactionStatus} from "./replHistoryCell";
import {useTabState} from "../../state";
import {Repl} from "./state";

const ListPadding = 24;

interface ListData {
  getItem: (index: number) =>
    | ReplHistoryCellState
    | {
        // transaction: Transaction;
        setHeight: React.Dispatch<React.SetStateAction<number>>;
      };
  listRef: React.RefObject<List>;
}

const innerElementType = forwardRef(({style, ...rest}: any, ref) => (
  <div
    ref={ref}
    style={{
      ...style,
      height: `${parseFloat(style.height) + ListPadding * 2}px`,
    }}
    {...rest}
  />
));

export default observer(function ReplHistory() {
  const replState = useTabState(Repl);

  const {queryHistory, currentTransaction} = replState;

  const [containerHeight, setContainerHeight] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useResize(containerRef, ({height}) => setContainerHeight(height));

  const initialScrollOffset = useInitialValue(
    () => replState.historyScrollPos
  );

  const [transactionHeight, setTransactionHeight] = useState<number>(32);

  const listRef = useRef<List>(null);

  const getItem = useCallback(
    (index: number) => {
      if (currentTransaction) {
        if (index === 0) {
          return {
            transaction: currentTransaction,
            setHeight: setTransactionHeight,
          };
        }
        return queryHistory[queryHistory.length - index];
      }
      return queryHistory[queryHistory.length - 1 - index];
    },
    [queryHistory, currentTransaction, setTransactionHeight]
  );

  return (
    <div ref={containerRef} className={styles.replHistory}>
      <List<ListData>
        ref={listRef}
        className={styles.historyList}
        innerElementType={innerElementType}
        width={"100%"}
        height={containerHeight}
        initialScrollOffset={initialScrollOffset}
        onScroll={({scrollOffset}) =>
          replState.setHistoryScrollPos(scrollOffset)
        }
        itemCount={queryHistory.length + (currentTransaction ? 1 : 0)}
        itemData={{getItem, listRef}}
        itemKey={(index) => {
          const item = getItem(index);
          return item instanceof ReplHistoryCellState
            ? item.$modelId
            : item.transaction.$modelId;
        }}
        itemSize={(index) => {
          const item = getItem(index);
          return item instanceof ReplHistoryCellState
            ? item.renderHeight
            : transactionHeight;
        }}
      >
        {QueryHistoryItem}
      </List>
    </div>
  );
});

function QueryHistoryItem({
  index,
  style,
  data: {getItem, listRef},
}: ListChildComponentProps<ListData>) {
  const item = getItem(index);

  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (containerRef.current) {
      const observer = new ResizeObserver(([entry]) => {
        if (item instanceof ReplHistoryCellState) {
          if (item.renderHeight !== entry.contentRect.height) {
            item.setRenderHeight(entry.contentRect.height);
            listRef.current?.resetAfterIndex(index);
          }
        } else {
          item.setHeight(entry.contentRect.height);
          listRef.current?.resetAfterIndex(index);
        }
      });

      observer.observe(containerRef.current);

      return () => {
        observer.disconnect();
      };
    }
  }, [item, containerRef, listRef]);

  return (
    <div
      style={{
        ...(style as any),
        height: undefined,
        top: `${parseFloat(style.top as string) + ListPadding}px`,
      }}
      ref={containerRef}
    >
      {item instanceof ReplHistoryCellState ? (
        <ReplHistoryCell cell={item} />
      ) : null // <ReplTransactionStatus transaction={item.transaction} />
      }
    </div>
  );
}
