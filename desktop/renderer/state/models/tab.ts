import {observable, reaction, runInAction} from "mobx";
import {
  Model,
  model,
  prop,
  createContext,
  Frozen,
  frozen,
  _async,
  modelFlow,
  _await,
} from "mobx-keystone";

import {storeSchemaData, fetchSchemaData} from "../../idbStore";

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

import {Connection} from "./connection";

import {Schema} from "./schema";
import {Repl} from "./repl";
import {DataView} from "./dataview";

export const tabCtx = createContext<Tab>();

export enum ViewType {
  repl = "repl",
  schema = "schema",
  data = "data",
}

export interface SchemaData {
  migrationId: string | null;
  sdl: string;
  objects: SchemaObject[];
  functions: SchemaFunction[];
  constraints: SchemaAbstractConstraint[];
  scalars: SchemaScalar[];
}

@model("Tab")
export class Tab extends Model({
  connection: prop<Connection>(),
  view: prop<ViewType>(ViewType.repl).withSetter(),

  replView: prop(() => new Repl({})),
  schemaView: prop(() => new Schema({})),
  dataView: prop(() => new DataView({})),
}) {
  @observable
  schemaData: Frozen<SchemaData> | null = null;

  @observable
  fetchingSchemaData = false;

  onInit() {
    tabCtx.set(this, this);
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

  private async _fetchSchemaDataFromStore() {
    if (!this.schemaData) {
      const schemaData = await fetchSchemaData(this.$modelId);
      if (schemaData) {
        runInAction(() => (this.schemaData = frozen(schemaData)));
      }
    }
  }

  @modelFlow
  fetchSchemaData = _async(function* (this: Tab) {
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

        storeSchemaData(this.$modelId, schemaData);

        this.schemaData = frozen(schemaData);
      } finally {
        this.fetchingSchemaData = false;
      }
    }
  });
}
