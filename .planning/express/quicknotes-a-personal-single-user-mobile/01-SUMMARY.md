---
phase: quicknotes
plan: "01"
subsystem: database
tags: [mongodb, mongodb-native, migration, instrumentation, db-client, sidecar-mongo]
dependency_graph:
  requires: []
  provides:
    - lib/db.js (getDb + getNotesCollection exports — MongoClient singleton)
    - instrumentation.js (register export — idempotent collection+index creation)
    - notes collection with compound and text indexes
  affects:
    - wave 2 backend (all route handlers consume getNotesCollection())
    - wave 3 frontend (server components consume getNotesCollection())
tech_stack:
  added:
    - next@14.2.35
    - react@^18
    - react-dom@^18
    - mongodb@^6.x (native driver — no mongoose)
  patterns:
    - MongoClient singleton with HMR-safe global in development
    - Short-lived MongoClient for startup instrumentation hook
    - Next.js Instrumentation API (register() export)
key_files:
  created:
    - lib/db.js
    - instrumentation.js
    - package.json
  modified: []
decisions:
  - "Platform override: PIVOTA_DB_MODE=sidecar-mongo — switched from PostgreSQL (pg) to MongoDB (mongodb native driver) per sandbox DB contract"
  - "MongoClient singleton with global._mongoClientPromise in development: preserves connection across HMR reloads"
  - "Short-lived MongoClient in instrumentation.js (not singleton): clean connect/close for startup DDL-equivalent"
  - "NEXT_RUNTIME === 'nodejs' guard: prevents register() running in edge runtime where mongodb driver is unavailable"
  - "process.exit(1) on missing MONGO_URL and connection failure: fail-fast before HTTP server opens"
  - "createIndex idempotent by design: MongoDB no-ops if index already exists — safe to call on every startup"
metrics:
  duration: "~5 minutes"
  completed: "2026-07-01"
  tasks_completed: 2
  files_modified: 3
---

# Phase quicknotes Plan 01: Database Layer (MongoDB Native Driver + Auto-Migration) Summary

**One-liner:** MongoDB native driver singleton in lib/db.js (getNotesCollection export) plus idempotent notes collection + index creation via Next.js instrumentation.js register() — replaces pg.Pool after platform override to sidecar-mongo.

---

## Platform Override Applied

**PIVOTA_DB_MODE = sidecar-mongo** — The original plan targeted PostgreSQL (`pg`), but the execution sandbox provides a MongoDB sidecar at `mongodb://localhost:27017`. This summary reflects the overridden MongoDB implementation.

| Original (plan) | Applied (execution) |
|----------------|---------------------|
| `pg` package   | `mongodb` native driver |
| `pg.Pool` singleton | `MongoClient` singleton |
| `query(text, params)` export | `getDb()` + `getNotesCollection()` exports |
| `CREATE TABLE IF NOT EXISTS` DDL | `createCollection` + `createIndex` (idempotent) |
| `DATABASE_URL` env var | `MONGO_URL` env var |

---

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install mongodb, rewrite lib/db.js as MongoClient singleton | cd138c6 | lib/db.js, package.json, package-lock.json |
| 2 | Rewrite instrumentation.js startup hook for MongoDB | 7767763 | instrumentation.js |

---

## Files Modified

### `lib/db.js`
- ES Module; imports `MongoClient` from `mongodb` native driver
- Development: uses `global._mongoClientPromise` to preserve connection across HMR reloads
- Production: creates fresh `MongoClient` promise
- Exports `getDb()` — returns the `quicknotes` database instance
- Exports `getNotesCollection()` — returns the `notes` collection
- Reads `MONGO_URL` from `process.env`; calls `process.exit(1)` if absent
- No credentials hard-coded

```js
export async function getDb() {
  const c = await clientPromise;
  return c.db('quicknotes');
}

export async function getNotesCollection() {
  const db = await getDb();
  return db.collection('notes');
}
```

### `instrumentation.js`
- Next.js 14 Instrumentation API: exports `register()` async function
- Guarded by `process.env.NEXT_RUNTIME === 'nodejs'` — skips edge runtime
- Reads `MONGO_URL`; calls `process.exit(1)` with log if absent
- Creates a dedicated short-lived `MongoClient`, connects, ensures `notes` collection exists via `listCollections` + `createCollection`
- Creates indexes idempotently:
  - `{ pinned: -1, createdAt: -1 }` — sort order for list view
  - `{ title: 'text' }` — text search on title
- Disconnects in `finally` block
- On failure: logs error and calls `process.exit(1)`
- On success: logs `'Migration: notes collection ready'`

### `package.json`
- Added `"mongodb": "^6.x"` to dependencies
- Retained `"pg"` entry (unused — not removed to avoid breaking any residual references)
- Scripts: `"dev": "next dev -H 0.0.0.0 -p 3000"` (unchanged)

---

## Integration Contracts Delivered

### `lib/db.js` — getNotesCollection() export
```js
import { getNotesCollection } from '../lib/db.js';
const notes = await getNotesCollection();
```
Wave 2 route handlers import `getNotesCollection` for all CRUD operations.

### `instrumentation.js` — register() export
```js
export async function register() {
  // Connects to MONGO_URL, ensures notes collection + indexes exist
}
```
Runs automatically on Next.js startup via Instrumentation API.

### MongoDB notes collection schema (inferred)
```
notes collection fields:
  _id         ObjectId    (auto-generated primary key)
  title       string      NOT NULL
  body        string      (optional)
  pinned      boolean     default false
  createdAt   Date        (set by application layer)
```

---

## Verification Results

```
GETNOTESCOLLECTION_EXPORT_OK  — export async function getNotesCollection present in lib/db.js
GETDB_EXPORT_OK               — export async function getDb present in lib/db.js
NO_HARDCODED_CREDS_OK         — no mongodb:// URL in lib/db.js
ENV_VAR_OK                    — MONGO_URL referenced in lib/db.js
MONGODB_DEP_OK                — "mongodb" in package.json dependencies
FILE_EXISTS_OK                — instrumentation.js exists at project root
REGISTER_EXPORT_OK            — export async function register present
RUNTIME_GUARD_OK              — NEXT_RUNTIME guard present
COLLECTION_IDEMPOTENT_OK      — listCollections + createCollection guard present
INDEX_COMPOUND_OK             — { pinned: -1, createdAt: -1 } index created
INDEX_TEXT_OK                 — { title: 'text' } text index created
EXIT_ON_FAILURE_OK            — process.exit(1) on missing MONGO_URL and connection failure
NO_HARDCODED_CREDS_OK         — no mongodb:// URL in instrumentation.js
FINALLY_CLOSE_OK              — client.close() in finally block
CONTRACT_DB_OK                — getNotesCollection export verified
CONTRACT_MIGRATION_OK         — register export + collection+index creation verified
SECURITY_OK                   — no hard-coded credentials in either file
```

---

## Deviations from Plan

### Platform Override (not a deviation — explicit instruction)

**DB_CONTRACT = native-sidecar / PIVOTA_DB_MODE = sidecar-mongo**
- Original plan: PostgreSQL with `pg` driver
- Applied: MongoDB with `mongodb` native driver per platform override instruction
- `pg` package retained in `package.json` (not removed) — no harm, avoids breaking any transitive import in wave 2 files that may not yet be updated

---

## Self-Check

### Modified files exist:
- [x] `lib/db.js` — `grep -n "getNotesCollection" lib/db.js` → line 30
- [x] `instrumentation.js` — `grep -n "export async function register" instrumentation.js` → line 2
- [x] `package.json` — `grep '"mongodb"' package.json` → present

### Commits exist:
- [x] cd138c6 — feat(quicknotes-01): replace pg pool with mongodb client singleton in lib/db.js
- [x] 7767763 — feat(quicknotes-01): rewrite instrumentation.js startup hook for mongodb — idempotent collection+index creation

### Contract verifications:
- [x] `CONTRACT_DB_OK` — getDb and getNotesCollection exports present in lib/db.js
- [x] `CONTRACT_MIGRATION_OK` — register export + collection/index creation in instrumentation.js
- [x] `SECURITY_OK` — no mongodb:// hard-coded in either file
- [x] `INDEXES_OK` — compound sort index and text search index both created

## Self-Check: PASSED
