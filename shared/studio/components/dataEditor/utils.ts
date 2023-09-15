import {Range} from "edgedb";

import {SchemaScalarType} from "@edgedb/common/schemaData";
import {assertNever} from "@edgedb/common/utils/assertNever";

import {parsers} from "./parsers";
import {scalarItemToString} from "@edgedb/inspector/buildScalar";

export interface EditorArrayType {
  schemaType: "Array";
  name: string;
  elementType: PrimitiveType;
}

export interface EditorTupleType {
  schemaType: "Tuple";
  name: string;
  named: boolean;
  elements: {
    name: string | null;
    type: PrimitiveType;
  }[];
}

export interface EditorRangeType {
  schemaType: "Range";
  name: string;
  elementType: SchemaScalarType;
}

export type PrimitiveType =
  | SchemaScalarType
  | EditorRangeType
  | EditorArrayType
  | EditorTupleType;

export interface EditorRangeValue {
  lower: string | null;
  upper: string | null;
  incLower: boolean;
  incUpper: boolean;
  empty: boolean;
}

export type EditorValue = string | EditorRangeValue | EditorValue[];

export function newPrimitiveValue(
  type: PrimitiveType
): [EditorValue, boolean] {
  const schemaType = type.schemaType;
  switch (schemaType) {
    case "Scalar":
      return [
        type.enum_values ? type.enum_values[0] : "",
        (type.knownBaseType ?? type).name !== "std::str",
      ];
    case "Array":
      return [[], false];
    case "Range":
      return [
        {
          lower: "",
          upper: "",
          incLower: true,
          incUpper: false,
          empty: false,
        },
        false,
      ];
    case "Tuple":
      let error = false;
      const value = type.elements.map((element) => {
        const [val, err] = newPrimitiveValue(element.type);
        error ||= err;
        return val;
      });
      return [value, error];
    default:
      assertNever(schemaType);
  }
}

export function valueToEditorValue(
  value: any,
  type: PrimitiveType
): EditorValue {
  const schemaType = type.schemaType;
  switch (schemaType) {
    case "Scalar":
      if (value == null) {
        throw new Error(`Value in primitive type cannot be null`);
      }
      return scalarItemToString(value, (type.knownBaseType ?? type).name);
    case "Array":
      if (!Array.isArray(value)) {
        throw new Error(`Expected array value for array type`);
      }
      return value.map((val) => valueToEditorValue(val, type.elementType));
    case "Tuple":
      if (type.named ? typeof value !== "object" : !Array.isArray(value)) {
        throw new Error(
          `Expected ${type.named ? "object" : "array"} value for ${
            type.named ? "named " : ""
          }tuple type`
        );
      }
      return type.elements.map((el, i) =>
        valueToEditorValue(value[el.name ?? i], el.type)
      );
    case "Range":
      if (!(value instanceof Range)) {
        throw new Error(`Expected Range value for range type`);
      }
      return {
        lower:
          value.lower != null
            ? scalarItemToString(
                value.lower,
                (type.elementType.knownBaseType ?? type.elementType).name
              )
            : null,
        upper:
          value.upper != null
            ? scalarItemToString(
                value.upper,
                (type.elementType.knownBaseType ?? type.elementType).name
              )
            : null,
        incLower: value.incLower,
        incUpper: value.incUpper,
        empty: value.isEmpty,
      };
    default:
      assertNever(schemaType);
  }
}

export function parseEditorValue(
  value: EditorValue,
  type: PrimitiveType
): any {
  const schemaType = type.schemaType;
  switch (schemaType) {
    case "Scalar":
      if (type.enum_values) {
        if (!type.enum_values.includes(value as string)) {
          throw new Error(
            `"${value}" is not a valid value of enum ${type.name}`
          );
        }
        return value;
      }
      const parser = parsers[(type.knownBaseType ?? type).name];
      if (!parser) {
        throw new Error(`Could not find parser for type: ${type.name}`);
      }
      if (typeof value !== "string") {
        throw new Error(`Expected string value for scalar type`);
      }
      return parser(value, type.arg_values);
    case "Array":
      if (!Array.isArray(value)) {
        throw new Error(`Expected array value for array type`);
      }
      return value.map((val) => parseEditorValue(val, type.elementType));
    case "Tuple":
      if (!Array.isArray(value)) {
        throw new Error(`Expected array value for tuple type`);
      }
      if (value.length !== type.elements.length) {
        throw new Error(`Tuple elements length mismatch`);
      }
      return type.elements.reduce(
        (parsed, element, i) => {
          (parsed as any)[element.name ?? i] = parseEditorValue(
            value[i],
            element.type
          );
          return parsed;
        },
        type.named ? ({} as {[key: string]: any}) : []
      );
    case "Range": {
      const keys = Object.keys(value);
      if (!keys.includes("lower")) {
        throw new Error(`Expected EditorRangeValue for range type`);
      }
      const val = value as EditorRangeValue;
      if (val.empty) {
        return Range.empty();
      }
      return new Range(
        val.lower !== null
          ? parseEditorValue(val.lower, type.elementType)
          : null,
        val.upper !== null
          ? parseEditorValue(val.upper, type.elementType)
          : null,
        val.incLower,
        val.incUpper
      );
    }
    default:
      assertNever(schemaType);
  }
}

export function isEditorValueValid(
  value: EditorValue,
  type: PrimitiveType
): boolean {
  try {
    parseEditorValue(value, type);
    return true;
  } catch {
    return false;
  }
}
