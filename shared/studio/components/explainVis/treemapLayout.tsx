import {useResize} from "@edgedb/common/hooks/useResize";
import {
  forwardRef,
  Fragment,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {useExplainState} from ".";
import styles from "./explainVis.module.scss";
import {ExplainState, Plan} from "./state";
import cn from "@edgedb/common/utils/classNames";
import CodeBlock from "@edgedb/common/ui/codeBlock";
import {observer} from "mobx-react-lite";

export const palette = ["#D5D8EF", "#FDF5E2", "#DAE9FB", "#E6FFF8"];

function getPlanDepth(plan: Plan) {
  let depth = 0;
  let parent = plan.parent;
  while (parent) {
    depth++;
    parent = parent.parent;
  }
  return depth;
}

export const Treemap = observer(function Treemap() {
  const [state] = useExplainState();

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      state.treemapContainerRef = ref.current;
    }
  }, [ref.current, state]);

  const [size, setSize] = useState<[number, number] | null>(null);
  const sizeCache = useRef<[number, number] | null>(null);

  useResize(
    ref,
    ({width, height}) => {
      const newSize = [width - MARGIN, height - MARGIN] as [number, number];
      if (state.treemapTransition) {
        sizeCache.current = newSize;
      } else {
        setSize(newSize);
      }
    },
    [state.treemapTransition]
  );

  const plan = state.focusedPlan ?? state.planTree.data;

  useEffect(() => {
    if (!state.treemapTransition && sizeCache.current) {
      setSize(sizeCache.current);
    }
    if (
      state.treemapTransition?.kind === "out" &&
      !state.treemapTransition.pos
    ) {
      let target: Plan | null = state.treemapTransition.from;
      const container = ref.current!.firstChild! as HTMLDivElement;
      while (target) {
        const el = container.querySelector(`[data-plan-id="${target.id}"]`);
        if (el) {
          state.updateTreemapTransitionPos(el as HTMLDivElement);
          return;
        }
        target = target.parent;
      }
      // Fallback to container - shouldn't ever happen
      state.updateTreemapTransitionPos(container);
    }
  }, [state.treemapTransition]);

  const children: JSX.Element[] = [];
  if (size != null) {
    const props: TreemapNodeProps = {
      depth: getPlanDepth(plan),
      plan: plan,
      pos: {
        top: 0,
        left: 0,
        width: 1,
        height: 1,
      },
      parentSize: size,
    };
    const trans = state.treemapTransition;
    if (trans) {
      if (trans.kind === "in") {
        children.push(
          <TreemapNode
            key={`trans-in-${trans.from.id}`}
            {...props}
            depth={getPlanDepth(trans.from)}
            plan={trans.from}
          />,
          <TransitionWrapper
            key={`trans-in-${plan.id}`}
            state={state}
            {...props}
            startPos={trans.pos!}
          />
        );
      } else {
        children.push(
          <TreemapNode
            key={`trans-out-${plan.id}`}
            {...props}
            parentSize={!state.focusedPlan ? [size[0], size[1] + 28] : size}
          />,
          trans.pos ? (
            <TransitionWrapper
              key={`trans-out-${trans.from.id}`}
              state={state}
              {...props}
              depth={getPlanDepth(trans.from)}
              plan={trans.from}
              pos={trans.pos}
              startPos={props.pos}
            />
          ) : (
            <TreemapNode
              key={`trans-out-${trans.from.id}`}
              {...props}
              depth={getPlanDepth(trans.from)}
              plan={trans.from}
            />
          )
        );
      }
    } else {
      children.push(<TreemapNode key={`root-${plan.id}`} {...props} />);
    }
  }

  return (
    <div
      style={{
        display: "contents",
        pointerEvents: state.treemapTransition ? "none" : undefined,
      }}
    >
      <TreemapBreadcrumbs />
      <div ref={ref} className={styles.treemapContainer}>
        {children}
      </div>
    </div>
  );
});

function TransitionWrapper({
  state,
  startPos,
  ...props
}: TreemapNodeProps & {
  state: ExplainState;
  startPos: TreemapNodeProps["pos"];
}) {
  const ref = useRef<HTMLDivElement>(null);

  const [first, setFirst] = useState(true);

  useLayoutEffect(() => {
    if (first && ref.current) {
      const el = ref.current;

      el.clientHeight;
      setFirst(false);

      el.addEventListener(
        "transitionend",
        () => state.finishTreemapTransition(),
        {once: true}
      );
    }
  }, [first, ref.current]);

  return (
    <TreemapNode
      ref={ref}
      {...props}
      transitionActive
      pos={first ? startPos : props.pos}
    />
  );
}

const TreemapBreadcrumbs = observer(function TreemapBreadcrumbs() {
  const [state] = useExplainState();

  const breadcrumbs: Plan[] = [];

  let plan = state.focusedPlan;
  while (plan) {
    breadcrumbs.unshift(plan);
    plan = plan.parent;
  }

  return (
    <div
      className={cn(styles.treemapBreadcrumbs, {
        [styles.hidden]: breadcrumbs.length === 0,
      })}
    >
      <div className={styles.breadcrumbsWrapper}>
        {breadcrumbs.map((plan, i) => {
          const ctxId = plan.nearestContextPlan?.contextId ?? plan.contextId;
          return (
            <Fragment key={plan.id}>
              <div
                className={styles.breadcrumb}
                onClick={() => state.treemapZoomOut(plan.parent ? plan : null)}
                style={{
                  pointerEvents:
                    i === breadcrumbs.length - 1 ? "none" : undefined,
                }}
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
            </Fragment>
          );
        })}
      </div>
    </div>
  );
});

const MARGIN = 4;

interface TreemapNodeProps {
  plan: Plan;
  pos: LayoutPos;
  parentSize: [number, number];
  depth: number;
  transitionActive?: boolean;
}

export const TreemapNode = observer(
  forwardRef<HTMLDivElement, TreemapNodeProps>(function _TreemapNode(
    {plan, pos, parentSize, depth, transitionActive},
    forwardedRef
  ) {
    const [state] = useExplainState();

    const ref = useRef<HTMLDivElement>(null);
    useImperativeHandle(forwardedRef, () => ref.current!);

    const parentArea = parentSize[0] * parentSize[1];

    const isTimeGraph = state.isTimeGraph;

    const ctxId = plan.nearestContextPlan?.contextId ?? plan.contextId;

    const layout = useMemo(() => {
      let subplansTotal = 0;
      const subplans: {
        item: Plan | null | number;
        area: number;
      }[] = [];
      let hiddenArea = 0;
      let hiddenCount = 0;
      for (const subplan of plan.subPlans ?? []) {
        if (
          (subplan.nearestContextPlan?.contextId ?? subplan.contextId) == ctxId
        ) {
          continue;
        }

        subplansTotal += isTimeGraph ? subplan.totalTime! : subplan.totalCost;
        const area = isTimeGraph
          ? subplan.totalTime! / plan.totalTime!
          : subplan.totalCost / plan.totalCost;
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

      const layout = subplans
        ? computeLayout(parentSize[0] / parentSize[1], [
            ...subplans,
            {
              item: null,
              area: Math.max(
                0,
                isTimeGraph
                  ? (plan.totalTime! - subplansTotal) / plan.totalTime!
                  : (plan.totalCost - subplansTotal) / plan.totalCost
              ),
            },
          ])
        : null;

      return layout;
    }, [plan, parentArea, isTimeGraph]);

    return (
      <div
        ref={ref}
        className={cn(styles.treemapItem, {
          [styles.selected]: state.selectedPlan === plan,
          [styles.transitionActive]: !!transitionActive,
        })}
        data-plan-id={plan.id}
        style={{
          backgroundColor: depth
            ? palette[(depth - 1) % palette.length]
            : undefined,
          top: pos.top * 100 + "%",
          left: pos.left * 100 + "%",
          width: `calc(${pos.width * 100}% - 4px)`,
          height: `calc(${pos.height * 100}% - 4px)`,
          ...(state.ctxId != null && state.ctxId === ctxId
            ? {outline: `2px solid #0074e8`, zIndex: 1}
            : undefined),
        }}
      >
        {layout ? (
          <div className={styles.treemapItemInner}>
            {layout.map(({item, ...pos}, i) => {
              if (!pos.width || !pos.height) {
                return null;
              }
              if (item && typeof item === "object") {
                return (
                  <TreemapNode
                    key={`${plan.id}-${i}`}
                    plan={item}
                    pos={pos}
                    parentSize={[
                      parentSize[0] * pos.width - MARGIN * 2,
                      parentSize[1] * pos.height - MARGIN * 2,
                    ]}
                    depth={depth + 1}
                  />
                );
              }

              const w = pos.width * parentSize[0],
                h = pos.height * parentSize[1];
              const vertLabel = h > w * 1.5;
              const showLabel = w * h > 800 && (vertLabel ? w : h) > 20;
              return item === null ? (
                <div
                  key={`planLabel-${i}`}
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
                  onDoubleClick={() => state.treemapZoomIn(plan, ref.current!)}
                >
                  {showLabel ? (
                    <span>
                      {ctxId != null ? (
                        <CodeBlock
                          code={state.contexts.data[ctxId].text ?? ""}
                        />
                      ) : depth === 0 ? (
                        <i>Query</i>
                      ) : (
                        plan.type
                      )}
                    </span>
                  ) : null}
                </div>
              ) : (
                <div
                  key={`hiddenPlans-${i}`}
                  className={styles.hiddenPlans}
                  style={{
                    top: pos.top * 100 + "%",
                    left: pos.left * 100 + "%",
                    width: `calc(${pos.width * 100}% - 4px)`,
                    height: `calc(${pos.height * 100}% - 4px)`,
                  }}
                >
                  {showLabel ? <span>{item} hidden</span> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  })
);

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
