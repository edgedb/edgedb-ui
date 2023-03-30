import {useResize} from "@edgedb/common/hooks/useResize";
import CodeBlock from "@edgedb/common/ui/codeBlock";
import cn from "@edgedb/common/utils/classNames";
import {observer} from "mobx-react-lite";
import Switch, {switchState} from "@edgedb/common/ui/switch";

import {useRef} from "react";

import {QueryHistoryResultItem} from "../../tabs/queryEditor/state";

import styles from "./explainVis.module.scss";
import {ExplainState, Plan, ExplainContext, useExplainState} from "./state";

import {darkPalette, lightPalette, Treemap} from "./treemapLayout";
import {Theme, useTheme} from "@edgedb/common/hooks/useTheme";
import {
  explainGraphSettings,
  graphType,
  graphUnit,
} from "../../state/explainGraphSettings";
import Tooltip from "@edgedb/common/ui/tooltip";

export enum ExplainType {
  light = "light",
  full = "full",
}

interface ExplainVisProps {
  state: ExplainState | null;
  classes?: string;
  queryHistoryItem?: QueryHistoryResultItem;
  type?: ExplainType;
}

export const ExplainVis = observer(function ExplainVis({
  state,
  queryHistoryItem,
  type = ExplainType.full,
  classes,
}: ExplainVisProps) {
  if (!state) {
    return <div>loading...</div>;
  }

  const isLight = type === ExplainType.light;

  return (
    <ExplainContext.Provider value={state}>
      <div className={cn(styles.explainVis, classes)}>
        {queryHistoryItem && (
          <ExplainHeader queryHistoryItem={queryHistoryItem} />
        )}
        {!isLight && explainGraphSettings.isAreaGraph ? (
          <Treemap />
        ) : (
          <Flamegraph isLight={isLight} />
        )}
        {queryHistoryItem && <PlanDetails />}
      </div>
    </ExplainContext.Provider>
  );
});

const ExplainHeader = observer(function ExplainHeader({
  queryHistoryItem,
}: {
  queryHistoryItem: QueryHistoryResultItem;
}) {
  const state = useExplainState();
  const plan = state.focusedPlan ?? state.planTree.data;
  const queryTimeCost = explainGraphSettings.isTimeGraph
    ? `${plan.totalTime}ms`
    : plan.totalCost;

  return (
    <div className={styles.explainHeader}>
      <div className={styles.switchers}>
        <Switch
          labels={["Area", "Flame"]}
          value={
            explainGraphSettings.isAreaGraph
              ? switchState.left
              : switchState.right
          }
          onChange={() => {
            explainGraphSettings.setGraphType(
              explainGraphSettings.isAreaGraph
                ? graphType.flame
                : graphType.area
            );
            if (explainGraphSettings.isAreaGraph)
              state.finishTreemapTransition();
          }}
        />
        <Switch
          labels={["Time", "Cost"]}
          disabled={!state.planTree.data.totalTime}
          value={
            explainGraphSettings.isTimeGraph
              ? switchState.left
              : switchState.right
          }
          onChange={() => {
            explainGraphSettings.isTimeGraph
              ? explainGraphSettings.setGraphUnit(graphUnit.cost)
              : explainGraphSettings.setGraphUnit(graphUnit.time);

            explainGraphSettings.setUserUnitChoice(
              explainGraphSettings.graphUnit
            );
          }}
        />
      </div>
      {/* <>
        {state.planTree.data.totalTime == null ? ( // TODO DP: delete after updating tooltip
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
      </> */}
      {explainGraphSettings.isAreaGraph && (
        <p className={styles.queryDuration}>{queryTimeCost}</p>
      )}
    </div>
  );
});

const Flamegraph = observer(function Flamegraph({
  isLight = false,
}: {
  isLight?: boolean;
}) {
  const state = useExplainState();

  const ref = useRef<HTMLDivElement>(null);

  useResize(ref, ({width}) => state.setFlamegraphWidth(width - 12), [state]);

  const width = state.flamegraphWidth;
  const [zoom, offset] = state.flamegraphZoomOffset;

  const range =
    state.planTree.data[
      explainGraphSettings.isTimeGraph ? "totalTime" : "totalCost"
    ]! / zoom;
  return (
    <div
      style={{height: (state.planTree.data.childDepth + 1) * 38 + 12}}
      ref={ref}
      className={styles.flamegraph}
      onWheel={(e) => {
        const [zoom, offset] = state.flamegraphZoomOffset;
        if (e.ctrlKey) {
          const mouseOffset =
            e.clientX - ref.current!.getBoundingClientRect().left - 8;

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
      <div className={styles.graphScale}>
        <span>
          {explainGraphSettings.isTimeGraph
            ? range.toFixed(range < 1 ? 1 : 0) + "ms"
            : range.toFixed(0)}
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: -offset + 6,
        }}
        onMouseLeave={() => state.setHoveredPlan(null)}
      >
        {width ? (
          <FlamegraphNode
            plan={state.planTree.data}
            depth={0}
            width={width * zoom}
            left={0}
            visibleRange={[offset - 16, offset + width + 16]}
            isLight={isLight}
          />
        ) : null}
      </div>
    </div>
  );
});

const PlanDetails = observer(function PlanDetails() {
  const state = useExplainState();

  const plan = state.hoveredPlan || state.selectedPlan || state.planTree.data;

  return plan ? (
    <div className={styles.planDetails}>
      <div className={styles.header}>
        <span className={styles.nodeType}>{plan.type}:</span>
        <span className={styles.stats}>
          Self {explainGraphSettings.isTimeGraph ? "Time:" : "Cost:"}
          <span className={styles.statsResults}>
            {explainGraphSettings.isTimeGraph
              ? plan.selfTime!.toPrecision(5).replace(/\.?0+$/, "") + "ms"
              : plan.selfCost.toPrecision(5).replace(/\.?0+$/, "")}{" "}
            &nbsp; &nbsp;
            {(
              (explainGraphSettings.isTimeGraph
                ? plan.selfTimePercent!
                : plan.selfCostPercent) * 100
            )
              .toPrecision(2)
              .replace(/\.?0+$/, "")}
            %
          </span>
        </span>
      </div>
      <div className={styles.results}>
        <div className={styles.result}>
          {[
            ["Startup Cost", "startup_cost"],
            ["Total Cost", "total_cost"],
          ].map(([name, key]) => (
            <div key={key}>
              <span className={styles.label}>{name}:</span>
              <span>{plan.raw[key]}</span>
            </div>
          ))}
        </div>
        <div className={styles.result}>
          {[
            ["Startup Time", "actual_startup_time"],
            ["Total Time", "actual_total_time"],
          ].map(([name, key]) => (
            <div key={key}>
              <span className={styles.label}>{name}:</span>
              <span>{plan.raw[key]}ms</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  ) : (
    <div className={styles.noSelectedPlanDetails}>
      Select plan node above for details // todo
    </div>
  );
});

const FlamegraphNode = observer(function _FlamegraphNode({
  plan,
  left,
  width,
  depth,
  visibleRange,
  isLight,
}: {
  plan: Plan;
  left: number;
  width: number;
  depth: number;
  visibleRange: [number, number];
  isLight?: boolean;
}) {
  const state = useExplainState();

  const [_, theme] = useTheme();
  const palette = theme === Theme.light ? lightPalette : darkPalette;

  const ctxId = plan.nearestContextPlan
    ? plan.nearestContextPlan.contextId!
    : plan.contextId;

  const subPlans =
    ctxId != null || depth === 0 ? plan.subPlans! : plan.fullSubPlans;

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
      (explainGraphSettings.isTimeGraph
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
          isLight={isLight}
          visibleRange={[
            visibleRange[0] - childLeft - 2,
            visibleRange[1] - childLeft,
          ]}
        />
      );
    }
    childLeft += childWidth;
  }

  const isSelected = state.selectedPlan?.id === plan.id;

  return (
    <div
      className={cn(styles.flamegraphNode, {
        [styles.hovered]:
          !isSelected && state.hoveredPlan?.id === plan.id && !!plan.parent,
        [styles.selected]: isSelected,
      })}
      style={{
        backgroundColor: depth ? palette[depth % palette.length] : undefined,
        width: width - 4,
        left: left,
      }}
      {...(!isLight && {
        onClick: (e) => {
          e.stopPropagation();
          if (plan.parent) {
            if (state.selectedPlan === plan) {
              state.setSelectedPlan(null);
            } else {
              state.setSelectedPlan(plan);
            }
          }
        },
      })}
      onMouseOver={(e) => {
        e.stopPropagation();
        state.setHoveredPlan(plan);
      }}
      onMouseOut={(e) => {
        e.stopPropagation();
        state.setHoveredPlan(null);
      }}
    >
      <div className={cn(styles.flamegraphBar)}>
        <div
          className={styles.flamegraphLabel}
          style={{
            left: Math.max(0, visibleRange[0] + 8),
          }}
        >
          {ctxId != null ? (
            <CodeBlock code={state.contexts.data[ctxId].text ?? ""} />
          ) : depth === 0 ? (
            <b className={styles.query}>Query</b>
          ) : (
            plan.type
          )}
        </div>
      </div>
      <Tooltip classes={styles.tooltip}>
        <p>
          {explainGraphSettings.isTimeGraph ? "Self time: " : "Self cost: "}

          <b>
            {explainGraphSettings.isTimeGraph
              ? plan.selfTime!.toPrecision(5).replace(/\.?0+$/, "") + "ms"
              : plan.selfCost.toPrecision(5).replace(/\.?0+$/, "")}
          </b>
        </p>
      </Tooltip>
      {sortedSubplans.length || hiddenCount ? (
        <div style={{height: plan.childDepth * 38}}>
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

// export function TestExplainVis({
//   explainOutput: rawOutput,
//   closeExplain,
// }: {
//   explainOutput: string;
//   closeExplain: () => void;
// }) {
//   const data = JSON.parse(rawOutput!)[0];

//   const state = createExplainState(rawOutput!);

//   return (
//     <div className={styles.explainVisTesting}>
//       <button onClick={() => closeExplain()}>close</button>

//       <Visualisations state={state} buffers={data.buffers} />

//       <details>
//         <summary>raw json</summary>
//         <pre>{JSON.stringify(data, null, 2)}</pre>
//       </details>
//     </div>
//   );
// }

// const Visualisations = observer(function Visualisations({
//   state,
//   buffers,
// }: {
//   state: ExplainState;
//   buffers: any;
// }) {
//   return (
//     <ExplainContext.Provider value={state}>
//       <div className={styles.flamegraph}></div>
//       <div className={styles.main}>
//         <div style={{width: "50%"}}>
//           {state.hoveredPlan ? (
//             <pre>
//               {JSON.stringify(
//                 {
//                   selfTime: state.hoveredPlan.selfTime,
//                   selfPercent: state.hoveredPlan.selfTimePercent,
//                   ...state.hoveredPlan.raw,
//                   Plans: undefined,
//                   CollapsedPlans: undefined,
//                 },
//                 null,
//                 2
//               )}
//             </pre>
//           ) : null}
//         </div>
//         <div>
//           {buffers.map((buf: any, idx: number) => (
//             <>
//               <b>{buf[1]}</b>
//               <CodeBlock
//                 code={buf[0]}
//                 customRanges={
//                   state.contextsByBufIdx[idx]
//                     ? state.contextsByBufIdx[idx].map((range) => ({
//                         range: [range.start, range.end],
//                         renderer: (_, content) => (
//                           <>
//                             <span
//                               style={{
//                                 border: "1px solid #d7d7d7",
//                                 borderRadius: 3,
//                                 backgroundColor: `hsl(0, 100%, ${
//                                   100 - range.selfTimePercent! / 2
//                                 }%)`,
//                                 outline:
//                                   state.getCtxId(state.selectedPlan) ===
//                                   range.id
//                                     ? `2px solid #0074e8`
//                                     : undefined,
//                               }}
//                               onMouseEnter={() => {
//                                 // state.setHoveredPlan(range.id) // todo DP fix this
//                               }}
//                               onMouseLeave={() => state.setHoveredPlan(null)}
//                             >
//                               {content}
//                             </span>
//                             {range.linkedBufIdx ? (
//                               <span
//                                 style={{
//                                   fontStyle: "italic",
//                                   background: "#ddd",
//                                 }}
//                               >
//                                 {" "}
//                                 := {state.buffers.data[range.linkedBufIdx - 1]}
//                               </span>
//                             ) : null}
//                           </>
//                         ),
//                       }))
//                     : undefined
//                 }
//               />
//             </>
//           ))}
//         </div>
//       </div>
//       <div className={styles.planTree}>
//         <PlanNode plan={state.planTree.data} />
//       </div>
//     </ExplainContext.Provider>
//   );
// });

// function PlanNode({plan}: {plan: Plan}) {
//   return (
//     <div className={styles.planNodeWrapper}>
//       <div
//         className={cn(styles.planNode, {
//           [styles.noContexts]: !plan.raw.contexts,
//         })}
//       >
//         <div
//           className={styles.heatBar}
//           style={{
//             backgroundColor: `hsl(0, 100%, ${
//               100 - (plan.selfTimePercent ?? plan.selfCostPercent) / 2
//             }%)`,
//           }}
//         />
//         <div className={styles.planContent}>
//           {Math.round(plan.selfTimePercent ?? plan.selfCostPercent)}% Self
//           Time: {plan.selfTime?.toPrecision(5).replace(/\.?0+$/, "")}ms
//           <br />
//           <b>{plan.type}</b>
//           <div className={styles.grid}>
//             {[
//               ["Startup Cost", "startup_cost"],
//               ["Actual Startup Time", "actual_startup_time"],
//               ["Total Cost", "total_cost"],
//               ["Actual Total Time", "actual_total_time"],
//             ].map(([key, prop], i) => (
//               <div key={prop}>
//                 <span>{key}:</span>
//                 <span>
//                   {plan.raw[prop]}
//                   {i % 2 != 0 ? "ms" : ""}
//                 </span>
//               </div>
//             ))}
//           </div>
//           {plan.raw.contexts ? (
//             <>
//               Contexts:{" "}
//               {JSON.stringify(plan.raw.contexts?.map((ctx: any) => ctx.text))}
//             </>
//           ) : null}
//           <details>
//             <summary>all data</summary>
//             <pre>
//               {JSON.stringify(
//                 {
//                   ...plan.raw,
//                   plans: undefined,
//                 },
//                 null,
//                 2
//               )}
//             </pre>
//           </details>
//         </div>
//       </div>

//       {plan.fullSubPlans.length ? (
//         <div className={styles.planSubTree}>
//           {plan.fullSubPlans.map((subplan) => (
//             <PlanNode plan={subplan} key={subplan.id} />
//           ))}
//         </div>
//       ) : null}
//     </div>
//   );
// }
