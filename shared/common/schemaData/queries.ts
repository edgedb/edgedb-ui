export interface SchemaAnnotation {
  name: string;
  "@value": string;
}

export type SchemaCardinality = "One" | "Many";

export interface RawSchemaType {
  type: string;
  id: string;
  name: string;
  abstract: boolean;
  builtin: boolean;
  from_alias: boolean;
  expr: string;
  baseIds: string[];
  constraintIds: string[];
  element_type_id: string | null;
  element_types:
    | {
        name: string;
        type_id: string;
      }[]
    | null;
  enum_values: string[] | null;
  default: string | null;
  annotations: SchemaAnnotation[] | null;
  intersectionOfIds: string[] | null;
  unionOfIds: string[] | null;
  pointers:
    | {
        type: string;
        name: string;
        targetId: string;
        required: boolean;
        readonly: boolean;
        cardinality: SchemaCardinality;
        default: string | null;
        expr: string | null;
        constraintIds: string[];
        annotations: SchemaAnnotation[];
        properties:
          | {
              name: string;
              targetId: string;
              required: boolean;
              readonly: boolean;
              cardinality: SchemaCardinality;
              default: string | null;
              expr: string | null;
              constraintIds: string[];
              annotations: SchemaAnnotation[];
            }[]
          | null;
      }[]
    | null;
}

export const typesQuery = `
with module schema
select Type {
  type := .__type__.name,
  id,
  name,
  abstract,
  builtin,
  from_alias,
  expr,
  baseIds := (
    select [is InheritingObject].bases
    order by @index
  ).id,
  constraintIds := [is ConsistencySubject].constraints.id,
  element_type_id := [is Array].element_type.id,
  [is Tuple].element_types: {
    name,
    type_id := .type.id,
  } order by @index,
  [is ScalarType].enum_values,
  [is ScalarType].default,
  # [is AnnotationSubject].annotations: {
  #   name,
  #   @value,
  # },
  intersectionOfIds := [is ObjectType].intersection_of.id,
  unionOfIds := [is ObjectType].union_of.id,
  [is ObjectType].pointers: {
    type := .__type__.name,
    name,
    targetId := .target.id,
    required,
    readonly,
    cardinality,
    default,
    expr,
    constraintIds := .constraints.id,
    annotations: {
      name,
      @value,
    },
    [is Link].properties: {
      name,
      targetId := .target.id,
      required,
      readonly,
      cardinality,
      default,
      expr,
      constraintIds := .constraints.id,
      annotations: {
        name,
        @value,
      },
    }
  },
}
`;

export type SchemaTypemod = "SetOfType" | "OptionalType" | "SingletonType";

export type SchemaVolatility = "Immutable" | "Stable" | "Volatile";

export type SchemaParameterKind =
  | "VariadicParam"
  | "NamedOnlyParam"
  | "PositionalParam";

export interface RawFunctionParamType {
  name: string;
  typeId: string;
  default: string;
  kind: SchemaParameterKind;
  num: number;
  typemod: SchemaTypemod;
}

export interface RawFunctionType {
  id: string;
  name: string;
  params: RawFunctionParamType[];
  returnTypeId: string;
  return_typemod: SchemaTypemod;
  volatility: SchemaVolatility;
  annotations: SchemaAnnotation[] | null;
}

export const functionsQuery = `
with module schema
select Function {
  id,
  name,
  params: {
    name,
    typeId := .type.id,
    default,
    kind,
    num,
    typemod,
  } order by .num,
  returnTypeId := .return_type.id,
  return_typemod,
  volatility,
  annotations: {
    name,
    @value
  },
}`;

export interface RawConstraintType {
  id: string;
  name: string;
  abstract: boolean;
  params: (RawFunctionParamType & {"@value": string})[];
  expr: string | null;
  delegated: boolean;
  errmessage: string;
  annotations: SchemaAnnotation[] | null;
}

export const constraintsQuery = `
with module schema
select Constraint {
  id,
  name,
  abstract,
  params: {
    name,
    typeId := .type.id,
    default,
    kind,
    num,
    typemod,
    @value,
  } filter .name != '__subject__'
    order by .num,
  expr,
  delegated,
  errmessage,
  annotations: {
    name,
    @value
  },
}
`;
