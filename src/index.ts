/**
 * Q-Sys MCP Server
 * Connects Claude to QSC Q-Sys Cores via QRC (JSON-RPC) and ECP (text protocol)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  listCoresTool,
  coreStatusTool,
  handleListCores,
  handleCoreStatus,
} from "./tools/connection.js";

import {
  getControlTool,
  setControlTool,
  getControlsTool,
  handleGetControl,
  handleSetControl,
  handleGetControls,
} from "./tools/controls.js";

import {
  listComponentsTool,
  getComponentControlsTool,
  setComponentControlsTool,
  handleListComponents,
  handleGetComponentControls,
  handleSetComponentControls,
} from "./tools/components.js";

import {
  listSnapshotsTool,
  loadSnapshotTool,
  saveSnapshotTool,
  runLuaTool,
  handleListSnapshots,
  handleLoadSnapshot,
  handleSaveSnapshot,
  handleRunLua,
} from "./tools/snapshots.js";

import {
  createChangeGroupTool,
  pollChangeGroupTool,
  destroyChangeGroupTool,
  handleCreateChangeGroup,
  handlePollChangeGroup,
  handleDestroyChangeGroup,
} from "./tools/change-groups.js";

// ---------------------------------------------------------------------------
// Tool registry — add new tools here as waves are implemented
// ---------------------------------------------------------------------------

const TOOLS = [
  // Connection & status
  listCoresTool,
  coreStatusTool,
  // Named controls
  getControlTool,
  setControlTool,
  getControlsTool,
  // Components
  listComponentsTool,
  getComponentControlsTool,
  setComponentControlsTool,
  // Snapshots & Lua
  listSnapshotsTool,
  loadSnapshotTool,
  saveSnapshotTool,
  runLuaTool,
  // Change groups
  createChangeGroupTool,
  pollChangeGroupTool,
  destroyChangeGroupTool,
];

type ToolHandler = (params: Record<string, unknown>) => Promise<string>;

const HANDLERS: Record<string, ToolHandler> = {
  // Connection & status
  qsys_list_cores: () => handleListCores(),
  qsys_core_status: (params) => handleCoreStatus(params),
  // Named controls
  qsys_get_control: (params) => handleGetControl(params),
  qsys_set_control: (params) => handleSetControl(params),
  qsys_get_controls: (params) => handleGetControls(params),
  // Components
  qsys_list_components: (params) => handleListComponents(params),
  qsys_get_component_controls: (params) => handleGetComponentControls(params),
  qsys_set_component_controls: (params) => handleSetComponentControls(params),
  // Snapshots & Lua
  qsys_list_snapshots: (params) => handleListSnapshots(params),
  qsys_load_snapshot: (params) => handleLoadSnapshot(params),
  qsys_save_snapshot: (params) => handleSaveSnapshot(params),
  qsys_run_lua: (params) => handleRunLua(params),
  // Change groups
  qsys_create_change_group: (params) => handleCreateChangeGroup(params),
  qsys_poll_change_group: (params) => handlePollChangeGroup(params),
  qsys_destroy_change_group: (params) => handleDestroyChangeGroup(params),
};

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "q-sys-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;
  const params = args as Record<string, unknown>;

  const handler = HANDLERS[name];
  if (!handler) {
    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const text = await handler(params);
    return { content: [{ type: "text", text }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[q-sys-mcp] Server running on stdio");

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.error("[q-sys-mcp] Shutting down...");
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
