import {action, observable, runInAction} from "mobx";
import {model, Model} from "mobx-keystone";
import {connCtx} from "../connection";

enum EditKind {
  UpdateProperty,
}

type CellEdit = {
  kind: EditKind.UpdateProperty;
  objectId: string;
  objectTypeName: string;
  fieldName: string;
  value: any;
};

@model("DataEditingManager")
export class DataEditingManager extends Model({}) {
  @observable
  pendingCellEdits: Map<string, Map<string, CellEdit>> = new Map();

  @observable.ref
  activeCellEdit: CellEdit | null = null;

  @action
  startEditingCell(
    objectId: string,
    objectTypeName: string,
    fieldName: string,
    initialValue: any
  ) {
    console.log(objectId, fieldName, objectTypeName);
    if (!this.pendingCellEdits.has(objectId)) {
      this.pendingCellEdits.set(objectId, new Map());
    }
    const objectEdits = this.pendingCellEdits.get(objectId)!;

    if (!objectEdits.has(fieldName)) {
      objectEdits.set(fieldName, {
        kind: EditKind.UpdateProperty,
        objectId,
        objectTypeName,
        fieldName,
        value: initialValue,
      });
    }
    this.activeCellEdit = objectEdits.get(fieldName)!;
  }

  @action
  updateCellEdit(cellEdit: CellEdit, value: any) {
    cellEdit.value = value;
  }

  @action
  finishEditingCell() {
    this.activeCellEdit = null;
  }

  @action
  clearAllPendingEdits() {
    this.pendingCellEdits.clear();
    this.activeCellEdit = null;
  }

  @action
  async commitPendingEdits() {
    const conn = connCtx.get(this)!;

    this.activeCellEdit = null;

    const edits = [...this.pendingCellEdits.values()].flatMap((objectEdits) =>
      [...objectEdits.values()].map(
        (cellEdit) =>
          `update ${
            cellEdit.objectTypeName
          } filter .id = <uuid>${JSON.stringify(cellEdit.objectId)} set { ${
            cellEdit.fieldName
          } := ${JSON.stringify(cellEdit.value)} }`
      )
    );
    for (const editQuery of edits) {
      await conn.query(editQuery);
    }

    runInAction(() => this.pendingCellEdits.clear());
  }
}
