import {useEffect, useReducer, useState} from "react";
import {observer} from "mobx-react";

import {useAppState} from "../../../state/providers";

import {ModalOverlay, Modal, ModalSelectField} from "../../../ui/modal";
import Button from "../../../ui/button";
import {PlusIcon} from "../../icons";

export default observer(function InstallServerModal({
  closeModal,
}: {
  closeModal: () => void;
}) {
  const appState = useAppState();

  const availableVersions = appState.system.serverVersions.filter(
    (version) => !version.installed
  );

  const [newServerVersion, setNewServerVersion] = useState(() => {
    const lastVersion = availableVersions[availableVersions.length - 1];
    return availableVersions[
      Math.max(
        availableVersions.length -
          (lastVersion?.version === "nightly" ? 2 : 1),
        0
      )
    ];
  });

  const [installing, setInstalling] = useState(false);
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
        if (!installing) {
          closeModal();
        }
      }}
    >
      <Modal
        title="Install Server Version"
        actions={
          isFinished ? (
            <Button label="Close" onClick={closeModal} />
          ) : (
            <Button
              label={installing ? "Installing..." : "Install"}
              colour="green"
              icon={<PlusIcon />}
              loading={installing}
              onClick={async () => {
                if (!installing && newServerVersion) {
                  setErrorMessage("");
                  updateProgress(null);
                  setInstalling(true);
                  try {
                    await appState.system.installServer(
                      newServerVersion.version,
                      newServerVersion.type,
                      updateProgress
                    );
                    setFinished(true);
                  } catch (e) {
                    setErrorMessage(e.message);
                  } finally {
                    setInstalling(false);
                  }
                }
              }}
            />
          )
        }
        error={errorMessage}
        progress={progress}
        close={!installing ? closeModal : undefined}
      >
        <ModalSelectField
          label="New Server Version"
          value={newServerVersion}
          onChange={setNewServerVersion}
          options={availableVersions.map((ver) => ({
            id: ver.version,
            value: ver,
            label: `${ver.version}${ver.type === "docker" ? " (docker)" : ""}`,
          }))}
        />
      </Modal>
    </ModalOverlay>
  );
});
