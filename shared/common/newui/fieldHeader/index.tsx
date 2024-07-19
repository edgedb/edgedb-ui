import styles from "./fieldHeader.module.scss";

export interface FieldHeaderProps {
  label?: string | JSX.Element;
  optional?: boolean;
  headerNote?: string;
}

export function FieldHeader({label, optional, headerNote}: FieldHeaderProps) {
  return (
    <div className={styles.fieldHeader}>
      {label}
      {optional ? <span className={styles.optional}>(optional)</span> : null}
      {headerNote ? (
        <span className={styles.headerNote}>{headerNote}</span>
      ) : null}
    </div>
  );
}
