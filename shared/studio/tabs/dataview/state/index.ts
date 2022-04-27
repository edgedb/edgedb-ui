import {computed, observable, action, when, reaction, autorun} from "mobx";
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

import {Text} from "@codemirror/state";

import {_ICodec} from "edgedb";
import {ObjectCodec} from "edgedb/dist/codecs/object";

import {EdgeDBSet} from "../../../utils/decodeRawBuffer";

import {ObservableLRU} from "./lru";

import {InspectorState, resultGetterCtx} from "@edgedb/inspector/v2/state";
import {SchemaLink, SchemaProp} from "@edgedb/schema-graph";

import {dbCtx, connCtx} from "../../../state";
import {DataEditingManager, UpdateLinkChangeKind} from "./edits";

const fetchBlockSize = 100;

type ParentObject = {
  editMode: boolean;
  objectType: string;
  subtypeName?: string;
  id: string;
  fieldName: string;
  isMultiLink: boolean;
};

@model("DataView")
export class DataView extends Model({
  inspectorStack: prop<DataInspector[]>(() => []),

  edits: prop(() => new DataEditingManager({})),
}) {
  @computed
  get objectTypeNames() {
    return (
      dbCtx.get(this)!.schemaData?.data.objects.map((obj) => obj.name) ?? []
    );
  }

  onAttachedToRootStore() {
    const db = dbCtx.get(this)!;

    when(
      () => this.objectTypeNames.length !== 0,
      () => {
        const name = this.objectTypeNames[0];
        if (!this.inspectorStack.length && name) {
          this.selectObject(name);
        }
      }
    );
  }

  @modelAction
  selectObject(objectName: string) {
    this.inspectorStack = [new DataInspector({objectName})];
  }

  @modelAction
  openNestedView(objectName: string, parentObject: ParentObject) {
    this.inspectorStack.push(new DataInspector({objectName, parentObject}));
  }

  @modelAction
  closeLastNestedView() {
    this.inspectorStack.pop();
  }
}

export enum ObjectFieldType {
  property,
  link,
}

export enum RowKind {
  data,
  expanded,
}

export type ObjectField = {
  subtypeName?: string;
  name: string;
  queryName: string;
  width: number;
  typename: string;
} & (
  | {type: ObjectFieldType.property}
  | {
      type: ObjectFieldType.link;
      required: boolean;
      isMultiLink: boolean;
      subFields: {
        type: ObjectFieldType;
        name: string;
      }[];
    }
);

interface SortBy {
  fieldIndex: number;
  direction: "ASC" | "DESC";
}

@model("DataInspector")
export class DataInspector extends Model({
  $modelId: idProp,
  objectName: prop<string>(),
  parentObject: prop<ParentObject | null>(null),
  fields: prop<ObjectField[] | null>(null),

  scrollPos: prop<[number, number]>(() => [0, 0]).withSetter(),

  sortBy: prop<SortBy | null>(null),
  expandedInspectors: prop(() => objectMap<ExpandedInspector>()),

  filter: prop<string>(""),
  filterError: prop<string>(""),
  filterPanelOpen: prop<boolean>(false).withSetter(),
}) {
  gridRef: Grid | null = null;
  fieldWidthsUpdated = false;

  @observable.ref
  filterEditStr = Text.of(["filter "]);

  @action
  setFilterEditStr(filterStr: Text) {
    this.filterEditStr = filterStr;
  }

  onAttachedToRootStore() {
    if (!this.fields) {
      this._updateFields();
    }

    const conn = connCtx.get(this)!;
    const connWatchDisposer = reaction(
      () => conn.isConnected,
      (isConnected) => {
        if (isConnected) {
          this._updateRowCount();
          // this._fetchData();
        }
      },
      {fireImmediately: true}
    );

    // autorun(() => console.log(this.dataQuery));

    return () => {
      connWatchDisposer();
    };
  }

  openNestedView(objectId: string, subtypeName: string, fieldName: string) {
    const dataView = findParent<DataView>(
      this,
      (parent) => parent instanceof DataView
    )!;

    const field = this.fields!.find((field) => field.name === fieldName)!;

    dataView.openNestedView(field.typename, {
      editMode: false,
      objectType: this.objectName,
      subtypeName,
      id: objectId,
      fieldName,
      isMultiLink:
        field.type === ObjectFieldType.link ? field.isMultiLink : false,
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

  @modelAction
  _updateFields() {
    const schemaObjects = dbCtx.get(this)!.schemaData!.data.objects;

    const obj = schemaObjects.find((obj) => obj.name === this.objectName);

    if (!obj) {
      // return;
      throw new Error(`Cannot find schema object: ${this.objectName}`);
    }

    function createField<T extends ObjectFieldType>(
      type: T,
      field: T extends ObjectFieldType.property ? SchemaProp : SchemaLink,
      subtypeName?: string,
      queryNamePrefix: string = ""
    ): ObjectField {
      const baseField = {
        subtypeName,
        name: field.name,
        queryName: queryNamePrefix + field.name,
        typename:
          type === ObjectFieldType.property
            ? (field as SchemaProp).targetName
            : (field as SchemaLink).targetNames.join(" | "),
        width: 180,
      };

      if (type === ObjectFieldType.property) {
        return {
          type,
          ...baseField,
        };
      }

      return {
        type,
        ...baseField,
        required: field.required,
        isMultiLink: (field as SchemaLink).cardinality === "Many",
        subFields: (field as SchemaLink).targetNames.flatMap((targetName) => {
          const subFieldObj = schemaObjects.find(
            (obj) => obj.name === targetName
          );

          if (subFieldObj) {
            return [
              ...subFieldObj.properties.map((prop) => ({
                type: ObjectFieldType.property,
                name: prop.name,
              })),
              ...subFieldObj.links.map((link) => ({
                type: ObjectFieldType.link,
                name: link.name,
              })),
            ];
          }

          return [];
        }),
      };
    }

    const baseFields = [
      ...obj.properties.map((prop) =>
        createField(ObjectFieldType.property, prop)
      ),
      ...obj.links.map((link) => createField(ObjectFieldType.link, link)),
    ];

    const baseFieldNames = new Set(baseFields.map((field) => field.name));

    const subtypeFields = obj.inherited_by
      .flatMap((subtypeObjName) => {
        const subtypeObj = schemaObjects.find(
          (obj) => obj.name === subtypeObjName
        );
        const queryNamePrefix = `__${subtypeObjName.replace(/:/g, "")}_`;

        // skip subtype fields on aliases
        return subtypeObj && !subtypeObj.from_alias
          ? [
              ...subtypeObj.properties.map((prop) =>
                createField(
                  ObjectFieldType.property,
                  prop,
                  subtypeObjName,
                  queryNamePrefix
                )
              ),
              ...subtypeObj.links.map((link) =>
                createField(
                  ObjectFieldType.link,
                  link,
                  subtypeObjName,
                  queryNamePrefix
                )
              ),
            ]
          : [];
      })
      .filter((field) => !baseFieldNames.has(field.name));

    this.fields = [...baseFields, ...subtypeFields];
  }

  @computed
  get hasSubtypeFields() {
    return !!this.fields?.some((field) => field.subtypeName);
  }

  @computed
  get isAbstractType() {
    return dbCtx
      .get(this)!
      .schemaData?.data.objects.find((obj) => obj.name === this.objectName)
      ?.is_abstract;
  }

  @computed
  get insertTypeNames() {
    const objectType = dbCtx
      .get(this)!
      .schemaData?.data.objects.find((obj) => obj.name === this.objectName);

    if (!objectType) {
      return [];
    }

    return [
      ...(objectType.is_abstract ? [] : [objectType.name]),
      ...objectType.inherited_by,
    ];
  }

  @computed
  get subtypeFieldRanges() {
    const ranges = new Map<string, {left: number; width: number}>();

    let left = 0;
    for (const field of this.fields ?? []) {
      if (field.subtypeName) {
        if (!ranges.has(field.subtypeName)) {
          ranges.set(field.subtypeName, {left, width: field.width});
        } else {
          ranges.get(field.subtypeName)!.width += field.width;
        }
      }
      left += field.width;
    }

    return ranges;
  }

  // offset handling

  @observable
  rowCount = 0;

  _pendingOffsets: number[] = [];

  @observable
  visibleOffsets: number[] = [];

  @computed
  get gridRowCount() {
    return (
      this.rowCount +
      this.expandedRows.reduce((sum, row) => sum + row.inspector.rowsCount, 0)
    );
  }

  @action
  setVisibleRowIndexes(startIndex: number, endIndex: number) {
    const startRow = this.getRowData(startIndex);
    const endRow = this.getRowData(endIndex);

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

  getRowData(rowIndex: number):
    | {kind: RowKind.data; index: number}
    | {
        kind: RowKind.expanded;
        index: number;
        dataRowIndex: number;
        state: ExpandedInspector;
      } {
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

    if (conn.isConnected) {
      const {query, params} = this.getBaseObjectsQuery();
      const data = yield* _await(
        conn.query(
          `SELECT count((${query}${
            this.filter ? ` FILTER ${this.filter}` : ""
          }))`,
          true,
          params
        )
      );

      if (data.result) {
        this.rowCount = parseInt(data.result[0], 10);
      }
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
          objectType: data.__tname__,
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

  dataCodecs: _ICodec[] | null = null;

  @observable
  fetchingData = false;

  discardLastFetch = false;

  @modelFlow
  _fetchData = _async(function* (this: DataInspector) {
    const offset = this._pendingOffsets[0];

    if (this.fetchingData || offset === undefined) {
      return;
    }

    this.fetchingData = true;

    let fetchNextOffset = false;

    try {
      const conn = connCtx.get(this)!;
      const dataQuery = this.dataQuery;

      if (dataQuery && conn.isConnected) {
        // console.log(`fetching ${offset}`);
        const data = yield* _await(
          conn.query(dataQuery.query, true, {
            offset: offset * fetchBlockSize,
            ...dataQuery.params,
          })
        );

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
    } finally {
      this.fetchingData = false;
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
  _refreshData(updateCount: boolean = false) {
    this.data.clear();
    this.expandedRows = [];
    this.gridRef?.resetAfterRowIndex(0);
    this._pendingOffsets = [...this.visibleOffsets];

    if (this.fetchingData) {
      this.discardLastFetch = true;
    }

    if (updateCount) {
      this._updateRowCount();
    }
    this._fetchData();
  }

  // queries

  get _baseObjectsQuery() {
    return this.parentObject
      ? `(SELECT ${
          this.parentObject.subtypeName ?? this.parentObject.objectType
        } FILTER .id = <uuid>'${this.parentObject.id}').${
          this.parentObject.fieldName
        }`
      : this.objectName;
  }

  getBaseObjectsQuery() {
    if (this.parentObject?.editMode) {
      return {
        query: `with linkedObjects := (${this._baseObjectsQuery})
      select ${this.objectName} {
        __isLinked := ${this.objectName} in linkedObjects
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
              .get(`${this.parentObject.id}__${this.parentObject.fieldName}`)
              ?.changes.values() ?? []),
          ]
            .filter((change) => change.kind !== UpdateLinkChangeKind.Remove)
            .map((change) => change.id)
        : null;
      if (addedLinkIds?.length) {
        return {
          query: `select {
            (${this._baseObjectsQuery}),
            (select ${this.objectName} filter .id in <uuid>array_unpack(<array<std::str>>$addedLinkIds))
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
          ? `${sortField.subtypeName ? `[IS ${sortField.subtypeName}]` : ""}.${
              sortField.name
            } ${this.sortBy!.direction} THEN`
          : ""
      } .id OFFSET <int32>$offset LIMIT ${fetchBlockSize})
    SELECT rows {
      id,
      ${inEditMode ? "__isLinked," : ""}
      ${this.fields
        .filter((field) => field.name !== "id")
        .map((field) => {
          const selectName = `${
            field.subtypeName ? `[IS ${field.subtypeName}]` : ""
          }.${field.name}`;

          if (field.type === ObjectFieldType.property) {
            return `${field.queryName} := ${
              field.typename === "std::str"
                ? `${selectName}[0:100]`
                : selectName
            }`;
          } else {
            const linkSelect = `(SELECT ${selectName} LIMIT 3)`;
            return `${field.queryName} := ${
              field.required ? `assert_exists(${linkSelect})` : linkSelect
            },
              __count_${field.queryName} := count(${selectName})`;
          }
        })
        .filter((line) => !!line)
        .join(",\n")}
    } `,
      params,
    };
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
    return (
      this.filterEditStr
        .toString()
        .replace(/^filter\s/i, "")
        .trim() !== this.filter
    );
  }

  @modelFlow
  applyFilter = _async(function* (this: DataInspector) {
    const filter = this.filterEditStr
      .toString()
      .replace(/^filter\s/i, "")
      .trim();

    if (!filter) {
      this.filterError = "";
      this.filter = "";

      this._refreshData(true);

      return;
    }

    const filterCheckQuery = `SELECT ${this._baseObjectsQuery} FILTER ${filter} ORDER BY .id`;

    const conn = connCtx.get(this)!;

    if (conn.isConnected) {
      try {
        yield* _await(conn.prepare(filterCheckQuery, true));
      } catch (err: any) {
        const errMessage = String(err.message);
        this.filterError = /unexpected 'ORDER'/i.test(errMessage)
          ? "Filter can only contain 'FILTER' clause"
          : errMessage;
        return;
      }

      this.filterError = "";
      this.filter = filter;

      this._refreshData(true);
    }
  });

  @modelAction
  revertFilter() {
    this.filterEditStr = Text.of([`filter ${this.filter}`]);
    this.filterError = "";
  }

  @modelAction
  clearFilter() {
    this.filter = "";
    this.filterEditStr = Text.of(["filter "]);
    this.filterError = "";

    this._refreshData(true);
  }

  @modelAction
  setFieldWidth(field: ObjectField, width: number) {
    this.fieldWidthsUpdated = true;
    field.width = Math.max(width, 100);
  }
}

@model("ExpandedInspector")
class ExpandedInspector extends Model({
  objectId: prop<string>(),
  objectType: prop<string>(),

  state: prop<InspectorState>(
    () => new InspectorState({autoExpandDepth: 3, countPrefix: "__count_"})
  ),
}) {
  onInit() {
    this.state.loadNestedData = this.loadNestedData.bind(this);

    resultGetterCtx.set(this, async () => {
      const conn = connCtx.get(this)!;
      const {result} = await conn.query(
        this.dataQuery,
        true,
        {
          objectId: this.objectId,
        },
        true
      );
      if (result) {
        return {data: result, codec: result._codec};
      }
    });
  }

  async loadNestedData(
    parentObjectTypeName: string,
    parentObjectId: string,
    fieldName: string
  ) {
    const dbState = dbCtx.get(this)!;

    const parentObjectType = dbState.schemaData?.data.objects.find(
      (obj) => obj.name === parentObjectTypeName
    );
    if (!parentObjectType) {
      throw new Error(
        `Could not find objec type '${parentObjectTypeName}' in schema`
      );
    }

    const objectTypeName = parentObjectType.links.find(
      (link) => link.name === fieldName
    )?.targetNames?.[0];
    const objectType = dbState.schemaData?.data.objects.find(
      (obj) => obj.name === objectTypeName
    );
    if (!objectType) {
      throw new Error(
        `Could not find objec type '${objectTypeName}' in schema`
      );
    }

    const query = `with parentObj := (select ${parentObjectTypeName} filter .id = <uuid><str>$id)
      select parentObj.${fieldName} {
        ${[
          ...objectType.properties.map((prop) => prop.name),
          ...objectType.links.map(
            (link) => `${link.name} := (SELECT .${link.name} LIMIT 0),
        __count_${link.name} := count(.${link.name})`
          ),
        ].join(",\n")}
      }`;

    const {result} = await dbState.connection.query(
      query,
      true,
      {
        id: parentObjectId,
      },
      true
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
    const dataInspector = findParent<DataInspector>(
      this,
      (parent) => parent instanceof DataInspector
    )!;

    return `SELECT ${dataInspector.objectName} {
      ${dataInspector
        .fields!.filter(
          (field) =>
            !field.subtypeName || field.subtypeName === this.objectType
        )
        .map((field) => {
          if (field.type === ObjectFieldType.property) {
            return `${field.subtypeName ? `[IS ${field.subtypeName}].` : ""}${
              field.name
            }`;
          } else {
            const linkSelect = `(SELECT ${
              field.subtypeName ? `[IS ${field.subtypeName}]` : ""
            }.${field.name} {
            ${field.subFields
              .map((subField) =>
                subField.type === ObjectFieldType.property
                  ? subField.name
                  : `${subField.name} := (SELECT .${subField.name} LIMIT 0),
                  __count_${subField.name} := count(.${subField.name})`
              )
              .join(",\n")}
          } LIMIT 10)`;
            return `${field.name} := ${
              field.required ? `assert_exists(${linkSelect})` : linkSelect
            },
          __count_${field.name} := count(${
              field.subtypeName ? `[IS ${field.subtypeName}]` : ""
            }.${field.name})`;
          }
        })
        .join(",\n")}
    } FILTER .id = <uuid><str>$objectId LIMIT 1`;
  }
}
