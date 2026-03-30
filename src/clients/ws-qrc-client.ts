/**
 * WsQrcClient — QRC (JSON-RPC 2.0) over WebSocket (QRWC, port 443)
 *
 * Q-SYS Remote WebSocket Control (BETA) exposes the same JSON-RPC protocol
 * as plain QRC but over a WebSocket connection to wss://<host>:<port>/qrc.
 *
 * Differences from QrcClient (TCP):
 * - Uses WebSocket text frames instead of null-byte-delimited TCP stream.
 *   No buffer management needed; each frame is one complete JSON message.
 * - Connects to wss:// so TLS is always on.
 * - Core ships a self-signed certificate — rejectUnauthorized: false is required.
 *
 * Otherwise the protocol (JSON-RPC 2.0, same methods, same ID scheme) is identical,
 * so all tool code works unchanged through the IQrcClient interface.
 *
 * Reconnect strategy mirrors QrcClient: exponential backoff 500ms → 30s.
 */

import WebSocket from "ws";
import type { JsonRpcRequest, JsonRpcResponse, IQrcClient } from "../types.js";

const DEFAULT_PORT = 443;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 500;

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class WsQrcClient implements IQrcClient {
  private host: string;
  private port: number;
  private timeoutMs: number;
  private url: string;

  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private reconnecting: boolean = false;
  private destroyed: boolean = false;
  private reconnectDelay: number = BASE_RECONNECT_DELAY_MS;

  private nextId: number = 1;
  private pending: Map<number, PendingRequest> = new Map();

  constructor(host: string, port: number = DEFAULT_PORT, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.host = host;
    this.port = port;
    this.timeoutMs = timeoutMs;
    this.url = `wss://${host}:${port}/qrc`;
  }

  // ---------------------------------------------------------------------------
  // Public API (matches IQrcClient)
  // ---------------------------------------------------------------------------

  get isConnected(): boolean {
    return this.connected;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.reconnecting) {
      await new Promise<void>((resolve, reject) => {
        const check = () => {
          if (this.connected) return resolve();
          if (!this.reconnecting) return reject(new Error("QRWC reconnect failed"));
          setTimeout(check, 50);
        };
        check();
      });
      return;
    }
    await this.performConnect();
  }

  async call(method: string, params?: Record<string, unknown>): Promise<unknown> {
    if (!this.connected) {
      await this.connect();
    }

    const id = this.nextId++;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    };

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`QRWC request timed out: ${method} (id=${id})`));
      }, this.timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      try {
        this.ws!.send(JSON.stringify(request));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new Error(`QRWC send error: ${err}`));
      }
    });
  }

  async disconnect(): Promise<void> {
    this.destroyed = true;
    this.rejectAllPending(new Error("QRWC client disconnected"));
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
    this.connected = false;
  }

  // ---------------------------------------------------------------------------
  // Private — connection lifecycle
  // ---------------------------------------------------------------------------

  private performConnect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(this.url, {
        // Core ships a self-signed certificate — skip verification
        rejectUnauthorized: false,
      });
      this.ws = ws;

      const connectTimeout = setTimeout(() => {
        ws.terminate();
        reject(new Error(`QRWC connect timeout: ${this.url}`));
      }, this.timeoutMs);

      ws.once("open", () => {
        clearTimeout(connectTimeout);
        this.connected = true;
        this.reconnectDelay = BASE_RECONNECT_DELAY_MS;
        resolve();
      });

      ws.once("error", (err) => {
        clearTimeout(connectTimeout);
        this.connected = false;
        reject(err);
      });

      ws.on("message", (data) => {
        try {
          const message: JsonRpcResponse = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch {
          // Malformed JSON — ignore
        }
      });

      ws.on("close", () => {
        if (this.connected) this.handleDisconnect("WebSocket closed");
      });

      // After the initial connect, subsequent errors trigger reconnect
      ws.on("error", () => {
        if (this.connected) this.handleDisconnect("WebSocket error");
      });
    });
  }

  private handleMessage(message: JsonRpcResponse): void {
    if (message.id === undefined || message.id === null) return;

    const id = typeof message.id === "string" ? parseInt(message.id, 10) : message.id;
    const pending = this.pending.get(id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(id);

    if (message.error) {
      pending.reject(
        new Error(`QRWC error ${message.error.code}: ${message.error.message}`)
      );
    } else {
      pending.resolve(message.result);
    }
  }

  private handleDisconnect(reason: string): void {
    if (!this.connected) return;
    this.connected = false;
    this.rejectAllPending(new Error(`QRWC disconnected: ${reason}`));
    if (!this.destroyed) this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.reconnecting || this.destroyed) return;
    this.reconnecting = true;

    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);

    setTimeout(async () => {
      if (this.destroyed) {
        this.reconnecting = false;
        return;
      }
      try {
        await this.performConnect();
        this.reconnecting = false;
      } catch {
        this.reconnecting = false;
        if (!this.destroyed) this.scheduleReconnect();
      }
    }, delay);
  }

  private rejectAllPending(error: Error): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }
}
