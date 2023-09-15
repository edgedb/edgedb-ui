import {useState, useEffect} from "react";

import cn from "../../utils/classNames";
import {useTheme, Theme} from "../../hooks/useTheme";

import {LightThemeIcon, DarkThemeIcon, SystemThemeIcon} from "./icons";

import styles from "./themeSwitcher.module.scss";

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

  const isFullyOpen = openProgress === 4;

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
        onTransitionEnd={() => {
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
          <div className={styles.tooltip}>Light</div>
        </div>
        <div
          className={cn(styles.button, {
            [styles.active]: theme === Theme.dark,
          })}
          onClick={() => setTheme(Theme.dark)}
        >
          <DarkThemeIcon />
          <div className={styles.tooltip}>Dark</div>
        </div>
        <div
          className={cn(styles.button, {
            [styles.active]: theme === Theme.system,
          })}
          onClick={() => setTheme(Theme.system)}
        >
          <SystemThemeIcon />
          <div className={styles.tooltip}>System</div>
        </div>
      </div>
    </div>
  );
}
