import {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react-lite";
import {
  Link,
  Navigate,
  useMatch,
  useNavigate,
  useResolvedPath,
  useRoutes,
} from "react-router-dom";
import {AnyModel, ModelClass} from "mobx-keystone";

import cn from "@edgedb/common/utils/classNames";

import {useInstanceState} from "../../state/instance";
import {DatabaseStateContext} from "../../state/database";

import styles from "./databasePage.module.scss";

export interface DatabaseTabSpec {
  path: string;
  label: string;
  icon: (active: boolean) => JSX.Element;
  state?: ModelClass<AnyModel>;
  element: JSX.Element;
}

interface DatabasePageProps {
  databaseName: string;
  tabs: DatabaseTabSpec[];
}

export default observer(function DatabasePageLoadingWrapper({
  databaseName,
  tabs,
}: DatabasePageProps) {
  const instanceState = useInstanceState();

  if (!instanceState?.databases) {
    return (
      <div className={cn(styles.card, styles.loadingState)}>
        Fetching instance info...
      </div>
    );
  }

  if (!instanceState?.databases.find((db) => db.name === databaseName)) {
    return (
      <div className={cn(styles.card, styles.errorState)}>
        The database '{databaseName}' does not exist.
        <Link to="..">Go back to database list</Link>
      </div>
    );
  }

  return <DatabasePageContent databaseName={databaseName} tabs={tabs} />;
});

const DatabasePageContent = observer(function DatabasePageContent({
  databaseName,
  tabs,
}: DatabasePageProps) {
  const instanceState = useInstanceState()!;

  const dbState = instanceState.getDatabasePageState(databaseName, tabs);

  return (
    <div className={styles.databasePage}>
      <TabBar tabs={tabs} />
      <div className={styles.tabContent}>
        <DatabaseStateContext.Provider value={dbState}>
          {useRoutes([
            ...tabs,
            {path: "*", element: <Navigate to="" replace />},
          ])}
        </DatabaseStateContext.Provider>
      </div>
    </div>
  );
});

interface TabBarProps {
  tabs: {
    path: string;
    label: string;
    icon: (active: boolean) => JSX.Element;
  }[];
}

function TabBar({tabs}: TabBarProps) {
  const navigate = useNavigate();

  const currentTabId =
    useMatch(`${useResolvedPath("").pathname}/:tabId/*`)?.params.tabId ?? "";

  const [showTabLabels, setShowTabLabels] = useState(false);
  const tabMouseEnterTimeout = useRef<NodeJS.Timeout | null>(null);
  const tabMouseLeaveTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "m" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const currentIndex = tabs.findIndex(
          (tab) => tab.path === currentTabId
        );
        if (currentIndex !== -1) {
          navigate(
            tabs[
              (tabs.length + currentIndex + (e.shiftKey ? -1 : 1)) %
                tabs.length
            ].path
          );
        }
      }
    };

    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [currentTabId]);

  return (
    <div className={styles.tabs}>
      <div
        className={cn(styles.tabs, {
          [styles.showLabels]: showTabLabels,
        })}
      >
        {tabs.map(({path, label, icon}) => (
          <div
            key={path}
            className={cn(styles.tab, {
              [styles.tabSelected]: path === currentTabId,
            })}
            onClick={() => navigate(path)}
            onMouseEnter={() => {
              if (tabMouseLeaveTimeout.current) {
                clearTimeout(tabMouseLeaveTimeout.current);
                tabMouseLeaveTimeout.current = null;
              }
              if (!tabMouseEnterTimeout.current) {
                tabMouseEnterTimeout.current = setTimeout(() => {
                  setShowTabLabels(true);
                }, 500);
              }
            }}
            onMouseLeave={() => {
              if (!tabMouseLeaveTimeout.current) {
                tabMouseLeaveTimeout.current = setTimeout(() => {
                  if (tabMouseEnterTimeout.current) {
                    clearTimeout(tabMouseEnterTimeout.current);
                    tabMouseEnterTimeout.current = null;
                  }
                  setShowTabLabels(false);
                }, 200);
              }
            }}
          >
            {icon(currentTabId === path)}
            <div className={styles.tabLabel}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
