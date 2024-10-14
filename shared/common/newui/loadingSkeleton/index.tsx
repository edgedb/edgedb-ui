import styles from "./loadingSkeleton.module.scss";

export function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={`${styles.loadingSkeleton} ${className ?? ""}`} />;
}
