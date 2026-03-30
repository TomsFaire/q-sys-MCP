/**
 * ECP Client — unit tests
 *
 * Uses a local TCP server to avoid hardware dependency.
 * Tests CRLF framing, response parsing, error handling, and input validation.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import net from "node:net";
import { EcpClient } from "../src/clients/ecp-client.js";

// ---------------------------------------------------------------------------
// Mock ECP server helper
// ---------------------------------------------------------------------------

type EcpCommandHandler = (command: string) => string;

function createMockEcpServer(handler: EcpCommandHandler): Promise<{ server: net.Server; port: number }> {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      let buf = "";
      socket.on("data", (data) => {
        buf += data.toString("utf-8");
        let idx: number;
        while ((idx = buf.search(/\r?\n/)) !== -1) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + (buf[idx] === "\r" ? 2 : 1));
          if (!line) continue;
          const response = handler(line);
          socket.write(response + "\r\n");
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
// getControl — response parsing
// ---------------------------------------------------------------------------

describe("EcpClient — getControl", () => {
  let server: net.Server;
  let port: number;

  beforeAll(async () => {
    ({ server, port } = await createMockEcpServer((cmd) => {
      if (cmd.startsWith("cgc ")) {
        return "0,-inf dB,0.0";       // value=0, string="-inf dB", position=0.0
      }
      return "ERR unknown command";
    }));
  });

  afterAll(() => server.close());

  it("parses value, string, and position from response", async () => {
    const client = new EcpClient("127.0.0.1", port);
    await client.connect();
    const result = await client.getControl("MainPA.gain");
    expect(result.value).toBe(0);
    expect(result.string).toBe("-inf dB");
    expect(result.position).toBe(0.0);
    await client.disconnect();
  });

  it("handles string values that contain commas", async () => {
    const { server: s, port: p } = await createMockEcpServer(() => "42,hello, world,0.75");
    const client = new EcpClient("127.0.0.1", p);
    await client.connect();
    const result = await client.getControl("SomeControl");
    expect(result.value).toBe(42);
    expect(result.string).toBe("hello, world");
    expect(result.position).toBe(0.75);
    await client.disconnect();
    s.close();
  });

  it("throws on ERR response", async () => {
    const { server: s, port: p } = await createMockEcpServer(() => "ERR control not found");
    const client = new EcpClient("127.0.0.1", p);
    await client.connect();
    await expect(client.getControl("bad.control")).rejects.toThrow(/control not found/);
    await client.disconnect();
    s.close();
  });
});

// ---------------------------------------------------------------------------
// setControlValue
// ---------------------------------------------------------------------------

describe("EcpClient — setControlValue", () => {
  let server: net.Server;
  let port: number;
  const received: string[] = [];

  beforeAll(async () => {
    ({ server, port } = await createMockEcpServer((cmd) => {
      received.push(cmd);
      return "ok";
    }));
  });

  afterAll(() => server.close());

  it("sends csv command with correct format", async () => {
    const client = new EcpClient("127.0.0.1", port);
    await client.connect();
    await client.setControlValue("MainPA.gain", -6);
    expect(received.some((c) => c === "csv MainPA.gain -6")).toBe(true);
    await client.disconnect();
  });

  it("throws on ERR response", async () => {
    const { server: s, port: p } = await createMockEcpServer(() => "ERR read-only control");
    const client = new EcpClient("127.0.0.1", p);
    await client.connect();
    await expect(client.setControlValue("ro.control", 1)).rejects.toThrow(/read-only/);
    await client.disconnect();
    s.close();
  });
});

// ---------------------------------------------------------------------------
// setControlPosition — validation
// ---------------------------------------------------------------------------

describe("EcpClient — setControlPosition", () => {
  let server: net.Server;
  let port: number;
  const received: string[] = [];

  beforeAll(async () => {
    ({ server, port } = await createMockEcpServer((cmd) => {
      received.push(cmd);
      return "ok";
    }));
  });

  afterAll(() => server.close());

  it("sends csp command with correct format", async () => {
    const client = new EcpClient("127.0.0.1", port);
    await client.connect();
    await client.setControlPosition("MainPA.gain", 0.5);
    expect(received.some((c) => c === "csp MainPA.gain 0.5")).toBe(true);
    await client.disconnect();
  });

  it("rejects position below 0", async () => {
    const client = new EcpClient("127.0.0.1", port);
    await client.connect();
    await expect(client.setControlPosition("x", -0.1)).rejects.toThrow(/0.0 and 1.0/);
    await client.disconnect();
  });

  it("rejects position above 1", async () => {
    const client = new EcpClient("127.0.0.1", port);
    await client.connect();
    await expect(client.setControlPosition("x", 1.1)).rejects.toThrow(/0.0 and 1.0/);
    await client.disconnect();
  });

  it("accepts boundary values 0.0 and 1.0", async () => {
    const client = new EcpClient("127.0.0.1", port);
    await client.connect();
    await expect(client.setControlPosition("x", 0.0)).resolves.toBeUndefined();
    await expect(client.setControlPosition("x", 1.0)).resolves.toBeUndefined();
    await client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// loadSnapshot
// ---------------------------------------------------------------------------

describe("EcpClient — loadSnapshot", () => {
  let server: net.Server;
  let port: number;
  const received: string[] = [];

  beforeAll(async () => {
    ({ server, port } = await createMockEcpServer((cmd) => {
      received.push(cmd);
      return "ok";
    }));
  });

  afterAll(() => server.close());

  it("sends ssl command for named snapshots", async () => {
    const client = new EcpClient("127.0.0.1", port);
    await client.connect();
    await client.loadSnapshot("Pre-show");
    expect(received.some((c) => c === "ssl Pre-show")).toBe(true);
    await client.disconnect();
  });

  it("sends ssa command for bank/number snapshots", async () => {
    const client = new EcpClient("127.0.0.1", port);
    await client.connect();
    await client.loadSnapshot({ bank: 1, number: 3 });
    expect(received.some((c) => c === "ssa 1 3")).toBe(true);
    await client.disconnect();
  });
});
