import {action, computed, observable, runInAction} from "mobx";
import {getSnapshot, Model, model, modelAction, prop} from "mobx-keystone";

import {
  ConnectConfig,
  ManualConnectConfig,
} from "../../../../shared/interfaces/connections";

import {appCtx} from "../app";
import {Tab} from "../tab";
import {ConnectionHistory, ConnectionHistoryItem} from "./connectionHistory";
import {Connection} from "../connection";

export type ConnectConfigField = Exclude<keyof ManualConnectConfig, "type">;

@model("NewConnection/ManualConfigEditor")
export class ManualConnectConfigEditor extends Model({
  hostAndPort: prop<string>(""),
  database: prop<string>(""),
  user: prop<string>(""),
  password: prop<string>(""),
}) {
  @modelAction
  updateConnectionInput(field: ConnectConfigField, value: string) {
    this[field] = value;
  }

  getConfig(): ManualConnectConfig {
    const {hostAndPort, database, user, password} = this;
    return {
      type: "manual",
      hostAndPort,
      database,
      user,
      password,
    };
  }

  @modelAction
  copyFromHistoryItem(item: ConnectionHistoryItem) {
    const config = item.connectConfig.data;
    if (config.type === "manual") {
      this.hostAndPort = config.hostAndPort;
      this.database = config.database;
      this.user = config.user;
      this.password = config.password;
    }
  }

  @modelAction
  clear() {
    this.hostAndPort = "";
    this.database = "";
    this.user = "";
    this.password = "";
  }
}

@model("NewConnection")
export class NewConnectionTab extends Model({
  history: prop(() => new ConnectionHistory({})),
}) {
  manualConfigEditor = new ManualConnectConfigEditor({});

  @observable
  pendingConnections = new Map<string, Connection>();

  @observable
  showManualConn = false;

  @computed
  get latestFailedConnection() {
    if (this.pendingConnections.size === 0) {
      return undefined;
    }
    const instances = new Map(
      appCtx.get(this)!.system.instances.map((inst) => [inst.name, inst])
    );
    return [...this.pendingConnections.entries()]
      .reverse()
      .find(
        ([id, conn]) =>
          id !== "manual" &&
          (!!conn.errorMessage ||
            (conn.config.type === "instance" &&
              instances.get(conn.config.instanceName)?.errorMessage))
      )?.[1];
  }

  @action
  setShowManualConn(show: boolean) {
    this.showManualConn = show;
  }

  @action
  async createConnection(id: string, config?: ConnectConfig) {
    const connection = new Connection({
      config: config ?? this.manualConfigEditor.getConfig(),
    });

    this.pendingConnections.delete(id);
    this.pendingConnections.set(id, connection);

    if (config?.type === "instance") {
      const instance = appCtx
        .get(this)!
        .system.instances.find((inst) => inst.name === config.instanceName);
      if (instance && instance.status !== "running") {
        await instance.startInstance();
        if (instance.errorMessage) {
          return;
        }
      }
    }

    await connection.connect();

    if (connection.isConnected) {
      const app = appCtx.get(this)!;

      app.createTab(new Tab({connection}));

      runInAction(() => {
        this.pendingConnections.delete(id);
        if (!config) {
          this.manualConfigEditor.clear();
          this.setShowManualConn(false);
        }
        this.history.addItem(getSnapshot(connection.config));
      });
    }
  }
}
