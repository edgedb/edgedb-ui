import type {_ICodec as ICodec} from "edgedb";
import type {ObjectCodec} from "edgedb/dist/codecs/object";
import type {NamedTupleCodec} from "edgedb/dist/codecs/namedtuple";
import {float32ArrayToString, scalarItemToString} from "./buildScalar";

export function renderResultAsJson(
  result: any,
  codec: ICodec,
  implicitLimit: number | null
): string {
  return `[\n${(implicitLimit != null
    ? (result as any[]).slice(0, implicitLimit)
    : (result as any[])
  )
    .map((item) => "  " + _renderToJson(item, codec, "  ", implicitLimit))
    .join(",\n")}\n]`;
}

export function _renderToJson(
  val: any,
  codec: ICodec,
  depth: string,
  implicitLimit: number | null
): string {
  if (val == null) {
    return "null";
  }

  const codecKind = codec.getKind();

  switch (codecKind) {
    case "scalar": {
      const typename = codec.getKnownTypeName();
      switch (typename) {
        case "std::int16":
        case "std::int32":
        case "std::int64":
        case "std::float32":
        case "std::float64":
        case "std::bigint":
        case "std::decimal":
        case "std::bool":
          return val.toString();
        case "std::bytes":
          return `"${val.toString("base64")}"`;
        default:
          if (val instanceof Float32Array) {
            return float32ArrayToString(val);
          }
          return JSON.stringify(scalarItemToString(val, typename));
      }
    }
    case "range": {
      if (val.isEmpty) {
        return `{"empty": true}`;
      }
      const subcodec = codec.getSubcodecs()[0];
      return `{"lower": ${_renderToJson(
        val.lower,
        subcodec,
        depth,
        implicitLimit
      )}, "upper": ${_renderToJson(
        val.upper,
        subcodec,
        depth,
        implicitLimit
      )}, "inc_lower": ${val.incLower ? "true" : "false"}, "inc_upper": ${
        val.incUpper ? "true" : "false"
      }}`;
    }
    case "set":
    case "array":
    case "tuple": {
      const subcodecs = codec.getSubcodecs();
      return `[\n${(implicitLimit != null && codecKind === "set"
        ? (val as any[]).slice(0, implicitLimit)
        : (val as any[])
      )
        .map(
          (item, i) =>
            depth +
            "  " +
            _renderToJson(
              item,
              subcodecs[codecKind === "tuple" ? i : 0],
              depth + "  ",
              implicitLimit
            )
        )
        .join(",\n")}\n${depth}]`;
    }
    case "object":
    case "namedtuple": {
      const subcodecs = codec.getSubcodecs();
      const explicitNum =
        codecKind === "object"
          ? (codec as ObjectCodec).getFields().filter((f) => !f.implicit)
              .length
          : 0;
      const fields =
        codecKind === "object"
          ? (codec as ObjectCodec)
              .getFields()
              .map((f) =>
                f.implicit && !(explicitNum === 0 && f.name === "id")
                  ? null
                  : f.name
              )
          : (codec as NamedTupleCodec).getNames();
      return `{\n${fields
        .flatMap((fieldName, i) =>
          fieldName
            ? [
                depth +
                  `  "${fieldName}": ` +
                  _renderToJson(
                    val[fieldName],
                    subcodecs[i],
                    depth + "  ",
                    implicitLimit
                  ),
              ]
            : []
        )
        .join(",\n")}\n${depth}}`;
    }
    case "sparse_object":
      throw new Error("unexpected sparse_object");
  }
}
