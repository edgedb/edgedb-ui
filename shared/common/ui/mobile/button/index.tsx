import cn from "@edgedb/common/utils/classNames";
import {Link} from "react-router-dom";
import styles from "./button.module.scss";

interface ButtonProps {
  label: string;
  to: string;
  icon?: JSX.Element;
  className?: string;
  fullWidth?: boolean;
}

const Button = ({
  label,
  to,
  className,
  icon,
  fullWidth = false,
}: ButtonProps) => (
  <Link
    className={cn(styles.container, className, {
      [styles.fullWidth]: fullWidth,
    })}
    to={to}
  >
    {icon}
    {label}
  </Link>
);

export default Button;
