import {observer} from "mobx-react-lite";
import {HeaderTabs} from "@edgedb/studio/components/headerNav";
import {ThemeSwitcher} from "@edgedb/common/ui/themeSwitcher";
import cn from "@edgedb/common/utils/classNames";

import {LogoLocal} from "@edgedb/common/ui/icons/logo";

import styles from "./header.module.scss";

export const Logo = ({className}: {className?: string}) => {
  return <LogoLocal className={cn(className, styles.logo)} />;
};

export const Header = observer(function Header() {
  return (
    <div className={styles.header}>
      <Logo />
      <HeaderTabs keys={["instance", "database"]} />

      <ThemeSwitcher className={styles.themeSwitcher} />
    </div>
  );
});
