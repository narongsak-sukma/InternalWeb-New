# 03 — Software Requirements Specification (SRS)

**KB J Capital Co., Ltd. — Corporate Intranet & Public-Sync Portal (KB J Capital Intranet Portal 2.0)**

**Version:** 1.5.0 · **Status:** Draft (Wave-2 revision) · **Date:** 2026-09-10 · **Author:** worker-2 → Lead review → CTO approval (W2-2/W2-3 revisions + W2-3 as-built flip: worker-5; W2-5 flip: worker-3)

> **Change log (v1.5.0, W2-3 as-built flip):** FR-AUDIT-003's Wave-2 extension flipped from target state to **AS-BUILT (W2-3 code landed, commit `4650335`)** — the three call-site classes (sync trigger / system export / access denials) are live per Doc 10 §9.1; the audit-union prune is executed (net 14 values = the live writer set, Doc 10 §9.2); flip-pins TC-SYNC-004 / TC-AUDIT-009 / TC-AUDIT-010 asserted in smoke §16 (Doc 12 v1.8.0; TC-SYNC-004 P2→P1). FR-AUDIT-004 and the §2.6 DCR-8 entry trued up in passing (stale "until the W2-2 code phase" clauses → removal **landed `f6fa52d`**). No new FR ids — the 94-REQ inventory is unchanged.

> **Change log (v1.4.0, W2-5 lane):** FR-AUTH-002 acceptance (d) rewritten + (e) added, and the §2 per-pod rate-limit assumption flipped — the failed-login budget is **shared across pods in PostgreSQL** (`rate_limit_hits` atomic upsert) whenever `DATABASE_URL` is set; in-memory dev stays per-process; transient store errors fail open with a logged degradation `WARNING` (W2-5, RISK-010, commit `1b237cd`; no new REQ ids — 94-REQ inventory unchanged).

> **Change log:** v1.3.0 (2026-09-10) — **FR-AUDIT-003 W2-3 extension (doc-first; extension of an existing requirement — no new FR ids, the 94-REQ inventory is unchanged):** enumerated coverage extended with the three ruled W2-3 call-site classes — sync trigger (`SYNC_TRIGGER`), system export (`SYSTEM_EXPORT`), access denials (`ACCESS_DENIED`, lead-ruled trim: 403s + presented-cookie 401s; no-cookie 401s request-log-only) — per Doc 10 §9.1 as ruled/trimmed; W2-1 guard/reset audit reuses noted; flip-pins TC-SYNC-004 / TC-AUDIT-009 / TC-AUDIT-010 (Doc 12 v1.6.0). Target state until the W2-3 code phase lands (queues behind W2-2).

> **Change log:** v1.2.0 (2026-09-10) — DCR-8 (CTO ruling, RISK-023, decision #5/#6: **PREFER REMOVAL**): FR-AUDIT-004 retitled to the removal target state (POST /api/audit-logs → 404; no API audit fabrication outside server-side `recordAudit`); DCR-8 entry added to the §2.6 DCR log. Current as-built (endpoint live) is explicitly preserved in the requirement text until the W2-2 code phase lands. Prior: v1.1.0 CTO-gate revision; v1.0.0 initial.
> **Change log (W2-1, same version):** dual-control enforcement **landed** (DCR-3/DCR-7 + AUD-P01/02/03): FR-NEWS-009 `[PLANNED]` → **AS-BUILT**; FR-NEWS-002/003 acceptance criteria rewritten to the strict behavior (create always `'draft'`, no create/update sync log, workflow fields stripped, non-draft→draft reset on edit); FR-SYNC-001(d) and NFR-COMP-001 as-built-gap notes resolved; §2.6 DCR-3 marked **resolved in W2-1**; §4 inventory counts updated. *Lead-ruling extension (same pass): the forced edit-reset covers ALL non-draft states (`'pending_approval'`/`'synced'`/`'rejected'`) — content change ⇒ draft; edited-live content drops out of the public set until re-approval.*

> **Change log:** v1.1.0 (2026-09-10) — CTO gate REVISE applied: FR-NEWS-009 rewritten to the strict dual-control ruling (post-fix, no role — admin included — may reach `'synced'` outside the checker approve endpoint; state + submitter≠approver guards; server-controlled workflow fields; no admin carve-out; future override = separate break-glass requirement); NFR-COMP-001 aligned; DCR-3 disposition recorded in §2.6. v1.0.0 — initial draft.

Style: IEEE 830. Documents the system **AS BUILT** from `server.ts`, `src/`, `scripts/schema.sql`, `README.md`, `HANDOVER.md`. Future work is explicitly marked `[PLANNED]`. Requirement IDs are binding and referenced by `04-rtm.md` (traceability), `12-test-plan.md` (test cases) and downstream deliverables.

---

## 1. Introduction

### 1.1 Purpose

This document specifies the functional and non-functional requirements of the
KB J Capital intranet web portal ("the portal") as rebuilt on this repository.
It is the requirements baseline for Wave 2 implementation waves, the Wave 3
test/UAT/pentest deliverables (docs 17–21), and the CTO acceptance gate. Every
requirement carries a unique, traceable ID (`FR-<DOMAIN>-<nnn>` /
`NFR-<DOMAIN>-<nnn>`).

### 1.2 Scope

The portal replaces the **outdated legacy intranet web** of KB J Capital Co.,
Ltd. It is a single-process full-stack application that provides:

- Internal communications: corporate news, bulletins and regulatory
  announcements, hero-carousel banners, quick-tools links.
- Staff telephone directory (Thai/English names) and meeting-room booking with
  release control.
- Corporate governance, policies and official forms (policy documents).
- A self-service Admin CMS (news, banners, contacts, documents, rooms) with a
  role-differentiated UI.
- User management (create accounts, activate/deactivate — never delete) from
  the CMS.
- A regulated **maker-checker** workflow for news content cleared for
  publication to the public website (www.kbjcapital.co.th), with an
  actor-stamped immutable audit trail supporting Bank of Thailand (BOT)
  governance and Thailand PDPA B.E. 2562 accountability.
- File uploads (constrained size/type) for CMS content.
- Global search, health probes, OpenAPI contract, full-system JSON export for
  database migration.

**Out of scope (as built):** the outbound HTTP call to the public website —
the public-sync state machine, logs and trigger exist, but no outbound webhook
is wired yet (`[PLANNED]`, see FR-SYNC-004). Also out of scope: the public
website itself, the legacy portal, and customer-facing systems.

### 1.3 Definitions, acronyms and abbreviations

| Term | Meaning |
|---|---|
| Actor | The user or system role performing an operation |
| Anonymous | Unauthenticated visitor (no `kbj_session` cookie) |
| BOT | Bank of Thailand — financial-institution governance regime |
| Checker | Compliance officer role that approves/rejects public-sync submissions |
| Maker | Department author role that creates content and submits for approval |
| Maker-checker | Dual-control workflow: author (maker) and approver (checker) are different role classes |
| PDPA | Thailand Personal Data Protection Act B.E. 2562 (2019) |
| Session token | `<sid>.<HMAC-SHA256(sid)>` value of the `kbj_session` cookie |
| SPA | Single-page application (React 19) |
| Sync status | `externalSyncStatus` lifecycle value on a news item: `draft` → `pending_approval` → `synced` \| `rejected` |
| Safe user | User object with `passwordHash` stripped |
| RBAC | Role-based access control (admin > checker > maker > staff) |
| Repository | Persistence layer interface with PostgreSQL and in-memory implementations |

### 1.4 References

1. `README.md` — operational quickstart, environment variables, security notes, known limitations.
2. `HANDOVER.md` — architecture, auth/RBAC matrix (§3–§4), API table (§5), deployment hardening (§8–§9).
3. `scripts/schema.sql` — canonical PostgreSQL 16 schema and data constraints.
4. `server.ts` — behavioral source of truth (Express 4 gateway, routes, middleware).
5. `src/` — React 19 SPA (`App.tsx`, `components/*`, `api.ts`, `auth/AuthContext.tsx`, `types.ts`).
6. `scripts/smoke-test.mjs`, `tests/e2e-walkthrough.mjs` — existing automated verification.
7. `docs/deliverables/04-rtm.md` — requirements traceability matrix (companion document).
8. Bank of Thailand IT-governance guidance; Thailand PDPA B.E. 2562 (compliance context, referenced by `HANDOVER.md`).

### 1.5 Overview

Section 2 gives the overall description (product perspective, user classes,
environment, constraints, assumptions). Section 3 lists the specific
requirements — 63 functional (§3.1, 13 domains) and 31 non-functional
(§3.2, 6 domains) — each with inputs, outputs and testable acceptance
criteria. Section 4 summarizes requirement counts per domain.

---

## 2. Overall description

### 2.1 Product perspective

The portal is a **single-process Express 4 TypeScript gateway** (`server.ts`,
bundled to `dist/server.cjs`) that in one port (default 3000):

- serves the JSON API under `/api/*` (session auth + RBAC middleware),
- serves uploaded files read-only under `/uploads/*` (multer disk storage, `UPLOAD_DIR`),
- serves the built React SPA from `dist/` in production (SPA fallback to
  `index.html`), or mounts Vite middleware in dev,
- exposes `/healthz` and `/readyz` probes and `GET /api/openapi.json`.

Behind the routes sits a **repository layer** with two implementations
selected at boot: `PostgresRepository` (PostgreSQL 16 via `DATABASE_URL`,
pool max 10) or `InMemoryRepository` (dev fallback; data resets on restart).
Production runs the same container image under Docker Compose
(app + postgres) or Kubernetes (`k8s/` manifests: namespace, ConfigMap,
Secret, PVC, NetworkPolicies, Deployment, Service, Ingress, HPA 2→10).

### 2.2 Product functions (summary)

Authentication and sessions (login, logout, rate limiting, 7-day server-side
sessions); user lifecycle (bootstrap admin, create, activate/deactivate);
news with maker-checker public-sync workflow; banners; contacts directory;
policy documents; meeting-room booking/release; self-service Admin CMS with
role-differentiated capabilities; constrained file upload; global search
(⌘K); immutable audit trail; sync state machine with logs and admin trigger;
system export for database migration; health/readiness probes; OpenAPI
contract publication.

### 2.3 User classes and characteristics

| Class | Role value | Description | Key capabilities |
|---|---|---|---|
| IT Administrator | `admin` | IT administrator (intended: IT staff) | Everything: user management, deletes, sync trigger, system export, audit trail |
| Compliance Checker | `checker` | Compliance officer / VP | Read + approve/reject public-sync submissions, audit logs, uploads |
| Department Maker | `maker` | Departmental author | Create/edit news, banners, contacts, documents; submit for approval; upload files |
| Staff | `staff` | Every employee | Read authenticated content, book/release meeting rooms |
| Anonymous visitor | — | Unauthenticated browser | Login screen; public reads only (news, banners, tools, rooms, probes, openapi.json) |

Roles are rank-ordered (`admin` > `checker` > `maker` > `staff`) and enforced
both server-side (`requireRole`) and client-side (`roleAtLeast`). Deactivated
users are rejected at login and their existing sessions stop resolving.

### 2.4 Operating environment

- **Server runtime:** Node.js 20+ (Node 24 used in development), single process; Linux containers (Alpine).
- **Database:** PostgreSQL 16 when `DATABASE_URL` is set (docker-compose `postgres:16-alpine` or external); in-memory stores otherwise (dev only).
- **Deployment targets:** Docker Compose (single host) or Kubernetes with Kustomize (hardened manifests, non-root uid 10001, read-only root filesystem).
- **Network:** TLS terminates at the ingress/reverse proxy; the app listens HTTP on `PORT`/`HOST` (default 3000/0.0.0.0); `trust proxy` = 1 hop so `req.ip` reflects the real client.
- **Client:** modern evergreen browser; Thai-first bilingual UI.

### 2.5 Design and implementation constraints

1. **Language:** TypeScript ~5.8 (ES2022, `moduleResolution: bundler`) end to
   end; `npm run lint` (`tsc --noEmit`) is the type gate.
   *DCR note:* `tsconfig.json` does not currently enable `"strict": true` —
   see DCR-6 in §2.6 (DCR numbering follows the repo-wide register,
   PROJECT-STATE.md §8); as built the codebase is not compiled in strict mode.
2. **Backend:** Express 4 gateway in one file (`server.ts`); Express
   middleware chain only (no nested microservices); `express-rate-limit`,
   `multer`, `bcryptjs`, `pg` dependencies.
3. **Frontend:** React 19 + Vite 6 + Tailwind CSS 4 SPA; no router library
   (view state in `App.tsx`); lucide-react icons.
4. **Thai-first UI:** user-facing strings are Thai-first with English
   secondary labels (e.g. "เข้าสู่ระบบ / Sign in"); no runtime language
   switch (single bilingual render).
5. **Configuration via environment only:** `DATABASE_URL`, `SESSION_SECRET`,
   `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `UPLOAD_DIR`, `PORT`, `HOST`. Secrets
   are never baked into the image.
6. **One port, one process;** the same image runs in compose and Kubernetes.
7. **Schema parity:** server-boot DDL (`PG_DDL`) and `scripts/schema.sql` must
   stay in lockstep; schema upgrades on existing databases are manual.
8. **Audit and sync logs are append-only** (BOT/PDPA immutability); user
   accounts are deactivated, never deleted.

### 2.6 Assumptions and dependencies

- The ingress/reverse proxy supplies TLS and exactly one proxy hop.
- PostgreSQL 16 is operated with persistent volumes (`pgdata`) and routine
  backups by the operator; the app does not perform database backups itself.
- The NetworkPolicy-enforcing CNI is available in the target cluster (else
  k8s network isolation is not enforced).
- Uploaded files live on a volume (`uploads` named volume / 5Gi RWO PVC);
  multi-replica write access is constrained by RWO until moved to RWX/object
  storage.
- Login failed-budget tracking is **shared across replicas when PostgreSQL is
  configured** (W2-5, RISK-010: `rate_limit_hits` atomic upsert through the
  repository's login-budget contract — one budget for every pod); in-memory
  dev mode remains per-process (5/min/IP). A transient shared-store error
  fails open with a logged degradation `WARNING`.
- `[PLANNED]` The public website exposes a webhook endpoint for outbound sync
  (not yet integrated).

**DCR log (lead-numbered; CTO ratifies dispositions at the Wave-1 gate):**

- **DCR-1 (field name):** the system-export timestamp field is
  `exportTimestamp`, **not** `generatedAt`. Documented as built in
  FR-SYNC-006; any doc claiming `generatedAt` is corrected against it.
- **DCR-6 (constraint mismatch):** "TypeScript strict" is claimed in project
  conventions, but `tsconfig.json` lacks `"strict": true`. Decide whether to
  enable strict mode (may surface type errors to fix in Wave 2) or amend the
  documented constraint. Documented as built in §2.5 / NFR-MAINT-001.
- **DCR-3 (compliance):** `POST /api/news` with `syncToExternal: true` created
  the item directly with `externalSyncStatus: 'synced'`
  (`server.ts:1306,1315` pre-fix), and `PUT /api/news/:id` re-synced likewise
  (`server.ts:1346` pre-fix) — **without checker approval**, bypassing maker-checker
  dual control. Documented as built in FR-NEWS-002/003 acceptance criteria;
  remediation requirement **FR-NEWS-009** added. HANDOVER §4
  describes public-sync publishing as maker-checker. **CTO ruling (Wave-1
  gate, REVISE): strict dual control** — post-fix, no role (admin included)
  may reach `'synced'` outside the checker approve endpoint, with state and
  submitter ≠ approver guards; full guard set in FR-NEWS-009. Any future
  admin override must be a separate, explicitly risk-accepted break-glass
  requirement (out of scope). **RESOLVED in W2-1 (v1.2.0): FR-NEWS-009 is now
  AS-BUILT** — create always persists `'draft'` (no create/update sync log),
  workflow fields are stripped at the validation layer, and the state +
  submitter ≠ approver guards are enforced on submit/approve/reject.
- **DCR-4 (API contract):** the response envelope is **mixed as built** —
  reads return bare `{data[, total]}` without a `success` field; mutations
  return `{success:true, data}`; auth/validation failures return
  `{success:false, error}`; but per-resource 404s and room booking errors
  return bare `{error}` without `success`. Documented as built in
  NFR-MAINT-006; consumers must not assume a `success` field on reads.
- **DCR-5 (state model):** at runtime `externalSyncStatus` only ever holds
  `draft`, `pending_approval`, `synced`, `rejected`. The TypeScript union
  (`src/types.ts:28`) additionally declares `'pending'`, which is never
  produced at runtime (dead union member); no `'approved'` status exists.
  Documented as built in FR-SYNC-001.
- **DCR-8 (audit integrity — REMOVAL ruled):** `POST /api/audit-logs`
  (manual audit append, admin-only) lets an admin insert arbitrary
  `action`/`details` rows into the compliance trail, eroding the trail's
  evidentiary value (RISK-023). **CTO ruling (Wave-2, decision #5/#6): PREFER
  REMOVAL.** Target state (FR-AUDIT-004): the endpoint answers 404 and audit
  rows are appended **exclusively** by server-side `recordAudit()`; the audit
  action set enumerated in FR-AUDIT-003 remains the complete set. The
  current as-built (endpoint live, FR-AUDIT-004 v1.1.0 behavior) was kept in
  force doc-first per PROJECT-STATE §7 until the W2-2 code phase —
  **executed at `f6fa52d`: the route is removed (404 every role; tombstone
  in `server.ts`) and TC-AUDIT-008 / TC-RBAC-026 are flipped and asserted in
  the default smoke suite.**

---

## 3. Specific requirements

Conventions used for every requirement: **Actor** (who invokes it), **Inputs**
(what is supplied), **Outputs** (what the system returns/persists), and
**Acceptance criteria** (testable statements, typically HTTP status / state /
audit outcomes). Public = reachable anonymously. Authenticated = valid
`kbj_session`. "Audited" = an `audit_logs` entry is appended (FR-AUDIT-001).

### 3.1 Functional requirements

#### 3.1.1 Authentication (AUTH)

**FR-AUTH-001 — User login.**
Users sign in with username + password to obtain a session.
Actor: anonymous. Inputs: `POST /api/auth/login` JSON `{username, password}`.
Outputs: on success HTTP 200 `{success:true, data:<safe user>}` and a `kbj_session` cookie (FR-SES-001/003); audit `LOGIN`; on invalid credentials HTTP 401 `{success:false, error:"Invalid credentials"}`.
Acceptance: (a) active user with correct password → 200 + cookie; (b) wrong password, unknown username, or deactivated user → 401 with an identical generic error body; (c) malformed body (missing/non-string fields) → 401; (d) successful login appends a `LOGIN` audit entry with the actor's username, role label and IP.

**FR-AUTH-002 — Login rate limiting.**
Brute-force protection on the login endpoint.
Actor: anonymous (per source IP). Inputs: repeated `POST /api/auth/login`.
Outputs: HTTP 429 `{success:false, error:"Too many login attempts. Please try again in a minute."}` once the budget is exhausted; `RateLimit-*` draft-7 standard headers; no legacy headers.
Acceptance: (a) more than 5 **failed** logins per minute per IP → 429; (b) successful logins do not consume the budget (`skipSuccessfulRequests`); (c) budget resets after the 1-minute window; (d) the limit is per IP, and the failed-login budget is **shared across pods in PostgreSQL** (`rate_limit_hits` atomic upsert) whenever `DATABASE_URL` is set — in-memory dev mode remains per-process (documented limitation); (e) a transient shared-store error **fails open** with a logged degradation `WARNING` — a database blip never locks every user out (W2-5, RISK-010).

**FR-AUTH-003 — User logout.**
Destroy the current session.
Actor: any session holder. Inputs: `POST /api/auth/logout` with session cookie.
Outputs: HTTP 200 `{success:true}`; session record deleted; cookie cleared. If a session was found, audit `LOGOUT` (actor resolved from the session; `unknown-user:<id>` if the user no longer exists).
Acceptance: (a) after logout, the cookie no longer authenticates `GET /api/auth/me` (401); (b) logout without a cookie still returns 200; (c) a destroyed session is not reusable.

**FR-AUTH-004 — Current session identity.**
The SPA resolves who is signed in.
Actor: any session holder. Inputs: `GET /api/auth/me` with session cookie.
Outputs: HTTP 200 `{success:true, data:<safe user>}`; without a valid session HTTP 401.
Acceptance: (a) valid cookie → the user's `id, username, displayName, email, role` (never `passwordHash`); (b) no/expired/tampered cookie → 401.

**FR-AUTH-005 — Anti-enumeration on login.**
Login must not reveal whether a username exists.
Actor: anonymous. Inputs: login attempts for existing and non-existing usernames with wrong passwords.
Outputs: identical 401 response; bcrypt comparison against a precomputed dummy hash when the user is unknown.
Acceptance: (a) response bodies identical for unknown-user and wrong-password; (b) server-side timing of the two failure cases is uniform (both perform one bcrypt cost-12 comparison); (c) no error message names the account state.

**FR-AUTH-006 — Failed-login auditing.**
Every failed login is recorded for compliance review.
Actor: system (on behalf of anonymous). Inputs: any 401 outcome of FR-AUTH-001.
Outputs: audit entry `LOGIN_FAILED`, `status:"WARNING"`, actor = attempted username, `actorRole:"Anonymous"`, resourceId = user id (if resolved) or the attempted username, details quote the attempted username, IP recorded.
Acceptance: after each failed login, `GET /api/audit-logs` (checker+) contains a matching `LOGIN_FAILED` entry.

#### 3.1.2 Session management (SES)

**FR-SES-001 — Signed session token creation.**
Sessions use unpredictable ids with server-side records and tamper-evident cookies.
Actor: system (login). Inputs: authenticated user id.
Outputs: `sid` = 32 random bytes (base64url), persisted with `createdAt`/`expiresAt` (now + 7 days); cookie value = `<sid>.<HMAC-SHA256(sid, SESSION_SECRET)>`.
Acceptance: (a) cookie tampering (altering sid or signature) fails verification and yields 401; (b) signature comparison is constant-time (`timingSafeEqual`); (c) each login creates a distinct sid.

**FR-SES-002 — Session persistence.**
Sessions survive process restarts in database mode.
Actor: system. Inputs: `DATABASE_URL` set (PostgreSQL `sessions` table) or in-memory map (dev).
Outputs: session records retrievable by sid until expiry.
Acceptance: (a) in PG mode, an active session still authenticates after a server restart; (b) in in-memory mode sessions reset on restart (documented dev behavior); (c) expired sessions are not resolvable and are deleted on access.

**FR-SES-003 — Session cookie attributes.**
The cookie is protected per browser best practice.
Actor: system. Inputs: —. Outputs: `kbj_session` cookie with `httpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age` 7 days, and `Secure` when `NODE_ENV=production` (set on login and cleared on logout with the same flags).
Acceptance: (a) `Set-Cookie` carries all listed attributes; (b) in production `Secure` is present, in dev absent; (c) JS `document.cookie` cannot read the session cookie (httpOnly).

**FR-SES-004 — Session validation and revocation semantics.**
Every authenticated request revalidates the session.
Actor: system (`requireAuth`). Inputs: request with cookie.
Outputs: 401 when the token fails verification, the session is missing/expired (expired record deleted), the user no longer exists, or the user is deactivated; otherwise the safe user is attached to the request.
Acceptance: (a) an admin deactivating a user immediately invalidates that user's existing sessions (next request → 401); (b) an expired session returns 401 and is purged.

**FR-SES-005 — Expired-session sweeper.**
Background cleanup of expired sessions.
Actor: system. Inputs: —. Outputs: hourly `deleteExpiredSessions` (SQL `DELETE ... WHERE expires_at < NOW()` or in-memory filter); the interval is unref'd (never holds the process open) and is cleared on shutdown.
Acceptance: (a) expired rows are removed within ~1 hour; (b) the sweeper does not prevent process exit.

**FR-SES-006 — Mandatory session secret in production.**
`SESSION_SECRET` gates production boot.
Actor: operator/system. Inputs: `SESSION_SECRET` env (32+ random characters recommended).
Outputs: with `NODE_ENV=production` and no secret, the process logs `FATAL` and exits(1); in dev an ephemeral random secret is generated with a warning.
Acceptance: (a) production boot without `SESSION_SECRET` fails fast; (b) dev boot without it succeeds with a warning.

#### 3.1.3 User management (USER)

**FR-USER-001 — List user accounts.**
Actor: admin. Inputs: `GET /api/users`.
Outputs: HTTP 200 `{data:[<safe user>...]}` ordered by `created_at, username`; each item excludes `passwordHash`.
Acceptance: (a) admin gets 200; (b) checker/maker/staff/anonymous get 403/401 per RBAC; (c) no response item contains a password hash.

**FR-USER-002 — Create user account.**
Actor: admin. Inputs: `POST /api/users` JSON `{username, password, displayName, email, role}`.
Validation: username trimmed, 3–32 chars matching `[a-zA-Z0-9._-]`; password ≥ 8 chars; displayName non-blank; email matches basic `user@host.tld` shape; role ∈ {admin, checker, maker, staff}; username unique.
Outputs: 201 with the created safe user (bcrypt cost 12 hash stored, `isActive:true`, UUID id); audit `USER_CREATE`; failures 400 (validation) / 409 (duplicate username) with descriptive errors.
Acceptance: (a) valid payload → 201 and the user can log in; (b) each invalid field → 400 with that field's message; (c) duplicate username → 409; (d) audit entry records the creating admin, the new username and role.

**FR-USER-003 — Activate / deactivate account.**
Actor: admin. Inputs: `PATCH /api/users/:id` JSON `{isActive: boolean}` (`is_active` also accepted).
Outputs: 200 with the updated safe user; audit `USER_ACTIVATE` or `USER_DEACTIVATE`; 404 unknown id; 400 when `isActive` is missing/non-boolean or when the admin targets their own account for deactivation ("You cannot deactivate your own account.").
Acceptance: (a) deactivation makes the next login fail (401) and kills existing sessions (FR-SES-004); (b) reactivation restores login; (c) self-deactivation is blocked server-side with 400; (d) both transitions are audited.

**FR-USER-004 — No-delete lifecycle.**
Accounts are never destroyed.
Actor: — (constraint). Inputs: —.
Outputs: no user-delete API exists; deactivated records are retained for audit-trail integrity.
Acceptance: (a) no HTTP verb/route deletes a user; (b) a deactivated user remains listed with `isActive:false` indefinitely; (c) the CMS User Management UI offers only activate/deactivate (with an explicit "ไม่มีการลบข้อมูล / nothing is deleted" confirmation).

**FR-USER-005 — Bootstrap administrator.**
An admin account exists on first boot.
Actor: system. Inputs: `ADMIN_USERNAME` (default `admin`), `ADMIN_PASSWORD`.
Outputs: when the users store is empty, an `admin`-role user is created before the port opens; in production with no `ADMIN_PASSWORD`, a one-time random password is generated and printed once (never persisted); in dev, demo accounts `maker` / `checker` / `staff` are also created with known dev passwords, and the dev default password is `ChangeMe@KBJ2026!`.
Acceptance: (a) empty store → exactly one admin exists at first login opportunity (no login race); (b) non-empty store → no bootstrap user is added; (c) production boot without `ADMIN_PASSWORD` prints a one-time password and does not store it.

#### 3.1.4 News & announcements (NEWS)

**FR-NEWS-001 — Browse and search news.**
Actor: public. Inputs: `GET /api/news?category=<value>&search=<q>` (`all`/absent = no filter).
Outputs: 200 `{data:[NewsItem...], total}`; category filter matches `category`; search matches (case-insensitive) `title`, `titleEn`, `summary`, or `department`.
Acceptance: (a) anonymous request succeeds; (b) category filter returns only that category; (c) search matches Thai or English title text case-insensitively; (d) `total` equals the returned array length.

**FR-NEWS-002 — Create news item.**
Actor: maker, admin. Inputs: `POST /api/news` JSON with title/summary/content/category etc. (server applies defaults, e.g. title default "ประกาศใหม่", author default = caller's display name).
Outputs: 201 with the created item; when `syncToExternal` is true at creation, `externalSyncStatus` is initialized to `'synced'` and a `CREATE` sync log is written; otherwise status is `'draft'`.
Acceptance: (a) maker or admin → 201; staff/checker → 403; anonymous → 401; (b) created item is readable via FR-NEWS-001; (c) the item is always created with `externalSyncStatus:'draft'` and `syncToExternal:false` — client-supplied `syncToExternal`/`externalSyncStatus`/`approvedBy`/`approvedAt` are stripped (FR-NEWS-009); (d) create writes **no** `sync_logs` row (a sync log is written only by checker approve). *(Pre-W2-1 as-built gap (DCR-3) removed — see §2.6.)*

**FR-NEWS-003 — Update news item.**
Actor: maker, admin. Inputs: `PUT /api/news/:id` with partial item JSON.
Outputs: 200 with the merged item (the `id` in the URL is authoritative — body id cannot change it); 404 for unknown id; blank/whitespace id → 400 (`requireResourceId`); when the updated item has `syncToExternal`, an `UPDATE` sync log is written.
Acceptance: (a) unknown id → 404; (b) `id` cannot be reassigned; (c) `PUT /api/news/%20` → 400; (d) staff/checker → 403; (e) the update can never change workflow state: client-supplied `externalSyncStatus`/`approvedBy`/`approvedAt`/`syncToExternal` are stripped (FR-NEWS-009) and update writes **no** `sync_logs` row; (f) editing an item in **any non-draft state** (`'pending_approval'`, `'synced'`, `'rejected'`) resets it to `'draft'` — prior approval/submission stamps cleared and `syncToExternal` set false so modified content never stays public under a stale approval nor mutates under an open review (forced transition audited — AUD-P01). *(Pre-W2-1 as-built gap (DCR-3) removed — see §2.6.)*

**FR-NEWS-004 — Delete news item.**
Actor: admin. Inputs: `DELETE /api/news/:id`.
Outputs: 200 `{success:true, message:"Deleted successfully"}`; if the deleted item had `syncToExternal`, a `DELETE` sync log is written.
Acceptance: (a) admin → 200 and the item disappears from listings; (b) maker/checker/staff → 403; (c) id-less DELETE (`DELETE /api/news/`) → 400 from the resource-id guard.

**FR-NEWS-005 — Submit for approval (maker).**
Actor: maker, admin. Inputs: `POST /api/news/:id/submit-approval`.
Outputs: 200 with the item transitioned to `externalSyncStatus:'pending_approval'` and `syncToExternal:false` ("not live until approved"); audit `SUBMIT_APPROVAL` (details quote the title, ≤30 chars) with the submitting actor and IP; 404 unknown id.
Acceptance: (a) after submit, status is `pending_approval` and the item is not externally live; (b) audit trail contains the submission; (c) staff/checker → 403.

**FR-NEWS-006 — Approve for public sync (checker).**
Actor: checker, admin. Inputs: `POST /api/news/:id/approve`.
Outputs: 200 with the item transitioned to `externalSyncStatus:'synced'`, `syncToExternal:true`, `approvedBy:<checker username>` and `approvedAt:<YYYY-MM-DD HH:MM:SS>`; audit `APPROVE`; a `CREATE` sync log attributed to the checker; 404 unknown id.
Acceptance: (a) the item records the approving checker identity and timestamp (maker-checker evidence); (b) audit + sync log entries exist; (c) maker/staff → 403.

**FR-NEWS-007 — Reject with reason (checker).**
Actor: checker, admin. Inputs: `POST /api/news/:id/reject` JSON `{reason?}` (default "Content revised or missing mandatory regulatory wording.").
Outputs: 200 with the item at `externalSyncStatus:'rejected'`, `syncToExternal:false`, `approvedBy:"Rejected by <checker>: <reason>"`; audit `REJECT` with `status:"REJECTED"`; 404 unknown id.
Acceptance: (a) rejection reason (supplied or default) is persisted on the item and in the audit entry; (b) maker/staff → 403.

**FR-NEWS-008 — Important-alert designation.**
Urgent items can be flagged to surface portal-wide.
Actor: maker, admin (create/update). Inputs: `isImportantAlert: boolean` on create/update.
Outputs: stored on the item; the SPA header surfaces an unread-alert indicator that opens the flagged article modal.
Acceptance: (a) an item created with `isImportantAlert:true` shows the header alert affordance while it is the current flagged item; (b) flagging is per-item data, persisted and returned by the API.

**FR-NEWS-009 — Enforce strict dual control on public publishing.**
The public-sync status `'synced'` is reachable **only** through the checker approve endpoint — by **no role, admin included** — and all workflow fields are server-controlled. Amends the semantics of FR-NEWS-005/006/007 as follows. **Implemented in W2-1** (see Status).
Actor: all roles (maker, checker, admin).
Controls (as built):
- Create/update (`POST /api/news`, `PUT /api/news/:id`): the workflow fields `externalSyncStatus`, `approvedBy`, `approvedAt` and the `syncToExternal` flag are **server-controlled** — client-supplied values for these fields are stripped at the validation layer (`stripNewsWorkflowFields`, applied to the request body so all current and future news mutation endpoints inherit it), and a new item is persisted as `'draft'` with `syncToExternal:false`; create/update write **no** `sync_logs` row.
- Submit (FR-NEWS-005): accepted only when the item is in `'draft'`; any other state → 400. The submitter identity is persisted on the item (`news.submitted_by` user id + `submitted_at`) for the self-approval guard, and the SUBMIT_APPROVAL audit entry names the submitter.
- Approve/reject (FR-NEWS-006/007): accepted only when the item is in `'pending_approval'`; any other state → 400. Additionally, the approver identity must differ from the submitter identity (**submitter ≠ approver guard**, compared as user ids via `submitted_by`); a self-decision attempt → 403.
- Forced transition: **content change ⇒ draft** — editing an item in any non-draft state (`'pending_approval'`, `'synced'`, `'rejected'`) resets it to `'draft'`, clearing the prior cycle's approval/submission stamps and setting `syncToExternal:false` (the item drops out of the live public set until a checker re-approves; a pending item cannot be mutated under an open review). The only legal path is `draft → pending_approval → synced|rejected`; only checker approve makes content live.
Outputs (as built): `'synced'` (with `approvedBy`/`approvedAt` stamps and `syncToExternal:true`) can only be produced by a valid checker approve of a `'pending_approval'` item that was submitted by a different identity; every path remains audited (FR-AUDIT-003) — forced transitions and guard rejections each write an audit row with the reason in `details` (AUD-P01/02/03).
Acceptance: (a) no role — including admin — can produce `'synced'` via create/update or via any endpoint other than checker approve; (b) approve/reject on an item not in `'pending_approval'` → 400; (c) approve by the same identity that submitted the item → 403; (d) submit-approval on an item not in `'draft'` → 400; (e) client-supplied `externalSyncStatus`/`approvedBy`/`approvedAt`/`syncToExternal` in create/update payloads have no effect on persisted state; (f) regression tests cover each guard (a)–(e) (`scripts/smoke-test.mjs` maker-checker section, TC-SEC-011/TC-COMP-001).
Status: **AS-BUILT (W2-1, v1.2.0)** — implemented in `server.ts` (`stripNewsWorkflowFields` validation-layer strip; guards on submit-approval/approve/reject; `news.submitted_by`/`submitted_at` columns in `scripts/schema.sql` and the server DDL, lockstep per NFR-MAINT-004). *Note:* any future admin override capability must be introduced as a separate, explicitly risk-accepted **break-glass requirement** — it is explicitly out of scope for the current requirements.

#### 3.1.5 Hero banners (BANNER)

**FR-BANNER-001 — List banners (public).**
Actor: public. Inputs: `GET /api/banners`.
Outputs: 200 `{data:[BannerSlide...]}` in stable order (PG: insertion order via `seq`; in-memory: append order).
Acceptance: anonymous request returns the carousel set including `sortOrder` and `isActive` fields.

**FR-BANNER-002 — Create banner.**
Actor: maker, admin. Inputs: `POST /api/banners` JSON (title, subtitle, badge, imageUrl, actionUrl, actionText, order, isActive; defaults applied, e.g. actionText "อ่านรายละเอียด", order = list length + 1, isActive = true).
Outputs: 201 with the created banner; staff/checker → 403.
Acceptance: (a) created banner appears in `GET /api/banners` and the hero carousel after refresh; (b) defaulting rules hold when optional fields are omitted.

**FR-BANNER-003 — Update banner.**
Actor: maker, admin. Inputs: `PUT /api/banners/:id` partial JSON.
Outputs: 200 with merged banner (URL id authoritative); 404 unknown id; blank id → 400.
Acceptance: (a) updates persist; (b) unknown id → 404; (c) staff/checker → 403.

**FR-BANNER-004 — Delete banner.**
Actor: admin. Inputs: `DELETE /api/banners/:id`.
Outputs: 200 `{success:true, message:"Banner removed"}`.
Acceptance: (a) admin → 200 and removal from listings; (b) non-admin roles → 403; (c) id-less DELETE → 400.

#### 3.1.6 Directory contacts (CONTACT)

**FR-CONTACT-001 — List and search directory (authenticated).**
Actor: staff+ (any authenticated). Inputs: `GET /api/contacts?department=&floor=&search=`.
Outputs: 200 `{data, total}`; filters: exact department, exact floor, case-insensitive search over `name`, `nameEn`, `position`, `extension`.
Acceptance: (a) anonymous → 401; (b) search matches Thai or English name or extension digits; (c) department and floor filters compose.

**FR-CONTACT-002 — Create contact.**
Actor: maker, admin. Inputs: `POST /api/contacts` JSON (name, nameEn, position, department, extension, directPhone?, email, floor default "14th", avatarUrl?).
Outputs: 201 with the created contact.
Acceptance: (a) created contact is searchable via FR-CONTACT-001; (b) staff/checker → 403.

**FR-CONTACT-003 — Update contact.**
Actor: maker, admin. Inputs: `PUT /api/contacts/:id` partial JSON.
Outputs: 200 merged contact; 404 unknown; blank id → 400.
Acceptance: edits persist (e.g. extension change reflected in search).

**FR-CONTACT-004 — Delete contact.**
Actor: admin. Inputs: `DELETE /api/contacts/:id`.
Outputs: 200 `{success:true, message:"Contact deleted"}`.
Acceptance: (a) admin → 200 and removal; (b) non-admin → 403; (c) id-less DELETE → 400.

#### 3.1.7 Policy documents (DOC)

**FR-DOC-001 — List policy documents (authenticated).**
Actor: staff+. Inputs: `GET /api/documents?category=`.
Outputs: 200 `{data:[PolicyDocument...]}`; category filter (`all`/absent = no filter).
Acceptance: (a) anonymous → 401; (b) category filter returns only that category; (c) each item carries version, fileSize, downloadUrl, isNew.

**FR-DOC-002 — Register policy document.**
Actor: maker, admin. Inputs: `POST /api/documents` JSON (title, titleEn, category default `form`, department, version default `v1.0`, updatedAt default today, fileSize, downloadUrl; `isNew` forced true).
Outputs: 201 with the created document.
Acceptance: (a) appears in FR-DOC-001 flagged new; (b) staff/checker → 403.

**FR-DOC-003 — Delete policy document.**
Actor: admin. Inputs: `DELETE /api/documents/:id`.
Outputs: 200 `{success:true, message:"Document deleted"}`.
Acceptance: (a) admin → 200 and removal; (b) non-admin → 403; (c) id-less DELETE → 400. (Note: documents support create/delete only — there is no update endpoint.)

#### 3.1.8 Meeting rooms (ROOM)

**FR-ROOM-001 — List rooms (public).**
Actor: public. Inputs: `GET /api/rooms`.
Outputs: 200 `{data:[MeetingRoom...]}` with name, code, floor, capacity, facilities, `status` (`available` | `in-use` | `maintenance`) and `currentBooking` when occupied.
Acceptance: anonymous listing shows live room status.

**FR-ROOM-002 — Book a room.**
Actor: any authenticated user (staff+). Inputs: `POST /api/rooms/:id/book` JSON `{topic?, time?}`.
Outputs: 200 with the room at `status:'in-use'` and `currentBooking = {topic (default "KB J Internal Meeting"), booker (the caller's display name — never client-supplied), time (default "14:00 - 15:30 น.")}`; 404 unknown room; 400 if the room is not `available` ("Room is currently booked or under maintenance").
Acceptance: (a) booking an available room flips it to `in-use` with the caller recorded as booker; (b) double-booking a busy/maintenance room → 400; (c) unknown id → 404; (d) anonymous → 401.

**FR-ROOM-003 — Release a room.**
Actor: any authenticated user. Inputs: `POST /api/rooms/:id/release`.
Outputs: 200 with the room back to `status:'available'` and `currentBooking` cleared; 404 unknown room.
Acceptance: (a) a released room is bookable again; (b) unknown id → 404; (c) anonymous → 401.

#### 3.1.9 Portal & CMS experience (CMS)

**FR-CMS-001 — Three-view SPA with role gating.**
Actor: all users. Inputs: session + navigation.
Outputs: exactly three views — **Intranet portal** (every signed-in user; anonymous get the login screen), **Admin CMS** (`maker` and above), **External Web Sync** (`maker` and above). View *state* is gated, not just buttons: if the role no longer permits the current view (logout/role change), the app resets to the portal view.
Acceptance: (a) anonymous → login screen only; (b) staff sees no CMS/Sync entry points and cannot reach them by state manipulation (guarded reset); (c) maker/checker/admin can enter CMS and Sync views.

**FR-CMS-002 — Role-differentiated CMS capabilities.**
Actor: maker/checker/admin. Inputs: CMS usage.
Outputs: approve/reject controls appear only for `checker`+; delete controls and the **User Management** tab appear only for `admin`; user management is self-service (create/activate/deactivate without IT ticket).
Acceptance: (a) maker does not see approve/reject or delete affordances; (b) only admin sees "User Management"; (c) the UI matches the server RBAC matrix (defense is server-enforced regardless of UI).

**FR-CMS-003 — Failure-safe form handling.**
Actor: CMS users. Inputs: CMS mutations.
Outputs: mutation handlers throw on failure; the CMS surfaces inline errors and keeps forms open (no input loss); client state mutates only after the server confirms; a toast confirms success or shows the error.
Acceptance: (a) a rejected save (e.g. 403) leaves the edit form populated; (b) a successful create/update shows a success toast and updates the list; (c) an auth loss during CMS use triggers re-authentication (logout hook).

**FR-CMS-004 — Offline fallback with visible flag.**
Actor: portal readers. Inputs: API unreachable during initial public hydration.
Outputs: public data (news, banners, rooms) falls back to bundled sample data; authenticated slices never fall back (errors surface instead); a fixed badge shows "โหมดออฟไลน์ — แสดงข้อมูลตัวอย่าง / Offline mode — showing bundled sample data" whenever fallback is active.
Acceptance: (a) with the server down, the portal still renders sample news/banners/rooms with the offline badge visible; (b) authenticated data is never substituted with sample data; (c) the badge clears when connectivity returns.

**FR-CMS-005 — Session restore and auth gate.**
Actor: returning users. Inputs: page load with a live cookie.
Outputs: `GET /api/auth/me` restores the session before render (splash "กำลังตรวจสอบเซสชัน / Checking session..."); a 401 yields the login screen; login/logout update the whole app without reload.
Acceptance: (a) reload with a valid cookie enters the portal directly; (b) reload without one shows the login screen; (c) session check failure (network) leaves the user anonymous with the offline flag raised.

**FR-CMS-006 — Portal composition.**
Actor: portal readers. Inputs: —.
Outputs: the portal composes a hero banner carousel (FR-BANNER-001 data), a quick-tools bar (`GET /api/tools`, public, static link list), a corporate index sidebar (Thai/English governance links), a compliance-directives widget (PDPA highlights), the news grid, a regulatory hub, the directory & rooms section, and the governance/policies section.
Acceptance: (a) `GET /api/tools` is public and feeds the quick-tools bar; (b) each section renders its API-backed data; (c) in-page anchors (e.g. `#directory`, `#meeting-rooms`) scroll to the corresponding sections.

#### 3.1.10 Audit trail (AUDIT)

**FR-AUDIT-001 — Server-side audit recording.**
Actor: system. Inputs: auditable events.
Outputs: append entries `{id:"audit-<ts>-<rand>", timestamp, actor, actorRole, action, targetResource, resourceId, details, ipAddress, status}`; **the actor is always taken from the authenticated session** (or the attempted username for failed logins) — client-supplied actor strings are never accepted; IP comes from `req.ip`.
Acceptance: (a) audit entries created by API events carry the session identity, not request-body values; (b) timestamps are UTC `YYYY-MM-DD HH:MM:SS`.

**FR-AUDIT-002 — View the audit trail.**
Actor: checker, admin. Inputs: `GET /api/audit-logs`.
Outputs: 200 `{data:[AuditLog...]}` newest-first; maker/staff → 403; anonymous → 401.
Acceptance: (a) checker and admin can list entries; (b) maker/staff cannot.

**FR-AUDIT-003 — Audited action coverage.**
Actor: system. Inputs: —. Outputs: at minimum these actions are audited: `LOGIN`, `LOGIN_FAILED`, `LOGOUT`, `USER_CREATE`, `USER_ACTIVATE`, `USER_DEACTIVATE`, `SUBMIT_APPROVAL`, `APPROVE`, `REJECT`, `FILE_UPLOAD` — each with actor, role label, target resource, details, IP and status. *(W2-1, as built):* news-workflow guard rejections reuse the workflow values (`SUBMIT_APPROVAL`/`APPROVE`/`REJECT`, status `WARNING`) and the forced edit-reset audit reuses `UPDATE` — reuses, not new vocabulary (Doc 10 §9.1).
Acceptance: exercising each source action produces the corresponding entry (status `SUCCESS` / `WARNING` for failed login / `REJECTED` for rejection).
**Wave-2 extension (W2-3; per Doc 10 §9.1 — **AS-BUILT, landed `4650335`**):** three further call-site classes are audited: (i) **sync trigger** — `POST /api/sync/trigger` writes a `SYNC_TRIGGER`/SUCCESS row (actor = admin, target `Public Edge Gateway`, `resourceId: BULK-ALL` correlating the sync-log item); (ii) **system export** — `GET /api/system/export` writes a `SYSTEM_EXPORT`/SUCCESS row (`resourceId` = the export's `exportTimestamp`, correlating the audit row with the exact snapshot; response shape unchanged); (iii) **access denials, lead-ruled trim** — every authenticated 403 and every 401 where a `kbj_session` cookie was presented but failed validation write an `ACCESS_DENIED`/`WARNING` row; no-cookie 401s are request-log-only by design (full coverage considered and rejected — Doc 10 §9.1).
Acceptance (extension, as built since `4650335`): exercising each class produces its corresponding row while response codes/bodies stay unchanged (no RBAC expectation flips). Verified by: TC-SYNC-004 / TC-AUDIT-009 / TC-AUDIT-010 (Doc 12 v1.8.0 — asserted in `scripts/smoke-test.mjs` §16).

**FR-AUDIT-004 — No manual audit fabrication `[REMOVED per DCR-8]`.**
As built (W2-2 landed `f6fa52d`; DCR-8 — see §2.6): the audit trail can
never be written through the API by any actor, admin included; audit rows
are appended **exclusively by server-side `recordAudit()`** as a side
effect of the actions in FR-AUDIT-003.
Actor: — (constraint). Inputs: `POST /api/audit-logs` (any body).
Outputs: HTTP 404 `{success:false, error:"No API endpoint for POST /api/audit-logs"}` (JSON `/api` catch-all) for every caller — anonymous, staff, maker, checker, admin.
Acceptance (post-removal, Wave-2): (a) `POST /api/audit-logs` → 404 for **every** role including admin; (b) no API path appends `audit_logs` rows outside server-side `recordAudit()`; (c) the audit action set enumerated in FR-AUDIT-003 remains the complete set (no client-selectable `action` values enter the trail); (d) GET `/api/audit-logs` (FR-AUDIT-002) is unchanged.
*[Historical as-built until `f6fa52d` (W2-2): admin → 201 with defaults; other roles → 403; actor server-stamped — documented in doc 08 §11.3 and doc 10 §5 AUD-11; TC-AUDIT-008 / TC-RBAC-026 now assert the 404.]*

**FR-AUDIT-005 — Append-only integrity.**
Actor: — (constraint). Inputs: —.
Outputs: no API can update or delete audit entries; the PG table has no update trigger by design (BOT/PDPA immutability); the in-memory store is bounded at 5,000 entries (dev only).
Acceptance: (a) no PUT/PATCH/DELETE route exists for audit logs; (b) schema.sql documents audit_logs as append-only with no `updated_at` trigger.

#### 3.1.11 Public sync & data migration (SYNC)

**FR-SYNC-001 — Public-sync state machine.**
Actor: makers/checkers. Inputs: lifecycle operations on a news item.
Outputs: `externalSyncStatus` transitions `draft` → `pending_approval` (submit) → `synced` (approve, stamps `approvedBy`/`approvedAt`) or `rejected` (reject, records reason); approve/reject are restricted to checker+. **Runtime values are exactly `draft`, `pending_approval`, `synced`, `rejected` (DCR-5)** — the TypeScript union (`src/types.ts:28`) additionally declares `'pending'`, which is never produced at runtime (dead union member), and no `'approved'` status exists. Every transition writes an audit entry (FR-AUDIT-003).
Acceptance: (a) the four-way flow completes draft→pending→synced with stamps; (b) draft→pending→rejected records the reason; (c) a maker cannot approve or reject (403); (d) no direct create/update publish path exists — create/update always persist `'draft'` and the only path to `'synced'` is checker approve (FR-NEWS-009, DCR-3 resolved in W2-1); (e) no other status value is ever persisted or returned; (f) editing a non-draft item resets it to `'draft'` (FR-NEWS-009: content change ⇒ draft).

**FR-SYNC-002 — Automatic sync logging.**
Actor: system. Inputs: news create/update/delete with `syncToExternal`, and approve.
Outputs: `sync_logs` entries `{action: CREATE|UPDATE|DELETE, status:"SUCCESS", targetEndpoint:"api.kbjcapital.co.th/v1/public/news", syncedBy:<username>, itemId, itemTitle, timestamp}`; deletes of previously synced items are also logged.
Acceptance: each listed operation appends exactly one sync-log entry attributed to the acting user.

**FR-SYNC-003 — View sync logs.**
Actor: admin. Inputs: `GET /api/sync/logs`.
Outputs: 200 `{data:[SyncLog...]}` newest-first; checker/maker/staff → 403.
Acceptance: (a) admin lists logs; (b) non-admin roles are refused.

**FR-SYNC-004 — Trigger full sync.**
Actor: admin. Inputs: `POST /api/sync/trigger`.
Outputs: 200 `{success:true, message:"Public web synchronized successfully", syncedItemsCount:<count of news with syncToExternal>, log:<FORCE_SYNC SyncLog>}` targeting `gateway.kbjcapital.co.th/v1/public/cache/purge-and-warm`. **`[PLANNED]`** The outbound HTTP call to the public website is not wired yet — today the trigger drives the state machine and log only; integrating the real webhook (plus an egress NetworkPolicy rule) is future work.
Acceptance (as built): (a) admin trigger → 200 with an accurate `syncedItemsCount` and a new `FORCE_SYNC` log; (b) non-admin → 403; (c) no outbound request leaves the pod (documented limitation).

**FR-SYNC-005 — External Web Sync preview.**
Actor: maker+. Inputs: SPA view "External Web Sync".
Outputs: a preview of externally-synced content (items with `syncToExternal`/`synced` status) as it appears on the public website, with a shortcut into the CMS.
Acceptance: (a) maker and above can open the view; (b) staff cannot (gated with CMS view set); (c) it reflects current synced news.

**FR-SYNC-006 — System export.**
Actor: admin. Inputs: `GET /api/system/export`.
Outputs: 200 JSON `{exportTimestamp, version:"2.0.0", schemaTarget:"postgresql", storage:"memory"|"postgres", counts:{...}, tables:{news, banners, contacts, meeting_rooms, documents, audit_logs, sync_logs}}` — the top-level timestamp field is **`exportTimestamp`** (DCR-1: references to `generatedAt` elsewhere are corrected against this as-built name) — a complete, consistent snapshot consumed by `scripts/migrate.js` to load PostgreSQL; non-admin → 403.
Acceptance: (a) admin export returns every table with counts matching the store; (b) `DATABASE_URL=… node scripts/migrate.js export.json` loads the payload (`payload.tables` shape); (c) non-admin → 403.

#### 3.1.12 File upload (UPL)

**FR-UPL-001 — Upload a file.**
Actor: maker, checker, admin. Inputs: `POST /api/upload` multipart/form-data, field `file`.
Outputs: 201 `{success:true, data:{url:"/uploads/<uuid>.<ext>", fileName:<original name>, size:<bytes>}}`; audit `FILE_UPLOAD` (details quote the original name and size); 400 when no file / wrong field name.
Acceptance: (a) maker/checker/admin can upload and receive a resolvable `/uploads/...` URL; (b) staff → 403, anonymous → 401; (c) missing `file` field → 400 with guidance.

**FR-UPL-002 — Upload constraints.**
Actor: uploader. Inputs: file bytes + original filename.
Validation: max 10 MB; extension whitelist `.jpg .jpeg .png .webp .gif .pdf .docx .xlsx`; extension must be a simple `[a-z0-9]+` suffix (crafted multi-part extensions rejected); declared MIME type must be consistent with the extension (`application/octet-stream` accepted for Office types).
Outputs: 413 for oversize ("File exceeds the 10MB limit."), 400 for disallowed extension or MIME/extension mismatch (message enumerates the whitelist).
Acceptance: (a) 10 MB + 1 byte → 413; (b) `.exe`/`.html`/extensionless → 400; (c) `.jpg` declaring `text/html` → 400; (d) whitelisted types upload successfully.

**FR-UPL-003 — Safe storage and read-only serving.**
Actor: system. Inputs: accepted upload.
Outputs: stored under `UPLOAD_DIR` (default `./uploads`, `/app/uploads` in containers; created if missing) with a **server-generated random UUID filename** — the client filename never touches the filesystem; served via `express.static` at `/uploads` with 1-day cache, no directory index, no redirect, traversal protection and global `nosniff`.
Acceptance: (a) stored filenames are `<uuid>.<ext>`; (b) `GET /uploads/<uuid>.<ext>` returns the bytes; (c) directory traversal attempts (e.g. `..%2f`) do not escape `UPLOAD_DIR`; (d) no directory listing at `/uploads`.

#### 3.1.13 Search (SRCH)

**FR-SRCH-001 — Global search modal.**
Actor: authenticated portal users. Inputs: `⌘K` / `Ctrl+K` (authenticated only) opens the omnibox; free-text query.
Outputs: live, case-insensitive client-side results across news (title/summary/department), contacts (Thai & English names, extension, department), documents (title/department) and rooms (name/code/floor), with a total count; selecting a result opens the article/document modal or navigates to the section.
Acceptance: (a) anonymous users cannot open the modal (shortcut no-ops); (b) a query matching only an English name still returns the contact; (c) result counts equal the sum across the four entity groups.

**FR-SRCH-002 — Server-side news search.**
Actor: public. Inputs: `GET /api/news?search=<q>`.
Outputs: case-insensitive substring matches on `title`, `titleEn`, `summary`, `department` (see FR-NEWS-001).
Acceptance: Thai and English substrings both match; no tokenization/stemming is implied (substring semantics).

**FR-SRCH-003 — Server-side directory search.**
Actor: staff+. Inputs: `GET /api/contacts?search=&department=&floor=`.
Outputs: case-insensitive matches on `name`, `nameEn`, `position`, `extension`, composed with department/floor filters (see FR-CONTACT-001).
Acceptance: filters compose; extension search matches by digits.

### 3.2 Non-functional requirements

Performance targets marked **(proposed)** are engineering baselines to be
confirmed at system test (doc 17); all other NFRs are verified against the
as-built implementation.

#### 3.2.1 Security (SEC)

**NFR-SEC-001 — Password hashing strength.** Passwords are hashed with bcrypt at cost factor 12 (`BCRYPT_COST = 12`) at user creation; plaintext (or reversible forms) are never stored; `users.password_hash` never leaves the server (safe-user projection strips it everywhere).
*Acceptance:* (a) stored hashes are bcrypt with cost 12; (b) no API response includes the hash; (c) login uses constant-time bcrypt comparison.

**NFR-SEC-002 — Secrets management.** `SESSION_SECRET`, `ADMIN_PASSWORD`, `POSTGRES_PASSWORD`/`DATABASE_URL` enter only via environment (compose) or Kubernetes Secret; `.dockerignore` excludes all env files from the image build context; production refuses to boot without `SESSION_SECRET`.
*Acceptance:* (a) image build context contains no env files; (b) k8s secret template never committed with real values; (c) production boot fails without the secret (FR-SES-006).

**NFR-SEC-003 — Security response headers.** Every response carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
*Acceptance:* all five headers present on API, static and SPA responses.

**NFR-SEC-004 — Hardened, non-root container.** Runtime container is unprivileged: uid/gid 10001, `runAsNonRoot`, read-only root filesystem, all capabilities dropped, `allowPrivilegeEscalation: false`, `/tmp` as emptyDir; multi-stage build installs production dependencies only.
*Acceptance:* (a) process runs as uid 10001; (b) k8s securityContext values verified; (c) container starts with a read-only root.

**NFR-SEC-005 — Network isolation.** Kubernetes namespace applies default-deny; ingress only from the ingress controller and same-namespace pods; egress limited to DNS and PostgreSQL 5432 (requires a NetworkPolicy-enforcing CNI).
*Acceptance:* `kubectl kustomize k8s` validates; policy review confirms the rules; (CNI-dependent enforcement documented).

**NFR-SEC-006 — Transport security.** TLS terminates at the ingress; the session cookie is `Secure` in production and `httpOnly`/`SameSite=Lax` always (FR-SES-003); the session id is HMAC-SHA256-signed and compared constant-time (FR-SES-001).
*Acceptance:* (a) production `Set-Cookie` includes `Secure`; (b) ingress TLS config in `k8s/ingress.yaml` with the `kbj-intranet-tls` secret.

**NFR-SEC-007 — Input defense in depth.** (a) `/api` resource-id guard rejects id-less mutations and empty id segments with a clean 400; (b) `requireResourceId` rejects whitespace ids on `:id` mutation routes; (c) JSON/urlencoded bodies capped at 10 MB with clean 400 (malformed) / 413 (oversize) envelopes; (d) unmatched `/api/*` paths return a JSON 404 (never the SPA HTML); (e) upload MIME/extension consistency and UUID renaming (FR-UPL-002/003).
*Acceptance:* each listed probe returns the specified JSON error envelope and never a 500/HTML fallback.

#### 3.2.2 Performance (PERF) — targets **(proposed)**

**NFR-PERF-001 — API latency.** Read endpoints (`/api/news`, `/api/banners`, `/api/rooms`, `/api/contacts`, `/api/documents`, `/api/audit-logs`, `/api/sync/logs`) respond p95 < 300 ms and p99 < 800 ms server-side on a 2-vCPU pod with PostgreSQL 16 in-cluster and representative seed volume (~1k rows/table). *(proposed — confirm in doc 17)*

**NFR-PERF-002 — Authentication latency.** `POST /api/auth/login` completes p95 ≤ 1.5 s including the intentional bcrypt cost-12 comparison (≈0.25–0.5 s); failed and successful logins have comparable timing (anti-enumeration, FR-AUTH-005). *(proposed)*

**NFR-PERF-003 — Static asset caching.** Uploaded files are served with 1-day cache headers under immutable UUID names; Vite-built SPA assets are content-hashed and served from `dist/`; probe and static paths bypass auth for speed.
*Acceptance:* `Cache-Control`/etag behavior verified on `/uploads/*` and `/assets/*`.

**NFR-PERF-004 — Scale capacity.** Deployment supports HPA 2→10 replicas with rolling updates `maxUnavailable: 0` (zero-downtime) and preferred pod anti-affinity; the PostgreSQL pool is capped at 10 connections per pod. Known constraint: uploads on RWO storage limit effective writers to one pod until RWX/object storage. *(proposed capacity envelope)*

#### 3.2.3 Availability (AVAIL)

**NFR-AVAIL-001 — Liveness probe.** `GET /healthz` (aliases `/health`, `/api/health`) returns 200 with `{status:"healthy", probe:"liveness", timestamp, uptime, service, version, k8s{...}}` — process-level only, independent of the database, so a DB outage does not cause restart loops. Docker `HEALTHCHECK` polls it every 30 s.
*Acceptance:* healthy process → 200 even when the DB is down.

**NFR-AVAIL-002 — Readiness probe (repository-aware).** `GET /readyz` (aliases `/ready`, `/api/ready`) returns 200 with checks `{database, cache, cmsStore}` when the repository answers (PG `SELECT 1`) or the in-memory stores are hydrated; 503 `{status:"not_ready", reason:"Database unavailable"|"Stores initializing"}` otherwise — pulling the pod from rotation.
*Acceptance:* (a) PG mode with a dead database → 503; (b) recovered DB → 200 again.

**NFR-AVAIL-003 — Graceful shutdown.** On SIGTERM/SIGINT: stop the session sweeper, close the HTTP server, close the database pool, exit 0; force-exit after a 10 s timeout. Kubernetes pairs this with `preStop` drain and a 35 s termination grace period.
*Acceptance:* (a) `kubectl delete pod` drains in-flight requests without 5xx spike; (b) process exits within the window.

**NFR-AVAIL-004 — Durable persistence.** With `DATABASE_URL` set, all state (users, sessions, content, logs) persists in PostgreSQL 16 on the `pgdata` volume; PG initialization failure is fatal at boot (no silent in-memory fallback in production); production boot **without** `DATABASE_URL` logs an explicit warning that data will be lost.
*Acceptance:* (a) app restart/pod reschedule preserves data in PG mode; (b) unreachable DB at boot → process exits with a clear error; (c) warned in-memory production mode is detectable in logs.

**NFR-AVAIL-005 — Backup and data portability.** Database durability is delegated to the operator (persistent volume + backups); the system contributes (a) `pg_isready`-based compose health gating, (b) `GET /api/system/export` full JSON snapshot (FR-SYNC-006) and `scripts/migrate.js` for store-to-PostgreSQL moves, (c) uploads on a dedicated volume/PVC. Schema upgrades on existing databases are a documented manual step (`psql -f scripts/schema.sql`).
*Acceptance:* (a) export→migrate round-trip reproduces the tables; (b) upgrade procedure documented and repeatable.

**NFR-AVAIL-006 — Process resilience.** (a) `unhandledRejection` is logged and suppressed (a single bad request cannot kill the pod); (b) a final error handler converts body-parser failures to 400/413 and unexpected errors to a single-line 500 JSON; (c) a k8s startup probe guards slow boots; (d) audit/sync writes never block the response path on failure beyond the request scope.
*Acceptance:* (a) a malformed JSON body yields 400, not a crash; (b) injected async rejection keeps the server serving.

#### 3.2.4 Compliance — BOT & PDPA (COMP)

**NFR-COMP-001 — Segregation of duties (BOT).** Public-sync approval authority is segregated from authoring and submission **for all roles**: **no role — admin included — may reach `externalSyncStatus:'synced'` by any path other than the checker approve endpoint** (FR-NEWS-009, enforced in W2-1), with server-enforced state guards (approve/reject only from `'pending_approval'`, else 400; submit only from `'draft'`, else 400) and a submitter ≠ approver identity guard (else 403); every approval decision is attributable (FR-NEWS-006/007). *The Wave-1 as-built gap (DCR-3 direct-publish path) is resolved — verified by TC-SEC-011/TC-COMP-001.*
*Acceptance:* (a) a maker cannot approve/reject (403 evidenced); (b) approved items carry checker identity + timestamp.

**NFR-COMP-002 — PDPA accountability.** Sensitive operations are recorded in an append-only, actor-stamped trail with IP and outcome (FR-AUDIT-001/003/005); accounts are deactivated, never deleted, preserving linkage of historical actions (FR-USER-004); request logs (time, method, path, status, duration, IP) support investigation.
*Acceptance:* (a) audit entries are immutable and attributable; (b) audit-log access itself is restricted to checker+.

**NFR-COMP-003 — Data minimization.** API responses expose a safe user projection (no password hashes, ever); the session cookie carries only the signed session id (no PII); uploads are renamed to UUIDs (no user filenames on disk).
*Acceptance:* (a) no endpoint leaks `password_hash`; (b) cookie decode shows `<sid>.<signature>` only.

**NFR-COMP-004 — Timely access revocation.** Deactivation blocks both future logins (401 at FR-AUTH-001) and existing sessions (FR-SES-004) on the next request; session expiry is enforced with a 7-day ceiling and hourly sweeps (FR-SES-005).
*Acceptance:* a deactivated user with a live cookie is refused on the very next request.

#### 3.2.5 Internationalization (I18N)

**NFR-I18N-001 — Thai-first bilingual UI.** All user-facing screens present Thai as the primary language with English secondary labels inline (e.g. "เข้าสู่ระบบ / Sign in", "โหมดออฟไลน์ — แสดงข้อมูลตัวอย่าง / Offline mode — showing bundled sample data"); there is no runtime language switch — a single bilingual render is used.
*Acceptance:* (a) login, offline badge and CMS confirmations show both languages; (b) no locale configuration is required for first use.

**NFR-I18N-002 — Bilingual content fields.** The data model carries explicit English companions for user-supplied display text: `news.titleEn`, `contacts.nameEn`, `documents.titleEn`; search matches both languages (FR-SRCH-001/002/003).
*Acceptance:* an item created with both fields is discoverable in either language.

**NFR-I18N-003 — Thai locale presentation.** Dates produced by the system use the Thai locale (`th-TH`, e.g. `publishedAt` labels and read-time strings such as "3 นาที"); room-time defaults are Thai ("14:00 - 15:30 น."). Note: `news.published_at` is stored as the display label (Thai-locale date string); the real timestamp column `published_at_ts` is reserved for future sorting/migration tooling.
*Acceptance:* created items default to Thai-locale date/read-time labels.

#### 3.2.6 Maintainability (MAINT)

**NFR-MAINT-001 — Single-language type-checked codebase.** Server and SPA are TypeScript ~5.8 (one language end to end); `npm run lint` (`tsc --noEmit`) is the merge gate; the production server ships as an esbuild CJS bundle (`dist/server.cjs`). *DCR-6: strict mode not currently enabled.*
*Acceptance:* `npm run lint` and `npm run build` pass on the merged tree.

**NFR-MAINT-002 — Machine-readable API contract.** `GET /api/openapi.json` publishes an OpenAPI 3.0.3 document (cookie security scheme `kbj_session`, per-path summaries and response codes) kept in sync with the routes; consumers never rely on prose.
*Acceptance:* (a) the document loads anonymously; (b) it lists every route in §3.1 with matching auth requirements.

**NFR-MAINT-003 — Structured request logging.** One JSON line per request `{time, method, path, status, durationMs, ip}` (Vite internals/node_modules excluded), ready for log aggregation.
*Acceptance:* sampled log lines parse as JSON with all six fields.

**NFR-MAINT-004 — Idempotent schema management.** The server applies the same DDL at boot (`CREATE TABLE IF NOT EXISTS`, idempotent enum/type creation) as `scripts/schema.sql` — safe to re-run; seeds only insert into completely empty tables; the two DDL sources are kept in lockstep by convention.
*Acceptance:* (a) repeated boots do not fail or duplicate rows; (b) DDL diff between `PG_DDL` and `schema.sql` is empty.

**NFR-MAINT-005 — One image, environment-only configuration.** Identical container image for dev/compose/k8s; all environment selection (DB mode, production flags, uploads dir, listen address) via env vars; no rebuild needed to move environments.
*Acceptance:* the same image tag runs in compose and k8s with only env/volume differences.

**NFR-MAINT-006 — API envelope and error semantics (as built — mixed, DCR-4).** The envelope is **not uniform**: (a) read/list endpoints return bare `{data, [total], [counts]}` with **no `success` field** (e.g. `GET /api/news`, `/api/banners`, `/api/rooms`, `/api/audit-logs`); (b) mutations and auth endpoints return `{success:true, data, [message]}`; (c) auth/validation/rate-limit failures return `{success:false, error:"…"}`; (d) **per-resource 404s and room-booking errors return bare `{error:"…"}` without `success`** (e.g. `{"error":"News item not found"}`, `{"error":"Room is currently booked or under maintenance"}`). Status-code taxonomy is consistent: 400 validation, 401 unauthenticated, 403 forbidden, 404 unknown resource, 409 duplicate, 413 oversize, 429 rate-limited, 500 internal; unmatched `/api/*` paths return a JSON 404 `{success:false, error}` (never SPA HTML). Consumers must not assume a `success` field on reads. (HANDOVER §5 describes only the mutation convention `{success:true,data}` / `{success:false,error}` — DCR-4 records the divergence.)
*Acceptance:* spot-checks across all domains match the four envelope shapes above, per endpoint class.

**NFR-MAINT-007 — Data migration tooling.** `scripts/migrate.js` imports a system export (`payload.tables`) into PostgreSQL; `scripts/seed-users.js` provisions accounts; `scripts/smoke-test.mjs` and `tests/e2e-walkthrough.mjs` provide repeatable verification of the auth/RBAC/maker-checker/upload/rate-limit contracts.
*Acceptance:* each script runs per its header instructions against a clean environment.

---

## 4. Requirement inventory summary

| Kind | Domain | Count | IDs |
|---|---|---|---|
| FR | AUTH | 6 | FR-AUTH-001…006 |
| FR | SES | 6 | FR-SES-001…006 |
| FR | USER | 5 | FR-USER-001…005 |
| FR | NEWS | 9 | FR-NEWS-001…009 |
| FR | BANNER | 4 | FR-BANNER-001…004 |
| FR | CONTACT | 4 | FR-CONTACT-001…004 |
| FR | DOC | 3 | FR-DOC-001…003 |
| FR | ROOM | 3 | FR-ROOM-001…003 |
| FR | CMS | 6 | FR-CMS-001…006 |
| FR | AUDIT | 5 | FR-AUDIT-001…005 |
| FR | SYNC | 6 | FR-SYNC-001…006 |
| FR | UPL | 3 | FR-UPL-001…003 |
| FR | SRCH | 3 | FR-SRCH-001…003 |
| NFR | SEC | 7 | NFR-SEC-001…007 |
| NFR | PERF | 4 | NFR-PERF-001…004 |
| NFR | AVAIL | 6 | NFR-AVAIL-001…006 |
| NFR | COMP | 4 | NFR-COMP-001…004 |
| NFR | I18N | 3 | NFR-I18N-001…003 |
| NFR | MAINT | 7 | NFR-MAINT-001…007 |
| **Total** | | **94** | 63 functional (1 `[PLANNED]`: FR-SYNC-004 outbound call) + 31 non-functional |

Cross-references: each requirement above is traced to design artifacts, test
cases (`TC-<DOMAIN>-<nnn>`) and UAT items (`UAT-<nnn>`) in
`docs/deliverables/04-rtm.md`.
