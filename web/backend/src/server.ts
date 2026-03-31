/**
 * server.ts — Express HTTP server + WebSocket broker
 *
 * - Serves the built React app from dist/public/
 * - Opens a WebSocket on /ws for browser clients
 * - Connects to Q-Sys Core via CoreBridge
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
const CORE_HOST = process.env['QSYS_HOST'] ?? '10.4.18.1';
const CORE_PORT = parseInt(process.env['QSYS_WS_PORT'] ?? '443', 10);

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
// Core bridge + change group
// ---------------------------------------------------------------------------
const bridge = new CoreBridge(CORE_HOST, CORE_PORT);
const cg = new ChangeGroupManager(bridge);

bridge.on('connected', async () => {
  broadcast({ type: 'connected', coreHost: CORE_HOST });
  try {
    await cg.start();
  } catch (e) {
    console.error('[server] failed to start change group:', e);
  }
});

bridge.on('disconnected', (reason: string) => {
  cg.stop();
  broadcast({ type: 'disconnected', reason });
});

cg.on('snapshot', (state) => {
  broadcast({ type: 'snapshot', state });
});

cg.on('update', (changes) => {
  broadcast({ type: 'update', changes });
});

// ---------------------------------------------------------------------------
// Browser WS handling
// ---------------------------------------------------------------------------
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[server] browser connected (${clients.size} total)`);

  // Send current state immediately if connected
  if (bridge.connected) {
    ws.send(JSON.stringify({ type: 'connected', coreHost: CORE_HOST } satisfies ServerMessage));
    const state = cg.getState();
    if (Object.keys(state).length > 0) {
      ws.send(JSON.stringify({ type: 'snapshot', state } satisfies ServerMessage));
    }
  } else {
    ws.send(JSON.stringify({ type: 'disconnected', reason: 'Connecting to Core...' } satisfies ServerMessage));
  }

  ws.on('message', async (data) => {
    try {
      const msg: ClientMessage = JSON.parse(data.toString());
      if (msg.type === 'set') {
        if (!bridge.connected) {
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
  console.log(`[server] connecting to Core at ${CORE_HOST}:${CORE_PORT}`);
  bridge.connect();
});

process.on('SIGINT', () => {
  cg.stop();
  bridge.destroy();
  process.exit(0);
});
