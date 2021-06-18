import {action, observable, runInAction} from "mobx";
import {getParent, model, Model, prop} from "mobx-keystone";

import {ipc} from "../../../global";

export enum SettingsViewType {
  general = "general",
  servers = "servers",
  codeEditor = "codeEditor",
}

@model("Settings")
export class SettingsTab extends Model({
  view: prop<SettingsViewType>(SettingsViewType.general).withSetter(),
  showingLogs: prop<InstanceLogs | null>(null).withSetter(),
}) {
  showLogs(instanceName: string | null) {
    if (instanceName !== this.showingLogs?.instanceName) {
      this.setShowingLogs(
        instanceName ? new InstanceLogs({instanceName}) : null
      );
    }
  }
}

@model("InstanceLogs")
export class InstanceLogs extends Model({
  instanceName: prop<string>(),
}) {
  @observable
  logData = "";

  @action
  updateLogData(data: string) {
    this.logData += data;
  }

  subscriptionDisposer: (() => void) | null = null;

  onAttachedToRootStore() {
    ipc
      .subscribe("logs", {instanceName: this.instanceName}, (data) => {
        this.updateLogData(data);
      })
      .then((disposer) => {
        if (getParent(this)) {
          runInAction(() => (this.subscriptionDisposer = disposer));
        } else {
          disposer();
        }
      });

    return () => {
      this.subscriptionDisposer?.();
    };
  }
}
