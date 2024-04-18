import {useEffect, useLayoutEffect} from "react";
import {observer} from "mobx-react-lite";
import "@fontsource-variable/roboto-flex";

import cn from "@edgedb/common/utils/classNames";
import CodeBlock from "@edgedb/common/ui/codeBlock";

import {useTabState} from "../../state";
import {useDBRouter} from "../../hooks/dbRoute";
import {DatabaseTabSpec} from "../../components/databasePage";
import {TabAIIcon} from "../../icons";

import {AIAdminState} from "./state";
import {ProvidersTab} from "./providers";
import {PlaygroundTab} from "./playground";
import {PromptsTab} from "./prompts";

import styles from "./aiAdmin.module.scss";

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
        <div className={styles.loadingSchema}>Loading schema...</div>
      ) : state.extEnabled ? (
        <AIAdminLayout />
      ) : (
        <div className={styles.extDisabled}>
          <h2>The AI extension is not enabled</h2>
          <p>To enable it add the following to your schema:</p>
          <CodeBlock code="using extension ai;" />
          <p>
            For more information check out the{" "}
            <a href="https://www.edgedb.com/p/ai-ext-docs" target="_blank">
              AI extension docs
            </a>
            .
          </p>
        </div>
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

  useEffect(() => {
    state.setLastSelectedTab(currentPath.slice(2).join("/"));
  }, [currentPath]);

  useLayoutEffect(() => {
    if (currentPath.length == 2 && state.lastSelectedTab) {
      navigate(`${currentPath.join("/")}/${state.lastSelectedTab}`, true);
    }
  }, []);

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
