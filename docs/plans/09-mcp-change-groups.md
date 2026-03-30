# 09 — MCP Tools: Change Groups

**Goal:** `qsys_create_change_group`, `qsys_poll_change_group`, `qsys_destroy_change_group` via QRC.

**Architecture:** Thin mapping to QRC change-group methods; no ECP.

**Recommended Claude Code model:** `haiku`.

---

## Prerequisites

- [08-mcp-snapshots-lua.md](./08-mcp-snapshots-lua.md) or at least stable QRC access from 04.

---

## Tasks

### Task 1: Implement tools

**Files:**
- Modify: `src/tools/change-groups.ts`, `src/index.ts`

- [ ] Map methods from `plan.md` (`ChangeGroup.*`)
- [ ] Return polling results in stable JSON shape for Claude consumption

### Task 2: Commit

```bash
git commit -m "feat(mcp): change group tools"
```

---

## Definition of done

- Create group, add controls, poll changes, destroy — verified on a live design.
