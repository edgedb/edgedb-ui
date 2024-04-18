import cn from "@edgedb/common/utils/classNames";

import styles from "./button.module.scss";

interface _BaseButtonProps {
  className?: string;
  kind?: "primary" | "secondary";
  children?: React.ReactNode;
  leftIcon?: JSX.Element;
  rightIcon?: JSX.Element;
  disabled?: boolean;
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
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        styles.button,
        { [styles.primary]: kind === "primary" },
        className
      )}
      {...props}
    >
      {leftIcon}
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
  kind,
  children,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}: LinkButtonProps) {
  return (
    <a
      className={cn(styles.linkButton, {
        [styles.primary]: kind === "primary",
        [styles.disabled]: !!disabled,
      })}
      {...props}
    >
      {leftIcon}
      <span>{children}</span>
      {rightIcon}
    </a>
  );
}
