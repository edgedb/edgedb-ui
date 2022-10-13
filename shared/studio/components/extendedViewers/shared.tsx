import {useContext} from "react";
import {ExtendedViewerContext} from ".";

import styles from "./shared.module.scss";

export function ActionsBar() {
  const {closeExtendedView} = useContext(ExtendedViewerContext);

  return (
    <div className={styles.actionsBar}>
      <div className={styles.closeAction} onClick={() => closeExtendedView()}>
        Close
      </div>
    </div>
  );
}
