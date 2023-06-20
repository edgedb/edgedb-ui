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

export function createExplainState(rawExplainOutput: string) {
  const rawData = JSON.parse(rawExplainOutput);
  const contexts: Contexts = [];
  const rootPlan = rawData.coarse_grained;
  const planTree = walkPlanNode(
    rootPlan,
    rootPlan.actual_total_time !== undefined
      ? rootPlan.actual_total_time * rootPlan.actual_loops
      : null,
    rootPlan.total_cost,
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
    buffers: frozen(rawData.buffers.slice(1)),
  });
}

export enum ExplainStateType {
  explain = "EXPLAIN",
  analyzeQuery = "ANALYZE QUERY",
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
    return plan?.contextId;
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
  name: string | null;
  totalTime: number | null;
  totalCost: number;
  selfTime: number | null;
  selfCost: number;
  selfTimePercent: number | null;
  selfCostPercent: number;
  subPlans: Plan[];
  contextId: number | null;
  raw: any;
}

export interface Context {
  id: number;
  bufIdx: number;
  start: number;
  end: number;
  text: string;
  linkedBufIdx: number | null;
}

export type Contexts = Context[];

export function walkPlanNode(
  data: any,
  queryTotalTime: number | null,
  queryTotalCost: number,
  contexts: Contexts,
  planName: string | null = null
): Plan {
  const subPlans: Plan[] = (data.children ?? []).map((child: any) =>
    walkPlanNode(
      child.node,
      queryTotalTime,
      queryTotalCost,
      contexts,
      child.name
    )
  );

  const totalTime =
    data.actual_total_time !== undefined
      ? data.actual_total_time * data.actual_loops
      : null;
  const totalCost = data.total_cost;

  const selfTime =
    totalTime &&
    Math.max(
      0,
      totalTime - subPlans.reduce((sum, plan) => sum + plan.totalTime!, 0)
    );
  const selfCost = Math.max(
    0,
    totalCost - subPlans.reduce((sum, plan) => sum + plan.totalCost, 0)
  );

  const selfTimePercent = selfTime && selfTime / queryTotalTime!;
  const selfCostPercent = selfCost / queryTotalCost;

  let contextId = null;

  if (data.contexts) {
    const rawCtxs = data.contexts;
    const rawCtx = rawCtxs[rawCtxs.length - 1];

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
        linkedBufIdx: linked?.buffer_idx ?? null,
      });
    } else {
      contextId = ctx.id;
    }
  }

  if (data.full_total_time != null) {
    subPlans.sort((a, b) => b.totalTime! - a.totalTime!);
  }

  const plan: Plan = {
    id: data.plan_id,
    parent: null,
    childDepth: subPlans.length
      ? Math.max(...subPlans.map((subplan) => subplan.childDepth)) + 1
      : 0,
    name: planName,
    totalTime,
    totalCost,
    selfTime,
    selfCost,
    selfTimePercent,
    selfCostPercent,
    contextId,
    subPlans,
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
