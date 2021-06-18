import {useState, useEffect} from "react";

import cn from "@edgedb/common/utils/classNames";

import styles from "./windowsControls.module.scss";

import {windowControls} from "../../global";

export default function WindowsControls() {
  const [maximised, setMaximised] = useState(() =>
    windowControls.isMaximised()
  );

  useEffect(() => {
    const disposer = windowControls.onMaximisedChange(setMaximised);

    return () => {
      disposer();
    };
  }, []);

  return (
    <div className={styles.controls}>
      <div className={styles.button} onClick={() => windowControls.minimise()}>
        <span>&#xE921;</span>
      </div>
      <div
        className={styles.button}
        onClick={() => windowControls.toggleMaximised()}
      >
        {maximised ? <span>&#xE923;</span> : <span>&#xE922;</span>}
      </div>
      <div
        className={cn(styles.button, styles.close)}
        onClick={() => windowControls.close()}
      >
        <span>&#xE8BB;</span>
      </div>
    </div>
  );
}
