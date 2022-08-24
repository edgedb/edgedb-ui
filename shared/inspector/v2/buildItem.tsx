import React from "react";

import cn from "@edgedb/common/utils/classNames";

import {_ICodec} from "edgedb";
import {CodecKind} from "edgedb/dist/codecs/ifaces";
import {ObjectCodec} from "edgedb/dist/codecs/object";
import {NamedTupleCodec} from "edgedb/dist/codecs/namedtuple";

import {buildScalarItem} from "./buildScalar";

import styles from "./inspector.module.scss";
import {InspectorState, NestedDataGetter} from "./state";

export enum ItemType {
  Set,
  Array,
  Object,
  Tuple,
  NamedTuple,
  Scalar,
  Other,
}

export type Item = {
  id: string;
  parent: Item | null;
  level: number;
  height?: number;
  codec: _ICodec;
  label?: JSX.Element;
  body: JSX.Element;
  fieldName?: string;
} & (
  | {
      type: ItemType.Set | ItemType.Array | ItemType.Tuple;
      data: any[] | null;
      closingBracket: Item;
      expectedCount?: number;
    }
  | {
      type: ItemType.Object | ItemType.NamedTuple;
      data: {[key: string]: any};
      closingBracket: Item;
    }
  | {
      type: ItemType.Scalar | ItemType.Other;
    }
);

export function expandItem(
  item: Item,
  expanded: Set<string>,
  expandLevels: number | undefined,
  countPrefix: string | null,
  ignorePrefix: string | null,
  loadNestedData: NestedDataGetter | null,
  state: InspectorState
): Item[] {
  if (item.type !== ItemType.Scalar && item.type !== ItemType.Other) {
    expanded.add(item.id);

    const shouldExpandChildren =
      !!expandLevels && item.level + 1 < expandLevels;

    let childItems: Item[];

    switch (item.type) {
      case ItemType.Set:
      case ItemType.Array:
      case ItemType.Tuple:
        {
          childItems = (item.data ?? []).flatMap((data, i) => {
            const subCodec =
              item.level === 0
                ? item.codec
                : item.codec.getKind() === "tuple"
                ? item.codec.getSubcodecs()[i]
                : item.codec.getSubcodecs()[0];

            const id = `${item.id}.${i}`;

            const childItem = buildItem(
              {
                id,
                parent: item,
                codec: subCodec,
                level: item.level + 1,
              },
              data,
              i < item.data!.length - 1
            );

            return [
              childItem,
              ...(shouldExpandChildren || expanded.has(id)
                ? expandItem(
                    childItem,
                    expanded,
                    expandLevels,
                    countPrefix,
                    ignorePrefix,
                    loadNestedData,
                    state
                  )
                : []),
            ];
          });

          if (
            item.expectedCount !== undefined &&
            (!item.data || item.expectedCount > item.data.length)
          ) {
            const more = item.expectedCount - (item.data?.length ?? 0);

            const canLoadMoreData =
              loadNestedData &&
              (item.data?.length ?? 0) === 0 &&
              (item.parent as any)?.data &&
              item.fieldName;

            const childItem: Item = {
              id: `${item.id}.count`,
              parent: item,
              type: ItemType.Other,
              codec: item.codec,
              level: item.level + 1,
              body: (
                <>
                  {canLoadMoreData ? (
                    <span
                      className={cn(styles.resultsHidden, styles.loadable)}
                      onClick={async () => {
                        state.replaceItemBody(
                          childItem,
                          <span className={styles.resultsHidden}>
                            Loading...
                          </span>
                        );
                        const {data, codec} = await loadNestedData(
                          (item.parent as any).data.__tname__,
                          (item.parent as any).data.id,
                          item.fieldName!
                        );
                        (item.parent as any).data[item.fieldName!] = data;
                        const codecIndex = (
                          item.parent as any
                        ).codec.fields.findIndex(
                          (f: any) => f.name === item.fieldName!
                        );
                        (item.parent as any).codec.codecs[
                          codecIndex
                        ].subCodec = codec;
                        const parentIndex = state._items.indexOf(item.parent!);
                        state.collapseItem(parentIndex);
                        state.expandItem(parentIndex);
                      }}
                    >
                      load {more} hidden result{more > 1 ? "s" : ""}...
                    </span>
                  ) : (
                    <span className={styles.resultsHidden}>
                      ...{item.data?.length ? "further " : ""}
                      {more} result{more > 1 ? "s" : ""} hidden
                    </span>
                  )}
                </>
              ),
            };
            childItems.push(childItem);
          }
        }
        break;
      case ItemType.Object:
        {
          const fields = (item.codec as ObjectCodec).getFields();
          const explicitNum = fields.filter((field) => !field.implicit).length;
          const subCodecs = item.codec.getSubcodecs();

          let explicitFieldIndex = 1;
          childItems = fields.flatMap((field, i) => {
            if (
              (field.implicit && !(!explicitNum && field.name === "id")) ||
              (countPrefix !== null && field.name.startsWith(countPrefix))
            ) {
              return [];
            }

            const id = `${item.id}.${i}`;

            const expectedCount =
              countPrefix !== null &&
              item.data[countPrefix + field.name] !== undefined
                ? parseInt(item.data[countPrefix + field.name], 10)
                : undefined;

            const childItem = buildItem(
              {
                id,
                parent: item,
                codec: subCodecs[i],
                level: item.level + 1,
                label: (
                  <>
                    <span>
                      {ignorePrefix && field.name.startsWith(ignorePrefix)
                        ? field.name.slice(ignorePrefix.length)
                        : field.name}
                    </span>
                    <span>: </span>
                  </>
                ),
                fieldName: field.name,
                expectedCount:
                  expectedCount !== undefined && !Number.isNaN(expectedCount)
                    ? expectedCount
                    : undefined,
              },
              item.data[field.name],
              !!explicitNum && explicitFieldIndex++ < explicitNum
            );

            return [
              childItem,
              ...(shouldExpandChildren || expanded.has(id)
                ? expandItem(
                    childItem,
                    expanded,
                    expandLevels,
                    countPrefix,
                    ignorePrefix,
                    loadNestedData,
                    state
                  )
                : []),
            ];
          });
        }
        break;
      case ItemType.NamedTuple:
        {
          const fieldNames = (item.codec as NamedTupleCodec).getNames();
          const subCodecs = item.codec.getSubcodecs();

          childItems = fieldNames.flatMap((fieldName, i) => {
            const data = item.data[fieldName];

            const id = `${item.id}.${i}`;

            const childItem = buildItem(
              {
                id,
                parent: item,
                codec: subCodecs[i],
                level: item.level + 1,
                label: (
                  <>
                    {fieldName}
                    <span> := </span>
                  </>
                ),
                fieldName: fieldName,
              },
              data,
              i < item.data.length - 1
            );

            return [
              childItem,
              ...(shouldExpandChildren || expanded.has(id)
                ? expandItem(
                    childItem,
                    expanded,
                    expandLevels,
                    countPrefix,
                    ignorePrefix,
                    loadNestedData,
                    state
                  )
                : []),
            ];
          });
        }
        break;
      default:
        assertNever(item.type);
    }

    return [...childItems, item.closingBracket];
  }

  return [];
}

const itemTypes: {
  [key in Exclude<CodecKind, "range" | "sparse_object">]: {
    type: ItemType;
    brackets: string;
  };
} = {
  set: {type: ItemType.Set, brackets: "{}"},
  array: {type: ItemType.Array, brackets: "[]"},
  object: {type: ItemType.Object, brackets: "{}"},
  tuple: {type: ItemType.Tuple, brackets: "()"},
  namedtuple: {type: ItemType.NamedTuple, brackets: "()"},
  scalar: {type: ItemType.Scalar, brackets: ""},
};

export function buildItem(
  base: {
    id: string;
    parent: Item | null;
    level: number;
    codec: _ICodec;
    label?: JSX.Element;
    fieldName?: string;
    expectedCount?: number;
  },
  data: any,
  comma?: boolean
): Item {
  if (data === null && !base.expectedCount) {
    return buildScalarItem(base, null, comma);
  }

  const codecKind =
    base.level === 0 || (base.expectedCount && data === null)
      ? "set"
      : base.codec.getKind();

  if (codecKind === "scalar" || codecKind === "range") {
    return buildScalarItem(base, data, comma);
  }

  const {type, brackets} = itemTypes[codecKind];

  return {
    ...base,
    type,
    data,
    body: (
      <>
        {type === ItemType.Object && data?.__tname__ !== "std::FreeObject" ? (
          <span className={styles.typeName}>
            {data.__tname__ ?? "Object"}{" "}
          </span>
        ) : null}
        {brackets[0]}
      </>
    ),
    closingBracket: {
      id: base.id,
      parent: base.parent,
      level: base.level,
      codec: base.codec,
      type: ItemType.Other,
      body: (
        <span>
          {brackets[1]}
          {comma ? "," : ""}
        </span>
      ),
    },
  };
}

export function assertNever(value: never): never {
  throw new Error(
    `Unhandled discriminated union member: ${JSON.stringify(value)}`
  );
}
