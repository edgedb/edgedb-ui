import {autorun} from "mobx";
import {model, Model, prop} from "mobx-keystone";

import {Schema as SchemaState} from "@edgedb/schema-graph";

import {dbCtx} from "../database";

import {SplitViewState} from "src/ui/splitView/model";

export enum SchemaViewType {
  Text,
  Graph,
  TextGraph,
}

@model("Schema")
export class Schema extends Model({
  viewType: prop<SchemaViewType>(SchemaViewType.Graph).withSetter(),

  splitView: prop(() => new SplitViewState({sizes: [35, 65]})),
}) {
  schemaState = SchemaState.create();

  onAttachedToRootStore() {
    const updateSchemaDisposer = autorun(() => {
      const schemaData = dbCtx.get(this)!.schemaData?.data;
      if (schemaData) {
        this.schemaState.updateSchema(
          schemaData.objects,
          schemaData.functions,
          schemaData.constraints,
          schemaData.scalars
        );
      }
    });

    return () => {
      updateSchemaDisposer();
    };
  }
}
