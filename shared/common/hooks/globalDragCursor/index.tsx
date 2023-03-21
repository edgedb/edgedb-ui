import {
  createContext,
  PropsWithChildren,
  useState,
  useContext,
  CSSProperties,
} from "react";

import styles from "./globalDragCursor.module.scss";

type Cursor = Exclude<CSSProperties["cursor"], undefined>;

const GlobalDragCursorContext = createContext<
  [Cursor | null, (val: Cursor | null) => void] | null
>(null);

export function GlobalDragCursorProvider({children}: PropsWithChildren<{}>) {
  const state = useState<Cursor | null>(null);

  return (
    <>
      <GlobalDragCursorContext.Provider value={state}>
        {children}
      </GlobalDragCursorContext.Provider>
      {state[0] ? (
        <div
          className={styles.globalDragCursorOverlay}
          style={{cursor: state[0]}}
        />
      ) : null}
    </>
  );
}

export function useGlobalDragCursor() {
  return useContext(GlobalDragCursorContext)!;
}
