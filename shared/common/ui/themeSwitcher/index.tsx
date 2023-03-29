import {useState, useEffect} from "react";

import cn from "../../utils/classNames";
import {useTheme, Theme} from "../../hooks/useTheme";

import {LightThemeIcon, DarkThemeIcon, SystemThemeIcon} from "./icons";

import styles from "./themeSwitcher.module.scss";
import Tooltip, {tooltipLocation} from "../tooltip";

export interface ThemeSwitcherProps {
  className?: string;
}

export function ThemeSwitcher({className}: ThemeSwitcherProps) {
  const [theme, _, setTheme] = useTheme();

  const [popupOpen, setPopupOpen] = useState(false);
  const [openProgress, setOpenProgress] = useState(0);

  useEffect(() => {
    if (popupOpen) {
      window.addEventListener(
        "click",
        () => {
          setPopupOpen(false);
          setOpenProgress(0);
        },
        {
          capture: true,
          once: true,
        }
      );
    }
  });

  const isFullyOpen = openProgress === 5;

  return (
    <div className={cn(styles.themeSwitcher, className)}>
      <div className={styles.button} onClick={() => setPopupOpen(true)}>
        <LightThemeIcon className={styles.lightIcon} />
        <DarkThemeIcon className={styles.darkIcon} />
      </div>
      <div
        className={cn(styles.popup, {
          [styles.popupOpen]: popupOpen,
          [styles.fullyOpen]: isFullyOpen,
        })}
        onTransitionEnd={(e) => {
          if (popupOpen) {
            setOpenProgress(openProgress + 1);
          }
        }}
      >
        <div
          className={cn(styles.button, {
            [styles.active]: theme === Theme.light,
          })}
          onClick={() => setTheme(Theme.light)}
        >
          <LightThemeIcon />
          <Tooltip location={tooltipLocation.left}>Light</Tooltip>
        </div>
        <div
          className={cn(styles.button, {
            [styles.active]: theme === Theme.dark,
          })}
          onClick={() => setTheme(Theme.dark)}
        >
          <DarkThemeIcon />
          <Tooltip>Dark </Tooltip>
        </div>
        <div
          className={cn(styles.button, {
            [styles.active]: theme === Theme.system,
          })}
          onClick={() => setTheme(Theme.system)}
        >
          <SystemThemeIcon />
          <Tooltip location={tooltipLocation.right}>System</Tooltip>
        </div>
      </div>
    </div>
  );
}
