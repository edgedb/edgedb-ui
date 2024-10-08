import {PropsWithChildren, createContext, useContext} from "react";

import cn from "@edgedb/common/utils/classNames";

import styles from "./shared.module.scss";
import {CloseIcon} from "../../icons";

export const ExtendedViewerContext = createContext<{
  closeExtendedView: () => void;
}>(null!);

export function ActionsBar({children}: PropsWithChildren<{}>) {
  const {closeExtendedView} = useContext(ExtendedViewerContext);

  return (
    <div className={styles.actionsBar}>
      <div className={styles.actions}>{children}</div>
      <div className={styles.closeAction} onClick={() => closeExtendedView()}>
        <CloseIcon />
      </div>
    </div>
  );
}

export function ActionButton({
  className,
  icon,
  children,
  onClick,
  active,
}: PropsWithChildren<{
  className?: string;
  icon: JSX.Element;
  onClick: () => void;
  active?: boolean;
}>) {
  return (
    <div
      className={cn(styles.actionButton, className, {
        [styles.active]: !!active,
      })}
      onClick={onClick}
    >
      {children}
      {icon}
    </div>
  );
}
