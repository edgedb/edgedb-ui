import cn from "../../utils/classNames";
import styles from "./switch.module.scss";

export enum switchState {
  left = "lift",
  right = "right",
}
export interface SwitchProps {
  labels: [string, string];
  value: switchState;
  onChange: () => void;
  disabled?: boolean;
}

export const Switch = ({
  labels,
  value,
  onChange,
  disabled = false,
}: SwitchProps) => (
  <div className={styles.container}>
    <div className={styles.switch}>
      <div className={styles.radio}>
        <input
          type="radio"
          id={labels[0]}
          name={`${labels[0]}-or-${labels[0]}`}
          onChange={onChange}
          checked={value === switchState.left}
          disabled={disabled}
        />
        <label
          htmlFor={labels[0]}
          className={cn(
            styles.label,
            value === switchState.left ? styles.checked : styles.notChecked
          )}
        >
          <span> {labels[0]}</span>
        </label>
      </div>
      <div className={styles.radio}>
        <input
          type="radio"
          id={labels[1]}
          name={`${labels[0]}-or-${labels[1]}`}
          onChange={onChange}
          checked={value === switchState.right}
          disabled={disabled}
        />
        <label
          htmlFor={labels[1]}
          className={cn(
            styles.label,
            value === switchState.right ? styles.checked : styles.notChecked
          )}
        >
          <span> {labels[1]}</span>
        </label>
      </div>
    </div>
  </div>
);

export interface LabelsSwitchProps {
  labels: [string, string];
  value: switchState;
  onChange: () => void;
  className?: string;
}

export const LabelsSwitch = ({
  labels,
  value,
  onChange,
  className,
}: LabelsSwitchProps) => (
  <div className={cn(styles.labelsSwitch, className)}>
    <div
      className={cn(styles.radio, {
        [styles.checked]: value === switchState.left,
      })}
    >
      <input
        type="radio"
        id={labels[0]}
        name={labels[0]}
        onChange={onChange}
        checked={value === switchState.left}
      />
      <label htmlFor={labels[0]}>
        <span>{labels[0]}</span>
      </label>
    </div>
    <div
      className={cn(styles.radio, {
        [styles.checked]: value === switchState.right,
      })}
    >
      <input
        type="radio"
        id={labels[1]}
        name={labels[1]}
        onChange={onChange}
        checked={value === switchState.right}
      />
      <label htmlFor={labels[1]}>
        <span>{labels[1]}</span>
      </label>
    </div>
  </div>
);
