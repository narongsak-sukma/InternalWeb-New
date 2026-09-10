# Deliverable 10 — Audit Log Design

**Version:** 1.0.0 · **Status:** Draft · **Date:** 2026-09-10 · **Author:** worker-5 → Lead review → CTO approval

> This document describes the audit trail **AS BUILT**. Sources of truth:
> `server.ts` (`recordAudit()` and every call site; `audit_logs` DDL),
> `src/types.ts` (`AuditLog`), `scripts/schema.sql` §9, seed data in
> `src/data/initialData.ts`. Future work is marked `[PLANNED]`. Related:
> Doc 09 (RBAC — who can trigger each event), Doc 12 (Test Plan — audit test
> cases), Doc 07 (Data Dictionary — column-level detail).

---

## 1. Purpose & design goals

The audit trail provides after-the-fact accountability for security-relevant
and business-critical actions on the KB J Capital intranet portal, satisfying:

- **PDPA B.E. 2562 (accountability principle)** — the organization must be
  able to demonstrate who did what, when, from where, to personal-data-bearing
  records (user accounts, staff directory, published content).
- **BOT financial-institution governance** — an immutable audit trail for
  dual-control (maker-checker) publication decisions and privileged
  administration, retained for supervisory inspection.

Design goals (as implemented):

1. **Server-derived identity** — the recorded actor always comes from the
   authenticated session (or the attempted username for failed logins);
   client-supplied actor strings are never accepted.
2. **Append-only** — the application exposes no update/delete path for audit
   records; the table has no `updated_at` trigger by design.
3. **Complete context per entry** — actor, role, action, target, result,
   source IP, timestamp.
4. **Least-privilege read** — only checker (compliance) and admin may read the
   trail; nobody below checker, not even makers.
5. **Cheap and synchronous** — one insert per event inside the request path
   (upload is the single fire-and-forget exception), no external dependency.

## 2. Record schema

TypeScript shape (`src/types.ts`) → PostgreSQL columns
(`scripts/schema.sql` §9 / identical `PG_DDL` in `server.ts`):

| TS field | Column | Type | Constraints / notes |
|---|---|---|---|
| `id` | `id` | text | PK; generated `audit-<epoch-ms>-<4-byte-hex>` (e.g. `audit-1789012345678-9f2a1b`) |
| `timestamp` | `timestamp` | text | Server time, `YYYY-MM-DD HH:MM:SS` (UTC, ISO-8601 truncated to seconds) |
| `actor` | `actor` | text | Username of the authenticated user; attempted username for failed logins; `unknown-user:<id>` when a destroyed session's user no longer resolves |
| `actorRole` | `actor_role` | text | Human label from `ROLE_LABELS`: `Administrator`, `Checker (Compliance / VP)`, `Maker (Author)`, `Staff (Read-only)`; or `Anonymous` (failed login) / `Unknown` (logout of vanished user) |
| `action` | `action` | text | Event id — see catalog §5 |
| `targetResource` | `target_resource` | text | Human label of the target type (e.g. `News Announcement`, `User Account`, `Authentication`, `File Upload`) |
| `resourceId` | `resource_id` | text | Target instance id (user id, news id, uploaded filename, `PORTAL-GEN`) |
| `details` | `details` | text | Free-text English summary; includes titles/usernames/reasons (truncated to 30 chars for news titles) |
| `ipAddress` | `ip_address` | text, nullable | `req.ip` (real client behind one trusted proxy hop — `trust proxy 1`); omitted → NULL |
| `status` | `status` | text | `SUCCESS` \| `REJECTED` \| `WARNING` |
| — | `seq` | bigserial | Insertion order (UNIQUE); newest-first listing orders by `seq DESC` |

Indexes: `idx_audit_actor (actor)`, `idx_audit_action (action)`,
`idx_audit_timestamp (seq DESC)`.

Accepted `action` values (TS union): `CREATE`, `UPDATE`, `DELETE`,
`SUBMIT_APPROVAL`, `APPROVE`, `REJECT`, `SYNC_PUBLIC`, `LOGIN`, `LOGIN_FAILED`,
`LOGOUT`, `USER_CREATE`, `USER_ACTIVATE`, `USER_DEACTIVATE`, `FILE_UPLOAD`.
Of these, `CREATE` / `UPDATE` / `DELETE` / `SYNC_PUBLIC` **have no automatic
call site** — they can only enter the trail via the admin manual-append
endpoint (§6).

Status semantics: `SUCCESS` = the action took effect; `REJECTED` = a checker
denied publication (the rejection itself succeeded); `WARNING` = security
signal (failed authentication).

## 3. Storage & append-only enforcement

- **Two backends, same shape:** PostgreSQL `audit_logs` table when
  `DATABASE_URL` is set; in-memory array otherwise (dev mode) with a **5,000
  entry cap** (oldest silently dropped) so the demo process stays bounded.
  PostgreSQL has no cap.
- **No mutation paths:** the `Repository` interface exposes only
  `listAuditLogs()` / `insertAuditLog()` — there is no update/delete method to
  wire, and no HTTP route could reach one. The `/api` resource-id guard and
  the JSON 404 catch-all mean `PUT/DELETE /api/audit-logs...` cannot resolve
  to any handler.
- **Write path:** `recordAudit()` (server.ts) constructs the entry, inserts
  via the repository, and returns it. Call sites are `await`-ed inside their
  request handlers (upload uses `void recordAudit(...)` — fire-and-forget,
  the HTTP 201 is not proof of the insert).
- **DB-level enforcement `[PLANNED]`:** the table itself is a normal heap — a
  DBA (or SQL injection elsewhere) could UPDATE/DELETE rows. Wave 2 options:
  `REVOKE UPDATE, DELETE ON audit_logs FROM app_role`, a BEFORE UPDATE/DELETE
  trigger raising an exception, and/or hash-chaining (§9).
- **Seeding:** both backends start from the same `INITIAL_AUDIT_LOGS` fixture
  (inserted on an empty PostgreSQL table at boot; present from process start
  in memory). Inspection tooling must treat entries predating the run under
  investigation as seed data, not live evidence.
- **Ordering:** API returns newest-first (`seq DESC` in PostgreSQL; `unshift`
  semantics in memory).

## 4. Actor authenticity

The actor can never be injected by a client:

- All `recordAudit` call sites on protected routes read `req.user!.username`
  and `ROLE_LABELS[req.user!.role]`, where `req.user` was set by
  `requireAuth` from the HMAC-verified session — a client cannot choose
  these values.
- Failed logins record the **attempted** username with `actorRole:
  'Anonymous'` — this string is attacker-controllable input, by design (it is
  the investigation signal), and `details` embeds it verbatim.
- Logout resolves the user from the destroyed session record; if the user row
  vanished it records `unknown-user:<userId>` / `Unknown`.
- The one client-influenced write path is the admin-only manual append
  (§6), where `action`, `targetResource`, `resourceId`, `details`, `status`
  come from the request body — but `actor`, `actorRole`, `ipAddress` remain
  server-derived.

`scripts/smoke-test.mjs` §9 verifies this property end-to-end (creates a
user, logs in, performs actions, asserts the stored actor/role match the
session, not any client-supplied echo).

## 5. Event catalog (every action the code writes)

| ID | `action` | Trigger endpoint | Actor role(s) | targetResource / resourceId | Recorded details (shape) | `status` |
|---|---|---|---|---|---|---|
| AUD-01 | `LOGIN` | POST `/api/auth/login` (success) | any (incl. admin/checker/maker/staff) | `Authentication` / user id | `User "<username>" logged in successfully.` | SUCCESS |
| AUD-02 | `LOGIN_FAILED` | POST `/api/auth/login` (wrong password, unknown user, or deactivated account) | Anonymous (attempted username) | `Authentication` / user id if known, else attempted username | `Failed login attempt for "<attempted>".` | WARNING |
| AUD-03 | `LOGOUT` | POST `/api/auth/logout` (only when a valid session cookie was destroyed) | any | `Authentication` / user id | `User logged out; session destroyed.` | SUCCESS |
| AUD-04 | `SUBMIT_APPROVAL` | POST `/api/news/:id/submit-approval` | maker, admin | `News Announcement` / news id | `Submitted "<title…30>" for dual-control checker review before public publishing.` | SUCCESS |
| AUD-05 | `APPROVE` | POST `/api/news/:id/approve` | checker, admin | `News Announcement` / news id | `Approved public synchronization to www.kbjcapital.co.th for "<title…30>".` (also stamps news.approvedBy/approvedAt and writes a `sync_logs` CREATE row) | SUCCESS |
| AUD-06 | `REJECT` | POST `/api/news/:id/reject` | checker, admin | `News Announcement` / news id | `Rejected approval for "<title…30>". Reason: <reason>` (reason from body, default `"Content revised or missing mandatory regulatory wording."`) | REJECTED |
| AUD-07 | `USER_CREATE` | POST `/api/users` (success) | admin | `User Account` / new user id | `Created user "<username>" with role "<role>".` | SUCCESS |
| AUD-08 | `USER_ACTIVATE` | PATCH `/api/users/:id` (`isActive: true`) | admin | `User Account` / user id | `Activated user "<username>".` | SUCCESS |
| AUD-09 | `USER_DEACTIVATE` | PATCH `/api/users/:id` (`isActive: false`) | admin | `User Account` / user id | `Deactivated user "<username>".` | SUCCESS |
| AUD-10 | `FILE_UPLOAD` | POST `/api/upload` (success, 201) | maker, checker, admin | `File Upload` / server filename `<uuid>.<ext>` | `Uploaded "<original name>" (<size> bytes).` (fire-and-forget write) | SUCCESS |
| AUD-11 | *manual* (any allowed `action` string; default `UPDATE`) | POST `/api/audit-logs` | admin | from body (defaults `General Portal` / `PORTAL-GEN`) | from body (default `User initiated state change.`) | from body (default SUCCESS) |

Notes:
- **Not audited:** rejected logins that fail input validation (non-string /
  blank username/password → 401 without an audit row); only the
  credentials-checked failure path (AUD-02) writes.
- **`LOGIN_FAILED` vs deactivated users:** a correct password on a deactivated
  account records AUD-02 with the user's real id — the same signal as a wrong
  password (no information leak).
- Seed fixture entries (historical demo data) may also carry the legacy
  `SYNC_PUBLIC` action in fresh databases; no runtime path emits it today.

### 5.1 Finding: sync-log-only paths — external publication with no audit entry (DCR-3 corollary)

Verified in code (`server.ts:1315-1326`, `:1346-1357`, `:1367-1378`): when a
news item carries `syncToExternal: true`, three content endpoints write a
`sync_logs` row but **no audit entry whatsoever**:

| Path | Sync-log row written | Audit entry |
|---|---|---|
| POST `/api/news` (create with `syncToExternal: true`, incl. the DCR-3 publish bypass) | `action: CREATE`, `syncedBy` = maker username | **none** |
| PUT `/api/news/:id` (update, merged `syncToExternal: true`) | `action: UPDATE` | **none** |
| DELETE `/api/news/:id` (externally-synced item, admin) | `action: DELETE` | **none** |

Consequence for compliance: a maker publishing straight to the external sync
pipeline leaves a trace only in `sync_logs`, which is readable **admin-only**
(`GET /api/sync/logs`, Doc 09 §6.6) — a checker reviewing the audit trail
(GET `/api/audit-logs`) sees nothing. The approval flow (AUD-04..06) is
audited; the bypass is not. Remediation is folded into the DCR-3 fix and the
AUD-P01/P02/P03 gap items below. Pinned as-built by TC-NEWS-011 (Doc 12).

## 6. Query API

| Endpoint | Access | Behavior (as built) |
|---|---|---|
| GET `/api/audit-logs` | checker, admin (`requireRole('checker','admin')`) | Returns `{ data: [AuditLog…] }`, **all** entries, newest-first. **No filters, no pagination, no query parameters** — the entire trail is transferred in one response. |
| POST `/api/audit-logs` | admin only | Manual append; body may set `action`, `targetResource`, `resourceId`, `details`, `status`; actor fields and IP are server-derived; returns 201 with the created entry. |

UI: the CMS "BOT / PDPA Audit Trail" tab (checker+) renders the trail;
`refreshAuditLogs()` is gated to checker+ client-side (Doc 09 §7).

`[PLANNED]` Wave 2 query hardening: server-side pagination (`?page`,
`?limit`), filters (`actor`, `action`, `from`, `to`, `status`), full-text
search over `details`, CSV/PDF export for examiners, and removal or
re-scoping of the manual append endpoint (integrity risk noted in Doc 09 §10).

## 7. Retention

- **As built:** no retention job, no archival, no purge. PostgreSQL rows
  persist indefinitely; in-memory dev entries reset on restart (5,000 cap).
- **Export:** `GET /api/system/export` (admin) includes the full
  `audit_logs` table in its `tables` object — usable as an ad-hoc evidence
  snapshot (`exportTimestamp`, `counts.auditLogs` included).
- `[PLANNED]`: define a BOT/PDPA-aligned retention schedule (e.g., ≥ 5 years
  for approval and account events), quarterly WORM export to object storage,
  and legal-hold handling.

## 8. Integrity & tamper-evidence `[PLANNED]`

As built, integrity rests on: append-only application code, single-insert
write path, and DBA access control. Not yet present:

1. **Hash chain** (`prev_hash`, `row_hash` columns) to make any retroactive
   edit detectable.
2. **Database-level immutability** (REVOKE + trigger) — see §3.
3. **WORM/immutable object-storage replication** of daily exports.
4. **Clock discipline note:** `timestamp` is application-generated wall clock;
  `seq` (bigserial) is the reliable monotonic ordering key.

## 9. Coverage gap analysis (feeds Wave 2)

Sensitive actions that **do not** currently write an audit entry, with
proposed action ids for the Wave 2 backlog:

| Proposed ID | Proposed `action` | Missing trigger | Why it matters |
|---|---|---|---|
| AUD-P01 | `CONTENT_CREATE` | POST `/api/news`, `/api/banners`, `/api/contacts`, `/api/documents` | Content enters the CMS with no record of who created it |
| AUD-P02 | `CONTENT_UPDATE` | PUT `/api/news/:id`, `/api/banners/:id`, `/api/contacts/:id` | Edits are invisible; maker-checker history starts only at submit |
| AUD-P03 | `CONTENT_DELETE` | DELETE `/api/news|banners|contacts|documents/:id` (admin) | Destructive, unaudited (sync log written only for externally-synced news) |
| AUD-P04 | `ROOM_BOOK` / `ROOM_RELEASE` | POST `/api/rooms/:id/book` & `/release` | Shared-resource usage is unattributable |
| AUD-P05 | `SYNC_TRIGGER` | POST `/api/sync/trigger` (admin) | Writes only a `sync_logs` row, not an audit entry; manual append is the workaround |
| AUD-P06 | `SYSTEM_EXPORT` | GET `/api/system/export` (admin) | Bulk data exfiltration event (PDPA relevant) — unaudited |
| AUD-P07 | `ACCESS_DENIED` | every 401/403 from `requireAuth`/`requireRole` | Privilege-probing attempts are currently invisible to compliance |
| AUD-P08 | `UPLOAD_REJECTED` | POST `/api/upload` failures (400/413) | Whitelist hits signal malicious probing |
| AUD-P09 | `LOGIN_BAD_REQUEST` | POST `/api/auth/login` validation 401 (non-string/blank fields) | Complements AUD-02 |
| AUD-P10 | `SESSION_REJECTED` | requests with invalid/tampered session signatures | Tamper-detection signal |

Also recommended with the gaps: include `result` (HTTP status) uniformly and
`userAgent` for the security-relevant events (PDPA proportionality applies —
minimize retained personal data).

## 10. Traceability

| Topic here | Requirement refs (scheme per Doc 03/04) | Verified by (Doc 12) |
|---|---|---|
| Event catalog §5 | FR-AUDIT-* | TC-AUDIT-001…008 |
| Actor authenticity §4 | FR-AUDIT-*, FR-SEC-* | TC-AUDIT-006 (actor integrity), smoke suite §9 |
| Query access §6 | FR-AUDIT-*, FR-AUTH-* | TC-RBAC-013 (maker 403), TC-AUDIT-001 |
| Append-only §3 | FR-AUDIT-* | TC-AUDIT-007 (no mutation routes) |
| Coverage gaps §9 | FR-AUDIT-`[PLANNED]` | Wave 2 test additions |

Exact FR identifiers are enumerated in Doc 03 (SRS); Doc 04 (RTM)
reconciles — mismatches resolve to Doc 03 in the Lead pass.
