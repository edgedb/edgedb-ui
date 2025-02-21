import {lazy, Suspense} from "react";
import {observer} from "mobx-react-lite";

import CodeBlock from "@edgedb/common/ui/codeBlock";
import Spinner from "@edgedb/common/ui/spinner";

import {useDatabaseState} from "../../state";

import {DatabaseTabSpec} from "../../components/databasePage";
import {TabAuthIcon} from "../../icons";

import styles from "../../components/lazyTabs/lazyTabs.module.scss";

const AuthAdmin = lazy(() => import("./auth"));

const AuthAdminLoader = observer(function AuthAdminLoader() {
  const db = useDatabaseState();

  const extEnabled =
    db.schemaData?.extensions.some((ext) => ext.name === "auth") ?? null;

  return (
    <div className={styles.tabWrapper}>
      {extEnabled === null ? (
        <div className={styles.loadingSchema}>Loading schema...</div>
      ) : extEnabled ? (
        <Suspense
          fallback={<Spinner className={styles.fallbackSpinner} size={20} />}
        >
          <AuthAdmin />
        </Suspense>
      ) : (
        <div className={styles.extDisabled}>
          <h2>The auth extension is not enabled</h2>
          <p>To enable it add the following to your schema:</p>
          <CodeBlock code="using extension auth;" />
          <p>
            For more information check out the{" "}
            <a href="https://www.geldata.com/p/auth-ext-docs" target="_blank">
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
  element: <AuthAdminLoader />,
};
