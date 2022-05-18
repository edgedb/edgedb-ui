import React, {Fragment} from "react";
import {StyleModule} from "style-mod";

import {Tree} from "@lezer/common";
import {highlightTree} from "@lezer/highlight";

import {edgeqlLanguage} from "@edgedb/lang-edgeql";
import {highlightStyle} from "@edgedb/code-editor/theme";

if (highlightStyle.module) {
  StyleModule.mount(document, highlightStyle.module);
}

type CustomRange = {range: [number, number]} & (
  | {style: string}
  | {
      renderer: (range: [number, number], content: JSX.Element) => JSX.Element;
    }
);

interface CodeBlockProps {
  code: string;
  customRanges?: CustomRange[] | ((tree: Tree) => CustomRange[]);
}

export default function CodeBlock({
  code,
  customRanges,
  ...otherProps
}: React.HTMLAttributes<HTMLPreElement> & CodeBlockProps) {
  const tree = edgeqlLanguage.parser.parse(code);

  const html: (string | JSX.Element)[] = [];

  const ranges = Array.isArray(customRanges)
    ? customRanges
    : customRanges?.(tree);

  let nextRangeIndex = 0;
  let currentRange = ranges?.[nextRangeIndex++];

  let customRangeBuffer: (string | JSX.Element)[] | null = null;

  let cursor = 0;
  function addSpan(text: string, className?: string): void {
    if (
      !customRangeBuffer &&
      currentRange &&
      currentRange.range[0] >= cursor &&
      currentRange.range[0] <= cursor + text.length
    ) {
      if (currentRange.range[0] !== cursor) {
        const textSlice = text.slice(0, currentRange.range[0] - cursor);
        html.push(
          className ? (
            <span key={html.length} className={className}>
              {textSlice}
            </span>
          ) : (
            textSlice
          )
        );
        text = text.slice(currentRange.range[0] - cursor);
      }
      cursor = currentRange.range[0];
      customRangeBuffer = [];
    }
    if (customRangeBuffer) {
      if (currentRange!.range[1] <= cursor + text.length) {
        const textSlice = text.slice(0, currentRange!.range[1] - cursor);
        customRangeBuffer.push(
          className ? (
            <span key={customRangeBuffer.length} className={className}>
              {textSlice}
            </span>
          ) : (
            textSlice
          )
        );
        html.push(
          "style" in currentRange ? (
            <span key={html.length} className={currentRange.style}>
              {customRangeBuffer}
            </span>
          ) : (
            <Fragment key={html.length}>
              {currentRange.renderer(
                currentRange.range,
                <>{customRangeBuffer}</>
              )}
            </Fragment>
          )
        );
        customRangeBuffer = null;
        cursor = currentRange!.range[1];
        currentRange = ranges?.[nextRangeIndex++];
        return addSpan(text.slice(textSlice.length), className);
      } else {
        customRangeBuffer.push(
          className ? (
            <span key={customRangeBuffer.length} className={className}>
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

  highlightTree(tree, highlightStyle, (from, to, classes) => {
    if (cursor !== from) {
      addSpan(code.slice(cursor, from));
    }
    addSpan(code.slice(from, to), classes);
  });
  addSpan(code.slice(cursor));

  if (customRangeBuffer) {
    html.push(
      "style" in currentRange ? (
        <span key={html.length} className={currentRange.style}>
          {customRangeBuffer}
        </span>
      ) : (
        <Fragment key={html.length}>
          {currentRange.renderer(currentRange.range, <>{customRangeBuffer}</>)}
        </Fragment>
      )
    );
  }

  return <pre {...otherProps}>{html}</pre>;
}
