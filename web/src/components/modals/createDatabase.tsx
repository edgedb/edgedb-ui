import {useState} from "react";

import {useAppState} from "src/state/providers";

import {ModalOverlay, Modal, ModalTextField} from "src/ui/modal";
import Button from "src/ui/button";

import styles from "./modals.module.scss";

export default function CreateDatabaseModal() {
  const appState = useAppState();
  const [name, setName] = useState("");

  return (
    <ModalOverlay onOverlayClick={appState.closeModalOverlay}>
      <Modal
        title="New Database"
        actions={
          <Button
            className={styles.greenButton}
            size="large"
            label={"Create database"}
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
