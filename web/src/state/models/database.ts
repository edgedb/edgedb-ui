import {action, computed, observable, reaction} from "mobx";
import {
  createContext,
  frozen,
  Frozen,
  idProp,
  Model,
  model,
  modelAction,
  modelFlow,
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
} from "@edgedb/schema-graph";

import {Repl} from "./repl";
import {Schema} from "./schema";
import {DataView} from "./dataview";
import {connCtx, Connection} from "./connection";

export const dbCtx = createContext<DatabasePageState>();

export enum DatabaseTab {
  Dashboard = "dashboard",
  Repl = "repl",
  Schema = "schema",
  Data = "data",
  Settings = "settings",
}

export interface SchemaData {
  migrationId: string | null;
  sdl: string;
  objects: SchemaObject[];
  functions: SchemaFunction[];
  constraints: SchemaAbstractConstraint[];
  scalars: SchemaScalar[];
}

@model("DatabasePageState")
export class DatabasePageState extends Model({
  $modelId: idProp,
  name: prop<string>(),

  currentTabId: prop<DatabaseTab>(DatabaseTab.Dashboard).withSetter(),

  replState: prop(() => new Repl({})),
  schemaState: prop(() => new Schema({})),
  dataViewState: prop(() => new DataView({})),
}) {
  @observable
  schemaData: Frozen<SchemaData> | null = null;

  @observable
  fetchingSchemaData = false;

  connection = new Connection({config: {database: this.name}});

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
  fetchSchemaData = _async(function* (this: DatabasePageState) {
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
        const [sdl, objects, functions, constraints, scalars] = yield* _await(
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
          ])
        );

        const schemaData: SchemaData = JSON.parse(
          JSON.stringify({
            migrationId,
            sdl,
            objects,
            functions,
            constraints,
            scalars,
          })
        );

        // storeSchemaData(this.$modelId, schemaData);

        this.schemaData = frozen(schemaData);
      } finally {
        this.fetchingSchemaData = false;
        console.log("fetched schema");
      }
    }
  });
}
