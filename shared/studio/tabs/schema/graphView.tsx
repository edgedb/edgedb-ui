import {useLayoutEffect} from "react";
import {observer} from "mobx-react-lite";

import {
  Schema as SchemaState,
  SchemaGraph,
  schemaContext,
  useDebugState,
  DebugControls,
  SchemaMinimap,
} from "@edgedb/schema-graph";

import type {Schema} from "./state";

import styles from "./schema.module.scss";
import {runInAction} from "mobx";

const SchemaGraphView = observer(function SchemaGraphView({
  state,
}: {
  state: Schema;
}) {
  const debugState = useDebugState();

  useLayoutEffect(() => {
    if (!state.schemaState) {
      runInAction(() => {
        state.schemaState = SchemaState.create();
      });
    }
  }, [state.schemaState]);

  return state.schemaState ? (
    <schemaContext.Provider value={state.schemaState}>
      {process.env.NODE_ENV === "development" ? (
        <DebugControls
          debugState={debugState}
          schemaState={state.schemaState}
        />
      ) : null}
      <SchemaGraph debug={debugState[0]} />
      <SchemaMinimap className={styles.minimap} />
    </schemaContext.Provider>
  ) : null;
});

export default SchemaGraphView;
