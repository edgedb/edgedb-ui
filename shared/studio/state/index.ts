import {AnyModel, ModelClass} from "mobx-keystone";

import {useDatabaseState} from "./database";

export {connCtx} from "./connection";
export {dbCtx} from "./database";

export {useDatabaseState};

export function useTabState<T extends AnyModel>(stateClass: ModelClass<T>): T {
  return useDatabaseState().tabStates.get(stateClass.name) as T;
}
