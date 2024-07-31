import cn from "@edgedb/common/utils/classNames";

import styles from "./button.module.scss";
import Spinner from "../../ui/spinner";
import {PropsWithChildren} from "react";

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

function _Button({
  className,
  kind,
  type,
  children,
  leftIcon,
  rightIcon,
  disabled,
  loading,
  ...props
}: ButtonProps & {type: "button" | "submit"}) {
  return (
    <button
      type={type}
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

export const Button = (props: ButtonProps) => (
  <_Button {...props} type="button" />
);

export const SubmitButton = (props: Omit<ButtonProps, "onClick">) => (
  <_Button {...props} type="submit" />
);

export type LinkButtonProps = _BaseButtonProps &
  (
    | {
        href: string;
        target?: React.AnchorHTMLAttributes<HTMLAnchorElement>["target"];
      }
    | {
        link: (props: PropsWithChildren<{className?: string}>) => JSX.Element;
      }
  );

export function LinkButton({
  className,
  kind,
  children,
  leftIcon,
  rightIcon,
  disabled,
  ...props
}: LinkButtonProps) {
  const classname = cn(
    styles.linkButton,
    {
      [styles.primary]: kind === "primary",
      [styles.outline]: kind === "outline",
      [styles.disabled]: !!disabled,
    },
    className
  );

  if ("link" in props) {
    return (
      <props.link className={classname}>
        {" "}
        {leftIcon}
        <span>{children}</span>
        {rightIcon}
      </props.link>
    );
  }

  return (
    <a className={classname} {...props}>
      {leftIcon}
      <span>{children}</span>
      {rightIcon}
    </a>
  );
}
