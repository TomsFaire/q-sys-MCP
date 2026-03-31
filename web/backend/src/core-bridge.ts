/**
 * CoreBridge — manages the persistent wss:// connection to the Q-Sys Core.
 * Exposes a simple call() interface (JSON-RPC 2.0) and emits events for
 * connect / disconnect so the change-group poller can start/stop.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { QrcRequest, QrcResponse } from './types';

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;
const KEEPALIVE_MS = 55_000;

interface Pending {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface CoreBridgeOptions {
  /**
   * When true (default), failed connect retries with backoff until success.
   * When false (UI-driven connect), the first failure emits `connect_failed` instead of retrying.
   */
  retryInitialConnect?: boolean;
}

export class CoreBridge extends EventEmitter {
  readonly host: string;
  readonly port: number;

  private url: string;
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private reconnectDelay = RECONNECT_BASE_MS;
  private destroyed = false;
  private _connected = false;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private retryInitialConnect: boolean;
  /** True after first successful WebSocket open — enables reconnect after drop */
  private hadSuccessfulConnection = false;
  private initialFailureEmitted = false;

  constructor(host: string, port = 443, options?: CoreBridgeOptions) {
    super();
    this.host = host;
    this.port = port;
    this.retryInitialConnect = options?.retryInitialConnect ?? true;
    this.url = `wss://${host}:${port}/qrc-public-api/v0`;
  }

  get connected() {
    return this._connected;
  }

  connect() {
    if (this._connected || this.destroyed) return;
    this.initialFailureEmitted = false;
    this._tryConnect();
  }

  async call(method: string, params?: unknown): Promise<unknown> {
    if (!this._connected) throw new Error('Not connected to Core');
    const id = this.nextId++;
    const req: QrcRequest = { jsonrpc: '2.0', id, method, ...(params !== undefined ? { params } : {}) };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`QRC timeout: ${method}`));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.ws!.send(JSON.stringify(req));
    });
  }

  destroy() {
    this.destroyed = true;
    this._stopKeepalive();
    this._rejectAll(new Error('CoreBridge destroyed'));
    const w = this.ws;
    this.ws = null;
    this._connected = false;
    w?.terminate();
  }

  // ---------------------------------------------------------------------------

  private _tryConnect() {
    const sock = new WebSocket(this.url, { rejectUnauthorized: false });
    this.ws = sock;

    const timeout = setTimeout(() => {
      sock.terminate();
    }, REQUEST_TIMEOUT_MS);

    let opened = false;

    sock.once('open', () => {
      if (this.ws !== sock || this.destroyed) return;
      clearTimeout(timeout);
      opened = true;
      this._connected = true;
      this.hadSuccessfulConnection = true;
      this.reconnectDelay = RECONNECT_BASE_MS;
      this._startKeepalive();
      console.log(`[bridge] connected to ${this.url}`);
      this.emit('connected');
    });

    sock.on('message', (data) => {
      if (this.ws !== sock) return;
      try {
        const msg: QrcResponse = JSON.parse(data.toString());
        this._handleMessage(msg);
      } catch {
        /* ignore malformed */
      }
    });

    sock.on('close', () => {
      if (this.ws !== sock) return;
      clearTimeout(timeout);
      if (!opened) {
        this._handlePrematureEnd('Connection closed before open');
        return;
      }
      if (this._connected) {
        console.warn('[bridge] disconnected');
        this._connected = false;
        this._stopKeepalive();
        this._rejectAll(new Error('Core disconnected'));
        if (!this.destroyed) this.emit('disconnected', 'WebSocket closed');
        if (!this.destroyed) this._scheduleReconnect();
      }
    });

    sock.on('error', (err: Error) => {
      if (this.ws !== sock) return;
      clearTimeout(timeout);
      if (!opened) {
        this._handlePrematureEnd(err.message || 'WebSocket error');
        return;
      }
      if (this._connected) {
        this._connected = false;
        this._stopKeepalive();
        this._rejectAll(new Error('Core WebSocket error'));
        if (!this.destroyed) this.emit('disconnected', 'WebSocket error');
        if (!this.destroyed) this._scheduleReconnect();
      }
    });
  }

  /** First connect attempt failed before `open` */
  private _handlePrematureEnd(reason: string) {
    if (this.destroyed || this.hadSuccessfulConnection) return;
    if (!this.retryInitialConnect) {
      if (this.initialFailureEmitted) return;
      this.initialFailureEmitted = true;
      console.error(`[bridge] connect failed: ${reason}`);
      this.emit('connect_failed', reason);
      const w = this.ws;
      this.ws = null;
      w?.terminate();
      return;
    }
    console.error(`[bridge] connect error: ${reason}`);
    this._scheduleReconnect();
  }

  private _handleMessage(msg: QrcResponse) {
    if (msg.id == null) return; // unsolicited notification
    const p = this.pending.get(msg.id as number);
    if (!p) return;
    clearTimeout(p.timer);
    this.pending.delete(msg.id as number);
    if (msg.error) p.reject(new Error(`QRC ${msg.error.code}: ${msg.error.message}`));
    else p.resolve(msg.result);
  }

  private _scheduleReconnect() {
    if (this.destroyed) return;
    if (!this.hadSuccessfulConnection && !this.retryInitialConnect) return;
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS);
    console.log(`[bridge] reconnecting in ${delay}ms`);
    setTimeout(() => {
      if (!this.destroyed && !this._connected) this._tryConnect();
    }, delay);
  }

  private _rejectAll(err: Error) {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
      this.pending.delete(id);
    }
  }

  private _startKeepalive() {
    this._stopKeepalive();
    this.keepAliveTimer = setInterval(() => {
      if (this._connected) this.call('NoOp').catch(() => {});
    }, KEEPALIVE_MS);
  }

  private _stopKeepalive() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }
}
