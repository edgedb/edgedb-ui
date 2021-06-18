import {ipcRenderer} from "electron";

import {
  Commands,
  CommandsWithProgress,
  RendererIPC,
  Subscriptions,
} from "./interfaces";

let dataUpdateId = 0;

export const {invoke, invokeWithProgress, subscribe}: RendererIPC = {
  async invoke<K extends keyof Commands>(
    channel: K,
    ...args: Parameters<Commands[K]>
  ): Promise<ReturnType<Commands[K]>> {
    const ret = await ipcRenderer.invoke(channel, ...args);
    if (ret.error) {
      throw new Error(ret.error);
    } else {
      return ret.result;
    }
  },
  async invokeWithProgress<K extends keyof CommandsWithProgress>(
    channel: K,
    args: CommandsWithProgress[K]["args"],
    onUpdate: (data: CommandsWithProgress[K]["data"]) => void
  ): Promise<CommandsWithProgress[K]["return"]> {
    const id = `${channel}-${dataUpdateId++}`;
    ipcRenderer.on(`_withProgressUpdate-${id}`, (_, data) => {
      onUpdate(data);
    });
    const ret = await ipcRenderer.invoke(`_withProgress-${channel}`, id, args);
    ipcRenderer.removeAllListeners(`_withProgressUpdate-${id}`);
    if (ret.error) {
      throw new Error(ret.error);
    } else {
      return ret.result;
    }
  },
  async subscribe<K extends keyof Subscriptions>(
    channel: K,
    args: Subscriptions[K]["args"],
    onUpdate: (data: Subscriptions[K]["data"]) => void
  ): Promise<() => void> {
    const id = `${channel}-${dataUpdateId++}`;
    const ret = await ipcRenderer.invoke(`_subscribe-${channel}`, id, args);
    if (ret?.error) {
      throw new Error(ret.error);
    }
    ipcRenderer.on(`_subscriptionUpdate-${id}`, (_, data) => {
      onUpdate(data);
    });

    return () => {
      ipcRenderer.removeAllListeners(`_subscriptionUpdate-${id}`);
      ipcRenderer.send(`_unsubscribe-${id}`);
    };
  },
};
