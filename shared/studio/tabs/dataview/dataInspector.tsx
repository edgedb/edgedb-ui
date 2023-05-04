import {
  createContext,
  forwardRef,
  Fragment,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {observer} from "mobx-react";
import {VariableSizeGrid as Grid} from "react-window";

import {ICodec} from "edgedb/dist/codecs/ifaces";
import {EnumCodec} from "edgedb/dist/codecs/enum";
import {NamedTupleCodec} from "edgedb/dist/codecs/namedtuple";
import {RangeCodec} from "edgedb/dist/codecs/range";

import cn from "@edgedb/common/utils/classNames";

import {useDragHandler, Position} from "@edgedb/common/hooks/useDragHandler";

import {InspectorRow} from "@edgedb/inspector";
import {renderValue} from "@edgedb/inspector/buildScalar";
import inspectorStyles from "@edgedb/inspector/inspector.module.scss";

import {useResize} from "@edgedb/common/hooks/useResize";
import {useInitialValue} from "@edgedb/common/hooks/useInitialValue";

import styles from "./dataInspector.module.scss";

import {
  DataInspector as DataInspectorState,
  DataRowData,
  ExpandedRowData,
  ObjectField,
  ObjectFieldType,
  RowKind,
} from "./state";
import {DataEditingManager, UpdateLinkChangeKind} from "./state/edits";

import {useDBRouter} from "../../hooks/dbRoute";

import {SortIcon, SortedDescIcon} from "./icons";
import {
  ChevronDownIcon,
  DeleteIcon,
  UndeleteIcon,
  UndoChangesIcon,
  WarningIcon,
} from "../../icons";
import {DataEditor, PrimitiveType} from "../../components/dataEditor";
import {CustomScrollbars} from "@edgedb/common/ui/customScrollbar";

const DataInspectorContext = createContext<{
  state: DataInspectorState;
  edits: DataEditingManager;
} | null>(null);

const useDataInspectorState = () => {
  return useContext(DataInspectorContext)!;
};

const innerElementType = forwardRef<HTMLDivElement>(
  ({style, ...props}: any, ref) => {
    const {state} = useDataInspectorState();

    return (
      <div
        ref={ref}
        className={styles.innerContainer}
        style={{
          ...style,
          position: "relative",
        }}
        onMouseLeave={() => {
          state.setHoverRowIndex(null);
        }}
        {...props}
      />
    );
  }
);

const outerElementType = forwardRef<HTMLDivElement>(
  ({children, style, ...props}: any, ref) => (
    <div ref={ref} style={{...style, willChange: null}} {...props}>
      <div className={styles.gridInner}>
        <FieldHeaders />
        <StickyCol />
        {children}
      </div>
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
      state.setInitialFieldWidths(newWidth);
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

  const rowIndexCharWidth = (state.rowCount ?? 0).toString().length;

  return (
    <DataInspectorContext.Provider value={{state, edits}}>
      <div
        ref={gridContainer}
        className={cn(styles.dataInspector, inspectorStyles.inspectorTheme, {
          [styles.editMode]: !!state.parentObject?.editMode,
        })}
        style={
          {
            "--rowIndexCharWidth": rowIndexCharWidth,
            "--gridWidth":
              (state.fieldWidths?.reduce((sum, width) => sum + width, 0) ??
                0) + "px",
            "--gridBottomPadding":
              containerSize[1] -
              (state.hasSubtypeFields ? 64 : 48) -
              40 +
              "px",
          } as any
        }
      >
        <CustomScrollbars
          innerClass={styles.gridInner}
          headerPadding={state.hasSubtypeFields ? 64 : 48}
        >
          <Grid
            ref={gridRef}
            className={styles.gridScrollContainer}
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
            columnWidth={(index) => state.fieldWidths![index]}
            rowCount={state.gridRowCount}
            estimatedRowHeight={40}
            rowHeight={(rowIndex) =>
              state.getRowData(rowIndex - state.insertedRows.length).kind ===
              RowKind.expanded
                ? 28
                : 40
            }
            overscanRowCount={5}
            onItemsRendered={({
              overscanRowStartIndex,
              overscanRowStopIndex,
            }) => {
              state.setVisibleRowIndexes(
                overscanRowStartIndex,
                overscanRowStopIndex
              );
            }}
          >
            {GridCellWrapper}
          </Grid>
        </CustomScrollbars>
      </div>
    </DataInspectorContext.Provider>
  );
});

const inspectorOverrideStyles = {
  uuid: styles.scalar_uuid,
};

function GridCellWrapper({
  columnIndex,
  rowIndex,
  style,
}: {
  columnIndex: number;
  rowIndex: number;
  style: any;
}) {
  const {state} = useDataInspectorState();

  return (
    <div
      className={styles.cellWrapper}
      style={style}
      onMouseEnter={() => state.setHoverRowIndex(rowIndex)}
    >
      <GridCell columnIndex={columnIndex} rowIndex={rowIndex} />
    </div>
  );
}

function renderCellValue(value: any, codec: ICodec): JSX.Element {
  switch (codec.getKind()) {
    case "scalar":
    case "range":
      return renderValue(
        value,
        codec.getKnownTypeName(),
        codec instanceof EnumCodec,
        codec instanceof RangeCodec
          ? codec.getSubcodecs()[0].getKnownTypeName()
          : undefined,
        false,
        inspectorOverrideStyles,
        100
      ).body;
    case "set":
      return (
        <>
          {"{"}
          {(value as any[]).map((item, i) => (
            <Fragment key={i}>
              {i !== 0 ? ", " : null}
              {renderCellValue(item, codec.getSubcodecs()[0])}
            </Fragment>
          ))}
          {"}"}
        </>
      );
    case "array":
      return (
        <>
          [
          {(value as any[]).map((item, i) => (
            <Fragment key={i}>
              {i !== 0 ? ", " : null}
              {renderCellValue(item, codec.getSubcodecs()[0])}
            </Fragment>
          ))}
          ]
        </>
      );
    case "tuple":
      return (
        <>
          (
          {(value as any[]).map((item, i) => (
            <Fragment key={i}>
              {i !== 0 ? ", " : null}
              {renderCellValue(item, codec.getSubcodecs()[i])}
            </Fragment>
          ))}
          )
        </>
      );
    case "namedtuple": {
      const fieldNames = (codec as NamedTupleCodec).getNames();
      const subCodecs = codec.getSubcodecs();
      return (
        <>
          (
          {fieldNames.map((name, i) => (
            <Fragment key={i}>
              {i !== 0 ? ", " : null}
              {name}
              {" := "}
              {renderCellValue(value[name], subCodecs[i])}
            </Fragment>
          ))}
          )
        </>
      );
    }
    default:
      return <></>;
  }
}

const GridCell = observer(function GridCell({
  columnIndex,
  rowIndex,
}: {
  columnIndex: number;
  rowIndex: number;
}) {
  const {state, edits} = useDataInspectorState();
  const {navigate, currentPath} = useDBRouter();
  const basePath = currentPath.join("/");

  const rowDataIndex = rowIndex - state.insertedRows.length;

  const rowData = rowDataIndex >= 0 ? state.getRowData(rowDataIndex) : null;

  if (rowData && rowData.kind !== RowKind.data) {
    return null;
  }

  const field = state.fields![columnIndex];
  const insertedRow = !rowData ? state.insertedRows[rowIndex] : null;

  const data = rowData ? state.getData(rowData.index) : insertedRow!.data;

  const isDeletedRow = edits.deleteEdits.has(data?.id);

  const cellId = `${data?.id}__${field.name}`;

  const cellEditState = edits.propertyEdits.get(cellId);
  const linkEditState = edits.linkEdits.get(cellId);

  const editedLink =
    state.parentObject && edits.linkEdits.get(state.parentObject.linkId);
  const editedLinkChange = editedLink?.changes.get(data?.id);

  const value =
    cellEditState?.value !== undefined
      ? cellEditState.value
      : data?.[rowData ? field.queryName : field.name] ?? null;

  const isEmptySubtype =
    field.subtypeName &&
    data?.__tname__ &&
    data?.__tname__ !== field.subtypeName;

  if (
    !isDeletedRow &&
    !isEmptySubtype &&
    field.type === ObjectFieldType.property &&
    edits.activePropertyEditId === cellId
  ) {
    return cellEditState?.value === undefined &&
      field.schemaType.name === "std::str" &&
      value?.length === 100 &&
      !state.fullyFetchedData.has(cellId) ? (
      <FetchingDataPlaceholder state={state} data={data} field={field} />
    ) : (
      <DataEditor
        type={field.schemaType as PrimitiveType}
        isRequired={field.required}
        isMulti={field.multi}
        value={
          cellEditState?.value === undefined
            ? state.fullyFetchedData.get(cellId) ?? value
            : value
        }
        onChange={(val) =>
          edits.updateCellEdit(data?.id, data.__tname__, field.name, val)
        }
        onClose={() => edits.finishEditingCell()}
      />
    );
  }

  let content: JSX.Element | null = null;
  let selectable = false;
  if (isEmptySubtype) {
    content = <span className={styles.emptySubtypeField}>-</span>;
  } else if (data) {
    if (field.type === ObjectFieldType.property) {
      const undoEdit =
        !isDeletedRow && !!cellEditState ? (
          <div
            className={styles.undoCellChanges}
            onClick={() => edits.clearPropertyEdit(data?.id, field.name)}
          >
            <UndoChangesIcon />
          </div>
        ) : null;

      if ((!rowData && field.name === "id") || value === null) {
        content = (
          <>
            <span className={styles.emptySet}>
              {(!rowData ? field.default ?? field.computedExpr : null) ?? "{}"}
            </span>
            {undoEdit}
          </>
        );
      } else {
        const codec = state.dataCodecs?.[columnIndex];
        if (codec) {
          content = (
            <>
              {renderCellValue(cellEditState?.value ?? value, codec)}
              {undoEdit}
            </>
          );
          selectable = true;
        }
      }
    } else {
      const countData = data?.[`__count_${field.queryName}`];
      if (countData !== null || insertedRow) {
        const counts: {[typename: string]: number} =
          field.multi || !linkEditState
            ? countData?.reduce((counts: any, {typename, count}: any) => {
                counts[typename] = count;
                return counts;
              }, {}) ?? {}
            : {};

        if (linkEditState) {
          for (const change of linkEditState.changes.values()) {
            counts[change.typename] =
              change.kind === UpdateLinkChangeKind.Set
                ? 1
                : (counts[change.typename] ?? 0) +
                  (change.kind === UpdateLinkChangeKind.Add ? 1 : -1);
          }
          for (const insert of linkEditState.inserts.values()) {
            counts[insert.objectTypeName] =
              (counts[insert.objectTypeName] ?? 0) + 1;
          }
        }

        if (Object.keys(counts).length === 0) {
          content = (
            <span className={styles.emptySet}>
              {field.required && !insertedRow
                ? "hidden by access policy"
                : "{}"}
            </span>
          );
        } else {
          content = (
            <div className={styles.linksCell}>
              {Object.entries(counts).map(([typename, count], i) => (
                <div className={styles.linkObjName} key={i}>
                  {typename}
                  <span>{count}</span>
                </div>
              ))}
            </div>
          );
        }
      }
    }
  }

  const isEditable =
    !isEmptySubtype &&
    !field.computedExpr &&
    (!field.readonly || !rowData) &&
    data &&
    (field.type === ObjectFieldType.link || field.name !== "id");

  return (
    <div
      className={cn(styles.cell, {
        [styles.selectable]: selectable,
        [styles.loadingCell]: !data,
        [styles.isDeleted]:
          isDeletedRow ||
          editedLinkChange?.kind === UpdateLinkChangeKind.Remove ||
          (!state.parentObject?.isMultiLink &&
            !!editedLink &&
            (state.parentObject?.editMode
              ? !!data?.__isLinked
              : !editedLinkChange)),
        [styles.editableCell]:
          !isDeletedRow &&
          isEditable &&
          field.type === ObjectFieldType.property,
        [styles.linkCell]: field.type === ObjectFieldType.link,
        [styles.hasEdits]:
          !isDeletedRow && rowData && (!!cellEditState || !!linkEditState),
        [styles.hasErrors]:
          !rowData &&
          isEditable &&
          field.required &&
          !field.hasDefault &&
          value === null &&
          !linkEditState,
      })}
      onClick={() => {
        if (field.type === ObjectFieldType.link && content !== null) {
          state.openNestedView(
            basePath,
            navigate,
            data.id,
            data.__tname__,
            field
          );
        }
      }}
      onDoubleClick={() => {
        if (isEditable) {
          if (field.type === ObjectFieldType.property) {
            edits.startEditingCell(data.id, field.name);
          } else {
            state.openNestedView(
              basePath,
              navigate,
              data.id,
              data.__tname__,
              field,
              true
            );
          }
        }
      }}
    >
      {content}
    </div>
  );
});

function FetchingDataPlaceholder({
  state,
  data,
  field,
}: {
  state: DataInspectorState;
  data: any;
  field: ObjectField;
}) {
  useEffect(() => {
    state.fetchFullCellData(data.id, field);
  }, []);

  return <div className={styles.fetchingDataPlaceholder}>loading...</div>;
}

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
          <FieldHeader
            key={field.queryName}
            colIndex={i}
            field={field}
            isOmitted={state.omittedLinks.has(field.name)}
          />
        ))}
      </div>
    </div>
  );
});

interface FieldHeaderProps {
  colIndex: number;
  field: ObjectField;
  isOmitted: boolean;
}

const FieldHeader = observer(function FieldHeader({
  colIndex,
  field,
  isOmitted,
}: FieldHeaderProps) {
  const {state} = useDataInspectorState();
  const fieldWidth = state.fieldWidths[colIndex];

  const resizeHandler = useDragHandler(() => {
    let initialWidth: number;
    let initialPos: Position;

    return {
      onStart(initialMousePos: Position) {
        initialPos = initialMousePos;
        initialWidth = state.fieldWidths[colIndex];
      },
      onMove(currentMousePos: Position) {
        const xDelta = currentMousePos.x - initialPos.x;
        state.setFieldWidth(colIndex, initialWidth + xDelta);
        state.gridRef?.resetAfterColumnIndex(colIndex);
      },
    };
  }, []);

  const sortDir =
    state.sortBy?.fieldIndex === colIndex && state.sortBy.direction;

  return (
    <div className={styles.headerField} style={{width: fieldWidth + "px"}}>
      {isOmitted ? (
        <div className={styles.fieldWarning}>
          <WarningIcon />
          <div>
            Cannot fetch link data: target of required link is hidden by access
            policy
          </div>
        </div>
      ) : null}
      <div className={styles.fieldTitle}>
        <div className={styles.fieldName}>
          {field.name}
          {field.computedExpr ? <span>:=</span> : null}
        </div>
        <div className={styles.fieldTypename}>
          {field.multi ? "multi " : ""}
          {field.typename}
        </div>
      </div>

      {field.type === ObjectFieldType.property && field.name !== "id" ? (
        <div
          className={cn(styles.fieldSort, {
            [styles.fieldSorted]: !!sortDir,
            [styles.fieldSortAsc]: sortDir === "ASC",
          })}
          onClick={() => state.setSortBy(colIndex)}
        >
          {sortDir ? <SortedDescIcon /> : <SortIcon />}
        </div>
      ) : null}

      <div className={styles.dragHandle} onMouseDown={resizeHandler} />
    </div>
  );
});

const StickyCol = observer(function StickyCol() {
  const {state} = useDataInspectorState();
  const [startIndex, endIndex] = state.visibleIndexes;

  return (
    <div className={styles.stickyCol}>
      {Array(Math.min(endIndex - startIndex + 1))
        .fill(0)
        .map((_, i) => (
          <StickyRow key={startIndex + i} rowIndex={startIndex + i} />
        ))}
    </div>
  );
});

interface StickyRowProps {
  rowIndex: number;
}

const StickyRow = observer(function StickyRow({rowIndex}: StickyRowProps) {
  const {state, edits} = useDataInspectorState();

  const style = (state.gridRef as any)?._getItemStyle(rowIndex, 0) ?? {};

  const rowDataIndex = rowIndex - state.insertedRows.length;
  const rowData = rowDataIndex >= 0 ? state.getRowData(rowDataIndex) : null;

  if (rowData?.kind === RowKind.expanded) {
    return <ExpandedDataInspector rowData={rowData} styleTop={style.top} />;
  } else {
    return (
      <DataRowIndex
        rowIndex={rowIndex}
        dataIndex={rowData?.index ?? null}
        styleTop={style.top}
        active={state.hoverRowIndex === rowIndex}
      />
    );
  }
});

const DataRowIndex = observer(function DataRowIndex({
  rowIndex,
  dataIndex,
  styleTop,
  active,
}: {
  rowIndex: number;
  dataIndex: number | null;
  styleTop: any;
  active: boolean;
}) {
  const {state, edits} = useDataInspectorState();

  if (dataIndex !== null && dataIndex >= (state.rowCount ?? 0)) return null;

  const rowDataIndex = rowIndex - state.insertedRows.length;

  const data = dataIndex !== null && state.getData(dataIndex);

  const isDeletedRow = data != null && edits.deleteEdits.has(data.id);

  const editedLink =
    state.parentObject && edits.linkEdits.get(state.parentObject.linkId);

  const editedLinkChange = editedLink?.changes.get(data?.id);

  const hasLinkEdit = state.parentObject?.editMode
    ? !!editedLinkChange ||
      (!state.parentObject?.isMultiLink &&
        editedLink != null &&
        !!data?.__isLinked)
    : state.parentObject?.isMultiLink
    ? !!editedLinkChange
    : !!editedLink;

  let rowAction: JSX.Element | null = null;
  if (dataIndex === null || data) {
    if (state.parentObject?.editMode) {
      let input: JSX.Element;
      if (state.parentObject.isMultiLink) {
        input = (
          <input
            type="checkbox"
            checked={
              dataIndex !== null
                ? editedLinkChange
                  ? editedLinkChange.kind === UpdateLinkChangeKind.Add
                  : data.__isLinked
                : editedLink?.inserts.has(state.insertedRows[rowIndex]) ??
                  false
            }
            onChange={() => {
              if (dataIndex !== null) {
                if (editedLinkChange) {
                  edits.removeLinkUpdate(
                    state.parentObject!.id,
                    state.parentObject!.fieldName,
                    data.id
                  );
                } else {
                  edits.addLinkUpdate(
                    state.parentObject!.id!,
                    state.parentObject!.subtypeName ??
                      state.parentObject!.objectTypeName,
                    state.parentObject!.fieldName,
                    state.objectType!,
                    data.__isLinked
                      ? UpdateLinkChangeKind.Remove
                      : UpdateLinkChangeKind.Add,
                    data.id,
                    data.__tname__
                  );
                }
              } else {
                edits.toggleLinkInsert(
                  state.parentObject!.id!,
                  state.parentObject!.subtypeName ??
                    state.parentObject!.objectTypeName,
                  state.parentObject!.fieldName,
                  state.objectType!,
                  state.insertedRows[rowIndex]
                );
              }
            }}
          />
        );
      } else {
        const checked = editedLink?.setNull
          ? false
          : dataIndex !== null
          ? editedLink
            ? editedLink.changes.has(data.id)
            : data.__isLinked
          : editedLink?.inserts.has(state.insertedRows[rowIndex]) ?? false;
        const sharedArgs = [
          state.parentObject!.id!,
          state.parentObject!.subtypeName ??
            state.parentObject!.objectTypeName,
          state.parentObject!.fieldName,
          state.objectType!,
        ] as const;
        input = (
          <input
            className={styles.isRadio}
            type="checkbox"
            checked={checked}
            onChange={() => {
              if (checked) {
                edits.setLinkNull(...sharedArgs);
              } else {
                if (dataIndex !== null) {
                  if (data.__isLinked) {
                    edits.clearLinkEdits(state.parentObject!.linkId);
                  } else {
                    edits.addLinkUpdate(
                      ...sharedArgs,
                      UpdateLinkChangeKind.Set,
                      data.id,
                      data.__tname__
                    );
                  }
                } else {
                  edits.toggleLinkInsert(
                    ...sharedArgs,
                    state.insertedRows[rowIndex],
                    true
                  );
                }
              }
            }}
          />
        );
      }

      rowAction = <label className={styles.selectLinkAction}>{input}</label>;
    } else {
      rowAction = (
        <div
          className={styles.deleteRowAction}
          onClick={() => {
            if (dataIndex !== null) {
              edits.toggleRowDelete(data.id, data.__tname__);
              if (state.expandedInspectors.has(data.id)) {
                state.toggleRowExpanded(rowDataIndex);
              }
            } else {
              edits.removeInsertedRow(state.insertedRows[rowIndex]);
            }
          }}
        >
          {isDeletedRow ? <UndeleteIcon /> : <DeleteIcon />}
        </div>
      );
    }
  }

  return (
    <>
      <div
        className={cn(styles.rowIndex, {
          [styles.active]: active,
          [styles.hasLinkEdit]: hasLinkEdit || dataIndex === null,
        })}
        style={{top: styleTop}}
        onMouseEnter={() => state.setHoverRowIndex(rowIndex)}
      >
        <div className={styles.rowActions}>{rowAction}</div>
        <div className={styles.cell}>
          {dataIndex !== null ? dataIndex + 1 : null}
        </div>
        {dataIndex !== null ? (
          <div
            className={cn(styles.expandRow, {
              [styles.isExpanded]: state.expandedDataRowIndexes.has(dataIndex),
              [styles.isHidden]: isDeletedRow,
            })}
            onClick={() => {
              state.toggleRowExpanded(dataIndex);
              state.gridRef?.resetAfterRowIndex(rowIndex);
            }}
          >
            <ChevronDownIcon />
          </div>
        ) : null}
      </div>
      <div
        className={cn(styles.rowHoverBg, {
          [styles.active]: active,
        })}
        style={{top: styleTop}}
        onMouseEnter={() => state.setHoverRowIndex(rowIndex)}
      />
      {isDeletedRow ? (
        <div
          className={styles.deletedRowStrikethrough}
          style={{top: styleTop}}
        />
      ) : null}
    </>
  );
});

const ExpandedDataInspector = observer(function ExpandedDataInspector({
  rowData,
  styleTop,
}: {
  rowData: ExpandedRowData;
  styleTop: any;
}) {
  const {state} = useDataInspectorState();
  const {navigate, currentPath} = useDBRouter();
  const basePath = currentPath.join("/");
  const item = rowData.state.getItems()?.[rowData.index];

  return (
    <div className={styles.inspectorRow} style={{top: styleTop}}>
      {item ? (
        <>
          <InspectorRow
            item={item}
            state={rowData.state.state}
            isExpanded={!!rowData.state.state.expanded?.has(item.id)}
            toggleExpanded={() => {
              rowData.state.toggleExpanded(rowData.index);
            }}
            disableCopy
          />
          {item.level === 2 &&
          rowData.state.linkFields.has(item.fieldName as string) ? (
            <div
              className={styles.viewInTableButton}
              onClick={() =>
                state.openNestedView(
                  basePath,
                  navigate,
                  rowData.state.objectId,
                  rowData.state.objectTypeName,
                  state.fields!.find((field) => field.name === item.fieldName)!
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
});
