import {EdgeDBError} from "edgedb";
import {utf8Decoder} from "edgedb/dist/primitives/buffer";

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
  details?: string;
  range?: [number, number];
}

function tryParseInt(val: any) {
  if (val instanceof Uint8Array) {
    try {
      return parseInt(utf8Decoder.decode(val), 10);
    } catch {}
  }
  return null;
}

export function extractErrorDetails(err: any, query?: string): ErrorDetails {
  if (!(err instanceof Error)) {
    throw new Error(`Fatal Error: cannot handle non error as error: ${err}`);
  }
  const errDetails: ErrorDetails = {
    name: err.name,
    msg: (err as any)._message ?? err.message,
  };

  if (err instanceof EdgeDBError && (err as any)._attrs) {
    const attrs = (err as any)._attrs as Map<number, Uint8Array>;
    const hint = attrs.get(ErrorField.hint);
    if (hint) {
      errDetails.hint = utf8Decoder.decode(hint);
    }
    const details = attrs.get(ErrorField.details);
    if (details) {
      errDetails.details = utf8Decoder.decode(details);
    }

    if (!query) {
      return errDetails;
    }

    const lineStart = tryParseInt(attrs.get(ErrorField.lineStart));
    const lineEnd = tryParseInt(attrs.get(ErrorField.lineEnd));
    const colStart = tryParseInt(attrs.get(ErrorField.utf16ColumnStart));
    const colEnd = tryParseInt(attrs.get(ErrorField.utf16ColumnEnd));

    if (
      lineStart != null &&
      lineEnd != null &&
      colStart != null &&
      colEnd != null
    ) {
      const lines = query.split("\n");

      const startLine = lineStart - 1;
      const startLinesLength = lines
        .slice(0, startLine)
        .reduce((sum, line) => sum + line.length + 1, 0);
      const startPos = startLinesLength + colStart;

      const endLinesLength =
        startLinesLength +
        lines
          .slice(startLine, lineEnd - 1)
          .reduce((sum, line) => sum + line.length + 1, 0);
      const endPos = endLinesLength + colEnd;

      errDetails.range = [startPos, endPos];
    }
  }

  return errDetails;
}
