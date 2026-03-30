/**
 * QRC Client — JSON-RPC 2.0 over TCP (port 1710)
 *
 * Wire format: null-byte (\0) terminated JSON messages.
 * Each message is a complete JSON-RPC 2.0 object.
 *
 * Reconnect Strategy:
 * Exponential backoff starting at 500ms, doubling up to 30s max.
 * Automatically reconnects on socket error or end.
 * In-flight requests are rejected on disconnect so callers can retry if needed.
 */

import { Socket } from "node:net";
import type { JsonRpcRequest, JsonRpcResponse, IQrcClient } from "../types.js";

const DEFAULT_PORT = 1710;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const BASE_RECONNECT_DELAY_MS = 500;
const KEEPALIVE_INTERVAL_MS = 55_000;

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class QrcClient implements IQrcClient {
  private host: string;
  private port: number;
  private timeoutMs: number;

  private socket: Socket | null = null;
  private buffer: string = "";
  private connected: boolean = false;
  private reconnecting: boolean = false;
  private destroyed: boolean = false;
  private reconnectDelay: number = BASE_RECONNECT_DELAY_MS;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  private nextId: number = 1;
  private pending: Map<number, PendingRequest> = new Map();

  constructor(host: string, port: number = DEFAULT_PORT, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.host = host;
    this.port = port;
    this.timeoutMs = timeoutMs;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Connect to the Core. Safe to call multiple times; no-ops if already connected.
   */
  async connect(): Promise<void> {
    if (this.connected) return;
    if (this.reconnecting) {
      // Wait for ongoing reconnect to finish
      await new Promise<void>((resolve, reject) => {
        const check = () => {
          if (this.connected) return resolve();
          if (!this.reconnecting) return reject(new Error("Reconnect failed"));
          setTimeout(check, 50);
        };
        check();
      });
      return;
    }
    await this.performConnect();
  }

  /**
   * Send a JSON-RPC method call and return the result.
   * Throws if the Core returns an error, the connection is lost, or the request times out.
   */
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
        reject(new Error(`QRC request timed out: ${method} (id=${id})`));
      }, this.timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      const payload = JSON.stringify(request) + "\0";
      this.socket!.write(payload, "utf-8", (err) => {
        if (err) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(new Error(`QRC write error: ${err.message}`));
        }
      });
    });
  }

  /**
   * Disconnect and stop any reconnection attempts.
   */
  async disconnect(): Promise<void> {
    this.destroyed = true;
    this.stopKeepAlive();
    this.rejectAllPending(new Error("QRC client disconnected"));
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  // ---------------------------------------------------------------------------
  // Private — connection lifecycle
  // ---------------------------------------------------------------------------

  private async performConnect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const socket = new Socket();
      this.socket = socket;

      const connectTimeout = setTimeout(() => {
        socket.destroy();
        reject(new Error(`QRC connect timeout: ${this.host}:${this.port}`));
      }, this.timeoutMs);

      socket.once("connect", () => {
        clearTimeout(connectTimeout);
        this.connected = true;
        this.reconnectDelay = BASE_RECONNECT_DELAY_MS;
        this.buffer = "";
        this.startKeepAlive();
        resolve();
      });

      socket.once("error", (err) => {
        clearTimeout(connectTimeout);
        this.connected = false;
        reject(err);
      });

      socket.on("data", (chunk: Buffer) => this.handleData(chunk));

      socket.on("end", () => this.handleDisconnect("Connection ended"));
      socket.on("error", () => this.handleDisconnect("Socket error"));
      socket.on("close", () => {
        if (this.connected) this.handleDisconnect("Socket closed");
      });

      socket.connect(this.port, this.host);
    });
  }

  private handleData(chunk: Buffer): void {
    this.buffer += chunk.toString("utf-8");

    // Messages are null-byte terminated
    let nullIndex: number;
    while ((nullIndex = this.buffer.indexOf("\0")) !== -1) {
      const raw = this.buffer.slice(0, nullIndex);
      this.buffer = this.buffer.slice(nullIndex + 1);

      if (raw.trim().length === 0) continue;

      try {
        const message: JsonRpcResponse = JSON.parse(raw);
        this.handleMessage(message);
      } catch {
        // Malformed JSON — ignore and continue
      }
    }
  }

  private handleMessage(message: JsonRpcResponse): void {
    // Unsolicited notification (no id) — ignore in Phase 1
    if (message.id === undefined || message.id === null) return;

    const id = typeof message.id === "string" ? parseInt(message.id, 10) : message.id;
    const pending = this.pending.get(id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(id);

    if (message.error) {
      pending.reject(
        new Error(`QRC error ${message.error.code}: ${message.error.message}`)
      );
    } else {
      pending.resolve(message.result);
    }
  }

  private handleDisconnect(reason: string): void {
    if (!this.connected) return;
    this.connected = false;
    this.stopKeepAlive();
    this.rejectAllPending(new Error(`QRC disconnected: ${reason}`));

    if (!this.destroyed) {
      this.scheduleReconnect();
    }
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
        if (!this.destroyed) {
          this.scheduleReconnect();
        }
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

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (this.connected && !this.destroyed) {
        this.call("NoOp").catch(() => { /* ignore — disconnect handler fires */ });
      }
    }, KEEPALIVE_INTERVAL_MS);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer !== null) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }
}
