# 02 — QRC Client (JSON-RPC, TCP 1710)

**Goal:** Reliable `QrcClient` class: connect, send JSON-RPC, match responses by `id`, handle null-delimited messages, basic reconnect.

**Architecture:** Single TCP connection per Core; outbound queue; parse incoming buffer into complete messages; expose typed helpers used later by Connection Manager.

**Tech Stack:** `node:net`, manual framing per `plan.md` (newline/null-terminated JSON — confirm against Q-Sys docs for your firmware).

**Recommended Claude Code model:** `sonnet` (async protocol correctness).

---

## Prerequisites

- [01-scaffolding.md](./01-scaffolding.md) complete.

## Dependencies

- Shared types in `src/types.ts` (extend as needed).

---

## Tasks

### Task 1: Connection and framing

**Files:**
- Modify: `src/clients/qrc-client.ts`, `src/types.ts`

- [ ] Implement TCP connect to configurable host/port (default 1710)
- [ ] Buffer incoming data; split on message boundaries per QRC spec (update `plan.md` if wire format differs from assumption)
- [ ] Parse JSON; ignore or queue non-matching `id` until corresponding response arrives

### Task 2: Request/response API

- [ ] `call(method: string, params: object): Promise<unknown>` assigning monotonic `id`
- [ ] Map JSON-RPC errors to thrown `Error` with code/message
- [ ] Timeout for hung requests

### Task 3: Reconnect

- [ ] On socket error/end: optional auto-reconnect with backoff (align options with 04-connection-manager)
- [ ] Document behavior in class JSDoc

### Task 4: Minimal integration test

- [ ] If no hardware: mock socket or document manual test with Designer/Core
- [ ] Commit: `feat(qrc): add JSON-RPC TCP client`

---

## Definition of done

- `StatusGet` can be called against a real Core and returns structured data (manual check acceptable for Phase 1).
