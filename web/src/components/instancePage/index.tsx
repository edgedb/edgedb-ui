import {observer} from "mobx-react";

import {useAppState} from "src/state/providers";
import CreateDatabaseModal from "../modals/createDatabase";

import styles from "./instancePage.module.scss";
import {HeaderDatabaseIcon} from "src/ui/icons";

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
            <HeaderDatabaseIcon/>
            <span>{db.name}</span>
          </div>
        ))}

        <div
          className={styles.newDatabaseCard}
          onClick={() => {
            appState.openModalOverlay(<CreateDatabaseModal />);
          }}
        >
          <span>Create new database</span>
        </div>
      </div>
    </div>
  );
});
