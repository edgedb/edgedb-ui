import {observer} from "mobx-react";

import {useAppState} from "../../state/providers";

import {ConnectConfigField} from "../../state/models/newConnection";

import {ModalOverlay, Modal, ModalTextField} from "../../ui/modal";

import styles from "./newConnection.module.scss";

import Button from "../../ui/button";

const fields: {
  name: ConnectConfigField;
  type?: "text" | "password";
  label: string;
}[] = [
  {name: "hostAndPort", label: "host:port"},
  {name: "database", label: "database"},
  {name: "user", label: "user"},
  {name: "password", type: "password", label: "password"},
];

export default observer(function ManualConnection() {
  const appState = useAppState();

  const newConnTab = appState.newConnectionTab;
  const configEditor = newConnTab.manualConfigEditor;

  const pendingConn = newConnTab.pendingConnections.get("manual");

  const connectStatus = pendingConn?.connecting ? "Connecting..." : null;

  const form = fields.map(({name, type, label}) => {
    return (
      <ModalTextField
        key={name}
        label={label}
        type={type}
        value={configEditor[name]}
        onChange={(val) => configEditor.updateConnectionInput(name, val)}
      />
    );
  });

  return (
    <ModalOverlay
      onOverlayClick={() => {
        newConnTab.setShowManualConn(false);
      }}
    >
      <Modal
        title="Manual Connection"
        actions={
          <>
            <Button
              label={connectStatus ?? "Connect"}
              colour="green"
              onClick={() => newConnTab.createConnection("manual")}
              loading={!!connectStatus}
            />
          </>
        }
        error={pendingConn?.errorMessage}
        close={() => newConnTab.setShowManualConn(false)}
      >
        <div className={styles.manualForm}>{form}</div>
      </Modal>
    </ModalOverlay>
  );
});
