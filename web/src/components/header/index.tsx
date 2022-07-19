import {observer} from "mobx-react";

import {HeaderTabs} from "@edgedb/studio/components/headerTabs";
import {SessionStateControls} from "@edgedb/studio/components/sessionState";

import {Logo} from "@edgedb/common/ui/icons/logo";
import {ThemeSwitcher} from "@edgedb/common/ui/themeSwitcher";

import styles from "./header.module.scss";

export default observer(function Header() {
  return (
    <div className={styles.header}>
      <div className={styles.title}>
        <Logo className={styles.logo} />
        <div className={styles.subtitle}>Local</div>
      </div>

      <HeaderTabs />

      <SessionStateControls />

      <ThemeSwitcher className={styles.themeSwitcher} />
    </div>
  );
});
