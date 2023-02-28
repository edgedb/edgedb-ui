import {action, computed, observable} from "mobx";
import {
  frozen,
  Frozen,
  FrozenCheckMode,
  model,
  Model,
  prop,
} from "mobx-keystone";
import {instanceCtx} from "../../state/instance";
import {
  EditorKind,
  queryEditorCtx,
  QueryHistoryResultItem,
} from "../../tabs/queryEditor/state";
import {getColor} from "./colormap";

export function createExplainState(rawExplainOutput: string) {
  const rawData = JSON.parse(rawExplainOutput)[0];

  const contexts: Contexts = [];
  const planTree = walkPlanNode(
    rawData.Plan,
    rawData.Plan["FullTotalTime"] ?? null,
    rawData.Plan["Total Cost"],
    contexts
  );

  return new ExplainState({
    rawData: rawExplainOutput,
    planTree: frozen(planTree, FrozenCheckMode.Off),
    contexts: frozen(contexts),
    buffers: frozen(rawData.Buffers.map((buf: any) => buf[0]).slice(1)),
    flamegraphType: planTree.totalTime != null ? "time" : "cost",
  });
}

@model("ExplainState")
export class ExplainState extends Model({
  rawData: prop<string>(),
  planTree: prop<Frozen<Plan>>(),
  contexts: prop<Frozen<Contexts>>(),
  buffers: prop<Frozen<string[]>>(),

  ctxId: prop<number | null>(null).withSetter(),

  showFlamegraph: prop(false).withSetter(),
  flamegraphType: prop<"cost" | "time">().withSetter(),
  flamegraphZoom: prop<number>(1).withSetter(),
}) {
  @observable.ref
  selectedPlan: Plan | null = null;

  @action
  setSelectedPlan(plan: Plan | null) {
    this.selectedPlan = plan;
  }

  @observable.ref
  focusedPlan: Plan | null = null;

  @action
  setFocusedPlan(plan: Plan | null) {
    this.focusedPlan = plan;
  }

  @observable.shallow
  expandedNodes = new Set<Plan>();

  @action
  toggleCollapsed(node: Plan) {
    if (this.expandedNodes.has(node)) {
      this.expandedNodes.delete(node);
    } else {
      this.expandedNodes.add(node);
    }
  }

  @computed
  get isTimeGraph() {
    return this.flamegraphType === "time";
  }

  copyRawDataToClipboard() {
    navigator.clipboard?.writeText(
      JSON.stringify(JSON.parse(this.rawData), null, 2)
    );
  }

  @computed
  get contextsByBufIdx() {
    const ctxs = this.contexts.data.reduce((ctxs, ctx) => {
      if (ctxs[ctx.bufIdx] == null) {
        ctxs[ctx.bufIdx] = [];
      }
      ctxs[ctx.bufIdx].push(ctx);
      return ctxs;
    }, [] as Contexts[]);
    for (const ctx of ctxs) {
      ctx?.sort((a, b) => a.start - b.start);
    }
    return ctxs;
  }
}

export function reRunWithAnalyze(queryHistoryItem: QueryHistoryResultItem) {
  if (queryHistoryItem.queryData.data.kind !== EditorKind.EdgeQL) {
    throw new Error("expected edgeql query kind");
  }
  const queryEditor = queryEditorCtx.get(queryHistoryItem);
  if (!queryEditor) {
    throw new Error("failed to find queryEditor ctx");
  }

  const {query, params} = queryHistoryItem.queryData.data;

  const updatedQuery = query.replace(/\bexplain\b/i, "explain analyze");

  queryEditor
    ._runStatement(updatedQuery, params?.data ?? null)
    .then(() => queryEditor.setHistoryCursor(0));
}

function nodesEqual(l: Plan[], r: Plan[]) {
  if (l.length !== r.length) {
    return false;
  }
  for (let i = 0; i < l.length; i++) {
    if (l[i] != r[i]) return false;
  }
  return true;
}

export interface Plan {
  parent: Plan | null;
  type: string;
  totalTime: number | null;
  totalCost: number;
  selfTime: number | null;
  selfCost: number;
  selfTimePercent: number | null;
  selfCostPercent: number;
  subPlans?: Plan[];
  nearestContextPlan?: Plan;
  contextId: number | null;
  hasCollapsedPlans: boolean;
  fullSubPlans: Plan[];
  raw: any;
}

export interface Context {
  id: number;
  bufIdx: number;
  start: number;
  end: number;
  text: string;
  selfTimePercent?: number;
  selfCostPercent: number;
  color: string;
  linkedBufIdx: number | null;
}

export type Contexts = Context[];

export function walkPlanNode(
  data: any,
  queryTotalTime: number | null,
  queryTotalCost: number,
  contexts: Contexts,
  _replacedPlanNodes?: any[]
): Plan {
  const _childContextNodes =
    data.CollapsedPlans || data.NearestContextPlan
      ? [data.NearestContextPlan, ...(data.CollapsedPlans ?? [])]
      : undefined;

  const replacedPlanNodes = _childContextNodes ?? _replacedPlanNodes!;
  const fullSubPlans: Plan[] = Array.isArray(data.Plans)
    ? data.Plans.map((subplan: any) => {
        const plan = walkPlanNode(
          typeof subplan === "number" ? replacedPlanNodes[subplan] : subplan,
          queryTotalTime,
          queryTotalCost,
          contexts,
          replacedPlanNodes
        );
        if (typeof subplan === "number") {
          replacedPlanNodes[subplan] = plan;
        }
        return plan;
      })
    : [];

  const selfTime = data.CollapsedSelfTime || data.SelfTime;
  const selfCost = data.CollapsedSelfCost || data.SelfCost;
  const selfTimePercent = selfTime && selfTime / queryTotalTime!;
  const selfCostPercent = selfCost / queryTotalCost;

  let contextId = null;

  if (data.Contexts) {
    const rawCtxs = data.Contexts;
    const rawCtx = rawCtxs[data.SuggestedDisplayCtxIdx ?? 0];

    const ctx = contexts.find(
      (ctx) =>
        ctx.bufIdx === rawCtx.buffer_idx &&
        ctx.start === rawCtx.start &&
        ctx.end === rawCtx.end
    );
    if (!ctx) {
      contextId = contexts.length;

      const linked = [...rawCtxs]
        .reverse()
        .find((lctx) => lctx.buffer_idx !== rawCtx.buffer_idx);

      contexts.push({
        id: contextId,
        bufIdx: rawCtx.buffer_idx,
        start: rawCtx.start,
        end: rawCtx.end,
        text: rawCtx.text,
        selfTimePercent,
        selfCostPercent,
        color: getColor(selfTimePercent ?? selfCostPercent),
        linkedBufIdx: linked?.buffer_idx ?? null,
      });
    } else {
      contextId = ctx.id;
    }
  }

  const [nearestContextPlan, ..._subPlans] = _childContextNodes ?? [];

  const subPlans = [
    ...(nearestContextPlan?.subPlans ?? []),
    ..._subPlans,
  ].sort((a, b) => b.totalTime - a.totalTime);

  const plan = {
    parent: null,
    type: data["Node Type"],
    totalTime: data.FullTotalTime,
    totalCost: data["Total Cost"],
    selfTime,
    selfCost,
    selfTimePercent,
    selfCostPercent,
    contextId,
    subPlans,
    nearestContextPlan,
    fullSubPlans,
    hasCollapsedPlans:
      !!_childContextNodes && !nodesEqual(fullSubPlans, subPlans),
    raw: data,
  };

  for (const subplan of subPlans) {
    subplan.parent = plan;
  }

  return plan;
}

// Result of explain query is output as a json string containing a tree of plan
// nodes. Where possible plans are annotated with `Contexts`, a list of
// locations in the original query or schema that map to the plan node.
// On Plans with `Contexts`, the `SuggestedDisplayCtxIdx` field is the index of
// the widest context that the plan does not share with sibling or parent
// plan nodes.
//
// interface ExplainOutput {
//   Buffers: [
//     string, // query string or schema snippet
//     string // source
//   ][],
//   Plan: PlanNode
// }
//
// interface PlanNode {
//   "Node Type": string,
//   CollapsedPlans: PlanNode[],
//   Plans: (PlanNode | number)[],
//   NearestContextPlan?: PlanNode,
//   Contexts?: {
//     start: number,
//     end: number,
//     buffer_idx: number,
//     text: string
//   }[]
//   SuggestedDisplayCtxIdx?: number;
// }
