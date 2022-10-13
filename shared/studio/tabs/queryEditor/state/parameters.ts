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

import {EditorKind, queryEditorCtx} from ".";
import {dbCtx} from "../../../state/database";
import {parsers} from "../../../components/dataEditor";

export type {ResolvedParameter};

@model("Repl/QueryParam")
class ReplQueryParamData extends Model({
  values: prop<string[]>(() => [""]),
  hasError: prop<boolean>(false).withSetter(),
  disabled: prop(false).withSetter(),
}) {
  @modelAction
  setSingleValue(value: string, err: boolean) {
    this.values[0] = value;
    this.hasError = err;
  }

  @modelAction
  setArrayValues(values: string[], err: boolean) {
    this.values = values;
    this.hasError = err;
  }
}

export type ParamsData = {
  [key: string]: {
    type: string | null;
    resolvedBaseTypeName: string | null;
    value: string | string[];
    disabled: boolean;
    isArray: boolean;
    isOptional: boolean;
  };
};

@model("Repl/QueryParamsEditor")
export class QueryParamsEditor extends Model({
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

  @computed
  get hasErrors() {
    return [...this.currentParams.values()].some((param) => {
      const paramData = this.paramData.get(param.name);
      return (
        (param.error || paramData?.hasError) &&
        (!paramData || !paramData.disabled)
      );
    });
  }

  onAttachedToRootStore() {
    const dbState = dbCtx.get(this)!;
    const editor = queryEditorCtx.get(this)!;

    const disposer = reaction(
      () => [editor.currentQueryData[EditorKind.EdgeQL], dbState.schemaData],
      () => this._extractQueryParameters(),
      {delay: 200, fireImmediately: true}
    );

    return () => {
      disposer();
    };
  }

  _extractQueryParameters() {
    const dbState = dbCtx.get(this)!;
    const editor = queryEditorCtx.get(this)!;

    const query = editor.currentQueryData[EditorKind.EdgeQL];
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
    for (const [key, param] of params) {
      if (!this.paramData.has(key)) {
        this.paramData.set(key, new ReplQueryParamData({}));
      } else {
        const currentParam = this.currentParams.get(key);
        if (
          currentParam &&
          (currentParam.resolvedBaseType !== param.resolvedBaseType ||
            currentParam.array !== param.array)
        ) {
          this.paramData.get(key)?.setHasError(false);
        }
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
        resolvedBaseTypeName: param.resolvedBaseType?.name ?? null,
        value: param.array ? [...paramData.values] : paramData.values[0],
        disabled: paramData.disabled,
        isArray: param.array,
        isOptional: param.optional,
      };

      return data;
    }, {} as ParamsData);
  }

  @modelAction
  restoreParamsData(paramsData?: ParamsData | null) {
    this.clear();
    if (paramsData) {
      for (const [key, param] of Object.entries(paramsData)) {
        this.paramData.set(
          key,
          new ReplQueryParamData({
            ...param,
            values: Array.isArray(param.value) ? param.value : [param.value],
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

export function serialiseParamsData(paramsData: ParamsData) {
  const entries = Object.entries(paramsData);
  const isPositional = entries.every(([name]) => /^\d+$/.test(name));
  return entries.reduce(
    (params, [name, param]) => {
      const parser = parsers[param.resolvedBaseTypeName!];
      params[name] = param.disabled
        ? null
        : parser
        ? Array.isArray(param.value)
          ? param.value.map(parser)
          : parser(param.value)
        : param.value;

      return params;
    },
    isPositional ? [] : ({} as {[key: string]: any})
  );
}
