import {makeObservable, observable, computed, action} from "mobx";

export const DefaultColumnWidth = 200;

export interface GridColumn {
  id: string;
}

interface VisibleRanges {
  rows: [number, number];
  cols: [number, number];
}

export class DataGridState {
  gridElRef: HTMLDivElement | null = null;

  constructor(
    public RowHeight: number,
    private getColumns: () => GridColumn[],
    private getPinnedColumns: () => GridColumn[],
    private getRowCount: () => number,
    colwidths?: {[columnId: string]: number},
    public onColumnResizeComplete?: (widths: Map<string, number>) => void
  ) {
    makeObservable(this);
    if (colwidths) {
      this._colWidths = new Map(Object.entries(colwidths));
    }
  }

  @observable
  _colWidths = new Map<string, number>();

  @action
  setColWidth(columnId: string, width: number) {
    this._colWidths.set(columnId, Math.max(width, 60));
  }

  @action
  setColWidths(widths: {[columnId: string]: number}) {
    for (const [id, width] of Object.entries(widths)) {
      this._colWidths.set(id, Math.max(width, 60));
    }
    this.onColumnResizeComplete?.(this._colWidths);
  }

  @computed
  get pinnedColWidths() {
    return this.getPinnedColumns().map(
      (col) => this._colWidths.get(col.id) ?? DefaultColumnWidth
    );
  }

  @computed
  get colWidths() {
    return this.getColumns().map(
      (col) => this._colWidths.get(col.id) ?? DefaultColumnWidth
    );
  }

  @computed
  get colLefts() {
    const widths = this._colWidths;
    const cols = [...this.getPinnedColumns(), ...this.getColumns()];
    const lefts: number[] = Array(cols.length + 1);
    let left = 0;
    for (let i = 0; i < cols.length; i++) {
      lefts[i] = left;
      left += widths.get(cols[i].id) ?? DefaultColumnWidth;
    }
    lefts[cols.length] = left;
    return lefts;
  }

  @computed
  get pinnedColsWidth() {
    return this.colLefts[this.getPinnedColumns().length];
  }

  @computed
  get gridContentWidth() {
    return this.colLefts[this.colLefts.length - 1];
  }

  @computed
  get gridContentHeight() {
    return this.getRowCount() * this.RowHeight;
  }

  @observable
  headerHeight = 32;

  @action
  setHeaderHeight(height: number) {
    this.headerHeight = height + 1;
  }

  @observable
  gridContainerSize = {width: 0, height: 0};

  @action
  setGridContainerSize(width: number, height: number) {
    this.gridContainerSize.width = width;
    this.gridContainerSize.height = height;
  }

  @observable
  scrollPos = {top: 0, left: 0};

  @action
  updateScrollPos(scrollTop: number, scrollLeft: number) {
    this.scrollPos.top = scrollTop;
    this.scrollPos.left = scrollLeft;
  }

  @computed({
    equals: (a: VisibleRanges, b: VisibleRanges) =>
      a.rows[0] === b.rows[0] &&
      a.rows[1] === b.rows[1] &&
      a.cols[0] === b.cols[0] &&
      a.cols[1] === b.cols[1],
  })
  get visibleRanges(): VisibleRanges {
    const colLefts = this.colLefts;
    const scrollPos = this.scrollPos;
    const pinnedColCount = this.getPinnedColumns().length;
    const pinnedColsWidth = this.pinnedColsWidth;

    let i = pinnedColCount;
    for (; i < colLefts.length - 1; i++) {
      if (scrollPos.left < colLefts[i] - pinnedColsWidth) break;
    }
    const startCol = i - 1 - pinnedColCount;
    const scrollRight =
      scrollPos.left + this.gridContainerSize.width - pinnedColsWidth;
    for (; i < colLefts.length - 1; i++) {
      if (colLefts[i] - pinnedColsWidth > scrollRight) break;
    }
    const endCol = i - 1 - pinnedColCount;

    return {
      rows: [
        Math.max(0, Math.floor(this.scrollPos.top / this.RowHeight / 10) * 10),
        Math.min(
          this.getRowCount(),
          Math.ceil(
            (this.scrollPos.top +
              this.gridContainerSize.height -
              this.headerHeight) /
              this.RowHeight /
              10
          ) * 10
        ),
      ],
      cols: [startCol, endCol],
    };
  }
}
