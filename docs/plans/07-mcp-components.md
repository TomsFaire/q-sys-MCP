# 07 — MCP Tools: Components

**Goal:** `qsys_list_components`, `qsys_get_component_controls`, `qsys_set_component_controls` via QRC per `plan.md`.

**Architecture:** Primary “workhorse” for DSP parameters; keep responses bounded (pagination or max controls) if needed for large components.

**Recommended Claude Code model:** `sonnet` (payload size and UX).

---

## Prerequisites

- [05-mcp-connection-status.md](./05-mcp-connection-status.md) complete.
- QRC client supports `Component.GetComponents`, `Component.GetControls`, `Component.Set`.

---

## Tasks

### Task 1: List components

**Files:**
- Modify: `src/tools/components.ts`

- [ ] Return name + type (and any fields operators need from your environment)

### Task 2: Get/set controls

- [ ] Batch get where API allows; document limits
- [ ] Set: accept list of `{ controlName, value | position }` with validation

### Task 3: Commit

```bash
git commit -m "feat(mcp): component list and control tools"
```

---

## Definition of done

- Adjust EQ/dynamics/mixer parameters through component tools on a live Core.
