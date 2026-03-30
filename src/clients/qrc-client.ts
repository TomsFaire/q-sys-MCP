/**
 * QRC Client — JSON-RPC over TCP (port 1710)
 * TODO: Implement in plan 02
 */

import { JsonRpcRequest, JsonRpcResponse } from "../types.js";

export class QrcClient {
  private host: string;
  private port: number;

  constructor(host: string, port: number = 1710) {
    this.host = host;
    this.port = port;
  }

  async connect(): Promise<void> {
    // TODO: Implement TCP connection
    throw new Error("Not implemented in scaffolding phase");
  }

  async call(method: string, params?: Record<string, unknown>): Promise<unknown> {
    // TODO: Implement JSON-RPC call
    throw new Error("Not implemented in scaffolding phase");
  }

  async disconnect(): Promise<void> {
    // TODO: Implement disconnect
  }
}
