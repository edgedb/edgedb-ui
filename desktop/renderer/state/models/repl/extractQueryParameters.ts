import {lexEdgeQL, TokenKind} from "@edgedb/lexer";

import {SchemaScalar} from "@edgedb/schema-graph";

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
] as const;

type KnownScalarType = typeof KnownScalarTypes[number];

export async function extractQueryParameters(
  query: string,
  schemaScalars: SchemaScalar[]
) {
  try {
    const tokens = await lexEdgeQL(query);

    const extractedParams = tokens.reduce<ExtractedParameter[]>(
      (params, token, i) => {
        if (token.kind === TokenKind.Argument) {
          const param: ExtractedParameter = {
            name: token.value.slice(1),
            type: null,
            array: false,
            optional: false,
          };
          params.push(param);

          if (tokens[i - 1]?.kind !== TokenKind.Greater) {
            param.error = "Missing a type cast before the parameter";
            return params;
          }

          let tokenIndex = i - 1;
          let openBrackets = 1;
          while (tokenIndex > 0 && openBrackets > 0) {
            tokenIndex -= 1;
            const nextToken = tokens[tokenIndex];
            if (nextToken.kind === TokenKind.Greater) {
              openBrackets += 1;
            } else if (nextToken.kind === TokenKind.Less) {
              openBrackets -= 1;
            }
          }

          const cast = tokens.slice(tokenIndex + 1, i - 1);

          if (cast[0]?.kind === TokenKind.Keyword) {
            const keyword = cast[0].value.toLowerCase();
            if (keyword === "optional") {
              param.optional = true;
              cast.shift();
            } else if (keyword !== "required") {
              param.error = "Invalid parameter cast";
              return params;
            }
          }

          if (
            cast[0]?.kind === TokenKind.Ident &&
            cast[0].value.toLowerCase() === "array"
          ) {
            if (
              cast[1]?.kind === TokenKind.Less &&
              cast[cast.length - 1].kind === TokenKind.Greater
            ) {
              param.array = true;
              param.type = cast
                .slice(2, -1)
                .map((tok) => tok.value)
                .join("");
            } else {
              param.error = "Invalid parameter cast";
              return params;
            }
          } else {
            param.type = cast.map((tok) => tok.value).join("");
          }
        }

        return params;
      },
      []
    );

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
