# Deliverable 5 — Software Design Specification (SDS)

**KB J Capital Co., Ltd. — Corporate Intranet & Public Sync Portal**

**Version:** 1.1.0 · **Status:** Draft (W2-1 truth revision) · **Date:** 2026-09-10 · **Author:** worker-3 → Lead review → CTO approval (W2-1 truth pass: worker-3)

> **Change log** — **1.1.0 (2026-09-10)**: W2-1 truth pass (align to the landed branch code, same treatment as docs 07/08): §3.3 rewritten to the **single legal path** — the Wave-1 direct-publish bypass (PATH A, DCR-3) is closed by FR-NEWS-009 (`stripNewsWorkflowFields` validation-layer strip, submit-approval draft-only + `submittedBy/At` stamps, approve/reject pending-only, submitter ≠ approver for every role, forced edit-reset with AUD-P01 audit, sync logs written only by approve/DELETE/`sync/trigger`); §2.2/§2.3 line references refreshed to the Wave-2 working tree (W2-1 dual-control + W2-2 audit-append removal landed; worker-2's W2-3 audit-coverage WIP is in flight on this branch and is documented in Doc 10 §9.1, not restated here); §7 row 9 and §8 row 0 converted to the decision record (resolved). **1.0.0**: initial AS-BUILT record (Wave-1 gate, approved) — its §3.3 documented the then-live dual-path behavior.

---

## Table of contents

1. [Introduction](#1-introduction)
2. [System decomposition](#2-system-decomposition)
3. [Detailed design](#3-detailed-design)
4. [Data design summary](#4-data-design-summary)
5. [Deployment design](#5-deployment-design)
6. [Security design](#6-security-design)
7. [Design decisions and trade-offs](#7-design-decisions-and-trade-offs)
8. [Planned design changes](#8-planned-design-changes)

---

## 1. Introduction

### 1.1 Purpose

This Software Design Specification describes **how** the KB J Capital intranet
portal is built: the runtime structure of the single-process Express gateway,
the React SPA it serves, the repository-based persistence layer, the
session/RBAC authentication design, the maker-checker publishing state machine,
the file-upload pipeline, and the audit trail. It translates the behavioral
requirements of Deliverable 3 (`03-srs.md`) into an as-built engineering
description suitable for review, maintenance, and Wave-2+ extension.

### 1.2 Scope

Covers the system **as built** from the following sources of truth:
`server.ts` (the entire backend, 2,284 lines), `src/` (React 19 SPA),
`scripts/schema.sql` + `scripts/migrate.js`, `Dockerfile`, `docker-compose.yml`,
and the hardened manifests in `k8s/`. Future work is explicitly marked
`[PLANNED]` and is not part of the built system. Out of scope: full data
column documentation (Deliverable 7 `07-data-dictionary.md`), endpoint-by-
endpoint API contract (Deliverable 8 `08-api-specification.md`, plus the live
machine-readable `GET /api/openapi.json`), and role-matrix rationale
(Deliverable 9 `09-rbac-design.md`).

### 1.3 References

| Ref | Document |
|---|---|
| R1 | `docs/deliverables/03-srs.md` — Software Requirements Specification |
| R2 | `docs/deliverables/06-architecture-diagram.md` — Architecture diagrams (companion to this SDS) |
| R3 | `docs/deliverables/07-data-dictionary.md` — Data dictionary |
| R4 | `docs/deliverables/08-api-specification.md` — API specification |
| R5 | `docs/deliverables/09-rbac-design.md` — RBAC design |
| R6 | `docs/deliverables/10-audit-log-design.md` — Audit log design |
| R7 | `server.ts`, `src/**`, `scripts/schema.sql`, `Dockerfile`, `docker-compose.yml`, `k8s/**` — implementation |
| R8 | `HANDOVER.md` v2.0.0, `README.md` — operator documentation |
| R9 | Bank of Thailand financial-institution governance; Thailand PDPA B.E. 2562 — compliance context |

### 1.4 Design constraints inherited from the charter

- One container image runs in Docker Compose **and** Kubernetes without change.
- Auth, security, and data lanes follow BOT governance expectations
  (dual control for public publishing, actor-stamped audit trail) and PDPA
  accountability.
- English body / Thai-first user-facing strings; Thai/English bilingual UI.

---

## 2. System decomposition

### 2.1 Runtime overview

The system is a **single-process full-stack application**. One Node.js process
(`dist/server.cjs`, bundled from `server.ts` by esbuild) listens on port 3000
and serves three traffic classes over the same port:

1. `/api/*` — JSON REST API (session auth + RBAC),
2. `/uploads/*` — read-only static uploaded files (multer-managed),
3. everything else — the built React SPA (production) or the Vite dev
   middleware with HMR (development).

Backing stores, selected at boot: PostgreSQL 16 via `DATABASE_URL`
(production), or seeded in-memory maps (development fallback). Uploaded files
always live on a filesystem volume under `UPLOAD_DIR`.

The full picture, with diagrams, is Deliverable 6 (`06-architecture-diagram.md`).

### 2.2 Request path — Express middleware chain in actual order

Every HTTP request traverses the middleware stack of `server.ts` in the
following registration order. Route-level middleware (steps 6–9) applies only
to the routes that declare it.

| # | Stage | server.ts | Behavior |
|---|---|---|---|
| 1 | `express.json` / `express.urlencoded` | L45–46 | Body parsing, 10 MB limit each (mirrors the upload cap; larger bodies get a 413 from the final error handler) |
| 2 | Security headers | L49–56 | Sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()` on **every** response |
| 3 | JSON request logger | L59–79 | One structured JSON line per finished request: `{time, method, path, status, durationMs, ip}`. Skips Vite-internal paths (`/@*`, `node_modules`). Ready for Logstash/CloudWatch aggregation |
| 4 | `/api` resource-id guard | L93–113 | Defense-in-depth: rejects id-less mutations (`PUT/PATCH/DELETE /api/news/`) and empty id segments (`/api/news//approve`) with a clean `400 {success:false, error:"Resource id is required"}` before routing. Covers `news, banners, contacts, documents, users, rooms` |
| 5 | Route dispatch | Express router | Matches the specific API route |
| 6 | Login rate limiter (login route only) | L1356–1370, L2014 | `express-rate-limit`: 5 failed attempts / minute / IP, `skipSuccessfulRequests` (fail2ban-style — successful logins never consume budget), draft-7 `RateLimit-*` headers, HTTP 429 with JSON body |
| 7 | Cookie/session parse + `requireAuth` | L1150, L1211–1240 | No `cookie-parser` dependency: `parseCookies` reads the `Cookie` header directly. `requireAuth` extracts the `kbj_session` cookie, verifies the HMAC signature (`timingSafeEqual`), resolves the server-side session record, checks expiry and `isActive`, and attaches the sanitized user (`SafeUser`, no password hash) to `req.user`. Failure → `401 {success:false, error:"Authentication required"}` |
| 8 | RBAC — `requireRole(...)` | L1242–1272 | Per-route role allowlist against `req.user.role` (`admin > checker > maker > staff`). Failure → `403 "Insufficient permissions"` (matrix: R5) |
| 9 | `requireResourceId` (:id routes) | L1274–1286 | Rejects blank/whitespace ids with 400 — second layer behind the step-4 guard |
| 10 | Handler → repository | route bodies | Handlers contain no SQL/storage logic; they call the shared `Repository` interface (`repo.*`), which is either the PostgreSQL or the in-memory implementation |
| 11 | JSON envelope | route bodies | Success: `{success:true, data:…}` (creations add HTTP 201). Failure: `{success:false, error:"…"}`. **Not uniform (DCR-4):** several list endpoints return bare `{data:[…]}` / `{data:[…], total:n}` without the `success` flag, and some 404s return `{error:"…"}` without `success:false`; the SPA client normalizes by unwrapping `json.data ?? json` (`src/api.ts`). Exact shape per endpoint: `08-api-specification.md`; see also §7.8 |
| 12 | `/api` 404 JSON fallback | L2438–2445 | Unmatched `/api/*` (e.g. the retired `/api/k8s/diagnostics`) answers JSON 404 so API clients never receive the SPA's `index.html` |
| 13 | Final error handler | L2450–2472 | Registered last: converts body-parser failures to 400 `Invalid JSON body`, oversized bodies to 413, everything else to 500 `Internal server error` — exactly one log line, no stack spew. `process.on('unhandledRejection')` (L2474–2477) logs and suppresses so a single bad request can never kill the pod |
| 14 | Static mounts | L2226, L2575–2585 | `/uploads` → `express.static(UPLOAD_DIR)` (maxAge 1d, no index, no redirect). Then, in production, `dist/` static assets + `GET *` → `index.html` (SPA fallback); in dev, the Vite middleware is mounted instead |

Boot-time context: `app.set('trust proxy', 1)` (L40) makes `req.ip` reflect
the real client behind the single Docker/K8s ingress hop — used by the rate
limiter and stamped into audit entries.

### 2.3 Backend module inventory

The backend is intentionally one file (`server.ts`) with clearly delimited
functional sections, plus operational scripts.

| Section | server.ts | Contents |
|---|---|---|
| Imports & app bootstrap | L1–46 | express, crypto, fs, path, vite (dev), bcryptjs, express-rate-limit, multer, pg; seed data (`src/data/initialData`) and shared types (`src/types`); `trust proxy 1`; `PORT`/`HOST` |
| Middleware chain | L48–113 | Security headers, JSON logger, `/api` resource-id guard (see §2.2) |
| `Repository` interface | L135–195 | `SessionRecord` + the storage contract: `init / close / checkHealth`, users, sessions, news, banners, contacts, rooms, documents, sync logs, audit logs, and (W2-5) the failed-login budget (`consumeLoginBudget`/`releaseLoginBudget`/`clearLoginBudget`/`purgeStaleLoginBudgets`) |
| `InMemoryRepository` | L197–393 | Dev implementation: arrays/Maps pre-seeded with `INITIAL_*` demo data; audit trail capped at 5,000 entries |
| Canonical PG DDL (`PG_DDL`) | L395–590 | Idempotent DDL applied at boot: enum `user_role_enum`, 9 tables (news carries the W2-1 workflow columns `external_sync_status`/`approved_by`/`approved_at`/`submitted_by`/`submitted_at`), indexes, `updated_at` triggers. Mirrors `scripts/schema.sql` statement-for-statement (kept in lockstep by convention) |
| Row ↔ object mappers | L592–750 | snake_case columns ↔ camelCase TS fields, one mapper per entity; JSON-string-typed `jsonb` parsed defensively |
| `PostgresRepository` | L752–1073 | `pg.Pool` (max 10 clients, 30 s idle timeout); parameterized SQL only; `init()` = connectivity check (`SELECT 1`) → `PG_DDL` → seed-if-empty; `checkHealth()` = `SELECT 1`; shared login-budget store (W2-5, `rate_limit_hits` atomic upsert) |
| Session & crypto core | L1075–1209 | Constants (`kbj_session`, 7-day TTL, bcrypt cost 12); `SESSION_SECRET` production guard; `toSafeUser`; `createUser` (bcrypt hash); HMAC-SHA256 sign/verify (`timingSafeEqual`); `parseCookies`; `createSession`/`resolveSession`/`destroySession`; hourly session sweeper; precomputed `DUMMY_PASSWORD_HASH` |
| Auth middleware & limiter | L1211–1286, L1356–1370 | `req.user` type declaration; `requireAuth`; `requireRole`; `requireResourceId`; login rate limiter |
| News workflow strip (W2-1) | L1288–1295 | `NEWS_WORKFLOW_FIELDS` + `stripNewsWorkflowFields` — deletes `externalSyncStatus`/`approvedBy`/`approvedAt`/`syncToExternal` from every news request body at the validation layer (see §3.3) |
| Audit helper & role labels | L1372–1408 | `recordAudit` (actor always from the session); `ROLE_LABELS` (admin/checker/maker/staff display names); module-level `repo` binding |
| Health probes | L1410–1475 | `GET /healthz|/health|/api/health` (process liveness, uptime, version, pod metadata) and `GET /readyz|/ready|/api/ready` (repository-aware readiness → 503 pulls the pod from rotation) |
| News API + maker-checker | L1477–1788 | `GET/POST/PUT/DELETE /api/news`; `POST /api/news/:id/submit-approval|approve|reject` (state machine §3.3 — workflow fields stripped, forced edit-reset, self-approval barred); sync log written only by approve (and admin DELETE of a synced item) |
| Banners / Contacts / Rooms / Documents / Tools APIs | L1790–1955 | CRUD per the RBAC matrix; rooms add `book`/`release`; tools are served from the static seed list (no table) |
| Sync & audit APIs | L1957–2012 | `GET /api/sync/logs` + `POST /api/sync/trigger` (admin; writes a `FORCE_SYNC` log — no outbound HTTP is performed, `[PLANNED]` §8); `GET /api/audit-logs` (checker+; manual append endpoint removed in W2-2, DCR-8) |
| Auth & user management | L2014–2225 | `POST /api/auth/login` (rate-limited; dummy-hash timing defense; audit on success and failure), `POST /api/auth/logout`, `GET /api/auth/me`; `GET/POST /api/users`, `PATCH /api/users/:id` (activate/deactivate; self-deactivation blocked server-side; strong input validation) |
| File upload pipeline | L2166–2261 | `UPLOAD_DIR` resolution; 10 MB limit; extension whitelist + declared-MIME sanity; UUID filenames; `/uploads` static mount (L2226); `POST /api/upload` (maker/checker/admin; 201/400/413 envelope; `FILE_UPLOAD` audit) |
| OpenAPI document | L2262–2380 | `GET /api/openapi.json` — machine-readable contract kept in sync with the routes |
| System export | L2383–2436 | `GET /api/system/export` (admin) — full JSON dump `{exportTimestamp, version, schemaTarget, storage, counts, tables:{…}}` consumed by `scripts/migrate.js` |
| API 404 + error handler | L2438–2477 | JSON 404 for unmatched `/api/*`; final error handler; unhandledRejection guard |
| Bootstrap users | L2479–2535 | Auto-creates the admin (`ADMIN_USERNAME`/`ADMIN_PASSWORD`; production generates and prints a one-time password if unset — never persisted); dev additionally seeds demo `maker`/`checker`/`staff` accounts |
| `startServer()` | L2537–2628 | Repository selection (`DATABASE_URL` → PostgreSQL, fail-fast `exit(1)` if unreachable; else in-memory with a production warning); hourly session sweeper; Vite middleware (dev) vs static SPA (prod); bootstrap before `listen`; SIGTERM/SIGINT graceful shutdown |

Operational scripts:

| Script | Purpose |
|---|---|
| `scripts/schema.sql` | Canonical, idempotent PostgreSQL DDL for manual provisioning/DBA review/CI; mirrors `PG_DDL` exactly. Auto-applied by compose only on a first, empty `pgdata` volume |
| `scripts/migrate.js` | Imports a `/api/system/export` JSON (reads `payload.tables`) into PostgreSQL; content tables upserted by id |
| `scripts/seed-users.js` | Standalone user seeding helper |
| `scripts/smoke-test.mjs` | End-to-end API/auth/RBAC suite against a running server |
| `tests/e2e-walkthrough.mjs` | Full user-journey walkthrough (see `12-test-plan.md`) |
| `deploy-k8s.sh` | Build+push image, rewrite kustomize image refs, `kubectl apply -k`, wait for rollout |

### 2.4 Frontend module inventory

React 19 + Vite 6 + Tailwind CSS 4 SPA, Thai/English bilingual. Entry:
`index.html` → `src/main.tsx` (mounts `<AuthProvider><App/></AuthProvider>` in
`StrictMode`).

| Module | Size (lines) | Responsibility |
|---|---|---|
| `src/App.tsx` | 1,053 | Root orchestrator: auth gate (splash → `LoginPage` → portal), view switching between exactly three `ViewMode`s (`intranet`, `admin-cms`, `external-web`), role-gated view list (`roleAtLeast(role,'maker')` unlocks CMS + external sync) that also **resets the view state** on role change/logout so the app can never sit on a now-forbidden view; data hydration (public GETs with offline fallback, authenticated GETs that surface errors); all CMS mutation handlers (throw on failure so forms keep their input; local state mutates only after server confirmation); toast system; ⌘K search shortcut |
| `src/api.ts` | 349 | The single fetch layer: same-origin `fetch` with `credentials:'include'` (carries `kbj_session`); parses the `{success,data,error}` envelope; `ApiError` (status 0 = network failure); `publicGet` falls back to bundled sample data and raises a visible **offline flag** (D7) — authenticated calls never fall back; typed wrappers for every endpoint group (auth, users, upload, news, banners, contacts, rooms, documents, sync, maker-checker, audit, export) |
| `src/auth/AuthContext.tsx` | 116 | Session state: restores the session from the cookie via `GET /api/auth/me` on mount (401 → anonymous); `login`/`logout` callbacks; `ROLE_RANK` + `roleAtLeast()` helper (admin 4 > checker 3 > maker 2 > staff 1) used for UI gating |
| `src/types.ts` | 143 | Shared domain types (`NewsItem`, `BannerSlide`, `DirectoryContact`, `MeetingRoom`, `PolicyDocument`, `SyncLog`, `AuditLog`, `User`, `SafeUser`, `UserRole`, `ViewMode`, …) — imported by both `server.ts` and the SPA, the de-facto API wire contract |
| `src/data/initialData.ts` | 706 | Bilingual seed dataset (news, banners, contacts, rooms, documents, tools, sync/audit logs); doubles as the offline fallback data for public GETs |
| `src/components/AdminCMS.tsx` | 3,487 | Self-service CMS dashboard (maker+): tabbed management of news (incl. maker-checker submit/approve/reject controls, checker+ only for approve/reject), banners, contacts, documents, rooms, sync logs, audit trail, and the admin-only User Management tab (list/create/deactivate) |
| `src/components/ExternalPublicSyncView.tsx` | 789 | Preview of content published to the public website (`www.kbjcapital.co.th` styling) with a jump into the CMS |
| `src/components/DirectoryAndRooms.tsx` | 664 | Internal phonebook search + meeting-room plan with book/release actions |
| `src/components/Header.tsx` | 439 | Global header: view switcher (restricted to `allowedViews`), search trigger, alert bell, profile badge with role label, logout |
| `src/components/GlobalSearchModal.tsx` | 362 | Omnibox search across news, contacts, documents, rooms (⌘K) |
| `src/components/LoginPage.tsx` | 389 | Thai/English sign-in screen; surfaces rate-limit and credential errors from the API envelope |
| `src/components/RegulatoryHub.tsx` | 320 | NCB / BOT / PDPA regulatory news hub |
| `src/components/GovernanceAndPolicies.tsx` | 307 | Corporate governance sections + policy document browser |
| `src/components/NewsSection.tsx` | 245 | News & alert grid with category filter |
| `src/components/ArticleDetailModal.tsx` | 214 | Reading modal for news articles and policy documents |
| `src/components/HeroCarousel.tsx` | 135 | Banner carousel (auto-rotating) |
| `src/components/QuickToolsBar.tsx` | 120 | Quick-links bar to internal/external tools |
| `src/components/BrandLogo.tsx` | 82 | Corporate logo component |

Frontend architectural rules as built:

- **No client-side auth decisions**: the SPA only *hides* UI; the server
  enforces RBAC on every route (`requireRole`). A forbidden call still fails
  with 403 server-side.
- **Optimistic-free mutations**: handlers `await` the API and throw on error;
  state changes only after confirmation (no input loss on failure).
- **Offline honesty**: public fallback data is always flagged with the
  `โหมดออฟไลน์ — แสดงข้อมูลตัวอย่าง` badge; authenticated data never silently
  falls back.

---

## 3. Detailed design

### 3.1 Session management and authentication

**Credential storage.** Passwords are hashed with bcrypt at cost factor 12
(`BCRYPT_COST`, L1082) via `bcryptjs` — at cost 12 a single hash/verify costs
hundreds of milliseconds of CPU, which additionally throttles offline
brute-force if the `users` table were ever leaked. No plaintext or reversible
form is stored. `toSafeUser` strips `passwordHash` before any user object
leaves the server.

**Session issue (login).** `POST /api/auth/login` (L2014–2058):

1. Rate limiter runs first: 5 failed attempts/min/IP; only failures consume
   the budget (`skipSuccessfulRequests`), so legitimate rapid logins never
   self-lockout. Since W2-5 the failed-login budget lives in a **shared
   PostgreSQL store** (`rate_limit_hits` atomic upsert via the repository's
   login-budget contract) when `DATABASE_URL` is set — one budget across all
   pods — and per-process in dev memory; a transient store error fails open
   with a logged `WARNING`. Exceeding → `429 {success:false, error:"Too many
   login attempts. Please try again in a minute."}`.
2. The username is looked up case-insensitively; the supplied password is
   compared against the stored hash — or against a **precomputed
   `DUMMY_PASSWORD_HASH`** (L1200) when the user does not exist, so response
   timing does not reveal whether a username is valid.
3. Deactivated accounts (`isActive=false`) fail exactly like bad passwords.
4. On success the server generates `sid = 32 random bytes (base64url)`,
   persists `{sid, userId, createdAt, expiresAt}` through the repository
   (PG `sessions` table / in-memory map), and sets cookie
   `kbj_session = "<sid>.<HMAC-SHA256(sid, SESSION_SECRET)>"` with
   `httpOnly`, `SameSite=Lax`, `Secure` (production only), `Max-Age` 7 days,
   `path=/`.
5. Every login — success **and** failure — writes an audit entry (`LOGIN` /
   `LOGIN_FAILED`) with the client IP.

**Session verification (every authenticated request).** `requireAuth`:
parse cookie → split `sid`/signature → recompute HMAC → compare with
`crypto.timingSafeEqual` (constant time) → load the session record →
reject+delete expired records → load the user → reject deactivated users.
Because validity is re-resolved from the store on every request, an admin
deactivation takes effect on the user's very next request (no token blacklist
needed). A background sweeper deletes expired session rows hourly
(unref'd timer, L2556–2561).

**Secret management.** `SESSION_SECRET` is **mandatory in production** —
missing/empty → `console.error` + `process.exit(1)` at boot (L1084–1092). In
development an ephemeral random secret is generated with a loud warning
(sessions reset on restart, acceptable locally). `NODE_ENV=production`
without `DATABASE_URL` also logs a prominent warning (in-memory stores).

**Logout.** `POST /api/auth/logout` destroys the server-side record,
clears the cookie, and audits `LOGOUT`.

**Bootstrap accounts.** When the user store is empty at boot
(`bootstrapUsers`, L2479–2535): the admin account is created from
`ADMIN_USERNAME`/`ADMIN_PASSWORD`; in production with no password set, a
one-time random password is generated and printed once (never persisted); in
dev, demo `maker`/`checker`/`staff` accounts are also seeded so the RBAC
matrix can be exercised.

### 3.2 Repository pattern (persistence layer)

All handlers depend on the `Repository` **interface** (L135–195) — never on a
driver. Two implementations exist:

| | `PostgresRepository` (L752–1073) | `InMemoryRepository` (L197–393) |
|---|---|---|
| Selected when | `DATABASE_URL` is set | otherwise (dev/demo) |
| Storage | `pg.Pool` (max 10, idle 30 s) over 9 tables | arrays/Maps seeded from `src/data/initialData` |
| `init()` | `SELECT 1` (fail fast, `exit(1)` if unreachable — no silent fallback in production) → apply `PG_DDL` → seed each table only if completely empty | log a hint to set `DATABASE_URL` |
| `checkHealth()` | `SELECT 1` | always `true` |
| Sessions | `sessions` table (survive restarts and pod reschedules) | per-process map (reset on restart) |
| Login budget (W2-5) | shared `rate_limit_hits` store — atomic upsert, one budget across all pods | per-process counters (same contract) |
| Audit trail | append-only rows | in-memory, capped at 5,000 newest |
| SQL safety | parameterized queries only; snake_case↔camelCase mappers | n/a |

Selection happens in `startServer()` (L2537–2553) before the port opens, so
routes always run against the final binding. **`/readyz` reflects repository
health**: in postgres mode a dead database returns 503 and the kubelet pulls
the pod out of Service rotation; `/healthz` stays process-level for restart
decisions. In memory mode readiness asserts the critical stores are hydrated.

The same interface is what makes `/api/system/export` + `scripts/migrate.js`
a supported path to move in-memory/legacy data into PostgreSQL.

### 3.3 Maker-checker state machine (BOT dual control)

Publishing state is modeled on `NewsItem.externalSyncStatus`
(`draft | pending_approval | synced | rejected`; the type also carries
`pending` for display purposes). Since **W2-1** (FR-NEWS-009; DCR-3/DCR-7
resolved, commit `22023eb`) **exactly one path reaches `synced`** — the
dual-control path. The Wave-1 direct-publish bypass (`POST`/`PUT` with
`syncToExternal=true`) is closed: the four workflow fields are deleted from
every news payload at the validation layer (`stripNewsWorkflowFields`,
server.ts L1288–1295, applied at the top of the POST L1499–1533 and PUT
L1535–1616 handlers), so create/update can never
set publication state regardless of role:

```
  THE ONLY PATH TO LIVE — DUAL CONTROL (BOT compliant)
                 POST /api/news (maker/admin)
                 workflow fields stripped ──────────► draft
                 (always draft; no sync log)
                                                   │
              POST /api/news/:id/submit-approval   │   (maker/admin;
              legal from draft only, else 400       │    + WARNING audit)
                                                   ▼
                                           pending_approval
                                       syncToExternal forced false
                                       submittedBy/submittedAt stamped
                                              │            │
     approve (checker/admin; pending-only;     │            │  reject (checker/admin;
     submitter ≠ approver, else 403/400)       │            │  pending-only; reason)
                                              ▼            ▼
                                            synced       rejected
                                  approvedBy/approvedAt   approvedBy =
                                  syncToExternal=true     "Rejected by <checker>: <reason>"
                                  + sync_log CREATE       syncToExternal=false

  EDIT RESET (any non-draft state → draft): PUT /api/news/:id on an item in
  pending_approval / synced / rejected returns it to draft — approval and
  submission stamps cleared, syncToExternal=false (edited-live content drops
  out of the public set). Audited as a forced transition (AUD-P01).
```

As-built properties:

- **Create always enters `draft` with `syncToExternal=false`.**
  Client-supplied `externalSyncStatus`/`approvedBy`/`approvedAt`/
  `syncToExternal` are stripped from the request body itself
  (`stripNewsWorkflowFields`, L1288–1295) — enforced at the validation layer
  so every current and future news mutation endpoint inherits the rule
  without per-route repetition.
- **No sync log on create/update**: `sync_logs` rows are written only by the
  checker approve endpoint, by admin DELETE of a synced item, and by
  `POST /api/sync/trigger` (bulk handshake).
- `submit-approval` requires `maker`/`admin`, is legal from `draft` only
  (400 + `WARNING` audit otherwise), forces `syncToExternal=false` so the
  item is **not live** while awaiting review, and stamps
  `submittedBy`/`submittedAt` so self-approval can be barred downstream.
- `approve`/`reject` require `checker`/`admin` and are legal from
  `pending_approval` only (400 + `WARNING` audit otherwise). The
  **submitter may never approve their own submission — for every role,
  admin included** (403 + `WARNING` audit).
- `approve` stamps `approvedBy`/`approvedAt` (`YYYY-MM-DD HH:MM:SS` UTC
  label), flips `syncToExternal=true`, and appends a `sync_logs` row
  (action `CREATE`, target `api.kbjcapital.co.th/v1/public/news`).
- `reject` records the checker's reason in `approvedBy`
  (`"Rejected by <checker>: <reason>"`) and keeps `syncToExternal=false`.
- **Every transition and every guard rejection writes an audit entry**
  (`SUBMIT_APPROVAL` / `APPROVE` / `REJECT`, status `SUCCESS`/`REJECTED`,
  blocked attempts `WARNING`) stamped with the authenticated actor and IP
  (R6).
- **Content change ⇒ draft** (forced reset, AUD-P01): editing an item in any
  non-draft state resets `externalSyncStatus` to `draft`, clears the prior
  cycle's approval and submission stamps, and sets `syncToExternal=false` —
  modified content never stays public under a stale approval, and a pending
  item cannot be mutated under an open review (TOCTOU).
- Deletion of a synced item is admin-only and also writes a sync log.
- "Synced" currently means **state + log only** — no outbound HTTP call to the
  public site is performed; wiring the real webhook is `[PLANNED]` (§8).
- *History:* through Wave 1 a direct-publish bypass existed and was recorded
  here as PATH A (see v1.0.0); DCR-3 closed it in W2-1. The decision record
  lives in §7 row 9 and §8 row 0.

### 3.4 Upload pipeline

`POST /api/upload` (multipart field `file`; `maker`/`checker`/`admin`;
L1839–1936):

1. **Destination**: `UPLOAD_DIR` (default `./uploads`, `/app/uploads` in
   containers) is created at boot with `mkdirSync(recursive)`.
2. **Size**: multer `limits.fileSize = 10 MB` → `LIMIT_FILE_SIZE` is mapped
   to HTTP **413**; other filter errors → 400, all in the JSON envelope.
3. **Type filtering (two layers)**:
   - `fileFilter` rejects any extension outside
     `.jpg .jpeg .png .webp .gif .pdf .docx .xlsx`, then sanity-checks the
     *declared* MIME type against the extension
     (`EXPECTED_MIME_BY_EXTENSION`; `application/octet-stream` is accepted
     for Office documents because browsers send it).
   - the `filename` callback re-validates and would abort the write even if
     the filter were bypassed (defense in depth).
   - `sanitizeUploadExtension` rejects crafted multi-part extensions
     (`/^[a-z0-9]+$/` on the extension body).
4. **Naming**: files are stored as `<random-UUID>.<ext>` — the client
   filename never touches the filesystem (no traversal, no collision, no
   executable names).
5. **Serving**: `express.static` on `/uploads` with `maxAge: 1d`,
   `index:false`, `redirect:false`; the global `nosniff` header ensures files
   are never sniffed as HTML; express.static rejects traversal.
6. **Audit**: a `FILE_UPLOAD` entry records actor, original name, stored
   name, size, and IP. Response: `201 {success:true, data:{url, fileName,
   size}}`.

Persistence: compose mounts the named `uploads` volume; Kubernetes mounts the
`kbj-intranet-uploads` PVC (RWO) with `fsGroup: 10001` so uid 10001 can write
— see §5.4 for the scaling constraint.

### 3.5 Audit logging (PDPA accountability)

`recordAudit` (L1372–1390) is the single write path. Entries carry:
`actor`, `actorRole`, `action`, `targetResource`, `resourceId`, `details`,
`ipAddress`, `status`, plus server-generated `id` (`audit-<ts>-<hex>`) and
`timestamp`.

- The **actor is always the authenticated session user** (`req.user`) or, for
  failed logins, the attempted username — client-supplied actor strings are
  never accepted.
- Actions as built (from `AuditLog['action']`): `CREATE`, `UPDATE`, `DELETE`,
  `SUBMIT_APPROVAL`, `APPROVE`, `REJECT`, `SYNC_PUBLIC`, `LOGIN`,
  `LOGIN_FAILED`, `LOGOUT`, `USER_CREATE`, `USER_ACTIVATE`,
  `USER_DEACTIVATE`, `FILE_UPLOAD`. Statuses: `SUCCESS` / `REJECTED` /
  `WARNING`.
- **Append-only by construction**: there is no update or delete endpoint or
  SQL path for `audit_logs`; users are deactivated, never deleted, partly to
  keep actor references resolvable.
- Read access: `GET /api/audit-logs` is checker+ (compliance reads its own
  trail). Admins may append explicit entries (`POST`) for manually logged
  operational events.
- Full design rationale and retention discussion: Deliverable 10
  (`10-audit-log-design.md`).

### 3.6 Error handling philosophy

- One JSON envelope everywhere; errors are strings, never stack traces.
- The final handler (L2112–2134) normalizes parser errors (400), oversize
  bodies (413), and unexpected failures (500 with a generic message) and logs
  exactly one line.
- `unhandledRejection` is logged and suppressed — one bad promise can never
  crash the pod.
- API 404s stay JSON (never the SPA HTML shell).

---

## 4. Data design summary

The canonical schema lives in two lockstep places: `PG_DDL` inside
`server.ts` (applied automatically and idempotently at boot) and
`scripts/schema.sql` (manual provisioning / DBA review / CI). Column-level
documentation, constraints, and PDPA data-classification are **deferred to
Deliverable 7 (`07-data-dictionary.md`)** — this section only summarizes the
table inventory.

| Table | Purpose | Notable design points |
|---|---|---|
| `users` | Accounts + bcrypt hashes | role enum (`admin/checker/maker/staff`), `is_active` flag (accounts deactivated, never deleted), `updated_at` trigger |
| `sessions` | Server-side session store | FK → users `ON DELETE CASCADE`, expiry index; swept hourly |
| `news` | Announcements incl. external-sync fields | `external_sync_status`, `sync_to_external`, `approved_by/at`, category/sync-status indexes; `seq bigserial` preserves newest-first ordering deterministically |
| `banners` | Hero carousel | `sort_order` index |
| `contacts` | Staff directory | department/extension indexes |
| `meeting_rooms` | Rooms + current booking | `facilities` and `current_booking` as `jsonb` |
| `documents` | Policy documents | human `updated_at` label + separate `row_updated_at` trigger column |
| `sync_logs` | Public-sync audit of the gateway | seq-ordered newest-first |
| `audit_logs` | Actor-stamped compliance trail | actor/action indexes; append-only (§3.5) |

Cross-cutting conventions: text primary keys (app-generated ids), snake_case
columns mapped to camelCase TS fields by dedicated mappers, idempotent DDL
(`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`), `updated_at`
maintained by triggers (except `documents`, which keeps the human label and
uses `row_updated_at`). Seed data is inserted only into **completely empty**
tables (order reversed where the API lists newest-first so bigserial order
matches the in-memory array order).

---

## 5. Deployment design

### 5.1 One image, two targets

A single multi-stage image (`Dockerfile`, `node:20-alpine`) is the deployment
artifact for both Docker Compose and Kubernetes:

- **build stage**: `npm ci` (dev deps included) → `npm run build` =
  `vite build` (SPA → `dist/`) + `esbuild server.ts --bundle --platform=node
  --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs`.
- **runtime stage**: `npm ci --omit=dev` only, copies `dist/`, creates the
  unprivileged user **uid/gid 10001**, `EXPOSE 3000`, Docker-level
  `HEALTHCHECK` (BusyBox `wget --spider /healthz`, 30 s interval),
  `CMD ["node","dist/server.cjs"]`.

### 5.2 Docker Compose (single host)

`docker-compose.yml` runs `app` + `postgres:16-alpine`:

- `SESSION_SECRET` and `POSTGRES_PASSWORD`/`ADMIN_PASSWORD` are hard-required
  (`:?` interpolation) — the stack refuses to start half-configured.
- `DATABASE_URL` defaults to the compose postgres service; setting it in
  `.env` points at an external database (`up -d --no-deps app`).
- Postgres health check (`pg_isready`, 12×5 s) gates app startup
  (`service_healthy`).
- First boot on an **empty** `pgdata` volume applies `scripts/schema.sql`
  via `docker-entrypoint-initdb.d`; upgrades on existing volumes are a
  manual, deliberate step (§8).
- 5432 is deliberately **not** published to the host — the database stays on
  the internal compose network.
- Named volumes: `uploads` (→ `/app/uploads`), `pgdata`.

### 5.3 Kubernetes (production target)

`k8s/` applied via Kustomize (`kubectl apply -k`, automated by
`deploy-k8s.sh` which also builds/pushes the image and rewrites the kustomize
`images:` block). Contents: `namespace.yaml` (`kbj-intranet`),
`configmap.yaml` (non-secret env), `secret.yaml` (from
`secret.example.yaml`, never committed), `pvc.yaml`, `networkpolicy.yaml`,
`deployment.yaml`, `service.yaml` (ClusterIP 80→3000), `ingress.yaml`, and
`hpa.yaml`.

Deployment hardening as built:

- **Non-root & immutable**: `runAsNonRoot`, uid/gid 10001, `fsGroup: 10001`,
  read-only root filesystem, `allowPrivilegeEscalation: false`, all
  capabilities dropped, `/tmp` as `emptyDir`. The only writable path is the
  uploads PVC (logs go to stdout).
- **Probes**: liveness `/healthz` (restart decisions), readiness `/readyz`
  (endpoint rotation; reflects DB health), startup probe
  (`/healthz`, 30×2 s) protecting slow first starts.
- **Resources**: requests 250 m/256 Mi, limits 1000 m/512 Mi; Prometheus
  scrape annotations.
- **Rolling update**: `maxUnavailable: 0`, `maxSurge: 1`, revision history 5,
  *preferred* pod anti-affinity across nodes.
- **HPA**: 2 → 10 replicas on CPU 75 % / memory 80 % utilization; scale-up
  immediately (100 % / 15 s), scale-down conservative (10 % / 60 s after a
  300 s stabilization window).
- **Ingress**: nginx class, TLS via cert-manager (`letsencrypt-prod`),
  `ssl-redirect: true`, `proxy-body-size: 25m` (comfortably above the 10 MB
  upload cap), hosts `intranet.kbjcapital.co.th` and
  `portal.kbjcapital.co.th` → `kbj-intranet-service:80`.
- **NetworkPolicies** (§6.4): default-deny; ingress only from the
  ingress-controller namespace and same-namespace pods on 3000; egress DNS
  (53 UDP/TCP to `kube-system`) + PostgreSQL (TCP 5432). Requires a
  NetworkPolicy-enforcing CNI (Calico/Cilium/Antrea/Weave).

### 5.4 Uploads persistence and the RWO constraint

Uploads live on the `kbj-intranet-uploads` PVC — **5 Gi, ReadWriteOnce**.
RWO means the volume attaches to exactly one worker node; with 2 replicas and
*preferred* anti-affinity the scheduler tends to co-locate pods on that node
(HA reduced, not broken). The tradeoff note in `k8s/pvc.yaml` is explicit:
before raising HPA maxReplicas or requiring strict anti-affinity, move to RWX
(NFS/Azure Files/CephFS) or object storage — `[PLANNED]` §8.

### 5.5 Graceful shutdown

On `SIGTERM`/`SIGINT` (server.ts L2252–2278): stop the session sweeper →
`server.close()` (stop accepting; drain in-flight) → close the repository /
DB pool → `exit(0)`; a 10 s force-exit backstop guards hung connections.
Kubernetes complements this with `preStop: sleep 5` (let the endpoint
propagation catch up) and `terminationGracePeriodSeconds: 35`, so a rolling
restart or node drain drops no in-flight request.

---

## 6. Security design

### 6.1 Transport & headers

TLS terminates at the ingress (cert-managed); internally everything is
plain HTTP on the pod network guarded by NetworkPolicies. Every response
carries `nosniff`, `SAMEORIGIN`, XSS-Protection, strict-origin-when-cross-
origin referrer policy, and a restrictive Permissions-Policy (§2.2 step 2).
The session cookie is `httpOnly` (no JS access), `SameSite=Lax` (CSRF
resilience for POST-only mutations), and `Secure` in production.

### 6.2 Secrets

Secrets (`SESSION_SECRET`, `ADMIN_PASSWORD`, `DATABASE_URL` credentials)
enter **only via environment**: compose `.env` (excluded from the build
context by `.dockerignore`) or a Kubernetes Secret (`secret.yaml` is created
from `secret.example.yaml` and never committed; kustomization comments remind
operators). The production boot guard refuses to start without
`SESSION_SECRET`. Bootstrap admin passwords are never hardcoded in
production (one-time generated, printed once).

### 6.3 Application-layer defenses

- Brute-force: login rate limit 5 failures/min/IP + bcrypt cost 12.
- Username enumeration: dummy-hash comparison equalizes timing; identical
  `Invalid credentials` error and identical audit shape.
- Session forgery: HMAC-SHA256-signed session ids verified with
  `timingSafeEqual`; server-side store means stealing the secret alone is not
  enough without a valid stored sid, and sids are 256-bit random.
- Authorization: server-side RBAC on every route; the SPA's gating is
  cosmetic only.
- Injection: parameterized SQL everywhere; upload filenames server-generated
  UUIDs; extension + MIME whitelist; `nosniff` prevents content-type
  confusion on `/uploads`.
- Input validation: username `^[a-zA-Z0-9._-]{3,32}$`, password ≥ 8 chars,
  email format, role allowlist, self-deactivation blocked, resource-id
  guards (§2.2 steps 4/9).
- Availability: body-size limits (10 MB app / 25 m ingress), 429 with JSON,
  unhandledRejection suppression, generic 500 messages.

### 6.4 Network isolation (Kubernetes)

Default-deny for the namespace; the app accepts traffic **only** from the
ingress controller and same-namespace pods (TCP 3000); egress is limited to
cluster DNS and PostgreSQL 5432 (any destination today — the DB is external
company infrastructure; tighten to the DB subnet when known). This is the
enforced egress allowlist that any future outbound sync webhook must be
added to (§8).

### 6.5 Governance & PDPA alignment

- **BOT**: maker-checker dual control for public publishing (§3.3) with
  checker ≠ maker enforced by roles.
- **PDPA accountability**: append-only, actor-stamped audit trail (§3.5);
  structured request logs with IP; deactivated-not-deleted accounts
  (retention planning is an operator responsibility, R6/R9). PII flows
  (users table, audit actor, IPs in logs) are diagrammed in Deliverable 6 §6.

---

## 7. Design decisions and trade-offs

| # | Decision | Rationale | Trade-off accepted |
|---|---|---|---|
| 1 | **Single-process monolith** (one Express process serves API + uploads + SPA) instead of split services | At this org scale one process, one port, one image is dramatically simpler to deploy, monitor, and secure; no internal service auth needed; identical in compose and k8s | Vertical scaling per concern is impossible; the HPA scales the whole app; future extraction would follow module boundaries already present (repository interface, `src/types` contract) |
| 2 | **esbuild CJS bundle** for the server (`--format=cjs --packages=external`) | Node-native ESM + `import.meta.url` broke a previous image revision (README §9 troubleshooting); a CJS bundle is deterministic on Node 20 and boots fast | Runtime still needs `node_modules` (`--packages=external`), so the runtime stage reinstalls prod deps; bundle + sourcemap must be kept compatible with deps |
| 3 | **Server-side sessions in the DB** (not JWT) | Instant revocation (deactivation applies on the next request), no token-expiry vs logout dilemma, simpler mental model, cookie is opaque to the client; HMAC-signed sid prevents tampering/enumeration | One repository lookup per authenticated request (cheap, indexed); sessions table needs sweeping (hourly job does it) |
| 4 | **In-memory dev fallback** behind the same `Repository` interface | Zero-config demos and tests; the identical code path runs against PG in production | Data and sessions reset on restart; per-process rate limiting and login-failure tracking (multi-replica enforcement needs a shared store, `[PLANNED]` §8); production without `DATABASE_URL` is loudly warned about, not blocked |
| 5 | **Schema owned by the app** (`PG_DDL` applied at boot) + mirrored `schema.sql` | Fresh environments converge automatically; DBAs still have the canonical script for review/CI | Two copies must be kept in lockstep by convention; no versioned migration tooling yet (§8) |
| 6 | **Uploads on a filesystem volume** (not the DB, not object storage) | Simple, fast, works identically in compose and k8s today | RWO PVC constrains multi-node scaling (§5.4); no dedup; backups must cover the volume |
| 7 | **OpenAPI served by the app** (`GET /api/openapi.json`) | Contract is always reachable and versioned with the running build | Maintained by hand next to the routes — drift is possible and must be caught in review |
| 8 | **Envelope pragmatism** (DCR-4): mutations return `{success,data}`; several list endpoints return bare `{data[,total]}` without the `success` flag, and some 404s return `{error}` without `success:false` (as built); the SPA client normalizes (`api.ts` unwraps `json.data ?? json`) | Backward-compatible evolution of a legacy-shaped API without breaking the SPA | The envelope is not uniform across reads/404s (DCR-4); `08-api-specification.md` documents the exact shape per endpoint; uniformity is a Wave-2 cleanup candidate |
| 9 | **Dual control strictly enforced on the only live path (W2-1; DCR-3/DCR-7 resolved)**: create/update can never set publication state (workflow fields stripped at the validation layer); `synced` is reachable only via checker approve with submitter ≠ approver, admin included; editing any non-draft item resets it to draft (audited, AUD-P01) | The strict BOT reading was ratified at the Wave-1 gate and implemented in W2-1 (commit `22023eb`, FR-NEWS-009); the Wave-1 as-built direct-publish bypass (`syncToExternal=true` → immediate `synced` under a maker/admin check, no audit) is closed | Makers can no longer publish in one step — every public item carries a checker's stamp, and withdrawn/rejected content needs a fresh approval cycle |

---

## 8. Planned design changes

Everything in this section is **`[PLANNED]`** — it is *not* built and must
not be assumed by readers of the code. (Rows 0 and 3 are exceptions:
**resolved decision records**, kept for traceability.)

| # | Change | Current state | Planned design |
|---|---|---|---|
| 0 | **Close the direct-publish bypass (DCR-3) — RESOLVED in W2-1** (was Wave-2 P0) | *Closed by FR-NEWS-009, commit `22023eb`:* `stripNewsWorkflowFields` validation-layer strip on every news mutation; create always `draft`; checker-approve the only path to `synced` (submitter ≠ approver, admin included); forced edit-reset; guard rejections and forced transitions audited (AUD-P01/02/03). Pinned by smoke TC-NEWS-011 / TC-SEC-011 / TC-COMP-001 | *No work remains* — row kept as the decision record (DCR-3/DCR-7 closed; see §3.3, §7 row 9) |
| 1 | **Outbound public-sync webhook** | Sync statuses, `sync_logs`, and `/api/sync/trigger` drive the state machine only; no HTTP call to the public website | Wire a real webhook (e.g. `POST api.kbjcapital.co.th/v1/public/news`) invoked on `approve`/`FORCE_SYNC`, with retries and failure status in `sync_logs`; add the matching **egress 443 rule** to `k8s/networkpolicy.yaml` (already anticipated in its comments) |
| 2 | **Schema migration tooling** | Schema changes apply only to empty volumes (compose init-once) or by hand via `psql -f scripts/schema.sql` | Adopt versioned migrations (e.g. a `migrations/` table + ordered scripts, or a tool such as node-pg-migrate) so upgrades on existing databases are first-class |
| 3 | **Shared failed-login budget store — RESOLVED in W2-5** (RISK-010, commit `1b237cd`) | *Closed:* the failed-login budget lives in PostgreSQL (`rate_limit_hits` atomic window-rollover upsert through the repository's login-budget contract) whenever `DATABASE_URL` is set — one budget across all pods; in-memory dev stays per-process; a transient store error fails open with a logged degradation `WARNING` (see §3.1). Pinned by smoke §15 (opt-in `SMOKE_DATABASE_URL`) | *No work remains* — row kept as the decision record. If a future rate limit (beyond login) needs multi-replica enforcement, Redis or ingress-level consistent hashing remains the pattern |
| 4 | **RWX or object storage for uploads** | 5 Gi RWO PVC — single-writer constraint limits multi-node HA/scaling | Switch the PVC to ReadWriteMany (NFS/Azure Files/CephFS) or move uploads to S3-compatible object storage with the same `Repository`-style abstraction |
| 5 | **Response-envelope uniformity (DCR-4)** | Reads and some 404s return bare `{data[,total]}` / `{error}` without the `success` flag; the SPA normalizes client-side | Decide one canonical envelope (`{success,data,error}` everywhere) and migrate read endpoints in a Wave-2 pass, updating `src/api.ts` and `08-api-specification.md` together |

---

*End of Deliverable 5. Companion diagrams: `06-architecture-diagram.md`.*
