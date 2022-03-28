import {
  Set as _EdgeDBSet,
  _CodecsRegistry,
  _ReadBuffer,
  _ICodec,
} from "edgedb";
import type {ProtocolVersion} from "edgedb/dist/ifaces";

export type EdgeDBSet = _EdgeDBSet & {_codec: _ICodec};

export function decode(
  registry: InstanceType<typeof _CodecsRegistry>,
  outCodecBuf: Buffer,
  resultBuf: Buffer,
  protocolVersion: ProtocolVersion = [0, 10]
): EdgeDBSet | null {
  let result: EdgeDBSet | null = null;

  if (outCodecBuf.length) {
    const codec = registry.buildCodec(outCodecBuf, protocolVersion);

    result = new _EdgeDBSet() as EdgeDBSet;

    const buf = new _ReadBuffer(resultBuf);
    const codecReadBuf = _ReadBuffer.alloc();
    while (buf.length > 0) {
      const msgType = buf.readUInt8();
      const len = buf.readUInt32();

      if (msgType !== 68 || len <= 4) {
        throw new Error("invalid data packet");
      }

      buf.sliceInto(codecReadBuf, len - 4);
      codecReadBuf.discard(6);
      const val = codec.decode(codecReadBuf);
      result.push(val);
    }

    result._codec = codec;
  }

  return result;
}
