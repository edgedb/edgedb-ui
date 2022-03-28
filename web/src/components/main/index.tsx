import {observer} from "mobx-react";

import {useAppState, databaseContext} from "src/state/providers";
import {PageType} from "src/state/models/app";

import InstancePage from "../instancePage";
import DatabasePage from "../databasePage";

export default observer(function Main() {
  const appState = useAppState();

  switch (appState.currentPageId) {
    case PageType.Instance:
      return <InstancePage />;
    default:
      if (appState.currentPage) {
        return (
          <databaseContext.Provider value={appState.currentPage}>
            <DatabasePage key={appState.currentPage.$modelId} />
          </databaseContext.Provider>
        );
      } else {
        return <div>Error: Cannot find tab</div>;
      }
  }
});
