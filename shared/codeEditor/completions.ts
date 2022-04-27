import {
  Completion,
  CompletionContext,
  CompletionResult,
  pickedCompletion,
} from "@codemirror/autocomplete";
import {syntaxTree} from "@codemirror/language";
import {Text} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {SchemaObject} from "@edgedb/schema-graph";
import {SyntaxNode} from "@lezer/common";

function sliceDoc(doc: Text, range: {from: number; to: number}): string {
  return doc.sliceString(range.from, range.to);
}

function isKeyword(
  doc: Text,
  node: SyntaxNode | null,
  keyword: string
): boolean {
  return (
    node?.name === "Keyword" && sliceDoc(doc, node).toLowerCase() === keyword
  );
}

function stripModuleName(typename: string): string {
  const [module, name] = typename.split("::");
  return module === "default" ? name : typename;
}

export function getCompletions(schemaObjects: SchemaObject[]) {
  return function completions(
    context: CompletionContext
  ): CompletionResult | null {
    const doc = context.state.doc;
    const pos = context.pos;

    let node = syntaxTree(context.state).resolveInner(pos, -1);

    if (node?.name === "Script") {
      node = node.childBefore(pos);
    }

    if (node?.name === "Statement") {
      node = node.childBefore(pos);
    }

    if (
      (isKeyword(doc, node, "select") && node.to < pos) ||
      (node?.name === "Name" && isKeyword(doc, node.prevSibling, "select"))
    ) {
      return {
        from: node?.name === "Keyword" ? context.pos : node.from,
        options: schemaObjects.map((obj) => ({
          label: stripModuleName(obj.name),
        })),
        validFor: (text, from, to, state) => {
          return syntaxTree(state).resolveInner(to, -1)?.name === "Name";
        },
      };
    }

    if (node?.name === "Braces") {
      const childBefore = node.childBefore(pos);
      if (
        childBefore?.name === "{" ||
        (childBefore?.name === "Punctuation" &&
          sliceDoc(doc, childBefore) === ",")
      ) {
        let path: string[] = [];
        let prevNode = node.prevSibling;
        while (true) {
          if (
            prevNode?.name === "Name" &&
            isKeyword(doc, prevNode.prevSibling, "select")
          ) {
            let typeName = sliceDoc(doc, prevNode);
            if (!typeName.includes("::")) {
              typeName = "default::" + typeName;
            }
            let typeObj = schemaObjects.find((obj) => obj.name === typeName);

            for (const pathPart of path) {
              if (!typeObj) break;

              const link = typeObj.links.find(
                (pointer) => pointer.name === pathPart
              );
              const targetName =
                link?.targetNames.length === 1 ? link.targetNames[0] : null;
              typeObj =
                targetName &&
                schemaObjects.find((obj) => obj.name === targetName);
            }

            if (typeObj) {
              return {
                from: pos,
                options: [
                  {
                    label: "*",
                    apply: [
                      ...typeObj.properties.map((prop) => prop.name),
                      ...typeObj.links.map((link) => `${link.name}: {}`),
                    ].join(`,\n${" ".repeat(pos - doc.lineAt(pos).from)}`),
                  },
                  ...typeObj.properties.map((prop) => ({
                    label: prop.name,
                    apply: prop.name + ",",
                  })),
                  ...typeObj.links.map((link) => ({
                    label: link.name,
                    apply: (
                      view: EditorView,
                      completion: Completion,
                      from: number
                    ) => {
                      view.dispatch({
                        changes: {from, insert: `${completion.label}: {},`},
                        selection: {
                          anchor: from + completion.label.length + 3,
                        },
                        userEvent: "input.complete",
                        annotations: pickedCompletion.of(completion),
                      });
                    },
                  })),
                ],
              };
            }
            break;
          } else {
            const parentNode = prevNode?.parent;
            if (
              parentNode?.name === "Braces" &&
              sliceDoc(doc, prevNode) === ":" &&
              parentNode.childBefore(prevNode.from)?.name === "Name"
            ) {
              path.unshift(
                sliceDoc(doc, parentNode.childBefore(prevNode.from))
              );
              prevNode = parentNode.prevSibling;
            } else {
              break;
            }
          }
        }
      }
    }

    return null;
  };
}
