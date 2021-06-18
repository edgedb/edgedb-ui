import {observer} from "mobx-react";

import cn from "@edgedb/common/utils/classNames";

import styles from "./repl.module.scss";
import tabStyles from "../tabView/tabView.module.scss";

import {useTabState} from "../../state/providers";

import SplitView from "../../ui/splitView";
import Button from "../../ui/button";

import QueryEditor from "../queryEditor";
import ReplHistory from "./replHistory";
import ParamEditorPanel from "./paramEditor";
import {TransactionState} from "../../state/models/connection";

export default observer(function ReplView() {
  const replState = useTabState().replView;

  return (
    <>
      <div className={cn(tabStyles.card, styles.repl)}>
        <SplitView
          views={[
            <div className={styles.editorBlock}>
              <QueryEditor
                query={replState.currentQuery}
                onChange={(value) => replState.setCurrentQuery(value)}
                onRun={() => replState.runQuery()}
              />
              <ParamEditorPanel />
            </div>,
            <ReplHistory />,
          ]}
          state={replState.splitView}
          minViewSize={20}
        />
      </div>
      <div className={cn(tabStyles.toolbar)}>
        <Button
          label="Run"
          shortcut="Ctrl+Enter"
          colour="green"
          disabled={!replState.canRunQuery}
          onClick={() => replState.runQuery()}
        />
        {replState.currentTransaction ? (
          <>
            {replState.currentTransaction.state === TransactionState.Active ? (
              <Button
                label="Commit"
                onClick={() => replState.runSingleQuery("COMMIT")}
              />
            ) : null}
            <Button
              label="Rollback"
              onClick={() => replState.runSingleQuery("ROLLBACK")}
            />
          </>
        ) : (
          <>
            <Button
              label="Start Transaction"
              onClick={() => replState.runSingleQuery("START TRANSACTION")}
            />
          </>
        )}
      </div>
    </>
  );
});
