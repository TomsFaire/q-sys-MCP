# Q-Sys MCP Server — Design & Implementation Plan

> **Parallel work breakdown:** See [`docs/plans/00-index.md`](docs/plans/00-index.md) for dependency waves, assignable tracks, and **recommended Claude Code model** (`haiku` / `sonnet` / `opus`) per track.

## Overview

An MCP (Model Context Protocol) server that connects Claude to live QSC Q-Sys Cores, enabling real-time control of audio parameters, component status monitoring, snapshot management, and Lua script execution. Built in TypeScript on Node.js.

## Phasing

- **Phase 1 (this plan):** Runtime control of live Cores via QRC and ECP protocols
- **Phase 2 (future):** Offline `.qsys` design file parsing and design modification/push

---

## Architecture: Thin Pass-Through

MCP tools map closely to QRC/ECP commands. The server is a relay — it validates input, manages connections, and translates between MCP tool calls and Q-Sys protocol messages. Claude handles the intelligence layer (knowing which controls to adjust, chaining operations, etc.).

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

### Core Modules

| Module | Responsibility |
|---|---|
| `QrcClient` | TCP connection, JSON-RPC framing, send/receive for QRC (port 1710) |
| `EcpClient` | TCP connection, text protocol framing for ECP (port 1702) |
| `ConnectionManager` | Named Core registry, connection lifecycle, health checks |
| `MCP Tools` | Thin wrappers — validate input, pick client, relay command, return result |

---

## Multi-Core Connection Management

Users provide Core IPs and aliases via MCP configuration. No auto-discovery.

### Configuration Format (in Claude MCP settings)

```json
{
  "mcpServers": {
    "qsys": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "QSYS_CORES": "sfo-allhands=10.1.1.100,nyc-display=10.2.1.100,tor-allhands=10.3.1.100"
      }
    }
  }
}
```

### Connection Behavior

- Connections are established lazily on first use (or eagerly on startup — TBD)
- Auto-reconnect on disconnect with backoff
- All tools accept a `core` parameter (alias) to target a specific Core
- If only one Core is configured, `core` parameter is optional

---

## Phase 1 MCP Tools

### Connection & Status

| Tool | Description | Protocol |
|---|---|---|
| `qsys_list_cores` | List all configured Cores and connection status | Internal |
| `qsys_core_status` | Get Core status (name, design name, running state, platform, uptime) | QRC |

### Named Controls

| Tool | Description | Protocol |
|---|---|---|
| `qsys_get_control` | Get a named control's value, string, position, and legend | QRC primary, ECP fallback |
| `qsys_set_control` | Set a named control's value (by value or position 0-1) | QRC primary, ECP fallback |
| `qsys_get_controls` | Get multiple named controls in one call | QRC |

### Components

| Tool | Description | Protocol |
|---|---|---|
| `qsys_list_components` | List all components in the running design (name, type) | QRC |
| `qsys_get_component_controls` | Get all controls for a named component | QRC |
| `qsys_set_component_controls` | Set one or more controls on a named component | QRC |

### Audio-Specific Live Parameters

These are all accessed through the component control tools above, but here's what Claude can control on a running design:

- **Gain/Level** — fader positions, input/output gain, trim
- **Mute** — channel mutes, bus mutes, output mutes
- **EQ** — parametric EQ bands (frequency, gain, Q, type) on any EQ component
- **Dynamics** — compressor threshold, ratio, attack, release, makeup gain
- **Panning** — pan position on mixer channels
- **Matrix crosspoints** — enable/disable and set levels on matrix mixer crosspoints (router control for live sends)
- **Delays** — delay time on delay components
- **Signal generators** — test tone frequency, level

All of these are runtime parameter changes on the existing design — no design file modification required.

### Snapshots

| Tool | Description | Protocol |
|---|---|---|
| `qsys_list_snapshots` | List all snapshots in the running design | QRC |
| `qsys_load_snapshot` | Trigger a snapshot by name or bank/number | QRC, ECP fallback |
| `qsys_save_snapshot` | Save current state to a snapshot | QRC |

### Lua Scripting

| Tool | Description | Protocol |
|---|---|---|
| `qsys_run_lua` | Execute Lua code on the Core and return output | QRC |

### Change Groups

| Tool | Description | Protocol |
|---|---|---|
| `qsys_create_change_group` | Create a change group and add controls to it | QRC |
| `qsys_poll_change_group` | Poll a change group for changed values | QRC |
| `qsys_destroy_change_group` | Clean up a change group | QRC |

---

## Protocol Details

### QRC (JSON-RPC over TCP, port 1710)

- Newline-delimited JSON (`\0` null byte terminated)
- Request format: `{"jsonrpc":"2.0","id":<id>,"method":"<method>","params":{...}}`
- Methods we'll use:
  - `StatusGet`
  - `Control.Get`, `Control.Set`
  - `Component.GetComponents`
  - `Component.GetControls`, `Component.Set`
  - `Snapshot.Load`, `Snapshot.Save`, `Snapshot.GetAll` (if available)
  - `ChangeGroup.AddControl`, `ChangeGroup.Poll`, `ChangeGroup.Remove`, `ChangeGroup.Destroy`
  - `Lua.Execute` (sends Lua code to the scripting engine)
- Responses are async — match by `id`
- Unsolicited messages possible (change notifications)

### ECP (Text Protocol, port 1702)

- Line-based text protocol (`\r\n` terminated)
- Commands: `cgc`, `cgs`, `css`, `cgsna`, `ct`, `sg`, `sl`, `ssa`
- Simpler but limited — named controls and snapshots only
- Used as fallback when QRC is unavailable or for simple get/set operations

---

## Project Structure

```
Q-sys-MCP/
├── src/
│   ├── index.ts              # MCP server entry point
│   ├── connection-manager.ts # Named Core registry & lifecycle
│   ├── clients/
│   │   ├── qrc-client.ts     # QRC JSON-RPC TCP client
│   │   └── ecp-client.ts     # ECP text TCP client
│   ├── tools/
│   │   ├── connection.ts     # list_cores, core_status
│   │   ├── controls.ts       # get/set named controls
│   │   ├── components.ts     # list/get/set component controls
│   │   ├── snapshots.ts      # list/load/save snapshots
│   │   ├── lua.ts            # run Lua scripts
│   │   └── change-groups.ts  # change group management
│   └── types.ts              # Shared types & interfaces
├── package.json
├── tsconfig.json
└── plan.md
```

---

## Implementation Order

### Step 1: Project Scaffolding
- Initialize npm project with TypeScript
- Install dependencies: `@modelcontextprotocol/sdk`, `typescript`
- Set up tsconfig, build scripts

### Step 2: QRC Client
- TCP connection with auto-reconnect
- JSON-RPC message framing (null-byte delimited)
- Request/response matching by ID
- Basic error handling

### Step 3: ECP Client
- TCP connection with auto-reconnect
- Text protocol line framing
- Command/response parsing

### Step 4: Connection Manager
- Parse `QSYS_CORES` env var
- Manage named connections (lazy or eager)
- Health check / reconnect logic
- Core selection by alias

### Step 5: MCP Server + Connection Tools
- Initialize MCP server with `@modelcontextprotocol/sdk`
- Implement `qsys_list_cores` and `qsys_core_status`
- Test with Claude

### Step 6: Control Tools
- `qsys_get_control`, `qsys_set_control`, `qsys_get_controls`
- QRC primary path, ECP fallback
- Test against live Core and/or Designer emulator

### Step 7: Component Tools
- `qsys_list_components`, `qsys_get_component_controls`, `qsys_set_component_controls`
- This is the main workhorse for audio parameter control

### Step 8: Snapshot & Lua Tools
- Snapshot list/load/save
- Lua script execution
- Test with real snapshots and scripts

### Step 9: Change Group Tools
- Create/poll/destroy change groups
- Useful for efficient monitoring of multiple controls

### Step 10: Testing & Hardening
- Test against Designer emulator
- Test against live Core(s)
- Handle edge cases: disconnects, invalid component names, concurrent requests
- Add logging for debugging

---

## Phase 2 (Future — Not In Scope)

- Parse `.qsys` design files (compressed .NET binary serialization)
- Read-only inspection: list components, routing, DSP chain, UCI pages
- Design modification: add/remove/rewire components
- Push modified designs to Cores
- Offline diff between design files

---

## Dependencies

- `@modelcontextprotocol/sdk` — MCP server framework
- `typescript` — language
- `node:net` — TCP sockets (built-in, no external dep)

Intentionally minimal dependency footprint.

---

## Open Questions

1. **Lazy vs eager connections** — Should Cores connect on startup or on first tool call? Lazy is simpler; eager gives faster first response and immediate feedback if a Core is unreachable.
2. **ECP fallback behavior** — Should fallback be automatic and silent, or should Claude be told when it's using the fallback protocol?
3. **Snapshot naming** — Q-Sys supports bank/number and named snapshots. Do we need both addressing modes?
4. **Lua security** — `qsys_run_lua` is powerful. Any guardrails needed, or is network-level trust sufficient?
