import {ForwardedRef, InputHTMLAttributes, forwardRef} from "react";

import cn from "@edgedb/common/utils/classNames";

import styles from "./textInput.module.scss";
import {InfoIcon} from "../icons";

export interface TextInputProps {
  className?: string;
  type?: "text" | "password" | "textarea";
  label?: string | JSX.Element;
  optional?: boolean;
  error?: string | null;
  prefix?: string;
  headerNote?: string;
}

export const TextInput = forwardRef(function TextInput(
  {
    className,
    type,
    label,
    optional,
    error,
    prefix,
    headerNote,
    ...props
  }: TextInputProps &
    Omit<InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement>, "type">,
  ref: ForwardedRef<HTMLInputElement & HTMLTextAreaElement>
) {
  const Input = type === "textarea" ? "textarea" : "input";

  return (
    <label className={cn(styles.textField, className)}>
      {label ? (
        <div className={styles.fieldHeader}>
          {label}
          {optional ? (
            <span className={styles.optional}>(optional)</span>
          ) : null}
          {headerNote ? (
            <span className={styles.headerNote}>{headerNote}</span>
          ) : null}
        </div>
      ) : null}
      <div
        className={cn(styles.inputWrapper, {[styles.hasError]: error != null})}
      >
        {prefix ? <span className={styles.prefix}>{prefix}</span> : null}
        <Input
          ref={ref as any}
          type={type ?? "text"}
          {...props}
          style={{
            paddingLeft: prefix
              ? `calc(${prefix.length}ch + 12px)`
              : undefined,
          }}
        />
        {error != null ? (
          <div className={styles.error}>
            <InfoIcon />
            <div>{error}</div>
          </div>
        ) : null}
      </div>
    </label>
  );
});
