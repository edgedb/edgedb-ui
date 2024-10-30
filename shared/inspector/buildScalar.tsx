import {PropsWithChildren, useState, Fragment} from "react";
import {_ICodec, Range, MultiRange, Float16Array, SparseVector} from "edgedb";

import cn from "@edgedb/common/utils/classNames";

import {EnumCodec} from "edgedb/dist/codecs/enum";
import {RangeCodec, MultiRangeCodec} from "edgedb/dist/codecs/range";

import {Item, ItemType} from "./buildItem";

import styles from "./inspector.module.scss";
import {EllipsisIcon} from ".";

export function buildScalarItem(
  base: {
    id: string;
    parent: Item | null;
    level: number;
    codec: _ICodec;
    label?: JSX.Element;
  },
  data: any,
  index: string | number,
  comma?: boolean,
  noMultiline: boolean = false
): Item {
  const {body, height} = renderValue(
    data,
    base.codec.getKnownTypeName(),
    base.codec instanceof EnumCodec,
    base.codec instanceof RangeCodec || base.codec instanceof MultiRangeCodec
      ? base.codec.getSubcodecs()[0].getKnownTypeName()
      : undefined,
    undefined,
    undefined,
    undefined,
    noMultiline
  );

  return {
    ...base,
    type: ItemType.Scalar,
    index,
    height,
    body,
    comma: comma ?? false,
  };
}

type TagProps = {
  name: string;
};

function ScalarTag({name, children}: PropsWithChildren<TagProps>) {
  return (
    <span className={styles.scalar_tag}>
      <span className={styles.scalar_tag_open}>{"<"}</span>
      <span className={styles.scalar_tag_name}>{name}</span>
      <span className={styles.scalar_tag_close}>{">"}</span>
      {children}
    </span>
  );
}

export function renderValue(
  value: any,
  knownTypeName: string,
  isEnum: boolean,
  rangeKnownTypeName?: string,
  showTypeTag: boolean = true,
  overrideStyles: {[key: string]: string} = {},
  implicitLength?: number,
  singleLineLimit?: boolean | number
): {body: JSX.Element; height?: number} {
  if (value == null) {
    return {body: <span className={styles.scalar_empty}>{"{}"}</span>};
  }

  const Tag = showTypeTag
    ? ScalarTag
    : ({children}: PropsWithChildren<{}>) => <>{children}</>;

  switch (knownTypeName) {
    case "std::bigint":
    case "std::decimal":
      return {
        body: (
          <span className={styles.scalar_number}>
            {value.toString()}
            <span className={styles.scalar_mod}>n</span>
          </span>
        ),
      };
    case "std::int16":
    case "std::int32":
    case "std::int64":
    case "std::float64":
      return {
        body: <span className={styles.scalar_number}>{value.toString()}</span>,
      };
    case "std::float32":
      // https://en.wikipedia.org/wiki/Single-precision_floating-point_format
      // 23 bits of significand + 1 implicit bit = 24 bits of precision
      // log10(2**24) = 7.225... so round up to 8 decimal digits of precision
      return {
        body: (
          <span className={styles.scalar_number}>
            {(value as number)
              .toPrecision(8)
              .replace(/(\.\d*?)0+$/, (_, $1) => ($1 === "." ? "" : $1))}
          </span>
        ),
      };
    case "std::bool":
      return {
        body: (
          <span className={styles.scalar_boolean}>
            {JSON.stringify(value)}
          </span>
        ),
      };
    case "std::uuid":
      return {
        body: (
          <Tag name="uuid">
            <span className={cn(styles.scalar_string, overrideStyles.uuid)}>
              {value.toString()}
            </span>
          </Tag>
        ),
      };
    case "std::datetime":
      return {
        body: (
          <Tag name={knownTypeName}>
            <span className={styles.scalar_string}>
              {formatDatetime(value)}
            </span>
          </Tag>
        ),
      };
    case "cal::local_datetime":
    case "cal::local_time":
    case "cal::local_date":
    case "std::duration":
    case "cal::relative_duration":
    case "cal::date_duration":
      return {
        body: (
          <Tag name={knownTypeName}>
            <span className={styles.scalar_string}>{value.toString()}</span>
          </Tag>
        ),
      };

    // @ts-ignore - Intentional fallthrough
    case "std::json":
      value = singleLineLimit ? value : prettyPrintJSON(value);
    case "std::str": {
      const str = singleLineLimit
        ? toSingleLineStr(
            value,
            singleLineLimit === true ? undefined : singleLineLimit
          )
        : strToString(value);
      return {
        body: (
          <span className={styles.scalar_string}>
            {str}
            {implicitLength && value.length === implicitLength ? "…" : ""}
          </span>
        ),
        height: singleLineLimit ? 1 : (str as string).split("\n").length,
      };
    }
  }

  if (value instanceof Range) {
    return {
      body: (
        <span>
          range({renderValue(value.lower, rangeKnownTypeName!, false).body}
          {value.isEmpty ? (
            <>
              , empty := <span className={styles.scalar_boolean}>true</span>
            </>
          ) : (
            <>
              , {renderValue(value.upper, rangeKnownTypeName!, false).body},
              inc_lower :={" "}
              <span className={styles.scalar_boolean}>
                {JSON.stringify(value.incLower)}
              </span>
              , inc_upper :={" "}
              <span className={styles.scalar_boolean}>
                {JSON.stringify(value.incUpper)}
              </span>
            </>
          )}
          )
        </span>
      ),
    };
  }
  if (value instanceof MultiRange) {
    const ranges = [...value];

    return {
      body: (
        <span>
          multirange(
          {ranges.map((range, i) => (
            <Fragment key={i}>
              {
                renderValue(
                  range,
                  `multirange<${rangeKnownTypeName!}>`,
                  false,
                  rangeKnownTypeName!
                ).body
              }
              {i < ranges.length - 1 ? ", " : null}
            </Fragment>
          ))}
          )
        </span>
      ),
    };
  }

  if (value instanceof Uint8Array) {
    return {
      body: (
        <span className={styles.scalar_bytes}>
          <span className={styles.scalar_mod}>b</span>
          {bufferToString(value)}
        </span>
      ),
    };
  }

  if (value instanceof Float32Array) {
    return {
      body: (
        <span>
          <Tag name={knownTypeName}>
            <VectorRenderer vec={value} format={float32ArrayToString} />
          </Tag>
        </span>
      ),
    };
  }
  if (value instanceof Float16Array) {
    return {
      body: (
        <span>
          <Tag name={knownTypeName}>
            <VectorRenderer vec={value} format={float16ArrayToString} />
          </Tag>
        </span>
      ),
    };
  }
  if (value instanceof SparseVector) {
    return {
      body: (
        <span>
          <Tag name={knownTypeName}>
            <VectorRenderer vec={value} format={sparseVectorToString} />
          </Tag>
        </span>
      ),
    };
  }

  if (isEnum) {
    return {
      body: (
        <span>
          {showTypeTag ? (
            <span className={styles.typeName}>{knownTypeName}.</span>
          ) : null}
          <b>{value.toString()}</b>
        </span>
      ),
    };
  }

  return {
    body: (
      <Tag name={knownTypeName}>
        <b>{value.toString()}</b>
      </Tag>
    ),
  };
}

export function scalarItemToString(item: any, typename: string): string {
  if (item instanceof Float32Array) {
    return float32ArrayToString(item);
  }
  if (item instanceof Float16Array) {
    return float16ArrayToString(item);
  }
  switch (typename) {
    case "std::bytes":
      return bufferToString(item);
    case "std::json":
      return prettyPrintJSON(item);
    case "std::datetime":
      return formatDatetime(item);
    default:
      return item.toString();
  }
}

export function float32ArrayToString(vec: Float32Array | number[]): string {
  return `[${[...vec]
    .map((float) =>
      float
        .toPrecision(7)
        .replace(/(\.\d*?)0+$/, (_, $1) => ($1 === "." ? "" : $1))
    )
    .join(", ")}]`;
}

export function float16ArrayToString(vec: Float16Array | number[]): string {
  return `[${[...vec]
    .map((float) =>
      float
        .toPrecision(4)
        .replace(/(\.\d*?)0+$/, (_, $1) => ($1 === "." ? "" : $1))
    )
    .join(", ")}]`;
}

export function sparseVectorToString(vec: SparseVector | number[]): string {
  return float32ArrayToString([...vec]);
}

function VectorRenderer<
  VecType extends Float32Array | Float16Array | SparseVector
>({vec, format}: {vec: VecType; format: (vec: VecType | number[]) => string}) {
  const [expanded, setExpanded] = useState(false);
  if (vec.length > 20 && !expanded) {
    return (
      <>
        {format(sliceVec(vec, 20)).slice(0, -1)},
        <span
          className={cn(styles.ellipsis, styles.inline)}
          onClick={() => setExpanded(true)}
        >
          <EllipsisIcon />
        </span>
        {"]"}
      </>
    );
  } else {
    return <>{format(vec)}</>;
  }
}

function sliceVec(vec: Iterable<number>, length: number): number[] {
  const arr: number[] = [];
  let i = 0;
  for (const val of vec) {
    if (i++ >= length) break;
    arr.push(val);
  }
  return arr;
}

function formatDatetime(date: Date): string {
  return date.toString() + "+00:00";
}

function bufferToString(buf: Uint8Array): string {
  const res: string[] = [];
  for (let i = 0; i < buf.length; i++) {
    const char = buf[i];
    if (char < 32 || char > 126) {
      switch (char) {
        case 9:
          res.push("\\t");
          break;
        case 10:
          res.push("\\n");
          break;
        case 13:
          res.push("\\r");
          break;
        default:
          res.push(`\\x${char.toString(16).padStart(2, "0").toLowerCase()}`);
      }
    } else if (char === 34) {
      res.push('\\"');
    } else {
      res.push(String.fromCharCode(char));
    }
  }
  return `"${res.join("")}"`;
}

function strToString(value: string): string {
  const escape = (str: string) => {
    const split = str.split(/(\n|\\\\|\\')/g);
    if (split.length === 1) {
      return str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    }

    const ret: string[] = [];
    for (let i = 0; i < split.length; i++) {
      if (i % 2) {
        ret.push(split[i]);
      } else {
        ret.push(split[i].replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
      }
    }

    return ret.join("");
  };

  return escape(value);
}

function toSingleLineStr(value: string, limit = 200): JSX.Element {
  const lines = value.slice(0, limit).split("\n");
  const output: (JSX.Element | string)[] = [lines.shift()!];
  let i = 0;
  for (const line of lines) {
    output.push(<span key={i++}>↲</span>, line);
  }
  return (
    <>
      {output}
      {value.length > limit ? <span>…</span> : null}
    </>
  );
}

export function prettyPrintJSON(
  json: string,
  indentSpaces: number = 2
): string {
  const switchRegex = /["{}[\],]/g;
  let pretty = "";
  let i = 0;
  let lasti = 0;
  let indent = 0;
  while (i < json.length) {
    switchRegex.lastIndex = i;
    if (!switchRegex.exec(json)) {
      break;
    }
    i = switchRegex.lastIndex - 1;
    switch (json[i]) {
      case "{":
      case "[":
        pretty +=
          "".padStart(indent * indentSpaces, " ") +
          json.slice(lasti, i + 1).trim();
        lasti = i + 1;

        if (json[i + 1] === (json[i] === "{" ? "}" : "]")) {
          pretty += json[i + 1];
          lasti++;
          i++;
        } else {
          pretty += "\n";
          indent++;
        }
        break;
      case "}":
      case "]":
        pretty +=
          "".padStart(indent * indentSpaces, " ") +
          json.slice(lasti, i).trim() +
          "\n";
        indent--;
        pretty += json[i].padStart(indent * indentSpaces + 1, " ");
        lasti = i + 1;
        break;
      case ",":
        const line = json.slice(lasti, i).trim();
        if (line) {
          pretty += "".padStart(indent * indentSpaces, " ") + line;
        }
        pretty += ",\n";
        lasti = i + 1;
        break;
      case '"':
        const strRegex = /\\*"/g;
        strRegex.lastIndex = i + 1;
        while (true) {
          const match = strRegex.exec(json);
          if (!match) {
            throw new Error("Cannot pretty print json");
          }
          if (match[0].length % 2 === 1) {
            i = strRegex.lastIndex - 1;
            break;
          }
        }
    }
    i++;
  }
  pretty += json.slice(lasti);
  return pretty;
}
