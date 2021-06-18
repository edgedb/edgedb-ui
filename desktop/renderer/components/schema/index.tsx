import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import SplitView from "../../ui/splitView";
import CodeBlock from "../../ui/codeBlock";
import SwitcherButton from "../../ui/switcherButton";

import styles from "./schema.module.scss";
import tabStyles from "../tabView/tabView.module.scss";

import {useTabState} from "../../state/providers";
import {SchemaViewType} from "../../state/models/schema";

import {
  SchemaGraph,
  schemaContext,
  useDebugState,
  DebugControls,
} from "@edgedb/schema-graph";
import SchemaSidepanel from "@edgedb/schema-graph/components/schemaSidepanel";

export default observer(function SchemaView() {
  const schemaState = useTabState().schemaView;

  return (
    <schemaContext.Provider value={schemaState.schemaState}>
      <div className={cn(tabStyles.card, styles.schema)}>
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
      </div>
      <div className={cn(tabStyles.toolbar, styles.toolbar)}>
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
    </schemaContext.Provider>
  );
});

const SchemaTextView = observer(function SchemaTextView() {
  const tabState = useTabState();

  const sdl = (tabState.schemaData?.data.sdl ?? "").replace(
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
  const schemaState = useTabState().schemaView;

  const debugState = useDebugState();

  return (
    <div className={styles.schemaGraphView}>
      <DebugControls
        debugState={debugState}
        schemaState={schemaState.schemaState}
      />
      <SchemaGraph debug={debugState[0]} />
      <SchemaSidepanel />
    </div>
  );
});
