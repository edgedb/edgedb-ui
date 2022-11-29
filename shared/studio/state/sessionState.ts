import {SchemaGlobal, SchemaType} from "@edgedb/common/schemaData";
import fuzzysort from "fuzzysort";
import {action, computed, observable, runInAction, when} from "mobx";
import {
  clone,
  draft,
  Draft,
  getSnapshot,
  model,
  Model,
  modelAction,
  prop,
  createContext as createMobxContext,
  objectActions,
  Frozen,
  frozen,
  FrozenCheckMode,
} from "mobx-keystone";
import {parsers} from "../components/dataEditor";
import {fetchSessionState, storeSessionState} from "../idbStore";
import {connCtx} from "./connection";
import {dbCtx} from "./database";
import {instanceCtx} from "./instance";

type DraftState = {
  globals: {
    [key: string]: {
      active: boolean;
      type: Frozen<SchemaType>;
      value: any;
      error: boolean;
    };
  };
  config: {
    [key in typeof configNames[number]]: {
      active: boolean;
      type: Frozen<SchemaType>;
      value: any;
      error: boolean;
    };
  };
  options: {
    [key: string]: {
      type: Frozen<SchemaType>;
      value: any;
      error: boolean;
    };
  };
};

export type StoredSessionStateData = {
  globals: {
    [key: string]: {
      typeId: string;
      active: boolean;
      value: any;
    };
  };
  config: {
    [key: string]: {
      active: boolean;
      value: any;
    };
  };
  options: {
    [key: string]: {
      value: any;
    };
  };
};

export const configNames = [
  "apply_access_policies",
  "query_execution_timeout",
  "allow_bare_ddl",
  "allow_user_specified_id",
];
export const configNamesIndex = configNames.map((name) =>
  fuzzysort.prepare(name)
);

export const queryOptions = [
  {name: "Implicit Limit", typename: "std::int64", default: "100"},
].map((item) => ({
  ...item,
  indexed: fuzzysort.prepare(item.name),
}));

export const sessionStateCtx = createMobxContext<SessionState>();

@model("SessionState")
export class SessionState extends Model({
  draftState: prop<DraftState | null>(null).withSetter(),

  barOpen: prop(false),
  panelOpen: prop(false),
}) {
  @computed
  get indexedSchemaGlobals() {
    return [...(dbCtx.get(this)!.schemaData?.globals.values() ?? [])]
      .filter((global) => !global.expr)
      .map((global) => ({global, indexed: fuzzysort.prepare(global.name)}));
  }

  @modelAction
  setBarOpen(open: boolean, persist = true) {
    this.barOpen = open;
    if (persist) {
      try {
        const dbState = dbCtx.get(this)!;
        const barOpenState = new Set(
          JSON.parse(localStorage.getItem("edgedbStudioSessionBar") ?? "[]")
        );
        if (open) {
          barOpenState.add(dbState.name);
        } else {
          barOpenState.delete(dbState.name);
        }
        localStorage.setItem(
          "edgedbStudioSessionBar",
          JSON.stringify([...barOpenState.values()])
        );
      } catch (e) {
        // ignore errors
      }
    }
  }

  @observable.ref
  highlight: {kind: "g" | "c" | "o"; name: string} | null = null;

  @action
  clearHighlight() {
    this.highlight = null;
  }

  @modelAction
  openPanel(highlight: typeof this["highlight"] = null) {
    this.fetchConfigValues();
    this.panelOpen = true;
    this.highlight = highlight;
  }

  @modelAction
  closePanel() {
    if (this.hasValidChanges) {
      this.updateActiveState();
    }
    this.storeSessionData();
    this.panelOpen = false;
  }

  onAttachedToRootStore() {
    const dbState = dbCtx.get(this)!;
    try {
      const barOpenState = new Set(
        JSON.parse(localStorage.getItem("edgedbStudioSessionBar") ?? "[]")
      );
      this.setBarOpen(barOpenState.has(dbState.name), false);
    } catch (e) {
      // ignore errors
    }

    this.loadStoredSessionState();
  }

  async loadStoredSessionState() {
    const instanceState = instanceCtx.get(this)!;
    const dbState = dbCtx.get(this)!;

    const [sessionStateData] = await Promise.all([
      fetchSessionState(instanceState.instanceName!, dbState.name),
      when(() => dbState.schemaData !== null),
    ]);

    const schemaData = dbState.schemaData!;
    const schemaGlobals = new Map(
      [...schemaData.globals.values()].map((global) => [global.name, global])
    );
    const draftState: DraftState = {globals: {}, config: {}, options: {}};
    for (const [key, global] of Object.entries(
      sessionStateData?.globals ?? {}
    )) {
      const schemaGlobal = schemaGlobals.get(key);
      if (
        schemaGlobal &&
        !schemaGlobal.expr &&
        schemaGlobal.target.id === global.typeId
      ) {
        draftState.globals[key] = {
          type: frozen(schemaGlobal.target, FrozenCheckMode.Off),
          active: global.active,
          value: global.value,
          error: !isValidValue(schemaGlobal.target, global.value),
        };
      }
    }
    const configType = schemaData.objectsByName.get("cfg::Config")!;
    for (const configName of configNames) {
      const type = configType.properties[configName].target!;
      const storedItem = sessionStateData?.config[configName];
      draftState.config[configName] = {
        type: frozen(type, FrozenCheckMode.Off),
        active: storedItem?.active ?? false,
        value: storedItem?.value ?? null,
        error: storedItem ? !isValidValue(type, storedItem.value) : true,
      };
    }
    for (const option of queryOptions) {
      const type = [...schemaData.types.values()].find(
        (type) => type.name === option.typename
      )!;
      const storedItem = sessionStateData?.options[option.name];
      draftState.options[option.name] = {
        type: frozen(type, FrozenCheckMode.Off),
        value: storedItem?.value ?? option.default,
        error: storedItem ? !isValidValue(type, storedItem.value) : false,
      };
    }

    this.setDraftState(draftState);
    this.draftSnapshot = clone(this.draftState!);
    this.updateActiveState();
  }

  @observable.ref
  draftSnapshot: DraftState | null = null;

  @modelAction
  toggleGlobalActive(type: SchemaGlobal) {
    const global = this.draftState!.globals[type.name];
    if (!global) {
      this.draftState!.globals[type.name] = {
        active: true,
        type: frozen(type.target, FrozenCheckMode.Off),
        value: null,
        error: type.target.name === "std::str",
      };
    } else {
      global.active = !global.active;
    }
  }

  @modelAction
  updateItemValue(item: {value: any; error: boolean}, val: any, err: boolean) {
    item.value = val;
    item.error = err;
  }

  @modelAction
  toggleConfigActive(name: string) {
    const config = this.draftState!.config[name];
    config.active = !config.active;
  }

  @computed
  get hasValidChanges() {
    return this.draftState
      ? Object.entries(this.draftState.globals).some(([name, global]) => {
          const snap = this.draftSnapshot!.globals[name];
          return (
            !global.error &&
            (!snap
              ? global.active
              : snap.active !== global.active ||
                (global.active && snap.value !== global.value))
          );
        }) ||
          Object.entries(this.draftState.config).some(([name, config]) => {
            const snap = this.draftSnapshot!.config[name];
            return (
              !config.error &&
              (snap.active !== config.active ||
                (config.active && snap.value !== config.value))
            );
          }) ||
          Object.entries(this.draftState.options).some(([name, option]) => {
            const snap = this.draftSnapshot!.options[name];
            return !option.error && snap.value !== option.value;
          })
      : false;
  }

  @observable.ref
  configValues: {[key: string]: any} | null = null;

  async fetchConfigValues() {
    const conn = connCtx.get(this)!;

    const result = await conn.query(
      `select cfg::Config {${configNames.join(", ")}}`,
      undefined,
      {ignoreSessionConfig: true}
    );

    if (result.result) {
      const values = result.result![0];
      runInAction(() => (this.configValues = values));
      for (const configName of configNames) {
        if (this.draftState?.config[configName].value === null) {
          objectActions.set(
            this.draftState.config[configName],
            "value",
            values[configName].toString()
          );
        }
      }
    }
  }

  @observable.shallow
  activeState: {
    globals: {
      name: string;
      type: Frozen<SchemaType>;
      value: any;
    }[];
    config: {name: string; type: Frozen<SchemaType>; value: any}[];
    options: {name: string; type: Frozen<SchemaType>; value: any}[];
  } = {globals: [], config: [], options: []};

  @action
  updateActiveState() {
    this.activeState = {
      globals: Object.entries(this.draftState!.globals)
        .filter(([_, global]) => global.active && !global.error)
        .map(([name, global]) => ({
          name,
          type: global.type,
          value: parseValue(global.type.data, global.value),
        })),
      config: Object.entries(this.draftState!.config)
        .filter(([_, config]) => config.active && !config.error)
        .map(([name, config]) => ({
          name,
          type: config.type,
          value: parseValue(config.type.data, config.value),
        })),
      options: queryOptions
        .filter(
          (opt) =>
            this.draftState!.options[opt.name].value !== opt.default &&
            !this.draftState!.options[opt.name].error
        )
        .map(({name}) => {
          const opt = this.draftState!.options[name];
          return {
            name,
            type: opt.type,
            value: parseValue(opt.type.data, opt.value),
          };
        }),
    };
    this.draftSnapshot = clone(this.draftState!);
  }

  storeSessionData() {
    const instanceState = instanceCtx.get(this)!;
    const dbState = dbCtx.get(this)!;

    storeSessionState({
      instanceId: instanceState.instanceName!,
      dbName: dbState.name,
      data: {
        globals: Object.entries(this.draftState!.globals).reduce(
          (data, [name, global]) => {
            data[name] = {
              typeId: global.type.data.id,
              active: global.active,
              value: global.value,
            };
            return data;
          },
          {} as StoredSessionStateData["globals"]
        ),
        config: Object.entries(this.draftState!.config).reduce(
          (data, [name, config]) => {
            if (config.value != null) {
              data[name] = {
                active: config.active,
                value: config.value,
              };
            }
            return data;
          },
          {} as StoredSessionStateData["config"]
        ),
        options: Object.entries(this.draftState!.options).reduce(
          (data, [name, opt]) => {
            data[name] = {
              value: opt.value,
            };
            return data;
          },
          {} as StoredSessionStateData["options"]
        ),
      },
    });
  }

  @action
  updateGlobal(name: string) {
    const global = this.draftState!.globals[name];
    this.activeState.globals = this.activeState.globals.filter(
      (g) => g.name !== name
    );
    if (global.active) {
      this.activeState.globals.push({
        name,
        type: global.type,
        value: parseValue(global.type.data, global.value),
      });
    }
    this.draftSnapshot = clone(this.draftState!);
  }

  @action
  updateConfig(name: string) {
    const config = this.draftState!.config[name];
    this.activeState.config = this.activeState.config.filter(
      (c) => c.name !== name
    );
    if (config.active) {
      this.activeState.config.push({
        name,
        type: config.type,
        value: parseValue(config.type.data, config.value),
      });
    }
    this.draftSnapshot = clone(this.draftState!);
  }

  @action
  updateOption(option: typeof queryOptions[number]) {
    const opt = this.draftState!.options[option.name];
    this.activeState.options = this.activeState.options.filter(
      (o) => o.name !== option.name
    );
    if (opt.value !== option.default) {
      this.activeState.options.push({
        name: option.name,
        type: opt.type,
        value: parseValue(opt.type.data, opt.value),
      });
    }
    this.draftSnapshot = clone(this.draftState!);
  }
}

function parseValue(type: SchemaType, value: any): any {
  switch (type.schemaType) {
    case "Scalar":
      const parser = parsers[type.name];
      return parser ? parser(value) : value;
      break;

    default:
      break;
  }
}

function isValidValue(type: SchemaType, value: any): boolean {
  try {
    parseValue(type, value);
    return true;
  } catch (e) {
    return false;
  }
}
