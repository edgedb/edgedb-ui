import {computed} from "mobx";
import {Model, model, prop, modelAction} from "mobx-keystone";

export enum graphType {
  area = "area",
  flame = "flame",
}

export enum graphUnit {
  time = "time",
  cost = "cost",
}

const userGraphTypeStorageKey = "edgedbUserGraphTypeChoice";

@model("ExplainGraphSettings")
export class ExplainGraphSettings extends Model({
  graphType: prop<graphType>(),
  graphUnit: prop<graphUnit>().withSetter(),
  userUnitChoice: prop<graphUnit | null>().withSetter(),
}) {
  @computed
  get isTimeGraph() {
    return this.graphUnit === graphUnit.time;
  }

  @computed
  get isAreaGraph() {
    return this.graphType === graphType.area;
  }

  @modelAction
  setGraphType(type: graphType) {
    this.graphType = type;
    localStorage.setItem(userGraphTypeStorageKey, JSON.stringify(type));
  }
}

const userStoredTypeChoice = localStorage.getItem(userGraphTypeStorageKey);

const explainGraphSettings = new ExplainGraphSettings({
  graphType: userStoredTypeChoice
    ? JSON.parse(userStoredTypeChoice)
    : graphType.area,
  graphUnit: graphUnit.time,
  userUnitChoice: null,
});

export {explainGraphSettings};
