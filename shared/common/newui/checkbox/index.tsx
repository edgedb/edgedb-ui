import cn from "@edgedb/common/utils/classNames";

import styles from "./checkbox.module.scss";

export interface CheckboxProps {
  className?: string;
  label?: string | JSX.Element;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function Checkbox({
  className,
  label,
  checked,
  onChange,
  disabled,
}: CheckboxProps) {
  return (
    <label
      className={cn(styles.checkbox, className, {
        [styles.disabled]: !!disabled,
      })}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <div className={styles.check} />
      {label}
    </label>
  );
}
