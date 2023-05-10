"use client";

import {useEffect, useReducer, useRef, useState} from "react";

import cn from "@edgedb/common/utils/classNames";

import styles from "./verticalTabBar.module.scss";
import {ChevronIcon} from "../icons";
import {ThemeSwitcher} from "../themeSwitcher";

export interface Tab {
  id: string;
  label: string;
  icon: (active: boolean) => JSX.Element;
  loading?: boolean;
}

export interface VerticalTabBarProps {
  className?: string;
  tabs: Tab[];
  selectedTabId: string;
  onTabChange: (tab: Tab) => void;
  noExpand?: boolean;
}

export function VerticalTabBar({
  className,
  tabs,
  selectedTabId,
  onTabChange,
  noExpand,
}: VerticalTabBarProps) {
  const [expanded, setExpanded] = useReducer(
    (_: any, val: boolean) => {
      localStorage.setItem("nebula_ui_tabbar_expanded", JSON.stringify(val));
      return val;
    },
    false,
    () => {
      if (noExpand) return false;
      try {
        return (
          JSON.parse(
            localStorage.getItem("nebula_ui_tabbar_expanded") ?? ""
          ) === true
        );
      } catch {
        return false;
      }
    }
  );
  const [showTabTooltips, setShowTabTooltips] = useState(false);
  const tabMouseEnterTimeout = useRef<NodeJS.Timeout | null>(null);
  const tabMouseLeaveTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "m" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const currentIndex = tabs.findIndex((tab) => tab.id === selectedTabId);
        if (currentIndex !== -1) {
          onTabChange(
            tabs[
              (tabs.length + currentIndex + (e.shiftKey ? -1 : 1)) %
                tabs.length
            ]
          );
        }
      }
    };

    window.addEventListener("keydown", listener);

    return () => {
      window.removeEventListener("keydown", listener);
    };
  }, [selectedTabId]);

  return (
    <div
      className={cn(styles.tabs, className, {
        [styles.expanded]: expanded,
        [styles.showTooltips]: !expanded && showTabTooltips,
      })}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(styles.tab, {
            [styles.tabSelected]: tab.id === selectedTabId,
          })}
          onClick={() => onTabChange(tab)}
          onMouseEnter={() => {
            if (tabMouseLeaveTimeout.current) {
              clearTimeout(tabMouseLeaveTimeout.current);
              tabMouseLeaveTimeout.current = null;
            }
            if (!tabMouseEnterTimeout.current) {
              tabMouseEnterTimeout.current = setTimeout(() => {
                setShowTabTooltips(true);
              }, 500);
            }
          }}
          onMouseLeave={() => {
            if (!tabMouseLeaveTimeout.current) {
              tabMouseLeaveTimeout.current = setTimeout(() => {
                if (tabMouseEnterTimeout.current) {
                  clearTimeout(tabMouseEnterTimeout.current);
                  tabMouseEnterTimeout.current = null;
                }
                setShowTabTooltips(false);
              }, 200);
            }
          }}
        >
          <div className={styles.tabInner}>
            <div className={styles.icon}>
              {tab.icon(tab.id === selectedTabId)}
            </div>
            <div className={styles.tabLabel}>{tab.label}</div>
          </div>
          <div className={styles.tabTooltip}>{tab.label}</div>
          {tab.loading != null ? (
            <div
              className={cn(styles.loadingDot, {
                [styles.active]: tab.loading,
              })}
            />
          ) : null}
        </div>
      ))}
      <div className={styles.actions}>
        <ThemeSwitcher />
        {!noExpand ? (
          <div
            className={styles.action}
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronIcon className={styles.expandIcon} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
