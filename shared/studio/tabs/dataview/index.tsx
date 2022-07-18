import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import {formatUUID} from "@edgedb/inspector/v2/buildScalar";

import styles from "./dataview.module.scss";

import {useModal} from "@edgedb/common/hooks/useModal";
import {Theme, useTheme} from "@edgedb/common/hooks/useTheme";

import {useTabState, useDatabaseState} from "../../state";
import {
  DataView as DataViewState,
  DataInspector as DataInspectorState,
} from "./state";
import {DatabaseTabSpec} from "../../components/databasePage";

import {CodeEditor} from "@edgedb/code-editor";

import DataInspectorTable from "./dataInspector";

import {ReviewEditsModal} from "./reviewEditsModal";

import {ApplyFilterIcon, BackArrowIcon, ClearFilterIcon} from "./icons";
import {ChevronDownIcon, FilterIcon, TabDataExplorerIcon} from "../../icons";
import {Select} from "@edgedb/common/ui/select";
import Button from "@edgedb/common/ui/button";

export const DataView = observer(function DataView() {
  const dbState = useDatabaseState();

  const stack = useTabState(DataViewState).inspectorStack;

  return (
    <div className={styles.dataview}>
      {stack.length > 1 ? <div className={styles.stackedCard} /> : null}
      {stack.length ? (
        <DataInspectorView stackIndex={stack.length - 1} />
      ) : (
        <div className={cn(styles.dataviewCard, styles.loadingSkeleton)}>
          {dbState.schemaData
            ? "No object types in schema"
            : "Loading schema..."}
        </div>
      )}
    </div>
  );
});

export const dataviewTabSpec: DatabaseTabSpec = {
  path: "data",
  label: "Data Explorer",
  icon: (active) => <TabDataExplorerIcon active={active} />,
  state: DataViewState,
  element: <DataView />,
};

interface DataInspectorViewProps {
  stackIndex: number;
}

const DataInspectorView = observer(function DataInspectorView({
  stackIndex,
}: DataInspectorViewProps) {
  const dataviewState = useTabState(DataViewState);
  const {openModal} = useModal();

  const stack = dataviewState.inspectorStack;

  const inspectorState = stack[stackIndex];

  const nestedPath = stackIndex > 0 ? stack[stack.length - 1] : null;

  return (
    <div
      className={cn(styles.dataviewCard, {
        [styles.nestedView]: stackIndex > 0,
      })}
    >
      <div className={styles.header}>
        {!nestedPath ? (
          <>
            <Select
              className={styles.objectSelect}
              items={dataviewState.objectTypes.map(({id, name}) => {
                const [modName, typeName] = name.split(/::/);
                return {
                  label: (
                    <>
                      <span className={styles.modName}>{modName}::</span>
                      {typeName}
                    </>
                  ),
                  action: () => dataviewState.selectObject(id),
                };
              })}
              selectedItemIndex={dataviewState.objectTypes.indexOf(
                stack[0]?.objectType!
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
                  {nestedPath.parentObject?.objectTypeName}
                </div>
                <div className={styles.pathStepIdent}>
                  {typeof nestedPath.parentObject!.id === "string" ? (
                    <span>{formatUUID(nestedPath.parentObject!.id)}</span>
                  ) : (
                    <span style={{fontStyle: "italic"}}>new object</span>
                  )}
                </div>
              </div>
              <div className={styles.nestedPathStep}>
                <div className={styles.pathStepName}>
                  .{nestedPath.parentObject?.fieldName}
                </div>
                <div className={styles.pathStepIdent}>
                  <span>{nestedPath.objectType!.name}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {inspectorState.parentObject &&
        !inspectorState.parentObject.isComputedLink ? (
          <div
            className={styles.headerButton}
            onClick={() => inspectorState.toggleEditLinkMode()}
          >
            {inspectorState.parentObject.editMode
              ? "Close edit mode"
              : "Edit links"}
          </div>
        ) : null}

        <div className={styles.rowCount}>{inspectorState?.rowCount} Items</div>

        <div className={styles.headerButtons}>
          {dataviewState.edits.hasPendingEdits ? (
            <>
              <div
                className={styles.headerButton}
                onClick={() =>
                  openModal(<ReviewEditsModal state={dataviewState} />)
                }
              >
                Review Changes
              </div>
            </>
          ) : null}

          {inspectorState.insertTypeNames.length &&
          (!inspectorState.parentObject ||
            inspectorState.parentObject.editMode) ? (
            <Select
              title="Insert..."
              items={null}
              actions={inspectorState.insertTypeNames.map((name) => ({
                label: name,
                action: () => {
                  dataviewState.edits.createNewRow(name);
                },
              }))}
            />
          ) : null}

          <div
            className={cn(styles.filterButton, {
              [styles.open]: inspectorState.filterPanelOpen,
              [styles.filterActive]: !!inspectorState.filter,
            })}
            onClick={() => {
              inspectorState.setFilterPanelOpen(
                !inspectorState.filterPanelOpen
              );
            }}
          >
            <FilterIcon className={styles.filterIcon} />
            Filter
            <ChevronDownIcon className={styles.openIcon} />
          </div>
        </div>
      </div>

      {inspectorState.filterPanelOpen ? (
        <FilterPanel state={inspectorState} />
      ) : null}

      <DataInspectorTable
        key={inspectorState.$modelId}
        state={inspectorState}
        edits={dataviewState.edits}
      />
    </div>
  );
});

interface FilterPanelProps {
  state: DataInspectorState;
}

const FilterPanel = observer(function FilterPanel({state}: FilterPanelProps) {
  const [theme] = useTheme();

  return (
    <div className={styles.filterPanel}>
      <CodeEditor
        code={state.filterEditStr}
        onChange={(value) => state.setFilterEditStr(value)}
        useDarkTheme={theme === Theme.dark}
      />

      <div className={styles.filterActions}>
        <div className={styles.filterError}>{state.filterError}</div>

        <Button
          className={styles.clearFilterButton}
          label="Clear"
          icon={<ClearFilterIcon />}
          leftIcon
          disabled={!state.filter && !state.filterEdited}
          onClick={() => state.clearFilter()}
        />

        <Button
          className={styles.disableFilterButton}
          label="Disable Filter"
          icon={<ClearFilterIcon />}
          leftIcon
          disabled={!state.filter}
          onClick={() => state.disableFilter()}
        />

        <Button
          className={styles.applyFilterButton}
          label={state.filter ? "Update Filter" : "Apply Filter"}
          icon={<ApplyFilterIcon />}
          leftIcon
          disabled={!state.filterEdited}
          onClick={() => state.applyFilter()}
        />
      </div>
    </div>
  );
});
