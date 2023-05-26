import {createContext, useContext} from "react";
import {action, computed, observable, runInAction, when} from "mobx";
import {
  Model,
  model,
  modelAction,
  objectMap,
  prop,
  ModelClass,
  AnyModel,
  createContext as createMobxContext,
} from "mobx-keystone";

import {AuthenticationError} from "edgedb";

import {Session} from "edgedb/dist/options";
import {AdminUIFetchConnection} from "edgedb/dist/fetchConn";
import {OutputFormat, Cardinality} from "edgedb/dist/ifaces";
import {codecsRegistry} from "../utils/decodeRawBuffer";

import {cleanupOldSchemaDataForInstance} from "../idbStore";

import {DatabaseState} from "./database";
import {Connection} from "./connection";

export const instanceCtx = createMobxContext<InstanceState>();

@model("InstanceState")
export class InstanceState extends Model({
  _instanceId: prop<string | null>(null),
  serverUrl: prop<string>(),
  authUsername: prop<string | null>(null),
  authToken: prop<string | null>(),

  databasePageStates: prop(() => objectMap<DatabaseState>()),
}) {
  @observable instanceName: string | null = null;
  @observable databases: string[] | null = null;
  @observable roles: string[] | null = null;

  @computed
  get instanceId() {
    return this._instanceId ?? this.instanceName;
  }

  defaultConnection: Connection | null = null;

  _refreshAuthToken: (() => void) | null = null;

  async fetchInstanceInfo() {
    const client = AdminUIFetchConnection.create(
      {
        address: this.serverUrl,
        database: "__edgedbsys__",
        user: this.authUsername ?? "edgedb",
        token: this.authToken!,
      },
      codecsRegistry
    );
    try {
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
    } catch (err) {
      if (err instanceof AuthenticationError) {
        this._refreshAuthToken?.();
      } else {
        throw err;
      }
    }
  }

  onInit() {
    instanceCtx.set(this, this);
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
            user: this.authUsername ?? this.roles![0],
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

  @observable creatingExampleDB = false;

  async createExampleDatabase(exampleSchema: Promise<string>) {
    runInAction(() => (this.creatingExampleDB = true));
    try {
      const schemaScript = await exampleSchema;
      await this.defaultConnection!.execute(`create database _example`);
      const exampleConn = new Connection({
        config: {
          serverUrl: this.serverUrl,
          authToken: this.authToken!,
          database: "_example",
          user: this.authUsername ?? this.roles![0],
        },
      });
      await exampleConn.execute(schemaScript);
      await this.fetchInstanceInfo();
    } finally {
      runInAction(() => (this.creatingExampleDB = false));
    }
  }
}

export const InstanceStateContext = createContext<InstanceState>(null!);

export function useInstanceState() {
  return useContext(InstanceStateContext);
}
