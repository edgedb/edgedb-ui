import {observer} from "mobx-react";
import {useLocation, useNavigate, useParams, Link} from "react-router-dom";

import {
  InstanceState,
  InstanceStateContext,
} from "@edgedb/studio/state/instance";
import {HeaderTab} from "@edgedb/studio/components/headerNav";
import {
  HeaderNav,
  HeaderNavCol,
} from "@edgedb/studio/components/headerNav/elements";
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
import {authAdminTabSpec} from "@edgedb/studio/tabs/auth";

import {useAppState} from "src/state/providers";
import {PropsWithChildren, useState} from "react";

const tabs: DatabaseTabSpec[] = [
  dashboardTabSpec,
  replTabSpec,
  editorTabSpec,
  schemaTabSpec,
  dataviewTabSpec,
  authAdminTabSpec,
];

export default observer(function DatabasePage() {
  const appState = useAppState();
  const params = useParams();

  return (
    <>
      <HeaderTab headerKey="database">
        <HeaderNavMenu
          currentDB={params.databaseName}
          databases={appState.instanceState.databases}
          instanceState={appState.instanceState}
        />
      </HeaderTab>

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

function HeaderNavMenu({
  currentDB,
  databases,
  instanceState,
}: {
  currentDB: string | undefined;
  databases: string[] | null;
  instanceState: InstanceState;
}) {
  const navigate = useNavigate();
  const {openModal} = useModal();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedDB, setSelectedDB] = useState(currentDB);

  return (
    <HeaderNav
      icon={<HeaderDatabaseIcon />}
      title={currentDB ?? ""}
      dropdownOpen={dropdownOpen}
      setDropdownOpen={setDropdownOpen}
    >
      <HeaderNavCol<{to: string}>
        Link={Link as any}
        closeDropdown={() => setDropdownOpen(false)}
        itemGroups={[
          {
            header: "Databases",
            items:
              databases?.map((db) => ({
                key: db,
                label: db,
                selected: selectedDB === db,
                linkProps: {to: `/${db}`},
                onHover: () => setSelectedDB(db),
              })) ?? null,
          },
        ]}
        action={{
          label: "Create New Database",
          onClick: () =>
            openModal(
              <CreateDatabaseModal
                instanceState={instanceState}
                navigateToDB={(dbName) => navigate(`/${dbName}`)}
              />
            ),
        }}
      />
    </HeaderNav>
  );
}

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
