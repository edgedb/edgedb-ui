import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import {useAppState} from "src/state/providers";
import {DatabaseTab} from "src/state/models/database";

import Repl from "src/components/repl";
import Schema from "src/components/schema";
import DataView from "src/components/dataView";
import DatabaseDashboard from "../databaseDashboard";

import styles from "./databasePage.module.scss";
import {
  TabDashboardIcon,
  TabReplIcon,
  TabSchemaIcon,
  TabDataExplorerIcon,
} from "src/ui/icons";

const views: {
  [id in DatabaseTab]: {
    label: string;
    icon?: JSX.Element;
    content: JSX.Element;
  };
} = {
  [DatabaseTab.Dashboard]: {
    label: "Dashboard",
    icon: <TabDashboardIcon />,
    content: <DatabaseDashboard />,
  },
  [DatabaseTab.Repl]: {
    label: "REPL",
    icon: <TabReplIcon />,
    content: <Repl />,
  },
  [DatabaseTab.Schema]: {
    label: "Schema",
    icon: <TabSchemaIcon />,
    content: <Schema />,
  },
  [DatabaseTab.Data]: {
    label: "Data Explorer",
    icon: <TabDataExplorerIcon />,
    content: <DataView />,
  },
  [DatabaseTab.Settings]: {
    label: "Settings",
    content: <div className={styles.card}>Settings</div>,
  },
};

export default observer(function DatabasePage() {
  const appState = useAppState();

  return (
    <div className={styles.databasePage}>
      <div className={styles.tabs}>
        {Object.values(DatabaseTab).map((tabId) => (
          <div
            key={tabId}
            className={cn(styles.tab, {
              [styles.tabSelected]:
                appState.currentPage!.currentTabId === tabId,
              [styles.settingsTab]: tabId === DatabaseTab.Settings,
            })}
            onClick={() => appState.currentPage!.setCurrentTabId(tabId)}
          >
            {views[tabId].icon ?? tabId}
          </div>
        ))}
      </div>
      <div className={styles.tabContent}>
        {views[appState.currentPage!.currentTabId].content}
      </div>
    </div>
  );
});
