# 03 — ECP Client (Text protocol, TCP 1702)

**Goal:** `EcpClient` for line-based commands (`cgc`, `cgs`, `css`, etc.) with connect/reconnect and response parsing.

**Architecture:** Mirror `QrcClient` lifecycle patterns so Connection Manager can treat both uniformly where possible.

**Tech Stack:** `node:net`, `\r\n` framing.

**Recommended Claude Code model:** `haiku` (straightforward text protocol).

---

## Prerequisites

- [01-scaffolding.md](./01-scaffolding.md) complete.

## Parallel note

- Implement in parallel with [02-qrc-client.md](./02-qrc-client.md); align only on naming and error shapes in `src/types.ts` via short coordination.

---

## Tasks

### Task 1: Protocol core

**Files:**
- Modify: `src/clients/ecp-client.ts`

- [ ] Connect to port 1702
- [ ] Send command + CRLF; read lines until response complete (per command semantics)
- [ ] Parse success/error into typed results

### Task 2: Command coverage for Phase 1

- [ ] Implement only what [06-mcp-controls.md](./06-mcp-controls.md) and snapshot ECP fallback need (see master `plan.md` tool table)
- [ ] Export small helper methods rather than raw strings everywhere

### Task 3: Reconnect

- [ ] Same backoff strategy as QRC or delegate to 04 — document which in code comments

### Task 4: Commit

```bash
git commit -m "feat(ecp): add ECP text client"
```

---

## Definition of done

- Named control get/set works against a Core or documented emulator path.
