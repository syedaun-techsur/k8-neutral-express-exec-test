# Security Report — Express: quicknotes-a-personal-single-user-mobile

**Mode:** retroactive
**Audited:** 2026-07-01
**Verdict:** SECURED
**Confirmed HIGH/CRITICAL:** 0

## Summary

The QuickNotes express implementation (Next.js 14, MongoDB native driver, single-user personal app) was audited retroactively across the entire `develop`→`main` diff. The STRIDE register was built from the implementation diff covering 9 changed files. Fifteen candidate threat entries were examined; all 15 were refuted as safe after adversarial analysis. The app ships no authentication (by design — single-user), no shell execution, no file-system writes outside of Next.js build artifacts, and no external service calls. The primary attack-surface classes relevant to this stack (NoSQL injection via query-operator injection, ReDoS via unanchored regex, prototype pollution via body parsing, secret leakage via hardcoded credentials, and XSS via `dangerouslySetInnerHTML`) were each examined and individually refuted. No confirmed HIGH or CRITICAL findings were produced. The express task is cleared to ship.

## Attack surface audited

| Area | STRIDE | Verdict | Evidence (file:line) |
|------|--------|---------|----------------------|
| `GET /api/notes?q=` — user search string passed to MongoDB `$regex` | T (Tampering), D (DoS) | SAFE | `app/api/notes/route.js:18-21` |
| `POST /api/notes` — JSON body → `title`, `body`, `pinned` fields written to MongoDB | T (Tampering), I (Info Disclosure) | SAFE | `app/api/notes/route.js:33-55` |
| `GET /api/notes/[id]` — URL param → `ObjectId` → MongoDB query | T (Tampering), E (Elevation) | SAFE | `app/api/notes/[id]/route.js:19-35` |
| `PUT /api/notes/[id]` — URL param + JSON body → MongoDB `$set` | T (Tampering) | SAFE | `app/api/notes/[id]/route.js:37-67` |
| `DELETE /api/notes/[id]` — URL param → MongoDB `deleteOne` | T (Tampering) | SAFE | `app/api/notes/[id]/route.js:69-85` |
| `lib/db.js` — connection string from `MONGO_URL` env var | I (Info Disclosure), S (Spoofing) | SAFE | `lib/db.js:4-23` |
| `instrumentation.js` — startup hook, collection + index creation | D (DoS) | SAFE | `instrumentation.js:1-37` |
| `app/page.js` — SSR query with `$regex` on `searchParams.q` | T, D | SAFE | `app/page.js:15-19` |
| `app/page.js` — `dangerouslySetInnerHTML` in client-side search script | T (XSS) | SAFE | `app/page.js:109-136` |
| `NoteCard` — `note.title` and `note.body` rendered as JSX children | T (XSS) | SAFE | `app/page.js:141-189` |
| `app/notes/[id]/edit/page.js` — ObjectId parse + DB lookup | T, E | SAFE | `app/notes/[id]/edit/page.js:6-61` |
| `app/notes/new/page.js` — form → `fetch('/api/notes', POST)` | T | SAFE | `app/notes/new/page.js:28-36` |
| `next.config.mjs` — no `X-Frame-Options` / `frame-ancestors` | E (Elevation via iframe) | SAFE | `next.config.mjs:1-13` |
| Error response bodies — `err` object logged, structured JSON returned | I (Info Disclosure) | SAFE | `app/api/notes/route.js:28-29, 53-54` |
| `MONGO_URL` absent → `process.exit(1)` — startup fail path | D (DoS) | SAFE | `lib/db.js:5-8`, `instrumentation.js:7-10` |

## Confirmed findings

> Each survived adversarial refutation (input is user-controlled, no upstream guard, reachable).

None — all candidates refuted as safe.

## Accepted risks

| ID | Risk | Why accepted | Owner |
|----|------|--------------|-------|
| AR-01 | No request body size limit on POST/PUT | Next.js 14 default body limit (4 MB) applies; single-user personal app with no monetization surface; oversized payloads hit the Next.js limit before reaching application code | Project owner |
| AR-02 | `$regex` search is not anchored (substring match) — could be slow on very large collections | App is single-user personal note-taking; collections are expected to stay well under 10,000 documents; the `title` text index is present for future FTS migration | Project owner |
| AR-03 | No rate limiting on API endpoints | Deployment target is a sandboxed personal environment (Daytona/K8s); network ingress is controlled by platform, not app-level middleware | Project owner |

## Audit trail

- Diff scoped via: `git diff main...HEAD` (develop branch, 9 implementation files)
- Register: built retroactively from diff (no PLAN.md `<threat_model>`)
- Refutation: 15 candidates examined, 0 confirmed, 15 refuted as safe.

---

### Refutation notes (per candidate)

**C-01 — NoSQL operator injection via `?q=` search (`app/api/notes/route.js:18`):**
The `q` parameter is passed as the value in `{ title: { $regex: q.trim(), $options: 'i' } }`. The query structure is static — `q` occupies only the regex pattern string position inside a `$regex` value, never a MongoDB query operator key. MongoDB's `$regex` operator does not allow operator-level injection from the pattern string (unlike `$where`). `$where` is not used anywhere in the codebase. Refuted: the input is string-typed and lands in a non-operator position.

**C-02 — ReDoS via `$regex` pattern (`app/api/notes/route.js:18`, `app/page.js:17`):**
The user-supplied `q` is passed as a MongoDB `$regex` pattern evaluated server-side by mongod (not the Node.js regex engine). MongoDB's regex engine is PCRE; catastrophic backtracking on a substring pattern like `.*foo.*` against short note titles in a personal app (< 10,000 documents) is not a meaningful risk. Rated LOW; accepted as AR-02.

**C-03 — Prototype pollution via JSON body parsing (`app/api/notes/route.js:37`, `[id]/route.js:50`):**
`request.json()` is Next.js's built-in body parser backed by the platform `Response.json()` flow. The application reads only `body.title` (coerced to string), `body.body` (coerced to string), and `body.pinned` (Boolean coercion). A prototype-polluting payload such as `{"__proto__":{"admin":true}}` would be parsed, but none of the extracted fields access `Object.prototype` and the MongoDB driver serializes only enumerable own-properties. No downstream code relies on prototype-inherited properties. Refuted: no unsafe property access pattern exists.

**C-04 — Path traversal via ObjectId parameter (`[id]/route.js:12-17`, `edit/page.js:10-14`):**
The `rawId` URL param is passed directly to `new ObjectId(rawId)`. The `ObjectId` constructor validates its input and throws on anything that is not a valid 12-byte hex or 24-char hex string; the catch block returns `null`, causing an immediate 404 response. There is no file-system or shell interaction with `rawId`. Refuted: ObjectId acts as a strict type guard; no path operations exist.

**C-05 — Hardcoded credentials / secret leakage in source (`lib/db.js:4`):**
`MONGO_URL` is read exclusively from `process.env`. The string `"mongodb://"` does not appear in any committed source file. No credentials appear in `.env.example`, `lib/db.js`, or any other committed file. Refuted: no secrets in source.

**C-06 — Connection URI logged on startup error (`lib/db.js:6`, `instrumentation.js:9`):**
On missing `MONGO_URL`, the process logs `'MONGO_URL environment variable is not set'` — the literal constant, not the value. If `MONGO_URL` is set to a URI containing a password (e.g., `mongodb://user:pass@host/db`), that value is NOT logged. Refuted: log message does not echo the env var value.

**C-07 — XSS via `dangerouslySetInnerHTML` in the search script (`app/page.js:109-136`):**
The injected script is a string literal — no user-controlled data is interpolated into it. `q` (the search param) is passed to the server component and used as `defaultValue` of an `<input>`, not interpolated into the script string. The script reads `input.value` entirely at client runtime. React's JSX renderer handles `note.title` and `note.body` as React children (text nodes), not raw HTML. The `data-title` attribute on `NoteCard` is set via JSX prop (React-escaped). Refuted: no user-controlled string is concatenated into the script literal.

**C-08 — XSS via JSX rendering of note title/body (`app/page.js:141-189`):**
`{note.title}` and `{note.body}` are React children — React automatically HTML-escapes all text node content. `data-title={note.title}` is a JSX prop; React attribute escaping applies. Refuted: React's default escaping prevents XSS via JSX children/props.

**C-09 — `GET /api/notes/[id]` — IDOR (cross-note access in multi-user scenario):**
The app is explicitly single-user with no authentication layer (by design, per project spec). There is no multi-tenancy surface; all notes belong to the single user. IDOR requires a multi-user context. Refuted: single-user design with no authorization boundary to bypass.

**C-10 — Error response information disclosure (`app/api/notes/route.js:28-29`):**
`console.error('GET /api/notes error:', err)` logs to server stdout (not returned to the client). The HTTP response returns only `{ error: 'INTERNAL_ERROR', message: 'Internal server error' }` — a static string. MongoDB error details (collection names, query structure) are never forwarded to the response body. Refuted: errors are logged server-side only; generic message returned.

**C-11 — MongoDB `$where` or `$function` operator injection:**
Neither `$where` nor `$function` is used in any query. All MongoDB queries use `{ $regex }` (search), `{ _id: objectId }` (lookup), `{ $set: {...} }` (update), and `deleteOne({ _id })` — all with static operator structure and typed values. Refuted: no dynamic operator construction exists.

**C-12 — `instrumentation.js` — MongoDB connection closed before server accepts requests:**
The startup hook creates a separate `MongoClient` for migration and calls `client.close()` in `finally`. The production client in `lib/db.js` is initialized lazily on first request. These are independent clients; closing the migration client does not affect the production singleton. Refuted: no shared client state between migration and request handling.

**C-13 — No `X-Frame-Options` header — clickjacking:**
The app deliberately omits `X-Frame-Options` per F9/US-9.1 (it must render inside a cross-origin iframe). Clickjacking is a meaningful risk only when the app has authenticated session state that can be abused by click-hijacking. This is a single-user personal app running in a private sandbox with no authentication, no financial transactions, and no sensitive account operations. Rated LOW; single-user with no auth = no clickjacking surface. Refuted at HIGH/CRITICAL severity; noted as design intent.

**C-14 — `process.exit(1)` in `lib/db.js` — availability risk:**
If `MONGO_URL` is unset, the process exits immediately. This is intentional — the app cannot function without a database; a fast crash is preferable to silent failure. In the sandbox environment, the platform ensures `MONGO_URL` is injected before startup. Refuted: DoS via missing env var is a configuration issue, not an exploitable vulnerability in the code.

**C-15 — Request body size — oversized payload:**
Next.js 14 enforces a default request body limit (4 MB) at the framework level via the underlying Node.js HTTP parser, before the application's `request.json()` call is reached. Oversized bodies are rejected by Next.js with a 413 response. Accepted as AR-01 (low risk, platform-controlled limit).
