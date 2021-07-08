import {_CodecsRegistry} from "edgedb";
import {QueryArgs} from "edgedb/dist/src/ifaces";
import {NamedTupleCodec} from "edgedb/dist/src/codecs/namedtuple";
import {TupleCodec} from "edgedb/dist/src/codecs/tuple";
import {decode as _decode, EdgeDBSet} from "@edgedb/common/decodeRawBuffer";

export type {EdgeDBSet};

const codecsRegistry = new _CodecsRegistry();

codecsRegistry.setStringCodecs({
  decimal: true,
  int64: true,
  datetime: true,
  local_datetime: true,
});

export function decode(
  outCodecBuf: Uint8Array,
  resultBuf: Uint8Array
): EdgeDBSet | null {
  return _decode(
    codecsRegistry,
    typedArrayToBuffer(outCodecBuf),
    typedArrayToBuffer(resultBuf)
  );
}

export type QueryParams = QueryArgs;

export function encodeArgs(inCodecBuf: Uint8Array, queryParams: QueryParams) {
  const inCodec = codecsRegistry.buildCodec(typedArrayToBuffer(inCodecBuf));

  if (!(inCodec instanceof NamedTupleCodec || inCodec instanceof TupleCodec)) {
    throw new Error("Invalid input codec");
  }

  return inCodec.encodeArgs(queryParams);
}

function typedArrayToBuffer(arr: Uint8Array): Buffer {
  let buf = Buffer.from(arr.buffer);
  if (arr.byteLength !== arr.buffer.byteLength) {
    buf = buf.slice(arr.byteOffset, arr.byteOffset + arr.byteLength);
  }
  return buf;
}
