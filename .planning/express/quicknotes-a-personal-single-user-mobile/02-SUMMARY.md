---
phase: quicknotes
plan: "02"
subsystem: api-routes
tags: [rest-api, notes, health, next-js, app-router, mongodb, objectid]
dependency_graph:
  requires: [lib/db.js (getNotesCollection), instrumentation.js (index creation)]
  provides: [GET /api/health, GET/POST /api/notes, GET/PUT/DELETE /api/notes/[id]]
  affects: [wave-3-frontend, wave-4-integration-tests]
tech_stack:
  added: [ObjectId from mongodb]
  patterns: [Next.js 14 App Router route handlers, MongoDB native driver queries, noteToJSON helper for _id→id mapping]
key_files:
  created: []
  modified:
    - app/api/notes/route.js
    - app/api/notes/[id]/route.js
  unchanged:
    - app/api/health/route.js
decisions:
  - "ObjectId for IDs — MongoDB uses BSON ObjectId for _id; parseId() wraps new ObjectId(rawId) in try/catch; invalid format returns 404 NOTE_NOT_FOUND"
  - "noteToJSON helper converts _id→id string — keeps frontend API contract stable (id field, not _id)"
  - "MongoDB $regex with $options:'i' replaces PostgreSQL ILIKE — case-insensitive substring search on title"
  - "DELETE 204 via new Response(null, { status: 204 }) not Response.json() — avoids sending response body which violates HTTP spec"
  - "POST /api/notes returns 201 — correct HTTP semantics for resource creation"
metrics:
  duration: "~10 minutes"
  completed: "2026-07-01"
  tasks_completed: 2
  files_modified: 2
---

# Phase quicknotes Plan 02: REST API Route Handlers Summary (MongoDB Rewrite)

**One-liner:** Rewrote GET/POST notes collection route and GET/PUT/DELETE notes item route to use MongoDB native driver with ObjectId parsing and _id→id mapping via noteToJSON helper.

## What Was Built

Wave 2 (MongoDB platform override) rewrites the REST API route handlers to use MongoDB instead of PostgreSQL. The health endpoint required no changes. Two files rewritten, six handlers updated.

### Files Modified

| File | Status | Exports | Purpose |
|------|--------|---------|---------|
| `app/api/health/route.js` | **unchanged** | `GET` | Liveness check → 200 `{"status":"ok"}`, no DB |
| `app/api/notes/route.js` | **rewritten** | `GET`, `POST` | List/search notes, create note — MongoDB |
| `app/api/notes/[id]/route.js` | **rewritten** | `GET`, `PUT`, `DELETE` | Read, update, delete single note — MongoDB ObjectId |

### Endpoint Behavior

| Endpoint | Success | Error cases |
|----------|---------|-------------|
| GET /api/health | 200 `{"status":"ok"}` | — |
| GET /api/notes | 200 Note[] (sorted pinned -1, createdAt -1) | 500 INTERNAL_ERROR |
| GET /api/notes?q=term | 200 Note[] filtered via `$regex` on title | 500 INTERNAL_ERROR |
| POST /api/notes | 201 Note (with `id` string) | 400 TITLE_REQUIRED, 400 BAD_REQUEST, 500 |
| GET /api/notes/[id] | 200 Note | 404 NOTE_NOT_FOUND (including invalid ObjectId) |
| PUT /api/notes/[id] | 200 updated Note | 404 NOTE_NOT_FOUND, 400 TITLE_REQUIRED, 400 BAD_REQUEST |
| DELETE /api/notes/[id] | 204 (no body) | 404 NOTE_NOT_FOUND |

## Key Decisions

1. **ObjectId for IDs** — MongoDB uses BSON ObjectId for `_id`. The `parseId()` helper wraps `new ObjectId(rawId)` in a try/catch — invalid format (including non-ObjectId strings) returns 404 `NOTE_NOT_FOUND` rather than 400, maintaining the REST contract that invalid path segments are "not found".

2. **`noteToJSON` helper (_id → id)** — All documents are transformed before returning to the client: `_id` is removed, and `id: _id.toString()` is added. This keeps the frontend API contract stable — consumers see `id` (string), not `_id` (ObjectId).

3. **MongoDB `$regex` replaces PostgreSQL ILIKE** — Case-insensitive search uses `{ title: { $regex: q.trim(), $options: 'i' } }`. Behavior equivalent to PostgreSQL `ILIKE '%term%'` for substring matching.

4. **204 response via `new Response(null, { status: 204 })`** — `Response.json()` would serialize `null` as the string `"null"`, sending a body with a 204 which violates HTTP spec. Used the raw Response constructor instead.

5. **`createdAt` (camelCase) vs `created_at` (snake_case)** — MongoDB convention uses camelCase; new documents are stored with `createdAt`. Sort order uses `{ pinned: -1, createdAt: -1 }`.

## Integration Contracts Delivered

### Consumed (Wave 1)
- `lib/db.js` → `export async function getNotesCollection()` ✅ verified present
- `instrumentation.js` → `register()` + MongoDB index creation ✅ verified present

### Provided (for Wave 3 & 4)
- `GET /api/health` → `{ status: 'ok' }` with 200
- `GET /api/notes` → `Note[]` sorted pinned DESC, createdAt DESC
- `GET /api/notes?q=<term>` → filtered `Note[]` via regex
- `POST /api/notes` → `Note` with 201 (id as string)
- `GET /api/notes/[id]` → `Note` or 404
- `PUT /api/notes/[id]` → updated `Note` or 400/404
- `DELETE /api/notes/[id]` → 204 no body or 404

Note shape: `{ id: string, title: string, body: string|null, pinned: boolean, createdAt: Date }`

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| Task 1 | Rewrite notes collection route (GET/POST) for MongoDB | `87738d6` |
| Task 2 | Rewrite notes item route (GET/PUT/DELETE) for MongoDB with ObjectId | `8790890` |

## Deviations from Plan

None — plan executed exactly as written. Both files match the spec code templates verbatim. Health route confirmed unchanged. No auto-fixes required.

## Self-Check: PASSED

- [x] `app/api/health/route.js` exists and exports `GET` returning `{ status: 'ok' }`
- [x] `app/api/notes/route.js` exists and exports `GET` (with `$regex`) and `POST` (with `TITLE_REQUIRED`, 201)
- [x] `app/api/notes/[id]/route.js` exists and exports `GET`, `PUT`, `DELETE` with ObjectId parsing
- [x] Invalid ObjectId → 404 `NOTE_NOT_FOUND` (not 400)
- [x] DELETE uses `new Response(null, { status: 204 })`
- [x] Wave 1 contracts consumed: `import { getNotesCollection } from '../../../lib/db.js'` and `'../../../../lib/db.js'`
- [x] Commits `87738d6` and `8790890` exist in git log
