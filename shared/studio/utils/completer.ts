export class Completer<T = any> {
  public result: T | undefined;
  private _promise: Promise<T> | null = null;

  constructor(data: T | Promise<T>) {
    if (data instanceof Promise) {
      this._promise = data;
    } else {
      this.result = data;
    }
  }

  get completed() {
    return this.result !== undefined;
  }

  get promise(): Promise<T> {
    return (async () => {
      if (this._promise) {
        this.result = await this._promise;
      }
      return this.result!;
    })();
  }
}
