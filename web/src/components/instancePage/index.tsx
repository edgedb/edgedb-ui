import {observer} from "mobx-react";
import {useNavigate, Link} from "react-router-dom";

import {useModal} from "@edgedb/common/hooks/useModal";
import Button from "@edgedb/common/ui/button";
import CreateDatabaseModal from "@edgedb/studio/components/modals/createDatabase";
import {HeaderDatabaseIcon} from "@edgedb/studio/icons";
import {fetchExampleSchema} from "@edgedb/studio/tabs/dashboard";

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
          <Link key={db} className={styles.databaseCard} to={db}>
            <HeaderDatabaseIcon />
            <span>{db}</span>
          </Link>
        ))}

        {instanceState.databases &&
        !instanceState.databases.includes("_example") ? (
          <div className={styles.exampleDatabaseCard} onClick={() => {}}>
            <span className={styles.cardHeading}>
              First time using EdgeDB?
            </span>
            <Button
              className={styles.cardButton}
              label={
                instanceState.creatingExampleDB
                  ? "Creating example database..."
                  : "Create example database"
              }
              loading={instanceState.creatingExampleDB}
              disabled={instanceState.creatingExampleDB}
              onClick={async () => {
                await instanceState.createExampleDatabase(
                  fetchExampleSchema()
                );
                navigate("/_example");
              }}
            />
          </div>
        ) : null}

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
