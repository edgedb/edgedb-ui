import {
  RawConstraintType,
  RawFunctionType,
  RawSchemaType,
  SchemaAnnotation,
  SchemaCardinality,
  SchemaParameterKind,
  SchemaTypemod,
  SchemaVolatility,
} from "./queries";
import {KnownScalarTypes} from "./knownTypes";

export {KnownScalarTypes};

export interface SchemaPseudoType {
  schemaType: "Pseudo";
  id: string;
  name: string;
}

export interface SchemaScalarType {
  schemaType: "Scalar";
  id: string;
  name: string;
  abstract: boolean;
  default: string | null;
  enum_values: string[] | null;
  knownBaseType: SchemaScalarType | null;
  bases: SchemaScalarType[];
  constraints: SchemaConstraint[];
  annotations: SchemaAnnotation[];
}

export interface SchemaArrayType {
  schemaType: "Array";
  id: string;
  name: string;
  abstract: boolean;
  elementType: SchemaType;
}

export interface SchemaTupleType {
  schemaType: "Tuple";
  id: string;
  name: string;
  abstract: boolean;
  elements: {
    name: string | null;
    type: SchemaType;
  }[];
}

interface _SchemaPointer {
  type: string;
  name: string;
  target: SchemaType;
  required: boolean;
  readonly: boolean;
  cardinality: SchemaCardinality;
  default: string | null;
  expr: string | null;
  constraints: SchemaConstraint[];
  annotations: SchemaAnnotation[];
}

export interface SchemaProperty extends _SchemaPointer {
  type: "Property";
}

export interface SchemaLink extends _SchemaPointer {
  type: "Link";
  target: SchemaObjectType;
  properties: {[name: string]: SchemaProperty};
}

export type SchemaPointer = SchemaProperty | SchemaLink;

export interface SchemaObjectType {
  schemaType: "Object";
  id: string;
  name: string;
  abstract: boolean;
  builtin: boolean;
  from_alias: boolean;
  expr: string;
  bases: SchemaObjectType[];
  extendedBy: SchemaObjectType[];
  ancestors: SchemaObjectType[];
  descendents: SchemaObjectType[];
  constraints: SchemaConstraint[];
  annotations: SchemaAnnotation[];
  insectionOf: SchemaObjectType[] | null;
  unionOf: SchemaObjectType[] | null;
  properties: {[name: string]: SchemaProperty};
  links: {[name: string]: SchemaLink};
}

export type SchemaType =
  | SchemaPseudoType
  | SchemaScalarType
  | SchemaArrayType
  | SchemaTupleType
  | SchemaObjectType;

export interface SchemaParam {
  name: string;
  type: SchemaType;
  default: string;
  kind: SchemaParameterKind;
  num: number;
  typemod: SchemaTypemod;
}

export interface SchemaFunction {
  id: string;
  name: string;
  params: SchemaParam[];
  returnType: SchemaType;
  returnTypemod: SchemaTypemod;
  volatility: SchemaVolatility;
  annotations: SchemaAnnotation[] | null;
}

export interface SchemaConstraint {
  id: string;
  name: string;
  abstract: boolean;
  params: (SchemaParam & {"@value": string})[];
  expr: string | null;
  delegated: boolean;
  errmessage: string;
  annotations: SchemaAnnotation[] | null;
}

const knownTypes = new Set<string>(KnownScalarTypes);

export function buildTypesGraph(data: {
  types: RawSchemaType[];
  functions: RawFunctionType[];
  constraints: RawConstraintType[];
}): {
  types: Map<string, SchemaType>;
  functions: Map<string, SchemaFunction>;
  constraints: Map<string, SchemaConstraint>;
} {
  const types = new Map<string, SchemaType>();
  const functions = new Map<string, SchemaFunction>();
  const constraints = new Map<string, SchemaConstraint>();

  const extendedBy = new Map<string, Set<SchemaObjectType>>();

  function getType(id: string, errMessage: string) {
    const type = types.get(id);
    if (!type) {
      throw new Error(errMessage);
    }
    return type;
  }

  for (const type of data.types) {
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
          abstract: type.abstract,
          default: type.default,
          enum_values: type.enum_values,
          annotations: [], //type.annotations,
        } as any);
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
      case "schema::ObjectType":
        types.set(type.id, {
          schemaType: "Object",
          id: type.id,
          name: type.name,
          abstract: type.abstract,
          builtin: type.builtin,
          from_alias: type.from_alias,
          expr: type.expr,
          annotations: [], // type.annotations,
          properties: {},
          links: {},
        } as any);
        for (const baseId of type.baseIds) {
          if (!extendedBy.has(baseId)) {
            extendedBy.set(baseId, new Set());
          }
          extendedBy.get(baseId).add(types.get(type.id) as SchemaObjectType);
        }
        break;
      default:
        throw new Error(`unknown type: ${type.type}`);
    }
  }

  for (const func of data.functions) {
    functions.set(func.id, {
      id: func.id,
      name: func.name,
      params: func.params.map((param) => ({
        name: param.name,
        kind: param.kind,
        num: param.num,
        type: getType(
          param.typeId,
          `cannot find type id: ${param.typeId} for param ${param.name} of function ${func.name}`
        ),
        typemod: param.typemod,
        default: param.default,
      })),
      returnType: getType(
        func.returnTypeId,
        `cannot find type id: ${func.returnTypeId} for return type of function ${func.name}`
      ),
      returnTypemod: func.return_typemod,
      volatility: func.volatility,
      annotations: func.annotations,
    });
  }

  for (const constraint of data.constraints) {
    constraints.set(constraint.id, {
      id: constraint.id,
      name: constraint.name,
      abstract: constraint.abstract,
      params: constraint.params.map((param) => ({
        name: param.name,
        kind: param.kind,
        num: param.num,
        type: getType(
          param.typeId,
          `cannot find type id: ${param.typeId} for param ${param.name} of constraint ${constraint.name}`
        ),
        typemod: param.typemod,
        default: param.default,
        "@value": param["@value"],
      })),
      expr: constraint.expr,
      delegated: constraint.delegated,
      errmessage: constraint.errmessage,
      annotations: constraint.annotations,
    });
  }

  for (const type of data.types) {
    switch (type.type) {
      case "schema::ScalarType": {
        const t = types.get(type.id) as SchemaScalarType;
        t.bases = type.baseIds.map(
          (id) =>
            getType(
              id,
              `cannot find base type id: ${id} for scalar type ${type.name}`
            ) as SchemaScalarType
        );
        t.constraints = type.constraintIds.map((id) => {
          const constraint = constraints.get(id);
          if (!constraint) {
            throw new Error(
              `cannot find constraint type id: ${id} for scalar type ${type.name}`
            );
          }
          return constraint;
        });
        break;
      }
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
      case "schema::ObjectType": {
        const t = types.get(type.id) as SchemaObjectType;
        t.bases = type.baseIds.map(
          (id) =>
            getType(
              id,
              `cannot find base type id: ${id} for object type ${type.name}`
            ) as SchemaObjectType
        );
        t.extendedBy = [...(extendedBy.get(type.id) ?? [])];
        t.constraints = type.constraintIds.map((id) => {
          const constraint = constraints.get(id);
          if (!constraint) {
            throw new Error(
              `cannot find constraint type id: ${id} for object type ${type.name}`
            );
          }
          return constraint;
        });
        t.insectionOf = type.intersectionOfIds.length
          ? type.intersectionOfIds.map(
              (id) =>
                getType(
                  id,
                  `cannot find insection type id: ${id} for object type ${type.name}`
                ) as SchemaObjectType
            )
          : null;
        t.unionOf = type.unionOfIds.length
          ? type.unionOfIds.map(
              (id) =>
                getType(
                  id,
                  `cannot find union type id: ${id} for object type ${type.name}`
                ) as SchemaObjectType
            )
          : null;
        for (const pointer of type.pointers) {
          const isLink = pointer.type === "schema::Link";

          if (isLink && pointer.name === "__type__") {
            continue;
          }

          const p = {
            type: isLink ? "Link" : "Property",
            name: pointer.name,
            target: getType(
              pointer.targetId,
              `cannot find target id: ${pointer.targetId} for ${
                isLink ? "link" : "property"
              } ${pointer.name} on type ${type.name}`
            ),
            required: pointer.required,
            readonly: pointer.readonly,
            cardinality: pointer.cardinality,
            default: pointer.default,
            expr: pointer.expr,
            constraints: pointer.constraintIds.map((id) => {
              const constraint = constraints.get(id);
              if (!constraint) {
                throw new Error(
                  `cannot find constraint type id: ${id} for ${
                    isLink ? "link" : "property"
                  } ${pointer.name} on type ${type.name}`
                );
              }
              return constraint;
            }),
            annotations: pointer.annotations,
          } as SchemaPointer;
          if (isLink) {
            (p as SchemaLink).properties = pointer.properties.reduce(
              (linkProps, prop) => {
                if (prop.name !== "target" && prop.name !== "source") {
                  linkProps[prop.name] = {
                    type: "Property",
                    name: prop.name,
                    target: getType(
                      prop.targetId,
                      `cannot find target id: ${prop.targetId} for property ${prop.name} on link ${pointer.name} on type ${type.name}`
                    ),
                    required: pointer.required,
                    readonly: pointer.readonly,
                    cardinality: pointer.cardinality,
                    default: pointer.default,
                    expr: pointer.expr,
                    constraints: pointer.constraintIds.map((id) => {
                      const constraint = constraints.get(id);
                      if (!constraint) {
                        throw new Error(
                          `cannot find constraint type id: ${id} for property ${prop.name} on link ${pointer.name} on type ${type.name}`
                        );
                      }
                      return constraint;
                    }),
                    annotations: pointer.annotations,
                  };
                }
                return linkProps;
              },
              {}
            );
          }
          (isLink ? t.links : t.properties)[pointer.name] = p;
        }
        break;
      }
      default:
        break;
    }
  }

  for (const type of types.values()) {
    if (type.schemaType === "Scalar" && !type.enum_values) {
      if (knownTypes.has(type.name)) {
        type.knownBaseType = null;
      } else {
        const bases = [...type.bases];
        while (bases.length) {
          const base = bases.pop();
          if (knownTypes.has(base.name)) {
            type.knownBaseType = base;
            break;
          } else {
            bases.push(...base.bases);
          }
        }
        if (!type.abstract && type.bases.length && !type.knownBaseType) {
          throw new Error(
            `cannot find known base type for scalar type: ${type.name}`
          );
        }
      }
    }
    if (type.schemaType === "Object") {
      const ancestors = new Set<SchemaObjectType>();
      const queue = [...type.bases];
      while (queue.length) {
        const item = queue.pop();
        ancestors.add(item);
        queue.unshift(...item.bases);
      }

      const descendents = new Set<SchemaObjectType>();
      queue.push(...type.extendedBy);
      while (queue.length) {
        const item = queue.pop();
        descendents.add(item);
        queue.unshift(...item.extendedBy);
      }

      type.ancestors = [...ancestors];
      type.descendents = [...descendents];
    }
  }

  return {types, functions, constraints};
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
