import {
  model,
  Model,
  prop,
  arraySet,
  createContext,
  modelAction,
  modelFlow,
  _async,
  _await,
  ArraySet,
} from "mobx-keystone";
import {observable} from "mobx";
import {_ICodec} from "edgedb";
import {Item, buildItem, expandItem, ItemType} from "./buildItem";

export type {Item};

export interface EdgeDBResult {
  data: any[];
  codec: _ICodec;
}

export const resultGetterCtx =
  createContext<
    (state: InspectorState) => Promise<EdgeDBResult | undefined>
  >();

export type NestedDataGetter = (
  objectType: string,
  objectId: string,
  fieldName: string
) => Promise<{data: any; codec: _ICodec}>;

@model("edb/Inspector")
export class InspectorState extends Model({
  expanded: prop<ArraySet<string> | undefined>(),
  scrollPos: prop<number>(0).withSetter(),

  autoExpandDepth: prop<number | null>(null),
  countPrefix: prop<string | null>(null),
  ignorePrefix: prop<string | null>(null),
}) {
  @observable.shallow
  _items: Item[] = [];
  _jsonMode = false;

  loadingData = false;

  loadNestedData: NestedDataGetter | null = null;

  getItems() {
    if (!this._items.length) {
      this.initData();
    }

    return this._items;
  }

  @modelFlow
  initData = _async(function* (
    this: InspectorState,
    result?: EdgeDBResult,
    jsonMode: boolean = false
  ) {
    if (this.loadingData) {
      return;
    }

    if (!result) {
      const resultGetter = resultGetterCtx.get(this);
      if (resultGetter) {
        this.loadingData = true;
        result = yield* _await(resultGetter(this));
        this.loadingData = false;
      }
    }

    let shouldAutoExpand = false;

    if (!this.expanded) {
      this.expanded = arraySet();
      shouldAutoExpand = true;
    }

    if (result) {
      this._items = [
        buildItem(
          {
            id: ".",
            parent: null,
            level: 0,
            codec: result.codec,
          },
          jsonMode ? `[${result.data.join(", ")}]` : result.data
        ),
      ];
      if (!jsonMode) {
        this.expandItem(
          0,
          shouldAutoExpand ? this.autoExpandDepth ?? 4 : undefined
        );
      } else {
        this._jsonMode = jsonMode;
      }
    }
  });

  @modelAction
  replaceItemBody(item: Item, body: JSX.Element) {
    this._items[this._items.indexOf(item)] = {...item, body};
  }

  @modelAction
  expandItem(index: number, expandLevels?: number) {
    const item = this._items[index];

    const expandedItems = expandItem(
      item,
      this.expanded!,
      expandLevels,
      this.countPrefix,
      this.ignorePrefix,
      this.loadNestedData,
      this
    );
    this._items.splice(index + 1, 0, ...expandedItems);
  }

  @modelAction
  collapseItem(index: number) {
    const item = this._items[index];

    if (item.type !== ItemType.Scalar && item.type !== ItemType.Other) {
      const itemEndIndex = this._items.indexOf(
        (item as any).closingBracket,
        index
      );

      if (itemEndIndex !== -1) {
        this.expanded!.delete(item.id);
        this._items.splice(index + 1, itemEndIndex - index);
      }
    }
  }
}
