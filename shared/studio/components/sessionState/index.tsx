import {
  useRef,
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  ForwardedRef,
  useCallback,
} from "react";
import {createPortal} from "react-dom";
import {observer} from "mobx-react-lite";

import cn from "@edgedb/common/utils/classNames";

import {DatabaseState} from "../../state/database";

import styles from "./sessionState.module.scss";
import {getInputComponent} from "../dataEditor";
import {ChevronDownIcon, DeleteIcon, PlusIcon} from "../../icons";
import {settingsState} from "../../state/settings";

export function SessionStateControls() {
  return <div id="sessionStateControls" />;
}

export const SessionState = observer(function ({
  dbState,
}: {
  dbState: DatabaseState;
}) {
  const targetEl = document.getElementById("sessionStateControls");

  if (targetEl) {
    return createPortal(
      <div className={styles.sessionState}>
        {dbState.schemaData?.globals.size ? (
          <SessionGlobals dbState={dbState} />
        ) : null}
        <SessionConfig />
      </div>,
      targetEl
    );
  }
  return null;
});

interface PanelRef {
  cancelOpenPanel: () => void;
}

const Panel = forwardRef(function (
  {
    label,
    modified,
    content,
    onOpen,
    onClose,
    disabled,
  }: {
    label: string | JSX.Element;
    modified: boolean;
    content: JSX.Element;
    onOpen?: () => void;
    onClose: () => void;
    disabled?: boolean;
  },
  ref: ForwardedRef<PanelRef>
) {
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    cancelOpenPanel() {
      setPanelOpen(false);
    },
  }));

  useEffect(() => {
    if (panelOpen) {
      const listener = (e: MouseEvent) => {
        if (!panelRef.current?.contains(e.target as Node)) {
          onClose();
          setPanelOpen(false);
        }
      };

      window.addEventListener("mousedown", listener, {capture: true});

      return () => {
        window.removeEventListener("mousedown", listener, {capture: true});
      };
    }
  }, [panelOpen, onClose]);

  return (
    <div
      className={cn(styles.sessionStateOptions, {
        [styles.disabled]: disabled ?? false,
      })}
    >
      <div
        className={cn(styles.stateButton, {[styles.modified]: modified})}
        onClick={() => {
          onOpen?.();
          setPanelOpen(true);
        }}
      >
        {label}
        <ChevronDownIcon />
      </div>
      {panelOpen ? (
        <div ref={panelRef} className={styles.statePanel}>
          {content}
        </div>
      ) : null}
    </div>
  );
});

const SessionGlobals = observer(function SessionGlobals({
  dbState,
}: {
  dbState: DatabaseState;
}) {
  const dataGetter = useRef<() => typeof dbState.connection.sessionGlobals>();
  const ref = useRef<PanelRef>(null);

  const fetchingSchemaData = dbState.fetchingSchemaData;

  useEffect(() => {
    if (fetchingSchemaData) {
      ref.current?.cancelOpenPanel();
    }
  }, [fetchingSchemaData]);

  const globalsCount = Object.keys(dbState.connection.sessionGlobals).length;

  return (
    <Panel
      ref={ref}
      label={
        <>
          Globals {globalsCount ? <span>&nbsp;· {globalsCount}</span> : null}
        </>
      }
      modified={globalsCount > 0}
      content={
        <SessionGlobalsPanel
          dbState={dbState}
          setDataGetter={(getter) => (dataGetter.current = getter)}
        />
      }
      onClose={() => {
        dbState.connection.setSessionGlobals(dataGetter.current!());
      }}
      disabled={fetchingSchemaData}
    />
  );
});

const SessionGlobalsPanel = observer(function SessionGlobalsPanel({
  dbState,
  setDataGetter,
}: {
  dbState: DatabaseState;
  setDataGetter: (
    getter: () => typeof dbState.connection.sessionGlobals
  ) => void;
}) {
  const [values, setValues] = useState(() =>
    Object.entries(dbState.connection.sessionGlobals).reduce(
      (g, [name, {value}]) => {
        g[name] = {value, err: false};
        return g;
      },
      {} as {[name: string]: {value: any; err: boolean} | undefined}
    )
  );

  useEffect(() => {
    setDataGetter(() => {
      const schemaGlobals = [...(dbState.schemaData?.globals.values() ?? [])];
      return Object.entries(values).reduce((globals, [name, data]) => {
        if (data) {
          const type = schemaGlobals.find((g) => g.name === name);
          if (type && !data.err) {
            globals[name] = {value: data.value, typeId: type.target.id};
          }
        }
        return globals;
      }, {} as typeof dbState.connection.sessionGlobals);
    });
  }, [values]);

  return (
    <div className={styles.globalsGrid}>
      {[...(dbState.schemaData?.globals.values() ?? [])]
        .filter((g) => !g.expr)
        .map((g, i) => {
          const Input = getInputComponent(g.target)!;

          return (
            <div className={styles.globalItem} key={i}>
              <div className={styles.globalName}>
                {g.module !== "default" ? <span>{g.module}::</span> : null}
                {g.shortName}
              </div>
              <div className={styles.globalInput}>
                {values[g.name] !== undefined ? (
                  <>
                    <Input
                      type={g.target}
                      // errorMessageAbove={lastParam}
                      value={values[g.name]!.value}
                      depth={2}
                      onChange={(value, err) => {
                        setValues({...values, [g.name]: {value, err}});
                      }}
                    />
                    <button
                      className={styles.button}
                      onClick={() =>
                        setValues({...values, [g.name]: undefined})
                      }
                    >
                      <DeleteIcon />
                    </button>
                  </>
                ) : (
                  <button
                    className={styles.button}
                    onClick={() =>
                      setValues({
                        ...values,
                        [g.name]: {value: null, err: true},
                      })
                    }
                  >
                    <PlusIcon />
                  </button>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
});

interface SessionConfig {
  disableAccessPolicies: boolean;
}

const SessionConfig = observer(function SessionConfig() {
  const [config, setConfig] = useState<SessionConfig>(() => ({
    disableAccessPolicies: settingsState.disableAccessPolicies,
  }));

  return (
    <Panel
      label="Config"
      modified={settingsState.disableAccessPolicies}
      content={
        <>
          <label className={styles.configItem}>
            <input
              type="checkbox"
              checked={config.disableAccessPolicies}
              onChange={(e) => {
                setConfig({
                  ...config,
                  disableAccessPolicies: e.target.checked,
                });
              }}
            />
            Disable Access Policies
          </label>
        </>
      }
      onOpen={() => {
        setConfig({
          disableAccessPolicies: settingsState.disableAccessPolicies,
        });
      }}
      onClose={() => {
        settingsState.setDisableAccessPolicies(config.disableAccessPolicies);
      }}
    />
  );
});
