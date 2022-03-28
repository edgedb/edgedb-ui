export interface ManualConnectConfig {
  type: "manual";
  hostAndPort: string;
  database: string;
  user: string;
  password: string;
}

export interface InstanceConnectConfig {
  type: "instance";
  instanceName: string;
  database?: string;
}

export type ConnectConfig = ManualConnectConfig | InstanceConnectConfig;

export interface QueryDuration {
  prepare: number;
  execute: number;
}
