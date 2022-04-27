import {useEffect, useRef} from "react";
import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import {CodeEditor, CodeEditorRef} from "@edgedb/code-editor";

import styles from "./repl.module.scss";

import {useDatabaseState, useTabState} from "../../state";
import {Repl} from "./state";

import {DatabaseTabSpec} from "../../components/databasePage";

import {Theme, useTheme} from "@edgedb/common/hooks/useTheme";

import SplitView from "@edgedb/common/ui/splitView";
import Button from "@edgedb/common/ui/button";

import ReplHistory from "./replHistory";
import ParamEditorPanel from "./paramEditor";
import {TabReplIcon} from "../../icons";

export const ReplView = observer(function ReplView() {
  const dbState = useDatabaseState();
  const replState = useTabState(Repl);

  const [theme] = useTheme();

  const codeEditorRef = useRef<CodeEditorRef>();

  useEffect(() => {
    codeEditorRef.current?.focus();
  }, []);

  return (
    <>
      <div className={cn(styles.repl)}>
        <SplitView
          views={[
            <div className={styles.editorBlock}>
              <CodeEditor
                ref={codeEditorRef}
                code={replState.currentQuery}
                onChange={(value) => replState.setCurrentQuery(value)}
                keybindings={[
                  {
                    key: "Mod-Enter",
                    run: () => {
                      replState.runQuery();
                      return true;
                    },
                    preventDefault: true,
                  },
                ]}
                useDarkTheme={theme === Theme.dark}
                schemaObjects={dbState.schemaData?.data.objects}
              />
              <div className={styles.replEditorOverlays}>
                <div className={styles.controls}>
                  <Button
                    className={styles.runButton}
                    label="Run"
                    shortcut="Ctrl+Enter"
                    macShortcut="⌘+Enter"
                    disabled={!replState.canRunQuery}
                    loading={replState.queryRunning}
                    onClick={() => replState.runQuery()}
                  />
                  <label>
                    <input
                      type="checkbox"
                      checked={replState.persistQuery}
                      onChange={(e) => {
                        replState.setPersistQuery(e.target.checked);
                      }}
                    />
                    Persist Query
                  </label>
                </div>
                <ParamEditorPanel />
              </div>
            </div>,
            <ReplHistory />,
          ]}
          state={replState.splitView}
          minViewSize={20}
        />
      </div>
    </>
  );
});

export const replTabSpec: DatabaseTabSpec = {
  path: "repl",
  label: "REPL",
  icon: (active) => <TabReplIcon active={active} />,
  state: Repl,
  element: <ReplView />,
};
