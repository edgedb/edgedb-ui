import {useState} from "react";
import {observer} from "mobx-react";

import {useAppState} from "../../state/providers";
import {Instance} from "../../state/models/system";

import {
  ModalOverlay,
  Modal,
  ModalTextField,
  ModalSelectField,
} from "../../ui/modal";
import Button from "../../ui/button";

export default observer(function CustomInstanceModal({
  defaultInstance,
  closeModal,
}: {
  defaultInstance: Instance;
  closeModal: () => void;
}) {
  const appState = useAppState();

  const newConnTab = appState.newConnectionTab;
  const allInstances = appState.system.instances;

  const [databaseName, setDatabaseName] = useState("");
  const [selectedInstance, setSelectedInstance] = useState(defaultInstance);

  const connId = `instance-${selectedInstance.name}-${databaseName}`;

  const pendingConn = newConnTab.pendingConnections.get(connId);

  const connectStatus = pendingConn
    ? selectedInstance.actionInProgress === "starting"
      ? "Starting..."
      : pendingConn.connecting
      ? "Connecting..."
      : null
    : null;

  return (
    <ModalOverlay onOverlayClick={closeModal}>
      <Modal
        title="Connect to Custom Database"
        actions={
          <Button
            label={
              connectStatus ??
              (selectedInstance.status !== "running"
                ? "Start & Connect"
                : "Connect")
            }
            colour="green"
            loading={!!connectStatus}
            onClick={async () => {
              await newConnTab.createConnection(connId, {
                type: "instance",
                instanceName: selectedInstance.name,
                database: databaseName,
              });
              closeModal();
            }}
          />
        }
        error={
          (pendingConn && selectedInstance.errorMessage) ||
          pendingConn?.errorMessage
        }
        close={closeModal}
      >
        <ModalSelectField
          label="Instance"
          value={selectedInstance}
          onChange={setSelectedInstance}
          options={allInstances.map((inst) => ({
            id: inst.name,
            value: inst,
          }))}
        />
        <ModalTextField
          label="Database"
          value={databaseName}
          onChange={setDatabaseName}
        />
      </Modal>
    </ModalOverlay>
  );
});
