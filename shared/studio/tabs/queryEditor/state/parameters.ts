import {Model, model, modelAction, Frozen, frozen} from "mobx-keystone";
import {reaction, observable, computed, action} from "mobx";

import {
  extractQueryParameters,
  ResolvedParameter,
} from "./extractQueryParameters";

import {EditorKind, queryEditorCtx} from ".";
import {dbCtx} from "../../../state/database";
import {
  EditorValue,
  newPrimitiveValue,
  parseEditorValue,
} from "../../../components/dataEditor/utils";

export type {ResolvedParameter};

export type SerializedParamsData = {
  [key: string]: {
    typeName: string;
    value: EditorValue;
    disabled: boolean;
  };
};

@model("Repl/QueryParamsEditor")
export class QueryParamsEditor extends Model({}) {
  @observable
  panelHeight = 160;

  @action
  setPanelHeight(height: number) {
    this.panelHeight = height;
  }

  @observable.shallow
  paramDefs = new Map<string, ResolvedParameter>();

  @observable
  paramData = new Map<
    string,
    {
      disabled: boolean;
      data: Map<string, {value: Frozen<EditorValue>; hasError: boolean}>;
    }
  >();

  @computed
  get mixedParamsError() {
    let hasPositionalParam: boolean | null = null;
    for (const [paramName] of this.paramDefs) {
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
  get currentParams() {
    return [...this.paramDefs.values()].reduce((data, param) => {
      if (param.error === null) {
        const paramData = this.paramData.get(param.name)!;
        const type =
          param.type.schemaType === "Scalar" ? "__scalar__" : param.type.name;

        data[param.name] = {
          data: paramData.data.get(type)!,
          disabled: paramData.disabled,
        };
      }
      return data;
    }, {} as {[key: string]: {data: {value: Frozen<EditorValue>; hasError: boolean}; disabled: boolean}});
  }

  @computed
  get hasErrors() {
    return [...this.paramDefs.values()].some((param) => {
      if (param.error !== null) {
        return true;
      }
      const data = this.currentParams[param.name];

      return !data.disabled && (!data.data || data.data.hasError);
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

  @action
  updateCurrentParams(params: Map<string, ResolvedParameter>) {
    for (const [key, param] of params) {
      if (!this.paramData.has(key)) {
        this.paramData.set(key, {data: new Map(), disabled: false});
      }
      if (param.error === null) {
        const type =
          param.type.schemaType === "Scalar" ? "__scalar__" : param.type.name;
        const data = this.paramData.get(key)!.data;
        if (!data.has(type)) {
          data.set(type, {
            value: frozen(newPrimitiveValue(param.type)),
            hasError: false,
          });
        }
      }
    }
    this.paramDefs = params;
  }

  @action
  setDisabled(name: string, disabled: boolean) {
    this.paramData.get(name)!.disabled = disabled;
  }

  @action
  setParamValue(name: string, value: EditorValue, hasError: boolean) {
    const paramDef = this.paramDefs.get(name)!;
    if (paramDef.error == null) {
      const type =
        paramDef.type.schemaType === "Scalar"
          ? "__scalar__"
          : paramDef.type.name;
      const paramData = this.paramData.get(name)!.data.get(type)!;
      paramData.value = frozen(value);
      paramData.hasError = hasError;
    }
  }

  //

  getQueryArgs() {
    const entries = [...this.paramDefs.entries()];
    const isPositional = entries.every(([name]) => /^\d+$/.test(name));
    return entries.length
      ? entries.reduce(
          (args, [name, paramDef]) => {
            if (paramDef.error === null) {
              const param = this.currentParams[name]!;
              args[name] = param.disabled
                ? null
                : parseEditorValue(param.data.value.data, paramDef.type);
            }
            return args;
          },
          isPositional ? [] : ({} as {[key: string]: any})
        )
      : undefined;
  }

  serializeParamsData(): Frozen<SerializedParamsData> | null {
    this._extractQueryParameters();

    const paramDefs = this.paramDefs;

    if (!paramDefs.size) {
      return null;
    }

    const data: SerializedParamsData = {};

    for (const [name, param] of paramDefs.entries()) {
      if (param.error === null) {
        const paramData = this.currentParams[name];

        data[name] = {
          typeName: param.type.name,
          disabled: paramData.disabled,
          value: paramData.data.value.data,
        };
      }
    }

    return frozen(data);
  }

  @action
  restoreParamsData(paramsData?: Frozen<SerializedParamsData> | null) {
    this.clear();
    this._extractQueryParameters();

    if (paramsData) {
      for (const [name, paramDef] of this.paramDefs.entries()) {
        if (paramDef.error === null) {
          const data = paramsData.data[name];

          if (data && data.typeName === paramDef.type.name) {
            const paramData = this.paramData.get(name)!;
            const type =
              paramDef.type.schemaType === "Scalar"
                ? "__scalar__"
                : paramDef.type.name;

            paramData.disabled = data.disabled;
            let error = false;
            try {
              parseEditorValue(data.value, paramDef.type);
              error = true;
            } catch {}
            paramData.data.set(type, {
              value: frozen(data.value),
              hasError: error,
            });
          }
        }
      }
    }
  }

  @modelAction
  clear() {
    this.paramDefs.clear();
    this.paramData.clear();
  }
}
