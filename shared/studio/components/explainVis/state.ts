import {createContext, useContext} from "react";
import {action, computed, observable} from "mobx";
import {
  frozen,
  Frozen,
  FrozenCheckMode,
  model,
  Model,
  modelAction,
  prop,
} from "mobx-keystone";
import {
  explainGraphSettings,
  graphUnit,
} from "../../state/explainGraphSettings";
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
    rawData.plan,
    rawData.plan.full_total_time ?? null,
    rawData.plan.total_cost,
    contexts
  );

  explainGraphSettings.setGraphUnit(
    planTree.totalTime == null ||
      explainGraphSettings.userUnitChoice === graphUnit.cost
      ? graphUnit.cost
      : graphUnit.time
  );

  return new ExplainState({
    rawData: rawExplainOutput,
    planTree: frozen(planTree, FrozenCheckMode.Off),
    contexts: frozen(contexts),
    buffers: frozen(rawData.buffers.map((buf: any) => buf[0]).slice(1)),
  });
}

@model("ExplainState")
export class ExplainState extends Model({
  rawData: prop<string>(),
  planTree: prop<Frozen<Plan>>(),
  contexts: prop<Frozen<Contexts>>(),
  buffers: prop<Frozen<string[]>>(),
  flamegraphZoomOffset: prop<[number, number]>(() => [1, 0]),
}) {
  @computed
  get maxFlamegraphZoom() {
    return Math.max(
      1,
      explainGraphSettings.isTimeGraph
        ? this.planTree.data.totalTime! * 10
        : this.planTree.data.totalCost
    );
  }

  @computed
  get hoveredCtxId() {
    return this.getCtxId(this.hoveredPlan);
  }

  @computed
  get ctxId() {
    return this.getCtxId(this.selectedPlan);
  }

  @computed
  get parentCtxId() {
    return this.getCtxId(this.selectedPlan?.parent);
  }

  getCtxId(plan: Plan | null | undefined) {
    return plan?.nearestContextPlan?.contextId || plan?.contextId;
  }

  @modelAction
  setFlamegraphZoom(_newZoom: number, center: number = 0) {
    const newZoom = Math.min(Math.max(1, _newZoom), this.maxFlamegraphZoom);

    const width = this.flamegraphWidth;
    const [zoom, offset] = this.flamegraphZoomOffset;

    const oldCenterPercent = (center + offset) / (zoom * width);
    const newTotalOffset = newZoom * width * oldCenterPercent;
    const newOffset = Math.min(
      Math.max(0, newTotalOffset - center),
      (newZoom - 1) * width
    );

    this.flamegraphZoomOffset = [newZoom, newOffset];
  }

  @modelAction
  setFlamegraphOffset(offset: number) {
    const [zoom] = this.flamegraphZoomOffset;
    this.flamegraphZoomOffset = [
      zoom,
      Math.min(Math.max(0, offset), (zoom - 1) * this.flamegraphWidth),
    ];
  }

  @observable
  flamegraphWidth = 0;

  @action
  setFlamegraphWidth(width: number) {
    const oldWidth = this.flamegraphWidth;
    this.flamegraphWidth = width;
    if (oldWidth) {
      const [zoom, offset] = this.flamegraphZoomOffset;
      this.setFlamegraphOffset(offset - (oldWidth - width) * zoom * 0.5);
    }
  }

  @observable.ref
  selectedPlan: Plan | null = null;

  @action
  setSelectedPlan(plan: Plan | null) {
    this.selectedPlan = plan;
  }

  @observable.ref
  hoveredPlan: Plan | null = null;

  @action
  setHoveredPlan(plan: Plan | null) {
    this.hoveredPlan = plan;
  }

  @observable.ref
  focusedPlan: Plan | null = null;

  treemapContainerRef: HTMLDivElement | null = null;

  @observable.ref
  treemapTransition: {
    kind: "in" | "out";
    from: Plan;
    pos?: {top: number; left: number; width: number; height: number};
  } | null = null;

  @action
  treemapZoomIn(toPlan: Plan, el: HTMLDivElement) {
    if (toPlan === this.focusedPlan) {
      return;
    }
    const contRect = this.treemapContainerRef!.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    this.treemapTransition = {
      kind: "in",
      from: this.focusedPlan ?? this.planTree.data,
      pos: {
        top: (rect.top - contRect.top - 2) / contRect.height,
        left: (rect.left - contRect.left - 2) / contRect.width,
        width: (rect.width + 4) / contRect.width,
        height: (rect.height + 4) / contRect.height,
      },
    };
    this.focusedPlan = toPlan;
  }

  @action
  treemapZoomOut(toPlan: Plan | null) {
    if (toPlan === this.focusedPlan) {
      return;
    }
    this.treemapTransition = {
      kind: "out",
      from: this.focusedPlan!,
    };
    this.focusedPlan = toPlan;
  }

  @action
  updateTreemapTransitionPos(el: HTMLDivElement) {
    const contRect = this.treemapContainerRef!.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    this.treemapTransition = {
      ...this.treemapTransition!,
      pos: {
        top: (rect.top - contRect.top - 2) / contRect.height,
        left: (rect.left - contRect.left - 2) / contRect.width,
        width: (rect.width + 4) / contRect.width,
        height: (rect.height + 4) / contRect.height,
      },
    };
  }

  @action
  finishTreemapTransition() {
    this.treemapTransition = null;
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
      ctx?.sort((a, b) =>
        a.start == b.start ? a.end - b.end : a.start - b.start
      );
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
    .then(() => queryEditor.setHistoryCursor(0)); // todo DP
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
  id: number;
  parent: Plan | null;
  childDepth: number;
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

let _planIdCounter = 0;

export function walkPlanNode(
  data: any,
  queryTotalTime: number | null,
  queryTotalCost: number,
  contexts: Contexts,
  _replacedPlanNodes?: any[]
): Plan {
  const _childContextNodes =
    data.collapsed_plans || data.nearest_context_plan
      ? [data.nearest_context_plan, ...(data.collapsed_plans ?? [])]
      : undefined;

  const replacedPlanNodes = _childContextNodes ?? _replacedPlanNodes!;
  const fullSubPlans: Plan[] = Array.isArray(data.plans)
    ? data.plans.map((subplan: any) => {
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

  const selfTime = data.collapsed_self_time || data.self_time;
  const selfCost = data.collapsed_self_cost || data.self_cost;
  const selfTimePercent = selfTime && selfTime / queryTotalTime!;
  const selfCostPercent = selfCost / queryTotalCost;

  let contextId = null;

  if (data.contexts) {
    const rawCtxs = data.contexts;
    const rawCtx = rawCtxs[data.suggested_display_ctx_idx ?? 0];

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
  ] as Plan[];

  if (data.full_total_time != null) {
    subPlans.sort((a, b) => b.totalTime! - a.totalTime!);
  }

  const plan: Plan = {
    id: _planIdCounter++,
    parent: null,
    childDepth: subPlans.length
      ? Math.max(...subPlans.map((subplan) => subplan.childDepth)) + 1
      : 0,
    type: data.node_type,
    totalTime: data.full_total_time,
    totalCost: data.total_cost,
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

export const ExplainContext = createContext<ExplainState>(null!);

export function useExplainState() {
  return useContext(ExplainContext);
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
