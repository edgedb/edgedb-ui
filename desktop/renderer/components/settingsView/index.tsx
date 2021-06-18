import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import styles from "./settingsView.module.scss";

import {useAppState} from "../../state/providers";
import {SettingsViewType} from "../../state/models/settings";

import ServerSettingsView from "./server";

const views: {
  [id in SettingsViewType]: {
    label: string;
    content: JSX.Element;
  };
} = {
  [SettingsViewType.general]: {
    label: "General",
    content: <div className={styles._placeholderContent}>General</div>,
  },
  [SettingsViewType.servers]: {
    label: "Servers & Instances",
    content: <ServerSettingsView />,
  },
  [SettingsViewType.codeEditor]: {
    label: "Code Editor",
    content: <div className={styles._placeholderContent}>Code Editor</div>,
  },
};

export default observer(function SettingsView() {
  const appState = useAppState();

  const settingsState = appState.settingsTab;

  return (
    <div className={styles.settingsView}>
      <div className={styles.settingsHeader}>Settings</div>
      <div className={styles.tabs}>
        {Object.keys(views).map((viewId) => (
          <div
            className={cn(styles.tab, {
              [styles.selected]: settingsState.view === viewId,
            })}
            key={viewId}
            onClick={() => settingsState.setView(viewId as SettingsViewType)}
          >
            {views[viewId as SettingsViewType].label}
          </div>
        ))}
      </div>
      <div className={styles.content}>{views[settingsState.view].content}</div>
    </div>
  );
});
