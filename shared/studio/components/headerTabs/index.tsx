"use client";

import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import {ObservableMap} from "mobx";
import {observer} from "mobx-react-lite";

import cn from "@edgedb/common/utils/classNames";

import {Select, SelectProps} from "@edgedb/common/ui/select";

import styles from "./headerTab.module.scss";

const HeaderTabsContext = createContext<ObservableMap<string, JSX.Element>>(
  null!
);

export function HeaderTabsProvider({children}: PropsWithChildren<{}>) {
  const [headerTabs] = useState(
    () => new ObservableMap<string, JSX.Element>()
  );

  return (
    <HeaderTabsContext.Provider value={headerTabs}>
      {children}
    </HeaderTabsContext.Provider>
  );
}

interface _HeaderTabProps {
  headerKey: string;
  icon: JSX.Element;
}

export type HeaderTabProps = _HeaderTabProps & SelectProps;

export function HeaderTab({
  headerKey,
  icon,
  title,
  ...selectProps
}: HeaderTabProps) {
  const headerTabs = useContext(HeaderTabsContext);

  useEffect(() => {
    headerTabs.set(
      headerKey,
      <Select
        key={headerKey}
        title={
          <>
            {icon}
            {title}
          </>
        }
        className={styles.tab}
        {...selectProps}
      />
    );

    return () => {
      headerTabs.delete(headerKey);
    };
  }, [headerKey, icon, title, selectProps]);

  return null;
}

interface HeaderTabsProps {
  keys: string[];
  className?: string;
}

export const HeaderTabs = observer(function HeaderTabs({
  keys,
  className,
}: HeaderTabsProps) {
  const headerTabs = useContext(HeaderTabsContext);

  const tabs: JSX.Element[] = [];
  for (const key of keys) {
    const el = headerTabs.get(key) ?? headerTabs.get(`${key}-fallback`);
    if (el) {
      if (tabs.length) {
        tabs.push(<TabSep key={tabs.length} />);
      }
      tabs.push(el);
    } else {
      break;
    }
  }

  return <div className={cn(styles.tabs, className)}>{tabs}</div>;
});

export function TabSep() {
  return (
    <svg
      width="8"
      height="17"
      viewBox="0 0 8 17"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={styles.tabSep}
    >
      <path
        d="M7.66602 0.78125L1.73828 16.2207H0.185547L6.12305 0.78125H7.66602Z"
        fill="currentColor"
      />
    </svg>
  );
}
