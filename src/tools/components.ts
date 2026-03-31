/**
 * MCP Tools: Components
 *
 * qsys_list_components        — list all named components in the running design
 * qsys_get_component_controls — get all controls for a named component
 * qsys_set_component_controls — set one or more controls on a named component
 *
 * This is the primary workhorse for live DSP parameter control:
 * faders, mutes, EQ bands, compressor settings, matrix crosspoints, etc.
 * All operations use QRC (Component.*) — no ECP fallback for components.
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { connectionManager } from "../connection-manager.js";

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const listComponentsTool: Tool = {
  name: "qsys_list_components",
  description:
    "List all named components in the running Q-Sys design. Returns component names " +
    "and types (e.g. 'Mixer', 'Gain', 'EQ', 'Compressor', 'Router'). Use this to " +
    "discover what components are available before reading or changing their controls.",
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

export const getComponentControlsTool: Tool = {
  name: "qsys_get_component_controls",
  description:
    "Get all controls for a named component — fader positions, mute states, EQ bands, " +
    "compressor settings, matrix crosspoints, and more. Use qsys_list_components first " +
    "to find the component name.",
  inputSchema: {
    type: "object",
    properties: {
      core: {
        type: "string",
        description: "Core alias (omit if only one Core is configured).",
      },
      component: {
        type: "string",
        description: "Component name exactly as it appears in the Q-Sys design.",
      },
    },
    required: ["component"],
  },
};

export const setComponentControlsTool: Tool = {
  name: "qsys_set_component_controls",
  description:
    "Set one or more controls on a named Q-Sys component in a single call. " +
    "Use this to adjust live audio parameters: raise/lower faders, toggle mutes, " +
    "change EQ gain or frequency, adjust compressor threshold, route matrix outputs, etc. " +
    "Each control can be set by 'value' (raw) or 'position' (0.0–1.0 normalized).",
  inputSchema: {
    type: "object",
    properties: {
      core: {
        type: "string",
        description: "Core alias (omit if only one Core is configured).",
      },
      component: {
        type: "string",
        description: "Component name exactly as it appears in the Q-Sys design.",
      },
      controls: {
        type: "array",
        description: "List of controls to set.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Control name within the component (e.g. 'gain', 'mute', 'eq.gain.1').",
            },
            value: {
              type: "number",
              description: "Raw value (dB, boolean 0/1, frequency Hz, etc.).",
            },
            position: {
              type: "number",
              description: "Normalized position 0.0–1.0 (takes precedence over value if both given).",
            },
          },
          required: ["name"],
        },
      },
    },
    required: ["component", "controls"],
  },
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleListComponents(params: Record<string, unknown>): Promise<string> {
  const alias = typeof params["core"] === "string" ? params["core"] : "";
  const { qrc } = await connectionManager.getClients(alias);

  const result = (await qrc.call("Component.GetComponents")) as Record<string, unknown>[];

  if (!Array.isArray(result) || result.length === 0) {
    return "No named components found in the running design.";
  }

  const lines = result.map((c) => `• ${c["Name"] ?? "?"} (${c["Type"] ?? "unknown"})`);
  return `Components in running design (${result.length}):\n${lines.join("\n")}`;
}

export async function handleGetComponentControls(params: Record<string, unknown>): Promise<string> {
  const alias = typeof params["core"] === "string" ? params["core"] : "";
  const component = params["component"] as string;
  if (!component) throw new Error("'component' is required");

  const { qrc } = await connectionManager.getClients(alias);

  const raw = await qrc.call("Component.GetControls", { Name: component });
  const result = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : ((raw as { Controls?: Record<string, unknown>[] }).Controls ?? []);

  if (!Array.isArray(result) || result.length === 0) {
    return `No controls found for component '${component}'.`;
  }

  const lines = result.map((c) => {
    const value = c["Value"] !== undefined ? `value=${c["Value"]}` : "";
    const position = c["Position"] !== undefined ? `pos=${(c["Position"] as number).toFixed(3)}` : "";
    const str = c["String"] !== undefined ? `"${c["String"]}"` : "";
    const parts = [value, position, str].filter(Boolean).join("  ");
    return `  ${c["Name"]}: ${parts}`;
  });

  return `${component} controls (${result.length}):\n${lines.join("\n")}`;
}

export async function handleSetComponentControls(params: Record<string, unknown>): Promise<string> {
  const alias = typeof params["core"] === "string" ? params["core"] : "";
  const component = params["component"] as string;
  const controls = params["controls"] as Array<{ name: string; value?: number; position?: number }>;

  if (!component) throw new Error("'component' is required");
  if (!Array.isArray(controls) || controls.length === 0) {
    throw new Error("'controls' must be a non-empty array");
  }

  // Validate and build the controls payload
  const payload = controls.map((c, i) => {
    if (!c.name) throw new Error(`controls[${i}]: 'name' is required`);
    if (c.value === undefined && c.position === undefined) {
      throw new Error(`controls[${i}] ('${c.name}'): provide either 'value' or 'position'`);
    }
    if (c.position !== undefined && (c.position < 0 || c.position > 1)) {
      throw new Error(`controls[${i}] ('${c.name}'): position must be 0.0–1.0, got ${c.position}`);
    }
    return c.position !== undefined
      ? { Name: c.name, Position: c.position }
      : { Name: c.name, Value: c.value };
  });

  const { qrc } = await connectionManager.getClients(alias);
  await qrc.call("Component.Set", { Name: component, Controls: payload });

  const summary = controls.map((c) => {
    const what = c.position !== undefined ? `position=${c.position}` : `value=${c.value}`;
    return `  ${c.name} → ${what}`;
  });

  return `Set ${controls.length} control(s) on '${component}':\n${summary.join("\n")}`;
}
