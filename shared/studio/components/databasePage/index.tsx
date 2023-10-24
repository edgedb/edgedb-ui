import {observer} from "mobx-react-lite";
import {AnyModel, getTypeInfo, ModelClass, ModelTypeInfo} from "mobx-keystone";
import {ErrorBoundary, FallbackProps} from "react-error-boundary";

import cn from "@edgedb/common/utils/classNames";
import Button from "@edgedb/common/ui/button";
import {BaseTabBarProps} from "@edgedb/common/ui/navtabs/interfaces";
import {MobileNavTabs} from "@edgedb/common/ui/navtabs/mobile";
import {useIsMobile} from "@edgedb/common/hooks/useMobile";
import {VerticalTabBar} from "@edgedb/common/ui/verticalTabBar";

import {useInstanceState} from "../../state/instance";
import {DatabaseStateContext, useDatabaseState} from "../../state/database";
import {useDBRouter} from "../../hooks/dbRoute";

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
  tabsLoading?: boolean;
  mobileMenu?: JSX.Element;
}

export default observer(function DatabasePageLoadingWrapper(
  props: DatabasePageProps
) {
  const instanceState = useInstanceState();
  const {gotoInstancePage} = useDBRouter();

  if (!instanceState.databases) {
    return (
      <div className={cn(styles.card, styles.loadingState)}>
        Fetching instance info...
      </div>
    );
  }

  if (!instanceState.databases.includes(props.databaseName)) {
    return (
      <ErrorPage
        title="Database doesn't exist"
        actions={
          <Button
            className={styles.greenButton}
            label="Go back to database list"
            onClick={() => gotoInstancePage()}
            style="square"
            size="large"
          />
        }
      >
        The database '{props.databaseName}' does not exist.
      </ErrorPage>
    );
  }

  return <DatabasePageContent {...props} />;
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
  tabsLoading,
  mobileMenu,
}: DatabasePageProps) {
  const instanceState = useInstanceState();

  const dbState = instanceState.getDatabasePageState(databaseName, tabs);

  const {currentPath, navigate} = useDBRouter();
  const isMobile = useIsMobile();

  const currentTabId = currentPath[1] ?? "";
  const activeTab = tabs.find((tab) => tab.path === currentTabId);

  if (!activeTab && !tabsLoading) {
    navigate(currentPath[0], true);
  } else if (activeTab && !activeTab.allowNested && currentPath.length > 2) {
    navigate(currentPath.slice(0, 2).join("/"), true);
  }

  return (
    <DatabaseStateContext.Provider value={dbState}>
      <SessionStateButton />

      <div className={cn(styles.databasePage, {[styles.mobile]: isMobile})}>
        <SessionStateBar
          className={styles.sessionBar}
          active={tabs.find((t) => t.path === currentTabId)?.usesSessionState}
        />
        <TabBar
          tabs={tabs}
          hide={dbState.sessionState.panelOpen}
          isMobile={isMobile}
          mobileMenu={mobileMenu}
        />
        <div className={styles.tabContent}>
          {activeTab ? (
            <ErrorBoundary
              key={activeTab.path}
              FallbackComponent={ErrorFallback}
            >
              {activeTab.element}
            </ErrorBoundary>
          ) : null}
        </div>
      </div>
    </DatabaseStateContext.Provider>
  );
});

interface TabBarProps {
  tabs: DatabaseTabSpec[];
  isMobile: boolean;
  hide?: boolean;
  mobileMenu?: JSX.Element;
}

const TabBar = observer(function TabBar({
  tabs,
  isMobile,
  hide,
  mobileMenu,
}: TabBarProps) {
  const dbState = useDatabaseState();

  const {currentPath, navigate} = useDBRouter();

  const currentTabId = currentPath[1] ?? "";

  const props: BaseTabBarProps = {
    className: cn(styles.tabbar, {[styles.hide]: !!hide}),
    tabs: tabs.map((tab) => ({
      id: tab.path,
      icon: tab.icon,
      label: tab.label,
      loading:
        dbState.loadingTabs.get(
          (getTypeInfo(tab.state) as ModelTypeInfo).modelType
        ) === true,
    })),
    currentTabId: currentTabId,
    Link: ({to, ...props}) => (
      <a
        {...props}
        href={[
          ...(currentPath.length > 1
            ? Array(currentPath.length - 2).fill("..")
            : []),
          currentPath[0],
          to,
        ].join("/")}
        onClick={(e) => {
          e.preventDefault();
          navigate(`${currentPath[0]}/${to}`);
        }}
      />
    ),
  };

  return isMobile ? (
    <MobileNavTabs {...props} extraMenu={mobileMenu} />
  ) : (
    <VerticalTabBar
      {...props}
      onTabChange={(tab) => navigate(`${currentPath[0]}/${tab.id}`)}
    />
  );
});
