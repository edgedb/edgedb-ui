import {autorun} from "mobx";
import {model, Model, prop} from "mobx-keystone";

import {Schema as SchemaState} from "@edgedb/schema-graph";
// import {tabCtx} from "..";
import {SplitViewState} from "src/ui/splitView/model";

export enum SchemaViewType {
  Text,
  Graph,
  TextGraph,
}

@model("Schema")
export class Schema extends Model({
  viewType: prop<SchemaViewType>(SchemaViewType.TextGraph).withSetter(),

  splitView: prop(() => new SplitViewState({})),
}) {
  schemaState = SchemaState.create();

  onAttachedToRootStore() {
    const updateSchemaDisposer = autorun(() => {
      // const schemaData = tabCtx.get(this)!.schemaData?.data;
      // if (schemaData) {
      //   this.schemaState.updateSchema(
      //     schemaData.objects,
      //     schemaData.functions,
      //     schemaData.constraints,
      //     schemaData.scalars
      //   );
      // }
    });

    return () => {
      updateSchemaDisposer();
    };
  }
}
