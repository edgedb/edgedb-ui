import {useState} from "react";
import {observer} from "mobx-react-lite";
import {useNavigate} from "react-router-dom";

import styles from "./databaseDashboard.module.scss";

import {useDatabaseState} from "../../state/database";

import {
  DocsQuickstartIcon,
  DocsTutorialIcon,
  DocsEasyEdgeDBIcon,
  DocsIcon,
} from "../../icons/docs";

import Button from "@edgedb/common/ui/button";

import {HeaderDatabaseIcon} from "../../icons";

export {TabDashboardIcon} from "../../icons";

export default observer(function DatabaseDashboard() {
  const dbState = useDatabaseState();
  const navigate = useNavigate();

  if (dbState.migrationId === undefined) {
    return <div className={styles.dashboard} />;
  }

  if (dbState.migrationId === null) {
    return <FirstRunDashboard />;
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.dbName}>
        <HeaderDatabaseIcon />
        <span>{dbState.name}</span>
      </div>

      <div className={styles.buttons}>
        <Button
          label="Open REPL"
          size="large"
          style="square"
          onClick={() => navigate("repl")}
        ></Button>

        <Button
          label="Browse Schema"
          size="large"
          style="square"
          onClick={() => navigate("schema")}
        ></Button>

        <Button
          label="Browse Data"
          size="large"
          style="square"
          onClick={() => navigate("data")}
        ></Button>
      </div>

      <div className={styles.docButtons}>
        <a
          href="https://www.edgedb.com/docs/guides/quickstart"
          target="_blank"
        >
          <DocsQuickstartIcon />
          <span>5-min Quickstart</span>
        </a>

        <a href="https://www.edgedb.com/tutorial" target="_blank">
          <DocsTutorialIcon />
          <span>Interactive Tutorial</span>
        </a>

        <a href="https://www.edgedb.com/easy-edgedb" target="_blank">
          <DocsEasyEdgeDBIcon />
          <span>Easy EdgeDB</span>
        </a>

        <a href="https://www.edgedb.com/docs/" target="_blank">
          <DocsIcon />
          <span>Documentation</span>
        </a>
      </div>
    </div>
  );
});

const FirstRunDashboard = observer(function FirstRunDashboard() {
  const dbState = useDatabaseState();
  const [buttonLabel, setButtonLabel] = useState<string>("");
  const [running, setRunning] = useState(false);

  return (
    <div className={styles.firstDashboard}>
      <div className={styles.dbName}>
        <HeaderDatabaseIcon />
        <span>{dbState.name}</span>
      </div>
      <div className={styles.congrats}>Your new database is ready!</div>

      <div className={styles.importData}>
        <h3>Use our example "movies" schema and data set</h3>
        <p>Import our example schema and play with the web REPL right away.</p>
        <div>
          <Button
            label={buttonLabel || `Setup example schema & data`}
            loading={running}
            disabled={running}
            size="large"
            style="square"
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
      </div>
    </div>
  );
});
