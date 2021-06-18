import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import {useAppState} from "../../state/providers";

import Button from "../../ui/button";
import {RefreshSmallIcon, PlusSmallIcon} from "../icons";

import {InstanceStatus} from "../newConnection/common";

import styles from "./settingsView.module.scss";
import {InstanceLogs} from "../../state/models/settings";

import NewInstanceModal from "./modals/newInstance";
import DestroyInstanceModal from "./modals/destroyInstance";
import UpgradeInstanceModal from "./modals/upgradeInstance";
import UpgradeAllInstancesModal from "./modals/upgradeAllInstances";
import InstallServerModal from "./modals/installServer";
import UninstallServerModal from "./modals/uninstallServer";

export default observer(function ServerSettingsView() {
  const appState = useAppState();

  const settings = appState.settingsTab;
  const system = appState.system;

  return (
    <div className={styles.serverTabContent}>
      <div className={styles.serverTables}>
        <div className={styles.header}>
          Installed Server Versions
          <div className={styles.headerActions}>
            <Button
              label="Refresh"
              icon={<RefreshSmallIcon />}
              onClick={() => system.fetchServerVersions()}
              loading={system.fetchingServerVersions}
            />
            <Button
              label="Install New Version"
              icon={<PlusSmallIcon />}
              onClick={() =>
                appState.openModalOverlay(
                  <InstallServerModal
                    closeModal={appState.closeModalOverlay}
                  />
                )
              }
            />
          </div>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Version</th>
              <th>Full Version</th>
              <th>Type</th>
              <th>Instances</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {appState.system.installedServerVersions.map((version) => (
              <tr key={version.fullVersion}>
                <td>{version.version}</td>
                <td>{version.fullVersion}</td>
                <td>{version.type}</td>
                <td>{version.instanceCount}</td>
                <td>
                  <Button
                    label="Uninstall"
                    onClick={() =>
                      appState.openModalOverlay(
                        <UninstallServerModal
                          serverVersion={version}
                          closeModal={appState.closeModalOverlay}
                        />
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={styles.header}>
          Instances
          <div className={styles.headerActions}>
            <Button
              label="Refresh"
              icon={<RefreshSmallIcon />}
              onClick={() => system.fetchInstances()}
              loading={system.fetchingInstances}
            />
            <Button
              label="Upgrade All Instances"
              onClick={() =>
                appState.openModalOverlay(
                  <UpgradeAllInstancesModal
                    closeModal={appState.closeModalOverlay}
                  />
                )
              }
            />
            <Button
              label="Create New Instance"
              icon={<PlusSmallIcon />}
              onClick={() =>
                appState.openModalOverlay(
                  <NewInstanceModal closeModal={appState.closeModalOverlay} />
                )
              }
            />
          </div>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Version</th>
              <th>Port</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {appState.system.instances.map((instance) => (
              <tr key={instance.$modelId}>
                <td>{instance.name}</td>
                <td>{instance.version}</td>
                <td>{instance.port}</td>
                <td>
                  <InstanceStatus instance={instance} />
                </td>
                <td>
                  <Button
                    label={instance.status === "running" ? "Restart" : "Start"}
                    disabled={!!instance.actionInProgress}
                    onClick={() => {
                      if (instance.status === "running") {
                        instance.restartInstance();
                      } else {
                        instance.startInstance();
                      }
                    }}
                    loading={
                      instance.actionInProgress === "starting" ||
                      instance.actionInProgress === "restarting"
                    }
                  />
                  <Button
                    label="Stop"
                    disabled={
                      !!instance.actionInProgress ||
                      instance.status !== "running"
                    }
                    onClick={() => {
                      instance.stopInstance();
                    }}
                    loading={instance.actionInProgress === "stopping"}
                  />
                  <Button
                    label="View Logs"
                    disabled={!!instance.actionInProgress}
                    onClick={() => {
                      settings.showLogs(instance.name);
                    }}
                  />
                  <Button
                    label="Upgrade"
                    disabled={!!instance.actionInProgress}
                    onClick={() =>
                      appState.openModalOverlay(
                        <UpgradeInstanceModal
                          instance={instance}
                          closeModal={appState.closeModalOverlay}
                        />
                      )
                    }
                  />
                  <Button
                    label="Destroy"
                    disabled={!!instance.actionInProgress}
                    onClick={() =>
                      appState.openModalOverlay(
                        <DestroyInstanceModal
                          instance={instance}
                          closeModal={appState.closeModalOverlay}
                        />
                      )
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {settings.showingLogs ? (
        <InstanceLogsViewer logs={settings.showingLogs} />
      ) : null}
    </div>
  );
});

interface InstanceLogsViewerProps {
  logs: InstanceLogs;
}

const InstanceLogsViewer = observer(function InstanceLogsViewer({
  logs,
}: InstanceLogsViewerProps) {
  const settings = useAppState().settingsTab;

  return (
    <div className={styles.logsViewer}>
      <div className={styles.logsViewerHeader}>
        Logs&nbsp;
        <div className={styles.instanceName}>{logs.instanceName}</div>
        <div
          style={{marginLeft: "auto"}}
          onClick={() => settings.showLogs(null)}
        >
          Close
        </div>
      </div>
      <div className={styles.logsData}>{logs.logData}</div>
    </div>
  );
});
