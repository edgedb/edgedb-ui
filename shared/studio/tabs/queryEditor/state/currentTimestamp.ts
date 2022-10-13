import {
  action,
  makeObservable,
  observable,
  onBecomeObserved,
  onBecomeUnobserved,
} from "mobx";

class CurrentTimestamp {
  @observable
  timestamp = Date.now();

  private _timer: NodeJS.Timeout | null = null;

  constructor() {
    makeObservable(this);

    onBecomeObserved(this, "timestamp", this._updateTimestamp);
    onBecomeUnobserved(this, "timestamp", () => {
      if (this._timer) {
        clearTimeout(this._timer);
      }
    });
  }

  @action.bound
  private _updateTimestamp() {
    this.timestamp = Date.now();
    if (this._timer) {
      clearTimeout(this._timer);
    }
    this._timer = setTimeout(this._updateTimestamp, 1000);
  }
}

export const currentTimestamp = new CurrentTimestamp();
