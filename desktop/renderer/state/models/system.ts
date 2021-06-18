import {action, computed, observable, runInAction, when} from "mobx";
import {model, Model, modelFlow, prop, _async, _await} from "mobx-keystone";

import {
  InstanceDetails,
  ServerType,
  ServerVersion,
} from "../../../shared/interfaces/serverInstances";
import {ipc} from "../../global";
import {appCtx} from "./app";

@model("Instance")
export class Instance
  extends Model({
    name: prop<string>(),
    port: prop<number>(),
    version: prop<string>(),
    status: prop<"inactive" | "running" | "not running">(),
    method: prop<"package" | "docker">(),
  })
  implements InstanceDetails {
  @observable actionInProgress:
    | null
    | "starting"
    | "stopping"
    | "restarting" = null;
  @observable errorMessage = "";

  @action
  startInstance() {
    if (this.actionInProgress) {
      return when(() => !this.actionInProgress);
    }
    return this._startInstance();
  }

  @modelFlow
  private _startInstance = _async(function* (this: Instance) {
    this.actionInProgress = "starting";
    this.errorMessage = "";

    try {
      yield* _await(ipc.invoke("startInstance", this.name));
      this.status = "running";
    } catch (e) {
      console.error(e);
      this.errorMessage = e.message;
    } finally {
      this.actionInProgress = null;
    }
  });

  @modelFlow
  stopInstance = _async(function* (this: Instance) {
    if (this.actionInProgress) {
      throw new Error(
        "Cannot stop an instance while an instance action is already running"
      );
    }
    this.actionInProgress = "stopping";
    this.errorMessage = "";

    try {
      yield* _await(ipc.invoke("stopInstance", this.name));
      this.status = "not running";
    } catch (e) {
      console.error(e);
      this.errorMessage = e.message;
    } finally {
      this.actionInProgress = null;
    }
  });

  @modelFlow
  restartInstance = _async(function* (this: Instance) {
    if (this.actionInProgress) {
      throw new Error(
        "Cannot restart an instance while an instance action is already running"
      );
    }
    this.actionInProgress = "restarting";
    this.errorMessage = "";

    try {
      yield* _await(ipc.invoke("restartInstance", this.name));
      this.status = "running";
    } catch (e) {
      console.error(e);
      this.errorMessage = e.message;
    } finally {
      this.actionInProgress = null;
    }
  });
}

@model("System")
export class SystemState extends Model({}) {
  @observable
  instances: Instance[] = [];
  @observable
  fetchingInstances = false;

  @observable
  serverVersions: ServerVersion[] = [];
  @observable
  fetchingServerVersions = false;

  @computed
  get installedServerVersions() {
    return this.serverVersions
      .filter((version) => version.installed === true)
      .map((version) => ({
        ...version,
        instanceCount: this.instances.filter(
          (inst) => inst.version === version.version
        ).length,
      }));
  }

  onAttachedToRootStore() {
    this.fetchInstances();
    this.fetchServerVersions();
  }

  @modelFlow
  fetchInstances = _async(function* (this: SystemState) {
    if (this.fetchingInstances) {
      return;
    }
    this.fetchingInstances = true;
    try {
      const instances = yield* _await(ipc.invoke("getInstances"));
      this.instances = instances.map((instanceData) => {
        const existingInstance = this.instances.find(
          (instance) => instance.name === instanceData.name
        );
        if (existingInstance) {
          existingInstance.port = instanceData.port;
          existingInstance.version = instanceData.version;
          existingInstance.status = instanceData.status;
          return existingInstance;
        } else {
          return new Instance(instanceData);
        }
      });
    } finally {
      this.fetchingInstances = false;
    }
  });

  @modelFlow
  fetchServerVersions = _async(function* (this: SystemState) {
    if (this.fetchingServerVersions) {
      return;
    }
    this.fetchingServerVersions = true;
    try {
      const serverVersions = yield* _await(ipc.invoke("getServerVersions"));

      this.serverVersions = serverVersions;
    } finally {
      this.fetchingServerVersions = false;
    }
  });

  async createInstance(
    name: string,
    version: string,
    type: ServerType,
    onUpdate: (data: string) => void
  ) {
    await ipc.invokeWithProgress(
      "initInstance",
      {name, version, type},
      onUpdate
    );
    this.fetchInstances();
  }

  async destroyInstance(instance: Instance, onUpdate: (data: string) => void) {
    await ipc.invokeWithProgress(
      "destroyInstance",
      {name: instance.name},
      onUpdate
    );
    runInAction(
      () =>
        (this.instances = this.instances.filter((inst) => inst !== instance))
    );
    this.fetchInstances();
  }

  async upgradeInstance(
    instance: Instance,
    toVersion: string,
    onUpdate: (data: string) => void
  ) {
    await ipc.invokeWithProgress(
      "upgradeInstance",
      {name: instance.name, toVersion},
      onUpdate
    );
    this.fetchInstances();
  }

  async upgradeAllInstances(
    nightly: boolean,
    onUpdate: (data: string) => void
  ) {
    await ipc.invokeWithProgress("upgradeAllInstances", {nightly}, onUpdate);
    this.fetchInstances();
  }

  async installServer(
    version: string,
    type: ServerType,
    onUpdate: (data: string) => void
  ) {
    await ipc.invokeWithProgress("installServer", {version, type}, onUpdate);
    this.fetchServerVersions();
  }

  async uninstallServer(version: string, onUpdate: (data: string) => void) {
    await ipc.invokeWithProgress("uninstallServer", {version}, onUpdate);
    this.fetchServerVersions();
  }
}
