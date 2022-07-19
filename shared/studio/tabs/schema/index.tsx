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
  SchemaMinimap,
} from "@edgedb/schema-graph";

import {useDatabaseState} from "../../state/database";
import {DatabaseTabSpec} from "../../components/databasePage";

import {
  SchemaViewGraphIcon,
  SchemaViewTextGraphIcon,
  SchemaViewTextIcon,
  TabSchemaIcon,
} from "../../icons";

import {SchemaTextView} from "./textView";

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
                {
                  id: SchemaViewType.Text,
                  label: "Text",
                  icon: (
                    <SchemaViewTextIcon className={styles.viewSwitcherIcon} />
                  ),
                },
                {
                  id: SchemaViewType.Graph,
                  label: "Graph",
                  icon: (
                    <SchemaViewGraphIcon className={styles.viewSwitcherIcon} />
                  ),
                },
                {
                  id: SchemaViewType.TextGraph,
                  label: "Text/Graph",
                  icon: (
                    <SchemaViewTextGraphIcon
                      className={styles.viewSwitcherIcon}
                    />
                  ),
                },
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
  allowNested: true,
  label: "Schema",
  icon: (active) => <TabSchemaIcon active={active} />,
  state: Schema,
  element: <SchemaView />,
};

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
      <SchemaMinimap className={styles.minimap} />
    </div>
  );
});
