import {ConnectionCommands} from "../interfaces/connections";
import {
  ServerCommands,
  ServerCommandsWithProgress,
  ServerSubscriptions,
} from "../interfaces/serverInstances";

export type Commands = ConnectionCommands & ServerCommands;

export type CommandsWithProgress = ServerCommandsWithProgress;

export type Subscriptions = ServerSubscriptions;

export type MaybePromise<T> = Promise<T> | T;

export interface RendererIPC {
  invoke<K extends keyof Commands>(
    channel: K,
    ...args: Parameters<Commands[K]>
  ): Promise<ReturnType<Commands[K]>>;
  invokeWithProgress<K extends keyof CommandsWithProgress>(
    channel: K,
    args: CommandsWithProgress[K]["args"],
    onUpdate: (data: CommandsWithProgress[K]["data"]) => void
  ): Promise<CommandsWithProgress[K]["return"]>;
  subscribe<K extends keyof Subscriptions>(
    channel: K,
    args: Subscriptions[K]["args"],
    onUpdate: (data: Subscriptions[K]["data"]) => void
  ): Promise<() => void>;
}

export interface MainIPC {
  handle<K extends keyof Commands>(
    channel: K,
    handler: (
      ...args: Parameters<Commands[K]>
    ) => MaybePromise<ReturnType<Commands[K]>>
  ): void;
  handleWithProgress<K extends keyof CommandsWithProgress>(
    channel: K,
    handler: (
      args: CommandsWithProgress[K]["args"],
      onUpdate: (data: CommandsWithProgress[K]["data"]) => void
    ) => MaybePromise<CommandsWithProgress[K]["return"]>
  ): void;
  registerSubscription<K extends keyof Subscriptions>(
    channel: K,
    handler: (
      args: Subscriptions[K]["args"],
      onUpdate: (data: Subscriptions[K]["data"]) => void
    ) => MaybePromise<() => void>
  ): void;
}
