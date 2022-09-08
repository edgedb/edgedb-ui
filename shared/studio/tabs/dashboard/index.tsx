import {useEffect, useState} from "react";
import {observer} from "mobx-react-lite";
import {useNavigate} from "react-router-dom";

import styles from "./databaseDashboard.module.scss";

import {useInstanceState} from "../../state/instance";
import {useDatabaseState} from "../../state/database";
import {DatabaseTabSpec} from "../../components/databasePage";

import {
  DocsQuickstartIcon,
  DocsTutorialIcon,
  DocsEasyEdgeDBIcon,
  DocsIcon,
} from "../../icons/docs";

import Button from "@edgedb/common/ui/button";

import {
  HeaderDatabaseIcon,
  TabDashboardIcon,
  TabDataExplorerIcon,
  TabReplIcon,
  TabSchemaIcon,
} from "../../icons";

export const DatabaseDashboard = observer(function DatabaseDashboard() {
  const dbState = useDatabaseState();
  const navigate = useNavigate();

  useEffect(() => {
    if (dbState.migrationId != undefined) {
      dbState.updateObjectCount();
    }
  }, [dbState.migrationId]);

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
          className={styles.button}
          label="Open REPL"
          size="large"
          icon={<TabReplIcon />}
          leftIcon
          onClick={() => navigate("repl")}
        ></Button>

        <Button
          className={styles.button}
          label="Browse Schema"
          size="large"
          icon={<TabSchemaIcon />}
          leftIcon
          onClick={() => navigate("schema")}
        ></Button>

        <Button
          className={styles.button}
          label="Browse Data"
          size="large"
          icon={<TabDataExplorerIcon />}
          leftIcon
          onClick={() => navigate("data")}
        ></Button>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{dbState.objectCount ?? "-"}</div>
          <div className={styles.statLabel}>objects</div>
        </div>

        <div className={styles.stat}>
          <div className={styles.statValue}>
            {dbState.schemaData
              ? [...dbState.schemaData.objects.values()].filter(
                  (o) => !o.builtin
                ).length
              : "-"}
          </div>
          <div className={styles.statLabel}>object types</div>
        </div>
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

export const dashboardTabSpec: DatabaseTabSpec = {
  path: "",
  label: "Dashboard",
  icon: (active) => <TabDashboardIcon active={active} />,
  element: <DatabaseDashboard />,
};

export function fetchExampleSchema(): Promise<string> {
  return import("./exampleSchema").then(({schemaScript}) => schemaScript);
}

const FirstRunDashboard = observer(function FirstRunDashboard() {
  const instanceState = useInstanceState();
  const dbState = useDatabaseState();
  const navigate = useNavigate();

  const exampleDBExists = instanceState.databases?.includes("_example");

  return (
    <div className={styles.firstDashboard}>
      <div className={styles.dbName}>
        <HeaderDatabaseIcon />
        <span>{dbState.name}</span>
      </div>
      <div className={styles.congrats}>Your new database is ready!</div>

      <div className={styles.importData}>
        <h3>First time using EdgeDB?</h3>
        <p>
          {exampleDBExists ? "Switch to the" : "Create an"} example database
          with our "movies" schema and data set, and play with the web UI right
          away.
        </p>
        <div>
          <Button
            label={
              instanceState.creatingExampleDB
                ? "Creating example database..."
                : exampleDBExists
                ? "Switch to example database"
                : "Create example database"
            }
            loading={instanceState.creatingExampleDB}
            disabled={instanceState.creatingExampleDB}
            size="large"
            style="square"
            onClick={
              exampleDBExists
                ? () => navigate("/_example")
                : async () => {
                    await instanceState.createExampleDatabase(
                      fetchExampleSchema()
                    );
                    navigate("/_example");
                  }
            }
          ></Button>
        </div>
      </div>
    </div>
  );
});
