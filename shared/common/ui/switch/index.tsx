import {useEffect, useState} from "react";
import cn from "../../utils/classNames";
import styles from "./switch.module.scss";

export enum switchState {
  left,
  right,
}
export interface SwitchProps {
  leftLabel: string;
  rightLabel: string;
  onClick: () => void;
  classes?: string;
  defaultState?: switchState;
  disabled?: boolean;
}

export const Switch = ({
  defaultState = switchState.left,
  leftLabel,
  rightLabel,
  onClick,
  disabled = false
}: SwitchProps) => {
  const [leftActive, setLeftActive] = useState(
    defaultState === switchState.left
  );

  useEffect(
    () => setLeftActive(defaultState === switchState.left),
    [defaultState]
  );

  const handleChange = () => {
      onClick();
      setLeftActive(!leftActive);
  };

  return (
    <div className={styles.container}>
      <div className={styles.switch}>
        <div className={styles.radio}>
          <input
            type="radio"
            id={leftLabel}
            name={`${leftLabel}-or-${rightLabel}`}
            onChange={handleChange}
            checked={leftActive}
            disabled = {disabled}
          />
          <label
            htmlFor={leftLabel}
            className={cn(
              styles.label,
              leftActive ? styles.checked : styles.notChecked
            )}
          >
            <span> {leftLabel}</span>
          </label>
        </div>
        <div className={styles.radio}>
          <input
            type="radio"
            id={rightLabel}
            name={`${leftLabel}-or-${rightLabel}`}
            onChange={handleChange}
            checked={!leftActive}
            disabled = {disabled}
          />
          <label
            htmlFor={rightLabel}
            className={cn(
              styles.label,
              !leftActive ? styles.checked : styles.notChecked
            )}
          >
            <span> {rightLabel}</span>
          </label>
        </div>
      </div>
    </div>
  );
};
