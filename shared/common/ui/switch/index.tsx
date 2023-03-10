import {useState} from "react";
import cn from "../../utils/classNames";
import styles from "./switch.module.scss";

export enum SwitchState {
  left,
  right,
}
export interface SwitchProps {
  leftLabel: string;
  rightLabel: string;
  onClick: () => void;
  classes?: string;
  defaultState?: SwitchState;
}

export const Switch = ({
  defaultState = SwitchState.left,
  leftLabel,
  rightLabel,
  onClick,
  classes,
}: SwitchProps) => {
  const [rightActive, setRightActive] = useState(
    defaultState === SwitchState.right
  );

  const handleClick = () => {
    onClick();
    setRightActive(!rightActive);
  };

  return (
    <div className={cn(styles.container, classes)}>
      <p
        className={cn({
          [styles.hoverable]: rightActive,
          [styles.active]: !rightActive,
        })}
        onClick={handleClick}
      >
        {leftLabel}
      </p>
      <div className={styles.trackContainer} onClick={handleClick}>
        <div className={cn(styles.track, {[styles.rightActive]: rightActive})}>
          <div className={styles.switch} />
        </div>
      </div>
      <p
        className={cn({
          [styles.hoverable]: !rightActive,
          [styles.active]: rightActive,
        })}
        onClick={handleClick}
      >
        {rightLabel}
      </p>
    </div>
  );
};
