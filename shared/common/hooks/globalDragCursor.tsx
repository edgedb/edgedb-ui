import {createContext, PropsWithChildren, useState, useContext} from "react";

const globalDragCursorContext = createContext<
  [string | null, (val: string | null) => void] | null
>(null);

export function GlobalDragCursorProvider({children}: PropsWithChildren<{}>) {
  const state = useState<string | null>(null);

  return (
    <globalDragCursorContext.Provider value={state}>
      {children}
    </globalDragCursorContext.Provider>
  );
}

export function useGlobalDragCursor() {
  return useContext(globalDragCursorContext)!;
}
