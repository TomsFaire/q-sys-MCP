/**
 * WsQrcClient — unit tests
 *
 * Uses a local WebSocket server (ws package) to avoid hardware dependency.
 * Tests request/response, concurrent calls, and error handling.
 *
 * Note: TLS (rejectUnauthorized: false) is exercised against the live Core.
 * The mock server here uses plain ws:// to keep tests self-contained.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { WebSocketServer, WebSocket } from "ws";
import http from "node:http";
import { WsQrcClient } from "../src/clients/ws-qrc-client.js";

// ---------------------------------------------------------------------------
// Mock WebSocket QRC server helper
// ---------------------------------------------------------------------------

type RequestHandler = (msg: { id: number; method: string; params?: unknown }) => unknown;

function createMockWsServer(handler: RequestHandler): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const httpServer = http.createServer();
    const wss = new WebSocketServer({ server: httpServer });

    wss.on("connection", (ws) => {
      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          const result = handler(msg);
          ws.send(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }));
        } catch (err) {
          const msg = JSON.parse(data.toString());
          ws.send(
            JSON.stringify({
              jsonrpc: "2.0",
              id: msg.id,
              error: { code: -1, message: String(err) },
            })
          );
        }
      });
    });

    httpServer.listen(0, "127.0.0.1", () => {
      const addr = httpServer.address() as { port: number };
      resolve({ server: httpServer, port: addr.port });
    });
  });
}

// WsQrcClient builds ws[s]://<host>:<port>/qrc-public-api/v0 but our mock
// server uses a random port and doesn't care about path.  Patch URL to plain
// ws:// so the test-server (no TLS) accepts the connection.
class TestWsQrcClient extends WsQrcClient {
  constructor(host: string, port: number) {
    super(host, port);
    // Override the URL to use ws:// instead of the default scheme
    (this as unknown as { url: string }).url = `ws://${host}:${port}/qrc-public-api/v0`;
  }
}

// ---------------------------------------------------------------------------
// Basic request/response
// ---------------------------------------------------------------------------

describe("WsQrcClient — request/response", () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    ({ server, port } = await createMockWsServer(() => ({
      Value: 0,
      Position: 0.5,
      String: "-inf",
    })));
  });

  afterAll(() => server.close());

  it("connects to the WebSocket server", async () => {
    const client = new TestWsQrcClient("127.0.0.1", port);
    await client.connect();
    expect(client.isConnected).toBe(true);
    await client.disconnect();
  });

  it("sends a call and receives the result", async () => {
    const client = new TestWsQrcClient("127.0.0.1", port);
    await client.connect();
    const result = await client.call("Control.Get", { Name: "test" });
    expect(result).toMatchObject({ Value: 0, Position: 0.5, String: "-inf" });
    await client.disconnect();
  });

  it("auto-increments request IDs", async () => {
    const ids: number[] = [];
    const { server: s, port: p } = await createMockWsServer((msg) => {
      ids.push(msg.id);
      return {};
    });

    const client = new TestWsQrcClient("127.0.0.1", p);
    await client.connect();
    await client.call("StatusGet");
    await client.call("StatusGet");
    await client.call("StatusGet");
    await client.disconnect();
    s.close();

    expect(ids).toHaveLength(3);
    expect(ids[1]).toBe(ids[0] + 1);
    expect(ids[2]).toBe(ids[1] + 1);
  });
});

// ---------------------------------------------------------------------------
// Concurrent calls
// ---------------------------------------------------------------------------

describe("WsQrcClient — concurrent calls", () => {
  it("handles multiple in-flight requests correctly", async () => {
    const { server, port } = await createMockWsServer((msg) => ({ id: msg.id }));
    const client = new TestWsQrcClient("127.0.0.1", port);
    await client.connect();

    const [r1, r2, r3] = await Promise.all([
      client.call("MethodA"),
      client.call("MethodB"),
      client.call("MethodC"),
    ]);

    const ids = [(r1 as { id: number }).id, (r2 as { id: number }).id, (r3 as { id: number }).id];
    expect(new Set(ids).size).toBe(3); // all unique IDs

    await client.disconnect();
    server.close();
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("WsQrcClient — error handling", () => {
  it("rejects with QRC error when server returns error response", async () => {
    const { server, port } = await createMockWsServer(() => {
      throw new Error("Control not found");
    });

    const client = new TestWsQrcClient("127.0.0.1", port);
    await client.connect();
    await expect(client.call("Control.Get", { Name: "bad" })).rejects.toThrow(
      "Control not found"
    );
    await client.disconnect();
    server.close();
  });

  it("throws when connecting to a closed port", async () => {
    const client = new TestWsQrcClient("127.0.0.1", 19998);
    await expect(client.connect()).rejects.toThrow();
  });
});
