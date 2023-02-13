import cn from "../../utils/classNames";
import styles from "./toggleSwitch.module.scss";

export interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  className,
}: ToggleSwitchProps) {
  return (
    <div
      className={cn(styles.toggleSwitch, className, {
        [styles.checked]: checked,
      })}
    >
      <div className={styles.track} onClick={() => onChange(!checked)}>
        <div className={styles.switch} />
      </div>
    </div>
  );
}
