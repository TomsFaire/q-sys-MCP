/**
 * MCP Tools: Change Groups
 *
 * qsys_create_change_group — create a group and add named controls to watch
 * qsys_poll_change_group   — poll the group for controls that have changed
 * qsys_destroy_change_group — clean up the group when done
 *
 * Change groups allow efficient monitoring of multiple controls: instead of
 * calling qsys_get_control repeatedly, you register a group once and poll it —
 * the Core only returns controls whose values have changed since the last poll.
 *
 * QRC only — ECP does not support change groups.
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { connectionManager } from "../connection-manager.js";
import { config, debugLog } from "../config.js";

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const createChangeGroupTool: Tool = {
  name: "qsys_create_change_group",
  description:
    "Create a Q-Sys change group and register named controls to monitor. " +
    "More efficient than polling individual controls — use this when you need " +
    "to watch several controls for changes (e.g. all mic levels during a show). " +
    "Returns a group ID to use with qsys_poll_change_group and qsys_destroy_change_group.",
  inputSchema: {
    type: "object",
    properties: {
      core: {
        type: "string",
        description: "Core alias (omit if only one Core is configured).",
      },
      id: {
        type: "string",
        description: "Group ID string — choose any unique name (e.g. 'mic-monitor', 'faders').",
      },
      controls: {
        type: "array",
        items: { type: "string" },
        description: "Named controls to add to the group.",
      },
    },
    required: ["id", "controls"],
  },
};

export const pollChangeGroupTool: Tool = {
  name: "qsys_poll_change_group",
  description:
    "Poll a change group for controls that have changed since the last poll. " +
    "Returns only the controls whose values have changed — efficient for monitoring " +
    `live audio activity without reading every control each time. ` +
    `Recommended poll interval: ${config.pollingInterval}ms (configurable via QSYS_POLLING_INTERVAL).`,
  inputSchema: {
    type: "object",
    properties: {
      core: {
        type: "string",
        description: "Core alias (omit if only one Core is configured).",
      },
      id: {
        type: "string",
        description: "Group ID returned by qsys_create_change_group.",
      },
    },
    required: ["id"],
  },
};

export const destroyChangeGroupTool: Tool = {
  name: "qsys_destroy_change_group",
  description:
    "Destroy a change group and free its resources on the Core. " +
    "Always call this when you're done monitoring to avoid leaking resources.",
  inputSchema: {
    type: "object",
    properties: {
      core: {
        type: "string",
        description: "Core alias (omit if only one Core is configured).",
      },
      id: {
        type: "string",
        description: "Group ID to destroy.",
      },
    },
    required: ["id"],
  },
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function handleCreateChangeGroup(params: Record<string, unknown>): Promise<string> {
  const alias = typeof params["core"] === "string" ? params["core"] : "";
  const id = params["id"] as string;
  const controls = params["controls"] as string[];

  if (!id) throw new Error("'id' is required");
  if (!Array.isArray(controls) || controls.length === 0) {
    throw new Error("'controls' must be a non-empty array");
  }

  const { qrc } = await connectionManager.getClients(alias);

  // Create the group
  await qrc.call("ChangeGroup.AddControl", {
    Id: id,
    Controls: controls.map((name) => ({ Name: name })),
  });

  return `Created change group '${id}' with ${controls.length} control(s):\n${controls.map((c) => `  • ${c}`).join("\n")}`;
}

export async function handlePollChangeGroup(params: Record<string, unknown>): Promise<string> {
  const alias = typeof params["core"] === "string" ? params["core"] : "";
  const id = params["id"] as string;
  if (!id) throw new Error("'id' is required");

  const { qrc } = await connectionManager.getClients(alias);

  const result = (await qrc.call("ChangeGroup.Poll", { Id: id })) as Record<string, unknown>;

  const changes = result["Changes"] as Record<string, unknown>[] ?? [];

  if (changes.length === 0) {
    return `No changes in group '${id}' since last poll.`;
  }

  const lines = changes.map((c) => {
    const value = c["Value"] !== undefined ? `value=${c["Value"]}` : "";
    const position = c["Position"] !== undefined ? `pos=${(c["Position"] as number).toFixed(3)}` : "";
    const str = c["String"] !== undefined ? `"${c["String"]}"` : "";
    const parts = [value, position, str].filter(Boolean).join("  ");
    return `  ${c["Name"]}: ${parts}`;
  });

  return `Changed controls in group '${id}' (${changes.length}):\n${lines.join("\n")}`;
}

export async function handleDestroyChangeGroup(params: Record<string, unknown>): Promise<string> {
  const alias = typeof params["core"] === "string" ? params["core"] : "";
  const id = params["id"] as string;
  if (!id) throw new Error("'id' is required");

  const { qrc } = await connectionManager.getClients(alias);

  await qrc.call("ChangeGroup.Destroy", { Id: id });

  return `Destroyed change group '${id}'.`;
}
