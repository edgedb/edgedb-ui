import {useEffect} from "react";
import {useMatch, useRoutes, Link} from "react-router-dom";
import {observer} from "mobx-react-lite";

import {HeaderTab} from "@edgedb/studio/components/headerNav";
import {HeaderInstanceIcon} from "@edgedb/studio/icons";

import {useAppState} from "src/state/providers";

import styles from "./main.module.scss";
import headerNavStyles from "@edgedb/studio/components/headerNav/headerNav.module.scss";

import InstancePage from "../instancePage";
import DatabasePage from "../databasePage";

export default observer(function Main() {
  const appState = useAppState();
  const match = useMatch(":databaseName/*");

  const instanceName = appState.instanceState.instanceName;

  useEffect(() => {
    document.title = instanceName
      ? `${instanceName}${
          match ? ` / ${match.params.databaseName}` : ""
        } | EdgeDB Local`
      : "EdgeDB Local";
  }, [instanceName, match]);

  return (
    <>
      <HeaderTab headerKey="instance">
        <Link className={headerNavStyles.headerNavButton} to={"/"}>
          <HeaderInstanceIcon />
          <div className={headerNavStyles.title}>
            {instanceName ?? (
              <span className={styles.loading}>loading...</span>
            )}
          </div>
        </Link>
      </HeaderTab>

      {useRoutes([
        {
          path: "/",
          element: <InstancePage />,
        },
        {
          path: ":databaseName/*",
          element: <DatabasePage />,
        },
      ])}
    </>
  );
});
