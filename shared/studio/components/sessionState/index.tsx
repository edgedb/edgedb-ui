import {SchemaGlobal, SchemaType} from "@edgedb/common/schemaData";
import cn from "@edgedb/common/utils/classNames";
import {renderValue} from "@edgedb/inspector/buildScalar";
import {observer} from "mobx-react-lite";
import {PropsWithChildren, useEffect, useRef, useState} from "react";
import {ChevronDownIcon, CloseIcon, SearchIcon} from "../../icons";
import {useDatabaseState} from "../../state";
import {queryOptions, SessionState} from "../../state/sessionState";
import {getInputComponent, InputValidator} from "../dataEditor";
import inspectorStyles from "@edgedb/inspector/inspector.module.scss";

import styles from "./sessionState.module.scss";
import {createPortal} from "react-dom";
import {useResize} from "@edgedb/common/hooks/useResize";
import {ButtonTabArrow, SettingsIcon} from "./icons";
import {ToggleSwitch} from "@edgedb/common/ui/toggleSwitch";
import fuzzysort from "fuzzysort";
import {highlightString} from "@edgedb/common/utils/fuzzysortHighlight";
import {CustomScrollbars} from "@edgedb/common/ui/customScrollbar";
import {TabSep} from "../headerTabs";

export function SessionStateControls() {
  return <div id="sessionStateControls" />;
}

export const SessionStateButton = observer(function SessionStateButton() {
  const sessionState = useDatabaseState().sessionState;
  const targetEl = document.getElementById("sessionStateControls");

  if (targetEl) {
    return createPortal(
      <div className={styles.sessionState}>
        <TabSep />
        <div
          className={cn(styles.stateButton, {
            [styles.open]: sessionState.barOpen,
            [styles.panelOpen]: sessionState.panelOpen,
          })}
          onClick={() => {
            if (sessionState.barOpen) {
              sessionState.closePanel();
              sessionState.setBarOpen(false);
            } else {
              sessionState.setBarOpen(true);
            }
          }}
        >
          <SettingsIcon className={styles.icon} />
          Client Settings
          <ChevronDownIcon className={styles.chevron} />
          <ButtonTabArrow className={styles.tabArrow} />
        </div>
      </div>,
      targetEl
    );
  }
  return null;
});

const renderValueWithType = (value: any, type: SchemaType) =>
  renderValue(
    value,
    type.name,
    type.schemaType === "Scalar" && type.enum_values !== null,
    type.schemaType === "Range" ? type.elementType.name : undefined,
    false
  ).body;

export interface SessionStateBarProps {
  className?: string;
  active?: boolean;
}

export const SessionStateBar = observer(function SessionStateBar({
  className,
  active = false,
}: SessionStateBarProps) {
  const dbState = useDatabaseState();
  const state = dbState.sessionState;

  const ref = useRef<HTMLDivElement>(null);

  const [height, setHeight] = useState(0);
  useResize(ref, ({height}) => setHeight(height));

  return (
    <div
      className={cn(
        styles.sessionBarWrapper,
        inspectorStyles.inspectorTheme,
        className,
        {
          [styles.notActive]: !active,
          [styles.barOpen]: state.barOpen,
          [styles.panelOpen]: state.panelOpen,
        }
      )}
      style={{height: state.barOpen ? height + 4 : undefined}}
    >
      <div
        className={styles.panelBg}
        style={{
          left: !state.panelOpen ? 56 : undefined,
          height: state.barOpen && !state.panelOpen ? height : undefined,
        }}
      />
      <SessionEditorPanel show={state.panelOpen} />
      <div ref={ref}>
        <SessionBarContent />
      </div>
    </div>
  );
});

const SessionBarContent = observer(function SessionBarContent() {
  const state = useDatabaseState().sessionState;

  const [overflowCount, setOverflowCount] = useState(0);

  const ref = useRef<HTMLDivElement>(null);

  const activeState = [
    ...state.activeState.globals.map((g) => ({kind: "g" as const, ...g})),
    ...state.activeState.config.map((c) => ({kind: "c" as const, ...c})),
    ...state.activeState.options.map((o) => ({kind: "o" as const, ...o})),
  ];

  useResize(
    ref,
    ({height}) => {
      if (ref.current!.scrollHeight > height) {
        let count = 0;
        for (const child of ref.current!.children) {
          if ((child as HTMLElement).offsetTop > height) {
            break;
          }
          count++;
        }
        setOverflowCount(
          state.activeState.globals.length +
            state.activeState.config.length +
            state.activeState.options.length -
            count
        );
      } else {
        setOverflowCount(0);
      }
    },
    [state.activeState]
  );

  return (
    <div className={styles.sessionBar}>
      <div ref={ref} className={styles.chips}>
        {activeState.length ? (
          activeState.map(({kind, name, value, type}) => {
            const nameParts = name.split("::");
            return (
              <div
                key={name}
                className={styles.chip}
                onDoubleClick={() => state.openPanel({kind, name})}
              >
                <div className={styles.chipKind}>{kind}</div>
                {nameParts.length > 1 && nameParts[0] !== "default" ? (
                  <span>{nameParts.slice(0, -1).join("::")}::</span>
                ) : null}
                {nameParts[nameParts.length - 1]} :=
                <div className={styles.chipVal}>
                  {renderValueWithType(value, type.data)}
                </div>
              </div>
            );
          })
        ) : (
          <div className={styles.emptySessionBar}>
            {state.draftState
              ? "no configured settings"
              : "loading settings..."}
          </div>
        )}
      </div>
      {state.draftState ? (
        <div className={styles.openPanel} onClick={() => state.openPanel()}>
          <div className={styles.panelButton}>
            {overflowCount ? <span>+{overflowCount}</span> : null}
            <ChevronDownIcon />
          </div>
        </div>
      ) : null}
    </div>
  );
});

function SessionEditorPanel({show}: {show: boolean}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (show && !shouldRender) {
      setShouldRender(true);
    }
    if (!show && shouldRender) {
      ref.current?.addEventListener(
        "transitionend",
        () => setShouldRender(false),
        {once: true}
      );
    }
  }, [show, shouldRender]);

  return (
    <div
      ref={ref}
      className={cn(styles.editorPanel, {[styles.panelVisible]: show})}
    >
      {shouldRender ? <SessionEditorPanelContent /> : null}
    </div>
  );
}

const SessionEditorPanelContent = observer(
  function SessionEditorPanelContent() {
    const dbState = useDatabaseState();
    const sessionState = dbState.sessionState;

    const [searchFilter, setSearchFilter] = useState("");

    useEffect(() => {
      const listener = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          sessionState.closePanel();
        }
      };
      window.addEventListener("keydown", listener);
      return () => window.removeEventListener("keydown", listener);
    }, []);

    const filteredGlobals = searchFilter
      ? fuzzysort.go(searchFilter, sessionState.indexedSchemaGlobals, {
          key: "indexed",
        })
      : sessionState.indexedSchemaGlobals.map((item) => ({obj: item}));
    const filteredConfigs = searchFilter
      ? fuzzysort.go(searchFilter, sessionState.configNamesIndex)
      : sessionState.configNames;
    const filteredOptions = searchFilter
      ? fuzzysort.go(searchFilter, queryOptions, {key: "indexed"})
      : queryOptions.map((opt) => ({obj: opt}));

    return (
      <div className={styles.editorPanelContent}>
        <div
          className={styles.closePanel}
          onClick={() => sessionState.closePanel()}
        >
          <CloseIcon />
        </div>
        <div className={styles.searchBar}>
          <div className={styles.search}>
            <SearchIcon />
            <input
              placeholder="search..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
          </div>
        </div>
        <div className={styles.grid}>
          <div className={styles.group}>
            <div className={styles.header}>Globals</div>

            {filteredGlobals.length ? (
              <ListWrapper>
                {filteredGlobals.map((item) => (
                  <ListGlobalItem
                    key={item.obj.global.id}
                    schemaGlobal={item.obj.global}
                    sessionState={sessionState}
                    highlight={
                      searchFilter
                        ? (fuzzysort.indexes(item as any) as any)
                        : undefined
                    }
                  />
                ))}
              </ListWrapper>
            ) : (
              <div className={styles.emptyItem}>
                {searchFilter ? "no matching globals" : "no globals in schema"}
              </div>
            )}
          </div>

          <div className={styles.group}>
            <div className={styles.header}>Config</div>

            {filteredConfigs.length ? (
              <ListWrapper>
                {filteredConfigs.map((item: any) => (
                  <ListConfigItem
                    key={searchFilter ? item.target : item}
                    name={searchFilter ? item.target : item}
                    sessionState={sessionState}
                    highlight={
                      searchFilter
                        ? (fuzzysort.indexes(item) as any)
                        : undefined
                    }
                  />
                ))}
              </ListWrapper>
            ) : (
              <div className={styles.emptyItem}>no matching config</div>
            )}
          </div>

          <div className={styles.group}>
            <div className={styles.header}>Query Options</div>

            {filteredOptions.length ? (
              <ListWrapper>
                {filteredOptions.map((item) => (
                  <ListQueryOptionItem
                    key={item.obj.name}
                    opt={item.obj}
                    sessionState={sessionState}
                    highlight={
                      searchFilter
                        ? (fuzzysort.indexes(item as any) as any)
                        : undefined
                    }
                  />
                ))}
              </ListWrapper>
            ) : (
              <div className={styles.emptyItem}>no matching options</div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

function ListWrapper({children}: PropsWithChildren<{}>) {
  return (
    <CustomScrollbars
      className={styles.listWrapper}
      innerClass={styles.listInner}
    >
      <div className={styles.list}>
        <div className={styles.listInner}>{children}</div>
      </div>
    </CustomScrollbars>
  );
}

function ListItem({
  state,
  active,
  onActiveToggle,
  name,
  type,
  value,
  onChange,
  defaultValue,
  allowNull,
  highlighted,
  description,
  validator,
}: {
  state: SessionState;
  active: boolean;
  onActiveToggle?: () => void;
  name: JSX.Element | string;
  type: SchemaType;
  value: any;
  onChange: (val: any, err: boolean) => void;
  defaultValue?: JSX.Element | string;
  allowNull?: boolean;
  highlighted: boolean;
  description?: string;
  validator?: InputValidator;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const Input = getInputComponent(type);

  useEffect(() => {
    if (highlighted) {
      ref.current?.scrollIntoView();
      const timeout = setTimeout(() => state.clearHighlight(), 2000);

      return () => clearTimeout(timeout);
    }
  }, []);

  return (
    <div
      ref={ref}
      className={cn(styles.item, {
        [styles.inactive]: !active,
        [styles.highlighted]: highlighted,
      })}
    >
      <ToggleSwitch
        className={styles.activeToggle}
        checked={active}
        onChange={onActiveToggle!}
      />

      <div className={styles.itemHeader}>
        <div className={styles.headerInner}>
          <div className={styles.itemName}>{name}</div>
          <div className={styles.itemType}>{`<${type.name}>`}</div>
        </div>
        {description ? (
          <span className={styles.itemDesc}>{description}</span>
        ) : null}
      </div>

      <div className={cn(styles.itemValue, {[styles.inactive]: !active})}>
        {active ? (
          <>
            <Input
              type={type}
              stringMode
              value={value}
              onChange={onChange}
              allowNull={allowNull}
              validator={validator}
            />
            {allowNull ? (
              <div
                className={cn(styles.setNullButton, {
                  [styles.disabled]: value === null,
                })}
                onClick={() => onChange(null, false)}
              >
                {"{}"}
              </div>
            ) : null}
          </>
        ) : (
          defaultValue
        )}
      </div>
    </div>
  );
}

const ListGlobalItem = observer(function ListGlobalItem({
  schemaGlobal,
  sessionState,
  highlight,
}: {
  schemaGlobal: SchemaGlobal;
  sessionState: SessionState;
  highlight?: number[];
}) {
  const state = sessionState.draftState?.globals[schemaGlobal.name];

  return (
    <ListItem
      state={sessionState}
      name={
        highlight ? (
          highlightString(schemaGlobal.name, highlight, styles.nameMatch)
        ) : (
          <>
            <span>{schemaGlobal.module + "::"}</span>
            {schemaGlobal.shortName}
          </>
        )
      }
      active={state?.active ?? false}
      onActiveToggle={() => sessionState.toggleGlobalActive(schemaGlobal)}
      type={schemaGlobal.target}
      value={state?.value}
      onChange={(val, err) => sessionState.updateItemValue(state!, val, err)}
      defaultValue={schemaGlobal.default ?? `{}`}
      allowNull={schemaGlobal.default != null}
      highlighted={
        sessionState.highlight?.kind === "g" &&
        sessionState.highlight.name === schemaGlobal.name
      }
      description={
        schemaGlobal.annotations.find(
          (anno) => anno.name === "std::description"
        )?.["@value"]
      }
    />
  );
});

const ListConfigItem = observer(function ListConfigItem({
  name,
  sessionState,
  highlight,
}: {
  name: string;
  sessionState: SessionState;
  highlight?: number[];
}) {
  const state = sessionState.draftState?.config[name]!;

  return (
    <ListItem
      state={sessionState}
      name={
        highlight ? highlightString(name, highlight, styles.nameMatch) : name
      }
      active={state.active}
      onActiveToggle={() => sessionState.toggleConfigActive(name)}
      type={state.type.data}
      value={state.value}
      onChange={(val, err) => sessionState.updateItemValue(state, val, err)}
      defaultValue={
        sessionState.configValues
          ? renderValueWithType(
              sessionState.configValues[name],
              state.type.data
            )
          : "fetching..."
      }
      highlighted={
        sessionState.highlight?.kind === "c" &&
        sessionState.highlight.name === name
      }
      description={state.description}
    />
  );
});

const ListQueryOptionItem = observer(function ListQueryOptionItem({
  opt,
  sessionState,
  highlight,
}: {
  opt: typeof queryOptions[number];
  sessionState: SessionState;
  highlight?: number[];
}) {
  const state = sessionState.draftState?.options[opt.name]!;

  return (
    <ListItem
      state={sessionState}
      active={state.active}
      onActiveToggle={() => sessionState.toggleOptionActive(opt.name)}
      name={
        highlight
          ? highlightString(opt.name, highlight, styles.nameMatch)
          : opt.name
      }
      type={state.type.data}
      value={state.value}
      onChange={(val, err) => sessionState.updateItemValue(state, val, err)}
      highlighted={
        sessionState.highlight?.kind === "o" &&
        sessionState.highlight.name === opt.name
      }
      validator={opt.validator}
    />
  );
});
