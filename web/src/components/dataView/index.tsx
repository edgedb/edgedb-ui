import {Fragment} from "react";
import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import styles from "./dataview.module.scss";

import {useAppState, useDatabaseState} from "src/state/providers";
import {Theme} from "src/state/models/app";
import {DataInspector as DataInspectorState} from "src/state/models/dataview";

import {CodeEditor} from "@edgedb/code-editor";

import DataInspectorTable from "./dataInspector";

import {BackArrowIcon} from "./icons";
import {ChevronDownIcon} from "src/ui/icons";

export default observer(function DataView() {
  const dataviewState = useDatabaseState().dataViewState;

  const stack = dataviewState.inspectorStack;

  return (
    <div className={styles.dataview}>
      {stack.length > 1 ? <div className={styles.stackedCard} /> : null}
      {stack.length ? (
        <DataInspectorView stackIndex={stack.length - 1} />
      ) : (
        <div className={cn(styles.dataviewCard, styles.loadingSkeleton)}>
          Loading schema...
        </div>
      )}
    </div>
  );
});

interface DataInspectorViewProps {
  stackIndex: number;
}

const DataInspectorView = observer(function DataInspectorView({
  stackIndex,
}: DataInspectorViewProps) {
  const dataviewState = useDatabaseState().dataViewState;

  const inspectorState = dataviewState.inspectorStack[stackIndex];

  return (
    <div
      className={cn(styles.dataviewCard, {
        [styles.nestedView]: stackIndex > 0,
      })}
    >
      <div className={styles.header}>
        {stackIndex === 0 ? (
          <>
            <select
              value={dataviewState.inspectorStack[0]?.objectName}
              onChange={(e) => dataviewState.selectObject(e.target.value)}
            >
              {dataviewState.objectTypeNames.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <div
              className={styles.backButton}
              onClick={() => dataviewState.closeLastNestedView()}
            >
              <BackArrowIcon />
            </div>
            {dataviewState.inspectorStack
              .slice(1, stackIndex + 1)
              .map((inspector, i) => (
                <Fragment key={i}>
                  <div className={styles.nestedPathStep}>
                    <div className={styles.pathStepName}>
                      {inspector.parentObject?.objectType}
                    </div>
                    <div className={styles.pathStepIdent}>
                      {inspector.parentObject?.id}
                    </div>
                  </div>
                  <div className={styles.nestedPathStep}>
                    <div className={styles.pathStepName}>
                      .{inspector.parentObject?.fieldName}
                    </div>
                    <div className={styles.pathStepIdent}>
                      {inspector.objectName}
                    </div>
                  </div>
                </Fragment>
              ))}
          </>
        )}

        <div className={styles.rowCount}>{inspectorState?.rowCount} Rows</div>

        <div className={styles.headerButtons}>
          <div
            className={cn(styles.headerButton, {
              [styles.active]: inspectorState.filterPanelOpen,
            })}
            onClick={() => {
              inspectorState.setFilterPanelOpen(
                !inspectorState.filterPanelOpen
              );
            }}
          >
            <ChevronDownIcon />
            {inspectorState.filterEdited ? "*" : ""}Filter
            {inspectorState.filter ? " (Active)" : ""}
          </div>
        </div>
      </div>

      {inspectorState.filterPanelOpen ? (
        <FilterPanel state={inspectorState} />
      ) : null}

      <DataInspectorTable
        key={inspectorState.$modelId}
        state={inspectorState}
      />
    </div>
  );
});

interface FilterPanelProps {
  state: DataInspectorState;
}

const FilterPanel = observer(function FilterPanel({state}: FilterPanelProps) {
  const appState = useAppState();

  return (
    <div className={styles.filterPanel}>
      <CodeEditor
        code={state.filterEditStr}
        onChange={(value) => state.setFilterEditStr(value)}
        useDarkTheme={appState.theme === Theme.dark}
      />

      <div className={styles.filterActions}>
        <div className={styles.filterError}>{state.filterError}</div>

        {state.filter ? (
          <button onClick={() => state.clearFilter()}>Clear</button>
        ) : null}
        {state.filterEdited ? (
          <button onClick={() => state.revertFilter()}>Revert</button>
        ) : null}
        <button
          onClick={() => state.applyFilter()}
          disabled={!state.filterEdited}
        >
          Apply Filter
        </button>
      </div>
    </div>
  );
});
