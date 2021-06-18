import React from "react";
import {observer} from "mobx-react";

import styles from "./schemaSidepanel.module.scss";

import cn from "@edgedb/common/utils/classNames";
import {SidepanelTabType} from "../../state/sidepanel";
import {useSchemaState} from "../../state/provider";

import SchemaMinimap from "../schemaMinimap";
import SchemaDetails from "./schemaDetails";
import SchemaFunctions from "./schemaFunctions";
import SchemaScalars from "./schemaScalars";
import SchemaConstraints from "./schemaConstraints";
import SchemaObjects from "./schemaObjects";

const tabs: {
  name: SidepanelTabType;
  icon: string;
}[] = [
  {name: SidepanelTabType.inspector, icon: "i"},
  {name: SidepanelTabType.objects, icon: "o"},
  {name: SidepanelTabType.functions, icon: "f"},
  {name: SidepanelTabType.scalars, icon: "s"},
  {name: SidepanelTabType.constraints, icon: "c"},
];

function getPanel(panelTab: SidepanelTabType) {
  switch (panelTab) {
    case SidepanelTabType.inspector:
      return (
        <>
          <SchemaMinimap />
          <SchemaDetails />
        </>
      );
    case SidepanelTabType.functions:
      return <SchemaFunctions />;
    case SidepanelTabType.scalars:
      return <SchemaScalars />;
    case SidepanelTabType.constraints:
      return <SchemaConstraints />;
    case SidepanelTabType.objects:
      return <SchemaObjects />;
  }
}

export default observer(function SchemaSidepanel() {
  const schemaState = useSchemaState();

  return (
    <div className={styles.sidepanel}>
      <div className={styles.details}>
        {getPanel(schemaState.sidepanel.selectedTab)}
      </div>
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <div
            className={cn(
              styles.tab,
              schemaState.sidepanel.selectedTab === tab.name
                ? styles.selected
                : null
            )}
            key={tab.name}
            onClick={() => schemaState.sidepanel.setSelectedTab(tab.name)}
          >
            <div className={styles.icon}>{tab.icon}</div>
            <div className={styles.name}>{tab.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
});
