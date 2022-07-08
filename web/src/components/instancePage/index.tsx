import {observer} from "mobx-react";
import {useNavigate} from "react-router-dom";

import {useModal} from "@edgedb/common/hooks/useModal";
import CreateDatabaseModal from "@edgedb/studio/components/modals/createDatabase";
import {HeaderDatabaseIcon} from "@edgedb/studio/icons";

import {useAppState} from "src/state/providers";

import styles from "./instancePage.module.scss";

export default observer(function InstancePage() {
  const instanceState = useAppState().instanceState;
  const navigate = useNavigate();
  const {openModal} = useModal();

  return (
    <div className={styles.instancePage}>
      <div className={styles.instanceName}>{instanceState.instanceName}</div>
      <div className={styles.databases}>
        {instanceState.databases?.map((db) => (
          <div
            key={db}
            className={styles.databaseCard}
            onClick={() => navigate(db)}
          >
            <HeaderDatabaseIcon />
            <span>{db}</span>
          </div>
        ))}

        <div
          className={styles.newDatabaseCard}
          onClick={() => {
            openModal(
              <CreateDatabaseModal
                instanceState={instanceState}
                dbPagePathPrefix={`/`}
              />
            );
          }}
        >
          <span>Create new database</span>
        </div>
      </div>
    </div>
  );
});
