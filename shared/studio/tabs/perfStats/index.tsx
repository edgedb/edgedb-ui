import {observer} from "mobx-react-lite";

import cn from "@edgedb/common/utils/classNames";

import {PerfStatsState} from "./state";
import {DatabaseTabSpec} from "../../components/databasePage";
import {TabDashboardIcon} from "../../icons";

import {useTabState} from "../../state";

import styles from "./perfStats.module.scss";
import {useEffect} from "react";
import {StatsTable} from "./statsTable";
import {AnalyzeQueryPanel} from "./analyze";
import {StatsChart} from "./statsChart";

export const PerformanceStats = observer(function PerformanceStats() {
  const state = useTabState(PerfStatsState);

  useEffect(() => {
    state.fetchQueryStats();
  }, []);

  return (
    <>
      <div
        className={cn(styles.perfStats, {
          [styles.popupPanelOpen]: state.analyzeQuery !== null,
        })}
      >
        <div className={styles.content}>
          <StatsChart state={state} />

          <StatsTable state={state} />
        </div>
      </div>

      {state.analyzeQuery ? (
        <AnalyzeQueryPanel
          state={state.analyzeQuery}
          onClose={() => state.closeAnalyzeQuery()}
        />
      ) : null}
    </>
  );
});

export const perfStatsTabSpec: DatabaseTabSpec = {
  path: "perf-stats",
  label: "Perf Stats",
  icon: (active) => <TabDashboardIcon active={active} />,
  usesSessionState: false,
  element: <PerformanceStats />,
  state: PerfStatsState,
};
