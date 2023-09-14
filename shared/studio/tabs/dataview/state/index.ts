import {
  computed,
  observable,
  action,
  when,
  reaction,
  autorun,
  runInAction,
} from "mobx";
import {
  model,
  Model,
  modelAction,
  modelFlow,
  prop,
  _async,
  _await,
  findParent,
  objectMap,
  idProp,
} from "mobx-keystone";

import {VariableSizeGrid as Grid} from "react-window";

import {NavigateFunction} from "../../../hooks/dbRoute";

import {Text} from "@codemirror/state";

import {CardinalityViolationError, _ICodec} from "edgedb";
import {ObjectCodec} from "edgedb/dist/codecs/object";

import {EdgeDBSet} from "../../../utils/decodeRawBuffer";

import {ObservableLRU} from "../../../state/utils/lru";

import {
  SchemaLink,
  SchemaProperty,
  SchemaType,
} from "@edgedb/common/schemaData";
import {resolveObjectTypeUnion} from "@edgedb/common/schemaData/utils";

import {InspectorState, resultGetterCtx} from "@edgedb/inspector/state";

import {dbCtx, connCtx} from "../../../state";
import {DataEditingManager, UpdateLinkChangeKind} from "./edits";
import {sessionStateCtx} from "../../../state/sessionState";

const fetchBlockSize = 100;

type ParentObject = {
  editMode: boolean;
  objectTypeId: string;
  objectTypeName: string;
  subtypeName?: string;
  id: string | number;
  fieldName: string;
  escapedFieldName: string;
  linkId: string;
  isMultiLink: boolean;
  isComputedLink: boolean;
};

@model("DataView")
export class DataView extends Model({
  inspectorStack: prop<DataInspector[]>(() => []),

  edits: prop(() => new DataEditingManager({})),
  showSubtypeFields: prop(() => false).withSetter(),
}) {
  lastSelectedPath: string = "";

  @computed
  get objectTypes() {
    const objects = dbCtx.get(this)!.schemaData?.objects;
    return objects
      ? [...objects.values()].filter(
          (obj) =>
            !obj.builtin && !obj.unionOf && !obj.insectionOf && !obj.from_alias
        )
      : [];
  }

  onAttachedToRootStore() {
    return reaction(
      () => dbCtx.get(this)!.schemaData,
      () => {
        this.edits.cleanupPendingEdits();
      }
    );
  }

  @modelAction
  selectObject(objectTypeId: string | undefined) {
    this.inspectorStack = objectTypeId
      ? [new DataInspector({objectTypeId})]
      : [];
  }

  @modelAction
  openNestedView(objectTypeId: string, parentObject: ParentObject) {
    this.inspectorStack.push(new DataInspector({objectTypeId, parentObject}));
  }

  @modelAction
  closeLastNestedView() {
    this.inspectorStack.pop();
  }

  @modelAction
  closeAllNestedViews() {
    this.inspectorStack = this.inspectorStack.slice(0, 1);
  }

  refreshAllViews() {
    for (const view of [...this.inspectorStack].reverse()) {
      view._refreshData(true);
    }
  }

  @modelAction
  updateFromPath(path: string): string | null {
    this.lastSelectedPath = path;
    const [rootObjectTypeName, ...nestedParts] = path.split("/");
    if (rootObjectTypeName !== this.inspectorStack[0]?.objectType?.name) {
      const objTypeId = this.objectTypes.find(
        (obj) => obj.name === rootObjectTypeName
      )?.id;
      if (objTypeId) {
        this.selectObject(objTypeId);
      } else {
        this.selectObject(this.objectTypes[0]?.id);
        return this.objectTypes[0]?.name ?? "";
      }
    }
    let i = 0;
    let parentSchemaObject = dbCtx
      .get(this)!
      .schemaData!.objectsByName.get(rootObjectTypeName)!;
    const depth = Math.floor(nestedParts.length / 2);
    while (i < depth) {
      let objId: string | number = nestedParts[i * 2];
      let pointerName = nestedParts[i * 2 + 1];
      let subtypeName: undefined | string = undefined;

      if (!/^[0-9a-fA-F]{32}$/.test(objId.replace(/-/g, ""))) {
        objId = parseInt(objId);
      }
      if (pointerName.startsWith("[")) {
        [subtypeName, pointerName] = pointerName.slice(1).split("]");
      }

      const stackItem = this.inspectorStack[i + 1];
      const pointers = subtypeName
        ? (parentSchemaObject.unionOf ?? parentSchemaObject.descendents).find(
            (desc) => desc.name === subtypeName
          )?.pointers
        : parentSchemaObject.pointers;
      const pointer = pointers?.find((p) => p.name === pointerName);

      if (
        !pointer ||
        (typeof objId === "number" && !this.edits.insertEdits.has(objId))
      ) {
        this.inspectorStack = this.inspectorStack.slice(0, i + 1);
        return [rootObjectTypeName, ...nestedParts.slice(0, i * 2)].join("/");
      } else {
        if (
          objId !== stackItem?.parentObject!.id ||
          pointerName !== stackItem?.parentObject!.fieldName
        ) {
          this.inspectorStack[i + 1] = new DataInspector({
            objectTypeId: pointer.target!.id,
            parentObject: {
              editMode: false,
              objectTypeId: parentSchemaObject.id,
              objectTypeName: parentSchemaObject.name,
              subtypeName,
              id: objId,
              fieldName: pointer.name,
              escapedFieldName: pointer.escapedName,
              linkId: `${objId}__${pointer.name}`,
              isMultiLink:
                pointer.type === "Link"
                  ? pointer.cardinality === "Many"
                  : false,
              isComputedLink: !!pointer.expr,
            },
          });
        }
        parentSchemaObject = pointer.target as any;
      }
      i++;
    }
    if (this.inspectorStack.length > i + 1) {
      this.inspectorStack = this.inspectorStack.slice(0, i + 1);
    }
    return null;
  }
}

export enum RowKind {
  data,
  expanded,
}
export type DataRowData = {kind: RowKind.data; index: number};
export type ExpandedRowData = {
  kind: RowKind.expanded;
  index: number;
  dataRowIndex: number;
  state: ExpandedInspector;
};

export enum ObjectFieldType {
  property,
  link,
}

export type ObjectField = {
  subtypeName?: string;
  escapedSubtypeName?: string;
  name: string;
  escapedName: string;
  queryName: string;
  typeid: string;
  typename: string;
  escapedTypename: string;
  required: boolean;
  hasDefault: boolean;
  computedExpr: string | null;
  readonly: boolean;
  multi: boolean;
} & (
  | {
      type: ObjectFieldType.property;
      default: string | null;
      schemaType: SchemaType;
    }
  | {
      type: ObjectFieldType.link;
      targetHasSelectAccessPolicy: boolean;
    }
);

interface SortBy {
  fieldIndex: number;
  direction: "ASC" | "DESC";
}

function pointerTargetHasSelectAccessPolicy(pointer: SchemaLink) {
  return (
    pointer.expr == null &&
    !!pointer.target!.accessPolicies.some((ap) =>
      ap.access_kinds.includes("Select")
    )
  );
}

type ErrorFilter = {filter: string; error: string};

@model("DataInspector")
export class DataInspector extends Model({
  $modelId: idProp,
  objectTypeId: prop<string>(),
  parentObject: prop<ParentObject | null>(null),

  scrollPos: prop<[number, number]>(() => [0, 0]).withSetter(),

  sortBy: prop<SortBy | null>(null),
  fieldWidths: prop<number[]>(() => []),
  expandedInspectors: prop(() => objectMap<ExpandedInspector>()),

  filter: prop<string>(""),
  errorFilter: prop<ErrorFilter | null>(null),
  filterPanelOpen: prop<boolean>(false).withSetter(),
}) {
  gridRef: Grid | null = null;
  fieldWidthsUpdated = false;

  @observable.ref
  filterEditStr = Text.of(["filter "]);

  @observable.ref
  fields: ObjectField[] | null = null;

  @action
  setFilterEditStr(filterStr: Text) {
    this.filterEditStr = filterStr;
  }

  onAttachedToRootStore() {
    const dataView = findParent<DataView>(
      this,
      (parent) => parent instanceof DataView
    )!;

    if (!this.fields) {
      this._updateFields(dataView.showSubtypeFields);
    }

    this._updateRowCount();

    const updateFieldDisposer = reaction(
      () => [this.objectType, dataView.showSubtypeFields] as const,
      ([objectType, showSubtypeFields]) => {
        if (objectType) {
          this._updateFields(showSubtypeFields);
          this.omittedLinks.clear();
          this._refreshData(false, true);
        }
      }
    );
    const refreshDataDisposer = reaction(
      () => sessionStateCtx.get(this)?.activeState,
      () => {
        this.omittedLinks.clear();
        this._refreshData(true);
      }
    );

    return () => {
      updateFieldDisposer();
      refreshDataDisposer();
    };
  }

  @computed
  get objectType() {
    return dbCtx.get(this)?.schemaData!.objects.get(this.objectTypeId);
  }

  openNestedView(
    basePath: string,
    navigate: NavigateFunction,
    objectId: string | number,
    subtypeName: string,
    field: ObjectField,
    editMode: boolean = false
  ) {
    const dataView = findParent<DataView>(
      this,
      (parent) => parent instanceof DataView
    )!;

    navigate(
      `${basePath}/${objectId}/${
        field.subtypeName ? `[${field.subtypeName}]` : ""
      }${field.name}`
    );
    dataView.openNestedView(field.typeid, {
      editMode,
      objectTypeId: this.objectTypeId,
      objectTypeName: this.objectType!.name,
      subtypeName,
      id: objectId,
      fieldName: field.name,
      escapedFieldName: field.escapedName,
      linkId: `${objectId}__${field.name}`,
      isMultiLink: field.type === ObjectFieldType.link ? field.multi : false,
      isComputedLink: !!field.computedExpr,
    });
  }

  @modelAction
  toggleEditLinkMode() {
    if (this.parentObject) {
      this.parentObject.editMode = !this.parentObject.editMode;
      this._refreshData(true);
    }
  }

  // fields

  @computed
  get subTypes() {
    const obj = this.objectType;
    if (!obj) {
      return [];
    }
    return obj.unionOf
      ? [
          ...new Set(
            resolveObjectTypeUnion(obj).flatMap((type) => [
              type,
              ...type.descendents,
            ])
          ),
        ]
      : obj.descendents;
  }

  @modelAction
  _updateFields(showSubtypeFields: boolean) {
    const obj = this.objectType;

    if (!obj) {
      throw new Error(`Cannot find schema object id: ${this.objectTypeId}`);
    }

    let i = 0;
    function createField(
      pointer: SchemaProperty | SchemaLink,
      subtypeName?: string,
      escapedSubtypeName?: string,
      queryNamePrefix: string = ""
    ): ObjectField {
      const baseField = {
        subtypeName,
        escapedSubtypeName,
        name: pointer.name,
        escapedName: pointer.escapedName,
        queryName:
          pointer.name === "id"
            ? "id"
            : queryNamePrefix +
              pointer.name.replace(/^[^A-Za-z_]|[^A-Za-z0-9_]/g, "") +
              `_${i++}`,
        typeid: pointer.target!.id,
        typename: pointer.target!.name,
        escapedTypename:
          "escapedName" in pointer.target!
            ? pointer.target!.escapedName
            : pointer.target!.name,
        required: pointer.required,
        hasDefault: !!pointer.default,
        multi: pointer.cardinality === "Many",
        computedExpr: pointer.expr,
        readonly: pointer.readonly,
      };

      if (pointer.type === "Property") {
        return {
          type: ObjectFieldType.property,
          ...baseField,
          schemaType: pointer.target!,
          default: pointer.default?.replace(/^select/i, "").trim() ?? null,
        };
      } else {
        return {
          type: ObjectFieldType.link,
          ...baseField,
          targetHasSelectAccessPolicy:
            pointerTargetHasSelectAccessPolicy(pointer),
        };
      }
    }

    const baseFields = [
      ...Object.values(obj.properties),
      ...Object.values(obj.links),
    ].map((pointer) => createField(pointer));

    const baseFieldNames = new Set(baseFields.map((field) => field.name));

    const subtypeFields = showSubtypeFields
      ? this.subTypes
          .filter((subType) => !subType.abstract && !subType.from_alias)
          .flatMap((subtypeObj) => {
            const queryNamePrefix = `__${subtypeObj.name.replace(/:/g, "")}_`;

            return [
              ...Object.values(subtypeObj.properties),
              ...Object.values(subtypeObj.links),
            ]
              .filter((pointer) => !baseFieldNames.has(pointer.name))
              .map((pointer) =>
                createField(
                  pointer,
                  subtypeObj.name,
                  subtypeObj.escapedName,
                  queryNamePrefix
                )
              );
          })
      : [];

    this.fields = [...baseFields, ...subtypeFields];
    this.fieldWidths = Array(this.fields.length).fill(180);
    this.gridRef?.resetAfterColumnIndex(0);
  }

  @observable
  omittedLinks = new Set<string>();

  @computed
  get hasSubtypeFields() {
    return !!this.fields?.some((field) => field.subtypeName);
  }

  @computed
  get insertTypeNames() {
    const objectType = dbCtx
      .get(this)!
      .schemaData?.objects.get(this.objectTypeId);

    if (!objectType) {
      return [];
    }

    return resolveObjectTypeUnion(objectType)
      .flatMap((type) => [type, ...type.descendents])
      .filter((type) => !type.abstract && !type.from_alias)
      .map((type) => type.name);
  }

  @computed
  get insertedRows() {
    const dataView = findParent<DataView>(
      this,
      (parent) => parent instanceof DataView
    )!;

    if (this.parentObject?.editMode === false) {
      return [
        ...(dataView.edits.linkEdits.get(this.parentObject.linkId)?.inserts ??
          []),
      ];
    }

    const typeNames = new Set(this.insertTypeNames);

    return [...(dataView.edits.insertEdits.values() ?? [])].filter((row) =>
      typeNames.has(row.objectTypeName)
    );
  }

  @computed
  get subtypeFieldRanges() {
    const ranges = new Map<string, {left: number; width: number}>();

    let left = 0;
    let i = 0;
    for (const field of this.fields ?? []) {
      const fieldWidth = this.fieldWidths[i++];
      if (field.subtypeName) {
        if (!ranges.has(field.subtypeName)) {
          ranges.set(field.subtypeName, {left, width: fieldWidth});
        } else {
          ranges.get(field.subtypeName)!.width += fieldWidth;
        }
      }
      left += fieldWidth;
    }

    return ranges;
  }

  // offset handling

  @observable
  visibleIndexes: [number, number] = [0, 0];

  @observable
  rowCount: number | null = null;

  _pendingOffsets: number[] = [];

  @observable
  visibleOffsets: number[] = [];

  @observable
  hoverRowIndex: number | null = null;

  @action
  setHoverRowIndex(index: number | null) {
    this.hoverRowIndex = index;
  }

  @computed
  get gridRowCount() {
    return (
      (this.rowCount ?? 0) +
      this.expandedRows.reduce(
        (sum, row) => sum + row.inspector.rowsCount,
        0
      ) +
      this.insertedRows.length
    );
  }

  @action
  setVisibleRowIndexes(startIndex: number, endIndex: number) {
    if (startIndex > endIndex) {
      // Sometimes react-window returns a startIndex greater than the endIndex
      // when the data is cleared for a refresh, so ignore these updates.
      // The next update when the refresh completes seems to be correct.
      return;
    }

    const startRow = this.getRowData(startIndex);
    const endRow = this.getRowData(endIndex);

    this.visibleIndexes = [startIndex, endIndex];

    const startDataIndex =
      startRow.kind === RowKind.expanded
        ? startRow.dataRowIndex + 1
        : startRow.index;
    const endDataIndex =
      endRow.kind === RowKind.expanded ? endRow.dataRowIndex : endRow.index;

    if (endDataIndex < startDataIndex) {
      this.visibleOffsets = [];
      return;
    }

    const startOffset = Math.floor(startDataIndex / fetchBlockSize);
    const endOffset = Math.ceil(endDataIndex / fetchBlockSize) || 1;

    const offsets = Array(endOffset - startOffset)
      .fill(0)
      .map((_, i) => i + startOffset);

    this.visibleOffsets = offsets;
    this._pendingOffsets = offsets.filter((offset) => !this.data.has(offset));

    this._fetchData();
  }

  getRowData(rowIndex: number): DataRowData | ExpandedRowData {
    let index = rowIndex;
    for (const expandedRow of this.expandedRows) {
      if (index <= expandedRow.dataRowIndex) {
        break;
      }

      const expandedLength = expandedRow.inspector.rowsCount;

      if (index <= expandedRow.dataRowIndex + expandedLength) {
        return {
          kind: RowKind.expanded,
          index: index - expandedRow.dataRowIndex - 1,
          dataRowIndex: expandedRow.dataRowIndex,
          state: expandedRow.inspector,
        };
      }

      index -= expandedLength;
    }

    return {
      kind: RowKind.data,
      index,
    };
  }

  getData(dataRowIndex: number): any | undefined {
    const blockOffset = Math.floor(dataRowIndex / fetchBlockSize);

    return this.data.get(blockOffset)?.[
      dataRowIndex - blockOffset * fetchBlockSize
    ];
  }

  @modelFlow
  _updateRowCount = _async(function* (this: DataInspector) {
    const conn = connCtx.get(this)!;
    const dbState = dbCtx.get(this)!;

    const {query, params} = this.getBaseObjectsQuery();
    dbState.setLoadingTab(DataView, true);
    this.rowCount = null;
    try {
      const data = yield* _await(
        conn.query(
          `SELECT count((${query}${
            this.filter ? ` FILTER ${this.filter}` : ""
          }))`,
          params
        )
      );

      if (data.result) {
        this.rowCount = parseInt(data.result[0], 10);
      }
    } catch (err) {
      this.dataFetchingError = err as Error;
      console.error(err);
    } finally {
      dbState.setLoadingTab(DataView, false);
    }
  });

  // expanded rows

  @observable
  expandedRows: {
    dataRowIndex: number;
    inspector: ExpandedInspector;
  }[] = [];

  @computed
  get expandedDataRowIndexes() {
    return new Set(this.expandedRows.map((row) => row.dataRowIndex));
  }

  @observable
  expandedRowMobile: number = -1;

  @action
  setExpandedRowMobile(rowIndex: number) {
    this.expandedRowMobile = rowIndex;
  }

  @action
  toggleRowExpanded(dataRowIndex: number) {
    const existingRowIndex = this.expandedRows.findIndex(
      (row) => row.dataRowIndex === dataRowIndex
    );

    if (existingRowIndex !== -1) {
      this.expandedInspectors.delete(
        this.expandedRows[existingRowIndex].inspector.objectId
      );
      this.expandedRows.splice(existingRowIndex, 1);
    } else {
      const data = this.getData(dataRowIndex);

      if (data) {
        const inspector = new ExpandedInspector({
          objectId: data.id,
          objectTypeName: data.__tname__,
        });
        this.expandedInspectors.set(data.id, inspector);

        this.expandedRows = [
          ...this.expandedRows,
          {
            dataRowIndex,
            inspector,
          },
        ].sort((a, b) => a.dataRowIndex - b.dataRowIndex);
      }
    }
  }

  // data fetching

  data = new ObservableLRU<number, EdgeDBSet>(20);

  @observable.ref
  dataCodecs: _ICodec[] | null = null;

  @observable
  fetchingData = false;

  discardLastFetch = false;

  @observable.ref
  dataFetchingError: Error | null = null;

  @observable.shallow
  fullyFetchedData = new Map<string, any>();

  async fetchFullCellData(dataId: string, field: ObjectField) {
    const query = `select (select ${
      field.escapedSubtypeName ?? this._getObjectTypeQuery
    } filter .id = <uuid>$id).${field.escapedName}`;
    const conn = connCtx.get(this)!;

    const val = (await conn.query(query, {id: dataId})).result![0];

    runInAction(() => {
      this.fullyFetchedData.set(`${dataId}__${field.name}`, val);
    });
  }

  @modelFlow
  _fetchData = _async(function* (this: DataInspector) {
    const offset = this._pendingOffsets[0];

    if (this.fetchingData || offset === undefined) {
      return;
    }

    const dbState = dbCtx.get(this)!;

    this.fetchingData = true;
    dbState.setLoadingTab(DataView, true);

    let fetchNextOffset = false;

    try {
      const conn = connCtx.get(this)!;
      const dataQuery = this.dataQuery;

      // console.log(dataQuery);

      if (dataQuery) {
        // console.log(`fetching ${offset}`);
        const data = yield* _await(
          conn.query(dataQuery.query, {
            offset: offset * fetchBlockSize,
            ...dataQuery.params,
          })
        );

        this.dataFetchingError = null;

        // console.log(offset, data.duration);

        if (!this.discardLastFetch) {
          if (data.result) {
            // console.log(`data ${offset}, length ${data.result.length}`);

            this._setData(offset, data.result);
          }

          this._pendingOffsets = this._pendingOffsets.filter(
            (po) => po !== offset
          );
        } else {
          this.discardLastFetch = false;
        }

        fetchNextOffset = true;
      }
    } catch (err) {
      if (err instanceof CardinalityViolationError) {
        const match = err.message.match(
          /^required link '.+' of object type '.+' is hidden by access policy \(while evaluating computed link '(.+)' of object type '.+'\)$/
        );
        if (match) {
          this.omittedLinks.add(match[1]);
          fetchNextOffset = true;
        } else {
          this.dataFetchingError = err;
          console.error(err);
        }
      } else {
        this.dataFetchingError = err as Error;
        console.error(err);
      }
    } finally {
      this.fetchingData = false;
      dbState.setLoadingTab(DataView, false);
    }

    if (fetchNextOffset) {
      this._fetchData();
    }
  });

  @modelAction
  _setData(offset: number, data: EdgeDBSet) {
    this.data.set(offset, data);

    if (!this.dataCodecs) {
      const codec = data._codec as ObjectCodec;
      const codecs = codec.getSubcodecs();
      const codecNames = codec.getFields().map((f) => f.name);
      this.dataCodecs =
        this.fields!.map(
          (field) => codecs[codecNames.indexOf(field.queryName)]
        ) ?? null;
    }

    const expandedRows: typeof DataInspector.prototype.expandedRows = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      if (this.expandedInspectors.has(row.id)) {
        expandedRows.push({
          dataRowIndex: offset * fetchBlockSize + i,
          inspector: this.expandedInspectors.get(row.id)!,
        });
      }
    }

    if (expandedRows.length) {
      this.expandedRows = [...this.expandedRows, ...expandedRows].sort(
        (a, b) => a.dataRowIndex - b.dataRowIndex
      );
    }
  }

  @modelAction
  _refreshData(updateCount: boolean = false, fieldsChanged: boolean = false) {
    this.data.clear();
    if (fieldsChanged) {
      this.dataCodecs = null;
    }
    this.expandedRows = [];
    this.gridRef?.resetAfterRowIndex(0);
    this._pendingOffsets = [...this.visibleOffsets];
    this.fullyFetchedData.clear();

    if (this.fetchingData) {
      this.discardLastFetch = true;
    }

    if (updateCount) {
      this._updateRowCount();
    }
    this._fetchData();
  }

  // queries

  get _getObjectTypeQuery() {
    const typeUnionNames = resolveObjectTypeUnion(this.objectType!).map(
      (t) => t.escapedName
    );

    return typeUnionNames.length > 1
      ? `{${typeUnionNames.join(", ")}}`
      : typeUnionNames[0];
  }

  get _baseObjectsQuery() {
    if (this.parentObject && typeof this.parentObject.id === "string") {
      return this.parentObject.isComputedLink ||
        this.objectType?.unionOf?.length
        ? `(SELECT ${
            this.parentObject.subtypeName ?? this.parentObject.objectTypeName
          } FILTER .id = <uuid>'${this.parentObject.id}').${
            this.parentObject.escapedFieldName
          }`
        : `(select ${this._getObjectTypeQuery} ` +
            `filter .<${this.parentObject.escapedFieldName}[is ${this.parentObject.objectTypeName}].id = <uuid>'${this.parentObject.id}')`;
    }

    const typeUnionNames = resolveObjectTypeUnion(this.objectType!).map(
      (t) => t.escapedName
    );

    return this.parentObject
      ? `<${typeUnionNames.join(" | ")}>{}`
      : typeUnionNames.length > 1
      ? `{${typeUnionNames.join(", ")}}`
      : typeUnionNames[0];
  }

  getBaseObjectsQuery() {
    if (this.parentObject?.editMode) {
      if (typeof this.parentObject.id === "string") {
        return {
          query: `with linkedObjects := (${this._baseObjectsQuery}),
            objs := ${this._getObjectTypeQuery}
          select objs {
            __isLinked := objs in linkedObjects
          }`,
        };
      }

      return {
        query: `select (${this._getObjectTypeQuery}) {
        __isLinked := false
      }`,
      };
    } else {
      const dataView = findParent<DataView>(
        this,
        (parent) => parent instanceof DataView
      )!;

      const addedLinkIds = this.parentObject
        ? [
            ...(dataView.edits.linkEdits
              .get(this.parentObject.linkId)
              ?.changes.values() ?? []),
          ]
            .filter((change) => change.kind !== UpdateLinkChangeKind.Remove)
            .map((change) => change.id)
        : null;
      if (addedLinkIds?.length) {
        return {
          query: `select {
            (${this._baseObjectsQuery}),
            (select ${this._getObjectTypeQuery} filter .id in <uuid>array_unpack(<array<std::str>>$addedLinkIds))
          }`,
          params: {addedLinkIds},
        };
      } else {
        return {query: `select ${this._baseObjectsQuery}`};
      }
    }
  }

  @computed
  get dataQuery() {
    if (!this.fields) {
      return null;
    }

    const sortField = this.sortBy ? this.fields[this.sortBy.fieldIndex] : null;

    const inEditMode = this.parentObject?.editMode;

    const {query: baseObjectsQuery, params} = this.getBaseObjectsQuery();

    return {
      query: `WITH
    baseObjects := (${baseObjectsQuery}),
    rows := (SELECT baseObjects ${
      this.filter ? `FILTER ${this.filter}` : ""
    } ORDER BY ${inEditMode ? `.__isLinked DESC THEN` : ""}${
        sortField
          ? `${
              sortField.escapedSubtypeName
                ? `[IS ${sortField.escapedSubtypeName}]`
                : ""
            }.${sortField.escapedName} ${this.sortBy!.direction} THEN`
          : ""
      } .id OFFSET <int32>$offset LIMIT ${fetchBlockSize})
    SELECT rows {
      id,
      ${inEditMode ? "__isLinked," : ""}
      ${this.fields
        .filter((field) => field.name !== "id")
        .map((field) => {
          const selectName = `${
            field.subtypeName ? `[IS ${field.escapedSubtypeName}]` : ""
          }.${field.escapedName}`;

          if (field.type === ObjectFieldType.property) {
            return `${field.queryName} := ${
              field.typename === "std::str"
                ? `${selectName}[0:100]`
                : selectName
            }`;
          } else {
            if (this.omittedLinks.has(field.name)) {
              return `__count_${field.queryName} := <int64>{}`;
            }
            return `__count_${field.queryName} := (for g in (
              group ${
                field.targetHasSelectAccessPolicy && field.required
                  ? `(
                with sourceId := .id
                select ${field.escapedTypename}
                filter .<${field.escapedName}.id = sourceId
              )`
                  : selectName
              }
              using typename := .__type__.name
              by typename
            ) union {
              typename := g.key.typename,
              count := <std::float64>count(g.elements)
            })`;
          }
        })
        .filter((line) => !!line)
        .join(",\n")}
    } `,
      params,
    };
  }

  @computed
  get mobileFieldsAndCodecs() {
    const fields = this.fields ? [...this.fields] : null;
    const codecs = this.dataCodecs ? [...this.dataCodecs] : null;

    const index = fields?.findIndex((field) => field.name === "id");

    if (index !== undefined && index > -1) {
      fields?.splice(index, 1);
      codecs?.splice(index, 1);
    }

    return {fields, codecs};
  }

  // sorting

  @modelAction
  setSortBy(fieldIndex: number) {
    const currentDirection =
      this.sortBy?.fieldIndex === fieldIndex && this.sortBy.direction;
    const direction = currentDirection
      ? currentDirection === "ASC"
        ? "DESC"
        : null
      : "ASC";

    this.sortBy = direction
      ? {
          fieldIndex,
          direction,
        }
      : null;

    this._refreshData();
  }

  // filters

  @computed
  get filterEdited() {
    const filterStrTrimmed = this.filterEditStr
      .toString()
      .replace(/^filter\s/i, "")
      .trim();

    if (this.errorFilter) return filterStrTrimmed !== this.errorFilter.filter;
    return filterStrTrimmed !== this.filter;
  }

  @modelFlow
  applyFilter = _async(function* (this: DataInspector) {
    const filter = this.filterEditStr
      .toString()
      .replace(/^filter\s/i, "")
      .trim();

    if (!filter) {
      this.errorFilter = null;
      this.filter = "";

      this._refreshData(true);

      return;
    }

    const filterCheckQuery = `SELECT ${this._baseObjectsQuery} FILTER ${filter} ORDER BY .id`;

    const conn = connCtx.get(this)!;

    try {
      yield* _await(conn.parse(filterCheckQuery));
    } catch (err: any) {
      const errMessage = String(err.message).split("\n")[0];
      this.errorFilter = {
        filter,
        error: /unexpected 'ORDER'/i.test(errMessage)
          ? "Filter can only contain 'FILTER' clause"
          : errMessage,
      };

      return;
    }

    this.errorFilter = null;
    this.filter = filter;

    this._refreshData(true);
  });

  @modelAction
  revertFilter() {
    this.filterEditStr = Text.of([`filter ${this.filter}`]);
    this.errorFilter = null;
  }

  @modelAction
  disableFilter() {
    this.filter = "";
    this.errorFilter = null;

    this._refreshData(true);
  }

  @modelAction
  clearFilter() {
    this.filterEditStr = Text.of(["filter "]);
    this.errorFilter = null;

    if (this.filter) {
      this.filter = "";
      this._refreshData(true);
    }
  }

  @modelAction
  setInitialFieldWidths(width: number) {
    this.fieldWidthsUpdated = true;
    this.fieldWidths = new Array(this.fields!.length).fill(
      Math.max(width, 100)
    );
  }

  @modelAction
  setFieldWidth(fieldIndex: number, width: number) {
    this.fieldWidths[fieldIndex] = Math.max(width, 100);
  }
}

@model("ExpandedInspector")
class ExpandedInspector extends Model({
  objectId: prop<string>(),
  objectTypeName: prop<string>(),

  state: prop<InspectorState>(
    () =>
      new InspectorState({
        autoExpandDepth: 3,
        countPrefix: "__count_",
        ignorePrefix: "__",
      })
  ),
}) {
  onInit() {
    this.state.loadNestedData = this.loadNestedData.bind(this);

    resultGetterCtx.set(this, async () => {
      const conn = connCtx.get(this)!;
      const {result} = await conn.query(
        this.dataQuery,
        {
          objectId: this.objectId,
        },
        {newCodec: true}
      );
      if (result) {
        return {data: result, codec: result._codec};
      }
    });
  }

  onAttachedToRootStore() {
    const dataInspector = findParent<DataInspector>(
      this,
      (parent) => parent instanceof DataInspector
    )!;

    return reaction(
      () => this.state._items.length,
      () => {
        dataInspector.gridRef?.resetAfterRowIndex(0);
      }
    );
  }

  async loadNestedData(
    parentObjectTypeName: string,
    parentObjectId: string,
    fieldName: string
  ) {
    const dbState = dbCtx.get(this)!;

    const parentObjectType = dbState.schemaData?.objectsByName.get(
      parentObjectTypeName
    );
    if (!parentObjectType) {
      throw new Error(
        `Could not find object type '${parentObjectTypeName}' in schema`
      );
    }

    const objectType = parentObjectType.links[fieldName].target!;

    const query = `with parentObj := (select ${
      parentObjectType.escapedName
    } filter .id = <uuid><str>$id)
      select parentObj.\`${fieldName}\` {
        ${[
          ...Object.values(objectType.properties).map(
            (prop) => prop.escapedName
          ),
          ...Object.values(objectType.links).map(
            (link) => `${link.escapedName} limit 0,
        \`__count_${link.name}\` := count(.${link.escapedName})`
          ),
        ].join(",\n")}
      }`;

    const {result} = await dbState.connection.query(
      query,
      {
        id: parentObjectId,
      },
      {newCodec: true}
    );

    if (!result) {
      throw new Error(`Failed to fetch nested data, query returned no data`);
    }

    return {data: result, codec: result._codec};
  }

  getItems() {
    const items = this.state.getItems();

    if (items.length) {
      return items.slice(1, -1);
    }

    return null;
  }

  toggleExpanded(index: number) {
    const item = this.state._items[index + 1];

    if (this.state.expanded?.has(item.id)) {
      this.state.collapseItem(index + 1);
    } else {
      this.state.expandItem(index + 1);
    }
  }

  @computed
  get rowsCount() {
    const itemsLength = this.state.getItems().length;
    return itemsLength ? itemsLength - 2 : 1;
  }

  @computed
  get linkFields() {
    const dataInspector = findParent<DataInspector>(
      this,
      (parent) => parent instanceof DataInspector
    )!;

    return new Set(
      dataInspector.fields
        ?.filter((field) => field.type === ObjectFieldType.link)
        .map((field) => field.name)
    );
  }

  @computed
  get dataQuery() {
    const schemaData = dbCtx.get(this)!.schemaData!;

    const objectType = schemaData.objectsByName.get(this.objectTypeName);

    if (!objectType) {
      throw new Error(
        `Could not find object type '${this.objectTypeName}' in schema`
      );
    }

    const dataInspector = findParent<DataInspector>(
      this,
      (parent) => parent instanceof DataInspector
    )!;

    return `select ${objectType.escapedName} {
      ${[
        ...Object.values(objectType.properties).map((prop) => {
          return prop.escapedName;
        }),
        ...Object.values(objectType.links).map((link) => {
          if (dataInspector.omittedLinks.has(link.name)) {
            return `\`__${link.name}\` := <std::Object>{},
              \`__count___${link.name}\` := 0`;
          }
          const accessPolicyWorkaround =
            link.required && pointerTargetHasSelectAccessPolicy(link);
          const singleLink = link.cardinality === "One";
          const linkName = accessPolicyWorkaround
            ? `__${link.name}`
            : link.name;
          const linkSelect = `${
            accessPolicyWorkaround
              ? `\`${linkName}\` := ${singleLink ? "assert_single(" : ""}(
                with sourceId := .id
                select ${link.target!.escapedName}
                filter .<${link.escapedName}.id = sourceId
                limit 10
              )${singleLink ? ")" : ""}`
              : `\`${linkName}\`: `
          } {
          ${[
            ...Object.values(link.target!.properties),
            ...Object.values(link.target!.links),
          ]
            .map((subField) =>
              subField.type === "Property"
                ? subField.escapedName
                : `${subField.escapedName} limit 0,
                \`__count_${subField.name}\` := count(.${subField.escapedName})`
            )
            .join(",\n")}
        }${accessPolicyWorkaround ? "" : " limit 10"}`;
          return `${linkSelect},
        \`__count_${linkName}\` := count(${
            accessPolicyWorkaround
              ? `(
          with sourceId := .id
          select ${link.target!.escapedName}
          filter .<${link.escapedName}.id = sourceId
        )`
              : `.\`${linkName}\``
          })`;
        }),
      ].join(",\n")}
    } filter .id = <uuid><str>$objectId`;
  }
}
