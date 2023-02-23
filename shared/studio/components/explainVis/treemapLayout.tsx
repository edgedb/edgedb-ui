import {useResize} from "@edgedb/common/hooks/useResize";
import {useRef, useState} from "react";
import {useExplainState} from ".";
import styles from "./explainVis.module.scss";
import {Plan} from "./state";
import cn from "@edgedb/common/utils/classNames";
import CodeBlock from "@edgedb/common/ui/codeBlock";
import {observer} from "mobx-react-lite";

export const Treemap = observer(function Treemap() {
  const [state] = useExplainState();

  const ref = useRef<HTMLDivElement>(null);

  const [size, setSize] = useState<[number, number] | null>(null);

  useResize(ref, ({width, height}) => setSize([width, height]));

  return (
    <>
      <TreemapBreadcrumbs />
      <div ref={ref} className={styles.treemapContainer}>
        {size != null ? (
          <TreemapNode
            isRoot
            plan={state.focusedPlan ?? state.planTree.data}
            pos={{top: 0, left: 0, width: 1, height: 1}}
            parentSize={size}
          />
        ) : null}
      </div>
    </>
  );
});

const TreemapBreadcrumbs = observer(function TreemapBreadcrumbs() {
  const [state] = useExplainState();

  const breadcrumbs: Plan[] = [];

  let plan = state.focusedPlan;
  while (plan) {
    breadcrumbs.unshift(plan);
    plan = plan.parent;
  }

  return state.focusedPlan ? (
    <div className={styles.treemapBreadcrumbs}>
      <div className={styles.breadcrumbsWrapper}>
        {breadcrumbs.map((plan, i) => {
          const ctxId = plan.nearestContextPlan?.contextId ?? plan.contextId;
          return (
            <>
              <div
                className={styles.breadcrumb}
                onClick={() => state.setFocusedPlan(plan.parent ? plan : null)}
              >
                <span style={{opacity: ctxId == null ? 0.5 : undefined}}>
                  {ctxId != null ? (
                    <CodeBlock code={state.contexts.data[ctxId].text ?? ""} />
                  ) : i === 0 ? (
                    <i>Query</i>
                  ) : (
                    plan.type
                  )}
                </span>
              </div>
              {i !== breadcrumbs.length - 1 ? <span>{">"}</span> : null}
            </>
          );
        })}
      </div>
    </div>
  ) : null;
});

const MARGIN = 2;

export const TreemapNode = observer(function _TreemapNode({
  plan,
  pos,
  parentSize,
  altBg = false,
  isRoot = false,
}: {
  plan: Plan;
  pos: LayoutPos;
  parentSize: [number, number];
  altBg?: boolean;
  isRoot?: boolean;
}) {
  const [state, devMode] = useExplainState();
  // const [layout, setLayout] = useState<LayoutItem<Plan>[] | null>(null);

  const parentArea = parentSize[0] * parentSize[1];

  let subplansTotalTime = 0;
  const subplans: {
    item: Plan | null | number;
    area: number;
  }[] = [];
  let hiddenArea = 0;
  let hiddenCount = 0;
  for (const subplan of plan.subPlans ?? []) {
    subplansTotalTime += subplan.totalTime!;
    const area = subplan.totalTime! / plan.totalTime!;
    if (parentArea * area > 400) {
      subplans.push({
        item: subplan,
        area,
      });
    } else {
      hiddenArea += area;
      hiddenCount++;
    }
  }
  if (hiddenCount) {
    subplans.push({
      item: hiddenCount,
      area: hiddenArea,
    });
  }

  const ctxId = plan.nearestContextPlan?.contextId ?? plan.contextId;

  const layout = subplans
    ? computeLayout(parentSize[0] / parentSize[1], [
        ...subplans,
        {
          item: null,
          area: Math.max(
            0,
            (plan.totalTime! - subplansTotalTime) / plan.totalTime!
          ),
        },
      ])
    : null;

  return (
    <div
      className={cn(styles.treemapItem, {
        [styles.selected]: state.selectedPlan === plan,
        [styles.altBg]: altBg,
      })}
      style={{
        top: pos.top * 100 + "%",
        left: pos.left * 100 + "%",
        width: `calc(${pos.width * 100}% - 4px)`,
        height: `calc(${pos.height * 100}% - 4px)`,
        ...(state.ctxId != null && state.ctxId === ctxId
          ? {outline: `2px solid #0074e8`, zIndex: 1}
          : undefined),
      }}
    >
      {layout
        ? layout.map(({item, ...pos}) => {
            if (!pos.width || !pos.height) {
              return null;
            }
            if (item && typeof item === "object") {
              return (
                <TreemapNode
                  plan={item}
                  pos={pos}
                  parentSize={[
                    parentSize[0] * pos.width - MARGIN,
                    parentSize[1] * pos.height - MARGIN,
                  ]}
                  altBg={!altBg}
                />
              );
            }

            const w = pos.width * parentSize[0],
              h = pos.height * parentSize[1];
            const vertLabel = h > w * 1.5;
            const showLabel = w * h > 800 && (vertLabel ? w : h) > 20;
            return item === null ? (
              <div
                className={cn(styles.planName, {
                  [styles.vertLabel]: vertLabel,
                })}
                style={{
                  opacity: ctxId != null ? 1 : 0.5,
                  top: pos.top * 100 + "%",
                  left: pos.left * 100 + "%",
                  width: `calc(${pos.width * 100}%)`,
                  height: `calc(${pos.height * 100}%)`,
                }}
                onClick={() => state.setSelectedPlan(plan)}
                onMouseEnter={() => {
                  if (ctxId != null) state.setCtxId(ctxId);
                }}
                onMouseLeave={() => {
                  if (ctxId != null) state.setCtxId(null);
                }}
                onDoubleClick={() => state.setFocusedPlan(plan)}
              >
                {showLabel ? (
                  <span>
                    {ctxId != null ? (
                      <CodeBlock
                        code={state.contexts.data[ctxId].text ?? ""}
                      />
                    ) : isRoot ? (
                      <i>Query</i>
                    ) : (
                      plan.type
                    )}
                  </span>
                ) : null}
              </div>
            ) : (
              <div
                className={styles.hiddenPlans}
                style={{
                  opacity: 0.5,
                  top: pos.top * 100 + "%",
                  left: pos.left * 100 + "%",
                  width: `calc(${pos.width * 100}% - 4px)`,
                  height: `calc(${pos.height * 100}% - 4px)`,
                }}
              >
                {showLabel ? <span>{item} hidden</span> : null}
              </div>
            );
          })
        : null}
    </div>
  );
});

interface LayoutPos {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface LayoutItem<T> extends LayoutPos {
  item: T;
}

interface ChildItem<T> {
  item: T;
  area: number;
}

function computeLayout<T>(parentRatio: number, childAreas: ChildItem<T>[]) {
  let vert = parentRatio < 1;
  let remainingRatio = vert ? 1 / parentRatio : parentRatio;

  const layout: LayoutItem<T>[] = [];
  let lt = [0, 1];

  let groupArea = 1;
  let groupTotal = 0;
  let groupChildren: ChildItem<T>[] = [];
  let lastRatio = Infinity;

  const addItemsToLayout = () => {
    let t = 0;
    let h = vert ? lt[1] * groupTotal : lt[1];
    let w = vert ? 1 - lt[0] : (1 - lt[0]) * groupTotal;
    for (const c of groupChildren) {
      let cf = (c.area / groupTotal) * (vert ? w : h);
      layout.push({
        item: c.item,
        top: lt[1] - h + (vert ? 0 : t),
        left: lt[0] + (vert ? t : 0),
        width: vert ? cf : w,
        height: vert ? h : cf,
      });
      t += cf;
    }
    if (vert) {
      lt[1] -= h;
    } else {
      lt[0] += w;
    }
  };

  for (let i = 0; i < childAreas.length; i++) {
    const child = childAreas[i];
    const childGroupArea = child.area / groupArea;
    groupTotal += childGroupArea;
    groupChildren.push({...child, area: childGroupArea});
    const groupWidth = groupTotal * remainingRatio;
    const worstRatio = Math.max(
      ...groupChildren.map((c) => {
        const r = c.area / groupTotal;
        return r < groupWidth ? groupWidth / r : r / groupWidth;
      })
    );
    if (worstRatio > lastRatio) {
      groupTotal -= groupChildren.pop()!.area;

      // console.log(vert, remainingRatio, groupTotal, groupChildren);

      addItemsToLayout();

      remainingRatio = remainingRatio * (1 - groupTotal);
      if (remainingRatio < 1) {
        vert = !vert;
        remainingRatio = 1 / remainingRatio;
      }

      groupArea = groupArea * (1 - groupTotal);

      const childGroupArea = child.area / groupArea;
      groupTotal = childGroupArea;
      groupChildren = [{...child, area: childGroupArea}];
      const groupWidth = groupTotal * remainingRatio;
      lastRatio = groupWidth >= 1 ? groupWidth : 1 / groupWidth;
    } else {
      lastRatio = worstRatio;
    }
  }

  if (groupChildren.length) {
    addItemsToLayout();
  }

  return layout;
}
