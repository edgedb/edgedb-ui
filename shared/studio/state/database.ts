import {createContext, useContext} from "react";

import {action, autorun, observable, runInAction, when} from "mobx";
import {
  AnyModel,
  createContext as createMobxContext,
  getTypeInfo,
  idProp,
  Model,
  model,
  ModelClass,
  modelFlow,
  ModelTypeInfo,
  ObjectMap,
  prop,
  _async,
  _await,
  frozen,
} from "mobx-keystone";

import {
  RawIntrospectionResult,
  getIntrospectionQuery,
} from "@edgedb/common/schemaData/queries";
import {
  buildTypesGraph,
  SchemaType,
  SchemaObjectType,
  SchemaScalarType,
  SchemaFunction,
  SchemaConstraint,
  SchemaPointer,
  SchemaAbstractAnnotation,
  SchemaExtension,
  SchemaAlias,
  SchemaGlobal,
  SchemaOperator,
} from "@edgedb/common/schemaData";
import {EdgeDBVersion} from "@edgedb/common/schemaData/utils";

import {fetchSchemaData, storeSchemaData} from "../idbStore";

import {instanceCtx} from "./instance";
import {Capabilities, connCtx, Connection} from "./connection";
import {SessionState, sessionStateCtx} from "./sessionState";

export const dbCtx = createMobxContext<DatabaseState>();

const SCHEMA_DATA_VERSION = 8;

export interface StoredSchemaData {
  version: number;
  schemaId: string | null;
  data: RawIntrospectionResult;
}

export interface SchemaData {
  objects: Map<string, SchemaObjectType>;
  objectsByName: Map<string, SchemaObjectType>;
  functions: Map<string, SchemaFunction>;
  operators: Map<string, SchemaOperator>;
  constraints: Map<string, SchemaConstraint>;
  scalars: Map<string, SchemaScalarType>;
  types: Map<string, SchemaType>;
  pointers: Map<string, SchemaPointer>;
  aliases: Map<string, SchemaAlias>;
  globals: Map<string, SchemaGlobal>;
  annotations: Map<string, SchemaAbstractAnnotation>;
  extensions: SchemaExtension[];
  shortNamesByModule: Map<string, Set<string>>;
}

@model("DatabaseState")
export class DatabaseState extends Model({
  $modelId: idProp,
  name: prop<string>(),

  connection: prop<Connection>(null!).withSetter(),
  sessionState: prop(() => new SessionState({})),
  tabStates: prop<ObjectMap<AnyModel>>(),
}) {
  @observable
  currentRole: string | null = null;

  @observable
  loadingTabs = new Map<string, boolean>();

  @action
  setLoadingTab(stateClass: ModelClass<any>, loading: boolean) {
    this.loadingTabs.set(
      (getTypeInfo(stateClass) as ModelTypeInfo).modelType,
      loading
    );
  }

  refreshCaches(capabilities: number, statuses: string[]) {
    if (capabilities & Capabilities.DDL) {
      if (
        statuses.includes("CREATE DATABASE") ||
        statuses.includes("DROP DATABASE") ||
        statuses.includes("CREATE BRANCH") ||
        statuses.includes("DROP BRANCH") ||
        statuses.includes("ALTER BRANCH")
      ) {
        instanceCtx.get(this)!.fetchInstanceInfo();
      } else {
        const dbState = dbCtx.get(this)!;
        dbState.fetchSchemaData();
      }
    }
  }

  @observable
  schemaId: string | null = null;
  @observable.ref
  schemaData: SchemaData | null = null;
  @observable
  fetchingSchemaData = false;

  @observable
  objectCount: number | null = null;

  onInit() {
    dbCtx.set(this, this);
    sessionStateCtx.set(this, this.sessionState);
    connCtx.setComputed(this, () => this.connection);
  }

  onAttachedToRootStore() {
    const instanceState = instanceCtx.get(this)!;

    const fetchSchemaDisposer = when(
      () => this.connection !== null,
      () => this.fetchSchemaData()
    );

    const roleUpdateDisposer = autorun(() => {
      if (instanceState.authUsername) {
        runInAction(() => (this.currentRole = instanceState.authUsername));
      } else {
        const roles = instanceState.roles;
        if (roles && !roles.includes(this.currentRole!)) {
          runInAction(() => (this.currentRole = roles[0]));
        }
      }
    });

    const connectionDisposer = autorun(() => {
      if (this.currentRole) {
        this.setConnection(
          new Connection({
            config: frozen({
              serverUrl: instanceState.serverUrl,
              authToken: instanceState.authToken!,
              database: this.name,
              user: this.currentRole,
            }),
            serverVersion: frozen(instanceState.serverVersion),
          })
        );
      }
    });

    return () => {
      fetchSchemaDisposer();
      roleUpdateDisposer();
      connectionDisposer();
    };
  }

  async updateObjectCount() {
    const {result} = await this.connection.query(
      `select count(std::Object)`,
      undefined,
      {ignoreSessionConfig: true, ignoreForceDatabaseError: true}
    );
    if (result) {
      runInAction(() => {
        this.objectCount = Number(result[0]);
      });
    }
  }

  @modelFlow
  fetchSchemaData = _async(function* (this: DatabaseState) {
    if (this.fetchingSchemaData) {
      return;
    }

    this.fetchingSchemaData = true;

    const conn = this.connection;
    const instanceState = instanceCtx.get(this)!;

    try {
      const [schemaInfo, storedSchemaData] = yield* _await(
        Promise.all([
          conn
            .query(
              `SELECT {
                migrationId := (
                  (SELECT schema::Migration {
                    children := .<parents[IS schema::Migration]
                  } FILTER NOT EXISTS .children).id
                ),
                version := sys::get_version(),
                versionStr := sys::get_version_as_str(),
              }`,
              undefined,
              {ignoreSessionConfig: true, ignoreForceDatabaseError: true}
            )
            .then(({result}) => ({
              schemaId: `${result![0].versionStr}__${
                result![0].migrationId[0] ?? "empty"
              }`,
              version: result![0].version as {
                major: number;
                minor: number;
                stage: string;
                stage_no: number;
                local: string[];
              },
            })),
          fetchSchemaData(this.name, instanceState.instanceId!),
        ])
      );

      if (this.schemaId === schemaInfo.schemaId) {
        return;
      }

      const edgedbVersion = [
        Number(schemaInfo.version.major),
        Number(schemaInfo.version.minor),
        schemaInfo.version.stage as any,
        Number(schemaInfo.version.stage_no),
      ] as EdgeDBVersion;

      let rawData: RawIntrospectionResult;
      if (
        storedSchemaData?.schemaId !== schemaInfo.schemaId ||
        storedSchemaData.version !== SCHEMA_DATA_VERSION
      ) {
        // Directly set loading tab by model name to avoid cyclic dependency
        // on Schema state class
        this.loadingTabs.set("Schema", true);
        try {
          rawData = yield* _await(
            conn
              .query(getIntrospectionQuery(edgedbVersion), undefined, {
                ignoreSessionConfig: true,
                ignoreForceDatabaseError: true,
              })
              .then(({result}) => {
                return result![0] as RawIntrospectionResult;
              })
          );
        } finally {
          this.loadingTabs.set("Schema", false);
        }
        storeSchemaData(this.name, instanceState.instanceId!, {
          version: SCHEMA_DATA_VERSION,
          schemaId: schemaInfo.schemaId,
          data: rawData,
        });
      } else {
        rawData = storedSchemaData.data;
      }

      const {
        types,
        pointers,
        functions,
        operators,
        constraints,
        annotations,
        aliases,
        globals,
        extensions,
      } = buildTypesGraph(rawData, edgedbVersion);

      const schemaData: SchemaData = {
        objects: new Map(
          [...types.values()]
            .filter((t) => t.schemaType === "Object")
            .map((t) => [t.id, t as SchemaObjectType])
        ),
        objectsByName: new Map(
          [...types.values()]
            .filter((t) => t.schemaType === "Object")
            .map((t) => [t.name, t as SchemaObjectType])
        ),
        functions,
        operators,
        constraints,
        scalars: new Map(
          [...types.values()]
            .filter((t) => t.schemaType === "Scalar")
            .map((t) => [t.name, t as SchemaScalarType])
        ),
        types,
        pointers,
        annotations,
        aliases,
        globals,
        extensions,
        shortNamesByModule: [
          ...([...types.values()].filter(
            (t) => t.schemaType === "Object" || t.schemaType === "Scalar"
          ) as (SchemaObjectType | SchemaScalarType)[]),
          ...[...pointers.values()].filter((p) => p.abstract),
          ...functions.values(),
          ...constraints.values(),
          ...annotations.values(),
          ...aliases.values(),
          ...globals.values(),
        ].reduce((modules, item) => {
          if (!modules.has(item.module)) {
            modules.set(item.module, new Set());
          }
          modules.get(item.module)!.add(item.shortName);
          return modules;
        }, new Map<string, Set<string>>()),
      };

      this.schemaId = schemaInfo.schemaId;
      this.schemaData = schemaData;
    } finally {
      this.fetchingSchemaData = false;
    }
  });
}

export const DatabaseStateContext = createContext<DatabaseState>(null!);

export function useDatabaseState() {
  return useContext(DatabaseStateContext);
}
