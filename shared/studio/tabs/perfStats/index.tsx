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
import {StatsFilters} from "./filters";

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
          <StatsFilters state={state} />

          <StatsChart state={state} />

          <StatsTable state={state} />
        </div>
      </div>

      {state.analyzeQuery ? (
        <AnalyzeQueryPanel
          perfStatsState={state}
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
