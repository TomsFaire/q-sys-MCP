/**
 * MCP Tools: Snapshots and Lua
 *
 * qsys_list_snapshots — list snapshots available in the running design
 * qsys_load_snapshot  — trigger a snapshot by name or bank/number
 * qsys_save_snapshot  — save current state to a snapshot
 * qsys_run_lua        — execute Lua code on the Core
 *
 * Snapshots: QRC primary, ECP fallback for load (ECP supports ssl/ssa commands).
 * Lua: QRC only (Lua.Execute method).
 *
 * Security note: qsys_run_lua executes arbitrary code on the Core.
 * Trust boundary is network access — only expose to trusted MCP clients.
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { connectionManager } from "../connection-manager.js";

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const listSnapshotsTool: Tool = {
  name: "qsys_list_snapshots",
  description:
    "List all snapshots available in the running Q-Sys design. " +
    "Returns snapshot names and bank/number references.",
  inputSchema: {
    type: "object",
    properties: {
      core: {
        type: "string",
        description: "Core alias (omit if only one Core is configured).",
      },
    },
    required: [],
  },
};

export const loadSnapshotTool: Tool = {
  name: "qsys_load_snapshot",
  description:
    "Load (trigger) a Q-Sys snapshot by name or by bank and number. " +
    "Snapshots recall a saved set of control values — useful for scene changes, " +
    "switching between presenters, or resetting a room to a known state.",
  inputSchema: {
    type: "object",
    properties: {
      core: {
        type: "string",
        description: "Core alias (omit if only one Core is configured).",
      },
      name: {
        type: "string",
        description: "Snapshot name (use this OR bank+number, not both).",
      },
      bank: {
        type: "number",
        description: "Snapshot bank number (use with 'number').",
      },
      number: {
        type: "number",
        description: "Snapshot number within the bank (use with 'bank').",
      },
    },
    required: [],
  },
};

export const saveSnapshotTool: Tool = {
  name: "qsys_save_snapshot",
  description:
    "Save the current state of controls to a Q-Sys snapshot by name or bank/number. " +
    "Overwrites the existing snapshot with the current live values.",
  inputSchema: {
    type: "object",
    properties: {
      core: {
        type: "string",
        description: "Core alias (omit if only one Core is configured).",
      },
      name: {
        type: "string",
        description: "Snapshot name (use this OR bank+number, not both).",
      },
      bank: {
        type: "number",
        description: "Snapshot bank number (use with 'number').",
      },
      number: {
        type: "number",
        description: "Snapshot number within the bank (use with 'bank').",
      },
    },
    required: [],
  },
};

export const runLuaTool: Tool = {
  name: "qsys_run_lua",
  description:
    "Execute a Lua script on the Q-Sys Core and return any output. " +
    "Useful for complex operations, reading system state, or automating tasks " +
    "that aren't exposed as named controls. " +
    "WARNING: Executes arbitrary code on the Core — use with care.",
  inputSchema: {
    type: "object",
    properties: {
      core: {
        type: "string",
        description: "Core alias (omit if only one Core is configured).",
      },
      code: {
        type: "string",
        description: "Lua code to execute on the Core.",
      },
    },
    required: ["code"],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveSnapshotTarget(params: Record<string, unknown>): {
  name?: string;
  bank?: number;
  number?: number;
} {
  const name = typeof params["name"] === "string" ? params["name"] : undefined;
  const bank = typeof params["bank"] === "number" ? params["bank"] : undefined;
  const number = typeof params["number"] === "number" ? params["number"] : undefined;

  if (!name && (bank === undefined || number === undefined)) {
    throw new Error("Provide either 'name' or both 'bank' and 'number'");
  }
  return { name, bank, number };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleListSnapshots(params: Record<string, unknown>): Promise<string> {
  const alias = typeof params["core"] === "string" ? params["core"] : "";
  const { qrc } = await connectionManager.getClients(alias);

  // Q-Sys QRC: SnapshotBank.GetAll returns banks with snapshots
  // Falls back to a Lua query if not available on older firmware
  let result: unknown;
  try {
    result = await qrc.call("SnapshotBank.GetAll");
  } catch {
    // Older firmware may not support SnapshotBank.GetAll — try Lua
    result = await qrc.call("Lua.Execute", {
      code: [
        "local out = {}",
        "for bank = 1, 10 do",
        "  for num = 1, 10 do",
        "    local ok, name = pcall(Snapshot.GetName, bank, num)",
        "    if ok and name and name ~= '' then",
        "      table.insert(out, bank .. '/' .. num .. ': ' .. name)",
        "    end",
        "  end",
        "end",
        "return table.concat(out, '\\n')",
      ].join("\n"),
    });
    const luaResult = result as Record<string, unknown>;
    const output = luaResult["result"] as string ?? "";
    return output.trim()
      ? `Snapshots (via Lua):\n${output}`
      : "No snapshots found (Lua query)";
  }

  const banks = result as Record<string, unknown>[];
  if (!Array.isArray(banks) || banks.length === 0) {
    return "No snapshot banks found in the running design.";
  }

  const lines: string[] = [];
  for (const bank of banks) {
    const bankNum = bank["Bank"];
    const snapshots = bank["Snapshots"] as Record<string, unknown>[] ?? [];
    for (const snap of snapshots) {
      lines.push(`  Bank ${bankNum}, #${snap["Number"]}: ${snap["Name"] ?? "(unnamed)"}`);
    }
  }

  return lines.length > 0
    ? `Snapshots (${lines.length}):\n${lines.join("\n")}`
    : "No snapshots found.";
}

export async function handleLoadSnapshot(params: Record<string, unknown>): Promise<string> {
  const alias = typeof params["core"] === "string" ? params["core"] : "";
  const target = resolveSnapshotTarget(params);
  const { qrc, ecp } = await connectionManager.getClients(alias);

  if (qrc.isConnected) {
    if (target.name) {
      await qrc.call("Snapshot.Load", { Name: target.name });
      return `Loaded snapshot '${target.name}' [via QRC]`;
    } else {
      await qrc.call("Snapshot.Load", { Bank: target.bank, Number: target.number });
      return `Loaded snapshot bank=${target.bank} #${target.number} [via QRC]`;
    }
  }

  // ECP fallback
  await ecp.loadSnapshot(
    target.name ?? { bank: target.bank!, number: target.number! }
  );
  const ref = target.name ?? `bank=${target.bank} #${target.number}`;
  return `Loaded snapshot ${ref} [via ECP]`;
}

export async function handleSaveSnapshot(params: Record<string, unknown>): Promise<string> {
  const alias = typeof params["core"] === "string" ? params["core"] : "";
  const target = resolveSnapshotTarget(params);
  const { qrc } = await connectionManager.getClients(alias);

  if (target.name) {
    await qrc.call("Snapshot.Save", { Name: target.name });
    return `Saved snapshot '${target.name}'`;
  } else {
    await qrc.call("Snapshot.Save", { Bank: target.bank, Number: target.number });
    return `Saved snapshot bank=${target.bank} #${target.number}`;
  }
}

export async function handleRunLua(params: Record<string, unknown>): Promise<string> {
  const alias = typeof params["core"] === "string" ? params["core"] : "";
  const code = params["code"] as string;
  if (!code?.trim()) throw new Error("'code' is required");

  const { qrc } = await connectionManager.getClients(alias);

  let raw: Record<string, unknown>;
  try {
    raw = (await qrc.call("Lua.Execute", { code })) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isUnsupported = message.includes("-32601") || /method not found/i.test(message);

    if (!isUnsupported) throw err;

    // QRWC doesn't support Lua.Execute — attempt TCP QRC fallback (local network only)
    const tcpQrc = await connectionManager.getTcpQrcFallback(alias).catch(() => null);
    if (!tcpQrc) {
      throw new Error(
        "Lua.Execute is not supported over WebSocket (QRWC) and TCP QRC (port 1710) " +
        "is unreachable — this feature requires local network access."
      );
    }
    raw = (await tcpQrc.call("Lua.Execute", { code })) as Record<string, unknown>;
  }

  const output = raw["result"] ?? raw["output"] ?? raw;
  if (output === undefined || output === null) return "(no output)";
  return typeof output === "string" ? output : JSON.stringify(output, null, 2);
}
