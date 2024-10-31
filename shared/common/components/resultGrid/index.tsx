import {observer} from "mobx-react-lite";

import cn from "@edgedb/common/utils/classNames";

import {GridHeader, ResultGridState, RowHeight} from "./state";

import {
  DataGrid,
  GridContent,
  GridHeaders,
  HeaderResizeHandle,
} from "../dataGrid";

import gridStyles from "../dataGrid/dataGrid.module.scss";
import styles from "./resultGrid.module.scss";

export {createResultGridState, ResultGridState} from "./state";

export interface ResultGridProps {
  state: ResultGridState;
}

export function ResultGrid({state}: ResultGridProps) {
  return (
    <DataGrid state={state.grid}>
      <ResultGridHeaders state={state} />
      <ResultGridContent state={state} />
    </DataGrid>
  );
}

const ResultGridHeaders = observer(function ResultGridHeaders({
  state,
}: {
  state: ResultGridState;
}) {
  return (
    <GridHeaders
      state={state.grid}
      pinnedHeaders={null}
      headers={state.allHeaders.flatMap((header, i, headers) => [
        <div
          key={header.id}
          className={styles.header}
          style={{
            gridColumn: `${header.startIndex + 1} / ${
              header.startIndex + header.span + 1
            }`,
            gridRow: `${header.depth + 1}`,
          }}
        >
          {header.name}
        </div>,
        (
          header.parent == null
            ? header.startIndex != 0
            : header.parent.subHeaders![0] != header
        ) ? (
          <HeaderResizeHandle
            key={`resize-${headers[i - 1].id}`}
            state={state.grid}
            columnId={headers[i - 1].id}
            style={{
              gridColumn: header.startIndex + 1,
              gridRowStart: header.depth + 1,
              gridRowEnd: state.maxDepth + 2,
            }}
          />
        ) : null,
      ])}
    />
  );
});

const ResultGridContent = observer(function ResultGridContent({
  state,
}: ResultGridProps) {
  const ranges = state.grid.visibleRanges;
  const rowTops = state.rowTops;

  const cells: JSX.Element[] = [];
  for (const header of state.flatHeaders.slice(
    ranges.cols[0],
    ranges.cols[1] + 1
  )) {
    let rowIndex = ranges.rows[0];
    while (rowIndex < ranges.rows[1]) {
      const {data, indexOffset, endIndex} = state.getData(header, rowIndex);
      const tops = rowTops.get(data);
      const offsetRowIndex = rowIndex - indexOffset;
      let dataIndex = tops
        ? tops.findIndex((top) => top > offsetRowIndex) - 1
        : offsetRowIndex;
      rowIndex = (tops ? tops[dataIndex] : dataIndex) + indexOffset;
      while (dataIndex < data.length && rowIndex < ranges.rows[1]) {
        cells.push(
          <GridCell
            key={`${header.startIndex}-${rowIndex}`}
            state={state}
            header={header}
            rowIndex={rowIndex}
            height={
              (tops ? tops[dataIndex + 1] : dataIndex + 1) +
              indexOffset -
              rowIndex
            }
            data={data[dataIndex][header.name]}
          />
        );
        dataIndex += 1;
        rowIndex = (tops ? tops[dataIndex] : dataIndex) + indexOffset;
      }
      const dataEndIndex =
        indexOffset + (tops ? tops[tops.length - 1] : data.length);
      if (dataEndIndex !== endIndex && dataEndIndex < ranges.rows[1]) {
        cells.push(
          <GridCell
            key={`${header.startIndex}-${dataEndIndex}`}
            state={state}
            header={header}
            rowIndex={dataEndIndex}
            height={endIndex - dataEndIndex}
            data={undefined}
          />
        );
      }
      rowIndex = endIndex;
    }
  }

  return <GridContent state={state.grid} cells={cells} />;
});

const GridCell = observer(function GridCell({
  state,
  header,
  rowIndex,
  height,
  data,
}: {
  state: ResultGridState;
  header: GridHeader;
  rowIndex: number;
  height: number;
  data: any;
}) {
  return (
    <div
      className={cn(gridStyles.cell, {
        [gridStyles.emptyCell]: data === undefined,
      })}
      style={{
        top: rowIndex * RowHeight,
        height: height * RowHeight,
        left: state.grid.colLefts[header.startIndex],
        width: state.grid.colWidths[header.startIndex],
      }}
    >
      {data !== undefined ? (
        <div
          className={cn(styles.cellContent, {[styles.stickyCell]: height > 1})}
        >
          {data?.toString() ?? "{}"}
        </div>
      ) : null}
    </div>
  );
});
