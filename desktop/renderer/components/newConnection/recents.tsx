import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import styles from "./newConnection.module.scss";

import {useAppState} from "../../state/providers";
import {ConnectionHistoryItem} from "../../state/models/newConnection/connectionHistory";

import {reverseMap} from "../../utils/reverseMap";

import {ConnectionScreenBlock} from "./common";

import Button from "../../ui/button";
import PopupMenu from "../../ui/popupMenu";
import {LocalConnectionIcon, ManualConnectionIcon} from "../icons";

export default observer(function RecentsBlock() {
  const appState = useAppState();

  const newConnTab = appState.newConnectionTab;
  const history = newConnTab.history;

  return (
    <ConnectionScreenBlock
      className={styles.recentsBlock}
      title="Recent Connections"
      actions={
        <>
          <Button
            className={styles.blockHeaderButton}
            label="Clear All"
            onClick={() => newConnTab.history.clearAll()}
          />
        </>
      }
    >
      <div className={styles.historyList}>
        {reverseMap(history.items, (item) => (
          <HistoryItemCard item={item} key={item.$modelId} />
        ))}
      </div>
    </ConnectionScreenBlock>
  );
});

const HistoryItemCard = observer(function HistoryItemCard({
  item,
}: {
  item: ConnectionHistoryItem;
}) {
  const appState = useAppState();
  const newConnTab = appState.newConnectionTab;

  const config = item.connectConfig.data;
  const id = `history-${item.hash}`;
  const pendingConn = newConnTab.pendingConnections.get(id);

  const instance =
    config.type === "instance"
      ? appState.system.instances.find(
          (inst) => inst.name === config.instanceName
        )
      : null;

  const connectStatus = pendingConn
    ? instance?.actionInProgress === "starting"
      ? "Starting..."
      : pendingConn.connecting
      ? "Connecting..."
      : null
    : null;

  return (
    <div
      className={cn(styles.historyListItem, {
        [styles.showButton]: !!connectStatus,
        [styles.errorRing]:
          !!pendingConn && newConnTab.latestFailedConnection === pendingConn,
      })}
    >
      <div className={styles.historyType}>
        {config.type === "instance" ? (
          <LocalConnectionIcon />
        ) : (
          <ManualConnectionIcon />
        )}
      </div>
      <div
        className={cn(styles.historyDetails, {
          [styles.manualDetails]: config.type === "manual",
        })}
      >
        {config.type === "manual" ? (
          <>
            <span
              className={styles.secondary}
            >{`${config.user} @ ${config.hostAndPort} / `}</span>
            <span className={styles.primary}>{config.database}</span>
          </>
        ) : (
          <>
            <span className={styles.primary}>{config.instanceName}</span>{" "}
            <span className={styles.secondary}>{config.database ?? ""}</span>
          </>
        )}
      </div>

      <Button
        className={styles.connectButton}
        onClick={() => newConnTab.createConnection(id, config)}
        colour="green"
        label={
          connectStatus ??
          (instance && instance.status !== "running"
            ? "Start & Connect"
            : "Connect")
        }
        loading={!!connectStatus}
      />

      <PopupMenu
        className={styles.popup}
        items={[
          {
            label: "Remove from Recent",
            action: () => newConnTab.history.deleteItem(item),
          },
          ...(config.type === "manual"
            ? [
                {
                  label: "Copy to Manual Connection",
                  action: () => {
                    newConnTab.manualConfigEditor.copyFromHistoryItem(item);
                    newConnTab.setShowManualConn(true);
                  },
                },
              ]
            : []),
        ]}
      />
    </div>
  );
});
