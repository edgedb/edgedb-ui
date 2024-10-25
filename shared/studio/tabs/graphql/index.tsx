import {useRef, useEffect} from "react";
import {observer} from "mobx-react-lite";

import {jsonLanguage, json} from "@codemirror/lang-json";

import cn from "@edgedb/common/utils/classNames";
import SplitView from "@edgedb/common/ui/splitView";
import {Theme, useTheme} from "@edgedb/common/hooks/useTheme";
import {CodeEditor, CodeEditorRef} from "@edgedb/code-editor";
import CodeBlock from "@edgedb/common/ui/codeBlock";

import styles from "./graphql.module.scss";

import {useDatabaseState, useTabState} from "../../state";
import {DatabaseTabSpec} from "../../components/databasePage";

import {GraphQL} from "./state";
import {GraphQLLanguage} from "./lang";

import {ChevronDownIcon, TabGraphQlIcon} from "../../icons";
import Button from "@edgedb/common/ui/button";

const JSONLang = json();

export const GraphQLView = observer(function GraphQLView() {
  const dbState = useDatabaseState();

  return (
    <div className={styles.graphql}>
      {dbState.schemaData ? (
        dbState.schemaData.extensions.some((ext) => ext.name === "graphql") ? (
          <_GraphQLView />
        ) : (
          <div className={styles.notEnabled}>
            The GraphQL extension is not enabled
          </div>
        )
      ) : (
        <div className={styles.loadingPanel}>Fetching schema...</div>
      )}
    </div>
  );
});

export const graphqlTabSpec: DatabaseTabSpec = {
  path: "graphql",
  label: "GraphQL",
  icon: (active) => <TabGraphQlIcon active={active} />,
  state: GraphQL,
  element: <GraphQLView />,
  usesSessionState: false,
};

const _GraphQLView = observer(function _GraphQLView() {
  const gqlState = useTabState(GraphQL);

  const [theme] = useTheme();

  const codeEditorRef = useRef<CodeEditorRef>();

  useEffect(() => {
    codeEditorRef.current?.focus();
    gqlState.fetchSchema();
  }, []);

  return (
    <SplitView
      views={[
        <div className={styles.editor}>
          <CodeEditor
            ref={codeEditorRef}
            code={gqlState.currentQuery}
            onChange={(value) => gqlState.setCurrentQuery(value)}
            keybindings={[
              {
                key: "Mod-Enter",
                run: () => {
                  gqlState.runQuery();
                  return true;
                },
                preventDefault: true,
              },
            ]}
            useDarkTheme={theme === Theme.dark}
            // language={GraphQLLanguage(gqlState.schema)}
          />
          <div className={styles.editorOverlays}>
            <div className={styles.controls}>
              <Button
                className={styles.runButton}
                label="Run"
                shortcut="Ctrl+Enter"
                macShortcut="⌘+Enter"
                disabled={
                  gqlState.currentQuery.length === 0 ||
                  !!gqlState.queryVarsError
                }
                loading={gqlState.queryRunning}
                onClick={() => gqlState.runQuery()}
              />
            </div>
            <VariablesEditor />
          </div>
        </div>,
        <div className={styles.output}>
          {gqlState.queryError ? (
            <div className={styles.queryError}>{gqlState.queryError}</div>
          ) : gqlState.result ? (
            <CodeBlock
              className={styles.resultJson}
              code={gqlState.result}
              language={jsonLanguage}
            />
          ) : null}
        </div>,
      ]}
      state={gqlState.splitView}
      minViewSize={20}
    />
  );
});

const VariablesEditor = observer(function VariablesEditor() {
  const gqlState = useTabState(GraphQL);

  const [theme] = useTheme();

  return (
    <div
      className={cn(styles.varsEditor, {
        [styles.varsEditorOpen]: gqlState.varsEditorOpen,
      })}
    >
      <div
        className={styles.header}
        onClick={() => gqlState.toggleVarsEditorOpen()}
      >
        <div className={styles.panelToggle}>
          <ChevronDownIcon />
        </div>
        Query Variables
        <div className={styles.error}>{gqlState.queryVarsError}</div>
      </div>

      <div className={styles.varsCodeEditor}>
        <CodeEditor
          code={gqlState.queryVariables}
          onChange={(value) => gqlState.setQueryVariables(value)}
          useDarkTheme={theme === Theme.dark}
          // language={JSONLang}
        />
      </div>
    </div>
  );
});
