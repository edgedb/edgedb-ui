import cn from "@edgedb/common/utils/classNames";

import {InstanceIcon} from "../../components/icons";
import Spinner from "../spinner";

import styles from "./statusRing.module.scss";

interface StatusRingProps {
  className?: string;
  spinner?: boolean;
  status?: "active" | "error";
}

export default function StatusRing({
  className,
  spinner,
  status,
}: StatusRingProps) {
  return (
    <div className={cn(styles.statusRing, className)}>
      <svg
        viewBox="0 0 32 32"
        className={cn(styles.ring, styles[status as string])}
      >
        <circle cx="16" cy="16" r="14" />
      </svg>
      {spinner ? (
        <Spinner className={styles.spinner} size={28} strokeWidth={2} />
      ) : null}
      <InstanceIcon />
    </div>
  );
}
