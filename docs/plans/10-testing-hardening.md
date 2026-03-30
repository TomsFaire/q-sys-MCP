# 10 — Testing and Hardening

**Goal:** Integration coverage, disconnect/reconnect behavior, invalid inputs, logging, and documentation for operators.

**Architecture:** Prefer automated tests where possible without hardware (mocks); document manual Core/Designer checklist.

**Recommended Claude Code model:** `sonnet` (integration debugging); **`opus`** if chasing rare race conditions.

---

## Prerequisites

- Plans [05](./05-mcp-connection-status.md)–[09](./09-mcp-change-groups.md) implemented.

---

## Tasks

### Task 1: Automated tests

**Files:**
- Create: `tests/` as needed (vitest/jest/node:test — match 01 scaffolding choice)

- [ ] Mock TCP for QRC/ECP framing unit tests
- [ ] Connection manager: config parsing, alias resolution

### Task 2: Manual checklist

- [ ] Document in `README.md` or `docs/`: Designer vs hardware, required ports, example `QSYS_CORES`

### Task 3: Hardening

- [ ] Concurrent tool calls do not corrupt single socket state
- [ ] Logging: levels, no secrets in logs
- [ ] Graceful shutdown on SIGINT

### Task 4: Commit

```bash
git commit -m "test: integration tests and hardening for Q-sys MCP"
```

---

## Definition of done

- CI runs unit tests; README allows a new developer to connect one Core and exercise every tool class.
