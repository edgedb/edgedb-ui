import React from "react";

import {highlightTree} from "@codemirror/highlight";

import {edgeqlLanguage} from "@edgedb/lang-edgeql";
import {highlightStyle} from "@edgedb/code-editor/theme";

interface CodeBlockProps {
  code: string;
  highlightRanges?: {range: [number, number]; style: string}[];
}

export default function CodeBlock({
  code,
  highlightRanges,
  ...otherProps
}: React.HTMLAttributes<HTMLPreElement> & CodeBlockProps) {
  const tree = edgeqlLanguage.parser.parse(code);

  const html: (string | JSX.Element)[] = [];

  let nextHighlightIndex = 0;
  let highlight = highlightRanges?.[nextHighlightIndex++];

  let highlightBuffer: (string | JSX.Element)[] | null = null;

  let cursor = 0;
  function addSpan(text: string, className?: string): void {
    if (
      !highlightBuffer &&
      highlight &&
      highlight.range[0] >= cursor &&
      highlight.range[0] <= cursor + text.length
    ) {
      if (highlight.range[0] !== cursor) {
        const textSlice = text.slice(0, highlight.range[0] - cursor);
        html.push(
          className ? (
            <span key={html.length} className={className}>
              {textSlice}
            </span>
          ) : (
            textSlice
          )
        );
        text = text.slice(highlight.range[0] - cursor);
      }
      cursor = highlight.range[0];
      highlightBuffer = [];
    }
    if (highlightBuffer) {
      if (highlight!.range[1] <= cursor + text.length) {
        const textSlice = text.slice(0, highlight!.range[1] - cursor);
        highlightBuffer.push(
          className ? (
            <span key={highlightBuffer.length} className={className}>
              {textSlice}
            </span>
          ) : (
            textSlice
          )
        );
        html.push(
          <span key={html.length} className={highlight!.style}>
            {highlightBuffer}
          </span>
        );
        highlightBuffer = null;
        cursor = highlight!.range[1];
        highlight = highlightRanges?.[nextHighlightIndex++];
        return addSpan(text.slice(textSlice.length), className);
      } else {
        highlightBuffer.push(
          className ? (
            <span key={highlightBuffer.length} className={className}>
              {text}
            </span>
          ) : (
            text
          )
        );
        cursor += text.length;
        return;
      }
    }
    html.push(
      className ? (
        <span key={html.length} className={className}>
          {text}
        </span>
      ) : (
        text
      )
    );
    cursor += text.length;
  }

  highlightTree(tree, highlightStyle.match, (from, to, classes) => {
    if (cursor !== from) {
      addSpan(code.slice(cursor, from));
    }
    addSpan(code.slice(from, to), classes);
  });
  addSpan(code.slice(cursor));

  if (highlightBuffer) {
    html.push(
      <span key={html.length} className={highlight!.style}>
        {highlightBuffer}
      </span>
    );
  }

  return <pre {...otherProps}>{html}</pre>;
}
