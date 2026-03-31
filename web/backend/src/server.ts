/**
 * server.ts — Express HTTP server + WebSocket broker
 *
 * - Serves the built React app from dist/public/
 * - Opens a WebSocket on /ws for browser clients
 * - Connects to Q-Sys Core via CoreBridge (optional env QSYS_HOST, or UI-driven connect)
 * - Broadcasts snapshot + delta updates to all browsers
 * - Forwards Component.Set commands from browsers to Core
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { CoreBridge } from './core-bridge';
import { ChangeGroupManager } from './change-group';
import type { ClientMessage, ServerMessage } from './types';

const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const DEFAULT_WS_PORT = parseInt(process.env['QSYS_WS_PORT'] ?? '443', 10);
const rawHost = process.env['QSYS_HOST']?.trim();
const CORE_HOST_FROM_ENV = rawHost && rawHost.length > 0 ? rawHost : null;

// ---------------------------------------------------------------------------
// Express
// ---------------------------------------------------------------------------
const app = express();
const server = http.createServer(app);

const publicDir = path.join(__dirname, '..', 'dist', 'public');
app.use(express.static(publicDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// ---------------------------------------------------------------------------
// WebSocket server (browser clients connect here)
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ server, path: '/ws' });

const clients = new Set<WebSocket>();

function broadcast(msg: ServerMessage) {
  const payload = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

// ---------------------------------------------------------------------------
// Core bridge + change group (replaced when user connects from UI or env)
// ---------------------------------------------------------------------------
let bridge: CoreBridge | null = null;
let cg: ChangeGroupManager | null = null;

function coreSessionMessage(): ServerMessage {
  return {
    type: 'core_session',
    host: bridge?.host ?? null,
    port: bridge?.port ?? DEFAULT_WS_PORT,
    connected: bridge?.connected ?? false,
  };
}

function broadcastCoreSession() {
  broadcast(coreSessionMessage());
}

function teardownCore() {
  if (cg) {
    cg.stop();
    cg.removeAllListeners();
    cg = null;
  }
  if (bridge) {
    bridge.removeAllListeners();
    bridge.destroy();
    bridge = null;
  }
}

function wireBridge(b: CoreBridge, cgm: ChangeGroupManager) {
  b.on('connected', async () => {
    broadcast({ type: 'connected', coreHost: b.host, corePort: b.port });
    broadcastCoreSession();
    try {
      await cgm.start();
    } catch (e) {
      console.error('[server] failed to start change group:', e);
      broadcast({ type: 'disconnected', reason: 'Layout discovery failed' });
    }
  });

  b.on('disconnected', (reason: string) => {
    cgm.stop();
    broadcast({ type: 'disconnected', reason });
    broadcastCoreSession();
  });

  b.on('connect_failed', (reason: string) => {
    console.error('[server] connect_failed:', reason);
    broadcast({ type: 'disconnected', reason: `Connect failed: ${reason}` });
    teardownCore();
    broadcastCoreSession();
  });

  cgm.on('layout', (layout) => broadcast({ type: 'layout', layout }));
  cgm.on('snapshot', (state) => broadcast({ type: 'snapshot', state }));
  cgm.on('update', (changes) => broadcast({ type: 'update', changes }));
}

function setupCore(host: string, port: number, opts: { retryInitialConnect: boolean }) {
  teardownCore();
  bridge = new CoreBridge(host, port, { retryInitialConnect: opts.retryInitialConnect });
  cg = new ChangeGroupManager(bridge);
  wireBridge(bridge, cg);
  bridge.connect();
  broadcastCoreSession();
}

function sendCoreStateToClient(ws: WebSocket) {
  if (bridge?.connected && cg) {
    ws.send(JSON.stringify({ type: 'connected', coreHost: bridge.host, corePort: bridge.port } satisfies ServerMessage));
    const layout = cg.getLayout();
    if (layout) {
      ws.send(JSON.stringify({ type: 'layout', layout } satisfies ServerMessage));
    }
    const state = cg.getState();
    if (Object.keys(state).length > 0) {
      ws.send(JSON.stringify({ type: 'snapshot', state } satisfies ServerMessage));
    }
  } else if (bridge && !bridge.connected) {
    ws.send(JSON.stringify({ type: 'disconnected', reason: 'Connecting to Core…' } satisfies ServerMessage));
  } else {
    ws.send(JSON.stringify({ type: 'disconnected', reason: 'No Core configured — enter host below' } satisfies ServerMessage));
  }
}

// ---------------------------------------------------------------------------
// Browser WS handling
// ---------------------------------------------------------------------------
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[server] browser connected (${clients.size} total)`);

  ws.send(JSON.stringify(coreSessionMessage()));
  sendCoreStateToClient(ws);

  ws.on('message', async (data) => {
    try {
      const msg: ClientMessage = JSON.parse(data.toString());
      if (msg.type === 'connect') {
        const port = msg.wsPort ?? DEFAULT_WS_PORT;
        const host = msg.host.trim();
        if (!host) {
          ws.send(JSON.stringify({ type: 'disconnected', reason: 'Host is required' } satisfies ServerMessage));
          return;
        }
        setupCore(host, port, { retryInitialConnect: false });
        return;
      }
      if (msg.type === 'disconnect_core') {
        teardownCore();
        broadcast({ type: 'disconnected', reason: 'Disconnected by user' });
        broadcastCoreSession();
        return;
      }
      if (msg.type === 'set') {
        if (!bridge?.connected) {
          ws.send(JSON.stringify({ type: 'disconnected', reason: 'Core not connected' } satisfies ServerMessage));
          return;
        }
        await bridge.call('Component.Set', {
          Name: msg.component,
          Controls: msg.controls.map(c => ({ Name: c.name, Value: c.value })),
        });
      }
    } catch (e) {
      console.error('[server] command error:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[server] browser disconnected (${clients.size} total)`);
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  if (CORE_HOST_FROM_ENV) {
    console.log(`[server] connecting to Core at ${CORE_HOST_FROM_ENV}:${DEFAULT_WS_PORT}`);
    setupCore(CORE_HOST_FROM_ENV, DEFAULT_WS_PORT, { retryInitialConnect: true });
  } else {
    console.log('[server] No QSYS_HOST — start the UI and connect to a Core from the browser');
  }
});

process.on('SIGINT', () => {
  teardownCore();
  process.exit(0);
});
