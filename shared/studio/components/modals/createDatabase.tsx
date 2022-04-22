import {useEffect, useRef, useState} from "react";
import {useNavigate} from "react-router-dom";

import {useModal} from "@edgedb/common/hooks/useModal";
import {ModalOverlay, Modal, ModalTextField} from "@edgedb/common/ui/modal";
import Button from "@edgedb/common/ui/button";

import {InstanceState, useInstanceState} from "../../state/instance";

import styles from "./modals.module.scss";

interface CreateDatabaseModalProps {
  instanceState: InstanceState;
  dbPagePathPrefix: string;
}

export default function CreateDatabaseModal({
  instanceState,
  dbPagePathPrefix,
}: CreateDatabaseModalProps) {
  const navigate = useNavigate();
  const {openModal} = useModal();

  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <ModalOverlay onOverlayClick={() => openModal(null)}>
      <Modal
        title="New Database"
        close={() => openModal(null)}
        actions={
          <Button
            className={styles.greenButton}
            loading={creating}
            disabled={!name.trim() || creating}
            size="large"
            label={"Create database"}
            onClick={async () => {
              setCreating(true);
              try {
                await instanceState.defaultConnection?.query(
                  `create database ${name}`
                );
              } catch (e) {
                setError((e as any).toString());
                setCreating(false);
                return;
              }
              await instanceState.fetchInstanceInfo();
              navigate(`${dbPagePathPrefix}/${name}`);
              openModal(null);
            }}
          />
        }
      >
        <div className={styles.modalBody}>
          <ModalTextField
            ref={inputRef}
            label="Database Name"
            value={name}
            onChange={setName}
          />

          <div className={styles.errorText}>{error}</div>
        </div>
      </Modal>
    </ModalOverlay>
  );
}
