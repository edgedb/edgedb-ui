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
import {AnyModel, getTypeInfo, ModelClass, ModelTypeInfo} from "mobx-keystone";
import {ErrorBoundary, FallbackProps} from "react-error-boundary";

import cn from "@edgedb/common/utils/classNames";
import Button from "@edgedb/common/ui/button";

import {useInstanceState} from "../../state/instance";
import {DatabaseStateContext, useDatabaseState} from "../../state/database";

import styles from "./databasePage.module.scss";

import {SessionStateBar, SessionStateButton} from "../sessionState";
import {ErrorPage} from "../errorPage";
import {WarningIcon} from "../../icons";

export interface DatabaseTabSpec {
  path: string;
  allowNested?: boolean;
  label: string;
  icon: (active: boolean) => JSX.Element;
  usesSessionState: boolean;
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
  const navigate = useNavigate();
  const instanceState = useInstanceState();

  if (!instanceState.databases) {
    return (
      <div className={cn(styles.card, styles.loadingState)}>
        Fetching instance info...
      </div>
    );
  }

  if (!instanceState.databases.includes(databaseName)) {
    return (
      <ErrorPage
        title="Database doesn't exist"
        actions={
          <Button
            className={styles.greenButton}
            label="Go back to database list"
            onClick={() => navigate("..")}
            style="square"
            size="large"
          />
        }
      >
        The database '{databaseName}' does not exist.
      </ErrorPage>
    );
  }

  return <DatabasePageContent databaseName={databaseName} tabs={tabs} />;
});

function ErrorFallback({error}: FallbackProps) {
  const errorDetails = `${error.name}: ${error.message}\n\nTraceback:\n${error.stack}`;

  return (
    <div className={styles.errorFallback}>
      <h2>
        <WarningIcon />
        Something went wrong rendering this view
      </h2>
      <p>
        Please consider opening an issue at{" "}
        <a href="https://github.com/edgedb/edgedb-studio/issues/new">
          https://github.com/edgedb/edgedb-studio/issues/new
        </a>{" "}
        with the error details below.
      </p>
      <div className={styles.errorDetails}>
        Error Details:
        <button onClick={() => navigator.clipboard?.writeText(errorDetails)}>
          Copy
        </button>
      </div>
      <pre>{errorDetails}</pre>
    </div>
  );
}

const DatabasePageContent = observer(function DatabasePageContent({
  databaseName,
  tabs,
}: DatabasePageProps) {
  const instanceState = useInstanceState();

  const dbState = instanceState.getDatabasePageState(databaseName, tabs);

  const currentTabId =
    useMatch(`${useResolvedPath("").pathname}/:tabId/*`)?.params.tabId ?? "";

  return (
    <DatabaseStateContext.Provider value={dbState}>
      <SessionStateButton />

      <div className={styles.databasePage}>
        <SessionStateBar
          className={styles.sessionBar}
          active={tabs.find((t) => t.path === currentTabId)?.usesSessionState}
        />
        <TabBar tabs={tabs} hide={dbState.sessionState.panelOpen} />
        <div className={styles.tabContent}>
          {useRoutes([
            ...tabs.map((t) => ({
              path: t.path + (t.allowNested ? "/*" : ""),
              element: (
                <ErrorBoundary key={t.path} FallbackComponent={ErrorFallback}>
                  {t.element}
                </ErrorBoundary>
              ),
            })),
            {path: "*", element: <Navigate to="" replace />},
          ])}
        </div>
      </div>
    </DatabaseStateContext.Provider>
  );
});

interface TabBarProps {
  tabs: DatabaseTabSpec[];
  hide?: boolean;
}

const TabBar = observer(function TabBar({tabs, hide}: TabBarProps) {
  const navigate = useNavigate();
  const dbState = useDatabaseState();

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
    <div
      className={cn(styles.tabs, {
        [styles.showLabels]: showTabLabels,
        [styles.hide]: !!hide,
      })}
    >
      {tabs.map(({path, label, icon, state}) => (
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
          {state ? (
            <div
              className={cn(styles.loadingDot, {
                [styles.active]:
                  dbState.loadingTabs.get(
                    (getTypeInfo(state) as ModelTypeInfo).modelType
                  ) === true,
              })}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
});
