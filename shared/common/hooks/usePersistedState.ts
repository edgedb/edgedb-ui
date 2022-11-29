import {useCallback, useState} from "react";

const stateCache: {[key: string]: any} = {};

export function usePersistedState<S>(
  key: string,
  initialState: S | (() => S)
): [S, (value: S) => void] {
  const persisted: S | null =
    stateCache[key] ?? JSON.parse(localStorage.getItem(key) ?? "null");

  const [state, _setState] = useState<S>(persisted ?? initialState);

  const setState = useCallback(
    (value: S) => {
      stateCache[key] = value;
      localStorage.setItem(key, JSON.stringify(value));
      _setState(value);
    },
    [key, state]
  );

  return [state, setState];
}
