import {useEffect} from "react";
import {observer} from "mobx-react-lite";

import cn from "@edgedb/common/utils/classNames";

import styles from "./authAdmin.module.scss";

import {DatabaseTabSpec} from "../../components/databasePage";

import {useTabState} from "../../state";

import {TabAuthIcon} from "../../icons";
import {AuthAdminState, _providersInfo} from "./state";

import CodeBlock from "@edgedb/common/ui/codeBlock";
import {CustomScrollbars} from "@edgedb/common/ui/customScrollbar";
import {WebhooksTab} from "./webhooks";

import {PanelTabs} from "@edgedb/common/newui/panelTabs";
import {ConfigTab} from "./config";
import {SMTPConfigTab} from "./smtp";
import {ProvidersTab} from "./providers";

export const AuthAdmin = observer(function AuthAdmin() {
  const state = useTabState(AuthAdminState);

  useEffect(() => {
    if (state.extEnabled) {
      state.refreshConfig();
    }
  }, [state.extEnabled]);

  return (
    <div
      className={cn(styles.authAdmin, {
        [styles.loaded]: state.extEnabled === true,
      })}
    >
      {state.extEnabled === null ? (
        <div className={styles.loadingSchema}>Loading schema...</div>
      ) : state.extEnabled ? (
        <CustomScrollbars
          className={styles.scrollWrapper}
          innerClass={styles.scrollContent}
        >
          <div className={styles.scrollContent}>
            <PanelTabs
              className={styles.tabs}
              tabs={[
                {id: "config", label: "Config"},
                {id: "webhooks", label: "Webhooks"},
                {id: "providers", label: "Providers / UI"},
                {id: "smtp", label: "SMTP"},
              ]}
              selectedTabId={state.selectedTab}
              setSelectedTabId={(id) => state.setSelectedTab(id)}
            />

            {state.selectedTab === "config" ? (
              <ConfigTab />
            ) : state.selectedTab === "providers" ? (
              <ProvidersTab />
            ) : state.selectedTab === "webhooks" ? (
              <WebhooksTab />
            ) : (
              <SMTPConfigTab />
            )}
          </div>
        </CustomScrollbars>
      ) : (
        <div className={styles.extDisabled}>
          <h2>The auth extension is not enabled</h2>
          <p>To enable it add the following to your schema:</p>
          <CodeBlock code="using extension auth;" />
          <p>
            For more information check out the{" "}
            <a href="https://www.edgedb.com/p/auth-ext-docs" target="_blank">
              auth extension docs
            </a>
          </p>
        </div>
      )}
    </div>
  );
});

export const authAdminTabSpec: DatabaseTabSpec = {
  path: "auth",
  label: "Auth Admin",
  icon: (active) => <TabAuthIcon active={active} />,
  usesSessionState: false,
  element: <AuthAdmin />,
  state: AuthAdminState,
};
