import {Fragment} from "react";
import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import {formatUUID} from "@edgedb/inspector/v2/buildScalar";

import styles from "./dataview.module.scss";

import {useAppState, useDatabaseState} from "src/state/providers";
import {Theme} from "src/state/models/app";
import {DataInspector as DataInspectorState} from "src/state/models/dataview";

import {CodeEditor} from "@edgedb/code-editor";

import DataInspectorTable from "./dataInspector";

import {BackArrowIcon} from "./icons";
import {ChevronDownIcon} from "src/ui/icons";
import {Select} from "src/ui/select";

export default observer(function DataView() {
  const dbState = useDatabaseState();

  const stack = dbState.dataViewState.inspectorStack;

  return (
    <div className={styles.dataview}>
      {stack.length > 1 ? <div className={styles.stackedCard} /> : null}
      {stack.length ? (
        <DataInspectorView stackIndex={stack.length - 1} />
      ) : (
        <div className={cn(styles.dataviewCard, styles.loadingSkeleton)}>
          {dbState.schemaData?.data
            ? "No object types in schema"
            : "Loading schema..."}
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

  const stack = dataviewState.inspectorStack;

  const inspectorState = stack[stackIndex];

  return (
    <div
      className={cn(styles.dataviewCard, {
        [styles.nestedView]: stackIndex > 0,
      })}
    >
      <div className={styles.header}>
        {stackIndex === 0 ? (
          <>
            <Select
              className={styles.objectSelect}
              items={dataviewState.objectTypeNames.map((name) => {
                const [modName, typeName] = name.split(/::/);
                return {
                  label: (
                    <>
                      <span className={styles.modName}>{modName}::</span>
                      {typeName}
                    </>
                  ),
                  action: () => dataviewState.selectObject(name),
                };
              })}
              selectedItemIndex={dataviewState.objectTypeNames.indexOf(
                stack[0]?.objectName
              )}
            />
          </>
        ) : (
          <>
            <div
              className={styles.backButton}
              onClick={() => dataviewState.closeLastNestedView()}
            >
              <BackArrowIcon />
            </div>
            <div className={styles.nestedPathSteps}>
              <div className={styles.nestedPathStep}>
                <div className={styles.pathStepName}>
                  {stack[1].parentObject?.objectType}
                </div>
                <div className={styles.pathStepIdent}>
                  <span>{formatUUID(stack[1].parentObject!.id)}</span>
                </div>
              </div>
              {stack.slice(1, stackIndex + 1).map((inspector, i, arr) => (
                <div key={i} className={styles.nestedPathStep}>
                  <div className={styles.pathStepName}>
                    .{inspector.parentObject?.fieldName}
                  </div>
                  <div className={styles.pathStepIdent}>
                    <span>
                      {arr.length - 1 === i
                        ? inspector.objectName
                        : formatUUID(arr[i + 1].parentObject!.id)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className={styles.rowCount}>{inspectorState?.rowCount} Items</div>

        <div className={styles.headerButtons}>
          {inspectorState.edits.pendingCellEdits.size ? (
            <>
              <button
                onClick={() => inspectorState.edits.commitPendingEdits()}
              >
                Commit Edits
              </button>
              <button
                onClick={() => inspectorState.edits.clearAllPendingEdits()}
              >
                Clear Edits
              </button>
            </>
          ) : null}
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
