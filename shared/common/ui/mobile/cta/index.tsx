import cn from "@edgedb/common/utils/classNames";
import styles from "./cta.module.scss";
import {Link} from "react-router-dom";

interface CtaProps {
  label: string;
  to: string;
  icon?: JSX.Element;
  className?: string;
  fullWidth?: boolean;
}

const Cta = ({label, to, className, icon, fullWidth = false}: CtaProps) => (
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

export default Cta;
