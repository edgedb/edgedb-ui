import {useEffect} from "react";
import {useMatch, useRoutes, Link} from "react-router-dom";
import {observer} from "mobx-react-lite";

import {HeaderTab} from "@edgedb/studio/components/headerTabs";
import {HeaderInstanceIcon} from "@edgedb/studio/icons";

import {useAppState} from "src/state/providers";

import styles from "./main.module.scss";

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
      <HeaderTab
        link={Link}
        headerKey="instance"
        title={
          instanceName ?? <span className={styles.loading}>loading...</span>
        }
        icon={<HeaderInstanceIcon />}
        mainLink={"/"}
      />

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
