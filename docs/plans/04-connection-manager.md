# 04 — Connection Manager

**Goal:** Parse `QSYS_CORES` env (`alias=ip,...`), register `QrcClient` + `EcpClient` per Core, lazy or eager connect (pick one; document), health/reconnect policy.

**Architecture:** Single module owns all sockets; tools ask for `(coreAlias) -> clients` and never construct TCP themselves.

**Tech Stack:** Pure TS; no new runtime deps.

**Recommended Claude Code model:** `sonnet` (state machine and concurrency).

---

## Prerequisites

- [02-qrc-client.md](./02-qrc-client.md) and [03-ecp-client.md](./03-ecp-client.md) usable from unit-level or manual tests.

---

## Tasks

### Task 1: Config parsing

**Files:**
- Modify: `src/connection-manager.ts`, `src/types.ts`

- [ ] Parse `process.env.QSYS_CORES` into `Map<alias, { host, qrcPort?, ecpPort? }>`
- [ ] Validate duplicates and missing values; fail fast at startup with clear message

### Task 2: Lifecycle

- [ ] **Decision:** document lazy vs eager in `CLAUDE.md` and code
- [ ] `getClients(alias: string)` returns connected or connecting clients; throw if unknown alias
- [ ] Optional: `listCores()` with status enum: `disconnected` | `connecting` | `ready` | `error`

### Task 3: Single-Core optional alias

- [ ] If exactly one Core configured, allow default alias so tools can omit `core` (implement in tool layer in 05+)

### Task 4: Commit

```bash
git commit -m "feat(core): connection manager for multi-core QRC/ECP"
```

---

## Definition of done

- Two aliases can point to two IPs; status reflects disconnect/reconnect without crashing the process.
