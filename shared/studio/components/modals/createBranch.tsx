import {useEffect, useState} from "react";
import {useForm} from "react-hook-form";

import {useModal} from "@edgedb/common/hooks/useModal";
import {
  ModalOverlay,
  Modal,
  ModalTextField,
  ModalSelectField,
  ModalCheckboxField,
} from "@edgedb/common/ui/modal";
import Button from "@edgedb/common/ui/button";

import {InstanceState} from "../../state/instance";

import styles from "./modals.module.scss";

interface CreateBranchModalProps {
  legacy?: boolean;
  instanceState: InstanceState;
  fromBranch?: string;
  navigateToDB: (dbName: string) => void;
}

export default function CreateBranchModal({
  legacy,
  instanceState,
  fromBranch,
  navigateToDB,
}: CreateBranchModalProps) {
  const {openModal} = useModal();

  const [error, setError] = useState("");

  const {register, handleSubmit, formState, setFocus, watch, setValue} =
    useForm<{
      branchName: string;
      fromBranch: null | string;
      copyData: boolean;
    }>({
      defaultValues: {
        branchName: "",
        fromBranch: fromBranch ?? null,
        copyData: false,
      },
      mode: "onChange",
    });

  useEffect(() => {
    setFocus("branchName");
  }, []);

  const onSubmit = handleSubmit(async ({branchName, fromBranch, copyData}) => {
    try {
      await instanceState.defaultConnection?.query(
        legacy
          ? `create database \`${branchName}\``
          : fromBranch != null
          ? `create ${
              copyData ? "data" : "schema"
            } branch \`${branchName}\` from \`${fromBranch}\``
          : `create empty branch \`${branchName}\``
      );
    } catch (e) {
      setError((e as any).toString());
      return;
    }
    await instanceState.fetchInstanceInfo();
    navigateToDB(branchName);
    openModal(null);
  });

  return (
    <ModalOverlay onOverlayClick={() => openModal(null)}>
      <Modal
        title={legacy ? "New Database" : "New Branch"}
        close={() => openModal(null)}
        contentClass={styles.modalContent}
        actions={
          <Button
            className={styles.greenButton}
            loading={formState.isSubmitting}
            disabled={!formState.isValid || formState.isSubmitting}
            size="large"
            label={legacy ? "Create database" : "Create branch"}
            onClick={onSubmit}
          />
        }
      >
        <form className={styles.modalBody} onSubmit={onSubmit}>
          <ModalTextField
            label={legacy ? "Database Name" : "Branch Name"}
            {...register("branchName", {
              required: "Database name is required",
              pattern: {
                value: /^[A-Za-z]\w*$/,
                message: legacy
                  ? "Invalid database name"
                  : "Invalid branch name",
              },
            })}
            error={formState.errors.branchName?.message}
          />
          {!legacy ? (
            <>
              <ModalSelectField
                label="From branch"
                items={[
                  {id: null, label: <i>Empty</i>},
                  ...(instanceState.databases ?? []).map((db) => ({
                    id: db,
                    label: db,
                  })),
                ]}
                selectedItemId={watch("fromBranch")}
                onChange={({id}) => setValue("fromBranch", id)}
              />

              <ModalCheckboxField
                label="Copy data"
                {...register("copyData", {
                  disabled: watch("fromBranch") == null,
                })}
              />
            </>
          ) : null}

          <div className={styles.errorText}>{error}</div>
        </form>
      </Modal>
    </ModalOverlay>
  );
}
