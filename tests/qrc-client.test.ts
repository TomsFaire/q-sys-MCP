/**
 * QRC Client — unit tests
 *
 * Uses a local TCP echo server to avoid hardware dependency.
 * Tests null-byte framing, JSON-RPC request/response, error handling, and timeouts.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import net from "node:net";
import { QrcClient } from "../src/clients/qrc-client.js";

// ---------------------------------------------------------------------------
// Mock QRC server helpers
// ---------------------------------------------------------------------------

type RequestHandler = (msg: { id: number; method: string; params?: unknown }) => unknown;

function createMockQrcServer(handler: RequestHandler): Promise<{ server: net.Server; port: number }> {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      let buf = "";
      socket.on("data", (data) => {
        buf += data.toString("utf-8");
        let idx: number;
        while ((idx = buf.indexOf("\0")) !== -1) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (!raw.trim()) continue;
          try {
            const msg = JSON.parse(raw);
            const result = handler(msg);
            const response = { jsonrpc: "2.0", id: msg.id, result };
            socket.write(JSON.stringify(response) + "\0");
          } catch (err) {
            // If handler throws, send a JSON-RPC error
            const msg = JSON.parse(raw);
            const errResponse = {
              jsonrpc: "2.0",
              id: msg.id,
              error: { code: -1, message: String(err) },
            };
            socket.write(JSON.stringify(errResponse) + "\0");
          }
        }
      });
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as net.AddressInfo;
      resolve({ server, port: addr.port });
    });
  });
}

// ---------------------------------------------------------------------------
// Basic request/response
// ---------------------------------------------------------------------------

describe("QrcClient — request/response", () => {
  let server: net.Server;
  let port: number;

  beforeAll(async () => {
    ({ server, port } = await createMockQrcServer(() => ({
      Value: 0,
      Position: 0.5,
      String: "-inf",
    })));
  });

  afterAll(() => server.close());

  it("connects to the server", async () => {
    const client = new QrcClient("127.0.0.1", port, 2000);
    await client.connect();
    expect(client.isConnected).toBe(true);
    await client.disconnect();
  });

  it("sends a call and receives the result", async () => {
    const client = new QrcClient("127.0.0.1", port, 2000);
    await client.connect();
    const result = await client.call("Control.Get", { Name: "test" });
    expect(result).toMatchObject({ Value: 0, Position: 0.5, String: "-inf" });
    await client.disconnect();
  });

  it("auto-increments request IDs", async () => {
    const ids: number[] = [];
    const { server: s, port: p } = await createMockQrcServer((msg) => {
      ids.push(msg.id);
      return {};
    });

    const client = new QrcClient("127.0.0.1", p, 2000);
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
// Framing — null-byte protocol
// ---------------------------------------------------------------------------

describe("QrcClient — null-byte framing", () => {
  it("handles multiple responses delivered in a single TCP chunk", async () => {
    // Server sends two responses concatenated in one write
    const server = net.createServer((socket) => {
      let buf = "";
      socket.on("data", (data) => {
        buf += data.toString("utf-8");
        let idx: number;
        const responses: string[] = [];
        while ((idx = buf.indexOf("\0")) !== -1) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (!raw.trim()) continue;
          const msg = JSON.parse(raw);
          responses.push(JSON.stringify({ jsonrpc: "2.0", id: msg.id, result: { id: msg.id } }) + "\0");
        }
        // Flush all responses in one write to simulate chunking
        if (responses.length > 0) {
          socket.write(responses.join(""));
        }
      });
    });

    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as net.AddressInfo;

    const client = new QrcClient("127.0.0.1", port, 2000);
    await client.connect();

    // Fire two calls concurrently — both should resolve correctly
    const [r1, r2] = await Promise.all([
      client.call("MethodA"),
      client.call("MethodB"),
    ]);

    expect((r1 as { id: number }).id).toBeDefined();
    expect((r2 as { id: number }).id).toBeDefined();
    expect((r1 as { id: number }).id).not.toBe((r2 as { id: number }).id);

    await client.disconnect();
    server.close();
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("QrcClient — error handling", () => {
  it("rejects with QRC error when server returns error response", async () => {
    const server = net.createServer((socket) => {
      let buf = "";
      socket.on("data", (data) => {
        buf += data.toString("utf-8");
        let idx: number;
        while ((idx = buf.indexOf("\0")) !== -1) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (!raw.trim()) continue;
          const msg = JSON.parse(raw);
          const errResponse = {
            jsonrpc: "2.0",
            id: msg.id,
            error: { code: -32600, message: "Control not found" },
          };
          socket.write(JSON.stringify(errResponse) + "\0");
        }
      });
    });

    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as net.AddressInfo;

    const client = new QrcClient("127.0.0.1", port, 2000);
    await client.connect();
    await expect(client.call("Control.Get", { Name: "nonexistent" })).rejects.toThrow(
      "Control not found"
    );
    await client.disconnect();
    server.close();
  });

  it("rejects pending calls when disconnected", async () => {
    const server = net.createServer((socket) => {
      // Accepts connection but never responds — then drops it
      setTimeout(() => socket.destroy(), 100);
    });

    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as net.AddressInfo;

    const client = new QrcClient("127.0.0.1", port, 5000);
    await client.connect();

    const callPromise = client.call("StatusGet");
    // Server drops the connection after 100ms
    await expect(callPromise).rejects.toThrow();

    server.close();
  });

  it("throws when connecting to a closed port", async () => {
    const client = new QrcClient("127.0.0.1", 19999, 1000);
    await expect(client.connect()).rejects.toThrow();
  });
});
