import {useRef} from "react";
import {
  action,
  makeObservable,
  observable,
  onBecomeObserved,
  onBecomeUnobserved,
} from "mobx";
import {observer} from "mobx-react-lite";

export class CurrentTimestamp {
  @observable
  timestamp = Date.now();

  private _timer: number | null = null;

  constructor(private _updateFrequency = 1000) {
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
    this._timer = setTimeout(
      this._updateTimestamp,
      this._updateFrequency
    ) as unknown as number;
  }

  @action.bound
  refresh() {
    this._updateTimestamp();
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
  if (Math.floor(diff) <= 0) {
    return <>Just now</>;
  }
  if (diff < 60) {
    const sec = Math.floor(diff);
    return (
      <>
        {sec}
        {fullNames ? (sec != 0 ? " seconds" : " second") : "s"} ago
      </>
    );
  }
  if (diff < 3600) {
    const min = Math.floor(diff / 60);
    return (
      <>
        {min}
        {fullNames ? (min != 0 ? " minutes" : " minute") : "m"} ago
      </>
    );
  }

  const date = new Date(timestamp);
  cachedTime.current = fullNames
    ? date.toLocaleString()
    : date.toLocaleTimeString();
  return <>{cachedTime.current}</>;
});
