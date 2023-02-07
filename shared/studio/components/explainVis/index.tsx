import Button from "@edgedb/common/ui/button";
import CodeBlock from "@edgedb/common/ui/codeBlock";
import cn from "@edgedb/common/utils/classNames";
import {observer} from "mobx-react-lite";
import {createContext, useContext, useEffect, useRef, useState} from "react";
import {ChevronDownIcon} from "../../icons";

import {QueryHistoryResultItem} from "../../tabs/queryEditor/state";

import styles from "./explainVis.module.scss";
import {
  createExplainState,
  ExplainState,
  Plan,
  reRunWithAnalyze,
} from "./state";

const ExplainContext = createContext<ExplainState>(null!);

function useExplainState() {
  return useContext(ExplainContext);
}

interface ExplainVisProps {
  state: ExplainState | null;
  queryHistoryItem: QueryHistoryResultItem;
}

export function ExplainVis({state, queryHistoryItem}: ExplainVisProps) {
  if (!state) {
    return <div>loading...</div>;
  }

  return (
    <ExplainContext.Provider value={state}>
      <div className={styles.explainVis}>
        <ExplainHeader queryHistoryItem={queryHistoryItem} />
        <Flamegraph />
        <PlanDetails />
      </div>
    </ExplainContext.Provider>
  );
}

const ExplainHeader = observer(function ExplainHeader({
  queryHistoryItem,
}: {
  queryHistoryItem: QueryHistoryResultItem;
}) {
  const state = useExplainState();

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
      <div className={styles.typeSwitcher}>
        <div
          className={cn(styles.switcherButton, {
            [styles.selected]: state.flamegraphType === "time",
            [styles.disabled]: state.planTree.data.totalTime == null,
          })}
          onClick={() => state.setFlamegraphType("time")}
        >
          Time
        </div>
        <div
          className={cn(styles.switcherButton, {
            [styles.selected]: state.flamegraphType === "cost",
          })}
          onClick={() => state.setFlamegraphType("cost")}
        >
          Cost
        </div>
      </div>
      <div>
        <div
          className={styles.copyRawDataButton}
          onClick={() => state.copyRawDataToClipboard()}
        >
          Copy Raw Data
        </div>
      </div>
    </div>
  );
});

const Flamegraph = observer(function Flamegraph() {
  const state = useExplainState();

  const scrollRef = useRef<HTMLDivElement>(null);

  const range =
    state.planTree.data[state.isTimeGraph ? "totalTime" : "totalCost"]! /
    state.flamegraphZoom;

  return (
    <>
      <div className={styles.graphScale}>
        <span>
          {state.isTimeGraph ? range.toPrecision(3) + "ms" : range.toFixed(3)}
        </span>
        {/* <span onClick={() => state.setFlamegraphZoom(1)}>reset</span> */}
      </div>
      <div
        ref={scrollRef}
        className={styles.flamegraph}
        onWheel={(e) => {
          if (e.ctrlKey) {
            const oldZoom = state.flamegraphZoom;
            const newZoom = Math.max(1, oldZoom - e.deltaY / 200);
            state.setFlamegraphZoom(newZoom);

            // const scrollLeft = scrollRef.current!.scrollLeft;
            // const delta = newZoom / oldZoom - 1;
            // console.log(scrollLeft, delta, scrollLeft * delta);
            // scrollRef.current!.scrollLeft = scrollLeft + scrollLeft * delta;
          }
        }}
      >
        <div
          style={{
            width: `calc(${state.flamegraphZoom * 100}% - 16px)`,
            padding: "4px 8px",
          }}
        >
          <FlamegraphNode plan={state.planTree.data} />
        </div>
      </div>
    </>
  );
});

const PlanDetails = observer(function PlanDetails() {
  const state = useExplainState();

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
          {(state.isTimeGraph
            ? selectedPlan.selfTimePercent!
            : selectedPlan.selfCostPercent
          )
            .toPrecision(2)
            .replace(/\.?0+$/, "")}
          %
        </span>
      </div>
      <div></div>
      <div className={styles.grid}>
        {[
          ["Startup Cost", "Startup Cost"],
          ["Actual Startup Time", "Startup Time"],
          ["Total Cost", "Total Cost"],
          ["Actual Total Time", "Total Time"],
        ].map(([key, name], i) => (
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
  width = 1,
}: {
  plan: Plan;
  width?: number;
}) {
  const state = useExplainState();

  const collapsedNode =
    plan.hasCollapsedNodes && !state.expandedNodes.has(plan);

  const subPlans = collapsedNode ? plan.childContextNodes! : plan.subPlans;

  const ctxId =
    plan.nearestContextNode && collapsedNode
      ? plan.nearestContextNode.contextId!
      : plan.contextId;

  return (
    <div
      className={styles.flamegraphNode}
      style={{
        width: `${width * 100}%`,
        backgroundColor: `hsl(0, 100%, ${
          100 -
          (collapsedNode
            ? state.isTimeGraph
              ? plan.collapsedSelfTimePercent!
              : plan.collapsedSelfCostPercent!
            : state.isTimeGraph
            ? plan.selfTimePercent!
            : plan.selfCostPercent) /
            2
        }%)`,
        ...(state.ctxId != null && state.ctxId === ctxId
          ? {outline: `2px solid #0074e8`, zIndex: 1}
          : undefined),
      }}
    >
      <div
        className={cn(styles.flamegraphBar, {
          [styles.selected]: state.selectedPlan === plan,
        })}
        onClick={() => state.setSelectedPlan(plan)}
        onMouseEnter={() => {
          if (ctxId != null) state.setCtxId(ctxId);
        }}
        onMouseLeave={() => {
          if (ctxId != null) state.setCtxId(null);
        }}
      >
        <div
          className={styles.overflowContainer}
          style={{
            opacity: ctxId != null ? 1 : 0.5,
          }}
        >
          <span>
            {plan.hasCollapsedNodes ? (
              <span
                className={cn(styles.collapseButton, {
                  [styles.collapsed]: !!collapsedNode,
                })}
                onClick={() => state.toggleCollapsed(plan)}
              >
                <ChevronDownIcon />
              </span>
            ) : null}
            {ctxId != null ? state.contexts.data[ctxId].text : plan.type}
          </span>
        </div>
      </div>
      {subPlans.length ? (
        <div className={styles.flamegraphSubNodes}>
          {subPlans.map((subplan, i) => (
            <FlamegraphNode
              key={i}
              plan={subplan}
              width={
                state.isTimeGraph
                  ? subplan.totalTime! / plan.totalTime!
                  : subplan.totalCost / plan.totalCost
              }
            />
          ))}
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

  console.log(state.contexts);

  return (
    <div className={styles.explainVisTesting}>
      <button onClick={() => closeExplain()}>close</button>

      <Visualisations state={state} buffers={data.Buffers} />

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
    <ExplainContext.Provider value={state}>
      <div className={styles.flamegraph}>
        <FlamegraphNode plan={state.planTree.data} />
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
                  state.contextsByIdx[idx]
                    ? state.contextsByIdx[idx].map((range) => ({
                        range: [range.start, range.end],
                        renderer: (_, content) => (
                          <>
                            <span
                              style={{
                                border: "1px solid #d7d7d7",
                                borderRadius: 3,
                                backgroundColor: `hsl(0, 100%, ${
                                  100 - range.selfPercent / 2
                                }%)`,
                                outline:
                                  state.ctxId === range.id
                                    ? `2px solid #0074e8`
                                    : undefined,
                                // textDecoration: range.linked
                                //   ? "line-through"
                                //   : undefined,
                              }}
                              onMouseEnter={() => state.setCtxId(range.id)}
                              onMouseLeave={() => state.setCtxId(null)}
                            >
                              {content}
                            </span>
                            {range.linked ? (
                              <span
                                style={{
                                  fontStyle: "italic",
                                  background: "#ddd",
                                }}
                              >
                                {" "}
                                := {range.linked}
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
          [styles.noContexts]: !plan.raw.Contexts,
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
              "Startup Cost",
              "Actual Startup Time",
              "Total Cost",
              "Actual Total Time",
            ].map((key, i) => (
              <>
                <span>{key}:</span>
                <span>
                  {plan.raw[key]}
                  {i % 2 != 0 ? "ms" : ""}
                </span>
              </>
            ))}
          </div>
          {plan.raw.Contexts ? (
            <>
              Contexts:{" "}
              {JSON.stringify(
                plan.raw.Contexts?.[0].map((ctx: any) => ctx.text)
              )}
            </>
          ) : null}
          <details>
            <summary>all data</summary>
            <pre>
              {JSON.stringify(
                {
                  ...plan.raw,
                  Plans: undefined,
                },
                null,
                2
              )}
            </pre>
          </details>
        </div>
      </div>

      {plan.subPlans.length ? (
        <div className={styles.planSubTree}>
          {plan.subPlans.map((subplan) => (
            <PlanNode plan={subplan} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
