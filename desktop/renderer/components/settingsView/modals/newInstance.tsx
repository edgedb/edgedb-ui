import {useEffect, useReducer, useState} from "react";
import {observer} from "mobx-react";

import {useAppState} from "../../../state/providers";

import {
  ModalOverlay,
  Modal,
  ModalTextField,
  ModalSelectField,
} from "../../../ui/modal";
import Button from "../../../ui/button";
import {PlusIcon} from "../../icons";

export default observer(function NewInstanceModal({
  closeModal,
}: {
  closeModal: () => void;
}) {
  const appState = useAppState();

  const installedVersions = appState.system.installedServerVersions;

  const [newInstanceName, setNewInstanceName] = useState("");
  const [newInstanceVersion, setNewInstanceVersion] = useState(
    installedVersions[installedVersions.length - 1]
  );

  const [creatingInstance, setCreatingInstance] = useState(false);
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
        if (!creatingInstance) {
          closeModal();
        }
      }}
    >
      <Modal
        title="Create New Instance"
        actions={
          isFinished ? (
            <Button label="Close" onClick={closeModal} />
          ) : (
            <Button
              label={creatingInstance ? "Creating..." : "Create"}
              colour="green"
              icon={<PlusIcon />}
              loading={creatingInstance}
              onClick={async () => {
                if (
                  !creatingInstance &&
                  newInstanceName &&
                  newInstanceVersion
                ) {
                  setErrorMessage("");
                  updateProgress(null);
                  setCreatingInstance(true);
                  try {
                    await appState.system.createInstance(
                      newInstanceName,
                      newInstanceVersion.version,
                      newInstanceVersion.type,
                      updateProgress
                    );
                    setFinished(true);
                  } catch (e) {
                    setErrorMessage(e.message);
                  } finally {
                    setCreatingInstance(false);
                  }
                }
              }}
            />
          )
        }
        error={errorMessage}
        progress={progress}
        close={closeModal}
      >
        <ModalTextField
          label="Instance Name"
          value={newInstanceName}
          onChange={setNewInstanceName}
        />
        <ModalSelectField
          label="Server Version"
          value={newInstanceVersion}
          onChange={setNewInstanceVersion}
          options={installedVersions.map((ver) => ({
            id: ver.version,
            value: ver,
            label: `${ver.version}${ver.type === "docker" ? " (docker)" : ""}`,
          }))}
        />
      </Modal>
    </ModalOverlay>
  );
});
