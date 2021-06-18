export interface InstanceDetails {
  name: string;
  port: number;
  version: string;
  status: "inactive" | "running" | "not running";
  method: ServerType;
}

export type ServerType = "package" | "docker";

export interface ServerVersion {
  version: string;
  fullVersion: string;
  type: ServerType;
  installed: boolean;
}

export type ServerCommands = {
  getInstances: () => InstanceDetails[];
  getServerVersions: () => ServerVersion[];

  startInstance: (name: string) => void;
  stopInstance: (name: string) => void;
  restartInstance: (name: string) => void;
};

export type ServerCommandsWithProgress = {
  installServer: {
    args: {version: string; type: ServerType};
    data: string;
    return: void;
  };
  uninstallServer: {
    args: {version: string};
    data: string;
    return: void;
  };

  initInstance: {
    args: {name: string; version: string; type: ServerType};
    data: string;
    return: void;
  };
  destroyInstance: {
    args: {name: string};
    data: string;
    return: void;
  };

  upgradeInstance: {
    args: {name: string; toVersion: string};
    data: string;
    return: void;
  };
  upgradeAllInstances: {
    args: {nightly: boolean};
    data: string;
    return: void;
  };
};

export type ServerSubscriptions = {
  logs: {
    args: {instanceName: string};
    data: string;
  };
};
