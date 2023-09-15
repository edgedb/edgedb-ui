import {observer} from "mobx-react";
import {HeaderTabs} from "@edgedb/studio/components/headerNav";
import cn from "@edgedb/common/utils/classNames";

import {LogoLocal} from "@edgedb/common/ui/icons/logo";

import styles from "./header.module.scss";

export const Logo = ({className}: {className?: string}) => {
  return <LogoLocal className={cn(className, styles.logo)} />;
};

export default observer(function Header() {
  return (
    <div className={styles.header}>
      <Logo />
      <HeaderTabs keys={["instance", "database"]} />
    </div>
  );
});
