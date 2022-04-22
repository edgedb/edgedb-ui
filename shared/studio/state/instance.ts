import {createContext, useContext} from "react";
import {action, observable, runInAction, when} from "mobx";
import {
  Model,
  model,
  modelAction,
  objectMap,
  prop,
  ModelClass,
  AnyModel,
} from "mobx-keystone";

import {DatabaseState} from "./database";
import {Connection} from "./connection";

@model("InstanceState")
export class InstanceState extends Model({
  serverUrl: prop<string>(),

  databasePageStates: prop(() => objectMap<DatabaseState>()),
}) {
  @observable
  instanceName: string | null = null;

  @observable
  databases:
    | {
        name: string;
      }[]
    | null = null;

  defaultConnection: Connection | null = null;

  async fetchInstanceInfo() {
    const res = await fetch(`${this.serverUrl}/ui/instance-info`);
    const data = await res.json();

    // console.log(data);

    runInAction(() => {
      this.instanceName = data.instance_name ?? "_localdev";
      this.databases = Object.values(data.databases).map((db: any) => ({
        name: db.name,
      }));
    });
  }

  onInit() {
    this.fetchInstanceInfo();

    when(
      () =>
        this.defaultConnection === null && (this.databases?.length ?? 0) > 0,
      () => {
        this.defaultConnection = new Connection({
          config: {
            database: this.databases![0].name,
            serverUrl: this.serverUrl,
          },
        });
      }
    );
  }

  @modelAction
  getDatabasePageState(
    databaseName: string,
    tabs: {path: string; state?: ModelClass<AnyModel>}[]
  ) {
    if (!this.databasePageStates.has(databaseName)) {
      this.databasePageStates.set(
        databaseName,
        new DatabaseState({
          name: databaseName,
          serverUrl: this.serverUrl,
          tabStates: objectMap(
            tabs
              .filter((t) => t.state)
              .map((t) => [t.state!.name, new t.state!({})])
          ),
        })
      );
    }
    return this.databasePageStates.get(databaseName)!;
  }
}

export const InstanceStateContext = createContext<InstanceState | null>(null);

export function useInstanceState() {
  return useContext(InstanceStateContext);
}
