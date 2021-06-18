import {useEffect, useReducer, useState} from "react";
import {observer} from "mobx-react";

import {useAppState} from "../../../state/providers";
import {Instance} from "../../../state/models/system";

import {ModalOverlay, Modal} from "../../../ui/modal";
import Button from "../../../ui/button";

export default observer(function DestroyInstanceModal({
  instance,
  closeModal,
}: {
  instance: Instance;
  closeModal: () => void;
}) {
  const appState = useAppState();

  const [destroying, setDestroying] = useState(false);
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
        if (!destroying) {
          closeModal();
        }
      }}
    >
      <Modal
        title="Confirm Destroy Instance"
        actions={
          isFinished ? (
            <Button label="Close" onClick={closeModal} />
          ) : (
            <Button
              label={destroying ? "Destroying..." : "Confirm Destroy"}
              colour="red"
              loading={destroying}
              onClick={async () => {
                if (!destroying) {
                  setErrorMessage("");
                  updateProgress(null);
                  setDestroying(true);
                  try {
                    await appState.system.destroyInstance(
                      instance,
                      updateProgress
                    );
                    setFinished(true);
                  } catch (e) {
                    setErrorMessage(e.message);
                  } finally {
                    setDestroying(false);
                  }
                }
              }}
            />
          )
        }
        error={errorMessage}
        progress={progress}
        close={!destroying ? closeModal : undefined}
      >
        Are you sure you want to destroy instance: <b>{instance.name}</b> ?
        <br />
        All data in the instance will be lost.
      </Modal>
    </ModalOverlay>
  );
});
