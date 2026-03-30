# Q-Sys MCP Server

An MCP (Model Context Protocol) server that connects Claude to live QSC Q-Sys Cores, enabling real-time control of audio parameters, routing, snapshots, and Lua scripting — directly from Claude.

## What it does

- **Live audio control** — adjust fader levels, mutes, EQ, dynamics, panning, matrix crosspoints on running designs
- **Multi-Core support** — connect to multiple Q-Sys Cores simultaneously (SFO, NYC, Toronto, etc.)
- **Snapshot management** — list, load, and save snapshots
- **Component inspection** — list components and read/write their controls
- **Lua execution** — run scripts on the Core
- **Dual protocol** — QRC (JSON-RPC, port 1710) primary with ECP (text, port 1702) fallback

## Requirements

- Node.js 20+
- Q-Sys Designer 10.x Core(s) on the network
- [Claude Desktop](https://claude.ai/desktop) or any MCP-compatible host

## Installation

```bash
npm install
npm run build
```

## Configuration

Add to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "qsys": {
      "command": "node",
      "args": ["/path/to/q-sys-mcp/dist/index.js"],
      "env": {
        "QSYS_CORES": "sfo-allhands=10.1.1.100,nyc-display=10.2.1.100"
      }
    }
  }
}
```

### `QSYS_CORES` format

```
alias=host[:qrcPort[:ecpPort]], ...
```

Examples:
```
# Single Core (alias optional in tool calls)
QSYS_CORES=sfo=10.1.1.100

# Multiple Cores with default ports
QSYS_CORES=sfo=10.1.1.100,nyc=10.2.1.100,toronto=10.3.1.100

# Custom ports
QSYS_CORES=lab=192.168.1.50:1710:1702
```

## Available Tools

| Tool | Description |
|------|-------------|
| `qsys_list_cores` | List configured Cores and connection status |
| `qsys_core_status` | Get Core name, design, running state |
| `qsys_get_control` | Get a named control's value/position/string |
| `qsys_set_control` | Set a named control's value or position |
| `qsys_get_controls` | Batch-get multiple named controls |
| `qsys_list_components` | List all components in the running design |
| `qsys_get_component_controls` | Get all controls for a component |
| `qsys_set_component_controls` | Set one or more controls on a component |
| `qsys_list_snapshots` | List available snapshots |
| `qsys_load_snapshot` | Load/trigger a snapshot |
| `qsys_save_snapshot` | Save current state to a snapshot |
| `qsys_run_lua` | Execute Lua code on the Core |
| `qsys_create_change_group` | Create a change group for efficient polling |
| `qsys_poll_change_group` | Poll a change group for changed values |
| `qsys_destroy_change_group` | Clean up a change group |

> **Note:** Tools are being added incrementally. See [releases](../../releases) for current status.

## Example prompts

```
"Raise the main PA fader on sfo-allhands by 3dB"
"Mute all wireless mic channels on the NYC Core"
"Load the 'Pre-show' snapshot on sfo-allhands"
"What components are in the running design on the Toronto Core?"
"Set the EQ high-shelf on the lectern mic to +2dB at 10kHz"
```

## Architecture

```
Claude <-> MCP Server <-> ConnectionManager
                               |
                     +---------+---------+
                     |                   |
                QrcClient           EcpClient
               (JSON-RPC)         (Text Protocol)
               port 1710           port 1702
                     |                   |
                     +----> Q-Sys Core(s)
```

- All TCP connections are managed by `ConnectionManager` — tool code never opens sockets directly
- QRC is the primary protocol; ECP is used as fallback for simple get/set operations
- Connections are lazy: Cores connect on first tool call, not at server startup

## Development

```bash
npm run build    # compile TypeScript
npm run dev      # watch mode
node dist/index.js  # run server (stdio MCP)
```

## Security

`qsys_run_lua` executes arbitrary Lua on the Core. Treat network access as the trust boundary — only expose this server to trusted MCP clients.
