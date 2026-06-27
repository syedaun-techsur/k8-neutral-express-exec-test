---
phase: quicknotes
plan: "01"
subsystem: database
tags: [postgresql, pg, migration, instrumentation, db-pool]
dependency_graph:
  requires: []
  provides:
    - lib/db.js (query export — pg.Pool singleton)
    - instrumentation.js (register export — auto-migration)
    - notes table DDL (CREATE TABLE IF NOT EXISTS)
  affects:
    - wave 2 backend (all route handlers consume query())
    - wave 3 frontend (server components consume query())
tech_stack:
  added:
    - next@14.2.35
    - react@^18
    - react-dom@^18
    - pg@^8.13.3
  patterns:
    - pg.Pool singleton for request handler queries
    - pg.Client short-lived for startup migration
    - Next.js Instrumentation API (register() export)
key_files:
  created:
    - lib/db.js
    - instrumentation.js
    - next.config.mjs
    - package.json
  modified: []
decisions:
  - "pg.Client for migration (not pool): short-lived connection that connects, runs DDL, disconnects in finally — clean separation from request-handler pool"
  - "NEXT_RUNTIME === 'nodejs' guard: prevents register() running in edge runtime where pg is unavailable"
  - "next.config.mjs minimal: wave 3 expands with headers() for iframe compatibility; this wave only ensures file exists"
  - "process.exit(1) on missing DATABASE_URL and SQL failure: fail-fast before HTTP server opens"
metrics:
  duration: "~8 minutes"
  completed: "2026-06-27"
  tasks_completed: 2
  files_created: 4
---

# Phase quicknotes Plan 01: Database Layer (pg.Pool + Auto-Migration) Summary

**One-liner:** pg.Pool singleton in lib/db.js plus idempotent 5-column notes table DDL run via Next.js instrumentation.js register() on every startup.

---

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create lib/db.js — pg.Pool singleton with query helper | 3e5936b | lib/db.js, package.json, package-lock.json |
| 2 | Create instrumentation.js — startup migration hook with DDL | 5985c96 | instrumentation.js, next.config.mjs |

---

## Files Created

### `lib/db.js`
- ES Module; imports `pg` and creates a `pg.Pool` with `connectionString: process.env.DATABASE_URL`
- Exports single named export `query(text, params)` consumed by all wave 2 route handlers
- No credentials hard-coded; lazy connection (pool connects on first query)

### `instrumentation.js`
- Next.js 14 Instrumentation API: exports `register()` async function
- Guarded by `process.env.NEXT_RUNTIME === 'nodejs'` — skips edge runtime
- Reads `DATABASE_URL`; calls `process.exit(1)` with log if absent
- Creates a dedicated `pg.Client`, connects, runs `CREATE TABLE IF NOT EXISTS notes (...)`, disconnects in `finally`
- On SQL failure: logs error and calls `process.exit(1)`
- On success: logs `'Migration: notes table ready'`
- No `DROP` or `TRUNCATE` — fully idempotent

### `next.config.mjs`
- Minimal config at project root (`.mjs` extension — never `.ts` per TechArch)
- Empty `nextConfig` object; wave 3 will add `headers()` for iframe compatibility

### `package.json`
- Bootstrapped with: `next@14.2.35`, `react@^18`, `react-dom@^18`, `pg@^8.13.3`
- Dev deps: `eslint@^8`, `eslint-config-next@14.2.35`

---

## Integration Contracts Delivered

### `lib/db.js` — query() export
```js
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const query = (text, params) => pool.query(text, params);
```
Wave 2 imports: `import { query } from '../lib/db.js'`

### `instrumentation.js` — register() export
```js
export async function register() { /* CREATE TABLE IF NOT EXISTS notes ... */ }
```

### PostgreSQL notes table DDL
```sql
CREATE TABLE IF NOT EXISTS notes (
  id          serial       PRIMARY KEY,
  title       text         NOT NULL,
  body        text,
  pinned      boolean      NOT NULL DEFAULT false,
  created_at  timestamptz  NOT NULL DEFAULT now()
);
```

---

## Deviations from Plan

### Auto-fixed Issues (Rule 3 — Blocking Issue)

**1. [Rule 3 - Blocking] Bootstrapped Next.js project manually**
- **Found during:** Pre-task setup
- **Issue:** Project root contained only `.planning/`, `project_specs/`, and config files — no `package.json`, no `app/` directory, no Next.js installation. `create-next-app` refused to scaffold into a non-empty directory.
- **Fix:** Created `package.json` manually with correct dependency versions (next@14.2.35, react@^18, react-dom@^18, pg@^8.13.3) and ran `npm install`. Created `app/` and `lib/` directories. This is a prerequisite for wave 2 and beyond.
- **Files modified:** `package.json`, `package-lock.json`
- **Commit:** 3e5936b

---

## Self-Check

### Created files exist:
- [x] `lib/db.js` — `grep -n "export const query" lib/db.js` → line 8
- [x] `instrumentation.js` — `ls instrumentation.js` → exists
- [x] `next.config.mjs` — `ls next.config.mjs` → exists
- [x] `package.json` — `grep '"pg"' package.json` → `"pg": "^8.13.3"`

### Commits exist:
- [x] 3e5936b — feat(quicknotes-01): create lib/db.js pg.Pool singleton with query helper
- [x] 5985c96 — feat(quicknotes-01): create instrumentation.js startup migration hook and next.config.mjs

### Contract verifications:
- [x] `CONTRACT_DB_OK` — query export present in lib/db.js
- [x] `CONTRACT_MIGRATION_OK` — register export + CREATE TABLE IF NOT EXISTS in instrumentation.js
- [x] `SECURITY_OK` — no postgresql:// hard-coded in either file
- [x] `ALL_COLUMNS_OK` — all 5 columns (id, title, body, pinned, created_at) present in DDL

## Self-Check: PASSED
