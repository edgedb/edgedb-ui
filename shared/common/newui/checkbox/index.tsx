import cn from "@edgedb/common/utils/classNames";

import styles from "./checkbox.module.scss";

export interface CheckboxProps {
  className?: string;
  label?: string | JSX.Element;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Checkbox({
  className,
  label,
  checked,
  onChange,
}: CheckboxProps) {
  return (
    <label className={cn(styles.checkbox, className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className={styles.check} />
      {label}
    </label>
  );
}
