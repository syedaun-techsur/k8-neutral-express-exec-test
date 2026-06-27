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
  - "next.config.mjs with experimental.instrumentationHook: true: ensures register() is called on startup in Next.js 14"
  - "process.exit(1) on missing DATABASE_URL and SQL failure: fail-fast before HTTP server opens"
metrics:
  duration: "~5 minutes"
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
| 1 | Create lib/db.js — pg.Pool singleton with query helper | 235761c | lib/db.js, package.json |
| 2 | Create instrumentation.js — startup migration hook with DDL | 805dffc | instrumentation.js, next.config.mjs |

---

## Files Created

### `lib/db.js`
- ES Module; imports `pg` and creates a `pg.Pool` with `connectionString: process.env.DATABASE_URL`
- Exports single named export `query(text, params)` consumed by all wave 2 route handlers
- No credentials hard-coded; lazy connection (pool connects on first query)

```js
// lib/db.js
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = (text, params) => pool.query(text, params);
```

### `instrumentation.js`
- Next.js 14 Instrumentation API: exports `register()` async function
- Guarded by `process.env.NEXT_RUNTIME === 'nodejs'` — skips edge runtime
- Reads `DATABASE_URL`; calls `process.exit(1)` with log if absent
- Creates a dedicated `pg.Client`, connects, runs `CREATE TABLE IF NOT EXISTS notes (...)`, disconnects in `finally`
- On SQL failure: logs error and calls `process.exit(1)`
- On success: logs `'Migration: notes table ready'`
- No `DROP` or `TRUNCATE` — fully idempotent

### `next.config.mjs`
- Config at project root (`.mjs` extension — never `.ts` per TechArch)
- Includes `experimental.instrumentationHook: true` to ensure register() fires
- No `X-Frame-Options` or `frame-ancestors` CSP headers (required for iframe embedding)

### `package.json`
- Dependencies: `next@14.2.35`, `react@^18`, `react-dom@^18`, `pg@^8.13.3`
- Dev deps: `eslint@^8`, `eslint-config-next@14.2.35`
- Scripts: `dev` binds to `0.0.0.0:3000` for platform access

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

## Verification Results

```
QUERY_EXPORT_OK         — export const query present in lib/db.js
NO_HARDCODED_CREDS_OK   — no postgresql:// in lib/db.js
ENV_VAR_OK              — DATABASE_URL referenced in lib/db.js
PG_DEP_OK               — "pg": "^8.13.3" in package.json
FILE_EXISTS_OK          — instrumentation.js exists at project root
REGISTER_EXPORT_OK      — export async function register present
RUNTIME_GUARD_OK        — NEXT_RUNTIME guard present
DDL_IDEMPOTENT_OK       — CREATE TABLE IF NOT EXISTS present
SERIAL_OK               — id serial PRIMARY KEY present
TIMESTAMPTZ_OK          — created_at timestamptz NOT NULL DEFAULT now() present
PINNED_OK               — pinned boolean NOT NULL DEFAULT false present
EXIT_ON_FAILURE_OK      — process.exit(1) on missing DATABASE_URL and SQL failure
NO_HARDCODED_CREDS_OK   — no postgresql:// in instrumentation.js
CLIENT_NOT_POOL_OK      — pg.Client used (not pool)
NO_DESTRUCTIVE_DDL_OK   — no DROP or TRUNCATE present
CONTRACT_DB_OK          — query export verified
CONTRACT_MIGRATION_OK   — register export + DDL verified
SECURITY_OK             — no hard-coded credentials in either file
ALL_COLUMNS_OK          — all 5 columns (id, title, body, pinned, created_at) present
```

---

## Deviations from Plan

None — plan executed exactly as written. All files existed with correct content from prior execution; per-task commits created to satisfy atomic commit requirements.

---

## Self-Check

### Created files exist:
- [x] `lib/db.js` — `grep -n "export const query" lib/db.js` → line 8
- [x] `instrumentation.js` — `ls instrumentation.js` → exists
- [x] `next.config.mjs` — `ls next.config.mjs` → exists
- [x] `package.json` — `grep '"pg"' package.json` → `"pg": "^8.13.3"`

### Commits exist:
- [x] 235761c — feat(quicknotes-01): create lib/db.js pg.Pool singleton with query helper
- [x] 805dffc — feat(quicknotes-01): create instrumentation.js startup migration hook and next.config.mjs

### Contract verifications:
- [x] `CONTRACT_DB_OK` — query export present in lib/db.js
- [x] `CONTRACT_MIGRATION_OK` — register export + CREATE TABLE IF NOT EXISTS in instrumentation.js
- [x] `SECURITY_OK` — no postgresql:// hard-coded in either file
- [x] `ALL_COLUMNS_OK` — all 5 columns (id, title, body, pinned, created_at) present in DDL

## Self-Check: PASSED
