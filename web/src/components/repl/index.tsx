import {useEffect, useRef} from "react";
import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import {CodeEditor, CodeEditorRef} from "@edgedb/code-editor";

import styles from "./repl.module.scss";

import {useAppState, useDatabaseState} from "src/state/providers";
import {Theme} from "src/state/models/app";

import SplitView from "src/ui/splitView";
import Button from "src/ui/button";

import ReplHistory from "./replHistory";
import ParamEditorPanel from "./paramEditor";

export default observer(function ReplView() {
  const appState = useAppState();
  const replState = useDatabaseState().replState;

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
                useDarkTheme={appState.theme === Theme.dark}
              />
              <div className={styles.replEditorOverlays}>
                <Button
                  className={styles.runButton}
                  label="Run"
                  shortcut="Ctrl+Enter"
                  macShortcut="⌘+Enter"
                  disabled={!replState.canRunQuery}
                  loading={replState.queryRunning}
                  onClick={() => replState.runQuery()}
                />
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
