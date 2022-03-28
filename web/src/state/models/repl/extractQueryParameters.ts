import {SyntaxNode} from "@lezer/common";

import {parser} from "@edgedb/lang-edgeql";
import {SchemaScalar} from "@edgedb/schema-graph";

import {getAllChildren, getNodeText} from "src/utils/syntaxTree";

interface ExtractedParameter {
  name: string;
  type: string | null;
  array: boolean;
  optional: boolean;
  error?: string;
}

export interface ResolvedParameter extends ExtractedParameter {
  type: KnownScalarType | null;
}

export const KnownScalarTypes = [
  "std::uuid",
  "std::str",
  "std::bytes",
  "std::int16",
  "std::int32",
  "std::int64",
  "std::float32",
  "std::float64",
  "std::decimal",
  "std::bool",
  "std::datetime",
  "cal::local_datetime",
  "cal::local_date",
  "cal::local_time",
  "std::duration",
  "std::json",
  "std::bigint",
  "cfg::memory",
] as const;

type KnownScalarType = typeof KnownScalarTypes[number];

export async function extractQueryParameters(
  query: string,
  schemaScalars: SchemaScalar[]
) {
  try {
    const syntaxTree = parser.parse(query);

    const extractedParams = getAllChildren(
      syntaxTree.topNode,
      "QueryParameterName"
    ).map((paramNode) => {
      const paramName = getNodeText(query, paramNode).slice(1);

      const param: ExtractedParameter = {
        name: paramName,
        type: null,
        array: false,
        optional: false,
      };

      const paramCast = paramNode.prevSibling;
      if (
        !paramNode.parent?.type.is("QueryParameter") ||
        !paramCast?.type.is("Cast")
      ) {
        param.error = "Missing a type cast before the parameter";
        return param;
      }

      let castType: SyntaxNode | null = paramCast.firstChild;

      if (!castType) {
        param.error = "Invalid parameter cast";
        return param;
      }
      if (castType.type.is("Keyword")) {
        const keyword = getNodeText(query, castType).toLowerCase();
        if (
          (keyword !== "optional" && keyword !== "required") ||
          castType.nextSibling === null
        ) {
          param.error = "Invalid parameter cast";
          return param;
        }

        param.optional = keyword === "optional";

        castType = castType.nextSibling;
      }

      if (castType.type.is("BuiltinName")) {
        const name = getNodeText(query, castType);
        if (name === "array") {
          param.array = true;
          castType = castType.nextSibling;
        }
      }

      if (
        !castType ||
        castType.nextSibling !== null ||
        !castType.type.is("Name")
      ) {
        param.error = "Invalid parameter cast";
        return param;
      }

      param.type = getNodeText(query, castType);

      return param;
    });

    const resolvedParams = new Map<string, ResolvedParameter>();

    const schemaScalarsMap = new Map(
      schemaScalars.map((scalar) => [scalar.name, scalar])
    );

    for (const param of extractedParams) {
      if (param.error) {
        resolvedParams.set(param.name, {...param, type: null});
        continue;
      }

      let resolvedType: KnownScalarType | null = null;
      if (
        KnownScalarTypes.includes(param.type as any) ||
        KnownScalarTypes.includes(`std::${param.type}` as any)
      ) {
        resolvedType = param.type as any;
      } else {
        let typeName = param.type!;
        while (
          schemaScalarsMap.has(typeName) ||
          schemaScalarsMap.has(`default::${typeName}`)
        ) {
          const extendsTypeName = (schemaScalarsMap.get(typeName) ??
            schemaScalarsMap.get(`default::${typeName}`))!.extends[0];
          if (KnownScalarTypes.includes(extendsTypeName as any)) {
            resolvedType = extendsTypeName as any;
            break;
          }
          typeName = extendsTypeName;
        }
      }

      if (!resolvedType) {
        resolvedParams.set(param.name, {
          ...param,
          type: null,
          error: "Parameter cast does not resolve to a supported scalar type",
        });
      } else {
        const resolvedParam = resolvedParams.get(param.name);
        if (
          resolvedParam &&
          (resolvedParam.type !== resolvedType ||
            resolvedParam.array !== param.array ||
            resolvedParam.optional !== param.optional)
        ) {
          resolvedParam.error =
            "Parameter has multiple usages with incompatible casts";
        } else if (!resolvedParam) {
          resolvedParams.set(param.name, {
            ...param,
            type: resolvedType,
          });
        }
      }
    }

    return resolvedParams;
  } catch {
    return;
  }
}
