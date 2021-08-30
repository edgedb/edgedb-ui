import React from "react";

import {_introspect, _ICodec} from "edgedb";
import {
  CollectionInfo,
  NamedTupleInfo,
  ObjectInfo,
} from "edgedb/dist/src/datatypes/introspect";

import {buildScalarItem} from "./buildScalar";

import styles from "./inspector.module.scss";

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
  level: number;
  height?: number;
  codec: _ICodec;
  label?: JSX.Element;
  body: JSX.Element;
} & (
  | {
      type:
        | ItemType.Set
        | ItemType.Array
        | ItemType.Tuple
        | ItemType.NamedTuple;
      data: any[];
      closingBracket: Item;
    }
  | {
      type: ItemType.Object;
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
  expandLevels?: number
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
        childItems = item.data.flatMap((data, i) => {
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
              codec: subCodec,
              level: item.level + 1,
            },
            data,
            i < item.data.length - 1
          );

          return [
            childItem,
            ...(shouldExpandChildren || expanded.has(id)
              ? expandItem(childItem, expanded, expandLevels)
              : []),
          ];
        });
        break;
      case ItemType.Object:
        {
          const kind = _introspect(item.data) as ObjectInfo;
          const fields = kind.fields;
          const explicitNum = fields.filter((field) => !field.implicit).length;
          const subCodecs = item.codec.getSubcodecs();

          let explicitFieldIndex = 1;
          childItems = fields.flatMap((field, i) => {
            if (field.implicit && !(!explicitNum && field.name === "id")) {
              return [];
            }

            const id = `${item.id}.${i}`;

            const childItem = buildItem(
              {
                id,
                codec: subCodecs[i],
                level: item.level + 1,
                label: (
                  <>
                    <span>{field.name}</span>
                    <span>: </span>
                  </>
                ),
              },
              item.data[field.name],
              !!explicitNum && explicitFieldIndex++ < explicitNum
            );

            return [
              childItem,
              ...(shouldExpandChildren || expanded.has(id)
                ? expandItem(childItem, expanded, expandLevels)
                : []),
            ];
          });
        }
        break;
      case ItemType.NamedTuple:
        {
          const kind = _introspect(item.data) as NamedTupleInfo;
          const subCodecs = item.codec.getSubcodecs();

          childItems = item.data.flatMap((data, i) => {
            const field = kind.fields[i];

            const id = `${item.id}.${i}`;

            const childItem = buildItem(
              {
                id,
                codec: subCodecs[i],
                level: item.level + 1,
                label: (
                  <>
                    {field.name}
                    <span> := </span>
                  </>
                ),
              },
              data,
              i < item.data.length - 1
            );

            return [
              childItem,
              ...(shouldExpandChildren || expanded.has(id)
                ? expandItem(childItem, expanded, expandLevels)
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
  [key in CollectionInfo["kind"]]: {type: ItemType; brackets: string};
} = {
  set: {type: ItemType.Set, brackets: "{}"},
  array: {type: ItemType.Array, brackets: "[]"},
  object: {type: ItemType.Object, brackets: "{}"},
  tuple: {type: ItemType.Tuple, brackets: "()"},
  namedtuple: {type: ItemType.NamedTuple, brackets: "()"},
};

export function buildItem(
  base: {id: string; level: number; codec: _ICodec; label?: JSX.Element},
  data: any,
  comma?: boolean
): Item {
  if (data === null) {
    return buildScalarItem(base, null, comma);
  }

  const kind = _introspect(data);

  if (kind === null) {
    return buildScalarItem(base, data, comma);
  }

  const {type, brackets} = itemTypes[kind.kind];

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
