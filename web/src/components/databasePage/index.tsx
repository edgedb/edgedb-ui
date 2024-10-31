import {PropsWithChildren, useState} from "react";
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
import CreateBranchModal from "@edgedb/studio/components/modals/createBranch";

import DatabasePageContent, {
  DatabaseTabSpec,
} from "@edgedb/studio/components/databasePage";

import {dashboardTabSpec} from "@edgedb/studio/tabs/dashboard";
import {replTabSpec} from "@edgedb/studio/tabs/repl";
import {editorTabSpec} from "@edgedb/studio/tabs/queryEditor";
import {schemaTabSpec} from "@edgedb/studio/tabs/schema";
import {dataviewTabSpec} from "@edgedb/studio/tabs/dataview";
import {authAdminTabSpec} from "@edgedb/studio/tabs/auth";
import {aiTabSpec} from "@edgedb/studio/tabs/ai";

import {useAppState} from "../../state/providers";

const tabs: DatabaseTabSpec[] = [
  dashboardTabSpec,
  replTabSpec,
  editorTabSpec,
  schemaTabSpec,
  dataviewTabSpec,
  authAdminTabSpec,
  aiTabSpec,
];

export const DatabasePage = observer(function DatabasePage() {
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
        Link={Link}
        closeDropdown={() => setDropdownOpen(false)}
        itemGroups={[
          {
            header: "Branches",
            items:
              databases?.map((db) => ({
                key: db,
                label: db,
                selected: selectedDB === db,
                checked: currentDB === db,
                linkProps: {to: `/${encodeURIComponent(db)}`},
                onHover: () => setSelectedDB(db),
              })) ?? null,
          },
        ]}
        action={{
          label: "Create New Branch",
          onClick: () =>
            openModal(
              <CreateBranchModal
                fromBranch={currentDB}
                instanceState={instanceState}
                navigateToDB={(dbName) =>
                  navigate(`/${encodeURIComponent(dbName)}`)
                }
              />,
              true
            ),
        }}
      />
    </HeaderNav>
  );
}

function RouterProvider({children}: PropsWithChildren<unknown>) {
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
