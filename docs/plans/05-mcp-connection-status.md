# 05 — MCP Tools: Connection and Status

**Goal:** Implement `qsys_list_cores` and `qsys_core_status` per `plan.md`; wire MCP registration in `src/index.ts`.

**Architecture:** Tools call Connection Manager + QRC `StatusGet`; return JSON-serializable results.

**Recommended Claude Code model:** `haiku` (thin layer once 04 is solid).

---

## Prerequisites

- [04-connection-manager.md](./04-connection-manager.md) complete.

---

## Tasks

### Task 1: Tool definitions

**Files:**
- Modify: `src/tools/connection.ts`, `src/index.ts`

- [ ] Define tool schemas (zod or SDK-native schema) with `core` optional when single-core
- [ ] `qsys_list_cores`: aliases + status from manager
- [ ] `qsys_core_status`: QRC `StatusGet` mapped to stable field names

### Task 2: Error handling

- [ ] Unknown alias → clear MCP error content
- [ ] Core offline → structured error, not stack trace

### Task 3: Manual verification

- [ ] Run MCP inspector or Claude Desktop with env pointing at test Core

### Task 4: Commit

```bash
git commit -m "feat(mcp): list cores and core status tools"
```

---

## Definition of done

- From Claude, you can list configured Cores and read status for one.
