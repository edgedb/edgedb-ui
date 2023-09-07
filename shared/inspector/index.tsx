import {observer} from "mobx-react";
import {VariableSizeList as List, ListChildComponentProps} from "react-window";
import {_ICodec} from "edgedb";

import cn from "@edgedb/common/utils/classNames";

import {InspectorState, Item} from "./state";
import {InspectorContext, useInspectorState} from "./context";

import styles from "./inspector.module.scss";
import {ItemType} from "./buildItem";
import {renderResultAsJson, _renderToJson} from "./renderJsonResult";
import {
  forwardRef,
  HTMLAttributes,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type InspectorProps = RowListProps & {
  state: InspectorState;
};

export const DEFAULT_ROW_HEIGHT = 28;
export const DEFAULT_LINE_HEIGHT = 26;

export default function Inspector({state, ...rowProps}: InspectorProps) {
  return (
    <InspectorContext.Provider value={state}>
      <RowList key={state.$modelId} {...rowProps} />
    </InspectorContext.Provider>
  );
}

export function useInspectorKeybindings(state: InspectorState) {
  return useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (e.ctrlKey) {
            state.selectSiblingIndex(state.selectedIndex, 1);
          } else {
            state.setSelectedIndex((state.selectedIndex ?? -1) + 1);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (e.ctrlKey) {
            state.selectSiblingIndex(state.selectedIndex, -1);
          } else {
            state.setSelectedIndex(
              (state.selectedIndex ?? state._items.length) - 1
            );
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (state.selectedIndex != null) {
            state.collapseItem(state.selectedIndex);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (state.selectedIndex != null) {
            state.expandItem(state.selectedIndex);
          }
          break;
        case " ": {
          // spacebar
          e.preventDefault();
          const item = state.selectedIndex
            ? state._items[state.selectedIndex]
            : null;
          if (
            state.openExtendedView &&
            item?.type === ItemType.Scalar &&
            state.extendedViewIds?.has(item.codec.getKnownTypeName())
          ) {
            state.openExtendedView(item);
          }
          break;
        }
      }
    },
    [state]
  );
}

type RowListProps = {
  className?: string;
  rowHeight?: number;
  lineHeight?: number;
} & (
  | {
      disableVirtualisedRendering: true;
      maxLines?: number;
      height?: undefined;
    }
  | {
      disableVirtualisedRendering?: false;
      height: number;
      maxLines?: undefined;
    }
);

const createOuterElementType = (attrs: HTMLAttributes<HTMLDivElement>) =>
  forwardRef((props, ref) => <div ref={ref as any} {...attrs} {...props} />);

const innerElementType = forwardRef((props, ref) => (
  <div
    ref={ref as any}
    className={styles.innerWrapper}
    {...props}
    style={{
      ...(props as any).style,
      width: undefined,
      height: (props as any).style.height + 16,
    }}
  />
));

const RowList = observer(function RowList({
  className,
  rowHeight = DEFAULT_ROW_HEIGHT,
  lineHeight = DEFAULT_LINE_HEIGHT,
  height,
  maxLines,
  disableVirtualisedRendering,
}: RowListProps) {
  const state = useInspectorState();

  const vPad = rowHeight - lineHeight;

  const items = state.getItems();

  const onKeyDown = useInspectorKeybindings(state);

  const inspectorStyle = {
    "--lineHeight": `${lineHeight}px`,
    "--rowPad": `${vPad / 2}px`,
  } as any;

  if (disableVirtualisedRendering) {
    let rows: Item[];
    if (maxLines) {
      let lineCount = 0;
      let i = 0;
      while (i < items.length) {
        lineCount += items[i++].height ?? 1;
        if (lineCount > maxLines) break;
      }
      rows = items.slice(0, i);
    } else {
      rows = items;
    }

    return (
      <div
        className={cn(styles.inspector, className, {
          [styles.jsonMode]: state._jsonModeData != null,
        })}
        style={inspectorStyle}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        {rows.map((_, i) => (
          <Row index={i} style={{}} data={items} key={i} noVirtualised />
        ))}
      </div>
    );
  } else {
    const itemSize = (index: number) =>
      (items[index].height ?? 1) * lineHeight + vPad;

    const ref = useRef<List>(null);

    useEffect(() => {
      if (state.selectedIndex != null) {
        ref.current?.scrollToItem(state.selectedIndex);
      }
    }, [state.selectedIndex]);

    const outerElementType = useMemo(
      () => createOuterElementType({onKeyDown, tabIndex: 0}),
      [onKeyDown]
    );

    return (
      <List<Item[]>
        ref={ref}
        className={cn(styles.inspector, className, {
          [styles.jsonMode]: state._jsonModeData != null,
        })}
        style={inspectorStyle}
        height={height}
        width={"100%"}
        outerElementType={outerElementType}
        innerElementType={innerElementType}
        initialScrollOffset={state.scrollPos}
        onScroll={({scrollOffset}) => state.setScrollPos(scrollOffset)}
        itemData={items}
        itemCount={items.length}
        estimatedItemSize={rowHeight}
        itemSize={itemSize}
      >
        {Row}
      </List>
    );
  }
});

const Row = observer(function Row({
  index,
  style,
  data,
  noVirtualised,
}: ListChildComponentProps<Item[]> & {noVirtualised?: boolean}) {
  const state = useInspectorState();

  const item = data[index];

  const isExpanded = state.expanded!.has(item.id);

  return (
    <div
      className={styles.rowWrapper}
      style={{
        top: style.top,
        height: noVirtualised ? undefined : 0,
      }}
    >
      <InspectorRow
        key={item.id}
        index={index}
        item={item}
        state={state}
        isExpanded={isExpanded}
        toggleExpanded={() => {
          isExpanded ? state.collapseItem(index) : state.expandItem(index);
        }}
      />
    </div>
  );
});

function CopyButton({
  item,
  implicitLimit,
  rawCopy,
  ...props
}: {
  item: Item;
  implicitLimit: number | null;
  rawCopy?: string | null;
} & HTMLAttributes<HTMLDivElement>) {
  if (item.type === ItemType.Other) {
    return null;
  }

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timeout = setTimeout(() => setCopied(false), 1000);
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [copied]);

  return (
    <div
      className={cn(styles.copyButton)}
      {...props}
      onClick={() => {
        const jsonString =
          rawCopy ??
          (item.parent == null
            ? renderResultAsJson((item as any).data, item.codec, implicitLimit)
            : _renderToJson(
                item.type === ItemType.Scalar
                  ? (item.parent as any).data[item.index]
                  : item.data,
                item.codec,
                "",
                implicitLimit
              ));

        navigator.clipboard?.writeText(jsonString);
        setCopied(true);
      }}
    >
      <CopyIcon /> {copied ? "Copied" : "Copy"}
    </div>
  );
}

interface InspectorRowProps {
  index?: number;
  item: Item;
  state: InspectorState;
  className?: string;
  isExpanded: boolean;
  toggleExpanded: () => void;
  disableCopy?: boolean;
}

export const InspectorRow = observer(function InspectorRow({
  index,
  item,
  state,
  className,
  isExpanded,
  toggleExpanded,
  disableCopy = false,
}: InspectorRowProps) {
  const expandableItem =
    item.type !== ItemType.Scalar && item.type !== ItemType.Other;

  return (
    <div
      className={cn(styles.rowItem, className, {
        [styles.selected]: state.selectedIndex === index,
        [styles.hoverable]: !disableCopy
          ? item.type !== ItemType.Other
          : false,
        [styles.highlightBody]: state.hoverId === item.id,
        [styles.highlightAll]:
          state.hoverId !== item.id && item.id.startsWith(state.hoverId!),
      })}
      style={{
        paddingLeft: `${(item.level + 1) * 2 + 1}ch`,
      }}
      onClick={index != null ? () => state.setSelectedIndex(index) : undefined}
    >
      {expandableItem ? (
        <div
          className={cn(styles.expandArrow, {
            [styles.expanded]: isExpanded,
          })}
          onClick={toggleExpanded}
        >
          <ExpandArrowIcon />
        </div>
      ) : null}
      <div className={styles.itemContent}>
        {item.label}
        <div className={styles.itemBody}>
          {item.body}
          {expandableItem && !isExpanded ? (
            <>
              <div className={styles.ellipsis} onClick={toggleExpanded}>
                <EllipsisIcon />
              </div>
              {(item as any).closingBracket.body}
            </>
          ) : null}
        </div>
        {item.comma ||
        (expandableItem &&
          !isExpanded &&
          (item as any).closingBracket.comma) ? (
          <span className={styles.comma}>,</span>
        ) : null}
      </div>

      {!disableCopy ? (
        <div
          className={cn(styles.actions, {
            [styles.multiline]: (item.height ?? 0) > 1,
          })}
        >
          {state.openExtendedView &&
          item.type === ItemType.Scalar &&
          state.extendedViewIds?.has(item.codec.getKnownTypeName()) ? (
            <div
              className={cn(styles.viewButton)}
              onClick={() => state.openExtendedView?.(item)}
            >
              <OpenExpandedViewIcon /> View
            </div>
          ) : null}
          <CopyButton
            item={item}
            onMouseEnter={() => {
              state.setHoverId(item.id);
            }}
            onMouseLeave={() => {
              state.setHoverId(null);
            }}
            implicitLimit={state.implicitLimit}
            rawCopy={state._jsonModeData}
          />
        </div>
      ) : null}
    </div>
  );
});

export function ExpandArrowIcon() {
  return (
    <svg
      width="14"
      height="7"
      viewBox="0 0 14 7"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13 1L7 6L1 1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EllipsisIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
    >
      <circle cx="8" cy="12" r="1"></circle>
      <circle cx="12" cy="12" r="1"></circle>
      <circle cx="16" cy="12" r="1"></circle>
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      width="13"
      height="15"
      viewBox="0 0 13 15"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2 0C0.895431 0 0 0.895431 0 2V10C0 11.1046 0.89543 12 2 12H3V13C3 14.1046 3.89543 15 5 15H11C12.1046 15 13 14.1046 13 13V5C13 3.89543 12.1046 3 11 3H10V2C10 0.895431 9.10457 0 8 0H2ZM4 12H8C9.10457 12 10 11.1046 10 10V4H11C11.5523 4 12 4.44772 12 5V13C12 13.5523 11.5523 14 11 14H5C4.44772 14 4 13.5523 4 13V12Z"
      />
    </svg>
  );
}

function OpenExpandedViewIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
