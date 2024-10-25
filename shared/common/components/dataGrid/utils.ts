export function calculateInitialColWidths(
  cols: {id: string; typename: string; isLink: boolean}[],
  gridWidth: number
): {[id: string]: number} {
  const colWidths: {[id: string]: number} = {};
  const unsizedCols: string[] = [];
  let totalWidth = 0;
  for (const col of cols) {
    if (col.isLink) {
      colWidths[col.id] = 280;
      continue;
    }
    const width = sizedColTypes[col.typename];
    if (width != null) {
      colWidths[col.id] = width;
      totalWidth += width;
    } else {
      unsizedCols.push(col.id);
    }
  }
  if (unsizedCols.length) {
    const width = Math.max(
      200,
      Math.min(480, (gridWidth - totalWidth) / unsizedCols.length)
    );
    for (const colId of unsizedCols) {
      colWidths[colId] = width;
    }
  }

  return colWidths;
}

const sizedColTypes: {[typename: string]: number} = {
  "std::uuid": 230,
  "std::int16": 100,
  "std::int32": 130,
  "std::int64": 200,
  "std::float32": 130,
  "std::float64": 200,
  "std::decimal": 200,
  "std::bigint": 200,
  "std::bool": 100,
  "std::datetime": 320,
  "cal::local_datetime": 280,
  "cal::local_date": 130,
  "cal::local_time": 170,
  "std::cal::local_datetime": 280,
  "std::cal::local_date": 130,
  "std::cal::local_time": 170,
  "std::duration": 200,
  "cal::relative_duration": 280,
  "cal::date_duration": 100,
  "std::cal::relative_duration": 280,
  "std::cal::date_duration": 100,
  "cfg::memory": 100,
};
