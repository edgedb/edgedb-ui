import {
  Model,
  model,
  prop,
  findParent,
  objectMap,
  modelAction,
} from "mobx-keystone";
import {reaction, observable, computed} from "mobx";

import {
  extractQueryParameters,
  ResolvedParameter,
} from "./extractQueryParameters";

import {Repl} from ".";
import {dbCtx} from "../../../state/database";

export type {ResolvedParameter};

@model("Repl/QueryParam")
class ReplQueryParamData extends Model({
  values: prop<[string, ...string[]]>(() => [""]),
  disabled: prop(false).withSetter(),
}) {
  @modelAction
  setValue(index: number, value: string) {
    this.values[index] = value;
  }

  @modelAction
  addNewValue() {
    this.values.push("");
  }

  @modelAction
  removeValue(index: number) {
    this.values.splice(index, 1);
  }
}

export type ParamsData = {
  [key: string]: {
    type: string | null;
    value: string | string[];
    disabled: boolean;
    isArray: boolean;
    isOptional: boolean;
  };
};

@model("Repl/QueryParamsEditor")
export class ReplQueryParamsEditor extends Model({
  paramData: prop(() => objectMap<ReplQueryParamData>()),
}) {
  @observable
  currentParams = new Map<string, ResolvedParameter>();

  @computed
  get mixedParamsError() {
    let hasPositionalParam: boolean | null = null;
    for (const [paramName] of this.currentParams) {
      const isPositional = /^\d+$/.test(paramName);
      if (hasPositionalParam === null) {
        hasPositionalParam = isPositional;
      }
      if (isPositional !== hasPositionalParam) {
        return true;
      }
    }
    return false;
  }

  onAttachedToRootStore() {
    const dbState = dbCtx.get(this)!;
    const repl = findParent<Repl>(this, (parent) => parent instanceof Repl)!;

    const disposer = reaction(
      () => [repl.currentQuery, dbState.schemaData],
      () => this._extractQueryParameters(),
      {delay: 200, fireImmediately: true}
    );

    return () => {
      disposer();
    };
  }

  _extractQueryParameters() {
    const dbState = dbCtx.get(this)!;
    const repl = findParent<Repl>(this, (parent) => parent instanceof Repl)!;

    const query = repl.currentQuery;
    const schemaScalars = dbState.schemaData?.scalars;

    if (schemaScalars) {
      const params = extractQueryParameters(query.toString(), schemaScalars);
      if (params) {
        this.updateCurrentParams(params);
      }
    }
  }

  @modelAction
  updateCurrentParams(params: Map<string, ResolvedParameter>) {
    for (const [key] of params) {
      if (!this.paramData.has(key)) {
        this.paramData.set(key, new ReplQueryParamData({}));
      }
    }
    this.currentParams = params;
  }

  getParamsData(): ParamsData | null {
    this._extractQueryParameters();

    const params = [...this.currentParams.values()];

    if (!params.length) {
      return null;
    }

    return params.reduce((data, param) => {
      const paramData = this.paramData.get(param.name)!;

      data[param.name] = {
        type: param.type,
        value: param.array ? [...paramData.values] : paramData.values[0],
        disabled: paramData.disabled,
        isArray: param.array,
        isOptional: param.optional,
      };

      return data;
    }, {} as ParamsData);
  }

  @modelAction
  restoreParamsData(paramsData?: ParamsData) {
    this.clear();
    if (paramsData) {
      for (const [key, param] of Object.entries(paramsData)) {
        this.paramData.set(
          key,
          new ReplQueryParamData({
            ...param,
            values: Array.isArray(param.value)
              ? (param.value as [string, ...string[]])
              : [param.value],
          })
        );
      }
    }
    this._extractQueryParameters();
  }

  @modelAction
  clear() {
    this.currentParams.clear();
    this.paramData.clear();
  }
}

export function filterParamsData(
  paramsData: ParamsData,
  paramNames: string[]
) {
  return paramNames.reduce((params, name) => {
    const paramName = /^\d+$/.test(name) ? `__p${name}` : name;
    params[paramName] = paramsData[name].disabled
      ? null
      : paramsData[name].value;

    return params;
  }, {} as {[key: string]: string | string[] | null});
}
