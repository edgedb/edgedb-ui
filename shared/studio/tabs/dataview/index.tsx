import {useEffect, useMemo} from "react";
import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import styles from "./dataview.module.scss";

import {useModal} from "@edgedb/common/hooks/useModal";
import {Theme, useTheme} from "@edgedb/common/hooks/useTheme";
import {Select} from "@edgedb/common/ui/select";
import Button from "@edgedb/common/ui/button";

import {useTabState, useDatabaseState} from "../../state";
import {
  DataView as DataViewState,
  DataInspector as DataInspectorState,
} from "./state";
import {DatabaseTabSpec} from "../../components/databasePage";
import {useDBRouter} from "../../hooks/dbRoute";

import {CodeEditor} from "@edgedb/code-editor";

import DataInspectorTable from "./dataInspector";

import {ReviewEditsModal} from "./reviewEditsModal";

import {ObjectTypeSelect} from "../../components/objectTypeSelect";

import {ApplyFilterIcon, BackArrowIcon, ClearFilterIcon} from "./icons";
import {
  BackIcon,
  ChevronDownIcon,
  CrossIcon,
  FilterIcon,
  TabDataExplorerIcon,
  WarningIcon,
} from "../../icons";
import {useIsMobile} from "@edgedb/common/hooks/useMobile";

export const DataView = observer(function DataView() {
  const dbState = useDatabaseState();
  const state = useTabState(DataViewState);
  const {navigate, currentPath} = useDBRouter();

  const stack = state.inspectorStack;

  useEffect(() => {
    const basePath = currentPath.slice(0, 2).join("/");
    const path = currentPath.slice(2).join("/");
    if (!path && state.lastSelectedPath) {
      navigate(`${basePath}/${state.lastSelectedPath}`, true);
    } else if (dbState.schemaData) {
      const updatedPath = state.updateFromPath(path ?? "");
      if (updatedPath !== null) {
        navigate(`${basePath}/${updatedPath}`, true);
      }
    }
  }, [currentPath, dbState.schemaData]);

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
  allowNested: true,
  label: "Data Explorer",
  icon: (active) => <TabDataExplorerIcon active={active} />,
  usesSessionState: true,
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
  const {navigate, currentPath} = useDBRouter();

  const basePath = currentPath.slice(0, 2).join("/");

  const stack = dataviewState.inspectorStack;

  const inspectorState = stack[stackIndex];

  const nestedPath = stackIndex > 0 ? stack[stack.length - 1] : null;

  const isMobile = useIsMobile();

  return (
    <div
      className={cn(styles.dataviewCard, {
        [styles.nestedView]: stackIndex > 0,
      })}
    >
      <div className={cn(styles.header, {[styles.nested]: !!nestedPath})}>
        {!nestedPath ? (
          <>
            <ObjectTypeSelect
              className={cn(styles.headerSelect, styles.objectSelect)}
              fullScreen
              fullScreenTitle="Object type"
              objectTypes={dataviewState.objectTypes}
              selectedObjectType={stack[0].objectType!}
              action={(objectType) => {
                navigate(`${basePath}/${objectType.name}`);
                dataviewState.selectObject(objectType.id);
              }}
            />
          </>
        ) : (
          <>
            <div
              className={styles.backButton}
              onClick={() => {
                navigate(currentPath.slice(0, -2).join("/"));
                dataviewState.closeLastNestedView();
              }}
            >
              {isMobile ? <BackIcon /> : <BackArrowIcon />}
            </div>
            <div className={styles.nestedPathSteps}>
              <div className={styles.nestedPathStep}>
                <div className={styles.pathStepName}>
                  {nestedPath.parentObject?.objectTypeName}
                </div>
                <div className={styles.pathStepIdent}>
                  {typeof nestedPath.parentObject!.id === "string" ? (
                    <span>{nestedPath.parentObject!.id}</span>
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
            {isMobile && (
              <button className={styles.closeNestedView}>
                <CrossIcon />
              </button>
            )}
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

        <div className={styles.rowCount}>
          {inspectorState.rowCount !== null ? (
            <>{inspectorState.rowCount} Items</>
          ) : (
            <span>loading...</span>
          )}
        </div>

        {(!isMobile || !nestedPath) && (
          <div className={styles.headerButtons}>
            {inspectorState.subTypes.length ? (
              <label className={styles.headerToggle}>
                <input
                  type="checkbox"
                  checked={dataviewState.showSubtypeFields}
                  onChange={(e) =>
                    dataviewState.setShowSubtypeFields(e.target.checked)
                  }
                />
                Show subtype fields
              </label>
            ) : null}
            {dataviewState.edits.hasPendingEdits ? (
              <>
                <div
                  className={cn(styles.headerButton, styles.reviewChanges)}
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
              inspectorState.insertTypeNames.length > 1 ? (
                <Select
                  className={cn(styles.headerSelect, styles.insertSelect)}
                  title="Insert"
                  items={null}
                  actions={inspectorState.insertTypeNames.map((name) => ({
                    label: name,
                    action: () => dataviewState.edits.createNewRow(name),
                  }))}
                />
              ) : (
                <div
                  className={styles.headerButton}
                  onClick={() =>
                    dataviewState.edits.createNewRow(
                      inspectorState.insertTypeNames[0]
                    )
                  }
                >
                  Insert {inspectorState.insertTypeNames[0].split("::").pop()}
                </div>
              )
            ) : null}
            {!!inspectorState.filter && (
              <button
                className={styles.removeFilter}
                onClick={() => inspectorState.clearFilter()}
              >
                <CrossIcon />
              </button>
            )}

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
              {!isMobile && (
                <>
                  Filter
                  <ChevronDownIcon className={styles.openIcon} />
                </>
              )}
            </div>
          </div>
        )}
      </div>
      {inspectorState.filterPanelOpen ? (
        <FilterPanel state={inspectorState} />
      ) : null}

      <DataInspectorTable
        key={inspectorState.$modelId}
        state={inspectorState}
        edits={dataviewState.edits}
        className={nestedPath ? styles.inspectorTable : ""}
      />
      <div
        className={cn(styles.dataFetchingError, {
          [styles.showError]: inspectorState.dataFetchingError !== null,
        })}
      >
        <WarningIcon />
        Failed to fetch data
      </div>
    </div>
  );
});

interface FilterPanelProps {
  state: DataInspectorState;
}

const FilterPanel = observer(function FilterPanel({state}: FilterPanelProps) {
  const [_, theme] = useTheme();

  const keybindings = useMemo(
    () => [
      {
        key: "Mod-Enter",
        run: () => {
          state.applyFilter();
          return true;
        },
        preventDefault: true,
      },
    ],
    [state]
  );

  const applyFilterOnMobile = async () => {
    await state.applyFilter();
    if (state.filter) state.setFilterPanelOpen(false);
  };

  return (
    <div className={styles.filterPanel}>
      <p className={styles.title}>Filter</p>
      <CodeEditor
        code={state.filterEditStr}
        onChange={(value) => state.setFilterEditStr(value)}
        useDarkTheme={theme === Theme.dark}
        keybindings={keybindings}
      />

      <div className={styles.filterActions}>
        <div className={styles.filterError}>{state.errorFilter?.error}</div>

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
      <p className={styles.filterErrorMobile}>{state.errorFilter?.error}</p>
      <button
        className={styles.applyFilterMobile}
        disabled={!state.filterEdited}
        onClick={applyFilterOnMobile}
      >
        Apply Filter
      </button>
      <button
        className={styles.closeFilterPanel}
        onClick={() => {
          state.setFilterPanelOpen(false);
        }}
      >
        <CrossIcon />
      </button>
    </div>
  );
});
