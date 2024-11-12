import {observer} from "mobx-react-lite";

import {CrossIcon} from "@edgedb/common/newui";
import {ExplainCodeBlock} from "../../components/explainVis/codeblock";

import {AnalyseQueryState} from "./state";

import styles from "./perfStats.module.scss";
import {ExplainVis} from "../../components/explainVis";
import Spinner from "@edgedb/common/ui/spinner";
import {ExplainHighlightsRenderer} from "../../components/explainVis/codeEditorContexts";

export const AnalyzeQueryPanel = observer(function AnalyzeQueryPanel({
  state,
  onClose,
}: {
  state: AnalyseQueryState;
  onClose: () => void;
}) {
  return (
    <div className={styles.analyzePanel}>
      <div className={styles.panelHeader}>
        <div className={styles.closePanel} onClick={onClose}>
          <CrossIcon />
        </div>
      </div>
      <div className={styles.panelContent}>
        <div className={styles.query}>
          <ExplainCodeBlock
            className={styles.code}
            code={state.query}
            explainContexts={state.explainState?.contextsByBufIdx[0] ?? []}
          />
          {state.explainState ? (
            <ExplainHighlightsRenderer
              // ref={explainHighlightsRef}
              state={state.explainState}
              isEditor={false}
            />
          ) : null}
        </div>
        <div className={styles.explain}>
          {state.explainState ? (
            <ExplainVis state={state.explainState} />
          ) : (
            <Spinner className={styles.loading} size={20} />
          )}
        </div>
      </div>
    </div>
  );
});
