import {action, computed, observable, runInAction} from "mobx";
import {
  findParent,
  getTypeInfo,
  Model,
  model,
  ModelTypeInfo,
} from "mobx-keystone";
import {connCtx} from "../../../state";
import {EditorKind, QueryEditor} from "../../queryEditor/state";
import {DatabaseState} from "../../../state/database";

export type QueryType = "EdgeQL" | "SQL";

export interface QueryStats {
  id: string;
  branchName: string;
  query: string;
  query_id: number;
  query_type: QueryType;

  plans: BigInt;
  totalPlanTime: number;
  minPlanTime: number;
  maxPlanTime: number;
  meanPlanTime: number;
  stddevPlanTime: number;

  calls: BigInt;
  totalExecTime: number;
  minExecTime: number;
  maxExecTime: number;
  meanExecTime: number;
  stddevExecTime: number;

  rows: BigInt;
  statsSince: Date;
  minmaxStatsSince: Date;
}

export interface OrderBy {
  field: "calls" | "meanExecTime";
  sortAsc: boolean;
}

@model("PerfStats")
export class PerfStatsState extends Model({}) {
  @observable.ref
  stats: QueryStats[] | null = null;

  @observable
  expandedIds = new Set<string>();

  @action
  toggleExpanded(id: string) {
    if (this.expandedIds.has(id)) {
      this.expandedIds.delete(id);
    } else {
      this.expandedIds.add(id);
    }
  }

  @computed
  get maxExecTime() {
    return Math.max(
      ...(this.filteredStats?.map((stat) => stat.maxExecTime) ?? [])
    );
  }

  @observable
  orderBy: OrderBy = {field: "meanExecTime", sortAsc: false};

  @action
  setOrderBy(field: OrderBy["field"]) {
    if (this.orderBy.field === field) {
      this.orderBy.sortAsc = !this.orderBy.sortAsc;
    } else {
      this.orderBy = {
        field,
        sortAsc: false,
      };
    }
  }

  @computed
  get filteredStats() {
    const orderBy = this.orderBy;
    return this.stats
      ? [...this.stats]
          .sort((a, b) => {
            return Number(
              orderBy.sortAsc
                ? (a[orderBy.field] as number) - (b[orderBy.field] as number)
                : (b[orderBy.field] as number) - (a[orderBy.field] as number)
            );
          })
          .filter((stat) => stat.meanExecTime < 1000)
      : null;
  }

  fetching = false;
  async fetchQueryStats() {
    if (this.fetching) return;
    this.fetching = true;
    const conn = connCtx.get(this)!;

    try {
      const {result} = await conn.query(
        `
      select sys::QueryStats {
        branchName := .branch.name,
        query,
        query_id,
        query_type,

        plans,
        totalPlanTime := duration_get(.total_plan_time, 'milliseconds'),
        minPlanTime := duration_get(.min_plan_time, 'milliseconds'),
        maxPlanTime := duration_get(.max_plan_time, 'milliseconds'),
        meanPlanTime := duration_get(.mean_plan_time, 'milliseconds'),
        stddevPlanTime := duration_get(.stddev_plan_time, 'milliseconds'),
      
        calls,
        totalExecTime := duration_get(.total_exec_time, 'milliseconds'),
        minExecTime := duration_get(.min_exec_time, 'milliseconds'),
        maxExecTime := duration_get(.max_exec_time, 'milliseconds'),
        meanExecTime := duration_get(.mean_exec_time, 'milliseconds'),
        stddevExecTime := duration_get(.stddev_exec_time, 'milliseconds'),
      
        rows,
        statsSince := datetime_get(.stats_since, 'epochseconds'),
        minmaxStatsSince := datetime_get(.minmax_stats_since, 'epochseconds'),
      }
      filter .branch.name = sys::get_current_branch()
    `,
        undefined,
        {ignoreSessionConfig: true}
      );

      runInAction(() => {
        this.stats =
          result?.map((stat) => ({
            id: `${stat.branchName}-${stat.query_id}`,
            ...stat,
            query: stat.query.replace(/^( {4})+/gm, (indent: string) =>
              " ".repeat(indent.length / 2)
            ),
            minmaxStatsSince: new Date(stat.minmaxStatsSince * 1000),
            statsSince: new Date(stat.statsSince * 1000),
          })) ?? [];
      });
    } finally {
      this.fetching = false;
    }
  }

  setAnalyseQuery(query: string) {
    const modelType = (getTypeInfo(QueryEditor) as ModelTypeInfo).modelType;
    const editorState = findParent<DatabaseState>(
      this,
      (p) => p instanceof DatabaseState
    )?.tabStates.get(modelType) as QueryEditor;
    if (!editorState) return;

    editorState.setEdgeQLString(`analyze ${query}`);
    editorState.setSelectedEditor(EditorKind.EdgeQL);
    editorState.runQuery();
  }
}
