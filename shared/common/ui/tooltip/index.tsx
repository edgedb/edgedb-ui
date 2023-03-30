import cn from "../../utils/classNames";
import styles from "./tooltip.module.scss";

export enum tooltipLocation {
  left = "left",
  right = "right",
}

export interface ToggleSwitchProps {
  children: JSX.Element | string;
  location?: tooltipLocation;
  classes?: string;
}

const Tooltip = ({classes, children, location}: ToggleSwitchProps) => (
  <div
    className={cn(styles.tooltip, classes, !!location ? styles[location] : "")}
  >
    {children}
  </div>
);

export default Tooltip;
