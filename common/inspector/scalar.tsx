import React from "react";
import {EdgeDBDateTime} from "edgedb/dist/src/datatypes/datetime";

import {FunctionComponent} from "react";

import * as edgedb from "edgedb";
import {Buffer} from "buffer";

import styles from "./inspector.module.scss";

interface ScalarProps {
  value: any[];
  level: number;
  comma: boolean;
  label?: JSX.Element;
  codec: edgedb._ICodec;
}

const Scalar = ({value, comma, label, codec}: ScalarProps) => {
  return (
    <div className={styles.scalar}>
      <span className={styles.label}>{label}</span>
      {renderValue(value, codec)}
      {comma ? ", " : null}
    </div>
  );
};

export default Scalar;

type TagProps = {
  name: string;
};

const Tag: FunctionComponent<TagProps> = ({name, children}) => {
  return (
    <span className={styles.scalar_tag}>
      <span className={styles.scalar_tag_open}>{"<"}</span>
      <span className={styles.scalar_tag_name}>{name}</span>
      <span className={styles.scalar_tag_close}>{">"}</span>
      {children}
    </span>
  );
};

function renderValue(value: any, codec: edgedb._ICodec): JSX.Element {
  if (value == null) {
    return <span className={styles.scalar_empty}>{"{}"}</span>;
  }

  const mt = codec.getKnownTypeName();
  switch (mt) {
    case "std::bigint":
    case "std::decimal":
      return (
        <span className={styles.scalar_number}>
          {value.toString()}
          <span className={styles.scalar_mod}>n</span>
        </span>
      );
    case "std::int16":
    case "std::int32":
    case "std::int64":
    case "std::float64":
      return <span className={styles.scalar_number}>{value.toString()}</span>;
    case "std::float32":
      // https://en.wikipedia.org/wiki/Single-precision_floating-point_format
      // 23 bits of significand + 1 implicit bit = 24 bits of precision
      // log10(2**24) = 7.225... so 7 decimal digits of precision
      return (
        <span className={styles.scalar_number}>
          {(value as number).toPrecision(7).replace(/\.?0+$/, "")}
        </span>
      );
    case "std::bool":
      return (
        <span className={styles.scalar_boolean}>{JSON.stringify(value)}</span>
      );
    case "std::uuid":
      return (
        <Tag name="uuid">
          <span className={styles.scalar_string}>{JSON.stringify(value)}</span>
        </Tag>
      );
    case "std::datetime":
    case "cal::local_datetime":
      value = edgeDBDateTimeToString(value);
    case "cal::local_time":
    case "cal::local_date":
    case "std::duration":
      return (
        <Tag name={mt}>
          <span className={styles.scalar_string}>"{value.toString()}"</span>
        </Tag>
      );

    case "std::json":
      value = prettyPrintJSON(value);
    case "std::str":
      return (
        <span className={styles.scalar_string}>{strToString(value)}</span>
      );
  }

  if (value instanceof Buffer) {
    return (
      <span className={styles.scalar_bytes}>
        <span className={styles.scalar_mod}>b</span>
        {bufferToString(value)}
      </span>
    );
  }

  if (value instanceof edgedb.UUID) {
    return <span className={styles.scalar_uuid}>{JSON.stringify(value)}</span>;
  }

  return <b>{JSON.stringify(value)}</b>;
}

function bufferToString(buf: Buffer): string {
  const res = [];
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

    const ret = [];
    for (let i = 0; i < split.length; i++) {
      if (i % 2) {
        ret.push(split[i]);
      } else {
        ret.push(split[i].replace(/\\/g, "\\\\").replace(/'/g, "\\'"));
      }
    }

    return ret.join("");
  };

  return `'${escape(value)}'`;
}

function prettyPrintJSON(json: string, indentSpaces: number = 2): string {
  let pretty = "";
  let i = 0;
  let lasti = 0;
  let indent = 0;
  while (i < json.length) {
    switch (json[i]) {
      case "{":
      case "[":
        pretty +=
          "".padStart(indent * indentSpaces, " ") +
          json.slice(lasti, i + 1).trim() +
          "\n";
        indent++;
        lasti = i + 1;
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
        while (true) {
          i = json.indexOf('"', i + 1);
          if (json[i - 1] !== "\\") break;
        }
    }
    i++;
  }
  pretty += json.slice(lasti);
  return pretty;
}

function edgeDBDateTimeToString(datetime: EdgeDBDateTime): string {
  const year = `${datetime.year < 0 ? "-" : ""}${Math.abs(datetime.year)
    .toString()
    .padStart(4, "0")}`;
  return `${year}-${datetime.month
    .toString()
    .padStart(2, "0")}-${datetime.day
    .toString()
    .padStart(2, "0")}T${datetime.hour
    .toString()
    .padStart(2, "0")}:${datetime.minute
    .toString()
    .padStart(2, "0")}:${datetime.second.toString().padStart(2, "0")}${
    datetime.microsecond
      ? "." +
        datetime.microsecond.toString().padStart(6, "0").replace(/0+$/, "")
      : ""
  }`;
}
