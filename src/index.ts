/**
 * Q-Sys MCP Server
 * Connects Claude to QSC Q-Sys Cores via QRC (JSON-RPC) and ECP (text protocol)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

/**
 * Initialize MCP server
 */
const server = new Server(
  {
    name: "q-sys-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Handle tool listing
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // TODO: Return actual tools from tools/* modules
  // For now, return empty list (scaffolding phase)
  return {
    tools: [] as Tool[],
  };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // TODO: Route to appropriate tool handler
  return {
    content: [
      {
        type: "text",
        text: `Tool '${request.params.name}' not yet implemented`,
      },
    ],
  };
});

/**
 * Start server
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Q-Sys MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
