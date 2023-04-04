import React, {Fragment} from "react";
import {StyleModule} from "style-mod";

import {Tree} from "@lezer/common";
import {Language} from "@codemirror/language";
import {highlightTree} from "@lezer/highlight";

import {edgeqlLanguage} from "@edgedb/lang-edgeql";
import {highlightStyle} from "@edgedb/code-editor/theme";

if (highlightStyle.module) {
  StyleModule.mount(document, highlightStyle.module);
}

type CustomRange = {range: [number, number]} & (
  | {style: string; attrs?: {[key: string]: string}}
  | {
      renderer: (range: [number, number], content: JSX.Element) => JSX.Element;
    }
);

interface CodeBlockProps {
  code: string;
  language?: Language;
  customRanges?: CustomRange[] | ((tree: Tree) => CustomRange[]);
  inline?: boolean;
}

interface CustomRangeExplain {
  range: [number, number];
  style: string;
  attrs: {[key: string]: string};
}

type FlattenedRanges = {
  range: [number, number];
  attrs?:  {'data-ctx-id': string[]};
}[];

function flattenRanges(ranges: CustomRangeExplain[]) {
  const edges = ranges
    .flatMap((range) => [
      {
        type: "start",
        index: range.range[0],
        range: range,
      },
      {
        type: "end",
        index: range.range[1],
        range: range,
      },
    ])
    .sort((a, b) => a.index - b.index);

  let prev: CustomRangeExplain[] = [];
  const flattened: FlattenedRanges = [];

  for (let i = 1; i < edges.length; i++) {
    if (edges[i].type === "end" && edges[i - 1].type === "start") {
      flattened.push({
        range: [edges[i - 1].index, edges[i].index],
        attrs: {...edges[i].range.attrs, "data-ctx-id": [edges[i].range.attrs["data-ctx-id"]]}
      });
      if (prev.length && flattened.length) {
        for (const elem of prev) {
          flattened[flattened.length - 1].attrs = {
            ...flattened[flattened.length - 1].attrs,
            "data-ctx-id": [...(flattened[flattened.length - 1].attrs!['data-ctx-id']),elem.attrs["data-ctx-id"]]
          }
        }
        prev.pop();
      }
    }
    if (edges[i].type === "start" && edges[i - 1].type === "start") {
      flattened.push({
        range: [edges[i - 1].index, edges[i].index],
        attrs: {...edges[i-1].range.attrs, "data-ctx-id": [edges[i-1].range.attrs["data-ctx-id"]]}
      });
      prev.push(edges[i - 1].range);
    }

    if (edges[i].type === "end" && edges[i - 1].type === "end") {
      flattened.push({
        range: [edges[i - 1].index, edges[i].index],
        attrs: {...edges[i].range.attrs, "data-ctx-id": [edges[i].range.attrs["data-ctx-id"]]}
      });
      prev.pop();
    }
  }
  return flattened;
}



export default function CodeBlock({
  code,
  language,
  customRanges,
  inline,
  ...otherProps
}: React.HTMLAttributes<HTMLPreElement> & CodeBlockProps) {
  const tree = (language ?? edgeqlLanguage).parser.parse(code);

  const html: (string | JSX.Element)[] = [];

  const ranges = Array.isArray(customRanges)
    ? customRanges[0].renderer || !customRanges[0].attrs ? customRanges: flattenRanges(customRanges)
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
          "style" in currentRange || "attrs" in currentRange ? (
            <span
              key={html.length}
              className={currentRange.style}
              {...currentRange.attrs}
            >
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
      "style" in currentRange || "attrs" in currentRange ? (
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

  return inline ? (
    <span {...otherProps}>{html}</span>
  ) : (
    <pre {...otherProps}>{html}</pre>
  );
}
