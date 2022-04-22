import {action, computed, observable, runInAction} from "mobx";
import {model, Model} from "mobx-keystone";
import {connCtx} from "../../../state";

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
}

interface UpdateLinkEdit {
  kind: EditKind.UpdateLink;
  objectId: string;
  objectTypeName: string;
  fieldName: string;
  changes: Map<string, UpdateLinkChange>;
}

interface InsertObjectEdit {
  kind: EditKind.InsertObject;
}

interface DeleteObjectEdit {
  kind: EditKind.DeleteObject;
  objectId: string;
  objectTypeName: string;
}

@model("DataEditingManager")
export class DataEditingManager extends Model({}) {
  @observable
  propertyEdits: Map<string, UpdatePropertyEdit> = new Map();

  @observable.ref
  activePropertyEdit: UpdatePropertyEdit | null = null;

  @observable
  linkEdits: Map<string, UpdateLinkEdit> = new Map();

  @observable
  insertEdits: Map<string, Set<InsertObjectEdit>> = new Map();

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
  startEditingCell(
    objectId: string,
    objectTypeName: string,
    fieldName: string,
    initialValue: any
  ) {
    console.log(objectId, fieldName, objectTypeName);

    const cellId = `${objectId}__${fieldName}`;

    if (!this.propertyEdits.has(cellId)) {
      this.propertyEdits.set(cellId, {
        kind: EditKind.UpdateProperty,
        objectId,
        objectTypeName,
        fieldName,
        value: initialValue,
      });
    }

    this.activePropertyEdit = this.propertyEdits.get(cellId)!;
  }

  @action
  updateCellEdit(cellEdit: UpdatePropertyEdit, value: any) {
    cellEdit.value = value;
  }

  @action
  finishEditingCell() {
    this.activePropertyEdit = null;
  }

  @action
  createNewRow(objectTypeName: string) {
    console.log(objectTypeName);
    if (!this.insertEdits.has(objectTypeName)) {
      this.insertEdits.set(objectTypeName, new Set());
    }
    this.insertEdits.get(objectTypeName)!.add({
      kind: EditKind.InsertObject,
    });
  }

  @action
  toggleRowDelete(objectId: string, objectTypeName: string) {
    console.log(objectId, objectTypeName);
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

  @action
  addLinkUpdate(
    objectId: string,
    objectTypeName: string,
    fieldName: string,
    kind: UpdateLinkChangeKind,
    linkObjectId: string
  ) {
    const linkId = `${objectId}__${fieldName}`;

    if (!this.linkEdits.has(linkId)) {
      this.linkEdits.set(linkId, {
        kind: EditKind.UpdateLink,
        objectId,
        objectTypeName,
        fieldName,
        changes: new Map(),
      });
    }

    const linkChanges = this.linkEdits.get(linkId)!.changes;
    linkChanges.set(linkObjectId, {id: linkObjectId, kind});
  }

  @action
  removeLinkUpdate(objectId: string, fieldName: string, linkObjectId: string) {
    const linkId = `${objectId}__${fieldName}`;

    const linkEdit = this.linkEdits.get(linkId);

    linkEdit?.changes.delete(linkObjectId);

    if (linkEdit?.changes.size === 0) {
      this.linkEdits.delete(linkId);
    }
  }

  @action
  clearAllPendingEdits() {
    this.propertyEdits.clear();
    this.activePropertyEdit = null;
    this.linkEdits.clear();
    this.insertEdits.clear();
    this.deleteEdits.clear();
  }

  @action
  async commitPendingEdits() {
    const conn = connCtx.get(this)!;

    this.activePropertyEdit = null;

    const edits = [...this.propertyEdits.values()].map(
      (cellEdit) =>
        `update ${cellEdit.objectTypeName} filter .id = <uuid>${JSON.stringify(
          cellEdit.objectId
        )} set { ${cellEdit.fieldName} := ${JSON.stringify(cellEdit.value)} }`
    );

    for (const editQuery of edits) {
      await conn.query(editQuery);
    }

    runInAction(() => this.propertyEdits.clear());
  }
}
