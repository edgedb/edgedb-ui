import {useEffect, useReducer, useState} from "react";
import {observer} from "mobx-react";

import {useAppState} from "../../../state/providers";

import {ModalOverlay, Modal} from "../../../ui/modal";
import Button from "../../../ui/button";

export default observer(function UpgradeAllInstancesModal({
  closeModal,
}: {
  closeModal: () => void;
}) {
  const appState = useAppState();

  const [nightly, setNightly] = useState(false);

  const [upgrading, setUpgrading] = useState(false);
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
        if (!upgrading) {
          closeModal();
        }
      }}
    >
      <Modal
        title="Upgrade All Instances"
        actions={
          isFinished ? (
            <Button label="Close" onClick={closeModal} />
          ) : (
            <Button
              label={upgrading ? "Upgrading..." : "Upgrade"}
              colour="green"
              loading={upgrading}
              onClick={async () => {
                if (!upgrading) {
                  setErrorMessage("");
                  updateProgress(null);
                  setUpgrading(true);
                  try {
                    await appState.system.upgradeAllInstances(
                      nightly,
                      updateProgress
                    );
                    setFinished(true);
                  } catch (e) {
                    setErrorMessage(e.message);
                  } finally {
                    setUpgrading(false);
                  }
                }
              }}
            />
          )
        }
        error={errorMessage}
        progress={progress}
        close={!upgrading ? closeModal : undefined}
      >
        <label>
          <input
            type="checkbox"
            checked={nightly}
            onChange={(e) => setNightly(e.target.checked)}
          />
          <span>Upgrade all nightly instances</span>
        </label>
      </Modal>
    </ModalOverlay>
  );
});
