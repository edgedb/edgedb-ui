import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {observer} from "mobx-react";
import {VariableSizeGrid as Grid} from "react-window";

import cn from "@edgedb/common/utils/classNames";

import {useDragHandler, Position} from "@edgedb/common/hooks/useDragHandler";

import {renderValue} from "@edgedb/inspector/v2/buildScalar";
import inspectorStyles from "@edgedb/inspector/v2/inspector.module.scss";

import {useResize} from "src/hooks/useResize";
import {useInitialValue} from "src/hooks/useInitialValue";

import styles from "./dataInspector.module.scss";

import {
  DataInspector as DataInspectorState,
  ObjectField,
  ObjectFieldType,
  RowKind,
} from "../../state/models/dataview";

import {SortIcon, SortedAscIcon} from "./icons";
import {ChevronDownIcon} from "src/ui/icons";
import {InspectorRow} from "@edgedb/inspector/v2";

const DataInspectorContext = createContext<DataInspectorState | null>(null);

const useDataInspectorState = () => {
  return useContext(DataInspectorContext)!;
};

const RenderedRowsContext = createContext<[number, number]>([0, 0]);

const innerElementType = forwardRef<HTMLDivElement>(
  ({style, ...props}: any, ref) => (
    <div
      ref={ref}
      className={styles.innerContainer}
      style={{
        ...style,
        position: "relative",
      }}
      {...props}
    />
  )
);

const outerElementType = forwardRef<HTMLDivElement>(
  ({children, style, ...props}: any, ref) => (
    <div ref={ref} style={{...style, willChange: null}} {...props}>
      <FieldHeaders />
      <StickyCol />
      {children}
    </div>
  )
);

interface DataInspectorProps {
  state: DataInspectorState;
}

export default observer(function DataInspectorTable({
  state,
}: DataInspectorProps) {
  const gridContainer = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<[number, number]>([0, 0]);

  const gridRef = useRef<Grid>(null);

  const initialScrollOffset = useInitialValue(() => state.scrollPos);

  const [renderedRowIndexes, setRenderedRowIndexes] = useState<
    [number, number]
  >([0, 0]);

  useResize(gridContainer, ({width, height}) =>
    setContainerSize([width, height])
  );

  useEffect(() => {
    if (gridRef.current) {
      state.gridRef = gridRef.current;

      return () => {
        state.gridRef = null;
      };
    }
  }, [gridRef]);

  const rowIndexCharWidth = state.rowCount.toString().length;

  return (
    <DataInspectorContext.Provider value={state}>
      <RenderedRowsContext.Provider value={renderedRowIndexes}>
        <div
          ref={gridContainer}
          className={cn(styles.dataInspector, inspectorStyles.inspectorTheme)}
          style={{"--rowIndexCharWidth": rowIndexCharWidth} as any}
        >
          <Grid
            ref={gridRef}
            outerElementType={outerElementType}
            innerElementType={innerElementType}
            width={containerSize[0]}
            height={containerSize[1]}
            initialScrollTop={initialScrollOffset[0]}
            initialScrollLeft={initialScrollOffset[1]}
            onScroll={({scrollTop, scrollLeft}) => {
              state.setScrollPos([scrollTop, scrollLeft]);
            }}
            columnCount={state.fields?.length ?? 0}
            estimatedColumnWidth={180}
            columnWidth={(index) => state.fields![index].width}
            rowCount={state.gridRowCount}
            estimatedRowHeight={30}
            rowHeight={(rowIndex) =>
              state.getRowData(rowIndex).kind === RowKind.expanded ? 24 : 30
            }
            overscanRowCount={5}
            onItemsRendered={({
              overscanRowStartIndex,
              overscanRowStopIndex,
            }) => {
              setRenderedRowIndexes([
                overscanRowStartIndex,
                overscanRowStopIndex,
              ]);
              state.setVisibleRowIndexes(
                overscanRowStartIndex,
                overscanRowStopIndex
              );
            }}
          >
            {GridCell}
          </Grid>
        </div>
      </RenderedRowsContext.Provider>
    </DataInspectorContext.Provider>
  );
});

const GridCell = observer(function GridCell({
  columnIndex,
  rowIndex,
  style,
}: any) {
  const state = useDataInspectorState();

  const rowData = state.getRowData(rowIndex);

  if (rowData.kind !== RowKind.data) {
    return null;
  }

  const field = state.fields![columnIndex];

  const data = state.getData(rowData.index);

  const value = data?.[field.queryName];

  let content: JSX.Element | null = null;
  if (
    field.subtypeName &&
    data?.__tname__ &&
    data?.__tname__ !== field.subtypeName
  ) {
    content = <span className={styles.emptySubtypeField}>-</span>;
  } else if (value !== undefined) {
    if (field.type === ObjectFieldType.property) {
      const codec = state.dataCodecs?.[columnIndex];

      content = codec ? renderValue(value, codec, false).body : null;
    } else {
      const objs = Array.isArray(value) ? value : [value];
      const more = data![`__count_${field.queryName}`] - objs.length;

      content = (
        <>
          {objs.map((obj, i) => (
            <div className={styles.linkObjName} key={i}>
              {obj?.__tname__}
            </div>
          ))}
          {more > 0 ? (
            <div className={styles.moreLinks}>+{more} more</div>
          ) : null}
        </>
      );
    }
  }

  return (
    <div
      className={cn(styles.cell, {
        [styles.emptyCell]: !content,
        [styles.linksCell]: field.type === ObjectFieldType.link,
      })}
      style={style}
    >
      {content}
    </div>
  );
});

const FieldHeaders = observer(function FieldHeaders() {
  const state = useDataInspectorState();

  return (
    <div
      className={cn(styles.header, {
        [styles.hasSubtypeFields]: state.hasSubtypeFields,
      })}
    >
      <div className={styles.headerFieldWrapper}>
        {[...state.subtypeFieldRanges?.entries()].map(
          ([subtypeName, {left, width}]) => (
            <div
              key={subtypeName}
              className={styles.subtypeRangeHeader}
              style={{left, width}}
            >
              <div className={styles.subtypeLabel}>{subtypeName}</div>
            </div>
          )
        )}
        {state.fields?.map((field, i) => (
          <FieldHeader key={field.name} colIndex={i} field={field} />
        ))}
      </div>
    </div>
  );
});

interface FieldHeaderProps {
  colIndex: number;
  field: ObjectField;
}

const FieldHeader = observer(function FieldHeader({
  colIndex,
  field,
}: FieldHeaderProps) {
  const state = useDataInspectorState();

  const resizeHandler = useDragHandler(() => {
    let initialWidth: number;
    let initialPos: Position;

    return {
      onStart(initialMousePos: Position) {
        initialPos = initialMousePos;
        initialWidth = field.width;
      },
      onMove(currentMousePos: Position) {
        const xDelta = currentMousePos.x - initialPos.x;
        state.setFieldWidth(field, initialWidth + xDelta);
        state.gridRef?.resetAfterColumnIndex(colIndex);
      },
    };
  }, []);

  const sortDir =
    state.sortBy?.fieldIndex === colIndex && state.sortBy.direction;

  return (
    <div className={styles.headerField} style={{width: field.width + "px"}}>
      <div className={styles.fieldTitle}>
        <div className={styles.fieldName}>{field.name}</div>
        <div className={styles.fieldTypename}>{field.typename}</div>
      </div>

      {field.type === ObjectFieldType.property && field.name !== "id" ? (
        <div
          className={cn(styles.fieldSort, {
            [styles.fieldSortDesc]: sortDir === "DESC",
          })}
          onClick={() => state.setSortBy(colIndex)}
        >
          {sortDir ? <SortedAscIcon /> : <SortIcon />}
        </div>
      ) : null}

      <div className={styles.dragHandle} onMouseDown={resizeHandler} />
    </div>
  );
});

function StickyCol() {
  const [startIndex, endIndex] = useContext(RenderedRowsContext);

  return (
    <div className={styles.stickyCol}>
      {Array(endIndex - startIndex + 1)
        .fill(0)
        .map((_, i) => (
          <StickyRow key={startIndex + i} rowIndex={startIndex + i} />
        ))}
    </div>
  );
}

interface StickyRowProps {
  rowIndex: number;
}

const StickyRow = observer(function StickyRow({rowIndex}: StickyRowProps) {
  const state = useDataInspectorState();

  const rowData = state.getRowData(rowIndex);
  const style = (state.gridRef as any)?._getItemStyle(rowIndex, 0) ?? {};

  if (rowData.kind === RowKind.expanded) {
    const item = rowData.state.getItems()?.[rowData.index];

    return (
      <div className={styles.inspectorRow} style={{top: style.top}}>
        {item ? (
          <>
            <InspectorRow
              item={item}
              isExpanded={!!rowData.state.state.expanded?.has(item.id)}
              toggleExpanded={() => {
                rowData.state.toggleExpanded(rowData.index);
                state.gridRef?.resetAfterRowIndex(rowIndex);
              }}
            />
            {item.level === 2 &&
            rowData.state.linkFields.has(item.fieldName as string) ? (
              <div
                className={styles.viewInTableButton}
                onClick={() => rowData.state.openNestedView(item.fieldName!)}
              >
                View in Table
              </div>
            ) : null}
          </>
        ) : (
          <div>Loading...</div>
        )}
      </div>
    );
  } else {
    return (
      <div className={styles.rowIndex} style={{top: style.top}}>
        <div className={styles.cell}>{rowData.index + 1}</div>
        <div
          className={cn(styles.expandRow, {
            [styles.isExpanded]: state.expandedDataRowIndexes.has(
              rowData.index
            ),
          })}
          onClick={() => {
            state.toggleRowExpanded(rowData.index);
            state.gridRef?.resetAfterRowIndex(rowIndex);
          }}
        >
          <ChevronDownIcon />
        </div>
      </div>
    );
  }
});
