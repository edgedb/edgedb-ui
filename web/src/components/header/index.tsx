import {useEffect, useRef, useState} from "react";
import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import {useAppState} from "src/state/providers";
import {PageType, Theme} from "src/state/models/app";
import {DatabaseTab} from "src/state/models/database";

import {Logo} from "src/ui/icons/logo";
import {HeaderDatabaseIcon, HeaderInstanceIcon} from "src/ui/icons";

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
          mainAction={() => appState.setCurrentPageId(PageType.Instance)}
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
              dropdownList={appState.instanceState.databases.map((db) => ({
                label: db.name,
                action: () => appState.openDatabasePage(db.name),
              }))}
              dropdownActions={[
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
  title: string;
  icon: JSX.Element;
  mainAction?: () => void;
  selectedItemIndex?: number;
  dropdownList?: {label: string; action: () => void}[];
  dropdownActions?: {label: string; action: () => void}[];
}
function Tab({
  title,
  icon,
  mainAction,
  selectedItemIndex,
  dropdownList,
  dropdownActions,
}: TabProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const hasDropdown = !!dropdownList || !!dropdownActions;

  useEffect(() => {
    if (dropdownOpen) {
      const listener = (e: MouseEvent) => {
        if (!dropdownRef.current?.contains(e.target as Node)) {
          setDropdownOpen(false);
        }
      };

      window.addEventListener("click", listener, {capture: true});

      return () => {
        window.removeEventListener("click", listener, {capture: true});
      };
    }
  }, [dropdownOpen]);

  return (
    <div className={styles.tab}>
      {icon}
      <div className={styles.tabTitle} onClick={mainAction}>
        {title}
      </div>
      {hasDropdown ? (
        <>
          <div
            className={styles.tabDropdownButton}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <DropdownIcon />
          </div>

          <div
            ref={dropdownRef}
            className={cn(styles.tabDropdown, {
              [styles.tabDropdownOpen]: dropdownOpen,
            })}
          >
            {dropdownList?.map((item, i) => (
              <div
                key={i}
                className={cn(styles.dropdownItem, {
                  [styles.dropdownItemSelected]: selectedItemIndex === i,
                })}
                onClick={() => {
                  setDropdownOpen(false);
                  item.action();
                }}
              >
                {item.label}
              </div>
            ))}
            {/* {dropdownList.length && dropdownActions.length ? (
          <svg className={styles.dropdownItemSep}>
            <rect y="0.75" width="100%" height="1.5" rx="0.75" />
          </svg>
        ) : null} */}
            <div className={styles.dropdownActionsGroup}>
              {dropdownActions?.map((item, i) => (
                <div
                  key={i}
                  className={styles.dropdownItem}
                  onClick={() => {
                    setDropdownOpen(false);
                    item.action();
                  }}
                >
                  {item.label}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
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

function DropdownIcon() {
  return (
    <svg
      width="11"
      height="18"
      viewBox="0 0 11 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1 11.6591L5.5 16.1591L10 11.6591"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1 6.34088L5.5 1.84088L10 6.34088"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
