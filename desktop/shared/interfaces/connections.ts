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

export interface QueryReturn {
  outCodecBuf: Buffer;
  resultBuf: Buffer;
  duration: QueryDuration;
}

export interface PrepareReturn {
  inCodecBuf: Buffer;
  outCodecBuf: Buffer;
  duration: number;
}

export interface ExecuteReturn {
  resultBuf: Buffer;
  duration: number;
}

export type ConnectionCommands = {
  createConnection: (id: string, config: ConnectConfig) => void;
  closeConnection: (id: string) => void;
  query: (connId: string, query: string) => QueryReturn;
  prepare: (connId: string, query: string) => PrepareReturn;
  execute: (connId: string, encodedParamsBuf: Buffer) => ExecuteReturn;
};
