import {EditorSelection} from "@codemirror/state";
import {parser} from "@edgedb/lang-edgeql";

export function isEndOfStatement(
  query: string,
  selection: EditorSelection
): boolean {
  if (selection.ranges.length !== 1 || !selection.ranges[0].empty) {
    return false;
  }
  const cursorPos = selection.ranges[0].head;
  const trimmedQuery = query.slice(0, cursorPos).trim();
  if (
    // check cursor is at the end of the query and character before is semicolon
    trimmedQuery[trimmedQuery.length - 1] === ";" &&
    query.slice(cursorPos).trim() === ""
  ) {
    const syntaxTree = parser.parse(query.toString());
    const node = syntaxTree.resolve(cursorPos, -1);

    // check cursor is not in an unfinished string or {} block
    if (node.name === "Script") {
      return true;
    }
  }
  return false;
}
