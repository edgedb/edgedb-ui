import {forwardRef, PropsWithChildren, useState} from "react";

import cn from '@edgedb/common/utils/classNames';

import {CloseIcon} from "../icons";

import styles from "./modal.module.scss";

interface ModalOverlayProps {
  onOverlayClick?: () => void;
}

export function ModalOverlay({
  onOverlayClick,
  children,
}: PropsWithChildren<ModalOverlayProps>) {
  return (
    <div
      className={styles.modalOverlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onOverlayClick?.();
        }
      }}
    >
      {children}
    </div>
  );
}

interface ModalProps {
  title: string;
  actions?: JSX.Element;
  error?: string;
  progress?: string;
  close?: () => void;
  contentClass?: string;
}

export function Modal({
  title,
  actions,
  error,
  progress,
  close,
  children,
  contentClass,
}: PropsWithChildren<ModalProps>) {
  const [showProgress, setShowProgress] = useState(false);

  return (
    <div className={styles.modalCard}>
      <div className={styles.modalHeader}>
        <div className={styles.modalTitle}>{title}</div>
        {close ? (
          <CloseIcon className={styles.modalClose} onClick={close} />
        ) : null}
      </div>
      <div className={cn(styles.modalContent, contentClass)}>{children}</div>
      {progress ? (
        <>
          <div
            className={styles.modalProgressToggle}
            onClick={() => setShowProgress(!showProgress)}
          >
            {showProgress ? "Hide" : "Show"} Output
          </div>
          {showProgress ? (
            <pre className={styles.modalProgress}>{progress}</pre>
          ) : null}
        </>
      ) : null}
      <div className={styles.modalActions}>{actions}</div>
      {/* {error ? (
        <ErrorMessage className={styles.modalError} error={error} />
      ) : null} */}
    </div>
  );
}

interface ModalTextFieldProps {
  type?: "text" | "password";
  label: string;
  value: string;
  onChange: (value: string) => void;
}
export const ModalTextField = forwardRef(function ModalTextField(
  {type, label, value, onChange}: ModalTextFieldProps,
  ref
) {
  return (
    <label className={styles.modalField}>
      <span>{label}</span>
      <input
        ref={ref as any}
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
});

interface ModalSelectFieldProps<T> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: {id: string; value: T; label?: string}[];
}
export function ModalSelectField<T>({
  label,
  value,
  onChange,
  options,
}: ModalSelectFieldProps<T>) {
  return (
    <label className={styles.modalField}>
      <span>{label}</span>
      <select
        value={options.find((opt) => opt.value === value)?.id}
        onChange={(e) =>
          onChange(options.find((opt) => opt.id === e.target.value)!.value)
        }
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label ?? option.id}
          </option>
        ))}
      </select>
    </label>
  );
}
