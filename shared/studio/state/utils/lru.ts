import {observable, makeObservable, action} from "mobx";

export class ObservableLRU<K, V> {
  @observable.shallow
  data = new Map<K, V>();

  lastAccessed: K[] = [];

  constructor(private size: number) {
    makeObservable(this);
  }

  has(key: K): boolean {
    return this.data.has(key);
  }

  get(key: K): V | undefined {
    const val = this.data.get(key);

    if (val) {
      if (this.lastAccessed[0] !== key) {
        this.lastAccessed.unshift(
          this.lastAccessed.splice(this.lastAccessed.indexOf(key), 1)[0]
        );
      }

      return val;
    }
  }

  @action
  set(key: K, val: V): void {
    if (this.data.has(key)) {
      this.data.set(key, val);
      this.get(key);
    } else {
      this.data.set(key, val);
      this.lastAccessed.unshift(key);

      if (this.lastAccessed.length > this.size) {
        const dropKey = this.lastAccessed.pop()!;
        this.data.delete(dropKey);
      }
    }
  }

  clear(): void {
    this.data.clear();
    this.lastAccessed = [];
  }
}
