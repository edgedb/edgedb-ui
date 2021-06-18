import {action, computed, observable} from "mobx";
import {createContext, Model, model, modelAction, prop} from "mobx-keystone";

import {NewConnectionTab} from "./newConnection";
import {SettingsTab} from "./settings";
import {SystemState} from "./system";

import {Tab} from "./tab";

export enum Theme {
  light = "light",
  dark = "dark",
}

export enum SpecialTab {
  New = 1,
  Settings = 2,
}

export const appCtx = createContext<App>();

@model("App")
export class App extends Model({
  tabs: prop<Tab[]>(() => []),
  selectedTabId: prop<SpecialTab | string>(SpecialTab.New).withSetter(),
  newConnectionTab: prop(() => new NewConnectionTab({})),
  settingsTab: prop(() => new SettingsTab({})),
  system: prop<SystemState>(() => new SystemState({})),
  theme: prop<Theme>(Theme.dark).withSetter(),
}) {
  onInit() {
    appCtx.set(this, this);
  }

  @computed
  get currentTab() {
    if (typeof this.selectedTabId === "string") {
      return this.tabs.find((tab) => tab.$modelId === this.selectedTabId);
    }
  }

  @modelAction
  createTab(tab: Tab) {
    this.tabs.push(tab);
    this.selectedTabId = tab.$modelId;
  }

  @modelAction
  closeTab(tab: Tab) {
    const tabIndex = this.tabs.indexOf(tab);

    if (tabIndex === -1) {
      throw new Error(`Cannot close tab that doesn't exist in tabs list`);
    }

    if (this.selectedTabId === tab.$modelId) {
      this.selectedTabId = SpecialTab.New;
    }

    this.tabs.splice(tabIndex, 1);
  }

  @observable
  globalDragCursor: string | null = null;

  @action
  setGlobalDragCursor(cursor: string | null) {
    this.globalDragCursor = cursor;
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
