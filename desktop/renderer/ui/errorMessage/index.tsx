import {useState, useRef, useLayoutEffect} from "react";

import cn from "@edgedb/common/utils/classNames";

import styles from "./errorMessage.module.scss";

interface ErrorMessageProps {
  className?: string;
  error: string;
  expandUp?: boolean;
}

export default function ErrorMessage({
  error,
  className,
  expandUp,
}: ErrorMessageProps) {
  const [overflowing, setOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const errorRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (errorRef.current) {
      if (errorRef.current.clientWidth < errorRef.current.scrollWidth) {
        setOverflowing(true);
      }
    }
  }, []);

  return (
    <div
      className={cn(styles.errorMessage, className, {
        [styles.overflowing]: overflowing,
        [styles.expanded]: expanded,
        [styles.expandUp]: !!expandUp,
      })}
      ref={errorRef}
    >
      <span>{error}</span>
      {overflowing ? (
        <div className={styles.expand} onClick={() => setExpanded(!expanded)}>
          {expanded ? "Hide" : "Show"}
        </div>
      ) : null}
    </div>
  );
}
