import {useNavigate, useRoutes} from "react-router-dom";
import {observer} from "mobx-react-lite";

import {HeaderTab} from "@edgedb/studio/components/headerTabs";
import {HeaderInstanceIcon} from "@edgedb/studio/icons";

import {useAppState} from "src/state/providers";

import InstancePage from "../instancePage";
import DatabasePage from "../databasePage";

export default observer(function Main() {
  const appState = useAppState();
  const navigate = useNavigate();

  return (
    <>
      <HeaderTab
        depth={0}
        title={appState.instanceState.instanceName ?? ""}
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
