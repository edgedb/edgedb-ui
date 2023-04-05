import {SyntaxNode} from "@lezer/common";

import {parser} from "@edgedb/lang-edgeql";
import {KnownScalarTypes, SchemaScalarType} from "@edgedb/common/schemaData";

import {getAllChildren, getNodeText} from "../../../utils/syntaxTree";
import {PrimitiveType} from "../../../components/dataEditor/utils";

export type ResolvedParameter =
  | {
      name: string;
      type: PrimitiveType;
      optional: boolean;
      error: null;
    }
  | {
      name: string;
      error: string;
    };

const validRangeScalars = new Set([
  "std::int32",
  "std::int64",
  "std::float32",
  "std::float64",
  "std::decimal",
  "std::datetime",
  "cal::local_datetime",
  "cal::local_date",
]);

function resolveCastType(
  query: string,
  schemaScalars: Map<string, SchemaScalarType>,
  castNode: SyntaxNode | null
): PrimitiveType {
  if (!castNode) {
    throw new Error("Invalid parameter cast");
  }
  if (castNode.type.is("Name")) {
    const typeName = getNodeText(query, castNode);

    const resolvedType =
      schemaScalars.get(typeName) ??
      schemaScalars.get(`default::${typeName}`) ??
      schemaScalars.get(`std::${typeName}`);

    if (
      !resolvedType ||
      (!resolvedType.enum_values &&
        !KnownScalarTypes.includes(
          (resolvedType.knownBaseType ?? resolvedType).name as any
        ))
    ) {
      throw new Error(
        "Parameter cast does not resolve to a supported scalar type"
      );
    }

    return resolvedType;
  }

  switch (castNode.type.name) {
    case "ArrayType": {
      const elementType = resolveCastType(
        query,
        schemaScalars,
        castNode.firstChild?.nextSibling ?? null
      );
      if (elementType.schemaType === "Array") {
        throw new Error("Array type cannot contain array type");
      }
      return {
        schemaType: "Array",
        name: `array<${elementType.name}>`,
        elementType,
      };
    }
    case "RangeType": {
      const elementType = resolveCastType(
        query,
        schemaScalars,
        castNode.firstChild?.nextSibling ?? null
      );
      if (
        elementType.schemaType !== "Scalar" ||
        !validRangeScalars.has((elementType.knownBaseType ?? elementType).name)
      ) {
        throw new Error("Invalid type in range type");
      }
      return {
        schemaType: "Range",
        name: `range<${elementType.name}>`,
        elementType,
      };
    }
    case "TupleType": {
      let elementNode = castNode.firstChild?.nextSibling ?? null;
      if (!elementNode) {
        throw new Error("Invalid parameter cast");
      }
      let named = false;
      const elements: {
        name: string | null;
        type: PrimitiveType;
      }[] = [];
      while (elementNode) {
        let name: string | null = null;
        if (elementNode.type.is("TupleFieldName")) {
          name = getNodeText(query, elementNode);
          elementNode = elementNode.nextSibling;
          named = true;
        }
        if (elementNode === null) {
          throw new Error("Invalid parameter cast");
        }
        elements.push({
          name,
          type: resolveCastType(query, schemaScalars, elementNode),
        });
        elementNode = elementNode.nextSibling;
      }
      if (named && elements.some(({name}) => name === null)) {
        throw new Error(
          "Mixing named and unnamed tuple elements is not supported"
        );
      }
      return {
        schemaType: "Tuple",
        name: `tuple<${elements
          .map(
            ({name, type}) => (name !== null ? `${name}: ` : "") + type.name
          )
          .join(", ")}>`,
        named,
        elements,
      };
    }
  }
  throw new Error("Invalid parameter cast");
}

export function extractQueryParameters(
  query: string,
  schemaScalars: Map<string, SchemaScalarType>
) {
  try {
    const syntaxTree = parser.parse(query);

    const extractedParams: ResolvedParameter[] = getAllChildren(
      syntaxTree.topNode,
      "QueryParameterName"
    ).map((paramNode) => {
      const name = getNodeText(query, paramNode).slice(1);

      const paramCast = paramNode.prevSibling;
      if (
        !paramNode.parent?.type.is("QueryParameter") ||
        !paramCast?.type.is("Cast")
      ) {
        return {name, error: "Missing a type cast before the parameter"};
      }

      let castType: SyntaxNode | null = paramCast.firstChild;

      if (!castType) {
        return {name, error: "Invalid parameter cast"};
      }

      let optional = false;

      if (castType.type.is("Keyword")) {
        const keyword = getNodeText(query, castType).toLowerCase();
        if (
          (keyword !== "optional" && keyword !== "required") ||
          castType.nextSibling === null
        ) {
          return {name, error: "Invalid parameter cast"};
        }

        optional = keyword === "optional";

        castType = castType.nextSibling;
      }

      try {
        return {
          name,
          type: resolveCastType(query, schemaScalars, castType),
          optional,
          error: null,
        };
      } catch (err) {
        return {name, error: (err as Error).message};
      }
    });

    const resolvedParams = new Map<string, ResolvedParameter>();

    for (const param of extractedParams) {
      if (param.error !== null) {
        resolvedParams.set(param.name, param);
        continue;
      }

      const resolvedParam = resolvedParams.get(param.name);
      if (
        resolvedParam &&
        resolvedParam.error == null &&
        (resolvedParam.type.name !== param.name ||
          resolvedParam.optional !== param.optional)
      ) {
        resolvedParams.set(param.name, {
          name: param.name,
          error: "Parameter has multiple usages with incompatible casts",
        });
      } else if (!resolvedParam) {
        resolvedParams.set(param.name, param);
      }
    }

    return resolvedParams;
  } catch {
    return;
  }
}
