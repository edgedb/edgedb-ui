import {useEffect, useRef, useState} from "react";

import cn from "../../utils/classNames";
import {useModal} from "../../hooks/useModal";
import {BaseTabBarProps} from "./interfaces";
import {ThemeSwitcher} from "../themeSwitcher";
import CloseButton from "../closeButton";
import styles from "./mobileNavTabs.module.scss";

export interface MobileNavTabsProps extends BaseTabBarProps {
  extraMenu?: JSX.Element;
}

const PaddingWidth = 36;
const TabWidth = 48;
const TabGap = 25;

export function MobileNavTabs({
  className,
  tabs,
  currentTabId,
  Link,
  extraMenu,
}: MobileNavTabsProps) {
  const {openModal} = useModal();
  const modalDisposer = useRef<null | (() => void)>(null);
  const windowWidth = useWindowWidth();

  const maxTabs = Math.floor(
    (windowWidth - PaddingWidth - TabWidth) / (TabWidth + TabGap)
  );

  useEffect(() => {
    return () => modalDisposer.current?.();
  }, []);

  return (
    <div className={cn(styles.tabbar, className)}>
      <div className={styles.tabs}>
        {tabs.slice(0, maxTabs).map((tab) => (
          <Link
            key={tab.id}
            to={tab.id}
            className={cn(styles.tab, {
              [styles.selected]: currentTabId === tab.id,
            })}
          >
            <div className={styles.icon}>
              {tab.icon(currentTabId === tab.id)}
            </div>
            <div className={styles.label}>{tab.shortLabel ?? tab.label}</div>
          </Link>
        ))}
      </div>
      <div
        className={styles.menuButton}
        onClick={() =>
          (modalDisposer.current = openModal(
            <MobileMenu
              tabs={tabs}
              currentTabId={currentTabId}
              Link={Link}
              extraMenu={extraMenu}
            />
          ))
        }
      >
        <EllipsisIcon />
      </div>
    </div>
  );
}

function MobileMenu({tabs, Link, extraMenu}: MobileNavTabsProps) {
  const {openModal} = useModal();
  const closeModal = () => openModal(null);

  return (
    <div className={styles.container}>
      <div
        className={cn(styles.menuPopup, {
          [styles.extraPaddingTop]: !extraMenu,
        })}
      >
        {extraMenu}
        <div
          className={cn(styles.menuTabsList, {[styles.showSep]: !!extraMenu})}
        >
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              to={tab.id}
              className={cn(styles.menuTabWrapper)}
            >
              <div className={styles.menuTab} onClick={closeModal}>
                <div className={styles.icon}>{tab.icon(true)}</div>
                {tab.label}
              </div>
            </Link>
          ))}
        </div>
        <ThemeSwitcher className={styles.themeSwitcher} />
        <CloseButton onClick={closeModal} className={styles.closeBtn} />
      </div>
    </div>
  );
}

function useWindowWidth() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const listener = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", listener);

    return () => {
      window.removeEventListener("resize", listener);
    };
  }, []);

  return windowWidth;
}

function EllipsisIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="49"
      height="60"
      viewBox="0 0 49 60"
      fill="none"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16.5 30C16.5 32.2091 14.7091 34 12.5 34C10.2909 34 8.5 32.2091 8.5 30C8.5 27.7909 10.2909 26 12.5 26C14.7091 26 16.5 27.7909 16.5 30ZM28.5 30C28.5 32.2091 26.7091 34 24.5 34C22.2909 34 20.5 32.2091 20.5 30C20.5 27.7909 22.2909 26 24.5 26C26.7091 26 28.5 27.7909 28.5 30ZM36.5 34C38.7091 34 40.5 32.2091 40.5 30C40.5 27.7909 38.7091 26 36.5 26C34.2909 26 32.5 27.7909 32.5 30C32.5 32.2091 34.2909 34 36.5 34Z"
      />
    </svg>
  );
}
