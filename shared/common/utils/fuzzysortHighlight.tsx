export function highlightString(
  str: string,
  indices: readonly number[],
  highlightClass: string
): string | JSX.Element {
  if (!indices.length) {
    return str;
  }
  const highlighted: (string | JSX.Element)[] = [str.slice(0, indices[0])];
  let rangeStart = indices[0];
  let lastInd = rangeStart;
  for (const ind of indices.slice(1)) {
    if (ind === lastInd + 1) {
      lastInd++;
    } else {
      highlighted.push(
        <span key={highlighted.length} className={highlightClass}>
          {str.slice(rangeStart, lastInd + 1)}
        </span>,
        str.slice(lastInd + 1, ind)
      );
      rangeStart = ind;
      lastInd = ind;
    }
  }

  highlighted.push(
    <span key={highlighted.length} className={highlightClass}>
      {str.slice(rangeStart, lastInd + 1)}
    </span>,
    str.slice(lastInd + 1)
  );

  return <>{highlighted}</>;
}
