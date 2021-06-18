import cn from "@edgedb/common/utils/classNames";

import styles from "./statusLabel.module.scss";

interface StatusLabelProps {
  label: string;
  status?: "active" | "error";
}

export default function StatusLabel({label, status}: StatusLabelProps) {
  return (
    <div className={cn(styles.statusLabel, styles[status as string])}>
      {label}
    </div>
  );
}
