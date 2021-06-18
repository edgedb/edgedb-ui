import {createContext, useContext} from "react";

import {InspectorState} from "./state";

export const InspectorContext = createContext<InspectorState | null>(null);

export function useInspectorState() {
  return useContext(InspectorContext)!;
}
