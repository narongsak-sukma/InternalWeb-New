# Deliverable 09 — Role-Based Access Control (RBAC) Design

**Version:** 1.1.0 · **Status:** Approved · **Date:** 2026-09-10 · **Author:** worker-5 → Lead review → CTO approval

> **Change log** — **1.1.0 (2026-09-10)**: CTO gate REVISE — §8.3 `[PLANNED]`
> fix aligned to the CTO's strict dual-control ruling: no role (admin
> included) may reach `synced` outside the approve path; approve/reject
> require `pending_approval` (else 400) **and** approver ≠ submitter (else
> 403); submit-approval restricted to `draft`; workflow fields and
> `syncToExternal` server-controlled on create/update. **1.0.0 (2026-09-10)**:
> initial as-built RBAC design.

> This document describes the system **AS BUILT**. Sources of truth: `server.ts`
> (route middleware, auth, bootstrap), `src/types.ts` (role model),
> `src/auth/AuthContext.tsx` + `src/App.tsx` + `src/components/AdminCMS.tsx`
> (UI authorization), `scripts/schema.sql` (role enum). Future work is marked
> `[PLANNED]`. Related: Doc 08 (API Specification), Doc 10 (Audit Log Design),
> Doc 12 (Test Plan).

---

## 1. Purpose & scope

Role-Based Access Control governs every request to the KB J Capital intranet
portal: who may authenticate, who may read which content, who may author, who
may approve public publication, and who may administer accounts. The design
satisfies two regulatory drivers:

- **Bank of Thailand (BOT) financial-institution governance** — dual control
  (maker-checker) on any content cleared for the public website.
- **Thailand PDPA B.E. 2562** — accountability: privileged actions are
  attributable to an authenticated individual (see Doc 10).

Scope: API-level authorization (Express middleware), UI-level authorization
(SPA views/tabs), the maker-checker workflow, and the account lifecycle.
Authentication mechanics (bcrypt, session cookies, rate limiting) are
summarized in §4 and specified in Doc 08.

## 2. Design principles

1. **Deny by default.** Every route is closed unless middleware explicitly
   opens it; unmatched `/api/*` paths return a JSON 404, never the SPA.
2. **Server is the authority.** The SPA hides controls for usability only —
   the API re-checks the session and role on every request (verified by the
   RBAC negative matrix in Doc 12).
3. **Roles, not permissions.** Four fixed roles with a strict hierarchy;
   no per-user permission overrides.
4. **Separation of duties.** The author of public-bound content (maker) can
   never be its approver path (checker/admin) — see §8, including the as-built
   exception that is flagged for Wave 2.
5. **Accounts never deleted.** Deactivation preserves the user record so audit
   history stays attributable (PDPA accountability, §9).
6. **Actor identity is derived server-side** from the session; client-supplied
   actor strings are never trusted (§7 of Doc 10).

## 3. Role model

Hierarchy (rank used identically in server checks and UI):
`admin (4) > checker (3) > maker (2) > staff (1)`; anonymous (unauthenticated)
has rank 0.

| Role | Rank | Label (system, `ROLE_LABELS`) | Intended users | Capability summary |
|---|---|---|---|---|
| `admin` | 4 | Administrator | IT administrators / system owners | Full access: all content CRUD incl. deletes, user management, sync operations, system export, manual audit append |
| `checker` | 3 | Checker (Compliance / VP) | Compliance officers, VP reviewers | Read everything staff can, approve/reject public-bound announcements, read the audit trail, upload files. **Cannot author content** (403) |
| `maker` | 2 | Maker (Author) | Department authors / corporate communications | Author and edit news, banners, contacts, documents; submit for approval; upload files |
| `staff` | 1 | Staff (Read-only) | Every employee | Read authenticated content (directory, policy documents), book/release meeting rooms |
| *(anonymous)* | 0 | — | Public / not-yet-logged-in visitors | Read public marketing surfaces only (news list, banners, rooms list, tools) |

The role is stored per user (`users.role`, enum `user_role_enum` in
`scripts/schema.sql`) and carried on the session-resolved user object
(`SafeUser`, which strips `passwordHash`).

## 4. Authentication foundation (summary)

Authorization presupposes authentication (full contract in Doc 08):

- `POST /api/auth/login` with username/password; bcrypt comparison at cost 12;
  unknown usernames are compared against a dummy hash so response timing does
  not reveal account existence.
- On success the server creates a server-side session record (7-day expiry,
  persisted in the `sessions` table / in-memory map) and sets cookie
  `kbj_session` = `<sid>.<HMAC-SHA256(sid, SESSION_SECRET)>` — `httpOnly`,
  `SameSite=Lax`, `Secure` when `NODE_ENV=production`.
- Login is rate-limited: 5 **failed** attempts per minute per IP
  (`express-rate-limit`, `skipSuccessfulRequests: true`); the 6th failure
  returns HTTP 429 with a JSON body.
- `resolveSession()` rejects tampered signatures, unknown sids, expired
  sessions, missing users, and **deactivated users** (`isActive = false`) —
  deactivation therefore terminates live sessions immediately (§9).
- `SESSION_SECRET` is mandatory in production (process exits at boot without
  it); in dev an ephemeral secret is generated with a warning.

## 5. Enforcement architecture

Two Express middlewares in `server.ts` implement the matrix; every protected
route composes them in the order `requireAuth → requireRole(...)`:

```ts
// 401 — no/invalid session
const requireAuth = … → res.status(401).json({ success:false, error:'Authentication required' })

// 403 — authenticated but role not in the allow-list
function requireRole(...allowedRoles: UserRole[]) { …
  → res.status(403).json({ success:false, error:'Insufficient permissions' }) }
```

Semantics worth noting:

- `requireRole` checks **membership in the argument list, not hierarchy**.
  E.g. `requireRole('maker', 'admin')` on content writes deliberately excludes
  `checker` (compliance must not author), while `requireRole('checker', 'admin')`
  on approvals excludes `maker` (author must not approve).
- Routes with neither middleware are intentionally public (§6, first block).
- **Resource-id defense in depth:** a pre-routing guard on `/api` rejects
  id-less mutations (`PUT/PATCH/DELETE /api/news/`) and empty id segments
  (`/api/news//approve`) with a clean 400; per-route `requireResourceId`
  rejects whitespace-only ids. Applies to `news, banners, contacts, documents,
  users, rooms`.
- Error envelopes are uniform (`{ success:false, error }`), so RBAC failures
  are machine-checkable in tests (Doc 12).

## 6. Endpoint × role permission matrix (as built, extracted from `server.ts`)

Legend: **A** = allowed (2xx) · **401** = authentication required ·
**403** = authenticated but insufficient permissions.

### 6.1 Public endpoints (no authentication)

| Method & path | anon | staff | maker | checker | admin |
|---|---|---|---|---|---|
| GET `/healthz`, `/health`, `/api/health` | A | A | A | A | A |
| GET `/readyz`, `/ready`, `/api/ready` | A | A | A | A | A |
| GET `/api/news` (with `?category=`, `?search=`) | A | A | A | A | A |
| GET `/api/banners` | A | A | A | A | A |
| GET `/api/rooms` | A | A | A | A | A |
| GET `/api/tools` | A | A | A | A | A |
| GET `/api/openapi.json` | A | A | A | A | A |
| GET `/uploads/*` (static, read-only) | A | A | A | A | A |
| POST `/api/auth/login` | A (rate-limited) | A | A | A | A |
| POST `/api/auth/logout` | A (idempotent; audits when a session is destroyed) | A | A | A | A |
| Any other `/api/*` | 404 JSON | 404 JSON | 404 JSON | 404 JSON | 404 JSON |

### 6.2 Authenticated read & self-service (any of the four roles)

| Method & path | anon | staff | maker | checker | admin |
|---|---|---|---|---|---|
| GET `/api/auth/me` | 401 | A | A | A | A |
| GET `/api/contacts` (`?department=`, `?floor=`, `?search=`) | 401 | A | A | A | A |
| GET `/api/documents` (`?category=`) | 401 | A | A | A | A |
| POST `/api/rooms/:id/book` | 401 | A | A | A | A |
| POST `/api/rooms/:id/release` | 401 | A | A | A | A |

### 6.3 Content authoring (maker + admin only — checker excluded by design)

| Method & path | anon | staff | maker | checker | admin |
|---|---|---|---|---|---|
| POST `/api/news` | 401 | 403 | A | 403 | A |
| PUT `/api/news/:id` | 401 | 403 | A | 403 | A |
| POST `/api/banners` | 401 | 403 | A | 403 | A |
| PUT `/api/banners/:id` | 401 | 403 | A | 403 | A |
| POST `/api/contacts` | 401 | 403 | A | 403 | A |
| PUT `/api/contacts/:id` | 401 | 403 | A | 403 | A |
| POST `/api/documents` | 401 | 403 | A | 403 | A |
| POST `/api/news/:id/submit-approval` | 401 | 403 | A | 403 | A |

### 6.4 Maker-checker approvals (checker + admin only)

| Method & path | anon | staff | maker | checker | admin |
|---|---|---|---|---|---|
| POST `/api/news/:id/approve` | 401 | 403 | 403 | A | A |
| POST `/api/news/:id/reject` | 401 | 403 | 403 | A | A |

### 6.5 Compliance & audit (checker + admin)

| Method & path | anon | staff | maker | checker | admin |
|---|---|---|---|---|---|
| GET `/api/audit-logs` | 401 | 403 | 403 | A | A |
| POST `/api/audit-logs` (manual append, see Doc 10 §6) | 401 | 403 | 403 | 403 | A |

### 6.6 Deletion & administration (admin only)

| Method & path | anon | staff | maker | checker | admin |
|---|---|---|---|---|---|
| DELETE `/api/news/:id` | 401 | 403 | 403 | 403 | A |
| DELETE `/api/banners/:id` | 401 | 403 | 403 | 403 | A |
| DELETE `/api/contacts/:id` | 401 | 403 | 403 | 403 | A |
| DELETE `/api/documents/:id` | 401 | 403 | 403 | 403 | A |
| GET `/api/users` | 401 | 403 | 403 | 403 | A |
| POST `/api/users` | 401 | 403 | 403 | 403 | A |
| PATCH `/api/users/:id` (activate/deactivate) | 401 | 403 | 403 | 403 | A |
| GET `/api/sync/logs` | 401 | 403 | 403 | 403 | A |
| POST `/api/sync/trigger` | 401 | 403 | 403 | 403 | A |
| GET `/api/system/export` | 401 | 403 | 403 | 403 | A |

### 6.7 Uploads (maker and above, staff excluded)

| Method & path | anon | staff | maker | checker | admin |
|---|---|---|---|---|---|
| POST `/api/upload` | 401 | 403 | A | A | A |

This matrix is the authoritative copy (code wins over HANDOVER §4; on
inspection the two agree on every row). It is exercised end-to-end by
`scripts/smoke-test.mjs` §2/§6/§7/§8/§10/§12 and mirrored as negative test
cases TC-RBAC-001…030 (with positive controls) in Doc 12 §6.16.

## 7. UI-level authorization

The SPA defines exactly three views (`ViewMode` in `src/types.ts`):
**Intranet portal** (`intranet`), **Admin CMS** (`admin-cms`), and
**External Web Sync** (`external-web`). Anonymous visitors see the login
screen.

| UI element | Gate (as built) | Location |
|---|---|---|
| Intranet portal view | Any authenticated user; anonymous → login screen | `src/App.tsx` |
| Admin CMS view | `roleAtLeast(role, 'maker')` (maker+) | `src/App.tsx:130` |
| External Web Sync view | `roleAtLeast(role, 'maker')` (maker+) | `src/App.tsx:130` |
| Forced view reset | If the current view becomes forbidden (role change/logout), state snaps back to `intranet` | `src/App.tsx:136` |
| CMS authoring controls (create/edit/submit) | `canWrite` = maker+ | `src/components/AdminCMS.tsx` |
| Approve / Reject (+ reject reason form) | `canCheck` = checker+ | `AdminCMS.tsx` (approval queue) |
| All delete buttons | `canAdmin` = admin | `AdminCMS.tsx` |
| CMS "User Management" tab | `canAdmin` (admin only) | `AdminCMS.tsx:1276` |
| CMS "BOT / PDPA Audit Trail" tab | `canCheck` (checker+) | `AdminCMS.tsx:1306` |
| CMS "Public Sync Logs" tab | `canAdmin` (admin only) | `AdminCMS.tsx` |
| Audit-trail data fetch | checker+ only (fetch is skipped otherwise) | `src/App.tsx:184` |
| Sync-logs data fetch | admin only | `src/App.tsx:193` |

Ranking uses `ROLE_RANK { staff:1, maker:2, checker:3, admin:4 }` in
`src/auth/AuthContext.tsx` (`roleAtLeast`) and the same values in
`AdminCMS.tsx`; unknown role strings default to least privilege (staff).

UI gating is **usability, not security**: every listed capability is re-checked
server-side (Doc 12 verifies with authenticated requests fired directly at the
API while holding a low-privilege session).

## 8. Maker-checker dual control (BOT governance)

### 8.1 Rationale

Under BOT outsourcing/governance expectations for financial institutions,
content that leaves the institution's boundary (the public website
kbjcapital.co.th) requires **dual control**: the person who prepares a
publication must not be the person who releases it. The portal models this as
maker (author) → checker (compliance) with an auditable decision trail.

### 8.2 State machine (as built)

`externalSyncStatus` on a news item evolves as:

```
            POST /api/news (syncToExternal=false)
                   │
                   ▼
                ┌──────┐  POST /:id/submit-approval   ┌──────────────────┐
                │draft │ ───────────────────────────► │ pending_approval │
                └──────┘   (maker/admin; syncToExternal│                  │
                   ▲         forced to false)         └────────┬─────────┘
                   │                                         │
   POST /:id/reject│                                         │ POST /:id/approve
   (checker/admin) │                                         │ (checker/admin)
                   │                                         ▼
             ┌──────────┐                       ┌──────────┐ + approvedBy/approvedAt
             │ rejected │ ◄─────────────────────│  synced  │   stamped; sync log CREATE
             └──────────┘                       └──────────┘   written; syncToExternal=true
```

Who can do what at each step:

| Step | Endpoint | Allowed roles | Server-side effect |
|---|---|---|---|
| 1. Create draft | POST `/api/news` | maker, admin | `externalSyncStatus = 'draft'` (when `syncToExternal` false) |
| 2. Edit draft | PUT `/api/news/:id` | maker, admin | Merge update; id protected |
| 3. Submit for approval | POST `/api/news/:id/submit-approval` | maker, admin | → `pending_approval`; `syncToExternal = false`; audit `SUBMIT_APPROVAL` |
| 4a. Approve | POST `/api/news/:id/approve` | checker, admin | → `synced`; `syncToExternal = true`; `approvedBy = <checker username>`; `approvedAt = YYYY-MM-DD HH:MM:SS`; audit `APPROVE`; sync-log CREATE |
| 4b. Reject | POST `/api/news/:id/reject` | checker, admin | → `rejected`; `syncToExternal = false`; `approvedBy = "Rejected by <checker>: <reason>"`; audit `REJECT` (status `REJECTED`) |

Every transition writes an audit entry (Doc 10 §5); approval additionally
writes a `sync_logs` row. The CMS exposes the same flow with a mandatory
reject-reason input ("ปฏิเสธ / Reject") for checkers.

### 8.3 Finding: dual-control gap (DCR-3, confirmed by Lead) — hardening required, Wave 2

Code inspection found **no server-side guard on transition preconditions**;
the state machine above is the *intended* path, but the API as built also
permits:

1. **Create-with-publish shortcut (the confirmed DCR-3 bypass):**
   `POST /api/news` with `syncToExternal: true` sets
   `externalSyncStatus = 'synced'` and writes a `sync_logs` CREATE row
   **immediately — no checker involved** (`server.ts:1306` status assignment,
   `:1315-1326` sync-log write). `PUT /api/news/:id` behaves the same when the
   merged item has `syncToExternal: true` (`server.ts:1346-1357`). The CMS
   news form exposes this checkbox, so a maker can publish to the external
   sync pipeline without dual control, and — because this path writes **no
   audit entry** (Doc 10 §5.1) while sync logs are admin-only — the act is
   invisible to checkers reading the audit trail.
2. **Approve/reject from any state:** `approve`/`reject` do not require the
   item to be `pending_approval`; a checker can approve a `draft` directly, and
   `submit-approval` can be called on any status.
3. **`PUT /api/news/:id` can overwrite workflow fields** (`externalSyncStatus`,
   `approvedBy`, `approvedAt`) arbitrarily.

`[PLANNED]` enforcement fix (Wave 2), per the CTO's **strict dual-control
ruling**:

1. **`'synced'` is reachable only via approve — for every role, admin
   included.** Create/update never yields `'synced'` regardless of the
   caller's role or the `syncToExternal` payload value.
2. **Approve/reject require `'pending_approval'`** — any other state
   (draft, synced, rejected, absent) → 400 illegal transition.
3. **Approver ≠ submitter** — the account that called `submit-approval`
   (recorded at submission) may not approve or reject that item, even if it
   holds `checker`/`admin`; violation → 403. (Admin may still approve another
   maker's submission; admin self-approval of admin's own submission is
   barred by this same guard.)
4. **`submit-approval` is legal from `'draft'` only** — re-submission of a
   `rejected` item requires an intervening edit that resets the state, or an
   explicit re-draft transition (Wave 2 UX decision).
5. **Workflow fields are server-controlled** — `externalSyncStatus`,
   `approvedBy`, `approvedAt`, and `syncToExternal` are stripped from
   client-supplied create/update payloads; `syncToExternal` becomes true only
   as a side effect of the approve path.

The permission *matrix* itself (who may call which endpoint) is correct as
built; the gap is workflow-state enforcement behind those endpoints. As-built
behavior is pinned by TC-NEWS-011; the post-fix expectations above are pinned
by TC-SEC-011 and TC-COMP-001 (Doc 12).

## 9. Account lifecycle

```
empty users store ──boot──► bootstrap admin ──admin creates──► users (any role)
                                   │
                     PATCH /api/users/:id {isActive}
                                   │
              ┌────────────────────┴──────────────────────┐
              ▼                                            ▼
        active (default)                            deactivated
        login OK                                    login → 401 + LOGIN_FAILED audit
        sessions resolve                            live sessions stop resolving
                                                     (resolveSession rejects isActive=false)
              └──────────── reactivate (PATCH) ◄─────┘   …no delete endpoint exists
```

- **Bootstrap:** when the users store is empty at boot, one `admin` is created
  from `ADMIN_USERNAME` (default `admin`) / `ADMIN_PASSWORD`. In production an
  unset `ADMIN_PASSWORD` generates a random one-time password printed once to
  the boot log with a "change it immediately" warning (no in-app change
  exists yet — see §11). In dev the demo accounts `maker`, `checker`, `staff`
  are also seeded (non-production only).
- **Create (admin only):** `POST /api/users` validates username
  (`^[a-zA-Z0-9._-]{3,32}$`), password ≥ 8 chars, display name, email shape,
  role ∈ enum, uniqueness (409). Passwords stored as bcrypt hashes (cost 12);
  the hash never leaves the server (`SafeUser`).
- **Deactivate / reactivate (admin only):** `PATCH /api/users/:id` with
  `isActive: boolean`. **Self-deactivation is blocked** (400: "You cannot
  deactivate your own account."). Deactivation is immediate and effective:
  login fails (audited `LOGIN_FAILED`) and existing sessions stop resolving on
  the next request because `resolveSession` checks `isActive`.
- **No deletion:** there is no user-delete endpoint, by design — the User
  Management tab lists/creates/deactivates only, preserving attributability of
  historical audit entries (HANDOVER §10).

## 10. Least-privilege analysis

Verified capability sets per role (what a *legitimate* holder can do):

- **staff:** read news/banners/rooms/tools anonymously anyway; authenticated
  value-add = directory, policy documents, room book/release, own profile
  (`/api/auth/me`). Cannot write anything, cannot upload. ✓ minimal.
- **maker:** authoring surfaces + upload + submit-approval. No delete, no
  approvals, no user management, no sync ops, no audit read. Note §8.3 item 1
  (publish shortcut) — an over-grant relative to the intended model.
- **checker:** approvals + audit read + upload. Deliberately cannot author
  content (403 on all §6.3 rows) — separation of duties. Can book rooms and
  read everything staff reads.
- **admin:** unrestricted, including manual audit append (§6.5) and system
  export.

Observed over-grants / shared-capability notes (as built, none violate the
matrix, listed for the risk register):

1. **Room release is unscoped:** any authenticated user may release any
   booking (`POST /api/rooms/:id/release` has no owner check) — accepted for
   an honor-system meeting-room board; `[PLANNED]` owner/whitelist release.
2. **Book/release on a room under maintenance:** book checks
   `status === 'available'` (400 otherwise); release does not check state.
3. **Manual audit append (`POST /api/audit-logs`, admin):** exists for
   operational annotations but lets an admin insert arbitrary
   action/details rows into the compliance trail — integrity considerations
   in Doc 10 §9.
4. **Single-tier admin:** no distinction between IT admin and content admin;
   all §6.6 powers travel together.

## 11. Hardening roadmap `[PLANNED]`

Exists today (verified in code): session-cookie hardening (httpOnly /
SameSite=Lax / Secure-in-prod / HMAC-signed sid), bcrypt cost 12 with
timing-uniform failures, per-IP failed-login rate limit (429), immediate
session revocation on deactivation, security headers on every response
(`X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`,
`Referrer-Policy`, `Permissions-Policy`), `trust proxy 1`, mandatory
`SESSION_SECRET` in production, resource-id guards, upload whitelist + size
limit + MIME/extension consistency + UUID filenames.

Not yet implemented (Wave 2 candidates, in priority order):

| # | Item | Rationale |
|---|---|---|
| H1 | Maker-checker state-machine enforcement (DCR-3) | Close the publish/approve shortcuts (§8.3) |
| H2 | Password change + admin-initiated reset endpoints; complexity/age policy beyond "≥ 8 chars" | Bootstrap admin password currently has no in-app rotation path |
| H3 | Account lockout after repeated failures (per-account; today only per-IP rate limit, per-process) | BOT-aligned brute-force defense; needs shared store across replicas |
| H4 | CSRF defense for cookie-authenticated mutations (token or `SameSite=Strict` + origin check) | `SameSite=Lax` blocks cross-site POSTs from form/fetch in modern browsers but is not a complete CSRF control |
| H5 | Rate limiting moved to a shared store (Redis) for multi-replica correctness | HANDOVER §10 limitation |
| H6 | Anomaly alerts on audit events (e.g., LOGIN_FAILED bursts, off-hours admin actions) | BOT monitoring expectation |
| H7 | MFA for admin/checker roles | Standard FI control |
| H8 | Owner-scoped room release | §10 item 1 |

## 12. Traceability

| Topic here | Requirement refs (scheme per Doc 03/04) | Verified by (Doc 12) |
|---|---|---|
| Login/logout/session | FR-AUTH-* | TC-AUTH-*, TC-SES-* |
| Role matrix (§6) | FR-AUTH-*, FR-CMS-*, FR-USER-* | TC-RBAC-001…016 (§6.16) |
| Maker-checker (§8) | FR-CMS-* (approval flow) | TC-NEWS-020+, TC-CMS-* |
| Account lifecycle (§9) | FR-USER-* | TC-USER-* |
| Audit read access (§6.5) | FR-AUDIT-* | TC-AUDIT-* |
| Upload role gate (§6.7) | FR-UPL-* | TC-UPL-* |

Exact FR identifiers are enumerated in Doc 03 (SRS); Doc 04 (RTM) reconciles
this table — any mismatch is resolved by the Lead pass in favor of Doc 03.
