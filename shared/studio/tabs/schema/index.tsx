import {observer} from "mobx-react-lite";

import cn from "@edgedb/common/utils/classNames";

import SplitView from "@edgedb/common/ui/splitView";
import SwitcherButton from "@edgedb/common/ui/switcherButton";

import styles from "./schema.module.scss";

import {useTabState} from "../../state";
import {Schema, SchemaViewType} from "./state";

import {
  SchemaGraph,
  schemaContext,
  useDebugState,
  DebugControls,
  SchemaMinimap,
} from "@edgedb/schema-graph";

import {DatabaseTabSpec} from "../../components/databasePage";

import {
  SchemaViewGraphIcon,
  SchemaViewTextGraphIcon,
  SchemaViewTextIcon,
  TabSchemaIcon,
} from "../../icons";

import {SchemaTextView} from "./textView";
import {useIsMobile} from "@edgedb/common/hooks/useMobile";
import {LabelsSwitch, switchState} from "@edgedb/common/ui/switch";

export const SchemaView = observer(function SchemaView() {
  const schemaState = useTabState(Schema);
  const isMobile = useIsMobile();

  const isGraphView = schemaState.viewType === SchemaViewType.Graph;

  return (
    <schemaContext.Provider value={schemaState.schemaState}>
      <div className={cn(styles.schema)}>
        {schemaState.viewType === SchemaViewType.Text ? (
          <SchemaTextView />
        ) : null}
        {isGraphView ? <SchemaGraphView /> : null}
        {schemaState.viewType === SchemaViewType.TextGraph ? (
          <SplitView
            views={[<SchemaTextView />, <SchemaGraphView />]}
            state={schemaState.splitView}
            minViewSize={20}
          />
        ) : null}

        {isMobile ? (
          <LabelsSwitch
            className={styles.viewSwitch}
            labels={["text", "graph"]}
            value={isGraphView ? switchState.right : switchState.left}
            onChange={() =>
              schemaState.setViewType(
                isGraphView ? SchemaViewType.Text : SchemaViewType.Graph
              )
            }
          />
        ) : (
          <div className={cn(styles.toolbar)}>
            <div className={styles.switcherLabel}>View Layout</div>
            <div className={styles.viewSwitcher}>
              <SwitcherButton
                items={[
                  {
                    id: SchemaViewType.Text,
                    label: "Text",
                    icon: (
                      <SchemaViewTextIcon
                        className={styles.viewSwitcherIcon}
                      />
                    ),
                  },
                  {
                    id: SchemaViewType.Graph,
                    label: "Graph",
                    icon: (
                      <SchemaViewGraphIcon
                        className={styles.viewSwitcherIcon}
                      />
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
        )}
      </div>
    </schemaContext.Provider>
  );
});

export const schemaTabSpec: DatabaseTabSpec = {
  path: "schema",
  allowNested: true,
  label: "Schema",
  icon: (active) => <TabSchemaIcon active={active} />,
  usesSessionState: false,
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
