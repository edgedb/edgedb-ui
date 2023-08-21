import {useEffect, useRef, useState} from "react";

import cn from "../../utils/classNames";
import {useModal} from "../../hooks/useModal";
import {ModalOverlay} from "../modal";

import {BaseTabBarProps} from "./interfaces";

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
      ></div>
    </div>
  );
}

function MobileMenu({tabs, Link, extraMenu}: MobileNavTabsProps) {
  const {openModal} = useModal();

  return (
    <ModalOverlay onOverlayClick={() => openModal(null)}>
      <div className={styles.menuPopup} onClick={() => openModal(null)}>
        {extraMenu}
        <div
          className={cn(styles.menuTabsList, {[styles.showSep]: !!extraMenu})}
        >
          {tabs.map((tab) => (
            <Link key={tab.id} to={tab.id} className={cn(styles.menuTab)}>
              <div className={styles.icon}>{tab.icon(true)}</div>
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
    </ModalOverlay>
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
