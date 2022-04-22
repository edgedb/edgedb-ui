import React from "react";
import {observer} from "mobx-react";
import {VariableSizeList as List, ListChildComponentProps} from "react-window";
import {_ICodec} from "edgedb";

import cn from "@edgedb/common/utils/classNames";

import {InspectorState, Item} from "./state";
import {InspectorContext, useInspectorState} from "./context";

import styles from "./inspector.module.scss";
import {ItemType} from "./buildItem";

interface InspectorProps extends RowListProps {
  state: InspectorState;
}

export default function Inspector({state, ...rowProps}: InspectorProps) {
  return (
    <InspectorContext.Provider value={state}>
      <RowList {...rowProps} />
    </InspectorContext.Provider>
  );
}

interface RowListProps {
  className?: string;
  rowHeight?: number;
  lineHeight?: number;
  maxHeight?: number;
  disableVirtualisedRendering?: boolean;
}

const RowList = observer(function RowList({
  className,
  rowHeight = 24,
  lineHeight = 24,
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
          <Row index={i} style={{}} data={items} key={i} />
        ))}
      </div>
    );
  } else {
    const itemSize = (index: number) =>
      (items[index].height ?? 1) * lineHeight + vPad;

    let height = 0;
    for (let i = 0; i < items.length; i++) {
      height += itemSize(i);
      if (height > maxHeight) {
        height = maxHeight;
        break;
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
}: ListChildComponentProps<Item[]>) {
  const state = useInspectorState();

  const item = data[index];

  const isExpanded = state.expanded!.has(item.id);

  return (
    <InspectorRow
      item={item}
      style={style}
      isExpanded={isExpanded}
      toggleExpanded={() => {
        isExpanded ? state.collapseItem(index) : state.expandItem(index);
      }}
    />
  );
});

interface InspectorRowProps {
  item: Item;
  style?: React.CSSProperties;
  className?: string;
  isExpanded: boolean;
  toggleExpanded: () => void;
}

export function InspectorRow({
  item,
  className,
  isExpanded,
  toggleExpanded,
  style,
}: InspectorRowProps) {
  const expandableItem =
    item.type !== ItemType.Scalar && item.type !== ItemType.Other;

  return (
    <div
      className={cn(styles.rowItem, className)}
      style={{
        ...style,
        paddingLeft: `${(item.level + 1) * 2}ch`,
      }}
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
      {item.label}
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
  );
}

function ExpandArrowIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
    >
      <path d="M0 0h24v24H0z" fill="none" />
      <path fill="currentColor" d="M10 17l5-5-5-5v10z" />
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
      <circle fill="currentColor" cx="8" cy="12" r="1"></circle>
      <circle fill="currentColor" cx="12" cy="12" r="1"></circle>
      <circle fill="currentColor" cx="16" cy="12" r="1"></circle>
    </svg>
  );
}
