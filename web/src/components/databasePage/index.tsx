import {observer} from "mobx-react";
import {useLocation, useNavigate, useParams, Link} from "react-router-dom";

import {InstanceStateContext} from "@edgedb/studio/state/instance";
import {HeaderTab} from "@edgedb/studio/components/headerTabs";
import {HeaderDatabaseIcon} from "@edgedb/studio/icons";

import {DBRouterProvider} from "@edgedb/studio/hooks/dbRoute";
import {useModal} from "@edgedb/common/hooks/useModal";
import CreateDatabaseModal from "@edgedb/studio/components/modals/createDatabase";

import DatabasePageContent, {
  DatabaseTabSpec,
} from "@edgedb/studio/components/databasePage";

import {dashboardTabSpec} from "@edgedb/studio/tabs/dashboard";
import {replTabSpec} from "@edgedb/studio/tabs/repl";
import {editorTabSpec} from "@edgedb/studio/tabs/queryEditor";
import {schemaTabSpec} from "@edgedb/studio/tabs/schema";
import {dataviewTabSpec} from "@edgedb/studio/tabs/dataview";

import {useAppState} from "src/state/providers";
import {PropsWithChildren} from "react";

const tabs: DatabaseTabSpec[] = [
  dashboardTabSpec,
  replTabSpec,
  editorTabSpec,
  schemaTabSpec,
  dataviewTabSpec,
];

export default observer(function DatabasePage() {
  const appState = useAppState();
  const params = useParams();
  const navigate = useNavigate();
  const {openModal} = useModal();

  return (
    <>
      <HeaderTab
        link={Link}
        headerKey="database"
        title={params.databaseName ?? ""}
        mainLink={null}
        icon={<HeaderDatabaseIcon />}
        selectedItemId={`/${params.databaseName}`}
        items={
          appState.instanceState.databases?.map((db) => ({
            label: db,
            link: `/${db}`,
          }))!
        }
        actions={[
          {
            label: "Create new database",
            action: () => {
              openModal(
                <CreateDatabaseModal
                  instanceState={appState.instanceState}
                  navigateToDB={(dbName) => navigate(`/${dbName}`)}
                />
              );
            },
          },
        ]}
      />

      <InstanceStateContext.Provider value={appState.instanceState}>
        <RouterProvider>
          <DatabasePageContent
            databaseName={params.databaseName!}
            tabs={tabs}
          />
        </RouterProvider>
      </InstanceStateContext.Provider>
    </>
  );
});

function RouterProvider({children}: PropsWithChildren<{}>) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <DBRouterProvider
      value={{
        currentPath: location.pathname.slice(1).split("/"),
        searchParams: new URLSearchParams(location.search),
        navigate: (path, replace) => {
          const normalisedPath = (
            typeof path === "string" ? path : path.path
          )?.replace(/\/$/, "");
          const search =
            typeof path !== "string" && path.searchParams
              ? "?" + path.searchParams.toString()
              : undefined;
          if (
            (normalisedPath != null &&
              normalisedPath !== location.pathname.replace(/^\/|\/$/g, "")) ||
            (search != null && search !== location.search)
          ) {
            navigate(
              typeof path === "string"
                ? `/${path}`
                : {
                    pathname: path.path && `/${path.path}`,
                    search,
                  },
              {
                replace,
              }
            );
          }
        },
        locationKey: location.key,
        gotoInstancePage: () => navigate("/"),
      }}
    >
      {children}
    </DBRouterProvider>
  );
}
