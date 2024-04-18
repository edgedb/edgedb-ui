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
}

export const TextInput = forwardRef(function TextInput(
  {
    className,
    type,
    label,
    optional,
    error,
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
        </div>
      ) : null}
      <div
        className={cn(styles.inputWrapper, {[styles.hasError]: error != null})}
      >
        <Input ref={ref as any} type={type ?? "text"} {...props} />
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
