import {
  action,
  makeObservable,
  observable,
  onBecomeObserved,
  onBecomeUnobserved,
} from "mobx";

class CurrentDate {
  @observable
  currentDate = {
    year: 0,
    month: 0,
    day: 0,
  };

  private _timer: NodeJS.Timeout | null = null;

  constructor() {
    makeObservable(this);

    onBecomeObserved(this, "currentDate", this._updateCurrentDate);
    onBecomeUnobserved(this, "currentDate", () => {
      if (this._timer) {
        clearTimeout(this._timer);
      }
    });
  }

  isToday(date: Date) {
    return (
      date.getFullYear() === this.currentDate.year &&
      date.getMonth() === this.currentDate.month &&
      date.getDate() === this.currentDate.day
    );
  }

  @action.bound
  private _updateCurrentDate() {
    const now = new Date();
    this.currentDate = {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
    };
    const midnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );
    if (this._timer) {
      clearTimeout(this._timer);
    }
    this._timer = setTimeout(
      this._updateCurrentDate,
      midnight.getTime() - now.getTime()
    );
  }
}

export const currentDate = new CurrentDate();
