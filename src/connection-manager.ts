/**
 * Connection Manager — Multi-Core registry and lifecycle
 *
 * Connection policy: LAZY
 * Clients are instantiated and connected on first getClients() call, not at startup.
 * This tolerates offline or unreachable Cores during server boot.
 * Reconnection is handled automatically by QrcClient and EcpClient.
 *
 * Configuration:
 * Set QSYS_CORES env var as comma-separated alias=host pairs:
 *   QSYS_CORES=sfo-allhands=10.1.1.100,nyc-display=10.2.1.100
 * Optional port overrides:
 *   QSYS_CORES=sfo=10.1.1.100:1710:1702
 *   (format: alias=host[:qrcPort[:ecpPort]])
 *
 * Single-Core shorthand:
 * If exactly one Core is configured, getClients() accepts an empty alias "".
 */

import { CoreAlias, CoreConfig, ConnectionState } from "./types.js";
import { QrcClient } from "./clients/qrc-client.js";
import { EcpClient } from "./clients/ecp-client.js";

interface CoreEntry {
  config: CoreConfig;
  qrc: QrcClient;
  ecp: EcpClient;
}

export class ConnectionManager {
  private entries: Map<CoreAlias, CoreEntry> = new Map();
  private defaultAlias: CoreAlias | null = null;

  constructor(envVar: string = process.env["QSYS_CORES"] ?? "") {
    this.parseConfig(envVar);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Get QRC and ECP clients for a named Core.
   * Connects lazily on first call.
   *
   * @param alias - Core alias as configured in QSYS_CORES.
   *                Omit or pass "" to use the default (only valid if exactly one Core configured).
   */
  async getClients(alias: CoreAlias = ""): Promise<{ qrc: QrcClient; ecp: EcpClient }> {
    const resolved = this.resolveAlias(alias);
    const entry = this.entries.get(resolved);

    if (!entry) {
      const known = [...this.entries.keys()].join(", ");
      throw new Error(
        `Unknown Core alias "${resolved}". Configured cores: ${known || "(none)"}`
      );
    }

    // Lazy connect — clients handle their own reconnects after this
    if (!entry.qrc.isConnected) {
      await entry.qrc.connect().catch((err) => {
        // Non-fatal: caller can still try ECP, or will get an error on next call()
        console.error(`[qsys] QRC connect failed for "${resolved}": ${err.message}`);
      });
    }
    if (!entry.ecp.isConnected) {
      await entry.ecp.connect().catch((err) => {
        console.error(`[qsys] ECP connect failed for "${resolved}": ${err.message}`);
      });
    }

    return { qrc: entry.qrc, ecp: entry.ecp };
  }

  /**
   * List all configured Cores and their current connection states.
   */
  listCores(): Array<{ alias: CoreAlias; host: string; state: ConnectionState; isDefault: boolean }> {
    return [...this.entries.entries()].map(([alias, entry]) => ({
      alias,
      host: entry.config.host,
      state: this.getState(entry),
      isDefault: alias === this.defaultAlias,
    }));
  }

  /**
   * Disconnect all Cores and clean up.
   */
  async disconnectAll(): Promise<void> {
    await Promise.all(
      [...this.entries.values()].flatMap((entry) => [
        entry.qrc.disconnect(),
        entry.ecp.disconnect(),
      ])
    );
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private parseConfig(raw: string): void {
    if (!raw.trim()) return;

    const segments = raw.split(",").map((s) => s.trim()).filter(Boolean);

    for (const segment of segments) {
      const eqIdx = segment.indexOf("=");
      if (eqIdx === -1) {
        throw new Error(
          `Invalid QSYS_CORES entry "${segment}": expected format alias=host[:qrcPort[:ecpPort]]`
        );
      }

      const alias = segment.slice(0, eqIdx).trim();
      const rest = segment.slice(eqIdx + 1).trim();

      if (!alias) {
        throw new Error(`Invalid QSYS_CORES entry "${segment}": alias cannot be empty`);
      }
      if (!rest) {
        throw new Error(`Invalid QSYS_CORES entry "${segment}": host cannot be empty`);
      }
      if (this.entries.has(alias)) {
        throw new Error(`Duplicate Core alias "${alias}" in QSYS_CORES`);
      }

      // Parse host[:qrcPort[:ecpPort]]
      const parts = rest.split(":");
      const host = parts[0];
      const qrcPort = parts[1] ? parseInt(parts[1], 10) : undefined;
      const ecpPort = parts[2] ? parseInt(parts[2], 10) : undefined;

      if (!host) {
        throw new Error(`Invalid QSYS_CORES entry "${segment}": host cannot be empty`);
      }

      const config: CoreConfig = { alias, host, qrcPort, ecpPort };
      this.entries.set(alias, {
        config,
        qrc: new QrcClient(host, qrcPort),
        ecp: new EcpClient(host, ecpPort),
      });
    }

    // Set default alias if exactly one Core
    if (this.entries.size === 1) {
      this.defaultAlias = [...this.entries.keys()][0];
    }
  }

  private resolveAlias(alias: CoreAlias): CoreAlias {
    if (alias !== "") return alias;

    if (this.defaultAlias !== null) return this.defaultAlias;

    if (this.entries.size === 0) {
      throw new Error("No Cores configured. Set QSYS_CORES environment variable.");
    }

    throw new Error(
      `Multiple Cores configured — alias is required. Use one of: ${[...this.entries.keys()].join(", ")}`
    );
  }

  private getState(entry: CoreEntry): ConnectionState {
    if (entry.qrc.isConnected || entry.ecp.isConnected) return ConnectionState.Connected;
    return ConnectionState.Disconnected;
  }
}

export const connectionManager = new ConnectionManager();
