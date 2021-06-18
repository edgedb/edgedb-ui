type ListenerDisposer = () => void;

export interface IWindowControls {
  minimise: () => void;
  close: () => void;
  toggleMaximised: () => void;
  isMaximised: () => boolean;
  onMaximisedChange: (
    listener: (maximised: boolean) => void
  ) => ListenerDisposer;
}

export interface SysInfo {
  isDev: boolean;
  platform: typeof process.platform;
}
