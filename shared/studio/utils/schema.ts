import {SchemaType as RawSchemaType} from "@edgedb/schema-graph/state/interfaces";

export interface SchemaPseudoType {
  schemaType: "Pseudo";
  id: string;
  name: string;
}

export interface SchemaScalarType {
  schemaType: "Scalar";
  id: string;
  name: string;
  enum_values: string[] | null;
}

export interface SchemaArrayType {
  schemaType: "Array";
  id: string;
  name: string;
  elementType: SchemaType;
}

export interface SchemaTupleType {
  schemaType: "Tuple";
  id: string;
  name: string;
  elements: {
    name: string | null;
    type: SchemaType;
  }[];
}

export type SchemaType =
  | SchemaPseudoType
  | SchemaScalarType
  | SchemaArrayType
  | SchemaTupleType;

export function buildTypesGraph(
  typeData: RawSchemaType[]
): Map<string, SchemaType> {
  const types = new Map<string, SchemaType>();

  for (const type of typeData) {
    switch (type.type) {
      case "schema::PseudoType":
        types.set(type.id, {
          schemaType: "Pseudo",
          id: type.id,
          name: type.name,
        });
        break;
      case "schema::ScalarType":
        types.set(type.id, {
          schemaType: "Scalar",
          id: type.id,
          name: type.name,
          enum_values: type.enum_values,
        });
        break;
      case "schema::Array":
        types.set(type.id, {
          schemaType: "Array",
          id: type.id,
          name: type.name,
        } as any);
        break;
      case "schema::Tuple":
        types.set(type.id, {
          schemaType: "Tuple",
          id: type.id,
          name: type.name,
        } as any);
        break;
      default:
        throw new Error(`unknown type: ${type.type}`);
    }
  }

  for (const type of typeData) {
    switch (type.type) {
      case "schema::Array": {
        const elementType = types.get(type.element_type_id!);
        if (!elementType) {
          throw new Error(
            `cannot find element type id: ${type.element_type_id} for array type ${type.name}`
          );
        }
        (types.get(type.id) as SchemaArrayType).elementType = elementType;
        break;
      }
      case "schema::Tuple": {
        const isNamed = type.element_types!.some(
          (el, i) => el.name !== i.toString()
        );
        (types.get(type.id) as SchemaTupleType).elements =
          type.element_types!.map((el) => {
            const elType = types.get(el.type_id);
            if (!elType) {
              throw new Error(
                `cannot find element type id: ${el.type_id} for tuple type ${type.name}`
              );
            }
            return {type: elType, name: isNamed ? el.name : null};
          });
        break;
      }
      default:
        break;
    }
  }

  return types;
}

export function getNameOfSchemaType(type: SchemaType): string {
  switch (type.schemaType) {
    case "Scalar":
    case "Pseudo":
      return type.name;
    case "Array":
      return `array<${getNameOfSchemaType(type.elementType)}>`;
    case "Tuple":
      return `tuple<${type.elements
        .map(
          (element) =>
            `${element.name ? `${element.name}: ` : ""}${getNameOfSchemaType(
              element.type
            )}`
        )
        .join(", ")}>`;
  }
}
