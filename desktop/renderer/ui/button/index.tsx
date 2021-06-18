import {MouseEventHandler} from "react";

import cn from "@edgedb/common/utils/classNames";

import Spinner from "../spinner";

import styles from "./button.module.scss";

interface ButtonProps {
  className?: string;
  label: string | JSX.Element;
  shortcut?: string | JSX.Element;
  colour?: "green" | "red";
  icon?: JSX.Element;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  loading?: boolean;
}

export default function Button({
  className,
  label,
  shortcut,
  colour,
  icon,
  onClick,
  disabled,
  loading,
}: ButtonProps) {
  return (
    <button
      className={cn(
        styles.button,
        colour ? styles[`colour-${colour}`] : null,
        className
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <div className={styles.inner}>
        <span>
          {label}
          {shortcut ? (
            <span className={styles.shortcut}>{shortcut}</span>
          ) : null}
        </span>
        {loading ? (
          <Spinner size={14} angle={135} strokeWidth={1.5} period={1.5} />
        ) : (
          icon
        )}
      </div>
    </button>
  );
}
