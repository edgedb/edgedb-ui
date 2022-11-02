import type {_ICodec as ICodec} from "edgedb";
import type {ObjectCodec} from "edgedb/dist/codecs/object";
import type {NamedTupleCodec} from "edgedb/dist/codecs/namedtuple";
import {scalarItemToString} from "./buildScalar";

export function renderResultAsJson(
  result: any,
  codec: ICodec,
  ignorePrefixes: boolean
): string {
  return `[\n${(result as any[])
    .map((item) => "  " + _renderToJson(item, codec, "  ", ignorePrefixes))
    .join(",\n")}\n]`;
}

export function _renderToJson(
  val: any,
  codec: ICodec,
  depth: string,
  ignorePrefixes: boolean
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
        ignorePrefixes
      )}, "upper": ${_renderToJson(
        val.upper,
        subcodec,
        depth,
        ignorePrefixes
      )}, "inc_lower": ${val.incLower ? "true" : "false"}, "inc_upper": ${
        val.incUpper ? "true" : "false"
      }}`;
    }
    case "set":
    case "array":
    case "tuple": {
      const subcodecs = codec.getSubcodecs();
      return `[\n${(val as any[])
        .map(
          (item, i) =>
            depth +
            "  " +
            _renderToJson(
              item,
              subcodecs[codecKind === "tuple" ? i : 0],
              depth + "  ",
              ignorePrefixes
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
      let fields =
        codecKind === "object"
          ? (codec as ObjectCodec)
              .getFields()
              .map((f) =>
                f.implicit && !(explicitNum === 0 && f.name === "id")
                  ? null
                  : f.name
              )
          : (codec as NamedTupleCodec).getNames();
      if (ignorePrefixes) {
        fields = fields.filter((name) => !name?.startsWith("__count_"));
      }
      return `{\n${fields
        .flatMap((fieldName, i) =>
          fieldName
            ? [
                depth +
                  `  "${
                    ignorePrefixes && fieldName.startsWith("__")
                      ? fieldName.slice(2)
                      : fieldName
                  }": ` +
                  _renderToJson(
                    val[fieldName],
                    subcodecs[i],
                    depth + "  ",
                    ignorePrefixes
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
