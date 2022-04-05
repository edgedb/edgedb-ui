import {useEffect, useRef, useState} from "react";

import {useAppState} from "src/state/providers";

import {ModalOverlay, Modal, ModalTextField} from "src/ui/modal";
import Button from "src/ui/button";

import styles from "./modals.module.scss";

export default function CreateDatabaseModal() {
  const appState = useAppState();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <ModalOverlay onOverlayClick={appState.closeModalOverlay}>
      <Modal
        title="New Database"
        close={appState.closeModalOverlay}
        actions={
          <Button
            className={styles.greenButton}
            loading={creating}
            disabled={!name.trim() || creating}
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
          ref={inputRef}
          label="Database Name"
          value={name}
          onChange={setName}
        />
      </Modal>
    </ModalOverlay>
  );
}
