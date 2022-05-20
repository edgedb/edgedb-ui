import {observable, action, runInAction, computed} from "mobx";
import {Model, model, modelFlow, prop, _async, _await} from "mobx-keystone";
import {Text} from "@codemirror/state";
import {
  getIntrospectionQuery,
  GraphQLSchema,
  buildClientSchema,
} from "graphql";

import {prettyPrintJSON} from "@edgedb/inspector/v2/buildScalar";

import {SplitViewState} from "@edgedb/common/ui/splitView/model";

import {dbCtx} from "../../../state";

@model("GraphQL")
export class GraphQL extends Model({
  splitView: prop(() => new SplitViewState({})),
}) {
  @observable.ref
  currentQuery = Text.empty;

  @action
  setCurrentQuery(query: Text) {
    this.currentQuery = query;
  }

  @observable
  queryVariables = Text.empty;

  @action
  setQueryVariables(vars: Text) {
    this.queryVariables = vars;
  }

  @computed
  get queryVarsError(): string | null {
    try {
      const jsonStr = this.queryVariables.toString();
      if (jsonStr.trim() === "") {
        return null;
      }
      const json = JSON.parse(jsonStr);
      if (typeof json !== "object") {
        return `Invalid JSON value, value must be an object`;
      }
    } catch {
      return `Invalid JSON value`;
    }
    return null;
  }

  @observable
  varsEditorOpen = false;

  @action
  toggleVarsEditorOpen() {
    this.varsEditorOpen = !this.varsEditorOpen;
  }

  @observable
  queryRunning = false;

  @observable
  result: string | null = null;

  @observable
  queryError: string | null = null;

  @observable.ref
  schema: GraphQLSchema | null = null;

  async fetchSchema() {
    if (this.schema) return;

    const introspectionQuery = getIntrospectionQuery();

    const dbState = dbCtx.get(this)!;

    const graphqlEndpoint = `${dbState.serverUrl}/db/${dbState.name}/graphql`;

    const response = await fetch(graphqlEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: introspectionQuery,
      }),
    });

    const schema = buildClientSchema((await response.json()).data);

    runInAction(() => (this.schema = schema));
  }

  @modelFlow
  runQuery = _async(function* (this: GraphQL) {
    if (this.queryVarsError) {
      return;
    }

    const dbState = dbCtx.get(this)!;

    const graphqlEndpoint = `${dbState.serverUrl}/db/${dbState.name}/graphql`;

    this.queryRunning = true;

    try {
      const vars = this.queryVariables.toString().trim();
      const response = yield* _await(
        fetch(graphqlEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: `{"query": ${JSON.stringify(this.currentQuery.toString())}${
            vars ? `, "variables": ${vars}` : ""
          }}`,
        })
      );

      this.result = prettyPrintJSON(yield* _await(response.text()));
      this.queryError = null;
    } catch (e: any) {
      this.result = null;
      this.queryError = `${e.name}: ${e.message}`;
    } finally {
      this.queryRunning = false;
    }
  });
}
