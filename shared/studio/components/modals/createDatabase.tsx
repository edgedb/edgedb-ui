import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {useForm} from "react-hook-form";

import {useModal} from "@edgedb/common/hooks/useModal";
import {ModalOverlay, Modal, ModalTextField} from "@edgedb/common/ui/modal";
import Button from "@edgedb/common/ui/button";

import {InstanceState} from "../../state/instance";

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

  const [error, setError] = useState("");

  const {register, handleSubmit, formState, setFocus} = useForm<{
    dbName: string;
  }>({mode: "onChange"});

  useEffect(() => {
    setFocus("dbName");
  }, []);

  const onSubmit = handleSubmit(async ({dbName}) => {
    try {
      await instanceState.defaultConnection?.query(
        `create database ${dbName}`
      );
    } catch (e) {
      setError((e as any).toString());
      return;
    }
    await instanceState.fetchInstanceInfo();
    navigate(`${dbPagePathPrefix}/${dbName}`);
    openModal(null);
  });

  return (
    <ModalOverlay onOverlayClick={() => openModal(null)}>
      <Modal
        title="New Database"
        close={() => openModal(null)}
        actions={
          <Button
            className={styles.greenButton}
            loading={formState.isSubmitting}
            disabled={!formState.isValid || formState.isSubmitting}
            size="large"
            label={"Create database"}
            onClick={onSubmit}
          />
        }
      >
        <form className={styles.modalBody} onSubmit={onSubmit}>
          <ModalTextField
            label="Database Name"
            {...register("dbName", {
              required: "Database name is required",
              pattern: {
                value: /^[A-Za-z]\w*$/,
                message: "Invalid database name",
              },
            })}
            error={formState.errors.dbName?.message}
          />

          <div className={styles.errorText}>{error}</div>
        </form>
      </Modal>
    </ModalOverlay>
  );
}
