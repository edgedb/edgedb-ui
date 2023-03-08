import {observer} from "mobx-react";
import {HeaderTabs} from "@edgedb/studio/components/headerTabs";
import {SessionStateControls} from "@edgedb/studio/components/sessionState";
import cn from "@edgedb/common/utils/classNames";

import {LogoLocal, LogoCloud} from "@edgedb/common/ui/icons/logo";
import {ThemeSwitcher} from "@edgedb/common/ui/themeSwitcher";

import styles from "./header.module.scss";

export const Logo = ({className}: {className?: string}) => {
  const isCloudEnv = window.location.hostname.endsWith(".edgedb.cloud");

  return isCloudEnv ? (
    <LogoCloud className={cn(className, styles.logo)} />
  ) : (
    <LogoLocal className={cn(className, styles.logo)} />
  );
};

export default observer(function Header() {
  return (
    <div className={styles.header}>
      <Logo />
      <HeaderTabs />
      <SessionStateControls />
      <ThemeSwitcher className={styles.themeSwitcher} />
    </div>
  );
});
