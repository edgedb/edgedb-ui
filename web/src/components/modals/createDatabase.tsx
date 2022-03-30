import {useState} from "react";

import {useAppState} from "src/state/providers";

import {ModalOverlay, Modal, ModalTextField} from "src/ui/modal";
import Button from "src/ui/button";

import styles from "./modals.module.scss";

export default function CreateDatabaseModal() {
  const appState = useAppState();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  return (
    <ModalOverlay onOverlayClick={appState.closeModalOverlay}>
      <Modal
        title="New Database"
        actions={
          <Button
            className={styles.greenButton}
            loading={creating}
            disabled={creating}
            size="large"
            label={"Create database"}
            onClick={async () => {
              setCreating(true);
              await appState.defaultConnection?.query(
                `create database ${name}`
              );
              await appState.instanceState.fetchInstanceInfo();
              appState.openDatabasePage(name);
              appState.closeModalOverlay();
            }}
          />
        }
      >
        <ModalTextField
          label="Database Name"
          value={name}
          onChange={setName}
        />
      </Modal>
    </ModalOverlay>
  );
}
