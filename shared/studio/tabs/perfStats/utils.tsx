export function formatDurationLabel({
  start,
  end,
}: {
  start: number;
  end?: number;
}) {
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
