import {EdgeDBError} from "edgedb";

enum ErrorField {
  hint = 0x0001,
  details = 0x0002,
  positionStart = 0xfff1 - 2 ** 16,
  positionEnd = 0xfff2 - 2 ** 16,
  lineStart = 0xfff3 - 2 ** 16,
  columnStart = 0xfff4 - 2 ** 16,
  utf16ColumnStart = 0xfff5 - 2 ** 16,
  lineEnd = 0xfff6 - 2 ** 16,
  columnEnd = 0xfff7 - 2 ** 16,
  utf16ColumnEnd = 0xfff8 - 2 ** 16,
  characterStart = 0xfff9 - 2 ** 16,
  characterEnd = 0xfffa - 2 ** 16,
}

export interface ErrorDetails {
  name: string;
  msg: string;
  hint?: string;
  range?: [number, number];
}

function toNum(x: Uint8Array): number {
  return parseInt(x.toString(), 10);
}

export function extractErrorDetails(err: any, query: string): ErrorDetails {
  if (!(err instanceof Error)) {
    throw new Error(`Fatal Error: cannot handle non error as error: ${err}`);
  }
  const errDetails: ErrorDetails = {
    name: err.name,
    msg: err.message,
  };

  if (err instanceof EdgeDBError && (err as any).attrs) {
    const attrs = (err as any).attrs as Map<number, Uint8Array>;
    const hint = attrs.get(ErrorField.hint);
    if (hint) {
      errDetails.hint = hint.toString();
    }

    const lineStart = attrs.get(ErrorField.lineStart),
      lineEnd = attrs.get(ErrorField.lineEnd),
      colStart = attrs.get(ErrorField.utf16ColumnStart),
      colEnd = attrs.get(ErrorField.utf16ColumnEnd);
    if (lineStart && lineEnd && colStart && colEnd) {
      const lines = query.split("\n");

      const startLine = toNum(lineStart) - 1;
      const startLinesLength = lines
        .slice(0, startLine)
        .reduce((sum, line) => sum + line.length + 1, 0);
      const startPos = startLinesLength + toNum(colStart);

      const endLinesLength =
        startLinesLength +
        lines
          .slice(startLine, toNum(lineEnd) - 1)
          .reduce((sum, line) => sum + line.length + 1, 0);
      const endPos = endLinesLength + toNum(colEnd);

      errDetails.range = [startPos, endPos];
    }
  }

  return errDetails;
}
