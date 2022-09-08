import {
  reserved_keywords,
  // @ts-ignore
} from "@edgedb/lang-edgeql/meta";

import {
  RawAbstractAnnotation,
  RawSchemaExtension,
  SchemaAnnotation,
  SchemaCardinality,
  SchemaParameterKind,
  SchemaTypemod,
  SchemaVolatility,
  RawIntrospectionResult,
  TargetDeleteAction,
  SourceDeleteAction,
  SchemaAccessPolicy,
} from "./queries";
import {KnownScalarTypes} from "./knownTypes";
import {paramToSDL} from "./utils";

export {KnownScalarTypes};
export type {SchemaAnnotation, SchemaAccessPolicy};

export interface SchemaPseudoType {
  schemaType: "Pseudo";
  id: string;
  name: string;
}

export interface SchemaScalarType {
  schemaType: "Scalar";
  id: string;
  name: string;
  escapedName: string;
  module: string;
  shortName: string;
  abstract: boolean;
  builtin: boolean;
  from_alias: boolean;
  default: string | null;
  enum_values: string[] | null;
  knownBaseType: SchemaScalarType | null;
  bases: SchemaScalarType[];
  constraints: SchemaConstraint[];
  annotations: SchemaAnnotation[];
  isDeprecated: boolean;
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
  named: boolean;
  elements: {
    name: string | null;
    type: SchemaType;
  }[];
}

export interface SchemaRangeType {
  schemaType: "Range";
  id: string;
  name: string;
  elementType: SchemaType;
}

interface _SchemaPointer {
  schemaType: "Pointer";
  id: string;
  type: string;
  name: string;
  escapedName: string;
  module: string;
  shortName: string;
  abstract: boolean;
  builtin: boolean;
  "@owned"?: boolean;
  target: SchemaType | null;
  source: SchemaObjectType | null;
  required: boolean;
  readonly: boolean;
  cardinality: SchemaCardinality;
  default: string | null;
  expr: string | null;
  constraints: SchemaConstraint[];
  annotations: SchemaAnnotation[];
  isDeprecated: boolean;
}

export interface SchemaProperty extends _SchemaPointer {
  type: "Property";
  bases: SchemaProperty[];
}

export interface SchemaLink extends _SchemaPointer {
  type: "Link";
  target: SchemaObjectType | null;
  bases: SchemaLink[];
  properties: {[name: string]: SchemaProperty};
  onTargetDelete: TargetDeleteAction;
  onSourceDelete: SourceDeleteAction;
  indexes: SchemaIndex[];
}

export type SchemaPointer = SchemaProperty | SchemaLink;

export interface SchemaObjectType {
  schemaType: "Object";
  id: string;
  name: string;
  escapedName: string;
  module: string;
  shortName: string;
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
  isDeprecated: boolean;
  insectionOf: SchemaObjectType[] | null;
  unionOf: SchemaObjectType[] | null;
  properties: {[name: string]: SchemaProperty};
  links: {[name: string]: SchemaLink};
  pointers: SchemaPointer[];
  indexes: SchemaIndex[];
  accessPolicies: SchemaAccessPolicy[];
}

export type SchemaType =
  | SchemaPseudoType
  | SchemaScalarType
  | SchemaArrayType
  | SchemaTupleType
  | SchemaRangeType
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
  schemaType: "Function";
  id: string;
  name: string;
  module: string;
  shortName: string;
  builtin: boolean;
  params: SchemaParam[];
  wrapParams: boolean;
  returnType: SchemaType;
  returnTypemod: SchemaTypemod;
  volatility: SchemaVolatility;
  language: string;
  body: string | null;
  annotations: SchemaAnnotation[];
  isDeprecated: boolean;
}

export interface SchemaConstraint {
  schemaType: "Constraint";
  id: string;
  name: string;
  module: string;
  shortName: string;
  abstract: boolean;
  builtin: boolean;
  inheritedFields: Set<string>;
  params: (SchemaParam & {"@value": string})[];
  expr: string | null;
  subjectexpr: string | null;
  delegated: boolean;
  errmessage: string;
  annotations: SchemaAnnotation[];
  isDeprecated: boolean;
}

export interface SchemaAbstractAnnotation extends RawAbstractAnnotation {
  schemaType: "AbstractAnnotation";
  module: string;
  shortName: string;
  isDeprecated: boolean;
}

export interface SchemaIndex {
  id: string;
  expr: string;
  "@owned": boolean;
  annotations: SchemaAnnotation[];
  isDeprecated: boolean;
}

export interface SchemaAlias {
  schemaType: "Alias";
  id: string;
  name: string;
  module: string;
  shortName: string;
  builtin: boolean;
  expr: string;
  type: SchemaType;
  annotations: SchemaAnnotation[];
  isDeprecated: boolean;
}

export interface SchemaGlobal {
  schemaType: "Global";
  id: string;
  name: string;
  module: string;
  shortName: string;
  builtin: string;
  required: boolean;
  cardinality: SchemaCardinality;
  expr: string | null;
  target: SchemaType;
  default: string;
  annotations: SchemaAnnotation[];
  isDeprecated: boolean;
}

export interface SchemaExtension extends RawSchemaExtension {
  schemaType: "Extension";
}

const knownTypes = new Set<string>(KnownScalarTypes);

function splitName(typeName: string) {
  const [module, shortName] = typeName.split("::");
  return {module, shortName};
}

const keywords = new Set(reserved_keywords);

function escape(name: string): string {
  return !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || keywords.has(name)
    ? "`" + name + "`"
    : name;
}

export function escapeName(typeName: string, hasModule: boolean): string {
  if (hasModule) {
    const {module, shortName} = splitName(typeName);
    return `${escape(module)}::${escape(shortName)}`;
  }
  return escape(typeName);
}

function isDeprecated(annotations: SchemaAnnotation[] | null): boolean {
  return annotations?.some((anno) => anno.name === "std::deprecated") ?? false;
}

export function buildTypesGraph(data: RawIntrospectionResult): {
  types: Map<string, SchemaType>;
  pointers: Map<string, SchemaPointer>;
  functions: Map<string, SchemaFunction>;
  constraints: Map<string, SchemaConstraint>;
  annotations: Map<string, SchemaAbstractAnnotation>;
  aliases: Map<string, SchemaAlias>;
  globals: Map<string, SchemaGlobal>;
  extensions: SchemaExtension[];
} {
  const types = new Map<string, SchemaType>();
  const pointers = new Map<string, SchemaPointer>();
  const functions = new Map<string, SchemaFunction>();
  const constraints = new Map<string, SchemaConstraint>();
  const aliases = new Map<string, SchemaAlias>();
  const globals = new Map<string, SchemaGlobal>();

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
          escapedName: escapeName(type.name, true),
          ...splitName(type.name),
          abstract: type.abstract,
          builtin: type.builtin,
          from_alias: type.from_alias,
          default: type.default,
          enum_values: type.enum_values,
          annotations: type.annotations,
          isDeprecated: isDeprecated(type.annotations),
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
          named: type.named,
        } as any);
        break;
      case "schema::Range":
        types.set(type.id, {
          schemaType: "Range",
          id: type.id,
          name: type.name,
        } as any);
        break;
      case "schema::ObjectType":
        types.set(type.id, {
          schemaType: "Object",
          id: type.id,
          name: type.name,
          escapedName: escapeName(type.name, true),
          ...splitName(type.name),
          abstract: type.abstract,
          builtin: type.builtin,
          from_alias: type.from_alias,
          expr: type.expr,
          annotations: type.annotations,
          isDeprecated: isDeprecated(type.annotations),
          properties: {},
          links: {},
          pointers: [],
          indexes: type.indexes?.map((i) => ({
            ...i,
            isDeprecated: isDeprecated(i.annotations),
          })),
          accessPolicies: type.access_policies,
        } as any);
        for (const baseId of type.baseIds) {
          if (!extendedBy.has(baseId)) {
            extendedBy.set(baseId, new Set());
          }
          extendedBy.get(baseId)!.add(types.get(type.id) as SchemaObjectType);
        }
        break;
      default:
        throw new Error(`unknown type: ${type.type}`);
    }
  }

  for (const func of data.functions) {
    const params = func.params.map((param) => ({
      name: param.name,
      kind: param.kind,
      num: param.num,
      type: getType(
        param.typeId,
        `cannot find type id: ${param.typeId} for param ${param.name} of function ${func.name}`
      ),
      typemod: param.typemod,
      default: param.default,
    }));

    let wrapParams = false;
    let paramsLen = 0;
    for (let i = 0; i < params.length; i++) {
      paramsLen +=
        paramToSDL(params[i]).length + (i !== params.length - 1 ? 2 : 0);
      if (paramsLen > 30) {
        wrapParams = true;
        break;
      }
    }

    functions.set(func.id, {
      schemaType: "Function",
      id: func.id,
      name: func.name,
      ...splitName(func.name),
      builtin: func.builtin,
      params,
      wrapParams,
      returnType: getType(
        func.returnTypeId,
        `cannot find type id: ${func.returnTypeId} for return type of function ${func.name}`
      ),
      returnTypemod: func.return_typemod,
      volatility: func.volatility,
      language: func.language,
      body: func.body,
      annotations: func.annotations,
      isDeprecated: isDeprecated(func.annotations),
    });
  }

  for (const constraint of data.constraints) {
    constraints.set(constraint.id, {
      schemaType: "Constraint",
      id: constraint.id,
      name: constraint.name,
      ...splitName(constraint.name),
      abstract: constraint.abstract,
      builtin: constraint.builtin,
      inheritedFields: new Set(constraint.inherited_fields),
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
      subjectexpr: constraint.subjectexpr,
      delegated: constraint.delegated,
      errmessage: constraint.errmessage,
      annotations: constraint.annotations,
      isDeprecated: isDeprecated(constraint.annotations),
    });
  }

  for (const pointer of data.pointers) {
    const isLink = pointer.type === "schema::Link";

    pointers.set(pointer.id, {
      schemaType: "Pointer",
      id: pointer.id,
      type: pointer.type === "schema::Link" ? "Link" : "Property",
      name: pointer.name,
      escapedName: escapeName(pointer.name, pointer.abstract),
      ...((pointer.abstract
        ? splitName(pointer.name)
        : {module: null, shortName: pointer.name}) as any),
      abstract: pointer.abstract,
      builtin: pointer.builtin,
      target: pointer.targetId
        ? getType(
            pointer.targetId,
            `cannot find target id: ${pointer.targetId} for ${
              isLink ? "link" : "property"
            } ${pointer.name} (id: ${pointer.id})`
          )
        : null,
      source: null,
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
            } ${pointer.name} (id: ${pointer.id})`
          );
        }
        return constraint;
      }),
      annotations: pointer.annotations,
      isDeprecated: isDeprecated(pointer.annotations),
      onTargetDelete: pointer.on_target_delete,
      onSourceDelete: pointer.on_source_delete,
      indexes: pointer.indexes?.map((i) => ({
        ...i,
        isDeprecated: isDeprecated(i.annotations),
      })),
    } as SchemaPointer);
  }

  for (const pointer of data.pointers) {
    pointers.get(pointer.id)!.bases = pointer.baseIds
      .map((id) => {
        const basePointer = pointers.get(id);
        if (!basePointer) {
          throw new Error(
            `cannot find base type id: ${id} for pointer type ${pointer.name}`
          );
        }
        return basePointer;
      })
      .filter(
        (base) => base.name !== "std::property" && base.name !== "std::link"
      ) as any;
    if (pointer.type === "schema::Link") {
      (pointers.get(pointer.id) as SchemaLink).properties =
        pointer.properties!.reduce((linkProps, p) => {
          const prop = pointers.get(p.id) as SchemaProperty;

          if (!prop) {
            throw new Error(
              `cannot find link property id: ${p.id} on link ${pointer.name} (id: ${pointer.id})`
            );
          }

          if (prop.name !== "target" && prop.name !== "source") {
            prop["@owned"] = p["@owned"];

            linkProps[prop.name] = prop;
          }

          return linkProps;
        }, {} as any);
    }
  }

  for (const alias of data.aliases) {
    const type = getType(
      alias.typeId,
      `cannot find type id: ${alias.typeId} for alias type ${alias.name}`
    );
    aliases.set(alias.id, {
      schemaType: "Alias",
      id: alias.id,
      name: alias.name,
      ...splitName(alias.name),
      builtin: alias.builtin,
      expr: alias.expr,
      type,
      annotations: alias.annotations,
      isDeprecated: isDeprecated(alias.annotations),
    });
  }

  for (const global of data.globals) {
    const target = getType(
      global.targetId,
      `cannot find type id: ${global.targetId} for global type ${global.name}`
    );
    globals.set(global.id, {
      schemaType: "Global",
      id: global.id,
      name: global.name,
      ...splitName(global.name),
      builtin: global.builtin,
      required: global.required,
      cardinality: global.cardinality,
      expr: global.expr,
      target,
      default: global.default,
      annotations: global.annotations,
      isDeprecated: isDeprecated(global.annotations),
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
        const t = types.get(type.id) as SchemaTupleType;
        t.elements = type.element_types!.map((el) => {
          const elType = types.get(el.type_id);
          if (!elType) {
            throw new Error(
              `cannot find element type id: ${el.type_id} for tuple type ${type.name}`
            );
          }
          return {type: elType, name: t.named ? el.name : null};
        });
        break;
      }
      case "schema::Range": {
        const elementType = types.get(type.range_element_type_id!);
        if (!elementType) {
          throw new Error(
            `cannot find element type id: ${type.range_element_type_id} for range type ${type.name}`
          );
        }
        (types.get(type.id) as SchemaRangeType).elementType = elementType;
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
        t.insectionOf = type.intersectionOfIds!.length
          ? type.intersectionOfIds!.map(
              (id) =>
                getType(
                  id,
                  `cannot find insection type id: ${id} for object type ${type.name}`
                ) as SchemaObjectType
            )
          : null;
        t.unionOf = type.unionOfIds!.length
          ? type.unionOfIds!.map(
              (id) =>
                getType(
                  id,
                  `cannot find union type id: ${id} for object type ${type.name}`
                ) as SchemaObjectType
            )
          : null;
        for (const p of type.pointers!) {
          const pointer = pointers.get(p.id)!;

          if (pointer.type === "Link" && pointer.name === "__type__") {
            continue;
          }

          pointer["@owned"] = p["@owned"];
          pointer.source = t;

          (pointer.type === "Link" ? t.links : t.properties)[pointer.name] =
            pointer as any;
          t.pointers.push(pointer as any);
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
          const base = bases.pop()!;
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
        const item = queue.pop()!;
        ancestors.add(item);
        queue.unshift(...item.bases);
      }

      const descendents = new Set<SchemaObjectType>();
      queue.push(...type.extendedBy);
      while (queue.length) {
        const item = queue.pop()!;
        descendents.add(item);
        queue.unshift(...item.extendedBy);
      }

      type.ancestors = [...ancestors].reverse();
      type.descendents = [...descendents];
    }
  }

  return {
    types,
    pointers,
    functions,
    constraints,
    annotations: new Map(
      data.annotations.map((anno) => [
        anno.id,
        {
          schemaType: "AbstractAnnotation",
          ...anno,
          ...splitName(anno.name),
          isDeprecated: isDeprecated(anno.annotations),
        },
      ])
    ),
    aliases,
    globals,
    extensions: data.extensions.map((ext) => ({
      schemaType: "Extension",
      ...ext,
    })),
  };
}

export function getNameOfSchemaType(type: SchemaType): string {
  switch (type.schemaType) {
    case "Scalar":
    case "Pseudo":
    case "Object":
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
    default:
      throw new Error(`unknown schema type: ${(type as any).schemaType}`);
  }
}
