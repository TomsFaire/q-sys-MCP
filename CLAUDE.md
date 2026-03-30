# Q-Sys MCP (Claude Code)

## What this is

TypeScript MCP server that talks to QSC Q-Sys **Cores** on the network over **QRC** (TCP 1710, JSON-RPC) and **ECP** (TCP 1702, text). Claude uses MCP tools; this repo is a thin relay — no DSP “intelligence” here.

## Where to read first

- Architecture and tool list: [`plan.md`](./plan.md)
- Parallel tracks, dependencies, and **which model to use per track**: [`docs/plans/00-index.md`](./docs/plans/00-index.md)

## Commands

- Build: `npm run build`
- Run (after build): `node dist/index.js` (stdio MCP)
- Tests: follow `package.json` once test runner is added in scaffolding

## Configuration

- Cores are configured via env `QSYS_CORES` as comma-separated `alias=host[:qrcPort[:ecpPort]]` pairs:
  ```
  QSYS_CORES=sfo-allhands=10.1.1.100,nyc-display=10.2.1.100
  ```
- **Connection policy: LAZY** — clients connect on first tool call, not at startup. Offline Cores at boot are non-fatal; they will be retried on first use.
- If exactly one Core is configured, the `core` parameter on all tools is optional.

## Conventions

- Tools are named `qsys_*` and live under `src/tools/`.
- TCP clients live in `src/clients/`; nothing outside Connection Manager should open sockets.
- When QRC and ECP disagree, follow the decision recorded for ECP fallback (plans 04 + 06).

## Security

- `qsys_run_lua` is powerful; treat the network as a trust boundary. Stricter guardrails are out of band unless explicitly added.

## Model usage (token efficiency)

Start a Claude Code session with `/model <alias>` to match the plan you are implementing:

| Work type | Model alias |
|-----------|-------------|
| Scaffolding, repetitive tools, ECP-only work | `haiku` |
| Protocol clients, Connection Manager, most MCP tools | `sonnet` |
| Ambiguous failures, Lua/security review | `opus` |

Details: [`docs/plans/00-index.md`](./docs/plans/00-index.md).
