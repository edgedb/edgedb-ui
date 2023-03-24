import {useEffect} from "react";
import {useMatch, useNavigate, useRoutes} from "react-router-dom";
import {observer} from "mobx-react-lite";

import {HeaderTab} from "@edgedb/studio/components/headerTabs";
import {HeaderInstanceIcon} from "@edgedb/studio/icons";

import {useAppState} from "src/state/providers";

import styles from "./main.module.scss";

import InstancePage from "../instancePage";
import DatabasePage from "../databasePage";

export default observer(function Main() {
  const appState = useAppState();
  const navigate = useNavigate();
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
        headerKey="instance"
        title={
          instanceName ?? <span className={styles.loading}>loading...</span>
        }
        icon={<HeaderInstanceIcon />}
        mainAction={() => navigate("/")}
        items={null}
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
