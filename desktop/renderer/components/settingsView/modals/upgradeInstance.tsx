import {useEffect, useReducer, useState} from "react";
import {observer} from "mobx-react";

import {useAppState} from "../../../state/providers";
import {Instance} from "../../../state/models/system";

import {ModalOverlay, Modal, ModalSelectField} from "../../../ui/modal";
import Button from "../../../ui/button";
import {PlusIcon} from "../../icons";

export default observer(function UpgradeInstanceModal({
  instance,
  closeModal,
}: {
  instance: Instance;
  closeModal: () => void;
}) {
  const appState = useAppState();

  const currentVersionIndex = appState.system.installedServerVersions.findIndex(
    (version) => instance.version === version.version
  );

  const upgradableVersions = appState.system.installedServerVersions.slice(
    currentVersionIndex > -1 ? currentVersionIndex + 1 : 0
  );

  const [newServerVersion, setNewServerVersion] = useState(() => {
    const lastVersion = upgradableVersions[upgradableVersions.length - 1];
    return upgradableVersions[
      Math.max(
        upgradableVersions.length -
          (lastVersion?.version === "nightly" ? 2 : 1),
        0
      )
    ];
  });

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
        title="Upgrade Instance"
        actions={
          isFinished ? (
            <Button label="Close" onClick={closeModal} />
          ) : (
            <Button
              label={upgrading ? "Upgrading..." : "Upgrade"}
              colour="green"
              icon={<PlusIcon />}
              loading={upgrading}
              onClick={async () => {
                const serverVersion =
                  upgradableVersions[Number(newServerVersion)];
                if (!upgrading && serverVersion) {
                  setErrorMessage("");
                  updateProgress(null);
                  setUpgrading(true);
                  try {
                    await appState.system.upgradeInstance(
                      instance,
                      serverVersion.version,
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
        <ModalSelectField
          label="New Server Version"
          value={newServerVersion}
          onChange={setNewServerVersion}
          options={upgradableVersions.map((ver) => ({
            id: ver.version,
            value: ver,
            label: `${ver.version}${ver.type === "docker" ? " (docker)" : ""}`,
          }))}
        />
      </Modal>
    </ModalOverlay>
  );
});
