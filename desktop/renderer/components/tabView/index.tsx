import {observer} from "mobx-react";

import styles from "./tabView.module.scss";

import {useAppState, useTabState} from "../../state/providers";
import {ViewType} from "../../state/models/tab";
import {TransactionState} from "../../state/models/connection";

import SegmentedButtons from "../../ui/segmentedButtons";
import StatusLabel from "../../ui/statusLabel";

import DisconnectedOverlay from "./disconnected";

import ReplView from "../repl";
import SchemaView from "../schema";
import {CloseIcon} from "../icons";

const views: {
  [id in ViewType]: {
    label: string;
    content: JSX.Element;
  };
} = {
  [ViewType.repl]: {
    label: "Repl",
    content: <ReplView />,
  },
  [ViewType.data]: {
    label: "Data",
    content: <div className={styles.card}>Data</div>,
  },
  [ViewType.schema]: {
    label: "Schema",
    content: <SchemaView />,
  },
};

const buttons = Object.entries(views).map(([id, {label}]) => ({
  id: id as ViewType,
  label,
}));

export default observer(function TabView() {
  const appState = useAppState();
  const tabState = useTabState();

  const connConfig = tabState.connection.config;

  return (
    <div className={styles.tabView}>
      <div className={styles.header}>
        <div className={styles.headerDetails}>
          <CloseIcon
            className={styles.closeIcon}
            onClick={() => appState.closeTab(tabState)}
          />

          <div className={styles.tabName}>
            {connConfig.type === "instance" ? (
              <>
                <div className={styles.primaryName}>
                  {connConfig.instanceName}
                </div>
                {connConfig.database ? (
                  <div className={styles.secondaryName}>
                    <span> </span>
                    {connConfig.database}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className={styles.secondaryName}>
                  {connConfig.user}
                  <span> @ </span>
                  {connConfig.hostAndPort}
                  <span> / </span>
                </div>
                <div className={styles.primaryName}>{connConfig.database}</div>
              </>
            )}
          </div>

          {tabState.connection.transaction ? (
            tabState.connection.transaction.state ===
            TransactionState.InError ? (
              <StatusLabel label="Transaction In Error" status="error" />
            ) : (
              <StatusLabel label="In Transaction" />
            )
          ) : null}
        </div>

        <SegmentedButtons
          className={styles.viewSwitcher}
          buttons={buttons}
          selected={tabState.view}
          onClick={(view) => tabState.setView(view)}
        />
      </div>

      {views[tabState.view].content}

      {!tabState.connection.isConnected ? <DisconnectedOverlay /> : null}
    </div>
  );
});
