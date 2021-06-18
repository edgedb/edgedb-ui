import {types, cast, Instance} from "mobx-state-tree";

import {SchemaGraph} from "./graph";

import {
  SchemaObject,
  SchemaFunction,
  SchemaAbstractConstraint,
  SchemaScalar,
} from "./interfaces";
import {SchemaSidepanel} from "./sidepanel";

export type {
  SchemaObject,
  SchemaProp,
  SchemaLink,
  SchemaConstraint,
  SchemaAnnotation,
  SchemaFunction,
  SchemaAbstractConstraint,
  SchemaScalar,
} from "./interfaces";

export const Schema = types
  .model("Schema", {
    graph: types.optional(SchemaGraph, {viewport: {}}),
    sidepanel: types.optional(SchemaSidepanel, {}),
    objects: types.maybe(types.map(types.frozen<SchemaObject>())),
    functions: types.maybe(types.array(types.frozen<SchemaFunction>())),
    constraints: types.maybe(
      types.array(types.frozen<SchemaAbstractConstraint>())
    ),
    scalars: types.maybe(types.array(types.frozen<SchemaScalar>())),
    selectedObjectName: "",
    selectedLinkName: "",
  })
  .views((self) => ({
    get isLoaded() {
      return !!self.objects;
    },
    get moduleNames() {
      const moduleNames = new Set<string>();
      for (const name of self.objects?.keys() ?? []) {
        moduleNames.add(name.split("::")[0]);
      }
      return moduleNames;
    },
    get selectedObject() {
      return self.objects?.get(self.selectedObjectName);
    },
  }))

  .actions((self) => ({
    updateSchema(
      objects: SchemaObject[],
      functions: SchemaFunction[],
      constraints: SchemaAbstractConstraint[],
      scalars: SchemaScalar[]
    ) {
      self.objects = cast(
        objects.reduce((objects, obj) => {
          objects[obj.name] = obj;
          return objects;
        }, {} as {[key: string]: SchemaObject})
      );
      self.functions = cast(functions);
      self.constraints = cast(constraints);
      self.scalars = cast(scalars);

      self.graph.updateGraphNodesAndLinks(objects);
      return self.graph.autoLayoutNodes();
    },
    selectObject(name: string, centerOn: boolean = false) {
      self.selectedObjectName = name;
      self.selectedLinkName = "";
      if (centerOn) {
        self.graph.centerOnNode(name);
      }
    },
    selectLink(objectName: string, linkName: string) {
      self.selectedObjectName = objectName;
      self.selectedLinkName = linkName;
    },
  }));

// eslint-disable-next-line
export interface SchemaState extends Instance<typeof Schema> {}
