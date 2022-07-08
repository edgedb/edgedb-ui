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

import {Session} from "edgedb/dist/options";
import {AdminUIFetchConnection} from "edgedb/dist/fetchConn";
import {OutputFormat, Cardinality} from "edgedb/dist/ifaces";
import {codecsRegistry} from "../utils/decodeRawBuffer";

import {cleanupOldSchemaDataForInstance} from "../idbStore";

import {DatabaseState} from "./database";
import {Connection} from "./connection";

@model("InstanceState")
export class InstanceState extends Model({
  serverUrl: prop<string>(),
  authToken: prop<string | null>(),

  databasePageStates: prop(() => objectMap<DatabaseState>()),
}) {
  @observable instanceName: string | null = null;
  @observable databases: string[] | null = null;
  @observable roles: string[] | null = null;

  defaultConnection: Connection | null = null;

  async fetchInstanceInfo() {
    const client = AdminUIFetchConnection.create(
      {
        address: this.serverUrl,
        database: "__edgedbsys__",
        user: "edgedb",
        token: this.authToken!,
      },
      codecsRegistry
    );
    const data = await client.fetch(
      `
      select {
        instanceName := sys::get_instance_name(),
        databases := sys::Database.name,
        roles := sys::Role.name,
      }`,
      null,
      OutputFormat.BINARY,
      Cardinality.ONE,
      Session.defaults()
    );

    runInAction(() => {
      this.instanceName = data.instanceName ?? "_localdev";
      this.databases = data.databases;
      this.roles = data.roles;
    });

    cleanupOldSchemaDataForInstance(this.instanceName!, this.databases!);
  }

  onInit() {
    this.fetchInstanceInfo();

    when(
      () =>
        this.defaultConnection === null &&
        this.authToken != null &&
        (this.databases?.length ?? 0) > 0,
      () => {
        this.defaultConnection = new Connection({
          config: {
            serverUrl: this.serverUrl,
            authToken: this.authToken!,
            database: this.databases![0],
            user: this.roles![0],
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
          tabStates: objectMap(
            tabs
              .filter((t) => t.state)
              .map((t) => {
                const state = new t.state!({});
                return [state.$modelType, state];
              })
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
