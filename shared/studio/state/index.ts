import {AnyModel, ModelClass, getTypeInfo, ModelTypeInfo} from "mobx-keystone";

import {useDatabaseState} from "./database";

export {connCtx} from "./connection";
export {dbCtx} from "./database";

export {useDatabaseState};

export function useTabState<T extends AnyModel>(stateClass: ModelClass<T>): T {
  const modelType = (getTypeInfo(stateClass) as ModelTypeInfo).modelType;
  return useDatabaseState().tabStates.get(modelType) as T;
}
