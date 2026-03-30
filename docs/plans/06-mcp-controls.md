# 06 — MCP Tools: Named Controls

**Goal:** `qsys_get_control`, `qsys_set_control`, `qsys_get_controls` with QRC primary and ECP fallback per `plan.md`.

**Architecture:** Shared small internal helper to choose protocol; optionally include `protocolUsed` in result if you adopt “visible fallback” from open questions.

**Recommended Claude Code model:** `sonnet` (fallback semantics and validation).

---

## Prerequisites

- [05-mcp-connection-status.md](./05-mcp-connection-status.md) complete (patterns for tool registration).
- [02](./02-qrc-client.md) + [03](./03-ecp-client.md) + [04](./04-connection-manager.md) complete.

---

## Tasks

### Task 1: QRC path

**Files:**
- Modify: `src/tools/controls.ts`

- [ ] Map to `Control.Get` / `Control.Set` / batch get per QRC API
- [ ] Normalize value, string, position, legend in tool output

### Task 2: ECP fallback

- [ ] **Decision:** auto-fallback vs explicit — implement chosen behavior from `CLAUDE.md`
- [ ] Only use ECP for operations it supports

### Task 3: Input validation

- [ ] Reject NaN, out-of-range positions; clear error messages

### Task 4: Commit

```bash
git commit -m "feat(mcp): named control get/set tools"
```

---

## Definition of done

- Live adjustment of a fader/mute via tool calls against a running design.
