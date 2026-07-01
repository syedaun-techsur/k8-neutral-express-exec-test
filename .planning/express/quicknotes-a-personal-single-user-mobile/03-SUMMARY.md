---
phase: quicknotes
plan: "03"
subsystem: ui-pages
tags: [next.js, app-router, server-component, client-component, css-modules, mobile-first, iframe-safe]
dependency_graph:
  requires: ["01 (lib/db.js query())", "02 (REST API endpoints)"]
  provides: ["next.config.mjs (iframe-safe)", "app/page.js", "app/notes/new/page.js", "app/notes/[id]/edit/page.js"]
  affects: ["wave 4 integration tests"]
tech_stack:
  added: ["CSS Modules (composes from global)", "Next.js 14 App Router hybrid server+client pattern"]
  patterns: ["Async Server Component for data fetch", "Inline script for client-side search without use client", "Hybrid server+client edit page", "State machine for delete confirmation (idle|confirming|deleting)"]
key_files:
  created:
    - next.config.mjs
    - app/layout.js
    - app/globals.css
    - app/page.js
    - app/notes/new/page.js
    - app/notes/new/NoteForm.module.css
    - app/notes/[id]/edit/page.js
    - app/notes/[id]/edit/EditNoteClient.js
    - app/notes/[id]/edit/NoteForm.module.css
  modified:
    - package.json (dev script: next dev -H 0.0.0.0 -p 3000)
decisions:
  - "Server Component for list page (direct db query) + inline <script> for client-side search avoids full use client on homepage"
  - "Hybrid server+client pattern for edit page: server fetches note, EditNoteClient handles interactions"
  - "Inline delete confirmation state machine (idle|confirming|deleting) avoids window.confirm()"
  - "next.config.mjs headers() returns empty array per route to prevent X-Frame-Options injection"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-27"
  tasks: 3
  files: 10
---

# Phase quicknotes Plan 03: UI Pages Summary

**One-liner:** Next.js 14 App Router UI with mobile-first CSS Modules, inline-search server component, and inline delete confirmation client component.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | next.config.mjs + app/layout.js + app/globals.css | f1a6153 | next.config.mjs, app/layout.js, app/globals.css, package.json |
| 2 | app/page.js — Note list with search, pinned sections, empty state | ad996ec | app/page.js |
| 3 | Create + Edit/Delete pages with CSS Modules | 148fa9f | app/notes/new/page.js, app/notes/new/NoteForm.module.css, app/notes/[id]/edit/page.js, app/notes/[id]/edit/EditNoteClient.js, app/notes/[id]/edit/NoteForm.module.css |

## Integration Contracts Delivered

| Artifact | Shape | Verify |
|----------|-------|--------|
| `next.config.mjs` | ES Module; headers() returns empty array; no X-Frame-Options; no frame-ancestors CSP | `test -f next.config.mjs && grep 'export default' next.config.mjs` |
| `app/page.js` | Async Server Component; queries notes directly via query(); renders sorted list, search input, empty state | `grep 'export default' app/page.js` |
| `app/notes/new/page.js` | Client Component ('use client'); blank form with autoFocus; POST /api/notes; validation; redirect on 201 | `grep 'use client' app/notes/new/page.js` |
| `app/notes/[id]/edit/page.js` | Async Server Component; fetches note via query(); renders EditNoteClient or not-found | `grep 'export default' 'app/notes/[id]/edit/page.js'` |

## Key Decisions

### 1. Server Component + Inline Script for Search
**Decision:** Keep `app/page.js` as an async Server Component and use a small inline `<script>` for keystroke-reactive search filtering.  
**Why:** Adding `'use client'` to the list page would lose server-side rendering of notes. The inline script pattern allows real-time search without SSR loss and ?q= URL persistence via `history.replaceState`.

### 2. Hybrid Server + Client for Edit Page
**Decision:** `app/notes/[id]/edit/page.js` is an async Server Component that fetches the note, while `EditNoteClient.js` handles interactive PUT/DELETE operations.  
**Why:** Server-side fetch for pre-fill eliminates loading flash and allows not-found state to be rendered server-side (proper 404 UX without a client-side loading state).

### 3. Inline Delete Confirmation (No `window.confirm()`)
**Decision:** Three-state machine `idle | confirming | deleting` with button text change and Cancel link.  
**Why:** `window.confirm()` is blocked in cross-origin iframes (F9 constraint). The state machine approach provides accessible confirmation via `aria-expanded` on the delete button.

### 4. next.config.mjs — Empty Headers Array
**Decision:** `headers()` returns a route entry with an empty `headers: []` array rather than no headers config at all.  
**Why:** Next.js 14 injects `X-Frame-Options: SAMEORIGIN` by default. Returning an empty array per route explicitly overrides this injection without adding any blocking headers. Comment explains intent for F9 / US-9.1.

## Features Implemented

- **F0**: Note List View — sorted cards (pinned-first via ORDER BY pinned DESC, created_at DESC), "Pinned" section divider, empty state "No notes yet."
- **F1**: Note Search/Filter — keystroke-reactive input event, client-side DOM filtering, ?q= URL persistence via history.replaceState
- **F2**: Create Note — blank form, title autoFocus, client validation ("Title is required" with aria-invalid + role=alert), POST /api/notes, Save disables on submit, redirects to / on 201
- **F3**: Edit Note — pre-filled form from server-fetched note prop, PUT /api/notes/[id], redirects on 200
- **F4**: Delete Note — inline confirmation ("Confirm delete ?" + Cancel), DELETE /api/notes/[id], redirects on 204; specific 404 error message
- **F8**: Mobile-First UI — #FBCA5C/#0A0A0A/#FFFFFF palette, 44px tap targets, CSS Modules, single-column layout
- **F9**: Iframe Compatibility — next.config.mjs (not .ts), headers() returns empty array (no X-Frame-Options, no frame-ancestors), 0.0.0.0:3000 binding

## Deviations from Plan

None — plan executed exactly as written. The X-Frame-Options grep in the overall verification matched a comment line in next.config.mjs, but the precise verification (excluding comment lines via `grep -v '#\|comment\|\/\/'`) confirms no actual header value was set.

## Self-Check

### Files Created
- [x] `next.config.mjs` — exists, exports default, empty headers array
- [x] `app/layout.js` — exists, exports default RootLayout
- [x] `app/globals.css` — exists, contains #FBCA5C, .btnPrimary, .btnDelete, .errorBanner
- [x] `app/page.js` — exists, exports default, no 'use client', query from lib/db.js
- [x] `app/notes/new/page.js` — exists, 'use client', exports default
- [x] `app/notes/new/NoteForm.module.css` — exists
- [x] `app/notes/[id]/edit/page.js` — exists, exports default, async Server Component
- [x] `app/notes/[id]/edit/EditNoteClient.js` — exists, 'use client', exports default
- [x] `app/notes/[id]/edit/NoteForm.module.css` — exists

### Commits
- [x] f1a6153 — Task 1: next.config.mjs + layout + globals.css
- [x] ad996ec — Task 2: app/page.js
- [x] 148fa9f — Task 3: create + edit/delete pages

### Self-Check: PASSED

---

## Wave 3 MongoDB Override — Platform Migration Update

**Executed:** 2026-07-01  
**Override context:** DB_CONTRACT = native-sidecar, PIVOTA_DB_MODE = sidecar-mongo, MONGO_URL = mongodb://localhost:27017

### Tasks Completed (MongoDB Migration)

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update app/page.js — replace query()/SQL with getNotesCollection()/MongoDB | 3240857 | app/page.js |
| 2 | Update app/notes/[id]/edit/page.js — replace parseInt/query() with ObjectId/findOne() | 4a3bf6d | app/notes/[id]/edit/page.js |

### Files Modified

- `app/page.js` — replaced `import { query } from '../lib/db.js'` + SQL with `getNotesCollection()` + MongoDB cursor; `(await searchParams)` pattern for Next.js 15; `_id` → `id` string mapping; `createdAt` field (was `created_at`)
- `app/notes/[id]/edit/page.js` — replaced `parseInt(rawId)` + SQL query with `new ObjectId(rawId)` + `findOne({ _id: objectId })`; `await params` pattern for Next.js 15; `_id` → `id` string mapping

### Files Unchanged

- `app/notes/new/page.js` — uses `fetch('/api/notes', ...)`, no DB dependency
- `app/notes/[id]/edit/EditNoteClient.js` — uses `fetch('/api/notes/[id]', ...)`, no DB dependency
- `app/layout.js` — no DB dependency
- `app/globals.css` — no DB dependency
- `app/notes/new/NoteForm.module.css` — no DB dependency
- `app/notes/[id]/edit/NoteForm.module.css` — no DB dependency
- `next.config.mjs` — no DB dependency
- `lib/db.js` — already written in Wave 1, exports `getNotesCollection()`

### Key Decisions

1. **MongoDB ObjectId validation replaces parseInt** — `new ObjectId(rawId)` in a try/catch replaces `parseInt(rawId, 10)` + integer validation. Invalid IDs (non-24-char hex strings) cause ObjectId constructor to throw, which sets `objectId = null`, triggering the "Note not found" path.
2. **`createdAt` field name (MongoDB) instead of `created_at` (PostgreSQL)** — MongoDB documents use camelCase `createdAt` as set by the Wave 2 API routes. The NoteCard component date display updated from `note.created_at` to `note.createdAt`.
3. **`await searchParams` and `await params`** — Next.js 15 requires these to be awaited. Updated `searchParams?.q` to `(await searchParams)?.q` and `params.id` to `(await params).id`.
4. **`_id` → `id` string projection** — MongoDB `_id` is an ObjectId; destructured and mapped to string `id` before returning to client to maintain the API contract from Wave 2.

### Deviations from Plan

None — both files rewritten exactly as specified in the task prompt.

### Self-Check (MongoDB Override)

- [x] `app/page.js` — imports `getNotesCollection`, no `query`, no SQL, `createdAt` field, `(await searchParams)` pattern
- [x] `app/notes/[id]/edit/page.js` — imports `getNotesCollection` and `ObjectId` from `mongodb`, `await params`, `findOne({ _id: objectId })`, `_id` → `id` mapping
- [x] Commit 3240857 — app/page.js MongoDB update
- [x] Commit 4a3bf6d — edit page MongoDB update

### Self-Check: PASSED
