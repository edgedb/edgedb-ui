import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import {sysInfo} from "../../global";

import styles from "./tabBar.module.scss";

import {useAppState} from "../../state/providers";
import {SpecialTab} from "../../state/models/app";
import {TransactionState} from "../../state/models/connection";

import StatusRing from "../../ui/statusRing";
import {PlusIcon, SettingsIcon} from "../icons";

export default observer(function TabBar() {
  const appState = useAppState();

  const tabs = appState.tabs.map((tab) => {
    const connConfig = tab.connection.config;
    const [title, subtitle] =
      connConfig.type === "instance"
        ? [connConfig.instanceName, connConfig.database ?? "edgedb"]
        : [connConfig.database, connConfig.hostAndPort];
    const transaction = tab.connection.transaction;

    return (
      <div
        className={cn(styles.tab, {
          [styles.active]: appState.currentTab === tab,
          [styles.disconnected]: !tab.connection.isConnected,
        })}
        onClick={() => appState.setSelectedTabId(tab.$modelId)}
        key={tab.$modelId}
      >
        <StatusRing
          spinner={tab.connection.runningQuery}
          status={
            transaction
              ? transaction.state === TransactionState.InError
                ? "error"
                : "active"
              : undefined
          }
        />
        <div className={styles.title}>{title}</div>
        <div className={styles.subtitle}>{subtitle}</div>
      </div>
    );
  });

  return (
    <div
      className={styles.tabbar}
      style={{
        paddingTop: sysInfo.platform === "darwin" ? "36px" : undefined,
      }}
    >
      <div
        className={cn(styles.tab, styles.iconTab, {
          [styles.active]: appState.selectedTabId === SpecialTab.New,
        })}
        onClick={() => appState.setSelectedTabId(SpecialTab.New)}
      >
        <PlusIcon />
      </div>
      <div className={styles.tabs}>{tabs}</div>
      <div className={styles.globalControls}>
        <div
          className={cn(styles.tab, styles.iconTab, {
            [styles.active]: appState.selectedTabId === SpecialTab.Settings,
          })}
          onClick={() => appState.setSelectedTabId(SpecialTab.Settings)}
        >
          <SettingsIcon />
        </div>
      </div>
    </div>
  );
});
