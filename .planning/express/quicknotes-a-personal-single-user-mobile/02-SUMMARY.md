---
phase: quicknotes
plan: "02"
subsystem: api-routes
tags: [rest-api, notes, health, next-js, app-router]
dependency_graph:
  requires: [lib/db.js (query pool), instrumentation.js (notes table migration)]
  provides: [GET /api/health, GET/POST /api/notes, GET/PUT/DELETE /api/notes/[id]]
  affects: [wave-3-frontend, wave-4-integration-tests]
tech_stack:
  added: []
  patterns: [Next.js 14 App Router route handlers, parameterized pg queries, HTTP status code semantics]
key_files:
  created:
    - app/api/health/route.js
    - app/api/notes/route.js
    - app/api/notes/[id]/route.js
  modified: []
decisions:
  - "DELETE 204 via new Response(null, { status: 204 }) not Response.json() — avoids sending response body which violates HTTP spec"
  - "Non-integer id params return 404 NOTE_NOT_FOUND (not 400) — aligns with spec: id is part of resource path, not user input"
  - "POST /api/notes returns 201 (not 200) — correct HTTP semantics for resource creation"
  - "query() imported from lib/db.js — no direct pg Pool instantiation in route files"
  - "ILIKE filter on title only for search — matches FRD spec for F1"
metrics:
  duration: "~5 minutes"
  completed: "2025-06-27"
  tasks_completed: 2
  files_created: 3
---

# Phase quicknotes Plan 02: REST API Route Handlers Summary

**One-liner:** Six Next.js 14 App Router route handlers implementing full CRUD for notes plus liveness health check, using parameterized pg queries via lib/db.js pool.

## What Was Built

Wave 2 delivers all REST API endpoints required by the QuickNotes FRD. Three files, six handlers, zero direct pg usage in route files.

### Files Created

| File | Exports | Purpose |
|------|---------|---------|
| `app/api/health/route.js` | `GET` | Liveness check → 200 `{"status":"ok"}`, no DB |
| `app/api/notes/route.js` | `GET`, `POST` | List/search notes, create note |
| `app/api/notes/[id]/route.js` | `GET`, `PUT`, `DELETE` | Read, update, delete single note |

### Endpoint Behavior

| Endpoint | Success | Error cases |
|----------|---------|-------------|
| GET /api/health | 200 `{"status":"ok"}` | — |
| GET /api/notes | 200 Note[] (sorted pinned DESC, created_at DESC) | 500 INTERNAL_ERROR |
| GET /api/notes?q=term | 200 Note[] filtered via ILIKE `%term%` on title | 500 INTERNAL_ERROR |
| POST /api/notes | 201 Note | 400 TITLE_REQUIRED, 400 BAD_REQUEST, 500 |
| GET /api/notes/[id] | 200 Note | 404 NOTE_NOT_FOUND (including non-integer id) |
| PUT /api/notes/[id] | 200 updated Note | 404 NOTE_NOT_FOUND, 400 TITLE_REQUIRED, 400 BAD_REQUEST |
| DELETE /api/notes/[id] | 204 (no body) | 404 NOTE_NOT_FOUND |

## Key Decisions

1. **204 response via `new Response(null, { status: 204 })`** — `Response.json()` would serialize `null` as the string `"null"`, sending a body with a 204 which violates HTTP spec. Used the raw Response constructor instead.

2. **Non-integer id → 404 not 400** — The spec explicitly requires this. The `parseId()` helper validates `parseInt(rawId, 10)` is an integer, positive, and round-trips via `String(id) === String(rawId)` to reject floats like `"1.5"`.

3. **POST returns 201** — Correct HTTP semantics for resource creation. Not 200.

4. **`query` from lib/db.js only** — No `Pool`, `Client`, or `pg` import in any route file. All DB access flows through the shared pool from Wave 1.

5. **ILIKE filter on title only** — Matches F1 spec. Body content is not searchable per FRD.

## Integration Contracts Delivered

### Consumed (Wave 1)
- `lib/db.js` → `export const query` ✅ verified present
- `instrumentation.js` → `register()` + `CREATE TABLE IF NOT EXISTS notes` ✅ verified present

### Provided (for Wave 3 & 4)
- `GET /api/health` → `{ status: 'ok' }` with 200
- `GET /api/notes` → `Note[]` sorted pinned DESC, created_at DESC
- `GET /api/notes?q=<term>` → filtered `Note[]`
- `POST /api/notes` → `Note` with 201
- `GET /api/notes/[id]` → `Note` or 404
- `PUT /api/notes/[id]` → updated `Note` or 400/404
- `DELETE /api/notes/[id]` → 204 no body or 404

Note shape: `{ id: number, title: string, body: string|null, pinned: boolean, created_at: string }`

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| Task 1 | Health endpoint + notes collection endpoints | `0526e0a` |
| Task 2 | Notes item endpoint GET/PUT/DELETE | `4e6b444` |

## Deviations from Plan

None — plan executed exactly as written. All three files match the spec code templates verbatim. No auto-fixes required.

## Self-Check

- [x] `app/api/health/route.js` exists and exports `GET`
- [x] `app/api/notes/route.js` exists and exports `GET`, `POST`
- [x] `app/api/notes/[id]/route.js` exists and exports `GET`, `PUT`, `DELETE`
- [x] All queries parameterized (no `${...}` interpolation in SQL)
- [x] No hard-coded credentials
- [x] DELETE uses `new Response(null, { status: 204 })`
- [x] Wave 1 contracts consumed: `import { query } from '../../../lib/db.js'` and `../../../../lib/db.js`
- [x] Commits `0526e0a` and `4e6b444` exist in git log
