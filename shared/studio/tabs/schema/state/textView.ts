import {
  action,
  autorun,
  computed,
  observable,
  reaction,
  runInAction,
  when,
} from "mobx";
import {
  arraySet,
  getParent,
  model,
  Model,
  modelAction,
  objectMap,
  prop,
} from "mobx-keystone";
import Fuzzysort from "fuzzysort";
import type {VariableSizeList as List} from "react-window";

import {
  SchemaObjectType,
  SchemaFunction,
  SchemaScalarType,
  SchemaConstraint,
  SchemaPointer,
  SchemaAbstractAnnotation,
  SchemaExtension,
  SchemaAlias,
  SchemaGlobal,
  SchemaOperator,
} from "@edgedb/common/schemaData";

import {dbCtx} from "../../../state";
import {Schema} from ".";

export enum ModuleGroup {
  user,
  stdlib,
  system,
}

export enum TypeFilter {
  objects,
  functions,
  scalars,
  constraints,
  aliases,
  other,
}

const stdlibModules = new Set(["std", "cal", "math"]);

export type SchemaItem =
  | SchemaObjectType
  | SchemaScalarType
  | SchemaFunction
  | SchemaOperator
  | SchemaConstraint
  | SchemaPointer
  | SchemaAbstractAnnotation
  | SchemaAlias
  | SchemaGlobal
  | SchemaExtension;

export interface SchemaModule {
  schemaType: "Module";
  module: string;
  isEnd?: boolean;
}

export function getModuleGroup(item: Exclude<SchemaItem, SchemaExtension>) {
  return item.builtin
    ? stdlibModules.has(item.module)
      ? ModuleGroup.stdlib
      : ModuleGroup.system
    : ModuleGroup.user;
}

export type SearchMatches = {[path: string]: readonly number[]};
export type ListItem = {
  item: SchemaItem | SchemaModule;
  matches?: SearchMatches;
};

const fuzzysortOptions = {
  key: "target",
};

interface FuzzysortIndexItem {
  target: Fuzzysort.Prepared;
  item: SchemaItem;
  path?: string;
  inherited?: boolean;
}
type FuzzysortIndex = FuzzysortIndexItem[];

function buildSearchIndex(items: SchemaItem[]): FuzzysortIndex {
  return items.flatMap((item) => [
    {target: Fuzzysort.prepare(item.name), item},
    ...(item.schemaType === "Object"
      ? item.pointers.flatMap((p) => [
          {
            target: Fuzzysort.prepare(p.name),
            item,
            path: p.name,
            inherited: !p["@owned"],
          },
          ...(p.type === "Link"
            ? Object.values(p.properties).map((lp) => ({
                target: Fuzzysort.prepare(lp.name),
                item,
                path: `${p.name}.${lp.name}`,
                inherited: !p["@owned"],
              }))
            : []),
        ])
      : []),
  ]);
}

@model("SchemaTextView")
export class SchemaTextView extends Model({
  searchText: prop<string>("").withSetter(),
  selectedModuleGroup: prop<ModuleGroup>(ModuleGroup.user).withSetter(),
  selectedTypeFilter: prop<TypeFilter | null>(null).withSetter(),
  toggledItems: prop(() => arraySet<string>()),
}) {
  scrollPos = 0;
  listRef: List | null = null;

  lastLocation: {pathname: string; search: string; scrollPos: number} | null =
    null;

  renderHeights = new Map<string, number>();

  @action
  setRenderHeight(index: number, item: SchemaItem, height: number) {
    if (this.renderHeights.get(item.id) !== height) {
      this.renderHeights.set(item.id, height);
      this.listRef?.resetAfterIndex(index);
    }
  }

  getRenderHeight(index: number) {
    const item = this.renderListItems[index].item;
    return item.schemaType === "Module"
      ? 42
      : this.renderHeights.get(item.id) ?? 42;
  }

  @observable.ref
  fuzzysortIndex: FuzzysortIndex = [];

  onAttachedToRootStore() {
    const disposeIndexUpdate = autorun(() => {
      const index = buildSearchIndex(this.moduleGroupItems);
      runInAction(() => {
        this.fuzzysortIndex = index;
      });
    });

    const disposeScrollReset = reaction(
      () =>
        this.searchText + this.selectedModuleGroup + this.selectedTypeFilter,
      () => this.listRef?.scrollTo(0)
    );

    const schemaState = getParent<Schema>(this)!.schemaState;
    const disposeSelectedGraphObject = reaction(
      () => schemaState.selectedObjectName,
      (selectedObjName) => {
        if (selectedObjName !== (this.highlightedItem ?? "")) {
          const schemaType = dbCtx
            .get(this)!
            .schemaData?.objectsByName.get(selectedObjName);
          if (schemaType) {
            this.goToItem(schemaType, false);
          }
        }
      }
    );

    return () => {
      disposeIndexUpdate();
      disposeScrollReset();
      disposeSelectedGraphObject();
    };
  }

  @action
  toggleItemCollapse(id: string) {
    if (this.toggledItems.has(id)) {
      this.toggledItems.delete(id);
    } else {
      this.toggledItems.add(id);
    }
  }

  @observable.ref
  highlightedItem: string | null = null;

  @action
  setHighlightedItem(name: string | null) {
    this.highlightedItem = name;
    const schemaState = getParent<Schema>(this)!.schemaState;

    schemaState.selectObject(name ?? "", true);
  }

  @action
  async goToItem(item: SchemaItem, updateGraph = true) {
    if (item.schemaType === "Extension") return;

    const moduleGroup = getModuleGroup(item);
    if (
      moduleGroup !== this.selectedModuleGroup ||
      this.searchText ||
      this.selectedTypeFilter !== null
    ) {
      this.setSelectedModuleGroup(moduleGroup);
      this.setSelectedTypeFilter(null);
      this.setSearchText("");

      await when(() => !!this.renderListItems);
    }

    const listIndex = this.renderListItems.findIndex(
      ({item: listItem}) =>
        listItem.schemaType !== "Module" && listItem === item
    );

    if (listIndex !== -1) {
      runInAction(() => (this.highlightedItem = item.name));
      this.listRef?.scrollToItem(listIndex, "center");

      if (updateGraph) {
        const schemaState = getParent<Schema>(this)!.schemaState;

        schemaState.selectObject(
          item.schemaType === "Object" && !item.builtin ? item.name : "",
          true
        );
      }
    }
  }

  @computed
  get moduleGroupItems(): SchemaItem[] {
    const schemaData = dbCtx.get(this)!.schemaData;
    if (!schemaData) return [];

    const items = [
      ...[...schemaData.globals.values()].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      ...[...schemaData.scalars.values()]
        .filter((s) => !s.from_alias)
        .sort((a, b) => a.name.localeCompare(b.name)),
      ...[...schemaData.pointers.values()]
        .filter((p) => p.abstract)
        .sort((a, b) => a.name.localeCompare(b.name)),
      ...[...schemaData.annotations.values()].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      ...[...schemaData.aliases.values()].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      ...[...schemaData.objects.values()]
        .filter((o) => !o.from_alias)
        .sort((a, b) => a.name.localeCompare(b.name)),
      ...[...schemaData.functions.values()].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      ...[...schemaData.constraints.values()]
        .filter((t) => t.abstract)
        .sort((a, b) => a.name.localeCompare(b.name)),
      ...[...schemaData.operators.values()].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    ];

    switch (this.selectedModuleGroup) {
      case ModuleGroup.user:
        return [
          ...schemaData.extensions,
          ...items.filter((type) => !type.builtin),
        ];
      case ModuleGroup.stdlib:
        return items.filter(
          (type) =>
            type.builtin &&
            stdlibModules.has(type.module) &&
            !type.isDeprecated
        );

      case ModuleGroup.system:
        return items.filter(
          (type) =>
            type.builtin &&
            !stdlibModules.has(type.module) &&
            !type.isDeprecated
        );
    }
  }

  @computed
  get searchFilteredItems(): ListItem[] {
    if (this.searchText) {
      const results = Fuzzysort.go(
        this.searchText,
        this.fuzzysortIndex,
        fuzzysortOptions
      );
      return [
        ...results
          .reduce(
            (items, result) => {
              if (!items.has(result.obj.item)) {
                items.set(result.obj.item, {
                  item: result.obj.item,
                  matches: {},
                  score: -Infinity,
                });
              }
              const item = items.get(result.obj.item)!;
              item.matches[result.obj.path ?? ""] = Fuzzysort.indexes(
                result
              ) as number[];
              const score = result.obj.inherited
                ? result.score - 1
                : result.score;
              item.score = item.score > score ? item.score : score;
              return items;
            },
            new Map<
              SchemaItem,
              {
                item: SchemaItem;
                matches: SearchMatches;
                score: number;
              }
            >()
          )
          .values(),
      ].sort((a, b) => b.score - a.score);
    } else {
      return this.moduleGroupItems.map((item) => ({item}));
    }
  }

  @computed
  get filteredItems() {
    const items = this.searchFilteredItems;

    const groups = {
      all: items,
      [TypeFilter.objects]: [] as ListItem[],
      [TypeFilter.functions]: [] as ListItem[],
      [TypeFilter.scalars]: [] as ListItem[],
      [TypeFilter.constraints]: [] as ListItem[],
      [TypeFilter.aliases]: [] as ListItem[],
      [TypeFilter.other]: [] as ListItem[],
    };

    for (const item of items) {
      switch (item.item.schemaType) {
        case "Object":
          groups[TypeFilter.objects].push(item);
          break;
        case "Function":
          groups[TypeFilter.functions].push(item);
          break;
        case "Scalar":
          groups[TypeFilter.scalars].push(item);
          break;
        case "Constraint":
          groups[TypeFilter.constraints].push(item);
          break;
        case "Alias":
          groups[TypeFilter.aliases].push(item);
          break;
        default:
          groups[TypeFilter.other].push(item);
      }
    }

    return groups;
  }

  @computed
  get renderListItems(): ListItem[] {
    const items = this.filteredItems[this.selectedTypeFilter ?? "all"];

    if (this.searchText) {
      return items;
    }

    const exts: ListItem[] = [];
    const modules: {[key: string]: ListItem[]} = {};
    for (const item of items) {
      if (item.item.schemaType === "Extension") {
        exts.push(item);
        continue;
      }
      if (!modules[item.item.module]) {
        modules[item.item.module] = [];
      }
      modules[item.item.module].push(item);
    }

    return [
      ...exts,
      ...Object.entries(modules)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .flatMap(([name, items]) => {
          return [
            {
              item: {
                schemaType: "Module",
                module: name,
              } as SchemaModule,
            },
            ...items,
            {
              item: {
                schemaType: "Module",
                module: name,
                isEnd: true,
              } as SchemaModule,
            },
          ];
        }),
    ];
  }
}
