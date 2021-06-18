import {PropsWithChildren, useState} from "react";

import cn from "@edgedb/common/utils/classNames";

import {Instance} from "../../state/models/system";

import styles from "./newConnection.module.scss";

interface ConnectionScreenBlockProps {
  className?: string;
  title: string;
  actions?: JSX.Element;
}

export function ConnectionScreenBlock({
  className,
  title,
  actions,
  children,
}: PropsWithChildren<ConnectionScreenBlockProps>) {
  const [showShadow, setShowShadow] = useState(false);

  return (
    <div
      className={cn(styles.connectionBlock, className, {
        [styles.showShadow]: showShadow,
      })}
    >
      <div className={styles.blockHeader}>
        <div className={styles.title}>{title}</div>
        <div className={styles.actions}>{actions}</div>
      </div>
      <div
        className={styles.blockContent}
        onScroll={(e) => {
          setShowShadow((e.target as HTMLDivElement).scrollTop > 0);
        }}
      >
        {children}
      </div>
    </div>
  );
}

interface InstanceStatusProps {
  className?: string;
  instance?: Instance;
}

export function InstanceStatus({className, instance}: InstanceStatusProps) {
  return (
    <div
      className={cn(styles.instanceStatus, className, {
        [styles.unknown]: !instance,
        [styles.running]: instance?.status === "running",
        [styles.pending]: !!instance && instance.actionInProgress !== null,
      })}
    >
      {instance?.actionInProgress ?? instance?.status ?? "unknown"}
    </div>
  );
}
