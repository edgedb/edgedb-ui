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

import ReplHistoryCell from "./replHistoryCell";
import {useTabState} from "../../state";
import {Repl} from "./state";

const ListPadding = 24;

interface ListData {
  getItem: (index: number) => ReplHistoryCellState;

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

  const {queryHistory} = replState;

  const [containerHeight, setContainerHeight] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useResize(containerRef, ({height}) => setContainerHeight(height));

  const initialScrollOffset = useInitialValue(
    () => replState.historyScrollPos
  );

  const listRef = useRef<List>(null);

  const getItem = useCallback(
    (index: number) => {
      return queryHistory[queryHistory.length - 1 - index];
    },
    [queryHistory]
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
        itemCount={queryHistory.length}
        itemData={{getItem, listRef}}
        itemKey={(index) => getItem(index).$modelId}
        itemSize={(index) => getItem(index).renderHeight}
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
        if (item.renderHeight !== entry.contentRect.height) {
          item.setRenderHeight(entry.contentRect.height);
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
      <ReplHistoryCell cell={item} />
    </div>
  );
}
