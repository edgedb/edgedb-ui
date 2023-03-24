import {observer} from "mobx-react";
import {useLocation, useNavigate, useParams} from "react-router-dom";

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
        headerKey="database"
        title={params.databaseName}
        icon={<HeaderDatabaseIcon />}
        selectedItemId={params.databaseName!}
        items={
          appState.instanceState.databases?.map((db) => ({
            id: db,
            label: db,
            action: () => navigate(`/${db}`),
          }))!
        }
        actions={[
          // {
          //   label: "Database settings",
          //   action: () => {
          //     appState.currentPage!.setCurrentTabId(
          //       DatabaseTab.Settings
          //     );
          //   },
          // },
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
          navigate(
            typeof path === "string"
              ? `/${path}`
              : {
                  pathname: path.path && `/${path.path}`,
                  search: path.searchParams?.toString(),
                },
            {
              replace,
            }
          );
        },
        locationKey: location.key,
        gotoInstancePage: () => navigate("/"),
      }}
    >
      {children}
    </DBRouterProvider>
  );
}
