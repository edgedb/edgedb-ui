import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";

export function completions(
  context: CompletionContext
): CompletionResult | null {
  const nodeBefore = syntaxTree(context.state).resolveInner(context.pos, -1);

  if (nodeBefore.name === "Statement") {
    const childBefore = nodeBefore.childBefore(context.pos);
    if (
      childBefore?.name === "Keyword" &&
      context.state.doc
        .sliceString(childBefore.from, childBefore.to)
        .toLowerCase() === "select"
    ) {
      return {
        from: context.pos,
        options: [{ label: "Movie" }, { label: "User" }],
      };
    }
  }

  return null;
}
