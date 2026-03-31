# Q-Sys MCP Server

MCP server for controlling QSC Q-Sys Cores from Claude or Cursor. Supports live audio control, snapshot management, component inspection, and Lua scripting over QRC and ECP.

Also see: [Q-SYS-MCP-WEBUI](https://github.com/TomsFaire/Q-SYS-MCP-WEBUI) - browser UI for the same cores.

## What it does

- Adjust faders, mutes, EQ, dynamics, matrix crosspoints on running designs
- Connect to multiple Cores at once
- List, load, and save snapshots
- Read and write component controls
- Run Lua scripts on the Core
- QRC (JSON-RPC, port 1710) with ECP (text, port 1702) as fallback

## Requirements

- Node.js 20+
- Q-Sys Designer 10.x Core on the network
- [Claude Desktop](https://claude.ai/desktop) or any MCP-compatible host

## Q-Sys Designer setup

### Script Access (required for component tools)

Components are only visible to the MCP if they have Script Access enabled in Q-Sys Designer. Without it, `qsys_list_components` returns nothing even if the Core is reachable.

1. Open your design in Q-Sys Designer
2. Select the blocks you want to control (Ctrl+A for all)
3. In the Properties panel, set Script Access to External (or All)
4. Save and push the design

### Named Controls (optional)

Named Controls in Q-Sys Designer's External Controls pane are not required if you're using Script Access. They're useful if you want short aliases for specific controls or need ECP-based integrations.

## Installation

```bash
npm install
npm run build
```

## Configuration

Add to your `claude_desktop_config.json` (Claude Desktop) or `.cursor/mcp.json` (Cursor):

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

### QSYS_CORES format

```
alias=host[:qrcPort[:ecpPort[:wsPort]]], ...
```

Omit port segments to use defaults (TCP QRC: 1710, ECP: 1702). Adding a `wsPort` switches that Core to WebSocket QRC (QRWC).

```bash
# Single Core, TCP QRC
QSYS_CORES=sfo=10.1.1.100

# Multiple Cores
QSYS_CORES=sfo=10.1.1.100,nyc=10.2.1.100,toronto=10.3.1.100

# WebSocket QRC on port 443
QSYS_CORES=sfo=10.1.1.100:::443

# Custom ports
QSYS_CORES=lab=192.168.1.50:1710:1702
```

### TCP QRC vs WebSocket QRC

| | TCP QRC | WebSocket QRC |
|---|---|---|
| Port | 1710 | 443 (default) |
| Protocol | JSON-RPC over TCP | JSON-RPC over wss:// |
| qsys_list_components | All components | Script Access components only |
| qsys_run_lua | Yes | No |
| Cert | n/a | Self-signed (accepted automatically) |

WebSocket mode requires WebSocket capability enabled in Core Manager under Network > Services.

## Tools

| Tool | Description |
|------|-------------|
| `qsys_list_cores` | List configured Cores and connection status |
| `qsys_core_status` | Get Core name, design, running state |
| `qsys_get_control` | Get a named control value |
| `qsys_set_control` | Set a named control value |
| `qsys_get_controls` | Get multiple named controls at once |
| `qsys_list_components` | List all components in the running design |
| `qsys_get_component_controls` | Get all controls for a component |
| `qsys_set_component_controls` | Set one or more controls on a component |
| `qsys_list_snapshots` | List available snapshots |
| `qsys_load_snapshot` | Load a snapshot |
| `qsys_save_snapshot` | Save current state to a snapshot |
| `qsys_run_lua` | Run Lua code on the Core |
| `qsys_create_change_group` | Create a change group for polling |
| `qsys_poll_change_group` | Poll a change group for updated values |
| `qsys_destroy_change_group` | Clean up a change group |

## Example prompts

```
"Raise the main PA fader on sfo-allhands by 3dB"
"Mute all wireless mic channels on the NYC Core"
"Load the Pre-show snapshot on sfo-allhands"
"What components are in the running design on the Toronto Core?"
"Set the EQ high-shelf on the lectern mic to +2dB at 10kHz"
```

## Architecture

```
Claude <-> MCP Server <-> ConnectionManager
                               |
                     +---------+-----------+
                     |                     |
              QrcClient / WsQrcClient   EcpClient
              (JSON-RPC, TCP 1710        (Text Protocol
               or wss:// port 443)        TCP 1702)
                     |                     |
                     +-----> Q-Sys Core(s)
```

Connections are lazy - Cores connect on first tool call, not at startup. All socket management goes through `ConnectionManager`; tool code never opens sockets directly.

## Development

```bash
npm run build       # compile TypeScript
npm run dev         # watch mode
node dist/index.js  # run the server
```

## Security

`qsys_run_lua` runs arbitrary Lua on the Core. Only expose this server to trusted MCP clients. Note that Lua execution requires TCP QRC (port 1710) and is not available over WebSocket QRC.
