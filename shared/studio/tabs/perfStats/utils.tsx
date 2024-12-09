import {type QueryStats} from "./state";

export const regions: {start: number; end: number}[] = [
  {start: 0, end: 1},
  {start: 1, end: 10},
  {start: 10, end: 100},
  {start: 100, end: 1000},
  {start: 1000, end: 60_000},
  {start: 60_000, end: 3_600_000},
  {start: 3_600_000, end: Infinity},
];

export const gradient = [
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

export function calculateHistogram(stats: QueryStats[] | null) {
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
        const height = yAxisMaxLog
          ? (Math.log10(bucket.count) / yAxisMaxLog) * 95 + 5
          : bucket.count * 100;
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

export function formatDurationLabel({
  start,
  end,
}: {
  start: number;
  end?: number;
}) {
  const val = end ?? start;
  if (val < 1) {
    return (
      <>
        {start.toPrecision(1)}
        {end ? ` - ${end.toPrecision(1)}` : null}
        <span>ms</span>
      </>
    );
  }
  if (val <= 100) {
    return (
      <>
        {start}
        {end ? ` - ${end}` : null}
        <span>ms</span>
      </>
    );
  }
  if (val <= 60_000) {
    return (
      <>
        {start / 1000}
        {end ? ` - ${end / 1000}` : null}
        <span>s</span>
      </>
    );
  }
  return (
    <>
      {start / 60_000}
      {end ? ` - ${end / 60_000}` : null}
      <span>m</span>
    </>
  );
}
