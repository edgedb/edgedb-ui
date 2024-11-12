import {useEffect, useMemo, useRef, useState} from "react";
import {observer} from "mobx-react-lite";

import cn from "@edgedb/common/utils/classNames";
import {useResize} from "@edgedb/common/hooks/useResize";

import {PerfStatsState, QueryStats} from "./state";

import styles from "./perfStats.module.scss";

export const StatsChart = observer(function StatsChart({
  state,
}: {
  state: PerfStatsState;
}) {
  const stats = state.stats;

  const chart = useMemo(() => calculateHistogram(stats), [stats]);

  const [hoveredBucketIndex, setHoveredBucketIndex] = useState<number>(10);
  const hoveredBucket = chart?.data[hoveredBucketIndex] ?? null;

  const [height, setHeight] = useState(150);
  const chartRef = useRef<SVGSVGElement>(null);
  useResize(chartRef, ({height}) => setHeight(height));

  const yAxisLabels = useMemo(() => {
    if (!chart) return [];
    const maxLog = Math.log10(chart.yAxisMax);
    const labels: {bottom: number; value: number}[] = [];
    for (let i = 0; i < maxLog; i++) {
      labels.push({bottom: (i / maxLog) * 95 + 5, value: 10 ** i});
    }
    return labels;
  }, [chart?.yAxisMax, height]);

  const selectedBuckets = useMemo(() => {
    const filter = state.timeFilter;
    return filter && chart
      ? chart.data.filter(
          (bucket) => bucket.start >= filter[0] && bucket.start < filter[1]
        )
      : null;
  }, [state.timeFilter, chart]);

  return (
    <div
      className={cn(styles.statsChart, {
        [styles.chartHovered]: hoveredBucket != null,
      })}
    >
      {chart ? (
        <div className={styles.chartLayout}>
          <div
            className={styles.yaxis}
            style={{margin: `${height / 102}px 0`}}
          >
            {yAxisLabels.map(({bottom, value}) => (
              <div
                key={value}
                className={styles.axisLabel}
                style={{bottom: `${bottom}%`}}
              >
                <div>{formatCount(value)}</div>
              </div>
            ))}

            {hoveredBucket ? (
              <div
                className={styles.hoverAxisLabel}
                style={{
                  bottom: `${
                    hoveredBucket.count
                      ? (Math.log10(hoveredBucket.count) /
                          Math.log10(chart.yAxisMax)) *
                          95 +
                        5
                      : 0
                  }%`,
                }}
              >
                <div>{formatCount(hoveredBucket.count)}</div>
              </div>
            ) : null}
          </div>
          <svg
            ref={chartRef}
            viewBox="0 -1 100 102"
            preserveAspectRatio="none"
            onMouseMove={(e) => {
              const bbox = e.currentTarget.getBoundingClientRect();
              const bucketIndex = Math.floor(
                ((e.clientX - bbox.left) / bbox.width) * chart.data.length
              );
              setHoveredBucketIndex(bucketIndex);
            }}
            onMouseLeave={() => setHoveredBucketIndex(-1)}
            onClick={(e) => {
              if (hoveredBucket) {
                state.setTimeFilter(
                  [hoveredBucket.start, hoveredBucket.end],
                  e.shiftKey
                );
              }
            }}
          >
            {selectedBuckets ? (
              <rect
                className={styles.selectedRect}
                width={
                  selectedBuckets[selectedBuckets.length - 1].rect.x -
                  selectedBuckets[0].rect.x +
                  selectedBuckets[0].rect.width
                }
                height={100}
                x={selectedBuckets[0].rect.x}
                y={0}
              />
            ) : null}
            {hoveredBucket ? (
              <>
                <rect
                  className={styles.hoverRect}
                  width={hoveredBucket.rect.width}
                  height={100}
                  x={hoveredBucket.rect.x}
                  y={0}
                />
                <line
                  className={styles.hoverYLine}
                  x1={0}
                  x2={100}
                  y1={hoveredBucket.rect.y}
                  y2={hoveredBucket.rect.y}
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : null}
            {chart.data.map(({start, rect, colorIndex}, i) =>
              rect.height ? (
                <rect
                  key={i}
                  vectorEffect="non-scaling-stroke"
                  {...rect}
                  fill={gradient[colorIndex]}
                  style={{
                    opacity:
                      state.timeFilter &&
                      (start < state.timeFilter[0] ||
                        start >= state.timeFilter[1])
                        ? 0.3
                        : undefined,
                  }}
                />
              ) : null
            )}
          </svg>
          <div className={styles.xaxis}>
            {chart.xAxisLabels.map(({left, value}) => (
              <div
                key={value}
                className={styles.axisLabel}
                style={{left: `${left}%`}}
              >
                <div>{formatDurationAxisLabel({start: value})}</div>
              </div>
            ))}
            {hoveredBucket ? (
              <div
                className={styles.hoverAxisLabel}
                style={{
                  left: `${
                    (50 / chart.data.length) * (hoveredBucketIndex * 2 + 1)
                  }%`,
                }}
              >
                <div>{formatDurationAxisLabel(hoveredBucket)}</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
});

const regions: {start: number; end: number}[] = [
  {start: 0, end: 1},
  {start: 1, end: 10},
  {start: 10, end: 100},
  {start: 100, end: 1000},
  {start: 1000, end: 60_000},
  {start: 60_000, end: 3_600_000},
  {start: 3_600_000, end: Infinity},
];

const gradient = [
  "#99c76b",
  "#b0c15d",
  "#c6b954",
  "#dbb053",
  "#eea659",
  "#f09454",
  "#f18253",
  "#f06e54",
  "#ee5959",
];

interface Bucket {
  start: number;
  end: number;
  count: number;
  regionIndex: number;
}

function calculateHistogram(stats: QueryStats[] | null) {
  if (!stats || !stats.length) return null;

  const sortedStats = [...stats].sort(
    (a, b) => a.meanExecTime - b.meanExecTime
  );
  let regionIndex = 0;
  let region = regions[regionIndex];

  const buckets: Bucket[] = [];
  let bucket: Bucket | null = null;

  let maxCount = 0;
  for (const stat of sortedStats) {
    while (stat.meanExecTime >= region.end) {
      regionIndex++;
      region = regions[regionIndex];
    }

    const bucketStart =
      region.start +
      Math.floor((stat.meanExecTime - region.start) / (region.start || 0.1)) *
        (region.start || 0.1);
    if (!bucket || bucket.start !== bucketStart) {
      bucket = {
        start: bucketStart,
        end: bucketStart + (region.start || 0.1),
        count: 0,
        regionIndex,
      };
      buckets.push(bucket);
    }
    bucket.count += Number(stat.calls);
    maxCount = maxCount < bucket.count ? bucket.count : maxCount;
  }

  const lastBucket = bucket!;

  // const yAxisInc = 10 ** Math.max(0, Math.floor(Math.log10(maxCount)) - 1);
  // const yAxisMax = Math.ceil(maxCount / yAxisInc) * yAxisInc;
  const yAxisMaxLog = Math.log10(maxCount);

  const regionCounts = regions
    .slice(buckets[0].regionIndex, lastBucket.regionIndex + 1)
    .map(
      ({start, end}) =>
        ((end === Infinity ? lastBucket.end : end) - start) / (start || 0.1)
    );
  const bucketsCount = regionCounts.reduce((sum, count) => sum + count, 0);
  const bucketWidth = 100 / bucketsCount;

  const data: (Bucket & {
    colorIndex: number;
    rect: {width: number; height: number; x: number; y: number};
  })[] = Array(bucketsCount);
  const xAxisLabels: {left: number; value: number}[] = [];

  let i = 0;
  let bi = 0;
  for (let ri = 0; ri < regionCounts.length; ri++) {
    const region = regions[buckets[0].regionIndex + ri];
    if (ri == 0) {
      xAxisLabels.push({left: 0, value: region.start});
    }
    xAxisLabels.push({
      left: (i + regionCounts[ri]) * bucketWidth,
      value: region.end,
    });

    for (let ci = 0; ci < regionCounts[ri]; ci++) {
      const bucket = buckets[bi];
      const start = region.start + ci * (region.start || 0.1);
      if (bucket?.start === start) {
        const height = (Math.log10(bucket.count) / yAxisMaxLog) * 95 + 5;
        data[i] = {
          ...bucket,
          rect: {
            width: bucketWidth,
            height: height,
            x: i * bucketWidth,
            y: 100 - height,
          },
          colorIndex: Math.floor(
            Math.max(0, Math.min(1, Math.log10(bucket.start) / 6)) *
              gradient.length
          ),
        };

        bi++;
      } else {
        data[i] = {
          start,
          end: start + (region.start || 0.1),
          count: 0,
          regionIndex: buckets[0].regionIndex + ri,
          rect: {
            width: bucketWidth,
            height: 0,
            x: i * bucketWidth,
            y: 100,
          },
          colorIndex: 0,
        };
      }
      i++;
    }
  }

  return {data, yAxisMax: maxCount, xAxisLabels};
}

const units = ["", "k", "M", "B", "T"];
function formatCount(value: number) {
  const valueLog = Math.log10(value);
  const mag = Math.floor(valueLog / 3);
  const val = mag < 1 ? value : value / 10 ** (mag * 3);
  return (
    <>
      {Number.isInteger(val) ? val : val.toPrecision(3)}
      <span>{units[mag]}</span>
    </>
  );
}

function formatDurationAxisLabel({start, end}: {start: number; end?: number}) {
  if ((end ?? start) < 1) {
    return (
      <>
        {start.toPrecision(1)}
        {end ? ` - ${end.toPrecision(1)}` : null}
        <span>ms</span>
      </>
    );
  }
  if ((end ?? start) <= 100) {
    return (
      <>
        {start}
        {end ? ` - ${end}` : null}
        <span>ms</span>
      </>
    );
  }
  if ((end ?? start) <= 1000) {
    return (
      <>
        {start / 1000}
        {end ? ` - ${end / 1000}` : null}
        <span>s</span>
      </>
    );
  }
  // if (duration < 60_000) {
  //   return (
  //     <>
  //       {(duration / 1000).toFixed(2)}
  //       <span>s</span>
  //     </>
  //   );
  // }
  // if (duration < 3_600_000) {
  //   return (
  //     <>
  //       {(duration / 60_000).toFixed(2)}
  //       <span>m</span>
  //     </>
  //   );
  // }
  // return (
  //   <>
  //     {(duration / 3_600_000).toFixed(2)}
  //     <span>h</span>
  //   </>
  // );
  return null;
}
