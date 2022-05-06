import {forwardRef, RefObject, useEffect, useRef, useState} from "react";
import {
  LocalDateTime,
  LocalDate,
  LocalTime,
  Duration,
  ConfigMemory,
} from "edgedb";

import cn from "@edgedb/common/utils/classNames";

import {
  SchemaArrayType,
  SchemaScalarType,
  SchemaTupleType,
  SchemaType,
} from "../../utils/schema";

import styles from "./dataEditor.module.scss";

export interface DataEditorProps<T = any> {
  type: SchemaType;
  isRequired: boolean;
  isMulti: boolean;
  value: T;
  onChange: (val: T) => void;
  onClose: () => void;
  onClearEdit: () => void;
  style?: any;
}

export function DataEditor({
  type,
  isRequired,
  isMulti,
  value,
  onChange,
  onClose,
  onClearEdit,
  style,
}: DataEditorProps) {
  const inputRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [val, setVal] = useState(value);
  const [hasError, setError] = useState(false);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus({preventScroll: true});
    }
    const listener = (e: MouseEvent) => {
      if (!editorRef.current?.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("click", listener, {capture: true});

    return () => {
      window.removeEventListener("click", listener, {capture: true});
    };
  }, []);

  const Input = isMulti ? ArrayEditor : getInputComponent(type);

  return (
    <div ref={editorRef} className={cn(styles.dataEditor)} style={style}>
      <Input
        ref={inputRef}
        type={type as any}
        isSetType={isMulti}
        depth={0}
        value={val}
        onChange={(val, err) => {
          setVal(val);
          setError(err);
          if (!err) {
            onChange(val);
          }
        }}
        allowNull
      />

      <div className={styles.actions}>
        {!isRequired ? (
          <div
            className={styles.action}
            onClick={() => {
              setVal(null);
              setError(false);
              onChange(null);
            }}
          >
            {"{ }"}
          </div>
        ) : null}
        <div className={styles.action} onClick={onClearEdit}>
          X
        </div>
      </div>
      {/* {err ? <div className={styles.errMessage}>{err}</div> : null} */}
    </div>
  );
}

function getInputComponent(
  type: SchemaType
): (props: {
  ref?: RefObject<HTMLElement>;
  type: SchemaType;
  value: any;
  onChange: (val: any, error: boolean) => void;
  allowNull?: boolean;
  depth?: number;
}) => JSX.Element {
  if (type.schemaType === "Scalar") {
    if (type.enum_values) {
      return EnumEditor as any;
    }
    if (type.name === "std::bool") {
      return BoolEditor;
    }
    if (type.name === "std::str" || type.name === "std::json") {
      return ExpandingTextbox as any;
    }
    if (parsers[type.name]) {
      return Textbox as any;
    }
    return () => <></>;
  }
  if (type.schemaType === "Array") {
    return ArrayEditor as any;
  }
  if (type.schemaType === "Tuple") {
    return TupleEditor as any;
  }
  return () => <></>;
}

const ArrayEditor = forwardRef(function ArrayEditor(
  {
    type,
    value,
    onChange,
    allowNull,
    depth,
    isSetType,
  }: {
    type: SchemaArrayType;
    value: any[] | null;
    onChange: (val: any, error: boolean) => void;
    allowNull?: boolean;
    depth: number;
    isSetType?: boolean;
  },
  ref
) {
  const [errs, setErrs] = useState<boolean[]>(
    Array(value?.length ?? 0).fill(false)
  );
  const Input = getInputComponent(isSetType ? type : type.elementType);

  if (value === null && !allowNull) {
    onChange([], false);
  }

  return (
    <div
      className={cn(styles.arrayEditor, styles.panel, {
        [styles.isSet]: !!isSetType,
        [styles.panelNested]: depth % 2 !== 0,
      })}
    >
      {(value ?? []).map((val, i) => {
        return (
          <div key={i} className={styles.arrayItem}>
            <Input
              ref={i === 0 ? (ref as any) : undefined}
              type={isSetType ? type : type.elementType}
              depth={depth + 1}
              value={val}
              onChange={(val, err) => {
                const newVal = [...value!];
                newVal[i] = val;
                const newErrs = [...errs];
                newErrs[i] = err;
                setErrs(newErrs);
                onChange(newVal, newErrs.includes(true));
              }}
            />
            <span>,</span>
            <div
              className={styles.button}
              onClick={() => {
                const newVal = [...value!];
                newVal.splice(i, 1);
                const newErrs = [...errs];
                newErrs.splice(i, 1);
                setErrs(newErrs);
                onChange(newVal, newErrs.includes(true));
              }}
            >
              X
            </div>
          </div>
        );
      })}
      <div
        className={styles.button}
        onClick={() => {
          setErrs([...errs, true]);
          onChange([...(value ?? []), null], true);
        }}
      >
        +
      </div>
    </div>
  );
});

const TupleEditor = forwardRef(function TupleEditor(
  {
    type,
    value,
    onChange,
    allowNull,
    depth,
  }: {
    type: SchemaTupleType;
    value: any;
    onChange: (val: any, error: boolean) => void;
    allowNull?: boolean;
    depth: number;
  },
  ref
) {
  const [errs, setErrs] = useState<boolean[]>(() =>
    Array(type.elements.length).fill(false)
  );

  if (value === null && !allowNull) {
    onChange(type.elements[0].name ? {} : [], true);
  }

  return (
    <div
      className={cn(styles.tupleEditor, styles.panel, {
        [styles.panelNested]: depth % 2 !== 0,
        [styles.emptyTuple]: value === null,
      })}
    >
      {value === null ? (
        <div>
          <div className={styles.emptyValue}>{"{ }"}</div>
          {allowNull ? (
            <div
              className={styles.button}
              onClick={() => {
                setErrs(Array(type.elements.length).fill(true));
                onChange(type.elements[0].name ? {} : [], true);
              }}
            >
              +
            </div>
          ) : null}
        </div>
      ) : (
        type.elements.map((element, i) => {
          const Input = getInputComponent(element.type);
          return (
            <div key={i} className={styles.tupleElement}>
              {element.name ? (
                <div className={styles.tupleElementName}>
                  {element.name}
                  <span>:=</span>
                </div>
              ) : null}
              <Input
                ref={i === 0 ? (ref as any) : undefined}
                type={element.type}
                depth={depth + 1}
                value={value[element.name ?? i] ?? null}
                onChange={(val, err) => {
                  const newVal = element.name ? {...value} : [...value];
                  newVal[element.name ?? i] = val;
                  const newErrs = [...errs];
                  newErrs[i] = err;
                  setErrs(newErrs);
                  onChange(newVal, newErrs.includes(true));
                }}
              />
            </div>
          );
        })
      )}
    </div>
  );
});

const EnumEditor = forwardRef(function EnumEditor(
  {
    type,
    value,
    onChange,
  }: {
    type: SchemaScalarType;
    value: any;
    onChange: (val: any, error: boolean) => void;
  },
  ref
) {
  return (
    <select
      ref={ref as any}
      value={value}
      onChange={(e) => {
        onChange(e.target.value, false);
      }}
    >
      {type.enum_values!.map((enumOption, i) => (
        <option key={i} value={enumOption}>
          {enumOption}
        </option>
      ))}
    </select>
  );
});

function BoolEditor({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (val: any, error: boolean) => void;
}) {
  return (
    <div className={styles.boolEditor}>
      {[true, false].map((bool, i) => (
        <div
          key={i}
          className={cn({[styles.boolSelected]: value === bool})}
          onClick={() => onChange(bool, false)}
        >
          {bool ? "true" : "false"}
        </div>
      ))}
    </div>
  );
}

const Textbox = forwardRef(function Textbox(
  {
    type,
    value,
    onChange,
    allowNull,
    depth,
  }: {
    type: SchemaScalarType;
    value: any;
    onChange: (val: any, error: boolean) => void;
    allowNull?: boolean;
    depth?: number;
  },
  ref
) {
  const [val, setVal] = useState<string>(() => value?.toString() ?? "");
  const [err, setErr] = useState<string | null>(
    allowNull || value !== null ? null : "Value is required"
  );

  if (value === null && val !== "") {
    setVal("");
  }

  return (
    <div className={styles.textbox}>
      <input
        className={cn({[styles.active]: depth === 0, [styles.error]: !!err})}
        placeholder={value === null ? "{}" : ""}
        ref={ref as RefObject<HTMLInputElement>}
        value={val}
        onChange={(e) => {
          let parsed: any = e.target.value;
          let err: string | null = null;
          try {
            parsed = parsers[type.name](e.target.value);
          } catch (e) {
            err = (e as Error).message;
          }
          setVal(e.target.value);
          setErr(err);
          onChange(parsed, !!err);
        }}
      />
      {err ? <div className={styles.errMessage}>{err}</div> : null}
    </div>
  );
});

const ExpandingTextbox = forwardRef(function ExpandingTextbox(
  {
    type,
    value,
    onChange,
    allowNull,
    depth,
  }: {
    type: SchemaScalarType;
    value: string | null;
    onChange: (val: string, error: boolean) => void;
    allowNull?: boolean;
    depth?: number;
  },
  ref
) {
  const [err, setErr] = useState<string | null>(() =>
    allowNull || value !== null ? null : "Value is required"
  );

  return (
    <div className={styles.textbox}>
      <textarea
        className={cn({[styles.active]: depth === 0, [styles.error]: !!err})}
        ref={ref as RefObject<HTMLTextAreaElement>}
        placeholder={value === null ? "{}" : ""}
        value={value ?? ""}
        onChange={(e) => {
          let err = null;
          if (type.name === "std::json") {
            try {
              JSON.parse(e.target.value);
            } catch {
              err = "Invalid JSON value";
            }
          }
          setErr(err);
          onChange(e.target.value, !!err);
        }}
        style={{height: 20 * (value?.split("\n").length ?? 1) + 10 + "px"}}
      />
      {err ? <div className={styles.errMessage}>{err}</div> : null}
    </div>
  );
});

const parsers: {[typename: string]: (val: string) => any} = {
  "std::int16": (val: string) => {
    if (!/^-?[0-9]+$/.test(val)) {
      throw new Error("Invalid integer");
    }
    const int = parseInt(val, 10);
    if (int < -32768 || int > 32767) {
      throw new Error("Integer out of range");
    }
    return int;
  },
  "std::int32": (val: string) => {
    if (!/^-?[0-9]+$/.test(val)) {
      throw new Error("Invalid integer");
    }
    const int = parseInt(val, 10);
    if (int < -2147483648 || int > 2147483647) {
      throw new Error("Integer out of range");
    }
    return int;
  },
  "std::int64": (val: string) => {
    if (!/^-?[0-9]+$/.test(val)) {
      throw new Error("Invalid integer");
    }
    const int = BigInt(val);
    if (
      int < BigInt("-9223372036854775808") ||
      int > BigInt("9223372036854775807")
    ) {
      throw new Error("Integer out of range");
    }
    return int;
  },
  "std::float32": (val: string) => {
    const float = Number(val);
    if (Number.isNaN(float)) {
      throw new Error("Invalid float");
    }
    return float;
  },
  "std::float64": (val: string) => {
    const float = Number(val);
    if (Number.isNaN(float)) {
      throw new Error("Invalid float");
    }
    return float;
  },
  "std::bigint": (val: string) => {
    try {
      return BigInt(val);
    } catch {
      throw new Error("Invalid bigint");
    }
  },
  "std::decimal": (val: string) => {
    if (!/^-?[0-9]+.[0-9]+([eE][-+]?[0-9]+)?$/.test(val)) {
      throw new Error("Invalid decimal");
    }
    return val;
  },
  "std::uuid": (val: string) => {
    if (
      !/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(
        val
      )
    ) {
      throw new Error("Invalid uuid");
    }
    return val;
  },
  "std::bytes": (val: string) => {
    const bytes: number[] = [];
    const bytesRegex = /\\[tnr\\]|\\x[0-9a-fA-F]{2}|[\x20-\x5b\x5d-\x7e]/g;
    let lastIndex = 0;
    let match;
    while ((match = bytesRegex.exec(val)) !== null) {
      if (lastIndex !== match.index) {
        throw new Error("Invalid bytes");
      }
      if (match[0].startsWith("\\")) {
        switch (match[0][1]) {
          case "x":
            bytes.push(parseInt(match[0].slice(2), 16));
            break;
          case "t":
            bytes.push(9);
            break;
          case "n":
            bytes.push(10);
            break;
          case "r":
            bytes.push(13);
            break;
          case "\\":
            bytes.push(92);
            break;
        }
      } else {
        bytes.push(match[0].charCodeAt(0));
      }
      lastIndex = match.index + match[0].length;
    }
    return Buffer.from(bytes);
  },
  "std::datetime": (val: string) => {
    const date = new Date(val);
    if (
      Number.isNaN(date.getTime()) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::\d{2})?)$/.test(
        val
      )
    ) {
      throw new Error("Invalid datetime");
    }
    const year = date.getUTCFullYear();
    if (year < 1 || year > 9999) {
      throw new Error("Year must be between 1 and 9999");
    }
    return date;
  },
  "cal::local_datetime": (val: string) => {
    const [_match, _year, month, day, hour, minute, second, _fSeconds] =
      val.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?$/
      ) ?? [];
    if (!_match) {
      throw new Error("invalid local datetime");
    }
    const fSeconds = (_fSeconds ?? "").padEnd(9, "0");
    const year = Number(_year);

    if (year < 1 || year > 9999) {
      throw new Error("Year must be between 1 and 9999");
    }

    return new LocalDateTime(
      year,
      Number(month),
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(fSeconds.slice(0, 3)),
      Number(fSeconds.slice(3, 6)),
      Number(fSeconds.slice(6, 9))
    );
  },
  "cal::local_date": (val: string) => {
    const [_match, _year, month, day] =
      val.match(/^(\d{4})-(\d{2})-(\d{2})$/) ?? [];
    if (!_match) {
      throw new Error("invalid local date");
    }
    const year = Number(_year);

    if (year < 1 || year > 9999) {
      throw new Error("Year must be between 1 and 9999");
    }

    return new LocalDate(year, Number(month), Number(day));
  },
  "cal::local_time": (val: string) => {
    const [_match, hour, minute, second, _fSeconds] =
      val.match(/^(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?$/) ?? [];
    if (!_match) {
      throw new Error("invalid local time");
    }
    const fSeconds = (_fSeconds ?? "").padEnd(9, "0");

    return new LocalTime(
      Number(hour),
      Number(minute),
      Number(second),
      Number(fSeconds.slice(0, 3)),
      Number(fSeconds.slice(3, 6)),
      Number(fSeconds.slice(6, 9))
    );
  },
  "std::duration": (val: string) => {
    let duration: Duration;
    try {
      duration = Duration.from(val);
    } catch {
      throw new Error("Invalid duration");
    }
    for (const field of ["years", "months", "weeks", "days"]) {
      if (duration[field] !== 0) {
        throw new Error(`duration cannot contain ${field}`);
      }
    }
    return duration;
  },
  "cfg::memory": (val: string) => {
    const [_match, size, unit] = val.match(/^(\d+)(B|[KMGTP]iB)$/) ?? [];
    if (!_match) {
      throw new Error("invalid config memory");
    }
    let bytes = BigInt(size);
    for (
      let i = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"].indexOf(unit);
      i > 0;
      i--
    ) {
      bytes = bytes * BigInt(1024);
    }
    return new ConfigMemory(bytes);
  },
};