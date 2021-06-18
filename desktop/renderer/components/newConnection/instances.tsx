import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import {useAppState} from "../../state/providers";
import {Instance} from "../../state/models/system";
import {SpecialTab} from "../../state/models/app";
import {SettingsViewType} from "../../state/models/settings";

import {ConnectionScreenBlock, InstanceStatus} from "./common";
import CustomInstanceModal from "./customInstanceModal";
import NewInstanceModal from "../settingsView/modals/newInstance";

import Button from "../../ui/button";
import StatusRing from "../../ui/statusRing";
import PopupMenu from "../../ui/popupMenu";
import {SettingsGearIcon, PlusIcon} from "../icons";

import styles from "./newConnection.module.scss";

export default observer(function InstancesBlock() {
  const appState = useAppState();

  return (
    <ConnectionScreenBlock
      className={styles.instancesBlock}
      title="Local Instances"
      actions={
        <>
          <Button
            label="Manage"
            icon={<SettingsGearIcon />}
            onClick={() => {
              appState.setSelectedTabId(SpecialTab.Settings);
              appState.settingsTab.setView(SettingsViewType.servers);
            }}
          />
        </>
      }
    >
      <div className={styles.instancesGrid}>
        <div
          className={styles.newInstanceCard}
          onClick={() =>
            appState.openModalOverlay(
              <NewInstanceModal closeModal={appState.closeModalOverlay} />
            )
          }
        >
          <PlusIcon />
          <span>Create New Instance</span>
        </div>
        {appState.system.instances.map((instance) => (
          <InstanceCard key={instance.name} instance={instance} />
        ))}
      </div>
    </ConnectionScreenBlock>
  );
});

const InstanceCard = observer(function InstanceCard({
  instance,
}: {
  instance: Instance;
}) {
  const appState = useAppState();
  const connId = "instance-" + instance.name;
  const newConnTab = appState.newConnectionTab;

  const pendingConn = newConnTab.pendingConnections.get(connId);

  const connectStatus = pendingConn
    ? instance.actionInProgress === "starting"
      ? "Starting..."
      : pendingConn.connecting
      ? "Connecting..."
      : null
    : null;

  return (
    <div
      className={cn(styles.instanceCard, {
        [styles.showButton]: !!connectStatus,
        [styles.errorRing]:
          !!pendingConn && newConnTab.latestFailedConnection === pendingConn,
      })}
    >
      <PopupMenu
        className={styles.popup}
        items={[
          {
            label: "Connect to Custom Database",
            action: () => {
              appState.openModalOverlay(
                <CustomInstanceModal
                  defaultInstance={instance}
                  closeModal={appState.closeModalOverlay}
                />
              );
            },
          },
        ]}
      />
      <InstanceStatus className={styles.status} instance={instance} />

      <div className={styles.instanceDetails}>
        <StatusRing />
        <div className={styles.instanceName}>{instance.name}</div>
        <div className={styles.instanceVersion}>{instance.version}</div>
      </div>

      <Button
        className={styles.instanceConnect}
        label={
          connectStatus ??
          (instance.status !== "running" ? "Start & Connect" : "Connect")
        }
        colour="green"
        loading={!!connectStatus}
        onClick={() =>
          newConnTab.createConnection(connId, {
            type: "instance",
            instanceName: instance.name,
          })
        }
      />
    </div>
  );
});
