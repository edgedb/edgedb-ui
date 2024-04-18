import {useEffect, useLayoutEffect} from "react";
import {observer} from "mobx-react-lite";
import {DatabaseTabSpec} from "../../components/databasePage";
import {TabAIIcon} from "../../icons";
import {AIAdminState} from "./state";
import {useTabState} from "../../state";
import cn from "@edgedb/common/utils/classNames";

import styles from "./aiAdmin.module.scss";
import {useDBRouter} from "../../hooks/dbRoute";
import "@fontsource-variable/roboto-flex";
import {ProvidersTab} from "./providers";
import {PlaygroundTab} from "./playground";
import {PromptsTab} from "./prompts";

const AIAdminPage = observer(function AIAdminPage() {
  const state = useTabState(AIAdminState);

  useEffect(() => {
    if (state.extEnabled) {
      state.refreshConfig();
    }
  }, [state.extEnabled]);

  return (
    <div className={styles.aiAdmin}>
      {state.extEnabled === null ? (
        <div>loading...</div>
      ) : state.extEnabled ? (
        <AIAdminLayout />
      ) : (
        <div>ai ext not enabled</div>
      )}
    </div>
  );
});

export const aiTabSpec: DatabaseTabSpec = {
  path: "ai",
  label: "AI",
  icon: (active) => <TabAIIcon active={active} />,
  usesSessionState: false,
  element: <AIAdminPage />,
  allowNested: true,
  state: AIAdminState,
};

const aiAdminTabs = [
  {
    path: "",
    label: "Playground",
    element: <PlaygroundTab />,
  },
  {
    path: "prompts",
    label: "Prompts",
    element: <PromptsTab />,
  },
  {
    path: "providers",
    label: "Providers",
    element: <ProvidersTab />,
  },
];

function AIAdminLayout() {
  const state = useTabState(AIAdminState);
  const {navigate, currentPath} = useDBRouter();

  const activePath = currentPath.slice(2).join("/");

  useLayoutEffect(() => {
    const basePath = currentPath.slice(0, 2).join("/");
    if (currentPath.length == 2 && state.lastSelectedTab) {
      navigate(`${basePath}/${state.lastSelectedTab}`, true);
    }
  }, [currentPath]);

  return (
    <div className={styles.mainLayout}>
      <div className={styles.tabs}>
        {aiAdminTabs.map((tab) => (
          <div
            key={tab.path}
            className={cn(styles.tab, {
              [styles.active]: activePath === tab.path,
            })}
            onClick={() => {
              navigate(
                [...currentPath.slice(0, 2), tab.path]
                  .join("/")
                  .replace(/\/$/, "")
              );
            }}
          >
            {tab.label}
          </div>
        ))}
      </div>

      <div className={styles.tabContent}>
        {aiAdminTabs.find((tab) => tab.path === activePath)?.element}
      </div>
    </div>
  );
}
