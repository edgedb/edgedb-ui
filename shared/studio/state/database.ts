import {createContext, useContext} from "react";

import {action, computed, observable, reaction} from "mobx";
import {
  AnyModel,
  createContext as createMobxContext,
  frozen,
  Frozen,
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
  schemaQuery,
  functionsQuery,
  constraintsQuery,
  scalarsQuery,
  SchemaObject,
  SchemaFunction,
  SchemaAbstractConstraint,
  SchemaScalar,
  typesQuery,
} from "@edgedb/schema-graph";

// import {Repl} from "./repl";
// import {Schema} from "./schema";
// import {DataView} from "./dataview";
import {connCtx, Connection} from "./connection";
import {buildTypesGraph, SchemaType} from "../utils/schema";

export const dbCtx = createMobxContext<DatabaseState>();

export interface SchemaData {
  migrationId: string | null;
  sdl: string;
  objects: SchemaObject[];
  functions: SchemaFunction[];
  constraints: SchemaAbstractConstraint[];
  scalars: SchemaScalar[];
  types: Map<string, SchemaType>;
}

@model("DatabaseState")
export class DatabaseState extends Model({
  $modelId: idProp,
  name: prop<string>(),
  serverUrl: prop<string>(),

  tabStates: prop<ObjectMap<AnyModel>>(),
}) {
  @observable
  schemaData: Frozen<SchemaData> | null = null;

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
    const schemaReactionDisposer = reaction(
      () => this.connection.isConnected,
      (isConnected) => {
        if (isConnected) {
          this.fetchSchemaData();
        }
      },
      {fireImmediately: true}
    );

    return () => {
      schemaReactionDisposer();
    };
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

    if (!this.schemaData || this.schemaData.data.migrationId !== migrationId) {
      this.fetchingSchemaData = true;

      try {
        const [sdl, objects, functions, constraints, scalars, types] =
          yield* _await(
            Promise.all([
              conn
                .query(`describe schema as sdl`, true)
                .then(({result}) => result![0] as string),
              conn
                .query(schemaQuery, true)
                .then(({result}) => result as SchemaObject[]),
              conn
                .query(functionsQuery, true)
                .then(({result}) => result as SchemaFunction[]),
              conn
                .query(constraintsQuery, true)
                .then(({result}) => result as SchemaAbstractConstraint[]),
              conn
                .query(scalarsQuery, true)
                .then(({result}) => result as SchemaScalar[]),
              conn.query(typesQuery, true).then(({result}) => result as any),
            ])
          );

        const schemaData: SchemaData = {
          migrationId,
          sdl,
          objects,
          functions,
          constraints,
          scalars,
          types: buildTypesGraph(types),
        };

        // storeSchemaData(this.$modelId, schemaData);

        this.schemaData = frozen(schemaData);
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
