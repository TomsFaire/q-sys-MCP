/**
 * MCP Tools: Named Controls
 *
 * qsys_get_control  — get a single named control's value/position/string/legend
 * qsys_set_control  — set a named control by value or position
 * qsys_get_controls — batch-get multiple named controls in one call
 *
 * Protocol: QRC primary (Control.Get / Control.Set), ECP fallback for get/set
 * when QRC is unavailable. Fallback is automatic and silent; the response
 * includes a "via" note so callers can see which path was used.
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { connectionManager } from "../connection-manager.js";

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const getControlTool: Tool = {
  name: "qsys_get_control",
  description:
    "Get the current value, position (0–1), string label, and legend of a named " +
    "Q-Sys control. Named controls are set in Q-Sys Designer via the control's Name property.",
  inputSchema: {
    type: "object",
    properties: {
      core: {
        type: "string",
        description: "Core alias (omit if only one Core is configured).",
      },
      name: {
        type: "string",
        description: "Named control to read (e.g. 'MainPA.gain', 'LecternMic.mute').",
      },
    },
    required: ["name"],
  },
};

export const setControlTool: Tool = {
  name: "qsys_set_control",
  description:
    "Set a named Q-Sys control. Provide either 'value' (raw dB / integer / boolean) " +
    "or 'position' (normalized 0.0–1.0). Use position for relative adjustments, " +
    "value for absolute levels.",
  inputSchema: {
    type: "object",
    properties: {
      core: {
        type: "string",
        description: "Core alias (omit if only one Core is configured).",
      },
      name: {
        type: "string",
        description: "Named control to set.",
      },
      value: {
        type: "number",
        description: "Raw control value (dB for gains, 0/1 for mutes, etc.).",
      },
      position: {
        type: "number",
        description: "Normalized position 0.0–1.0.",
      },
    },
    required: ["name"],
  },
};

export const getControlsTool: Tool = {
  name: "qsys_get_controls",
  description:
    "Batch-get multiple named Q-Sys controls in a single round-trip. " +
    "More efficient than calling qsys_get_control repeatedly.",
  inputSchema: {
    type: "object",
    properties: {
      core: {
        type: "string",
        description: "Core alias (omit if only one Core is configured).",
      },
      names: {
        type: "array",
        items: { type: "string" },
        description: "List of named controls to read.",
      },
    },
    required: ["names"],
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ControlResult {
  name: string;
  value: number;
  position: number;
  string: string;
  legend?: string;
  via?: string;
}

function formatControl(c: ControlResult): string {
  const via = c.via ? ` [via ${c.via}]` : "";
  return (
    `${c.name}:${via}\n` +
    `  value:    ${c.value}\n` +
    `  position: ${c.position.toFixed(4)}\n` +
    `  string:   ${c.string}` +
    (c.legend ? `\n  legend:   ${c.legend}` : "")
  );
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleGetControl(params: Record<string, unknown>): Promise<string> {
  const alias = typeof params["core"] === "string" ? params["core"] : "";
  const name = params["name"] as string;
  if (!name) throw new Error("'name' is required");

  const { qrc, ecp } = await connectionManager.getClients(alias);

  if (qrc.isConnected) {
    const raw = (await qrc.call("Control.Get", { Name: name })) as Record<string, unknown>[];
    const c = Array.isArray(raw) ? raw[0] : (raw as Record<string, unknown>);
    return formatControl({
      name,
      value: (c["Value"] as number) ?? 0,
      position: (c["Position"] as number) ?? 0,
      string: (c["String"] as string) ?? "",
      legend: c["Legend"] as string | undefined,
      via: "QRC",
    });
  }

  // ECP fallback
  const ecpResult = await ecp.getControl(name);
  return formatControl({ name, ...ecpResult, via: "ECP" });
}

export async function handleSetControl(params: Record<string, unknown>): Promise<string> {
  const alias = typeof params["core"] === "string" ? params["core"] : "";
  const name = params["name"] as string;
  const value = params["value"] as number | undefined;
  const position = params["position"] as number | undefined;

  if (!name) throw new Error("'name' is required");
  if (value === undefined && position === undefined) {
    throw new Error("Provide either 'value' or 'position'");
  }
  if (position !== undefined && (position < 0 || position > 1)) {
    throw new Error(`'position' must be 0.0–1.0, got ${position}`);
  }

  const { qrc, ecp } = await connectionManager.getClients(alias);

  if (qrc.isConnected) {
    const payload =
      position !== undefined
        ? { Name: name, Position: position }
        : { Name: name, Value: value };
    await qrc.call("Control.Set", payload);
    const what = position !== undefined ? `position=${position}` : `value=${value}`;
    return `Set '${name}' → ${what} [via QRC]`;
  }

  // ECP fallback
  if (position !== undefined) {
    await ecp.setControlPosition(name, position);
    return `Set '${name}' → position=${position} [via ECP]`;
  }
  await ecp.setControlValue(name, value!);
  return `Set '${name}' → value=${value} [via ECP]`;
}

export async function handleGetControls(params: Record<string, unknown>): Promise<string> {
  const alias = typeof params["core"] === "string" ? params["core"] : "";
  const names = params["names"] as string[];

  if (!Array.isArray(names) || names.length === 0) {
    throw new Error("'names' must be a non-empty array");
  }

  const { qrc } = await connectionManager.getClients(alias);

  if (!qrc.isConnected) {
    throw new Error("QRC not connected — batch get requires QRC (ECP does not support batch)");
  }

  const results = (await qrc.call("Control.Get", names.map((n) => ({ Name: n })) as unknown as Record<string, unknown>)) as Record<string, unknown>[];

  if (!Array.isArray(results) || results.length === 0) {
    return "No results returned";
  }

  const lines = results.map((c, i) =>
    formatControl({
      name: names[i] ?? (c["Name"] as string) ?? `[${i}]`,
      value: (c["Value"] as number) ?? 0,
      position: (c["Position"] as number) ?? 0,
      string: (c["String"] as string) ?? "",
      legend: c["Legend"] as string | undefined,
      via: "QRC",
    })
  );

  return lines.join("\n\n");
}
