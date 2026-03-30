/**
 * MCP Tools: Connection and Core Status
 *
 * qsys_list_cores  — list configured Cores and their connection state
 * qsys_core_status — call QRC StatusGet and return design/platform info
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { connectionManager } from "../connection-manager.js";

// ---------------------------------------------------------------------------
// Tool definitions (schema for Claude)
// ---------------------------------------------------------------------------

export const listCoresTool: Tool = {
  name: "qsys_list_cores",
  description:
    "List all configured Q-Sys Cores and their current connection status. " +
    "Use this to discover available Cores before targeting a specific one.",
  inputSchema: {
    type: "object",
    properties: {},
    required: [],
  },
};

export const coreStatusTool: Tool = {
  name: "qsys_core_status",
  description:
    "Get detailed status from a Q-Sys Core: design name, running state, platform, " +
    "redundancy, and emulator flag. Useful for verifying the Core is active before " +
    "making parameter changes.",
  inputSchema: {
    type: "object",
    properties: {
      core: {
        type: "string",
        description:
          "Core alias as configured in QSYS_CORES (e.g. 'sfo-allhands'). " +
          "Omit if only one Core is configured.",
      },
    },
    required: [],
  },
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleListCores(): Promise<string> {
  const cores = connectionManager.listCores();

  if (cores.length === 0) {
    return "No Cores configured. Set the QSYS_CORES environment variable.";
  }

  const lines = cores.map((c) => {
    const defaultTag = c.isDefault ? " (default)" : "";
    return `• ${c.alias}${defaultTag}: ${c.host} — ${c.state}`;
  });

  return `Configured Q-Sys Cores:\n${lines.join("\n")}`;
}

export async function handleCoreStatus(params: Record<string, unknown>): Promise<string> {
  const alias = typeof params["core"] === "string" ? params["core"] : "";

  const { qrc } = await connectionManager.getClients(alias);

  // QRC StatusGet — returns platform, state, design info
  const result = (await qrc.call("StatusGet")) as Record<string, unknown>;

  const resolvedAlias = alias || connectionManager.listCores().find((c) => c.isDefault)?.alias || "?";

  const lines = [
    `Core: ${resolvedAlias}`,
    `Platform: ${result["Platform"] ?? "unknown"}`,
    `Design: ${result["DesignName"] ?? "unknown"}`,
    `State: ${result["State"] ?? "unknown"}`,
    `Status: ${(result["Status"] as Record<string, unknown>)?.["String"] ?? "unknown"}`,
    `Redundant: ${result["IsRedundant"] ?? false}`,
    `Emulator: ${result["IsEmulator"] ?? false}`,
  ];

  return lines.join("\n");
}
