import cn from "@edgedb/common/utils/classNames";
import {
  Select as _Select,
  SelectProps as _SelectProps,
} from "@edgedb/common/ui/select";

import styles from "./select.module.scss";

export type SelectProps<T = any> = _SelectProps<T> & {label?: string};

export function Select<T>({className, label, ...props}: SelectProps<T>) {
  if (label != null) {
    return (
      <label className={cn(styles.selectField, className)}>
        <div className={styles.fieldHeader}>{label}</div>
        <_Select className={styles.select} {...props} />
      </label>
    );
  }
  return <_Select className={cn(styles.select, className)} {...props} />;
}
