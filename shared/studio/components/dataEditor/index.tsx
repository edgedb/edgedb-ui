import {forwardRef, memo, RefObject, useEffect, useRef, useState} from "react";

import cn from "@edgedb/common/utils/classNames";

import {Select} from "@edgedb/common/ui/select";

import {SchemaScalarType} from "@edgedb/common/schemaData";

import styles from "./dataEditor.module.scss";
import {EmptySetIcon, SubmitChangesIcon} from "../../icons";
import {
  EditorArrayType,
  EditorRangeType,
  EditorRangeValue,
  EditorTupleType,
  EditorValue,
  isEditorValueValid,
  newPrimitiveValue,
  parseEditorValue,
  PrimitiveType,
  valueToEditorValue,
} from "./utils";
import {parsers} from "./parsers";
import {DeleteIcon} from "./icons";

export {newPrimitiveValue, parseEditorValue} from "./utils";
export type {PrimitiveType, EditorValue} from "./utils";
export {parsers} from "./parsers";

export interface DataEditorProps<T = any> {
  type: PrimitiveType;
  isRequired: boolean;
  isMulti: boolean;
  value: T;
  onChange: (val: T) => void;
  onClose: () => void;
  style?: any;
}

export function DataEditor({
  type,
  isRequired,
  isMulti,
  value,
  onChange,
  onClose,
  style,
}: DataEditorProps) {
  const inputRef = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [val, setVal] = useState(() =>
    value != null
      ? isMulti
        ? value.map((val: any) => valueToEditorValue(val, type))
        : valueToEditorValue(value, type)
      : isRequired
      ? isMulti
        ? []
        : newPrimitiveValue(type)[0]
      : null
  );
  const [hasError, setError] = useState(() => {
    return val === null
      ? true
      : isMulti
      ? val.every((v: any) => isEditorValueValid(v, type))
      : isEditorValueValid(val, type);
  });

  const getParsedVal = () =>
    val !== null
      ? isMulti
        ? val.map((v: any) => parseEditorValue(v, type))
        : parseEditorValue(val, type)
      : null;

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

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !hasError) {
        onChange(getParsedVal());
        onClose();
        return;
      }
    };
    editorRef.current?.addEventListener("keydown", listener, {capture: true});

    return () => {
      editorRef.current?.removeEventListener("keydown", listener, {
        capture: true,
      });
    };
  }, [val, hasError]);

  const Input = isMulti
    ? !isRequired
      ? nullableInputs.get(ArrayEditor)!
      : ArrayEditor
    : getInputComponent(type, !isRequired);

  return (
    <div
      ref={editorRef}
      className={cn(styles.dataEditor, {
        [styles.showBackground]:
          val === null && !isMulti && type.schemaType !== "Scalar",
      })}
      style={style}
    >
      <Input
        ref={inputRef}
        type={type as any}
        isMulti={isMulti}
        depth={0}
        value={val}
        onChange={(val: any, err: boolean) => {
          setVal(val);
          setError(err);
        }}
      />

      <div className={styles.actions}>
        {!isRequired ? (
          <div
            className={cn(styles.action, styles.emptySetAction)}
            onClick={() => {
              setVal(null);
              setError(false);
              onChange(null);
              onClose();
            }}
          >
            <EmptySetIcon />
          </div>
        ) : null}
        <div
          className={cn(styles.action, styles.submitChangesAction, {
            [styles.actionDisabled]: hasError,
          })}
          onClick={() => {
            onChange(getParsedVal());
            onClose();
          }}
        >
          <SubmitChangesIcon />
        </div>
      </div>
    </div>
  );
}

export type InputValidator = (value: any) => string | null;

export interface InputComponentProps<AllowNull extends boolean> {
  ref?: RefObject<HTMLElement>;
  type: PrimitiveType;
  value: EditorValue | (AllowNull extends true ? null : never);
  onChange: (
    val: EditorValue | (AllowNull extends true ? null : never),
    error: boolean
  ) => void;
  errorMessageAbove?: boolean;
  validator?: InputValidator;
  depth?: number;
}

export function getInputComponent<AllowNull extends boolean = false>(
  type: PrimitiveType,
  allowNull?: AllowNull
): (props: InputComponentProps<AllowNull>) => JSX.Element {
  let Input: any;
  if (type.schemaType === "Scalar") {
    const typeName = (type.knownBaseType ?? type).name;
    if (typeName === "std::bool") {
      return BoolEditor as any;
    }

    if (type.enum_values) {
      Input = EnumEditor;
    } else if (typeName === "std::str" || typeName === "std::json") {
      Input = ExpandingTextbox;
    } else if (parsers[typeName]) {
      Input = Textbox;
    } else {
      Input = () => <></>;
    }
  } else if (type.schemaType === "Array") {
    Input = ArrayEditor;
  } else if (type.schemaType === "Tuple") {
    Input = TupleEditor;
  } else if (type.schemaType === "Range") {
    Input = RangeEditor;
  } else {
    Input = () => <></>;
  }
  if (allowNull) {
    return nullableInputs.get(Input)!;
  } else {
    return Input;
  }
}

export const ArrayEditor = forwardRef(function ArrayEditor(
  {
    type,
    value,
    onChange,
    depth,
    isMulti,
  }: {
    type: EditorArrayType;
    value: EditorValue[];
    onChange: (val: EditorValue[], error: boolean) => void;
    depth: number;
    isMulti?: boolean;
  },
  ref
) {
  const [errs, setErrs] = useState<boolean[]>(
    Array(value?.length ?? 0).fill(false)
  );

  const elementType = isMulti ? type : type.elementType;
  const Input = getInputComponent(elementType);

  return (
    <div
      className={cn(styles.arrayEditor, styles.panel, {
        [styles.isMulti]: !!isMulti,
        [styles.panelNested]: depth % 2 !== 0,
      })}
    >
      {value.map((val, i) => {
        return (
          <div key={i} className={styles.arrayItem}>
            <Input
              ref={i === 0 ? (ref as any) : undefined}
              type={elementType}
              depth={depth + 1}
              value={val}
              onChange={(val, err) => {
                const newVal = [...value];
                const newErrs = [...errs];
                newVal[i] = val;
                newErrs[i] = err;
                setErrs(newErrs);
                onChange(newVal, newErrs.includes(true));
              }}
            />
            <div
              className={styles.removeButton}
              onClick={() => {
                const newVal = [...value];
                const newErrs = [...errs];
                newVal.splice(i, 1);
                newErrs.splice(i, 1);
                setErrs(newErrs);
                onChange(newVal, newErrs.includes(true));
              }}
            >
              <DeleteIcon />
            </div>
          </div>
        );
      })}
      <div
        className={styles.addButton}
        onClick={() => {
          const [val, err] = newPrimitiveValue(elementType);
          setErrs([...errs, err]);
          onChange([...value, val], errs.includes(true));
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
    depth,
  }: {
    type: EditorTupleType;
    value: EditorValue[];
    onChange: (val: EditorValue[], error: boolean) => void;
    depth: number;
  },
  ref
) {
  const [errs, setErrs] = useState<boolean[]>(() =>
    Array(type.elements.length).fill(false)
  );

  return (
    <div
      className={cn(styles.tupleEditor, styles.panel, {
        [styles.panelNested]: depth % 2 !== 0,
      })}
    >
      {type.elements.map((element, i) => {
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
              value={value[i]}
              onChange={(val, err) => {
                const newVal = [...value];
                const newErrs = [...errs];
                newVal[i] = val;
                newErrs[i] = err;
                setErrs(newErrs);
                onChange(newVal, newErrs.includes(true));
              }}
            />
          </div>
        );
      })}
    </div>
  );
});

export const RangeEditor = forwardRef(function RangeEditor(
  {
    type,
    value,
    onChange,
    depth,
  }: {
    type: EditorRangeType;
    value: EditorRangeValue;
    onChange: (val: EditorRangeValue, error: boolean) => void;
    depth: number;
  },
  ref
) {
  const [errs, setErrs] = useState<boolean[]>([false, false]);
  const Input = getInputComponent(type.elementType, true);

  return (
    <div
      className={cn(styles.rangeEditor, styles.panel, {
        [styles.panelNested]: depth % 2 !== 0,
      })}
    >
      {[value?.lower, value?.upper].map((bound, i) => {
        return (
          <div key={i} className={styles.rangeBound}>
            <Input
              ref={i === 0 ? (ref as any) : undefined}
              type={type.elementType}
              depth={depth + 1}
              value={bound}
              onChange={(val, err) => {
                const newVal = {...value};
                const newErrs = [...errs];
                newVal[i === 0 ? "lower" : "upper"] = val as string;
                newErrs[i] = err;
                setErrs(newErrs);
                onChange(newVal, newErrs.includes(true));
              }}
            />
            <div
              className={cn(styles.nullButton, {
                [styles.disabled]: value[i === 0 ? "lower" : "upper"] === null,
              })}
              onClick={() => {
                const newVal = {...value};
                const newErrs = [...errs];
                newVal[i === 0 ? "lower" : "upper"] = null;
                newErrs[i] = false;
                setErrs(newErrs);
                onChange(newVal, newErrs.includes(true));
              }}
            >
              {"{ }"}
            </div>
          </div>
        );
      })}
      <div className={styles.incBounds}>
        <span>inc_lower</span> <span>:=</span>{" "}
        <label>
          <input
            type="checkbox"
            checked={value?.incLower ?? false}
            onChange={(e) => {
              onChange(
                {...value, incLower: e.target.checked},
                errs.includes(true)
              );
            }}
          />
          <span />
        </label>
        <br />
        <span>inc_upper</span> <span>:=</span>{" "}
        <label>
          <input
            type="checkbox"
            checked={value?.incUpper ?? false}
            onChange={(e) => {
              onChange(
                {...value, incUpper: e.target.checked},
                errs.includes(true)
              );
            }}
          />
          <span />
        </label>
      </div>
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
    value: string;
    onChange: (val: string, error: boolean) => void;
  },
  ref
) {
  return (
    <Select
      className={styles.enumSelect}
      title={!type.enum_values?.includes(value) ? "{ }" : value}
      items={type.enum_values!.map((enumOpt) => ({
        id: enumOpt,
        label: enumOpt,
      }))}
      selectedItemId={value}
      onChange={({id}) => onChange(id, false)}
    />
  );
});

function BoolEditor({
  value,
  onChange,
  depth,
}: {
  value: string;
  onChange: (val: string, error: boolean) => void;
  depth?: number;
}) {
  return (
    <div className={cn(styles.boolEditor, {[styles.topLevel]: depth === 0})}>
      {[true, false].map((bool, i) => (
        <div
          key={i}
          className={cn({
            [styles.boolSelected]: (value !== "" && value !== "false") == bool,
          })}
          onClick={() => onChange(bool ? "true" : "false", false)}
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
    _placeholder,
    errorMessageAbove,
    validator,
    depth,
  }: {
    type: SchemaScalarType;
    value: string;
    onChange: (val: string, error: boolean) => void;
    _placeholder?: string;
    errorMessageAbove?: boolean;
    validator?: InputValidator;
    depth?: number;
  },
  ref
) {
  const baseTypeName = (type.knownBaseType ?? type).name;
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // All types that use Textbox editor require non-empty string value
    // unless placeholder exists
    if (!_placeholder) {
      if (value.trim() === "") {
        setErr("Value is required");
        onChange(value, true);
      } else {
        try {
          const parsed = parsers[baseTypeName](value);
          if (validator) {
            const err = validator(parsed);
            if (err !== null) {
              setErr(err);
              onChange(value, true);
            }
          }
        } catch (e) {
          setErr((e as Error).message);
          onChange(value, true);
        }
      }
    } else {
      setErr(null);
    }
  }, [_placeholder]);

  return (
    <div
      className={cn(styles.textbox, {
        [styles.errorMessageAbove]: !!errorMessageAbove,
        [styles.active]: depth === 0,
        [styles.error]: !!err,
      })}
      data-input-type={baseTypeName.replace(/^std::/, "")}
    >
      <input
        placeholder={_placeholder}
        ref={ref as RefObject<HTMLInputElement>}
        value={value}
        onChange={(e) => {
          const newVal = e.target.value;
          let err: string | null = null;
          if (newVal.trim() === "") {
            err = "Value is required";
          } else {
            try {
              const parsed = parsers[baseTypeName](e.target.value);
              if (validator) {
                err = validator(parsed);
              }
            } catch (e) {
              err = (e as Error).message;
            }
          }
          setErr(err);
          onChange(e.target.value, !!err);
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
    _placeholder,
    errorMessageAbove,
    depth,
  }: {
    type: SchemaScalarType;
    value: string;
    onChange: (val: string, error: boolean) => void;
    _placeholder?: string;
    errorMessageAbove?: boolean;
    depth?: number;
  },
  ref
) {
  const baseTypeName = (type.knownBaseType ?? type).name;
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!_placeholder && baseTypeName === "std::json") {
      try {
        JSON.parse(value);
      } catch {
        setErr("Invalid JSON value");
        onChange(value, true);
      }
    }
  }, [_placeholder]);

  return (
    <div
      className={cn(styles.textbox, {
        [styles.errorMessageAbove]: !!errorMessageAbove,
        [styles.error]: !!err,
        [styles.active]: depth === 0,
      })}
      data-input-type={baseTypeName.replace(/^std::/, "")}
    >
      <textarea
        ref={ref as RefObject<HTMLTextAreaElement>}
        placeholder={_placeholder}
        value={value}
        onChange={(e) => {
          let err = null;
          if (baseTypeName === "std::json") {
            try {
              JSON.parse(e.target.value);
            } catch {
              err = "Invalid JSON value";
            }
          }
          setErr(err);
          onChange(e.target.value, !!err);
        }}
        style={{height: 22 * (value?.split("\n").length ?? 1) + 10 + "px"}}
      />
      {err ? <div className={styles.errMessage}>{err}</div> : null}
    </div>
  );
});

const nullableInputs = new Map<any, any>([
  ...[EnumEditor, ExpandingTextbox, Textbox].map(
    (Input: any) =>
      [
        Input,
        forwardRef(
          ({value, onChange, ...props}: InputComponentProps<true>, ref) => (
            <Input
              ref={ref}
              {...props}
              value={value ?? ""}
              onChange={(val: EditorValue, error: boolean) => {
                if (val !== "" || value !== null) {
                  onChange(val, error);
                }
              }}
              _placeholder={value === null ? "{}" : ""}
            />
          )
        ),
      ] as [any, any]
  ),
  ...[ArrayEditor, TupleEditor, RangeEditor].map(
    (Input: any) =>
      [
        Input,
        forwardRef((props: InputComponentProps<true>, ref) =>
          props.value == null ? (
            <div
              className={styles.addButton}
              onClick={() => props.onChange(...newPrimitiveValue(props.type))}
            >
              +
            </div>
          ) : (
            <Input ref={ref} {...props} />
          )
        ),
      ] as [any, any]
  ),
]);
