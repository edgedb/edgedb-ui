import {useRef} from "react";
import {
  action,
  makeObservable,
  observable,
  onBecomeObserved,
  onBecomeUnobserved,
} from "mobx";
import {observer} from "mobx-react-lite";

class CurrentTimestamp {
  @observable
  timestamp = Date.now();

  private _timer: number | null = null;

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

export const RelativeTime = observer(function RelativeTime({
  timestamp,
  fullNames = false,
}: {
  timestamp: number;
  fullNames?: boolean;
}) {
  const cachedTime = useRef<string>();

  if (cachedTime.current) {
    return <>{cachedTime.current}</>;
  }

  const diff = (currentTimestamp.timestamp - timestamp) / 1000;
  if (diff < 60) {
    return (
      <>
        {Math.floor(diff)}
        {fullNames ? " seconds" : "s"} ago
      </>
    );
  }
  if (diff < 3600) {
    return (
      <>
        {Math.floor(diff / 60)}
        {fullNames ? " minutes" : "m"} ago
      </>
    );
  }

  const date = new Date(timestamp);
  cachedTime.current = fullNames
    ? date.toLocaleString()
    : date.toLocaleTimeString();
  return <>{cachedTime.current}</>;
});
