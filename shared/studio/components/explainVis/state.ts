import {action, computed, observable} from "mobx";
import {frozen, Frozen, model, Model, prop} from "mobx-keystone";
import {
  EditorKind,
  queryEditorCtx,
  QueryHistoryResultItem,
} from "../../tabs/queryEditor/state";

export function createExplainState(rawExplainOutput: string) {
  const rawData = JSON.parse(rawExplainOutput)[0];

  const contexts: Contexts = [];
  const planTree = walkPlanNode(
    rawData.Plan,
    rawData.Plan["Actual Total Time"] ?? null,
    rawData.Plan["Total Cost"],
    contexts
  );

  collapseToContextNodes(planTree);

  return new ExplainState({
    rawData: rawExplainOutput,
    planTree: frozen(planTree),
    contexts: frozen(contexts),
    flamegraphType: planTree.totalTime != null ? "time" : "cost",
  });
}

@model("ExplainState")
export class ExplainState extends Model({
  rawData: prop<string>(),
  planTree: prop<Frozen<Plan>>(),
  contexts: prop<Frozen<Contexts>>(),

  ctxId: prop<number | null>(null).withSetter(),

  flamegraphType: prop<"cost" | "time">().withSetter(),
  flamegraphZoom: prop<number>(1).withSetter(),
}) {
  @observable.ref
  selectedPlan: Plan | null = null;

  @action
  setSelectedPlan(plan: Plan | null) {
    this.selectedPlan = plan;
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
  get contextsByIdx() {
    const ctxs = this.contexts.data.reduce((ctxs, ctx) => {
      if (ctxs[ctx.bufIdx] == null) {
        ctxs[ctx.bufIdx] = [];
      }
      ctxs[ctx.bufIdx].push(ctx);
      return ctxs;
    }, [] as Contexts[]);
    for (const ctx of ctxs) {
      ctx.sort((a, b) => a.start - b.start);
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

function collapseToContextNodes(plan: Plan, findNearestConextNode = false) {
  const childContextNodes: Plan[] = [];

  let foundNearestNode: Plan | null = null;

  const unvisited = [...plan.subPlans];
  while (unvisited.length) {
    const node = unvisited.shift()!;
    if (node.contextId != null) {
      if (findNearestConextNode && !foundNearestNode) {
        foundNearestNode = node;
      } else if (node.contextId !== foundNearestNode?.contextId) {
        childContextNodes.push(node);
      }
      collapseToContextNodes(node);
    } else {
      if (node.type === "Aggregate") {
        const nearestNode = collapseToContextNodes(node, true);
        if (nearestNode) {
          node.nearestContextNode = nearestNode;
          childContextNodes.push(node);
        }
      } else {
        unvisited.push(...node.subPlans);
      }
    }
  }

  plan.childContextNodes = childContextNodes;
  plan.hasCollapsedNodes = !nodesEqual(childContextNodes, plan.subPlans);

  return foundNearestNode;
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
  type: string;
  totalTime: number | null;
  totalCost: number;
  selfTime: number | null;
  selfCost: number;
  selfTimePercent: number | null;
  selfCostPercent: number;
  subPlans: Plan[];
  contextId: number | null;
  childContextNodes?: Plan[];
  hasCollapsedNodes?: boolean;
  nearestContextNode?: Plan;
  raw: any;
}

export interface Context {
  id: number;
  bufIdx: number;
  start: number;
  end: number;
  text: string;
  selfPercent: number;
  linked: string | null;
}

export type Contexts = Context[];

export function walkPlanNode(
  data: any,
  queryTotalTime: number | null,
  queryTotalCost: number,
  contexts: Contexts
): Plan {
  const subPlans: Plan[] = Array.isArray(data.Plans)
    ? data.Plans.map((subplan: any) =>
        walkPlanNode(subplan, queryTotalTime, queryTotalCost, contexts)
      )
    : [];

  let totalTime: number | null = null;
  let selfTime: number | null = null;
  let selfTimePercent: number | null = null;
  if (queryTotalTime != null) {
    totalTime = data["Actual Total Time"] * (data["Actual Loops"] ?? 1);
    const childTime = subPlans.reduce(
      (sum, subplan) => sum + subplan.totalTime!,
      0
    );

    selfTime = totalTime - childTime;
    selfTimePercent = (selfTime / queryTotalTime) * 100;
  }

  const totalCost = data["Total Cost"];

  const childCost = subPlans.reduce(
    (sum, subplan) => sum + subplan.totalCost,
    0
  );

  const selfCost = totalCost - childCost;
  const selfCostPercent = (selfCost / queryTotalCost) * 100;

  let contextId = null;

  if (data.Contexts) {
    const rawCtxs = data.Contexts[0];
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
        selfPercent: selfTimePercent ?? selfCost,
        linked: linked?.text ?? null,
      });
    } else {
      contextId = ctx.id;
    }
  }

  return {
    type: data["Node Type"],
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
}
