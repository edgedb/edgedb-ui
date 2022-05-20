import {createContext, useContext} from "react";

import {action, computed, observable, reaction} from "mobx";
import {
  AnyModel,
  createContext as createMobxContext,
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
  serverUrl: prop<string>(),

  tabStates: prop<ObjectMap<AnyModel>>(),
}) {
  @observable.ref
  schemaData: SchemaData | null = null;

  @observable
  fetchingSchemaData = false;

  connection = new Connection({
    config: {database: this.name, serverUrl: this.serverUrl},
  });

  @observable
  migrationId: string | null | undefined = undefined;

  onInit() {
    dbCtx.set(this, this);
    connCtx.set(this, this.connection);
  }

  onAttachedToRootStore() {
    this.fetchSchemaData();
  }

  // private async _fetchSchemaDataFromStore() {
  //   if (!this.schemaData) {
  //     const schemaData = await fetchSchemaData(this.$modelId);
  //     if (schemaData) {
  //       runInAction(() => (this.schemaData = frozen(schemaData)));
  //     }
  //   }
  // }

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
        // this._fetchSchemaDataFromStore(),
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

        // storeSchemaData(this.$modelId, schemaData);

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
