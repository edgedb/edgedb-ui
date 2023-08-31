"use client";

import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {ObservableMap} from "mobx";
import {observer} from "mobx-react-lite";

import cn from "@edgedb/common/utils/classNames";

import {SessionStateControls} from "../sessionState";

import styles from "./headerTab.module.scss";

export const HeaderTabsContext = createContext<
  ObservableMap<string, JSX.Element>
>(null!);

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

export interface HeaderTabProps extends SplitButtonProps {
  headerKey: string;
  icon: JSX.Element;
}

export function HeaderTab({headerKey, icon, title, ...props}: HeaderTabProps) {
  const headerTabs = useContext(HeaderTabsContext);

  useEffect(() => {
    headerTabs.set(
      headerKey,
      <SplitButton
        key={headerKey}
        title={
          <>
            {icon}
            {title}
          </>
        }
        {...props}
      />
    );

    return () => {
      headerTabs.delete(headerKey);
    };
  }, [headerKey, icon, title, props]);

  return null;
}

interface SplitButtonProps {
  link?: (
    props: PropsWithChildren<{to: string; className?: string}>
  ) => JSX.Element | null;
  title: string | JSX.Element;
  mainLink: string | null;
  selectedItemId?: string;
  items?: {label: string; link: string}[];
  actions?: {label: string; action: string | (() => void)}[];
}

function SplitButton({
  link,
  title,
  mainLink,
  selectedItemId,
  items = [],
  actions = [],
}: SplitButtonProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const Link =
    link ??
    (({to, children, ...props}: any) => (
      <a href={to} {...props}>
        {children}
      </a>
    ));

  const hasDropdown = items.length + actions.length > 0;

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
    <div className={styles.splitButton}>
      {mainLink ? (
        <Link className={styles.mainLink} to={mainLink}>
          {title}
        </Link>
      ) : (
        <div className={cn(styles.mainLink, styles.disabled)}>{title}</div>
      )}
      {hasDropdown ? (
        <>
          <div
            className={styles.dropdownArrow}
            onClick={() => setDropdownOpen(true)}
          >
            <DropdownIcon />
          </div>

          <div
            ref={dropdownRef}
            className={cn(styles.dropdown, {
              [styles.dropdownOpen]: dropdownOpen,
            })}
            onClick={(e) => setDropdownOpen(false)}
          >
            {items.map(({label, link}) => (
              <Link
                key={link}
                className={cn(styles.dropdownItem, {
                  [styles.dropdownItemSelected]: selectedItemId === link,
                })}
                to={link}
              >
                {label}
              </Link>
            ))}
            <div className={styles.dropdownActionsGroup}>
              {actions?.map(({label, action}, i) =>
                typeof action === "string" ? (
                  <Link key={i} className={styles.dropdownItem} to={action}>
                    {label}
                  </Link>
                ) : (
                  <div
                    key={i}
                    className={styles.dropdownItem}
                    onClick={() => action()}
                  >
                    {label}
                  </div>
                )
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
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

  return (
    <div className={cn(styles.tabs, className)}>
      {tabs}
      <SessionStateControls />
    </div>
  );
});

function DropdownIcon() {
  return (
    <svg
      width="8"
      height="12"
      viewBox="0 0 8 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.29297 0.292969C3.68359 -0.0976562 4.31641 -0.0976562 4.70703 0.292969L7.70703 3.29297C7.93652 3.52246 8.03125 3.83594 7.99121 4.13477C7.96289 4.34424 7.86816 4.54639 7.70703 4.70703C7.53613 4.87842 7.31836 4.97461 7.09473 4.99561C6.80859 5.02246 6.5127 4.92627 6.29297 4.70703L4 2.41455L1.70703 4.70703C1.31641 5.09766 0.683594 5.09766 0.292969 4.70703C-0.0976562 4.31689 -0.0976562 3.68359 0.292969 3.29297L3.29297 0.292969ZM4.70703 11.707L7.70703 8.70703C8.09766 8.31641 8.09766 7.68311 7.70703 7.29297C7.31641 6.90234 6.68359 6.90234 6.29297 7.29297L4 9.58545L1.70703 7.29297C1.31641 6.90234 0.683594 6.90234 0.292969 7.29297C0.117188 7.46875 0.0205078 7.69434 0.00292969 7.9248C-0.0185547 8.20508 0.078125 8.49268 0.292969 8.70703L3.29297 11.707C3.68359 12.0977 4.31641 12.0977 4.70703 11.707Z"
        fill="currentColor"
      />
    </svg>
  );
}

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
