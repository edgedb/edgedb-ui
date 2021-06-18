import {computed} from "mobx";
import {Model, model, prop, frozen, Frozen, modelAction} from "mobx-keystone";

import {ConnectConfig} from "../../../../shared/interfaces/connections";

@model("ConnectionHistoryItem")
export class ConnectionHistoryItem extends Model({
  connectConfig: prop<Frozen<ConnectConfig>>(),
}) {
  @computed
  get hash() {
    const config = this.connectConfig.data;
    return (
      config.type +
      "::" +
      (config.type === "instance"
        ? `${config.instanceName}/${config.database ?? ""}`
        : `${config.user}@${config.hostAndPort}/${config.database}`)
    );
  }
}

@model("ConnectionHistory")
export class ConnectionHistory extends Model({
  items: prop<ConnectionHistoryItem[]>(() => []),
}) {
  @modelAction
  addItem(config: ConnectConfig) {
    const newItem = new ConnectionHistoryItem({connectConfig: frozen(config)});

    const existingItemIndex = this.items.findIndex(
      (item) => item.hash === newItem.hash
    );

    if (existingItemIndex !== -1) {
      const existingItem = this.items.splice(existingItemIndex, 1)[0];
      this.items.push(existingItem);
    } else {
      this.items.push(newItem);
    }
  }

  @modelAction
  deleteItem(item: ConnectionHistoryItem) {
    const itemIndex = this.items.findIndex(
      (historyItem) => historyItem === item
    );
    if (itemIndex !== -1) {
      this.items.splice(itemIndex, 1);
    }
  }

  @modelAction
  clearAll() {
    this.items = [];
  }
}
