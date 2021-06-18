import {useEffect, useReducer, useState} from "react";
import {observer} from "mobx-react";

import {ServerVersion} from "../../../../shared/interfaces/serverInstances";

import {useAppState} from "../../../state/providers";

import {ModalOverlay, Modal} from "../../../ui/modal";
import Button from "../../../ui/button";

export default observer(function UninstallServerModal({
  serverVersion,
  closeModal,
}: {
  serverVersion: ServerVersion;
  closeModal: () => void;
}) {
  const appState = useAppState();

  const [uninstalling, setUninstalling] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [progress, updateProgress] = useReducer(
    (state: string, update: string | null) => {
      if (update === null) {
        return "";
      }
      return state + update;
    },
    ""
  );
  const [isFinished, setFinished] = useState(false);

  useEffect(() => {
    if (isFinished && !progress) {
      closeModal();
    }
  }, [isFinished]);

  return (
    <ModalOverlay
      onOverlayClick={() => {
        if (!uninstalling) {
          closeModal();
        }
      }}
    >
      <Modal
        title="Confirm Server Uninstall"
        actions={
          isFinished ? (
            <Button label="Close" onClick={closeModal} />
          ) : (
            <Button
              label={uninstalling ? "Uninstalling..." : "Confirm Uninstall"}
              colour="red"
              loading={uninstalling}
              onClick={async () => {
                if (!uninstalling) {
                  setErrorMessage("");
                  updateProgress(null);
                  setUninstalling(true);
                  try {
                    await appState.system.uninstallServer(
                      serverVersion.version,
                      updateProgress
                    );
                    setFinished(true);
                  } catch (e) {
                    setErrorMessage(e.message);
                  } finally {
                    setUninstalling(false);
                  }
                }
              }}
            />
          )
        }
        error={errorMessage}
        progress={progress}
        close={!uninstalling ? closeModal : undefined}
      >
        Are you sure you want to uninstall server version:{" "}
        <b>{serverVersion.version}</b> ?
      </Modal>
    </ModalOverlay>
  );
});
