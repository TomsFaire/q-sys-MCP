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

export class CoreBridge extends EventEmitter {
  private url: string;
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private reconnectDelay = RECONNECT_BASE_MS;
  private destroyed = false;
  private _connected = false;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(host: string, port = 443) {
    super();
    this.url = `wss://${host}:${port}/qrc-public-api/v0`;
  }

  get connected() { return this._connected; }

  connect() {
    if (this._connected || this.destroyed) return;
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
    this.ws?.terminate();
    this.ws = null;
    this._connected = false;
  }

  // ---------------------------------------------------------------------------

  private _tryConnect() {
    const ws = new WebSocket(this.url, { rejectUnauthorized: false });
    this.ws = ws;

    const timeout = setTimeout(() => {
      ws.terminate();
    }, REQUEST_TIMEOUT_MS);

    ws.once('open', () => {
      clearTimeout(timeout);
      this._connected = true;
      this.reconnectDelay = RECONNECT_BASE_MS;
      this._startKeepalive();
      console.log(`[bridge] connected to ${this.url}`);
      this.emit('connected');
    });

    ws.once('error', (err) => {
      clearTimeout(timeout);
      if (!this._connected) {
        console.error(`[bridge] connect error: ${err.message}`);
        this._scheduleReconnect();
      }
    });

    ws.on('message', (data) => {
      try {
        const msg: QrcResponse = JSON.parse(data.toString());
        this._handleMessage(msg);
      } catch { /* ignore malformed */ }
    });

    ws.on('close', () => {
      if (this._connected) {
        console.warn('[bridge] disconnected');
        this._connected = false;
        this._stopKeepalive();
        this._rejectAll(new Error('Core disconnected'));
        this.emit('disconnected', 'WebSocket closed');
        if (!this.destroyed) this._scheduleReconnect();
      }
    });

    ws.on('error', () => {
      if (this._connected) {
        this._connected = false;
        this._stopKeepalive();
        this._rejectAll(new Error('Core WebSocket error'));
        this.emit('disconnected', 'WebSocket error');
        if (!this.destroyed) this._scheduleReconnect();
      }
    });
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
    if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = null; }
  }
}
