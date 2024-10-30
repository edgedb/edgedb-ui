/* eslint-disable no-console */

const flags = (
  ((import.meta as any).env?.VITE_APP_DEBUG?.split(",") ?? []) as string[]
).reduce((_flags, flag) => {
  _flags[flag] = true;
  return _flags;
}, {} as {[flag: string]: boolean});

const noOp = () => {
  // no-op
};

export const timeStart = flags.timers ? console.time : noOp;

export const timeEnd = flags.timers ? console.timeEnd : noOp;

export const log = flags.logs ? console.log : noOp;

export const error = flags.logs ? console.error : noOp;
