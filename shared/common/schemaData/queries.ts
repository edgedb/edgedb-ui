export interface SchemaAnnotation {
  name: string;
  "@value": string;
}

export type SchemaCardinality = "One" | "Many";
export type SchemaAccessKind =
  | "Select"
  | "UpdateRead"
  | "UpdateWrite"
  | "Delete"
  | "Insert";
export type SchemaAccessPolicyAction = "Allow" | "Deny";

export interface SchemaAccessPolicy {
  name: string;
  access_kinds: SchemaAccessKind[];
  condition: string | null;
  action: SchemaAccessPolicyAction;
  expr: string | null;
  annotations: SchemaAnnotation[];
}

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
  range_element_type_id: string | null;
  element_types: {name: string; type_id: string}[] | null;
  named: boolean | null;
  enum_values: string[] | null;
  default: string | null;
  annotations: SchemaAnnotation[] | null;
  intersectionOfIds: string[] | null;
  unionOfIds: string[] | null;
  pointers: {id: string; "@owned": boolean}[] | null;
  indexes:
    | {
        id: string;
        expr: string;
        "@owned": boolean;
        annotations: SchemaAnnotation[];
      }[]
    | null;
  access_policies: SchemaAccessPolicy[] | null;
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
  range_element_type_id := [is Range].element_type.id,
  [is Tuple].element_types: {
    name,
    type_id := .type.id,
  } order by @index,
  [is Tuple].named,
  [is ScalarType].enum_values,
  [is ScalarType].default,
  [is AnnotationSubject].annotations: {
    name,
    @value,
  },
  intersectionOfIds := [is ObjectType].intersection_of.id,
  unionOfIds := [is ObjectType].union_of.id,
  [is ObjectType].pointers: {
    id,
    @owned,
  },
  [is ObjectType].indexes: {
    id,
    expr,
    @owned,
    annotations: {
      name,
      @value,
    },
  },
  [is ObjectType].access_policies: {
    name,
    access_kinds,
    condition,
    action,
    expr,
    annotations: {
      name,
      @value,
    }
  },
}
`;

export type TargetDeleteAction =
  | "Restrict"
  | "DeleteSource"
  | "Allow"
  | "DeferredRestrict";
export type SourceDeleteAction = "DeleteTarget" | "Allow";

export interface RawPointerType {
  id: string;
  type: string;
  name: string;
  abstract: boolean;
  builtin: boolean;
  targetId: string | null;
  baseIds: string[];
  required: boolean;
  readonly: boolean;
  cardinality: SchemaCardinality;
  default: string | null;
  expr: string | null;
  constraintIds: string[];
  annotations: SchemaAnnotation[];
  properties: {id: string; "@owned": boolean}[] | null;
  on_target_delete: TargetDeleteAction | null;
  on_source_delete: SourceDeleteAction | null;
  indexes:
    | {id: string; expr: string; annotations: SchemaAnnotation[]}[]
    | null;
}

export const pointersQuery = `
with module schema
select Pointer {
  id,
  type := .__type__.name,
  name,
  abstract,
  builtin,
  targetId := .target.id,
  baseIds := (
    select .bases
    order by @index
  ).id,
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
    id,
    @owned,
  },
  [is Link].on_target_delete,
  [is Link].on_source_delete,
  [is Link].indexes: {
    id,
    expr,
    annotations: {
      name,
      @value,
    },
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
  builtin: boolean;
  params: RawFunctionParamType[];
  returnTypeId: string;
  return_typemod: SchemaTypemod;
  volatility: SchemaVolatility;
  language: string;
  body: string | null;
  annotations: SchemaAnnotation[];
}

export const functionsQuery = `
with module schema
select Function {
  id,
  name,
  builtin,
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
  language,
  body,
  annotations: {
    name,
    @value
  },
}`;

export type SchemaOperatorKind = "Infix" | "Postfix" | "Prefix" | "Ternary";

export interface RawOperatorType {
  id: string;
  name: string;
  builtin: boolean;
  operator_kind: SchemaOperatorKind;
  params: RawFunctionParamType[];
  returnTypeId: string;
  return_typemod: SchemaTypemod;
  annotations: SchemaAnnotation[];
}

export const operatorsQuery = `
with module schema
select Operator {
  id,
  name,
  builtin,
  operator_kind,
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
  annotations: {
    name,
    @value
  },
}
`;

export interface RawConstraintType {
  id: string;
  name: string;
  abstract: boolean;
  builtin: boolean;
  inherited_fields: string[];
  params: (RawFunctionParamType & {"@value": string})[];
  expr: string | null;
  subjectexpr: string | null;
  delegated: boolean;
  errmessage: string;
  annotations: SchemaAnnotation[];
}

export const constraintsQuery = `
with module schema
select Constraint {
  id,
  name,
  abstract,
  builtin,
  inherited_fields,
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
  subjectexpr,
  delegated,
  errmessage,
  annotations: {
    name,
    @value
  },
}
`;

export interface RawAbstractAnnotation {
  id: string;
  name: string;
  builtin: boolean;
  inheritable: boolean;
  annotations: SchemaAnnotation[];
}

export const annotationsQuery = `
with module schema
select Annotation {
  id,
  name,
  builtin,
  inheritable,
  annotations: {
    name,
    @value
  },
}
`;

export interface RawSchemaAlias {
  id: string;
  name: string;
  builtin: boolean;
  expr: string;
  typeId: string;
  annotations: SchemaAnnotation[];
}

export const aliasesQuery = `
with module schema
select Alias {
  id,
  name,
  builtin,
  expr,
  typeId := .type.id,
  annotations: {
    name,
    @value
  },
}
`;

export interface RawSchemaGlobal {
  id: string;
  name: string;
  builtin: string;
  required: boolean;
  cardinality: SchemaCardinality;
  expr: string | null;
  targetId: string;
  default: string;
  annotations: SchemaAnnotation[];
}

export const globalsQuery = `
select schema::Global {
  id,
  name,
  builtin,
  required,
  cardinality,
  expr,
  targetId := .target.id,
  default,
  annotations: {
    name,
    @value
  },
}
`;

export interface RawSchemaExtension {
  id: string;
  name: string;
}

export const extensionsQuery = `
select schema::Extension {
  id,
  name
}
`;

export const introspectionQuery = `select {
  types := (${typesQuery}),
  pointers := (${pointersQuery}),
  functions := (${functionsQuery}),
  operators := (${operatorsQuery}),
  constraints := (${constraintsQuery}),
  annotations := (${annotationsQuery}),
  aliases := (${aliasesQuery}),
  globals := (${globalsQuery}),
  extensions := (${extensionsQuery}),
}`;

export interface RawIntrospectionResult {
  types: RawSchemaType[];
  pointers: RawPointerType[];
  functions: RawFunctionType[];
  operators: RawOperatorType[];
  constraints: RawConstraintType[];
  annotations: RawAbstractAnnotation[];
  aliases: RawSchemaAlias[];
  globals: RawSchemaGlobal[];
  extensions: RawSchemaExtension[];
}
