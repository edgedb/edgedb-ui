import cn from "@edgedb/common/utils/classNames";

import styles from "./button.module.scss";
import Spinner from "../../ui/spinner";

interface _BaseButtonProps {
  className?: string;
  kind?: "primary" | "secondary" | "outline";
  children?: React.ReactNode;
  leftIcon?: JSX.Element;
  rightIcon?: JSX.Element;
  disabled?: boolean;
  loading?: boolean;
}

export interface ButtonProps extends _BaseButtonProps {
  onClick?: () => void;
}

export function Button({
  className,
  kind,
  children,
  leftIcon,
  rightIcon,
  disabled,
  loading,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        styles.button,
        {
          [styles.primary]: kind === "primary",
          [styles.outline]: kind === "outline",
        },
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size={16} strokeWidth={1.5} /> : leftIcon}
      <span>{children}</span>
      {rightIcon}
    </button>
  );
}

export interface LinkButtonProps extends _BaseButtonProps {
  href: string;
  target?: React.AnchorHTMLAttributes<HTMLAnchorElement>["target"];
}

export function LinkButton({
  className,
  kind,
  children,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}: LinkButtonProps) {
  return (
    <a
      className={cn(
        styles.linkButton,
        {
          [styles.primary]: kind === "primary",
          [styles.outline]: kind === "outline",
          [styles.disabled]: !!disabled,
        },
        className
      )}
      {...props}
    >
      {leftIcon}
      <span>{children}</span>
      {rightIcon}
    </a>
  );
}
