import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";
import CodeBlock from "@edgedb/common/ui/codeBlock";

import SplitView from "@edgedb/common/ui/splitView";
import SwitcherButton from "@edgedb/common/ui/switcherButton";

import styles from "./schema.module.scss";
// import tabStyles from "../tabView/tabView.module.scss";

import {useTabState} from "../../state";
import {Schema, SchemaViewType} from "./state";

import {
  SchemaGraph,
  schemaContext,
  useDebugState,
  DebugControls,
} from "@edgedb/schema-graph";
import SchemaSidepanel from "@edgedb/schema-graph/components/schemaSidepanel";

import {useDatabaseState} from "../../state/database";
import {DatabaseTabSpec} from "../../components/databasePage";

import {TabSchemaIcon} from "../../icons";

export const SchemaView = observer(function SchemaView() {
  const schemaState = useTabState(Schema);

  return (
    <schemaContext.Provider value={schemaState.schemaState}>
      <div className={cn(styles.schema)}>
        {schemaState.viewType === SchemaViewType.Text ? (
          <SchemaTextView />
        ) : null}
        {schemaState.viewType === SchemaViewType.Graph ? (
          <SchemaGraphView />
        ) : null}
        {schemaState.viewType === SchemaViewType.TextGraph ? (
          <SplitView
            views={[<SchemaTextView />, <SchemaGraphView />]}
            state={schemaState.splitView}
            minViewSize={20}
          />
        ) : null}

        <div className={cn(styles.toolbar)}>
          <div className={styles.switcherLabel}>View Layout</div>
          <div className={styles.viewSwitcher}>
            <SwitcherButton
              items={[
                {id: SchemaViewType.Text, label: "Text"},
                {id: SchemaViewType.Graph, label: "Graph"},
                {id: SchemaViewType.TextGraph, label: "Text/Graph"},
              ]}
              selected={schemaState.viewType}
              onChange={(type) => schemaState.setViewType(type)}
            />
          </div>
        </div>
      </div>
    </schemaContext.Provider>
  );
});

export const schemaTabSpec: DatabaseTabSpec = {
  path: "schema",
  label: "Schema",
  icon: (active) => <TabSchemaIcon active={active} />,
  state: Schema,
  element: <SchemaView />,
};

const SchemaTextView = observer(function SchemaTextView() {
  const dbState = useDatabaseState();

  const sdl = (dbState.schemaData?.sdl ?? "").replace(
    /;\n(?!\s*}| {12})/g,
    ";\n\n"
  );

  return (
    <div className={styles.schemaTextView}>
      <pre className={styles.lineNos}>
        {Array(sdl.split("\n").length)
          .fill(0)
          .map((_, i) => i + 1)
          .join("\n")}
      </pre>
      <CodeBlock code={sdl} />
    </div>
  );
});

const SchemaGraphView = observer(function SchemaGraphView() {
  const schemaState = useTabState(Schema);

  const debugState = useDebugState();

  return (
    <div className={styles.schemaGraphView}>
      {process.env.NODE_ENV === "development" ? (
        <DebugControls
          debugState={debugState}
          schemaState={schemaState.schemaState}
        />
      ) : null}
      <SchemaGraph debug={debugState[0]} />
      <SchemaSidepanel />
    </div>
  );
});
