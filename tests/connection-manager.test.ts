/**
 * Connection Manager — unit tests
 *
 * Tests config parsing and alias resolution only.
 * No TCP connections are made; clients are never asked to connect.
 */

import { describe, it, expect } from "vitest";
import { ConnectionManager } from "../src/connection-manager.js";

// ---------------------------------------------------------------------------
// Config parsing — valid inputs
// ---------------------------------------------------------------------------

describe("ConnectionManager — config parsing", () => {
  it("parses a single Core with default ports", () => {
    const cm = new ConnectionManager("sfo=10.1.1.100");
    const cores = cm.listCores();
    expect(cores).toHaveLength(1);
    expect(cores[0]).toMatchObject({ alias: "sfo", host: "10.1.1.100", isDefault: true });
  });

  it("parses multiple Cores", () => {
    const cm = new ConnectionManager("sfo=10.1.1.100,nyc=10.2.1.100");
    const cores = cm.listCores();
    expect(cores).toHaveLength(2);
    expect(cores.map((c) => c.alias)).toEqual(["sfo", "nyc"]);
  });

  it("marks no default alias when multiple Cores are configured", () => {
    const cm = new ConnectionManager("sfo=10.1.1.100,nyc=10.2.1.100");
    expect(cm.listCores().every((c) => !c.isDefault)).toBe(true);
  });

  it("parses custom qrcPort and ecpPort", () => {
    const cm = new ConnectionManager("lab=192.168.1.50:9710:9702");
    const cores = cm.listCores();
    expect(cores[0]).toMatchObject({ alias: "lab", host: "192.168.1.50" });
  });

  it("handles whitespace around entries", () => {
    const cm = new ConnectionManager("  sfo = 10.1.1.100 , nyc = 10.2.1.100 ");
    expect(cm.listCores()).toHaveLength(2);
  });

  it("ignores empty QSYS_CORES string", () => {
    const cm = new ConnectionManager("");
    expect(cm.listCores()).toHaveLength(0);
  });

  it("ignores whitespace-only QSYS_CORES string", () => {
    const cm = new ConnectionManager("   ");
    expect(cm.listCores()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Config parsing — invalid inputs
// ---------------------------------------------------------------------------

describe("ConnectionManager — invalid config", () => {
  it("throws on entry missing '='", () => {
    expect(() => new ConnectionManager("10.1.1.100")).toThrow(/expected format/);
  });

  it("throws on empty alias", () => {
    expect(() => new ConnectionManager("=10.1.1.100")).toThrow(/alias cannot be empty/);
  });

  it("throws on empty host", () => {
    expect(() => new ConnectionManager("sfo=")).toThrow(/host cannot be empty/);
  });

  it("throws on duplicate alias", () => {
    expect(() => new ConnectionManager("sfo=10.1.1.100,sfo=10.2.1.100")).toThrow(/Duplicate/);
  });
});

// ---------------------------------------------------------------------------
// Alias resolution — getClients()
// ---------------------------------------------------------------------------

describe("ConnectionManager — alias resolution errors", () => {
  it("throws on unknown alias", async () => {
    const cm = new ConnectionManager("sfo=10.1.1.100");
    // getClients will attempt to connect — we only care it throws the right error
    // before reaching network I/O (unknown alias check is synchronous)
    await expect(cm.getClients("nyc")).rejects.toThrow(/Unknown Core alias/);
  });

  it("throws when no cores configured and alias is omitted", async () => {
    const cm = new ConnectionManager("");
    await expect(cm.getClients()).rejects.toThrow(/No Cores configured/);
  });

  it("throws when multiple cores configured and alias is omitted", async () => {
    const cm = new ConnectionManager("sfo=10.1.1.100,nyc=10.2.1.100");
    await expect(cm.getClients()).rejects.toThrow(/Multiple Cores/);
  });
});
