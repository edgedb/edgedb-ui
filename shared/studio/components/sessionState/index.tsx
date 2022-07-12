import {useRef, useState, useEffect} from "react";
import {createPortal} from "react-dom";
import {observer} from "mobx-react-lite";

import cn from "@edgedb/common/utils/classNames";

import {DatabaseState} from "../../state/database";

import styles from "./sessionState.module.scss";
import {getInputComponent} from "../dataEditor";
import {ChevronDownIcon, DeleteIcon, PlusIcon} from "../../icons";

export function SessionStateControls() {
  return <div id="sessionStateControls" />;
}

export const SessionState = observer(function ({
  dbState,
}: {
  dbState: DatabaseState;
}) {
  const targetEl = document.getElementById("sessionStateControls");

  if (targetEl && dbState.schemaData?.globals.size) {
    return createPortal(<SessionGlobals dbState={dbState} />, targetEl);
  }
  return null;
});

const SessionGlobals = observer(function SessionGlobals({
  dbState,
}: {
  dbState: DatabaseState;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dataGetter = useRef<() => typeof dbState.connection.sessionGlobals>();

  const fetchingSchemaData = dbState.fetchingSchemaData;

  function closePanel() {
    dbState.connection.setSessionGlobals(dataGetter.current!());
    setPanelOpen(false);
  }

  useEffect(() => {
    if (fetchingSchemaData) {
      setPanelOpen(false);
    }
  }, [fetchingSchemaData]);

  useEffect(() => {
    if (panelOpen) {
      const listener = (e: MouseEvent) => {
        if (!panelRef.current?.contains(e.target as Node)) {
          closePanel();
        }
      };

      window.addEventListener("mousedown", listener, {capture: true});

      return () => {
        window.removeEventListener("mousedown", listener, {capture: true});
      };
    }
  }, [panelOpen]);

  const globalsCount = Object.keys(dbState.connection.sessionGlobals).length;

  return (
    <div
      className={cn(styles.globals, {
        [styles.disabled]: fetchingSchemaData,
      })}
    >
      <div className={styles.globalsButton} onClick={() => setPanelOpen(true)}>
        Globals {globalsCount ? <span>&nbsp;· {globalsCount}</span> : null}
        <ChevronDownIcon />
      </div>
      {panelOpen ? (
        <div ref={panelRef} className={styles.globalsPanel}>
          <SessionGlobalsPanel
            dbState={dbState}
            setDataGetter={(getter) => (dataGetter.current = getter)}
          />
        </div>
      ) : null}
    </div>
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
    <>
      {[...(dbState.schemaData?.globals.values() ?? [])].map((g, i) => {
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
                    onClick={() => setValues({...values, [g.name]: undefined})}
                  >
                    <DeleteIcon />
                  </button>
                </>
              ) : (
                <button
                  className={styles.button}
                  onClick={() =>
                    setValues({...values, [g.name]: {value: null, err: true}})
                  }
                >
                  <PlusIcon />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
});
