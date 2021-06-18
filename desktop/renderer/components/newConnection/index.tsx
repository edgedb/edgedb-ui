import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import styles from "./newConnection.module.scss";

import Logo from "@edgedb/common/logo";

import {useAppState} from "../../state/providers";

import InstancesBlock from "./instances";
import RecentsBlock from "./recents";
import ManualConnectionModal from "./manual";

import Button from "../../ui/button";
import ErrorMessage from "../../ui/errorMessage";

export default observer(function NewConnection() {
  const appState = useAppState();

  const newConnTab = appState.newConnectionTab;

  return (
    <div className={styles.newConnection}>
      <div className={styles.header}>
        <Logo className={styles.logo} /> Studio
      </div>

      <InstancesBlock />

      <RecentsBlock />

      <div className={styles.toolbar}>
        <div className={styles.toolbarActions}>
          <Button
            label="Manual Connection"
            onClick={() => newConnTab.setShowManualConn(true)}
          />
        </div>
        <div className={styles.toolbarError}>
          {newConnTab.latestFailedConnection ? (
            <ErrorMessage
              className={styles.errorMessage}
              error={newConnTab.latestFailedConnection.errorMessage}
              expandUp
            />
          ) : null}
        </div>
      </div>

      {newConnTab.showManualConn ? <ManualConnectionModal /> : null}
    </div>
  );
});
