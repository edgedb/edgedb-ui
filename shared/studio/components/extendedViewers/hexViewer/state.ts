import {computed} from "mobx";
import {Model, model, modelAction, prop} from "mobx-keystone";

export function createHexViewerState(data: Uint8Array): HexViewer {
  const state = new HexViewer({});

  state.data = data;

  return state;
}

@model("HexViewer")
export class HexViewer extends Model({
  asciiMode: prop(false).withSetter(),
  hoverOffset: prop<number | null>(null).withSetter(),
  startOffset: prop(0),
  endOffset: prop<number | null>(null),
}) {
  data: Uint8Array | null = null;

  @computed
  get rowsCount() {
    return this.data
      ? Math.ceil(this.data.byteLength / (this.asciiMode ? 80 : 16))
      : 0;
  }

  @computed
  get offsetWidth() {
    return Math.max(8, this.rowsCount.toString(16).length + 2);
  }

  @modelAction
  setSelectedOffset(offset: number, end: boolean) {
    if (end && offset !== this.startOffset) {
      this.endOffset = offset;
    } else {
      this.startOffset = offset;
      this.endOffset = null;
    }
  }

  setSelectedOffsetRelative(relOffset: number, end: boolean) {
    const newOffset = Math.max(
      0,
      Math.min(
        (this.endOffset ?? this.startOffset) + relOffset,
        this.data!.byteLength - 1
      )
    );
    this.setSelectedOffset(newOffset, end);
  }

  @computed
  get selectedRange(): [number, number] | null {
    if (this.endOffset != null) {
      return this.startOffset < this.endOffset
        ? [this.startOffset, this.endOffset]
        : [this.endOffset, this.startOffset];
    }
    return null;
  }

  downloadData() {
    if (!this.data) return;

    const range = this.selectedRange;
    const dataUrl = URL.createObjectURL(
      new Blob(
        [range ? this.data.subarray(range[0], range[1] + 1) : this.data],
        {type: "application/octet-stream"}
      )
    );

    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = "";

    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    URL.revokeObjectURL(dataUrl);
  }
}
