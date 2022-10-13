import {observer} from "mobx-react";
import {useNavigate, useParams} from "react-router-dom";

import {InstanceStateContext} from "@edgedb/studio/state/instance";
import {HeaderTab} from "@edgedb/studio/components/headerTabs";
import {HeaderDatabaseIcon} from "@edgedb/studio/icons";

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
        depth={1}
        title={params.databaseName}
        icon={<HeaderDatabaseIcon />}
        selectedItemIndex={
          appState.instanceState.databases?.indexOf(params.databaseName!)!
        }
        items={
          appState.instanceState.databases?.map((db) => ({
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
                  dbPagePathPrefix={`/`}
                />
              );
            },
          },
        ]}
      />

      <InstanceStateContext.Provider value={appState.instanceState}>
        <DatabasePageContent databaseName={params.databaseName!} tabs={tabs} />
      </InstanceStateContext.Provider>
    </>
  );
});
