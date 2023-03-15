import {useResize} from "@edgedb/common/hooks/useResize";
import Button from "@edgedb/common/ui/button";
import CodeBlock from "@edgedb/common/ui/codeBlock";
import cn from "@edgedb/common/utils/classNames";
import {observer} from "mobx-react-lite";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {ChevronDownIcon} from "../../icons";
import {useInstanceState} from "../../state/instance";

import {
  QueryEditor,
  QueryHistoryResultItem,
} from "../../tabs/queryEditor/state";

import styles from "./explainVis.module.scss";
import {
  createExplainState,
  ExplainState,
  Plan,
  reRunWithAnalyze,
} from "./state";

import {palette, Treemap, TreemapNode} from "./treemapLayout";

const ExplainContext = createContext<[ExplainState, boolean]>(null!);

export function useExplainState() {
  return useContext(ExplainContext);
}

interface ExplainVisProps {
  editorState: QueryEditor;
  state: ExplainState | null;
  queryHistoryItem: QueryHistoryResultItem;
}

export const ExplainVis = observer(function ExplainVis({
  editorState,
  state,
  queryHistoryItem,
}: ExplainVisProps) {
  if (!state) {
    return <div>loading...</div>;
  }

  // const devMode = useInstanceState().instanceName === "_localdev";

  return (
    <ExplainContext.Provider value={[state, /*devMode*/ false]}>
      <div className={styles.explainVis}>
        <ExplainHeader queryHistoryItem={queryHistoryItem} />
        {state.showFlamegraph ? <Flamegraph /> : <Treemap />}
        <PlanDetails />
        {/* {devMode ? (
          <button onClick={() => editorState.setShowExplain(true)}>
            big explain vis
          </button>
        ) : null} */}
      </div>
    </ExplainContext.Provider>
  );
});

const ExplainHeader = observer(function ExplainHeader({
  queryHistoryItem,
}: {
  queryHistoryItem: QueryHistoryResultItem;
}) {
  const state = useExplainState()[0];

  return (
    <div className={styles.explainHeader}>
      <div>
        {state.planTree.data.totalTime == null ? (
          <div className={styles.rerunWithAnalyze}>
            <div className={styles.message}>Timing data not available</div>
            <div
              className={styles.button}
              onClick={() => reRunWithAnalyze(queryHistoryItem)}
            >
              Re-run query using explain analyze
            </div>
          </div>
        ) : null}
      </div>
      <div className={styles.switchers}>
        <div className={styles.typeSwitcher}>
          <div
            className={cn(styles.switcherButton, {
              [styles.selected]: !state.showFlamegraph,
            })}
            onClick={() => state.setShowFlamegraph(false)}
          >
            Area
          </div>
          <div
            className={cn(styles.switcherButton, {
              [styles.selected]: state.showFlamegraph,
            })}
            onClick={() => state.setShowFlamegraph(true)}
          >
            Flame
          </div>
        </div>
        <div className={styles.typeSwitcher}>
          <div
            className={cn(styles.switcherButton, {
              [styles.selected]: state.graphType === "time",
              [styles.disabled]: state.planTree.data.totalTime == null,
            })}
            onClick={() => state.setGraphType("time")}
          >
            Time
          </div>
          <div
            className={cn(styles.switcherButton, {
              [styles.selected]: state.graphType === "cost",
            })}
            onClick={() => state.setGraphType("cost")}
          >
            Cost
          </div>
        </div>
      </div>
      {/* <div>
        <div
          className={styles.copyRawDataButton}
          onClick={() => state.copyRawDataToClipboard()}
        >
          Copy Raw Data
        </div>
      </div> */}
    </div>
  );
});

const Flamegraph = observer(function Flamegraph() {
  const state = useExplainState()[0];

  const containerRef = useRef<HTMLDivElement>(null);

  useResize(containerRef, ({width}) => state.setFlamegraphWidth(width - 12));

  const width = state.flamegraphWidth;
  const [zoom, offset] = state.flamegraphZoomOffset;

  const range =
    state.planTree.data[state.isTimeGraph ? "totalTime" : "totalCost"]! / zoom;

  return (
    <>
      <div className={styles.graphScale}>
        <span>
          {state.isTimeGraph ? range.toFixed(0) + "ms" : range.toFixed(0)}
        </span>
        {/* <span onClick={() => state.setFlamegraphZoom(1)}>reset</span> */}
      </div>
      <div
        ref={containerRef}
        className={styles.flamegraph}
        onWheel={(e) => {
          const [zoom, offset] = state.flamegraphZoomOffset;
          if (e.ctrlKey) {
            const mouseOffset =
              e.clientX -
              containerRef.current!.getBoundingClientRect().left -
              8;

            const newZoom = Math.min(
              Math.max(1, zoom * (1 + e.deltaY / -400)),
              state.maxFlamegraphZoom
            );

            state.setFlamegraphZoom(newZoom, mouseOffset);
          } else {
            state.setFlamegraphOffset(offset + e.deltaY);
          }
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -offset + 6,
          }}
        >
          {width ? (
            <FlamegraphNode
              plan={state.planTree.data}
              depth={0}
              width={width * zoom}
              left={0}
              visibleRange={[offset - 16, offset + width + 16]}
            />
          ) : null}
        </div>
      </div>
    </>
  );
});

const PlanDetails = observer(function PlanDetails() {
  const state = useExplainState()[0];

  const selectedPlan = state.selectedPlan;

  return selectedPlan ? (
    <div className={styles.planDetails}>
      <div className={styles.header}>
        <span className={styles.nodeType}>{selectedPlan.type}</span>
        <span className={styles.stats}>
          Self {state.isTimeGraph ? "Time" : "Cost"} &nbsp;
          {state.isTimeGraph
            ? selectedPlan.selfTime!.toPrecision(5).replace(/\.?0+$/, "") +
              "ms"
            : selectedPlan.selfCost.toPrecision(5).replace(/\.?0+$/, "")}{" "}
          ·{" "}
          {(
            (state.isTimeGraph
              ? selectedPlan.selfTimePercent!
              : selectedPlan.selfCostPercent) * 100
          )
            .toPrecision(2)
            .replace(/\.?0+$/, "")}
          %
        </span>
      </div>
      <div></div>
      <div className={styles.grid}>
        {[
          ["Startup Cost", 'startup_cost'],
          ["Startup Time", 'actual_startup_time'],
          ["Total Cost", 'total_cost'],
          ["Total Time", 'actual_total_time'],
        ].map(([name, key], i) => (
          <>
            <span className={styles.label}>{name}:</span>
            <span>
              {selectedPlan.raw[key]}
              {i % 2 != 0 ? "ms" : ""}
            </span>
          </>
        ))}
      </div>
    </div>
  ) : (
    <div className={styles.noSelectedPlanDetails}>
      Select plan node above for details
    </div>
  );
});

const FlamegraphNode = observer(function _FlamegraphNode({
  plan,
  left,
  width,
  depth,
  visibleRange,
}: {
  plan: Plan;
  left: number;
  width: number;
  depth: number;
  visibleRange: [number, number];
}) {
  const [state, devMode] = useExplainState();

  const expandedNode =
    devMode && plan.hasCollapsedPlans && state.expandedNodes.has(plan);

  const ctxId =
    plan.nearestContextPlan && !expandedNode
      ? plan.nearestContextPlan.contextId!
      : plan.contextId;

  const subPlans = expandedNode
    ? plan.fullSubPlans
    : ctxId != null || depth === 0
    ? plan.subPlans!
    : plan.fullSubPlans;

  const sortedSubplans: {
    subplan: Plan;
    childWidth: number;
  }[] = [];
  let hiddenCount = 0;
  let hiddenWidth = 0;
  for (const subplan of subPlans) {
    if (
      (subplan.nearestContextPlan?.contextId ?? subplan.contextId) === ctxId
    ) {
      continue;
    }

    const childWidth =
      (state.isTimeGraph
        ? subplan.totalTime! / plan.totalTime!
        : subplan.totalCost / plan.totalCost) *
      (width - 8);
    if (childWidth > 14) {
      sortedSubplans.push({subplan, childWidth});
    } else {
      hiddenCount++;
      hiddenWidth += childWidth;
    }
  }
  sortedSubplans.sort((a, b) => b.childWidth - a.childWidth);

  let childLeft = 2;
  const childNodes: JSX.Element[] = [];
  for (const {subplan, childWidth} of sortedSubplans) {
    if (
      childLeft <= visibleRange[1] &&
      childLeft + childWidth >= visibleRange[0]
    ) {
      childNodes.push(
        <FlamegraphNode
          key={childNodes.length}
          plan={subplan}
          depth={depth + 1}
          width={childWidth}
          left={childLeft}
          visibleRange={[
            visibleRange[0] - childLeft - 2,
            visibleRange[1] - childLeft,
          ]}
        />
      );
    }
    childLeft += childWidth;
  }

  return (
    <div
      className={cn(styles.flamegraphNode, {
        [styles.selected]: state.selectedPlan === plan,
      })}
      style={{
        backgroundColor: depth
          ? palette[(depth - 1) % palette.length]
          : undefined,
        width: width - 4,
        left: left,
        ...(state.ctxId != null && state.ctxId === ctxId
          ? {outline: `2px solid #0074e8`, zIndex: 1}
          : undefined),
      }}
    >
      <div
        className={cn(styles.flamegraphBar)}
        onClick={() => state.setSelectedPlan(plan)}
        onMouseEnter={() => {
          if (ctxId != null) state.setCtxId(ctxId);
        }}
        onMouseLeave={() => {
          if (ctxId != null) state.setCtxId(null);
        }}
      >
        <div
          className={styles.flamegraphLabel}
          style={{
            left: Math.max(0, visibleRange[0] + 8),
            opacity: ctxId != null ? 1 : 0.5,
          }}
        >
          {devMode && plan.hasCollapsedPlans ? (
            <span
              className={cn(styles.collapseButton, {
                [styles.collapsed]: !expandedNode,
              })}
              onClick={() => state.toggleCollapsed(plan)}
            >
              <ChevronDownIcon />
            </span>
          ) : null}
          {ctxId != null ? (
            <CodeBlock code={state.contexts.data[ctxId].text ?? ""} />
          ) : depth === 0 ? (
            <i>Query</i>
          ) : (
            plan.type
          )}
        </div>
      </div>
      {sortedSubplans.length || hiddenCount ? (
        <div
          className={styles.flamegraphSubNodes}
          style={{height: plan.childDepth * 38}}
        >
          {childNodes}
          {hiddenCount ? (
            <div
              className={styles.flamegraphHiddenNodes}
              style={{width: Math.max(0, hiddenWidth - 4), left: childLeft}}
            >
              <span>{hiddenCount} hidden</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
});

// ---- Test Stuff ----

export function TestExplainVis({
  explainOutput: rawOutput,
  closeExplain,
}: {
  explainOutput: string;
  closeExplain: () => void;
}) {
  const data = JSON.parse(rawOutput!)[0];

  const state = createExplainState(rawOutput!);

  return (
    <div className={styles.explainVisTesting}>
      <button onClick={() => closeExplain()}>close</button>

      <Visualisations state={state} buffers={data.buffers} />

      <details>
        <summary>raw json</summary>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </details>
    </div>
  );
}

const Visualisations = observer(function Visualisations({
  state,
  buffers,
}: {
  state: ExplainState;
  buffers: any;
}) {
  return (
    <ExplainContext.Provider value={[state, true]}>
      <div className={styles.flamegraph}>
        {/* <FlamegraphNode
          plan={state.planTree.data}
          depth={0}
          parentWidth={800}
        /> */}
      </div>
      <div className={styles.main}>
        <div style={{width: "50%"}}>
          {state.selectedPlan ? (
            <pre>
              {JSON.stringify(
                {
                  selfTime: state.selectedPlan.selfTime,
                  selfPercent: state.selectedPlan.selfTimePercent,
                  ...state.selectedPlan.raw,
                  Plans: undefined,
                  CollapsedPlans: undefined,
                },
                null,
                2
              )}
            </pre>
          ) : null}
        </div>
        <div className={styles.queryText}>
          {buffers.map((buf: any, idx: number) => (
            <>
              <b>{buf[1]}</b>
              <CodeBlock
                code={buf[0]}
                customRanges={
                  state.contextsByBufIdx[idx]
                    ? state.contextsByBufIdx[idx].map((range) => ({
                        range: [range.start, range.end],
                        renderer: (_, content) => (
                          <>
                            <span
                              style={{
                                border: "1px solid #d7d7d7",
                                borderRadius: 3,
                                backgroundColor: `hsl(0, 100%, ${
                                  100 - range.selfTimePercent! / 2
                                }%)`,
                                outline:
                                  state.ctxId === range.id
                                    ? `2px solid #0074e8`
                                    : undefined,
                              }}
                              onMouseEnter={() => state.setCtxId(range.id)}
                              onMouseLeave={() => state.setCtxId(null)}
                            >
                              {content}
                            </span>
                            {range.linkedBufIdx ? (
                              <span
                                style={{
                                  fontStyle: "italic",
                                  background: "#ddd",
                                }}
                              >
                                {" "}
                                := {state.buffers.data[range.linkedBufIdx - 1]}
                              </span>
                            ) : null}
                          </>
                        ),
                      }))
                    : undefined
                }
              />
            </>
          ))}
        </div>
      </div>
      <div className={styles.planTree}>
        <PlanNode plan={state.planTree.data} />
      </div>
    </ExplainContext.Provider>
  );
});

function PlanNode({plan}: {plan: Plan}) {
  return (
    <div className={styles.planNodeWrapper}>
      <div
        className={cn(styles.planNode, {
          [styles.noContexts]: !plan.raw.contexts,
        })}
      >
        <div
          className={styles.heatBar}
          style={{
            backgroundColor: `hsl(0, 100%, ${
              100 - (plan.selfTimePercent ?? plan.selfCostPercent) / 2
            }%)`,
          }}
        />
        <div className={styles.planContent}>
          {Math.round(plan.selfTimePercent ?? plan.selfCostPercent)}% Self
          Time: {plan.selfTime?.toPrecision(5).replace(/\.?0+$/, "")}ms
          <br />
          <b>{plan.type}</b>
          <div className={styles.grid}>
            {[
              ["Startup Cost", 'startup_cost'],
              ["Actual Startup Time", 'actual_startup_time'],
              ["Total Cost", 'total_cost'],
              ["Actual Total Time", 'actual_total_time'],
            ].map(([key, prop], i) => (
              <>
                <span>{key}:</span>
                <span>
                  {plan.raw[prop]}
                  {i % 2 != 0 ? "ms" : ""}
                </span>
              </>
            ))}
          </div>
          {plan.raw.contexts ? (
            <>
              Contexts:{" "}
              {JSON.stringify(plan.raw.contexts?.map((ctx: any) => ctx.text))}
            </>
          ) : null}
          <details>
            <summary>all data</summary>
            <pre>
              {JSON.stringify(
                {
                  ...plan.raw,
                  plans: undefined,
                },
                null,
                2
              )}
            </pre>
          </details>
        </div>
      </div>

      {plan.fullSubPlans.length ? (
        <div className={styles.planSubTree}>
          {plan.fullSubPlans.map((subplan) => (
            <PlanNode plan={subplan} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
