import {createContext, useContext} from "react";
import {computed, observable, reaction, runInAction, when} from "mobx";
import {
  Model,
  model,
  modelAction,
  objectMap,
  prop,
  ModelClass,
  AnyModel,
  createContext as createMobxContext,
  ModelCreationData,
  getTypeInfo,
  ModelTypeInfo,
  frozen,
} from "mobx-keystone";

import {AuthenticationError} from "edgedb";

import {Session} from "edgedb/dist/options";
import {AdminUIFetchConnection} from "edgedb/dist/fetchConn";
import {OutputFormat, Cardinality} from "edgedb/dist/ifaces";
import {codecsRegistry} from "../utils/decodeRawBuffer";

import {cleanupOldSchemaDataForInstance} from "../idbStore";

import {DatabaseState} from "./database";
import {Connection, createAuthenticatedFetch} from "./connection";

export const instanceCtx = createMobxContext<InstanceState>();

export async function createInstanceState(
  props: ModelCreationData<InstanceState>,
  serverVersion: {major: number; minor: number}
) {
  const instance = new InstanceState(props);
  runInAction(() => (instance.serverVersion = serverVersion));

  await instance.fetchInstanceInfo();

  return instance;
}

export interface ServerVersion {
  major: number;
  minor: number;
}

@model("InstanceState")
export class InstanceState extends Model({
  _instanceId: prop<string | null>(null),
  serverUrl: prop<string>(),
  authUsername: prop<string | null>(null),
  authToken: prop<string | null>(),

  databasePageStates: prop(() => objectMap<DatabaseState>()),
}) {
  @observable instanceName: string | null = null;
  @observable.ref serverVersion: ServerVersion | null = null;
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
      createAuthenticatedFetch({
        serverUrl: this.serverUrl,
        database: "__edgedbsys__",
        user: this.authUsername ?? "edgedb",
        authToken: this.authToken!,
      }),
      codecsRegistry,
      this.serverVersion
        ? [this.serverVersion.major, this.serverVersion.minor]
        : undefined
    );
    try {
      const data = (
        await client.fetch(
          `
      select {
        instanceName := sys::get_instance_name(),
        version := sys::get_version(),
        databases := sys::Database.name,
        roles := sys::Role.name,
      }`,
          null,
          OutputFormat.BINARY,
          Cardinality.ONE,
          Session.defaults()
        )
      ).result;

      runInAction(() => {
        this.instanceName = data.instanceName ?? "_localdev";
        this.serverVersion = data.version;
        this.databases = data.databases;
        this.roles = data.roles;
      });

      cleanupOldSchemaDataForInstance(this.instanceId!, this.databases!);
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

    when(
      () =>
        this.defaultConnection === null &&
        this.authToken != null &&
        (this.databases?.length ?? 0) > 0,
      () => {
        this.defaultConnection = new Connection({
          config: frozen({
            serverUrl: this.serverUrl,
            authToken: this.authToken!,
            database: this.databases![0],
            user: this.authUsername ?? this.roles![0],
          }),
          serverVersion: frozen(this.serverVersion),
        });
      }
    );

    return reaction(
      () => [
        this.serverUrl,
        this.authToken,
        this.authUsername,
        this.roles,
        this.serverVersion,
      ],
      () => (this._connections = new Map())
    );
  }

  @observable.ref _connections = new Map<string, Connection>();
  getConnection(dbName: string) {
    let conn = this._connections.get(dbName);
    if (!conn) {
      conn = new Connection({
        config: frozen({
          serverUrl: this.serverUrl,
          authToken: this.authToken!,
          database: dbName,
          user: this.authUsername ?? this.roles![0],
        }),
        serverVersion: frozen(this.serverVersion),
      });
      this._connections.set(dbName, conn);
    }
    return conn;
  }

  @modelAction
  getDatabasePageState(
    databaseName: string,
    tabs: {path: string; state?: ModelClass<AnyModel>}[]
  ) {
    let dbState = this.databasePageStates.get(databaseName);
    if (!dbState) {
      dbState = new DatabaseState({
        name: databaseName,
        tabStates: objectMap(
          tabs
            .filter((t) => t.state)
            .map((t) => {
              const state = new t.state!({});
              return [state.$modelType, state];
            })
        ),
      });
      this.databasePageStates.set(databaseName, dbState);
    } else {
      for (const tab of tabs) {
        if (!tab.state) continue;
        const modelType = (getTypeInfo(tab.state) as ModelTypeInfo).modelType;
        if (!dbState.tabStates.has(modelType)) {
          const state = new tab.state({});
          dbState.tabStates.set(state.$modelType, state);
        }
      }
    }
    return dbState;
  }

  @observable creatingExampleDB = false;

  async createExampleDatabase(exampleSchema: Promise<string>) {
    runInAction(() => (this.creatingExampleDB = true));
    try {
      const schemaScript = await exampleSchema;
      await this.defaultConnection!.execute(`create database _example`);
      const exampleConn = new Connection({
        config: frozen({
          serverUrl: this.serverUrl,
          authToken: this.authToken!,
          database: "_example",
          user: this.authUsername ?? this.roles![0],
        }),
        serverVersion: frozen(this.serverVersion),
      });
      await exampleConn.execute(schemaScript);
      await this.fetchInstanceInfo();
    } finally {
      runInAction(() => (this.creatingExampleDB = false));
    }
  }
}

export const InstanceStateContext = createContext<
  InstanceState | Error | null
>(null);

export function useInstanceState(): InstanceState {
  const ctx = useContext(InstanceStateContext);
  if (!ctx || ctx instanceof Error) {
    throw new Error("No instance ctx");
  }
  return ctx;
}

export function useFullInstanceState() {
  return useContext(InstanceStateContext);
}
