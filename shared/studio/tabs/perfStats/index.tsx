import {observer} from "mobx-react-lite";

import {PerfStatsState} from "./state";
import {DatabaseTabSpec} from "../../components/databasePage";
import {TabDashboardIcon} from "../../icons";

import {useTabState} from "../../state";

import styles from "./perfStats.module.scss";
import {useEffect} from "react";
import {StatsTable} from "./statsTable";

export const PerformanceStats = observer(function PerformanceStats() {
  const state = useTabState(PerfStatsState);

  useEffect(() => {
    state.fetchQueryStats();
  }, []);

  return (
    <div className={styles.perfStats}>
      <div className={styles.content}>
        <StatsTable state={state} />
      </div>
    </div>
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
