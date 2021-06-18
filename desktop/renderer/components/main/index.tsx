import {observer} from "mobx-react";

import {useAppState, tabContext} from "../../state/providers";
import {SpecialTab} from "../../state/models/app";

import TabView from "../tabView";
import NewConnectionView from "../newConnection";
import SettingsView from "../settingsView";

export default observer(function Main() {
  const appState = useAppState();

  switch (appState.selectedTabId) {
    case SpecialTab.New:
      return <NewConnectionView />;
    case SpecialTab.Settings:
      return <SettingsView />;
    default:
      if (appState.currentTab) {
        return (
          <tabContext.Provider value={appState.currentTab}>
            <TabView key={appState.currentTab.$modelId} />
          </tabContext.Provider>
        );
      } else {
        return <div>Error: Cannot find tab</div>;
      }
  }
});
