import {SyntaxNode} from "@lezer/common";

import {parser} from "@edgedb/lang-edgeql";
import {
  SchemaScalarType,
  KnownScalarTypes,
  SchemaType,
} from "@edgedb/common/schemaData";

import {getAllChildren, getNodeText} from "../../../utils/syntaxTree";

interface ExtractedParameter {
  name: string;
  type: string;
  array: boolean;
  optional: boolean;
  error?: string;
}

export interface ResolvedParameter extends ExtractedParameter {
  resolvedBaseType: SchemaScalarType | null;
}

export function extractQueryParameters(
  query: string,
  schemaScalars: Map<string, SchemaScalarType>
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
        type: "",
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

    for (const param of extractedParams) {
      if (param.error) {
        resolvedParams.set(param.name, {...param, resolvedBaseType: null});
        continue;
      }

      const resolvedType =
        schemaScalars.get(param.type) ??
        schemaScalars.get(`default::${param.type}`) ??
        schemaScalars.get(`std::${param.type}`);

      const resolvedBaseType = resolvedType?.knownBaseType ?? resolvedType;

      console.log(resolvedBaseType);

      if (
        !resolvedBaseType ||
        (!resolvedBaseType.enum_values &&
          !KnownScalarTypes.includes(resolvedBaseType.name as any))
      ) {
        resolvedParams.set(param.name, {
          ...param,
          resolvedBaseType: null,
          error: "Parameter cast does not resolve to a supported scalar type",
        });
      } else {
        const resolvedParam = resolvedParams.get(param.name);
        if (
          resolvedParam &&
          (resolvedParam.resolvedBaseType !== resolvedBaseType ||
            resolvedParam.array !== param.array ||
            resolvedParam.optional !== param.optional)
        ) {
          resolvedParam.error =
            "Parameter has multiple usages with incompatible casts";
        } else if (!resolvedParam) {
          resolvedParams.set(param.name, {
            ...param,
            resolvedBaseType,
          });
        }
      }
    }

    return resolvedParams;
  } catch {
    return;
  }
}
