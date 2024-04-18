import cn from "@edgedb/common/utils/classNames";
import {Select as _Select, SelectProps} from "@edgedb/common/ui/select";

import styles from "./select.module.scss";

export function Select<T>({
  className,
  label,
  ...props
}: SelectProps<T> & {label?: string}) {
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
