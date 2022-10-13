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
  useState,
} from "react";

interface InspectorProps extends RowListProps {
  state: InspectorState;
}

export default function Inspector({state, ...rowProps}: InspectorProps) {
  return (
    <InspectorContext.Provider value={state}>
      <RowList key={state.$modelId} {...rowProps} />
    </InspectorContext.Provider>
  );
}

interface RowListProps {
  className?: string;
  rowHeight?: number;
  lineHeight?: number;
  height?: number;
  maxHeight?: number;
  disableVirtualisedRendering?: boolean;
}

const innerElementType = forwardRef((props, ref) => (
  <div
    ref={ref as any}
    className={styles.innerWrapper}
    {...props}
    style={{...(props as any).style, width: undefined}}
  />
));

const RowList = observer(function RowList({
  className,
  rowHeight = 28,
  lineHeight = 26,
  height,
  maxHeight = rowHeight * 10,
  disableVirtualisedRendering,
}: RowListProps) {
  const state = useInspectorState();

  const vPad = rowHeight - lineHeight;

  const items = state.getItems();

  const inspectorStyle = {
    "--lineHeight": `${lineHeight}px`,
    "--rowPad": `${vPad / 2}px`,
  } as any;

  if (disableVirtualisedRendering) {
    return (
      <div
        className={cn(styles.inspector, className, {
          [styles.jsonMode]: state._jsonMode,
        })}
        style={inspectorStyle}
      >
        {items.map((_, i) => (
          <Row index={i} style={{}} data={items} key={i} noVirtualised />
        ))}
      </div>
    );
  } else {
    const itemSize = (index: number) =>
      (items[index].height ?? 1) * lineHeight + vPad;

    if (height == null) {
      height = 0;
      for (let i = 0; i < items.length; i++) {
        height += itemSize(i);
        if (height > maxHeight) {
          height = maxHeight;
          break;
        }
      }
    }

    return (
      <List<Item[]>
        className={cn(styles.inspector, className, {
          [styles.jsonMode]: state._jsonMode,
        })}
        style={inspectorStyle}
        height={height}
        width={"100%"}
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
  ...props
}: {item: Item} & HTMLAttributes<HTMLDivElement>) {
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
      className={styles.copyButton}
      {...props}
      onClick={() => {
        const jsonString =
          item.parent == null
            ? renderResultAsJson((item as any).data, item.codec)
            : _renderToJson(
                item.type === ItemType.Scalar
                  ? (item.parent as any).data[item.index]
                  : item.data,
                item.codec,
                ""
              );

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
        <div className={styles.actions}>
          {state.openExtendedView &&
          item.type === ItemType.Scalar &&
          state.extendedViewIds?.has(item.codec.getKnownTypeName()) ? (
            <div
              className={styles.openExtendedButton}
              onClick={state.openExtendedView}
            >
              Open
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

function EllipsisIcon() {
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
