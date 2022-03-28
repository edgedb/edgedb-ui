import {SyntaxNode} from "@lezer/common";

export function getNodeText(query: string, node: SyntaxNode): string {
  return query.slice(node.from, node.to);
}

export function getAllChildren(
  node: SyntaxNode,
  type: string | number
): SyntaxNode[] {
  let cur = node.cursor;
  if (!cur.firstChild()) {
    return [];
  }
  const children: SyntaxNode[] = [];
  let depth = 0;
  while (true) {
    if (cur.type.is(type)) {
      children.push(cur.node);
    }
    if (cur.firstChild()) {
      depth++;
      continue;
    }
    if (cur.nextSibling()) {
      continue;
    } else {
      while (true) {
        if (depth === 0) {
          return children;
        }
        cur.parent();
        depth--;
        if (cur.nextSibling()) {
          break;
        }
      }
    }
  }
}
