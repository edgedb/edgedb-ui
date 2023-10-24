import {useState, useEffect} from "react";

import cn from "../../utils/classNames";
import {useTheme, Theme} from "../../hooks/useTheme";
import {CheckIcon, DropdownIcon} from "../icons";
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
      <div className={styles.switcher}>
        <div className={styles.button} onClick={() => setPopupOpen(true)}>
          <LightThemeIcon className={styles.lightIcon} />
          <DarkThemeIcon className={styles.darkIcon} />
          <p className={styles.themeLabel}>{theme}</p>
          <DropdownIcon className={styles.dropdownIcon} />
        </div>
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
          <p className={styles.themeLabel}>Light</p>
          {theme === Theme.light && <CheckIcon className={styles.checkIcon} />}
          <div className={styles.tooltip}>Light</div>
        </div>
        <div
          className={cn(styles.button, {
            [styles.active]: theme === Theme.dark,
          })}
          onClick={() => setTheme(Theme.dark)}
        >
          <DarkThemeIcon />
          <p className={styles.themeLabel}>Dark</p>
          {theme === Theme.dark && <CheckIcon className={styles.checkIcon} />}
          <div className={styles.tooltip}>Dark</div>
        </div>
        <div
          className={cn(styles.button, {
            [styles.active]: theme === Theme.system,
          })}
          onClick={() => setTheme(Theme.system)}
        >
          <SystemThemeIcon />
          <p className={styles.themeLabel}>System</p>
          {theme === Theme.system && (
            <CheckIcon className={styles.checkIcon} />
          )}
          <div className={styles.tooltip}>System</div>
        </div>
      </div>
    </div>
  );
}
