import {observer} from "mobx-react";

import {useAppState} from "src/state/providers";

import styles from "./instancePage.module.scss";

export default observer(function InstancePage() {
  const appState = useAppState();

  return (
    <div className={styles.instancePage}>
      <div className={styles.instanceName}>
        {appState.instanceState.instanceName}
      </div>
      <div className={styles.databases}>
        {appState.instanceState.databases.map((db) => (
          <div
            key={db.name}
            className={styles.databaseCard}
            onClick={() => appState.openDatabasePage(db.name)}
          >
            {db.name}
          </div>
        ))}
      </div>
    </div>
  );
});
