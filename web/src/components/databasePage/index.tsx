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
  TabSettingsIcon,
} from "src/ui/icons";
import {useEffect} from "react";

const views: {
  [id in DatabaseTab]: {
    label: string;
    icon: (active: boolean) => JSX.Element;
    content: JSX.Element;
  };
} = {
  [DatabaseTab.Dashboard]: {
    label: "Dashboard",
    icon: (active) => <TabDashboardIcon active={active} />,
    content: <DatabaseDashboard />,
  },
  [DatabaseTab.Repl]: {
    label: "REPL",
    icon: (active) => <TabReplIcon active={active} />,
    content: <Repl />,
  },
  [DatabaseTab.Schema]: {
    label: "Schema",
    icon: (active) => <TabSchemaIcon active={active} />,
    content: <Schema />,
  },
  [DatabaseTab.Data]: {
    label: "Data Explorer",
    icon: (active) => <TabDataExplorerIcon active={active} />,
    content: <DataView />,
  },
  [DatabaseTab.Settings]: {
    label: "Settings",
    icon: (active) => <TabSettingsIcon active={active} />,
    content: <div className={styles.card}>Settings</div>,
  },
};

const tabsOrder = [
  DatabaseTab.Dashboard,
  DatabaseTab.Repl,
  DatabaseTab.Schema,
  DatabaseTab.Data,
];

export default observer(function DatabasePage() {
  const appState = useAppState();

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "m" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const currentIndex = tabsOrder.indexOf(
          appState.currentPage!.currentTabId
        );
        if (currentIndex !== -1) {
          appState.currentPage!.setCurrentTabId(
            tabsOrder[
              (tabsOrder.length + currentIndex + (e.shiftKey ? -1 : 1)) %
                tabsOrder.length
            ]
          );
        }
      }
    };

    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, []);

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
            {views[tabId].icon(appState.currentPage!.currentTabId === tabId)
              ?? tabId}
          </div>
        ))}
      </div>
      <div className={styles.tabContent}>
        {views[appState.currentPage!.currentTabId].content}
      </div>
    </div>
  );
});
