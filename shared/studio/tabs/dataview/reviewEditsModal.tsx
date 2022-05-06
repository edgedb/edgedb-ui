import {observer} from "mobx-react-lite";

import {DataView} from "./state";
import {generateQueryFromStatements} from "./state/edits";

import {useModal} from "@edgedb/common/hooks/useModal";
import {Modal, ModalOverlay} from "@edgedb/common/ui/modal";
import Button from "@edgedb/common/ui/button";

import CodeBlock from "@edgedb/common/ui/codeBlock";

import styles from "./editsModal.module.scss";
import {useState} from "react";

interface ReviewEditsModalProps {
  state: DataView;
}

export const ReviewEditsModal = observer(function ReviewEditsModal({
  state,
}: ReviewEditsModalProps) {
  const {openModal} = useModal();

  const [commiting, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState("");

  const {params, statements} = state.edits.generateStatements();

  return (
    <ModalOverlay onOverlayClick={() => openModal(null)}>
      <Modal
        title="Review Changes"
        close={() => openModal(null)}
        actions={
          <>
            <Button
              className={styles.redButton}
              label="Clear all changes"
              onClick={() => {
                state.edits.clearAllPendingEdits();
                openModal(null);
              }}
            />
            <Button
              className={styles.greenButton}
              label={commiting ? "Committing..." : "Commit Changes"}
              loading={commiting}
              disabled={commiting}
              onClick={async () => {
                setCommitting(true);
                try {
                  await state.edits.commitPendingEdits();
                  state.edits.clearAllPendingEdits();
                  state.refreshAllViews();
                  openModal(null);
                } catch (e: any) {
                  console.log(e);
                  setCommitError(e.message);
                }
                setCommitting(false);
              }}
            />
          </>
        }
      >
        <div style={{color: "var(--app-text-colour)"}}>
          <CodeBlock
            className={styles.codeBlock}
            code={generateQueryFromStatements(statements)}
          />
          <pre>
            {JSON.stringify(
              params,
              (key, val) => (typeof val === "bigint" ? val.toString() : val),
              2
            )}
          </pre>
          <details>
            <summary>debug</summary>
            <pre>
              {JSON.stringify(
                state.edits,
                (key, val) => (typeof val === "bigint" ? val.toString() : val),
                2
              )}
            </pre>
          </details>
          <div className={styles.errorMessage}>{commitError}</div>
        </div>
      </Modal>
    </ModalOverlay>
  );
});
