import React from "react";

export interface MarkedRange {
  str: string;
  marks?: string[];
}
export type MarkedString = MarkedRange[];

export function markString(
  str: MarkedString,
  mark: string,
  ranges: readonly [number, number][]
): MarkedString {
  const marked: MarkedString = [];

  const rangeEdges = ranges
    .flatMap((range) => [range[0], range[1] + 1])
    .reverse();

  if (!rangeEdges.length) return str;

  let currentEdge = rangeEdges.pop();
  let marking: string[] = [];

  let strRangeIndex = 0;
  let strIndex = 0;
  let currentMarkedRange = str[strRangeIndex];
  while (currentMarkedRange) {
    if (
      currentEdge !== undefined &&
      currentEdge - strIndex <= currentMarkedRange.str.length
    ) {
      marked.push({
        str: currentMarkedRange.str.slice(0, currentEdge - strIndex),
        marks: [...(currentMarkedRange.marks || []), ...marking],
      });

      currentMarkedRange = {
        str: currentMarkedRange.str.slice(currentEdge - strIndex),
        marks: currentMarkedRange.marks,
      };

      strIndex = currentEdge;

      currentEdge = rangeEdges.pop();
      marking = marking.length ? [] : [mark];
    } else {
      if (currentMarkedRange.str.length)
        marked.push({
          str: currentMarkedRange.str,
          marks: [...(currentMarkedRange.marks || []), ...marking],
        });
      strIndex += currentMarkedRange.str.length;
      strRangeIndex++;
      currentMarkedRange = str[strRangeIndex];
    }
  }

  return marked;
}

export function joinMarkedStrings(
  strs: MarkedString[],
  sep: MarkedString
): MarkedString {
  return strs
    .flatMap((str) => [str, sep])
    .slice(0, -1)
    .flat();
}

export function markedStringToJSX(
  str: MarkedString,
  classNames: {[className: string]: string}
): JSX.Element {
  return (
    <>
      {str.map((range, i) => (
        <span
          key={i}
          className={range.marks
            ?.map((mark) => classNames[mark])
            .filter((className) => className)
            .join(" ")}
        >
          {range.str}
        </span>
      ))}
    </>
  );
}

export function markModuleName(str: string, marks?: string[]): MarkedString {
  const moduleRegex = /\w+::/g;
  const ranges: [number, number][] = [];
  let result = moduleRegex.exec(str);
  while (result !== null) {
    ranges.push([result.index, result.index + result[0].length - 1]);
    result = moduleRegex.exec(str);
  }
  return markString([{str: str, marks}], "module", ranges);
}

export function getFullTypeExpr(
  typename: string,
  typemod: string
): MarkedString {
  return [
    ...(typemod !== "SINGLETON"
      ? [{str: typemod + " ", marks: ["typemod"]}]
      : []),
    ...markModuleName(typename, ["typename"]),
  ];
}
