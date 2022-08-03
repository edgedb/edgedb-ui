import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import {HeaderTabs} from "@edgedb/studio/components/headerTabs";
import {SessionStateControls} from "@edgedb/studio/components/sessionState";

import {Logo} from "@edgedb/common/ui/icons/logo";
import {ThemeSwitcher} from "@edgedb/common/ui/themeSwitcher";

import styles from "./header.module.scss";

export function TitleLogo({className}: {className?: string}) {
  return (
    <div className={cn(styles.title, className)}>
      <Logo className={styles.logo} />
      <div className={styles.subtitle}>Local</div>
    </div>
  );
}

export default observer(function Header() {
  return (
    <div className={styles.header}>
      <TitleLogo />

      <HeaderTabs />

      <SessionStateControls />

      <ThemeSwitcher className={styles.themeSwitcher} />
    </div>
  );
});
