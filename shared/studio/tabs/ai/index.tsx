import {lazy, Suspense} from "react";
import {observer} from "mobx-react-lite";

import CodeBlock from "@edgedb/common/ui/codeBlock";
import Spinner from "@edgedb/common/ui/spinner";

import {useDatabaseState} from "../../state";

import {DatabaseTabSpec} from "../../components/databasePage";
import {TabAIIcon} from "../../icons";

import styles from "../../components/lazyTabs/lazyTabs.module.scss";

const AIAdminPage = lazy(() => import("./ai"));

const AuthAdminLoader = observer(function AuthAdminLoader() {
  const db = useDatabaseState();

  const extEnabled =
    db.schemaData?.extensions.some((ext) => ext.name === "ai") ?? null;

  return (
    <div className={styles.tabWrapper}>
      {extEnabled === null ? (
        <div className={styles.loadingSchema}>Loading schema...</div>
      ) : extEnabled ? (
        <Suspense
          fallback={<Spinner className={styles.fallbackSpinner} size={20} />}
        >
          <AIAdminPage />
        </Suspense>
      ) : (
        <div className={styles.extDisabled}>
          <h2>The AI extension is not enabled</h2>
          <p>To enable it add the following to your schema:</p>
          <CodeBlock code="using extension ai;" />
          <p>
            For more information check out the{" "}
            <a href="https://www.geldata.com/p/ai-ext-docs" target="_blank">
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
  element: <AuthAdminLoader />,
  allowNested: true,
};
