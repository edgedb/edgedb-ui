import React from "react";

import {highlightTree} from "@codemirror/highlight";

import {edgeqlLanguage} from "@edgedb/lang-edgeql";
import {highlightStyle} from "@edgedb/code-editor/theme";

interface CodeBlockProps {
  code: string;
}

export default function CodeBlock({
  code,
  ...otherProps
}: React.HTMLAttributes<HTMLPreElement> & CodeBlockProps) {
  const tree = edgeqlLanguage.parser.parse(code);

  const html: (string | JSX.Element)[] = [];

  let cursor = 0;
  highlightTree(tree, highlightStyle.match, (from, to, classes) => {
    if (cursor !== from) {
      html.push(code.slice(cursor, from));
    }
    html.push(
      <span key={html.length} className={classes}>
        {code.slice(from, to)}
      </span>
    );
    cursor = to;
  });
  html.push(code.slice(cursor));

  return <pre {...otherProps}>{html}</pre>;
}
