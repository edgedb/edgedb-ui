import {observer} from "mobx-react";

import {useTabState} from "../../state/providers";

import Button from "../../ui/button";
import Spinner from "../../ui/spinner";
import {RightArrowIcon} from "../icons";

import styles from "./tabView.module.scss";

export default observer(function DisconnectedOverlay() {
  const tabState = useTabState();

  const conn = tabState.connection;

  return (
    <div className={styles.disconnectedOverlay}>
      <div className={styles.title}>Disconnected</div>
      <Button
        className={styles.reconnect}
        onClick={() => conn.connect()}
        label={conn.connecting ? "Reconnecting..." : "Reconnect"}
        colour="green"
        icon={
          conn.connecting ? (
            <Spinner size={14} angle={135} strokeWidth={1.5} period={1.5} />
          ) : (
            <RightArrowIcon style={{marginRight: "4px"}} />
          )
        }
      />
      {conn.errorMessage ? (
        <div className={styles.errorMessage}>{conn.errorMessage}</div>
      ) : null}
    </div>
  );
});
