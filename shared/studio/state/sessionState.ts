import {
  SchemaArrayType,
  SchemaGlobal,
  SchemaRangeType,
  SchemaScalarType,
  SchemaTupleType,
  SchemaType,
} from "@edgedb/common/schemaData";
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
import {
  EditorValue,
  newPrimitiveValue,
  parseEditorValue,
  PrimitiveType,
  valueToEditorValue,
} from "../components/dataEditor/utils";
import {fetchSessionState, storeSessionState} from "../idbStore";
import {connCtx} from "./connection";
import {dbCtx} from "./database";
import {instanceCtx} from "./instance";

type DraftStateItem = {
  active: boolean;
  type: Frozen<SchemaType>;
  description?: string;
  value: Frozen<EditorValue | null>;
  error: boolean;
};

type DraftState = {
  globals: {
    [key: string]: DraftStateItem;
  };
  config: {
    [key: string]: DraftStateItem;
  };
  options: {
    [key: string]: DraftStateItem;
  };
};

export type StoredSessionStateData = {
  globals: {
    [key: string]: {
      typeId: string;
      active: boolean;
      value: EditorValue | null;
    };
  };
  config: {
    [key: string]: {
      active: boolean;
      value: EditorValue;
    };
  };
  options: {
    [key: string]: {
      active: boolean;
      value: EditorValue;
    };
  };
};

export const queryOptions = [
  {
    name: "Implicit Limit",
    typename: "std::int64",
    default: "100",
    active: true,
    validator: (val: BigInt) =>
      Number(val) <= 0 ? "Implicit limit must be greater than 0" : null,
  },
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

  configNames: string[] = [];
  configNamesIndex: Fuzzysort.Prepared[] = [];

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

    const configType = schemaData.objectsByName.get("cfg::AbstractConfig")!;
    this.configNames = Object.values(configType.properties)
      .filter(
        (prop) =>
          prop.name !== "id" &&
          !prop.annotations.some(
            (anno) =>
              (anno.name === "cfg::system" || anno.name === "cfg::internal") &&
              anno["@value"] === "true"
          )
      )
      .map((prop) => prop.name)
      .sort((a, b) => a.localeCompare(b));
    this.configNamesIndex = this.configNames.map((name) =>
      fuzzysort.prepare(name)
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
          value: frozen(global.value),
          error:
            global.value == null
              ? schemaGlobal.default == null
              : !isValidValue(schemaGlobal.target, global.value),
        };
      }
    }

    for (const configName of this.configNames) {
      const type = configType.properties[configName].target!;
      const storedItem = sessionStateData?.config[configName];
      const newVal =
        storedItem?.value == null
          ? newPrimitiveValue(type as PrimitiveType)
          : null;
      draftState.config[configName] = {
        type: frozen(type, FrozenCheckMode.Off),
        description: configType.properties[configName].annotations.find(
          (anno) => anno.name === "std::description"
        )?.["@value"],
        active: storedItem?.active ?? false,
        value: frozen(storedItem?.value ?? newVal![0]),
        error: storedItem ? !isValidValue(type, storedItem.value) : newVal![1],
      };
    }
    for (const option of queryOptions) {
      const type = [...schemaData.types.values()].find(
        (type) => type.name === option.typename
      )!;
      const storedItem = sessionStateData?.options[option.name];
      draftState.options[option.name] = {
        type: frozen(type, FrozenCheckMode.Off),
        active: storedItem?.active ?? option.active,
        value: frozen(storedItem?.value ?? option.default),
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
      const value =
        type.default != null
          ? null
          : newPrimitiveValue(type.target as PrimitiveType);
      this.draftState!.globals[type.name] = {
        active: true,
        type: frozen(type.target, FrozenCheckMode.Off),
        value: frozen(value === null ? null : value[0]),
        error: value === null ? false : value[1],
      };
    } else {
      global.active = !global.active;
    }
  }

  @modelAction
  updateItemValue(
    item: {value: Frozen<any>; error: boolean},
    val: any,
    err: boolean
  ) {
    item.value = frozen(val);
    item.error = err;
  }

  @modelAction
  toggleConfigActive(name: string) {
    const config = this.draftState!.config[name];
    config.active = !config.active;
  }

  @modelAction
  toggleOptionActive(name: string) {
    const opt = this.draftState!.options[name];
    opt.active = !opt.active;
  }

  @computed
  get hasValidChanges() {
    return this.draftState
      ? Object.entries(this.draftState.globals).some(([name, global]) => {
          const snap = this.draftSnapshot!.globals[name];
          return (
            (snap && global.active !== snap.active) ||
            (global.active &&
              !global.error &&
              (!snap || snap.value !== global.value))
          );
        }) ||
          Object.entries(this.draftState.config).some(([name, config]) => {
            const snap = this.draftSnapshot!.config[name];
            return (
              config.active !== snap.active ||
              (config.active && !config.error && snap.value !== config.value)
            );
          }) ||
          Object.entries(this.draftState.options).some(([name, option]) => {
            const snap = this.draftSnapshot!.options[name];
            return (
              option.active !== snap.active ||
              (option.active && !option.error && snap.value !== option.value)
            );
          })
      : false;
  }

  @observable.ref
  configValues: {[key: string]: any} | null = null;

  async fetchConfigValues() {
    const conn = connCtx.get(this)!;

    const result = await conn.query(
      `select cfg::Config {${this.configNames.join(", ")}}`,
      undefined,
      {ignoreSessionConfig: true}
    );

    if (result.result) {
      const values = result.result![0];
      runInAction(() => (this.configValues = values));
      for (const configName of this.configNames) {
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
    globals: {name: string; type: Frozen<SchemaType>; value: any}[];
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
          type: global.type as Frozen<SchemaType>,
          value:
            global.value.data != null
              ? parseEditorValue(
                  global.value.data,
                  global.type.data as PrimitiveType
                )
              : null,
        })),
      config: Object.entries(this.draftState!.config)
        .filter(([_, config]) => config.active && !config.error)
        .map(([name, config]) => ({
          name,
          type: config.type as Frozen<SchemaType>,
          value: parseEditorValue(
            config.value.data!,
            config.type.data as PrimitiveType
          ),
        })),
      options: queryOptions
        .filter(
          (opt) =>
            this.draftState!.options[opt.name].active &&
            !this.draftState!.options[opt.name].error
        )
        .map(({name}) => {
          const opt = this.draftState!.options[name];
          return {
            name,
            type: opt.type as Frozen<SchemaType>,
            value: parseEditorValue(
              opt.value.data!,
              opt.type.data as PrimitiveType
            ),
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
              value: global.value.data,
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
                value: config.value.data!,
              };
            }
            return data;
          },
          {} as StoredSessionStateData["config"]
        ),
        options: Object.entries(this.draftState!.options).reduce(
          (data, [name, opt]) => {
            data[name] = {
              active: opt.active,
              value: opt.value.data!,
            };
            return data;
          },
          {} as StoredSessionStateData["options"]
        ),
      },
    });
  }
}

function isValidValue(type: SchemaType, value: EditorValue): boolean {
  try {
    parseEditorValue(value, type as PrimitiveType);
    return true;
  } catch (e) {
    return false;
  }
}
