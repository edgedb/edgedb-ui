import {action, computed, observable, when} from "mobx";
import {
  createContext,
  Model,
  model,
  modelAction,
  objectMap,
  prop,
} from "mobx-keystone";

import {Connection} from "./connection";
import {InstancePageState} from "./instance";
import {DatabasePageState} from "./database";

export enum Theme {
  light = "light",
  dark = "dark",
}

export enum PageType {
  Instance,
}

export const appCtx = createContext<App>();

@model("App")
export class App extends Model({
  theme: prop<Theme>(Theme.light).withSetter(),

  currentPageId: prop<PageType | string>(PageType.Instance).withSetter(),
  // pages
  instanceState: prop(() => new InstancePageState({})),
  databasePageStates: prop(() => objectMap<DatabasePageState>()),
}) {
  onInit() {
    appCtx.set(this, this);

    when(
      () =>
        this.defaultConnection === null &&
        this.instanceState.databases.length > 0,
      () => {
        this.defaultConnection = new Connection({
          config: {database: this.instanceState.databases[0].name},
        });
      }
    );
  }

  defaultConnection: Connection | null = null;

  @computed
  get currentPage() {
    if (typeof this.currentPageId === "string") {
      return this.databasePageStates.get(this.currentPageId);
    }
  }

  @modelAction
  openDatabasePage(databaseName: string) {
    const key = `${this.instanceState.instanceName}/${databaseName}`;
    if (!this.databasePageStates.has(key)) {
      this.databasePageStates.set(
        key,
        new DatabasePageState({name: databaseName})
      );
    }
    this.currentPageId = key;
  }

  @observable.ref
  modalOverlay: JSX.Element | null = null;

  @action
  openModalOverlay(modal: JSX.Element | null) {
    if (!this.modalOverlay) {
      this.modalOverlay = modal;
    }
  }

  @action.bound
  closeModalOverlay() {
    this.modalOverlay = null;
  }
}
