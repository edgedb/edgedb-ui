import {
  StreamLanguage,
  LanguageSupport,
  syntaxTree,
} from "@codemirror/language";
import {Text} from "@codemirror/state";
import {graphql} from "codemirror-graphql/cm6-legacy/mode";
import {
  getAutocompleteSuggestions,
  offsetToPosition,
  getDiagnostics,
} from "graphql-language-service";
import {GraphQLSchema} from "graphql";
import {CompletionContext, CompletionResult} from "@codemirror/autocomplete";
import {linter} from "@codemirror/lint";

const gqlLanguage = StreamLanguage.define({
  ...graphql,
  languageData: {
    ...graphql.languageData,
    closeBrackets: {brackets: ["[", "{", "(", '"', "'"]},
    indentOnInput: /^\s*[\}]$/,
    commentTokens: {
      line: "#",
    },
  },
});

function sliceDoc(doc: Text, range: {from: number; to: number}): string {
  return doc.sliceString(range.from, range.to);
}

const SEVERITY = ["error", "warning", "info"] as const;

const NO_SCHEMA = {};
const cache = new WeakMap<GraphQLSchema | {}, LanguageSupport>();

export function GraphQLLanguage(graphQLSchema?: GraphQLSchema | null) {
  if (cache.has(graphQLSchema ?? NO_SCHEMA)) {
    return cache.get(graphQLSchema ?? NO_SCHEMA)!;
  }

  const langSupport = new LanguageSupport(
    gqlLanguage,
    graphQLSchema
      ? [
          gqlLanguage.data.of({
            autocomplete(context: CompletionContext): CompletionResult | null {
              // Adapted from https://github.com/graphql/graphiql/blob/c2e2f53d3b2ae369feb68537f92c73bcfd962f29/packages/codemirror-graphql/src/hint.ts

              const query = context.state.doc.toString();

              const token = syntaxTree(context.state).resolveInner(
                context.pos,
                -1
              );

              const tokenStart =
                token.type !== null &&
                /"|\w/.test(sliceDoc(context.state.doc, token)[0])
                  ? token.from
                  : context.pos;

              const position = offsetToPosition(query, tokenStart);

              const rawResults = getAutocompleteSuggestions(
                graphQLSchema,
                query,
                position
              );

              if (context.pos === tokenStart && !context.explicit) {
                return null;
              }

              return {
                from: tokenStart,
                to: context.pos === tokenStart ? undefined : token.to,
                options: rawResults.map((s) => ({
                  label: s.label,
                })),
                // filter: false,
              };
            },
          }),
          linter(function graphqlLint(view) {
            // Adapted from https://github.com/graphql/graphiql/blob/c2e2f53d3b2ae369feb68537f92c73bcfd962f29/packages/codemirror-graphql/src/lint.ts

            const query = view.state.doc.toString();

            if (!query) {
              return [];
            }

            const diagnostics = getDiagnostics(query, graphQLSchema);

            return diagnostics.map((error) => ({
              message: error.message,
              severity:
                SEVERITY[error.severity ? error.severity - 1 : 0] ??
                SEVERITY[2],
              from:
                view.state.doc.line(error.range.start.line + 1).from +
                error.range.start.character,
              to: Math.min(
                view.state.doc.line(error.range.end.line + 1).from +
                  error.range.end.character,
                query.length
              ),
            }));
          }),
        ]
      : undefined
  );

  cache.set(graphQLSchema ?? NO_SCHEMA, langSupport);
  return langSupport;
}
