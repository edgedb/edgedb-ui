import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {observer} from "mobx-react";
import {VariableSizeGrid as Grid} from "react-window";

import cn from "@edgedb/common/utils/classNames";

import {useDragHandler, Position} from "@edgedb/common/hooks/useDragHandler";

import {renderValue} from "@edgedb/inspector/v2/buildScalar";
import inspectorStyles from "@edgedb/inspector/v2/inspector.module.scss";

import {useResize} from "@edgedb/common/hooks/useResize";
import {useInitialValue} from "@edgedb/common/hooks/useInitialValue";

import styles from "./dataInspector.module.scss";

import {
  DataInspector as DataInspectorState,
  ObjectField,
  ObjectFieldType,
  RowKind,
} from "./state";
import {DataEditingManager, UpdateLinkChangeKind} from "./state/edits";

import {SortIcon, SortedAscIcon} from "./icons";
import {ChevronDownIcon, DeleteIcon, UndeleteIcon} from "../../icons";
import {InspectorRow} from "@edgedb/inspector/v2";
import {DataEditor} from "./dataEditor";

const DataInspectorContext = createContext<{
  state: DataInspectorState;
  edits: DataEditingManager;
} | null>(null);

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
  edits: DataEditingManager;
}

export default observer(function DataInspectorTable({
  state,
  edits,
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

  useLayoutEffect(() => {
    const availableWidth = gridContainer.current?.clientWidth;
    if (!state.fieldWidthsUpdated && availableWidth && state.fields) {
      const newWidth = Math.min(
        Math.floor((availableWidth - 200) / state.fields.length),
        350
      );
      for (const field of state.fields) {
        state.setFieldWidth(field, newWidth);
      }
      gridRef.current?.resetAfterColumnIndex(0);
    }
  }, []);

  useEffect(() => {
    if (gridRef.current) {
      state.gridRef = gridRef.current;

      return () => {
        state.gridRef = null;
      };
    }
  }, [gridRef]);

  const rowIndexCharWidth = state.rowCount.toString().length;

  const rowInserts = edits.insertEdits.get(state.objectName);

  return (
    <DataInspectorContext.Provider value={{state, edits}}>
      <RenderedRowsContext.Provider value={renderedRowIndexes}>
        <div
          ref={gridContainer}
          className={cn(styles.dataInspector, inspectorStyles.inspectorTheme, {
            [styles.editMode]: !!state.parentObject?.editMode,
          })}
          style={
            {
              "--rowIndexCharWidth": rowIndexCharWidth,
              "--gridWidth":
                (state.fields?.reduce((sum, f) => sum + f.width, 0) ?? 0) +
                "px",
            } as any
          }
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
            rowCount={state.gridRowCount + (rowInserts?.size ?? 0)}
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

const inspectorOverrideStyles = {
  uuid: styles.scalar_uuid,
};

const GridCell = observer(function GridCell({
  columnIndex,
  rowIndex,
  style,
}: any) {
  const {state, edits} = useDataInspectorState();

  const rowData = state.getRowData(
    rowIndex - (edits.insertEdits.get(state.objectName)?.size ?? 0)
  );

  if (rowData.kind !== RowKind.data) {
    return null;
  }

  const field = state.fields![columnIndex];
  const data = state.getData(rowData.index);

  const isDeletedRow = edits.deleteEdits.has(data?.id);

  const cellEditState = edits.propertyEdits.get(`${data?.id}__${field.name}`);
  const linkEditState = edits.linkEdits.get(`${data?.id}__${field.name}`);

  if (
    !isDeletedRow &&
    cellEditState &&
    cellEditState === edits.activePropertyEdit
  ) {
    return (
      <DataEditor
        value={cellEditState.value}
        onChange={(val) => edits.updateCellEdit(cellEditState, val)}
        onClose={() => edits.finishEditingCell()}
        style={style}
      />
    );
  }

  const value = data?.[field.queryName];

  const isEmptySubtype =
    field.subtypeName &&
    data?.__tname__ &&
    data?.__tname__ !== field.subtypeName;

  let content: JSX.Element | null = null;
  let knownTypename: string | null = null;
  if (isEmptySubtype) {
    content = <span className={styles.emptySubtypeField}>-</span>;
  } else if (value !== undefined) {
    if (field.type === ObjectFieldType.property) {
      const codec = state.dataCodecs?.[columnIndex];

      if (codec) {
        knownTypename = codec.getKnownTypeName();
        content = codec
          ? renderValue(
              cellEditState?.value ?? value,
              codec,
              false,
              inspectorOverrideStyles
            ).body
          : null;
      }
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

  const isEditable =
    field.type === ObjectFieldType.link || knownTypename === "std::str";

  return (
    <div
      className={cn(styles.cell, {
        [styles.emptyCell]: !content,
        [styles.isDeleted]: isDeletedRow,
        [styles.linksCell]: field.type === ObjectFieldType.link,
        [styles.editableCell]: !isDeletedRow && isEditable,
        [styles.hasEdits]:
          !isDeletedRow && (!!cellEditState || !!linkEditState),
      })}
      style={style}
      onDoubleClick={() => {
        if (isEditable) {
          if (field.type === ObjectFieldType.property) {
            edits.startEditingCell(data.id, data.__tname__, field.name, value);
          } else {
            state.openNestedView(data.id, data.__tname__, field.name);
          }
        }
      }}
    >
      {content}
    </div>
  );
});

const FieldHeaders = observer(function FieldHeaders() {
  const {state} = useDataInspectorState();

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
  const {state} = useDataInspectorState();

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
      {Array(Math.min(endIndex - startIndex + 1))
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
  const {state, edits} = useDataInspectorState();

  const style = (state.gridRef as any)?._getItemStyle(rowIndex, 0) ?? {};

  const rowDataIndex =
    rowIndex - (edits.insertEdits.get(state.objectName)?.size ?? 0);

  if (rowDataIndex < 0) {
    return null;
  }

  const rowData = state.getRowData(rowDataIndex);

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
                onClick={() =>
                  state.openNestedView(
                    rowData.state.objectId,
                    rowData.state.objectType,
                    item.fieldName!
                  )
                }
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
    if (rowData.index >= state.rowCount) return null;

    const data = state.getData(rowData.index);

    const isDeletedRow = data != null && edits.deleteEdits.has(data.id);

    const editedLinkChange =
      state.parentObject?.editMode &&
      edits.linkEdits
        .get(`${state.parentObject.id}__${state.parentObject.fieldName}`)
        ?.changes.get(data?.id);

    return (
      <>
        <div
          className={cn(styles.rowIndex, {
            [styles.hasLinkEdit]: !!editedLinkChange,
          })}
          style={{top: style.top}}
        >
          <div className={styles.rowActions}>
            {data ? (
              <>
                <div
                  className={styles.deleteRowAction}
                  onClick={() => {
                    edits.toggleRowDelete(data.id, data.__tname__);
                    if (state.expandedInspectors.has(data.id)) {
                      state.toggleRowExpanded(rowDataIndex);
                    }
                  }}
                >
                  {isDeletedRow ? <UndeleteIcon /> : <DeleteIcon />}
                </div>
                {state.parentObject?.editMode ? (
                  <label className={styles.selectLinkAction}>
                    <input
                      type={
                        state.parentObject.isMultiLink ? "checkbox" : "radio"
                      }
                      checked={
                        editedLinkChange
                          ? editedLinkChange.kind === UpdateLinkChangeKind.Add
                          : data.__isLinked
                      }
                      onChange={() => {
                        if (editedLinkChange) {
                          edits.removeLinkUpdate(
                            state.parentObject!.id,
                            state.parentObject!.fieldName,
                            data.id
                          );
                        } else {
                          edits.addLinkUpdate(
                            state.parentObject!.id,
                            state.parentObject!.objectType,
                            state.parentObject!.fieldName,
                            data.__isLinked
                              ? UpdateLinkChangeKind.Remove
                              : UpdateLinkChangeKind.Add,
                            data.id
                          );
                        }
                      }}
                    />
                  </label>
                ) : null}
              </>
            ) : null}
          </div>
          <div className={styles.cell}>{rowData.index + 1}</div>
          <div
            className={cn(styles.expandRow, {
              [styles.isExpanded]: state.expandedDataRowIndexes.has(
                rowData.index
              ),
              [styles.isHidden]: isDeletedRow,
            })}
            onClick={() => {
              state.toggleRowExpanded(rowData.index);
              state.gridRef?.resetAfterRowIndex(rowIndex);
            }}
          >
            <ChevronDownIcon />
          </div>
        </div>
        {isDeletedRow ? (
          <div
            className={styles.deletedRowStrikethrough}
            style={{top: style.top}}
          />
        ) : null}
      </>
    );
  }
});
