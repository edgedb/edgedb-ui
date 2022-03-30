import {useState} from "react";
import {observer} from "mobx-react-lite";

import styles from "./databaseDashboard.module.scss";

import {useDatabaseState} from "src/state/providers";

import Button from "src/ui/button";

export default observer(function DatabaseDashboard() {
  const dbState = useDatabaseState();

  return (
    <div className={styles.dashboard}>
      Dashboard
      <br />
      {dbState.migrationId === null ? <FirstRunCard /> : null}
    </div>
  );
});

const FirstRunCard = observer(function FirstRunCard() {
  const dbState = useDatabaseState();

  const [buttonLabel, setButtonLabel] = useState<string>("");
  const [running, setRunning] = useState(false);

  return (
    <div className={styles.card}>
      <Button
        label={buttonLabel || `Setup example schema & data`}
        loading={running}
        disabled={running}
        onClick={async () => {
          setRunning(true);
          setButtonLabel(`Setting up schema...`);
          const {schemaScript} = await import("./exampleSchema");
          await dbState.connection.executeScript(schemaScript);
          setButtonLabel(`Updating schema...`);
          await dbState.fetchSchemaData();
        }}
      ></Button>
    </div>
  );
});
