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
import {getColor} from "./colormap";

import styles from "./explainVis.module.scss";
import {
  createExplainState,
  ExplainState,
  Plan,
  reRunWithAnalyze,
} from "./state";

const ExplainContext = createContext<[ExplainState, boolean]>(null!);

function useExplainState() {
  return useContext(ExplainContext);
}

interface ExplainVisProps {
  editorState: QueryEditor;
  state: ExplainState | null;
  queryHistoryItem: QueryHistoryResultItem;
}

export function ExplainVis({
  editorState,
  state,
  queryHistoryItem,
}: ExplainVisProps) {
  if (!state) {
    return <div>loading...</div>;
  }

  const devMode = useInstanceState().instanceName === "_localdev";

  return (
    <ExplainContext.Provider value={[state, /*devMode*/ false]}>
      <div className={styles.explainVis}>
        <ExplainHeader queryHistoryItem={queryHistoryItem} />
        <Flamegraph />
        <PlanDetails />
        {devMode ? (
          <button onClick={() => editorState.setShowExplain(true)}>
            big explain vis
          </button>
        ) : null}
      </div>
    </ExplainContext.Provider>
  );
}

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
  const state = useExplainState()[0];

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
            const newZoom = Math.max(1, oldZoom * (1 + e.deltaY / -400));
            state.setFlamegraphZoom(newZoom);
          } else {
            scrollRef.current!.scrollLeft += e.deltaY;
          }
        }}
      >
        <div
          style={{
            width: `calc(${state.flamegraphZoom * 100}% - 16px)`,
            padding: "4px 8px",
          }}
        >
          <FlamegraphNode plan={state.planTree.data} isRoot />
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
  altBg = false,
  isRoot = false,
}: {
  plan: Plan;
  width?: number;
  altBg?: boolean;
  isRoot?: boolean;
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
    : ctxId != null || isRoot
    ? plan.subPlans!
    : plan.fullSubPlans;

  const selfPercent = state.isTimeGraph
    ? plan.selfTimePercent!
    : plan.selfCostPercent;

  return (
    <div
      className={cn(styles.flamegraphNode, {
        [styles.altBg]: altBg,
        [styles.selected]: state.selectedPlan === plan,
      })}
      style={{
        width: `calc(${width * 100}% - 2px)`,
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
          className={styles.selfTimeIndicator}
          style={{
            backgroundColor: getColor(selfPercent),
          }}
        />
        <div
          className={styles.overflowContainer}
          style={{
            opacity: ctxId != null ? 1 : 0.5,
          }}
        >
          <span>
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
            ) : isRoot ? (
              <i>Query</i>
            ) : (
              plan.type
            )}
          </span>
        </div>
      </div>
      {subPlans.length ? (
        <div className={styles.flamegraphSubNodes}>
          {subPlans.map((subplan, i) => (
            <FlamegraphNode
              key={i}
              altBg={!altBg}
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
    <ExplainContext.Provider value={[state, true]}>
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
              {JSON.stringify(plan.raw.Contexts?.map((ctx: any) => ctx.text))}
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
