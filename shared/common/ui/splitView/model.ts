import {model, Model, modelAction, prop} from "mobx-keystone";

export enum SplitViewDirection {
  vertical = "vertical",
  horizontal = "horizontal",
}

@model("SplitViewState")
export class SplitViewState extends Model({
  direction: prop<SplitViewDirection>(SplitViewDirection.horizontal),
  sizes: prop<[number, number]>(() => [50, 50]).withSetter(),
  activeViewIndex: prop<0 | 1>(0).withSetter(),
}) {
  @modelAction
  flipSplitDirection() {
    this.direction =
      this.direction === SplitViewDirection.vertical
        ? SplitViewDirection.horizontal
        : SplitViewDirection.vertical;
  }
}
