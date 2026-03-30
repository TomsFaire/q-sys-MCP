# 01 — Project Scaffolding

> **For agentic workers:** Implement task-by-task; use checkboxes for tracking.

**Goal:** TypeScript Node project with MCP SDK wired, build scripts, and empty module stubs matching `plan.md` layout.

**Architecture:** Single package; `src/index.ts` starts MCP server; clients and tools are imported but may be no-op until later plans.

**Tech Stack:** Node LTS, TypeScript, `@modelcontextprotocol/sdk`.

**Recommended Claude Code model:** `haiku` (boilerplate and file churn).

---

## Prerequisites

- None (first plan).

## Files to create

- `package.json`, `tsconfig.json`, `.gitignore`
- `src/index.ts` — minimal MCP `Server` + `stdio` transport; register placeholder tools or none
- `src/types.ts` — export shared types: `CoreAlias`, `CoreConfig`, `JsonRpcRequest`, `JsonRpcResponse` (minimal stubs)
- `src/clients/qrc-client.ts`, `src/clients/ecp-client.ts` — empty classes with TODO
- `src/connection-manager.ts` — stub
- `src/tools/*.ts` — one file per domain from `plan.md` (empty exports or TODO)

---

## Tasks

### Task 1: Initialize package

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`

- [ ] **Step 1:** Run `npm init -y`, add deps: `typescript`, `@types/node`, `@modelcontextprotocol/sdk`, devDependency `@types/node` if needed
- [ ] **Step 2:** `tsconfig.json` with `outDir: dist`, `rootDir: src`, `strict: true`, `moduleResolution: node16` or `bundler` per team preference
- [ ] **Step 3:** Scripts: `"build": "tsc"`, `"start": "node dist/index.js"`
- [ ] **Step 4:** Verify `npm run build` succeeds (empty `index.ts` ok)

### Task 2: Directory skeleton

- [ ] Create all paths from `plan.md` “Project Structure” with placeholder `export {}` or minimal exports so `tsc` passes

### Task 3: MCP entry stub

**Files:**
- Modify: `src/index.ts`

- [ ] Wire `@modelcontextprotocol/sdk` `McpServer` (or current API) with stdio transport and a single `tools/list` response (no real tools yet, per SDK pattern)

### Task 4: Commit

```bash
git add .
git commit -m "chore: scaffold Q-sys MCP TypeScript project"
```

---

## Definition of done

- `npm run build` and `node dist/index.js` run without error (MCP host may show empty tools).
- Folder layout matches [`plan.md`](../../plan.md).
