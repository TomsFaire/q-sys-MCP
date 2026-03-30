/**
 * Shared types for Q-Sys MCP Server
 */

export type CoreAlias = string;

export interface CoreConfig {
  alias: CoreAlias;
  host: string;
  qrcPort?: number; // default 1710
  ecpPort?: number; // default 1702
  wsPort?: number;  // if set, use WebSocket QRC (QRWC) on this port instead of plain TCP
}

/**
 * Shared interface implemented by both QrcClient (TCP) and WsQrcClient (WebSocket).
 * All tool code depends only on this interface.
 */
export interface IQrcClient {
  readonly isConnected: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  call(method: string, params?: Record<string, unknown>): Promise<unknown>;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface CoreStatus {
  name: string;
  designName: string;
  isRunning: boolean;
  platform?: string;
  uptime?: number;
}

export enum ConnectionState {
  Disconnected = "disconnected",
  Connecting = "connecting",
  Connected = "connected",
  Error = "error",
}

/**
 * ECP Protocol result types
 */
export interface EcpControlResult {
  value: number;
  string: string;
  position: number;
}

export interface EcpCommandError {
  code: string;
  message: string;
}
