---
name: q-sys-mcp
description: >-
  Implements and operates the Q-Sys MCP server: QRC (port 1710) and ECP (port 1702)
  clients, multi-core Connection Manager, and thin MCP tools for Cores. Use when
  editing this repository, adding MCP tools, debugging TCP/protocol issues, or when
  the user mentions Q-Sys, QRC, ECP, Core, snapshots, or qsys_* tools.
---

# Q-Sys MCP project skill

## Project layout

- `src/index.ts` — MCP server entry (stdio), tool registration
- `src/connection-manager.ts` — parses `QSYS_CORES`, owns sockets
- `src/clients/qrc-client.ts` — JSON-RPC over TCP (1710)
- `src/clients/ecp-client.ts` — text protocol (1702)
- `src/tools/*.ts` — one file per concern (`connection`, `controls`, `components`, etc.)

## Protocol rules

- **QRC** is primary for rich operations (components, Lua, change groups).
- **ECP** is optional fallback for simple named-control and some snapshot operations; only use when QRC cannot or per product decision in `CLAUDE.md`.
- Do not duplicate TCP connection logic in tools — always go through Connection Manager.

## Adding or changing MCP tools

1. Implement against QRC/ECP clients, not raw sockets.
2. Name tools `qsys_<verb>_<noun>` consistently with existing tools.
3. Accept optional `core` when a single Core is configured; require `core` when multiple.
4. Return JSON-safe objects; surface Core errors in tool result text, not stack traces.

## Testing

- Prefer unit tests with mocked streams for framing parsers.
- Document manual steps for real Core or Q-Sys Designer when automation is not feasible.

## Plans and models

- Work is split under `docs/plans/`; read `docs/plans/00-index.md` for dependencies and recommended Claude Code model (`haiku` / `sonnet` / `opus`) per track.

## Do not

- Add Phase 2 `.qsys` file parsing unless the user explicitly expands scope (see `plan.md`).
- Broaden `qsys_run_lua` without an explicit security review.
