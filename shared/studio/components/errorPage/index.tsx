import {PropsWithChildren} from "react";

import styles from "./errorPage.module.scss";

interface ErrorPageProps {
  title: string;
  actions: JSX.Element;
}

export function ErrorPage({
  title,
  children,
  actions,
}: PropsWithChildren<ErrorPageProps>) {
  return (
    <div className={styles.errorPage}>
      <div className={styles.errorBlock}>
        <div className={styles.title}>{title}</div>
        {children}
      </div>
      <div className={styles.errorActions}>{actions}</div>
    </div>
  );
}
