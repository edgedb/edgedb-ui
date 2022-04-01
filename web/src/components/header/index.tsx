import {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import {useAppState} from "src/state/providers";
import {PageType, Theme} from "src/state/models/app";
import {DatabaseTab} from "src/state/models/database";

import {Logo} from "src/ui/icons/logo";
import {HeaderDatabaseIcon, HeaderInstanceIcon} from "src/ui/icons";
import {Select, SelectProps} from "src/ui/select";

import CreateDatabaseModal from "../modals/createDatabase";

import styles from "./header.module.scss";

export default observer(function Header() {
  const appState = useAppState();

  return (
    <div className={styles.header}>
      <div className={styles.title}>
        <Logo className={styles.logo} />
        <div className={styles.subtitle}>Studio</div>
      </div>

      <div className={styles.tabs}>
        <Tab
          title={appState.instanceState.instanceName ?? ""}
          icon={<HeaderInstanceIcon />}
          mainAction={
            appState.currentPage
              ? () => appState.setCurrentPageId(PageType.Instance)
              : undefined
          }
          items={null}
        />
        {appState.currentPage ? (
          <>
            <TabSep />
            <Tab
              title={appState.currentPage.name}
              icon={<HeaderDatabaseIcon />}
              selectedItemIndex={appState.instanceState.databases.findIndex(
                (db) => db.name === appState.currentPage!.name
              )}
              items={appState.instanceState.databases.map((db) => ({
                label: db.name,
                action: () => appState.openDatabasePage(db.name),
              }))}
              actions={[
                {
                  label: "Database settings",
                  action: () => {
                    appState.currentPage!.setCurrentTabId(
                      DatabaseTab.Settings
                    );
                  },
                },
                {
                  label: "Create new database",
                  action: () => {
                    appState.openModalOverlay(<CreateDatabaseModal />);
                  },
                },
              ]}
            />
          </>
        ) : null}
      </div>
      <div
        style={{marginLeft: "auto"}}
        onClick={() =>
          appState.setTheme(
            appState.theme === Theme.dark ? Theme.light : Theme.dark
          )
        }
      >
        Toggle theme
      </div>
    </div>
  );
});

interface TabProps {
  icon: JSX.Element;
}
function Tab({icon, ...selectProps}: TabProps & SelectProps) {
  return (
    <div className={styles.tab}>
      {icon}
      <Select titleClassName={styles.tabTitle} {...selectProps} />
    </div>
  );
}

function TabSep() {
  return (
    <svg
      width="16"
      height="30"
      viewBox="0 0 16 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={styles.tabSep}
    >
      <path
        d="M 1,29 L 15,1"
        stroke="#848484"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}
