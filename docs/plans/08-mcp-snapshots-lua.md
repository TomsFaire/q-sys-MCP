# 08 — MCP Tools: Snapshots and Lua

**Goal:** `qsys_list_snapshots`, `qsys_load_snapshot`, `qsys_save_snapshot`, `qsys_run_lua` per `plan.md`.

**Architecture:** QRC-first; ECP fallback for snapshot load where applicable; Lua via `Lua.Execute`.

**Recommended Claude Code model:** `sonnet` for implementation; use **`opus`** for a dedicated pass if you add execution guardrails or auditing (privilege boundary).

---

## Prerequisites

- [06-mcp-controls.md](./06-mcp-controls.md) and [07-mcp-components.md](./07-mcp-components.md) complete or stable enough for merge.

---

## Tasks

### Task 1: Snapshots

**Files:**
- Modify: `src/tools/snapshots.ts`

- [ ] Implement list/load/save per QRC methods from `plan.md`
- [ ] Support both naming modes if required (bank/number vs name) — align with product decision

### Task 2: ECP snapshot fallback

- [ ] Only if still in scope; match decision from 06

### Task 3: Lua execution

**Files:**
- Modify: `src/tools/lua.ts`

- [ ] `qsys_run_lua`: send script, return stdout/stderr or structured result from Core
- [ ] Document security model: trusted network only; optional future allowlist out of Phase 1

### Task 4: Commit

```bash
git commit -m "feat(mcp): snapshots and Lua execution tools"
```

---

## Definition of done

- Load a snapshot and run a trivial Lua snippet that returns a known value.
