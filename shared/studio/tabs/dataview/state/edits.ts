import {action, computed, observable, runInAction} from "mobx";
import {model, Model} from "mobx-keystone";

import {getNameOfSchemaType, SchemaType} from "@edgedb/common/schemaData";

import {connCtx, dbCtx} from "../../../state";

enum EditKind {
  UpdateProperty,
  UpdateLink,
  InsertObject,
  DeleteObject,
}

interface UpdatePropertyEdit {
  kind: EditKind.UpdateProperty;
  objectId: string;
  objectTypeName: string;
  fieldName: string;
  value: any;
}

export enum UpdateLinkChangeKind {
  Add,
  Remove,
  Set,
}
interface UpdateLinkChange {
  kind: UpdateLinkChangeKind;
  id: string;
  typename: string;
}

interface UpdateLinkEdit {
  kind: EditKind.UpdateLink;
  objectId: string | number;
  objectTypeName: string;
  fieldName: string;
  linkTypeName: string;
  changes: Map<string, UpdateLinkChange>;
  inserts: Set<InsertObjectEdit>;
}

interface InsertObjectEdit {
  kind: EditKind.InsertObject;
  id: number;
  objectTypeName: string;
  data: {[fieldName: string]: any};
}

interface DeleteObjectEdit {
  kind: EditKind.DeleteObject;
  objectId: string;
  objectTypeName: string;
}

let insertEditId = 0;

@model("DataEditingManager")
export class DataEditingManager extends Model({}) {
  @observable
  propertyEdits: Map<string, UpdatePropertyEdit> = new Map();

  @observable.ref
  activePropertyEditId: string | null = null;

  @observable
  linkEdits: Map<string, UpdateLinkEdit> = new Map();

  @observable
  insertEdits: Map<number, InsertObjectEdit> = new Map();

  @observable
  deleteEdits: Map<string, DeleteObjectEdit> = new Map();

  @computed
  get hasPendingEdits(): boolean {
    return (
      this.propertyEdits.size > 0 ||
      this.linkEdits.size > 0 ||
      this.insertEdits.size > 0 ||
      this.deleteEdits.size > 0
    );
  }

  @action
  startEditingCell(objectId: string | number, fieldName: string) {
    const cellId = `${objectId}__${fieldName}`;

    this.activePropertyEditId = cellId;
  }

  @action
  updateCellEdit(
    objectId: string | number,
    objectTypeName: string,
    fieldName: string,
    value: any
  ) {
    if (typeof objectId === "string") {
      const cellId = `${objectId}__${fieldName}`;
      if (!this.propertyEdits.has(cellId)) {
        this.propertyEdits.set(cellId, {
          kind: EditKind.UpdateProperty,
          objectId,
          objectTypeName,
          fieldName,
          value,
        });
      } else {
        this.propertyEdits.get(cellId)!.value = value;
      }
    } else {
      this.insertEdits.get(objectId)!.data[fieldName] = value;
    }
  }

  @action
  finishEditingCell() {
    this.activePropertyEditId = null;
  }

  @action
  clearPropertyEdit(objectId: string | number, fieldName: string) {
    const cellId = `${objectId}__${fieldName}`;
    if (this.activePropertyEditId === cellId) {
      this.activePropertyEditId = null;
    }
    if (typeof objectId === "string") {
      this.propertyEdits.delete(cellId);
    } else {
      this.insertEdits.get(objectId)!.data[fieldName] = undefined;
    }
  }

  @action
  createNewRow(objectTypeName: string) {
    const insertId = insertEditId++;
    this.insertEdits.set(insertId, {
      kind: EditKind.InsertObject,
      id: insertId,
      objectTypeName,
      data: {
        id: insertId,
        __tname__: objectTypeName,
      },
    });
  }

  @action
  removeInsertedRow(insertedRow: InsertObjectEdit) {
    this.insertEdits.delete(insertedRow.id);

    for (const [linkId, linkEdit] of this.linkEdits) {
      linkEdit.inserts.delete(insertedRow);

      this._cleanUpLinkEdit(linkId);
    }
  }

  @action
  toggleRowDelete(objectId: string, objectTypeName: string) {
    if (this.deleteEdits.has(objectId)) {
      this.deleteEdits.delete(objectId);
    } else {
      this.deleteEdits.set(objectId, {
        kind: EditKind.DeleteObject,
        objectId,
        objectTypeName,
      });
    }
  }

  _cleanUpLinkEdit(linkId: string) {
    const linkEdit = this.linkEdits.get(linkId)!;

    if (linkEdit.changes.size === 0 && linkEdit.inserts.size === 0) {
      this.linkEdits.delete(linkId);
    }
  }

  @action
  addLinkUpdate(
    objectId: string | number,
    objectTypeName: string,
    fieldName: string,
    linkTypeName: string,
    kind: UpdateLinkChangeKind,
    linkObjectId: string,
    linkObjectTypename: string
  ) {
    const linkId = `${objectId}__${fieldName}`;

    if (!this.linkEdits.has(linkId)) {
      this.linkEdits.set(linkId, {
        kind: EditKind.UpdateLink,
        objectId,
        objectTypeName,
        fieldName,
        linkTypeName,
        changes: new Map(),
        inserts: new Set(),
      });
    }

    const linkChanges = this.linkEdits.get(linkId)!.changes;

    if (kind === UpdateLinkChangeKind.Set) {
      linkChanges.clear();
      this.linkEdits.get(linkId)!.inserts.clear();
    }

    linkChanges.set(linkObjectId, {
      id: linkObjectId,
      kind,
      typename: linkObjectTypename,
    });
  }

  @action
  removeLinkUpdate(
    objectId: string | number,
    fieldName: string,
    linkObjectId: string
  ) {
    const linkId = `${objectId}__${fieldName}`;

    const linkEdit = this.linkEdits.get(linkId);

    linkEdit?.changes.delete(linkObjectId);

    this._cleanUpLinkEdit(linkId);
  }

  @action
  clearLinkEdits(linkId: string) {
    this.linkEdits.delete(linkId);
  }

  @action
  toggleLinkInsert(
    objectId: string | number,
    objectTypeName: string,
    fieldName: string,
    linkTypeName: string,
    insertedRow: InsertObjectEdit,
    setLink: boolean = false
  ) {
    const linkId = `${objectId}__${fieldName}`;

    if (!this.linkEdits.has(linkId)) {
      this.linkEdits.set(linkId, {
        kind: EditKind.UpdateLink,
        objectId,
        objectTypeName,
        fieldName,
        linkTypeName,
        changes: new Map(),
        inserts: new Set(),
      });
    }

    const linkEdit = this.linkEdits.get(linkId)!;

    if (setLink) {
      linkEdit.inserts.clear();
      linkEdit.changes.clear();
    }

    if (linkEdit.inserts.has(insertedRow)) {
      linkEdit.inserts.delete(insertedRow);
    } else {
      linkEdit.inserts.add(insertedRow);
    }

    this._cleanUpLinkEdit(linkId);
  }

  @action
  clearAllPendingEdits() {
    this.propertyEdits.clear();
    this.activePropertyEditId = null;
    this.linkEdits.clear();
    this.insertEdits.clear();
    this.deleteEdits.clear();
  }

  generateStatements() {
    const schemaData = dbCtx.get(this)!.schemaData!;

    const statements: {code: string; varName: string; error?: string}[] = [];
    const params: {[key: string]: {type: SchemaType; value: any}} = {};

    function generatePropUpdate(
      objectTypeName: string,
      propName: string,
      val: any
    ) {
      const type =
        schemaData.objectsByName.get(objectTypeName)?.properties[propName];
      return `${propName} := ${generateParamExpr(
        schemaData.types.get(type!.target.id)!,
        val,
        params,
        type!.cardinality === "Many"
      )}`;
    }

    const updateEdits = new Map<
      string,
      {
        objectTypeName: string;
        props: UpdatePropertyEdit[];
        links: UpdateLinkEdit[];
      }
    >();
    const insertLinkEdits = new Map<number, UpdateLinkEdit[]>();

    for (const edit of [
      ...this.propertyEdits.values(),
      ...this.linkEdits.values(),
    ]) {
      if (typeof edit.objectId === "string") {
        if (!updateEdits.has(edit.objectId)) {
          updateEdits.set(edit.objectId, {
            objectTypeName: edit.objectTypeName,
            props: [],
            links: [],
          });
        }
        if (edit.kind === EditKind.UpdateProperty) {
          updateEdits.get(edit.objectId)!.props.push(edit);
        } else {
          updateEdits.get(edit.objectId)!.links.push(edit);
        }
      } else {
        if (!insertLinkEdits.has(edit.objectId)) {
          insertLinkEdits.set(edit.objectId, []);
        }
        insertLinkEdits.get(edit.objectId)!.push(edit as UpdateLinkEdit);
      }
    }

    const inserts = new Map<
      number,
      {id: number; statement: string; deps: Set<number>; error?: string}
    >();
    for (const insertEdit of this.insertEdits.values()) {
      const fields: string[] = [];
      const deps: number[] = [];

      const type = schemaData.objectsByName.get(insertEdit.objectTypeName)!;

      for (const [key, val] of Object.entries(insertEdit.data)) {
        if (key === "id" || key === "__tname__") continue;
        fields.push(generatePropUpdate(insertEdit.objectTypeName, key, val));
      }

      const linkEdits = insertLinkEdits.get(insertEdit.id) ?? [];

      for (const linkEdit of linkEdits) {
        fields.push(generateLinkUpdate(linkEdit, deps, true));
      }

      const setLinks = new Set(
        linkEdits.map((linkEdit) => linkEdit.fieldName)
      );
      const missingFields = [
        ...Object.values(type.properties).filter(
          (prop) =>
            prop.required &&
            !prop.default &&
            insertEdit.data[prop.name] == null
        ),

        ...Object.values(type.links).filter(
          (link) => link.required && !link.default && !setLinks.has(link.name)
        ),
      ];

      inserts.set(insertEdit.id, {
        id: insertEdit.id,
        statement: `insert ${insertEdit.objectTypeName} {\n  ${fields.join(
          ",\n  "
        )}\n}`,
        deps: new Set(deps),
        error: missingFields.length
          ? `Values are missing for required fields: ${missingFields
              .map((field) => `'${field.name}'`)
              .join(", ")}`
          : undefined,
      });
    }
    for (const insert of topoSort(inserts)) {
      statements.push({
        varName: `insert${insert.id}`,
        code: insert.statement,
        error: insert.error,
      });
    }

    let updateCount = 1;
    for (const [objectId, edits] of updateEdits) {
      const editLines: string[] = [];

      const type = schemaData.objectsByName.get(edits.objectTypeName)!;

      for (const propEdit of edits.props) {
        editLines.push(
          generatePropUpdate(
            propEdit.objectTypeName,
            propEdit.fieldName,
            propEdit.value
          )
        );
      }
      for (const linkEdit of edits.links) {
        editLines.push(
          generateLinkUpdate(
            linkEdit,
            undefined,
            type.links[linkEdit.fieldName]!.cardinality === "One"
          )
        );
      }

      statements.push({
        varName: `update${updateCount++}`,
        code: `update ${edits.objectTypeName}
filter .id = <uuid>'${objectId}'
set {
  ${editLines.join(",\n  ")}
}`,
      });
    }

    let deleteCount = 1;
    for (const deleteEdit of this.deleteEdits.values()) {
      statements.push({
        varName: `delete${deleteCount++}`,
        code: `delete ${deleteEdit.objectTypeName} filter .id = <uuid>'${deleteEdit.objectId}'`,
      });
    }

    return {statements, params};
  }

  @action
  async commitPendingEdits() {
    const conn = connCtx.get(this)!;

    this.activePropertyEditId = null;

    const {statements, params} = this.generateStatements();
    const query = generateQueryFromStatements(statements);

    await conn.query(
      query,
      Object.keys(params).length
        ? Object.keys(params).reduce((args, key) => {
            args[key] = params[key].value;
            return args;
          }, {} as {[key: string]: any})
        : undefined
    );

    runInAction(() => this.propertyEdits.clear());
  }
}

export function generateQueryFromStatements(
  statements: {varName: string; code: string}[]
) {
  return `with\n${statements
    .map(({varName, code}) => `${varName} := (${code})`)
    .join(",\n")}
select {\n  ${statements.map(({varName}) => varName).join(",\n  ")}\n}`;
}

function generateLinkUpdate(
  linkEdits: UpdateLinkEdit,
  deps?: number[],
  forceLinkSet?: boolean
): string {
  const links: string[] = [];
  let op = ":=";
  const changes = [...linkEdits.changes.values()];
  let addCount = 0,
    removeCount = 0;
  for (const change of changes) {
    if (change.kind === UpdateLinkChangeKind.Add) {
      addCount += 1;
    } else if (change.kind === UpdateLinkChangeKind.Remove) {
      removeCount += 1;
    }
  }
  if (addCount + linkEdits.inserts.size > 0 && removeCount > 0) {
    links.push(
      `(select .${linkEdits.fieldName} filter .id not in <uuid>{${changes
        .filter((change) => change.kind === UpdateLinkChangeKind.Remove)
        .map(({id}) => `'${id}'`)
        .join(", ")}})`,
      `(select ${linkEdits.linkTypeName} filter .id in <uuid>{${changes
        .filter((change) => change.kind === UpdateLinkChangeKind.Add)
        .map(({id}) => `'${id}'`)
        .join(", ")}})`
    );
  } else {
    op =
      !forceLinkSet && changes.length === addCount + removeCount
        ? removeCount && !linkEdits.inserts.size
          ? "-="
          : "+="
        : ":=";
    if (changes.length) {
      links.push(
        `(select ${linkEdits.linkTypeName} filter .id ${
          changes.length === 1
            ? `= <uuid>'${changes[0].id}'`
            : `in <uuid>{${changes.map(({id}) => `'${id}'`).join(", ")}}`
        })`
      );
    }
  }
  if (linkEdits.inserts.size) {
    deps?.push(...[...linkEdits.inserts.values()].map(({id}) => id));
    links.push(
      ...[...linkEdits.inserts.values()].map(({id}) => `insert${id}`)
    );
  }

  return `${linkEdits.fieldName} ${op} ${
    links.length > 1
      ? `distinct {\n    ${links.join(",\n    ")}\n  }`
      : links[0]
  }`;
}

function generateParamExpr(
  type: SchemaType,
  data: any,
  params: {[key: string]: {type: SchemaType; value: any}},
  multi?: boolean
): string {
  if (data === null) {
    return `<${getNameOfSchemaType(type)}>{}`;
  }

  if (multi) {
    return `{${(data as any[])
      .map((item) => generateParamExpr(type, item, params))
      .join(", ")}}`;
  }

  if (type.schemaType === "Scalar") {
    const paramName = `p${Object.keys(params).length}`;
    params[paramName] = {type, value: data};
    return `<${type.name}>$${paramName}`;
  }
  if (type.schemaType === "Array") {
    if (type.elementType.schemaType === "Scalar") {
      const paramName = `p${Object.keys(params).length}`;
      params[paramName] = {type, value: data};
      return `<array<${type.elementType.name}>>$${paramName}`;
    } else {
      return `[${(data as any[])
        .map((item) => generateParamExpr(type.elementType, item, params))
        .join(", ")}]`;
    }
  }
  if (type.schemaType === "Tuple") {
    return `(${type.elements
      .map((element, i) =>
        generateParamExpr(element.type, data[element.name ?? i], params)
      )
      .join(", ")}${type.elements.length === 1 ? "," : ""})`;
  }

  throw new Error(`Couldn't create expr for param type: ${type.name}`);
}

interface TopoItem<T extends any> {
  deps: Set<T>;
}
function topoSort<ID extends any, T extends TopoItem<ID>>(
  items: Map<ID, T>
): T[] {
  const sorted: T[] = [];

  const unvisited = new Set(items.values());
  const visiting = new Set<T>();

  for (const item of unvisited) {
    visit(item);
  }

  function visit(item: T) {
    if (!unvisited.has(item)) {
      return;
    }

    if (visiting.has(item)) {
      throw new Error("Cyclic dependency");
    }

    visiting.add(item);

    for (const depId of item.deps) {
      visit(items.get(depId)!);
    }

    visiting.delete(item);
    unvisited.delete(item);

    sorted.push(item);
  }

  return sorted;
}
