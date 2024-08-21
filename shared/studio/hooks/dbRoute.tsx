import {createContext, useContext, ReactNode} from "react";

export type NavigateFunction = (
  path: string | {path?: string; searchParams?: URLSearchParams},
  replace?: boolean
) => void;

export interface DBRouter {
  currentPath: string[];
  searchParams: URLSearchParams;
  locationKey: string;
  navigate: NavigateFunction;
  gotoInstancePage: () => void;
}

const DBRouterContext = createContext<DBRouter>(null!);

export const DBRouterProvider = DBRouterContext.Provider;

export function useDBRouter() {
  return useContext(DBRouterContext);
}
