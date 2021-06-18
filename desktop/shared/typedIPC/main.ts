import {ipcMain} from "electron";

import {
  MaybePromise,
  Commands,
  MainIPC,
  Subscriptions,
  CommandsWithProgress,
} from "./interfaces";

export const {handle, handleWithProgress, registerSubscription}: MainIPC = {
  handle<K extends keyof Commands>(
    channel: K,
    handler: (
      ...args: Parameters<Commands[K]>
    ) => MaybePromise<ReturnType<Commands[K]>>
  ): void {
    ipcMain.handle(channel, async (_, ...args) => {
      try {
        return {
          result: await Promise.resolve(
            handler(...(args as Parameters<Commands[K]>))
          ),
        };
      } catch (e) {
        return {
          error: e.message,
        };
      }
    });
  },
  handleWithProgress<K extends keyof CommandsWithProgress>(
    channel: K,
    handler: (
      args: CommandsWithProgress[K]["args"],
      onUpdate: (data: CommandsWithProgress[K]["data"]) => void
    ) => MaybePromise<CommandsWithProgress[K]["return"]>
  ): void {
    ipcMain.handle(
      `_withProgress-${channel}`,
      async (event, id: string, args) => {
        try {
          return {
            result: await Promise.resolve(
              handler(
                args as CommandsWithProgress[K]["args"],
                (data: CommandsWithProgress[K]["data"]) => {
                  event.sender.send(`_withProgressUpdate-${id}`, data);
                }
              )
            ),
          };
        } catch (e) {
          return {
            error: e.message,
          };
        }
      }
    );
  },
  registerSubscription<K extends keyof Subscriptions>(
    channel: K,
    handler: (
      args: Subscriptions[K]["args"],
      onUpdate: (data: Subscriptions[K]["data"]) => void
    ) => MaybePromise<() => void>
  ): void {
    ipcMain.handle(
      `_subscribe-${channel}`,
      async (event, id: string, args) => {
        try {
          const disposer = await Promise.resolve(
            handler(
              args as Subscriptions[K]["args"],
              (data: Subscriptions[K]["data"]) => {
                event.sender.send(`_subscriptionUpdate-${id}`, data);
              }
            )
          );
          ipcMain.once(`_unsubscribe-${id}`, () => disposer());
        } catch (e) {
          return {
            error: e.message,
          };
        }
      }
    );
  },
};
