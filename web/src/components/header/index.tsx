import {observer} from "mobx-react";

import {HeaderTabs} from "@edgedb/studio/components/headerTabs";
import {SessionStateControls} from "@edgedb/studio/components/sessionState";
import {useTheme, Theme} from "@edgedb/common/hooks/useTheme";

import {useAppState} from "src/state/providers";

import {Logo} from "@edgedb/common/ui/icons/logo";
import {ThemeSwitcherIcon} from "@edgedb/common/ui/icons";

import styles from "./header.module.scss";

export default observer(function Header() {
  const appState = useAppState();
  const [theme, setTheme] = useTheme();

  return (
    <div className={styles.header}>
      <div className={styles.title}>
        <Logo className={styles.logo} />
        <div className={styles.subtitle}>Local</div>
      </div>

      <HeaderTabs />

      <SessionStateControls />

      <div
        className={styles.themeSwitcher}
        style={{marginLeft: "auto"}}
        onClick={() =>
          setTheme(theme === Theme.dark ? Theme.light : Theme.dark)
        }
      >
        <ThemeSwitcherIcon />
      </div>
    </div>
  );
});
