import {createContext, useContext} from "react";

import {action, computed, observable, reaction, runInAction, when} from "mobx";
import {
  AnyModel,
  createContext as createMobxContext,
  findParent,
  idProp,
  Model,
  model,
  modelAction,
  modelFlow,
  ObjectMap,
  objectMap,
  prop,
  _async,
  _await,
} from "mobx-keystone";

import {
  typesQuery,
  functionsQuery,
  constraintsQuery,
  RawSchemaType,
  RawFunctionType,
  RawConstraintType,
} from "@edgedb/common/schemaData/queries";
import {
  buildTypesGraph,
  SchemaType,
  SchemaObjectType,
  SchemaScalarType,
  SchemaFunction,
  SchemaConstraint,
} from "@edgedb/common/schemaData";

import {fetchSchemaData, storeSchemaData} from "../idbStore";

import {InstanceState} from "./instance";
import {connCtx, Connection} from "./connection";

export const dbCtx = createMobxContext<DatabaseState>();

export interface SchemaData {
  migrationId: string | null;
  sdl: string;
  objects: Map<string, SchemaObjectType>;
  objectsByName: Map<string, SchemaObjectType>;
  functions: Map<string, SchemaFunction>;
  constraints: Map<string, SchemaConstraint>;
  scalars: Map<string, SchemaScalarType>;
  types: Map<string, SchemaType>;
  extensions: Set<string>;
}

@model("DatabaseState")
export class DatabaseState extends Model({
  $modelId: idProp,
  name: prop<string>(),

  tabStates: prop<ObjectMap<AnyModel>>(),
}) {
  @observable.ref
  schemaData: SchemaData | null = null;

  @observable
  fetchingSchemaData = false;

  @observable.ref
  connection: Connection = null!;

  @observable
  currentRole: string | null = null;

  @observable
  migrationId: string | null | undefined = undefined;

  onInit() {
    dbCtx.set(this, this);
    connCtx.setComputed(this, () => this.connection);
  }

  onAttachedToRootStore() {
    const instanceState = findParent<InstanceState>(
      this,
      (parent) => parent instanceof InstanceState
    )!;

    const fetchSchemaDisposer = when(
      () => this.connection !== null,
      () => this.fetchSchemaData()
    );

    const roleUpdateDisposer = autorun(() => {
      const roles = instanceState.roles;
      if (roles && !roles.includes(this.currentRole!)) {
        runInAction(() => (this.currentRole = roles[0]));
      }
    });

    const connectionDisposer = autorun(() => {
      if (this.currentRole) {
        runInAction(
          () =>
            (this.connection = new Connection({
              config: {
                serverUrl: instanceState.serverUrl,
                authToken: instanceState.authToken!,
                database: this.name,
                user: this.currentRole!,
              },
            }))
        );
      }
    });

    return () => {
      fetchSchemaDisposer();
      roleUpdateDisposer();
      connectionDisposer();
    };
  }

  private async _fetchSchemaDataFromStore() {
    if (!this.schemaData) {
      const instanceState = findParent<InstanceState>(
        this,
        (parent) => parent instanceof InstanceState
      )!;

      const schemaData = await fetchSchemaData(
        this.name,
        instanceState.instanceName!
      );
      if (schemaData) {
        console.log("fetched schema from cache");
        runInAction(() => (this.schemaData = schemaData));
      }
    }
  }

  @modelFlow
  fetchSchemaData = _async(function* (this: DatabaseState) {
    const conn = this.connection;

    const [migrationId] = yield* _await(
      Promise.all([
        conn
          .query(
            `SELECT (
              SELECT schema::Migration {
                children := .<parents[IS schema::Migration]
              } FILTER NOT EXISTS .children
            ).id;`,
            true
          )
          .then(({result}) => (result?.[0] ?? null) as string | null),
        this._fetchSchemaDataFromStore(),
      ])
    );

    this.migrationId = migrationId;

    if (!this.schemaData || this.schemaData.migrationId !== migrationId) {
      this.fetchingSchemaData = true;

      try {
        const [sdl, rawTypes] = yield* _await(
          Promise.all([
            conn
              .query(`describe schema as sdl`, true)
              .then(({result, duration}) => {
                // console.log("describe", duration);
                return result![0] as string;
              }),
            conn
              .query(
                `select {
                  types := (${typesQuery}),
                  functions := (${functionsQuery}),
                  constraints := (${constraintsQuery}),
                  extensions := (
                    select schema::Extension.name
                  )
                }`
              )
              .then(({result, duration}) => {
                // console.log("types", duration);
                return result![0] as {
                  types: RawSchemaType[];
                  functions: RawFunctionType[];
                  constraints: RawConstraintType[];
                  extensions: string[];
                };
              }),
          ])
        );

        const {types, functions, constraints} = buildTypesGraph(rawTypes);

        const schemaData: SchemaData = {
          migrationId,
          sdl,
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
          constraints,
          scalars: new Map(
            [...types.values()]
              .filter((t) => t.schemaType === "Scalar")
              .map((t) => [t.name, t as SchemaScalarType])
          ),
          types,
          extensions: new Set(rawTypes.extensions),
        };

        const instanceState = findParent<InstanceState>(
          this,
          (parent) => parent instanceof InstanceState
        )!;

        storeSchemaData(this.name, instanceState.instanceName!, schemaData);

        this.schemaData = schemaData;
      } finally {
        this.fetchingSchemaData = false;
        console.log("fetched schema");
      }
    }
  });
}

export const DatabaseStateContext = createContext<DatabaseState>(null!);

export function useDatabaseState() {
  return useContext(DatabaseStateContext);
}
