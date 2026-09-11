# Deliverable 10 — Audit Log Design

**Version:** 1.7.0 · **Status:** Draft (Wave-2 revision) · **Date:** 2026-09-11 · **Author:** worker-5 → Lead review → CTO approval (W2-3 analysis + W2-FIX-1 pass: worker-5; W2-FIX-3 ripple pass: worker-2)

> **Change log:** v1.7.0 (2026-09-11) — **W2-FIX-3 ripple pass (code landed `bccd441`; codex cycle-2 cross-pod mandate)**: §3 write-path bullet and §9.3 blocker-4/blocker-3 mechanism re-pinned from `commitNewsTransition` to the transactional transition executor `repo.runNewsTransition` (PG `BEGIN` → `SELECT … FOR UPDATE` re-read → synchronous pure plan evaluates guards on the locked fresh row → `UPDATE news` → `INSERT audit_logs` (+`INSERT sync_logs` on approve) → `COMMIT`, `ROLLBACK` on any failure; read-only verdicts commit an empty transaction; denial rows written post-transition via `recordAudit` on their own connection); §9.3 blocker-1 scope claim corrected — serialization is no longer single-process: the `FOR UPDATE` re-read is the **cross-pod** serialization point (READ COMMITTED blocked lock re-reads the latest committed row), safe under the shipped `replicas: 2`, `withNewsLock` (`server.ts:1463`) retained as the same-pod serializer; §9.3 verification extended with smoke §18 (two-pod shared-PG proofs, TC-NEWS-020..022, Doc 12 v1.10.0); §10 traceability row extended. Audit action union unchanged — no call-site additions or removals. v1.6.0 (2026-09-11) — **W2-FIX-1 audit-truth pass (code landed `2c97cc3`; codex REVISE blockers 1–4 closed)**: §9.3 NEW — workflow audits now commit ATOMICALLY with their state change (`commitNewsTransition`: PG single transaction / memory all-or-nothing; audit-write failure ⇒ 500 + state rollback, so the "retry skips the audit" defect is structurally impossible) + per-item transition serialization (blocker 1) + the legacy-submission ACCESS_DENIED denial audit (blocker 2) + the state-only-withdrawal UPDATE row with `prior_status='synced'` (blocker 3); §3 write-path split (`recordAudit` direct vs `commitNewsTransition` atomic); §5 note for the two new call-site shapes (union unchanged at 14 — both reuse existing members); §2 union-note sentence; §10 traceability row. *(the `commitNewsTransition` mechanism named throughout this entry was superseded by `runNewsTransition` in v1.7.0 / W2-FIX-3.)* v1.5.0 (2026-09-10) — **W2-3 as-built flip round (code landed at `4650335`; DCR-8 code landed earlier at `f6fa52d`)**: §9.1/§9.2 flipped from target state to AS-BUILT (AUD-P05 `SYNC_TRIGGER` / AUD-P06 `SYSTEM_EXPORT` / AUD-P07 `ACCESS_DENIED` call sites live; union pruned 3-out/3-in to the net 14-value live writer set); §9.1 Mechanics sentence trued up (Express 4 does **not** route rejected middleware promises to the error handler — the reason requireRole's 403 audit write is try/catch-wrapped, fail-open per the lead review fix folded into `4650335`); §9.1 implementation-reality note extended with that wrap; §5 catalog extended with AUD-12/13/14; §5 AUD-11 / §6 / §4 DCR-8 as-built pins flipped (manual append 404s for every role since `f6fa52d`); §5.1 marked superseded by W2-1 strict dual control; §2 union note and seed note flipped to landed state. v1.4.0 — register ruling round. v1.3.0 — W2-3 rulings (AUD-P07 trim spec-of-record; SYNC_PUBLIC PRUNE). v1.2.0 — W2-3 analysis (§9.1 spec + §9.2 evidence). v1.1.0 — DCR-8 disposition. v1.0.0 — initial as-built draft.

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

Accepted `action` values (TS union, as built — pruned/extended at
`4650335`): `UPDATE`, `SUBMIT_APPROVAL`, `APPROVE`, `REJECT`, `LOGIN`,
`LOGIN_FAILED`, `LOGOUT`, `USER_CREATE`, `USER_ACTIVATE`, `USER_DEACTIVATE`,
`FILE_UPLOAD`, `SYNC_TRIGGER`, `SYSTEM_EXPORT`, `ACCESS_DENIED` — net 14
values, exactly the live writer set. At Wave-1, `CREATE` / `UPDATE` /
`DELETE` / `SYNC_PUBLIC` had no automatic call site — their only writer was
the admin manual-append endpoint (§6). Since then: **W2-1 (landed
`22023eb`)** gave bare `UPDATE` a live server-side writer
(forced-transition reset audit, §9.1 implementation-reality note);
**DCR-8 (landed `f6fa52d`)** removed the manual append — and with it the
only writer of `CREATE` / `DELETE` / `SYNC_PUBLIC` — and the **W2-3 prune
(landed `4650335`, §9.2)** removed those three dead members while §9.1
added `SYNC_TRIGGER` / `SYSTEM_EXPORT` / `ACCESS_DENIED`. Pre-prune
databases may still hold legacy rows carrying the removed values
(free-text column — §9.2 legacy caveat). The W2-FIX-1 call sites
(`2c97cc3`) reuse existing members — `UPDATE` (state-only withdrawal) and
`ACCESS_DENIED` (legacy-decision denial) — the union is unchanged at 14
values (§9.3).

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
- **Write path (W2-FIX-3, `bccd441`):** `recordAudit()`
  (server.ts) constructs the entry via `buildAuditEntry()`, inserts via the
  repository, and returns it — it remains the **direct** write path for
  non-atomic call sites (auth, users, sync-trigger, export, upload). Every
  **news workflow transition** (edit-reset, submit, approve, reject,
  withdraw) instead builds its row with `buildAuditEntry()` and commits it
  **with the state change in one all-or-nothing unit** inside the
  transactional transition executor `repo.runNewsTransition(id, plan)`
  (interface `server.ts:193`; in-memory `:334`; PG `:1042`) — the row is
  re-read `SELECT … FOR UPDATE` inside `BEGIN` (under READ COMMITTED a
  blocked lock re-reads the latest committed row — the cross-pod
  serialization point), a synchronous pure plan evaluates every guard on
  that locked fresh row, then PG runs `UPDATE news`/`INSERT audit_logs`
  (+`INSERT sync_logs` on approve)/`COMMIT` with `ROLLBACK` on any failure;
  read-only verdicts (guard denials) commit an empty transaction and their
  `WARNING`/`ACCESS_DENIED` rows are written **after** the transition via
  `recordAudit` on its own connection; in-memory holds the item lock with
  prior-item restore. An audit-write failure surfaces the
  final handler's 500 envelope and leaves the pre-transition state intact
  (§9.3). Upload keeps `void recordAudit(...)` — fire-and-forget, the HTTP
  201 is not proof of the insert.
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
- Historically (until DCR-8's code landed at `f6fa52d`), the one
  client-influenced write path was the admin-only manual append (§6), where
  `action`, `targetResource`, `resourceId`, `details`, `status` came from the
  request body. **That path is removed** (CTO ruling, RISK-023, landed
  `f6fa52d`): every field of every audit row is now exclusively
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
| AUD-11 | *manual* (any allowed `action` string; default `UPDATE`) | POST `/api/audit-logs` — **REMOVED per DCR-8, landed `f6fa52d`**: 404 for every role incl. admin (JSON `/api` catch-all) | ~~admin~~ | — | — | — |
| AUD-12 | `SYNC_TRIGGER` | POST `/api/sync/trigger` | admin | `Public Edge Gateway` / `BULK-ALL` (correlates the sync-log `itemId`) | `Forced full public-web handshake; <n> item(s) verified.` | SUCCESS |
| AUD-13 | `SYSTEM_EXPORT` | GET `/api/system/export` | admin | `System Export` / the export's `exportTimestamp` (correlates the audit row with that exact snapshot; the row appears in the *next* export) | `Exported full system snapshot (<n> news, <m> documents, <k> audit rows).` | SUCCESS |
| AUD-14 | `ACCESS_DENIED` | 403 from `requireRole` (every authenticated role refusal) and 401 from `requireAuth` **only when a `kbj_session` cookie was presented but failed validation** — no-cookie 401s are request-log-only by design (lead-ruled trim) | any authed role (403) / `anonymous`+`Anonymous` (failed-cookie 401) | `API Access Control` / `<METHOD> <path>` | 403: `Denied <METHOD> <path> - role '<role>' not in [<allowed>].` · 401: `Denied <METHOD> <path> - presented session cookie failed validation.` | WARNING |

Notes:
- **Not audited:** rejected logins that fail input validation (non-string /
  blank username/password → 401 without an audit row); only the
  credentials-checked failure path (AUD-02) writes.
- **`LOGIN_FAILED` vs deactivated users:** a correct password on a deactivated
  account records AUD-02 with the user's real id — the same signal as a wrong
  password (no information leak).
- Seed fixture entries (historical demo data): the former legacy `SYNC_PUBLIC`
  row was rewritten to `SYNC_TRIGGER` in the W2-3 prune (`4650335`) — fresh
  databases no longer carry `SYNC_PUBLIC`; pre-prune databases may still hold
  such rows (§9.2 legacy caveat).
- **W2-FIX-1 call-site shapes (`2c97cc3`; union unchanged — both reuse
  existing members):** (a) the state-only withdrawal endpoint writes the
  AUD-P01-shaped `UPDATE`/SUCCESS row with `prior_status='synced'` in
  `details` (same shape as the W2-1 edit-reset rows; §9.3); (b) a denied
  approve/reject decision on a legacy no-submitter pending row writes
  `ACCESS_DENIED`/WARNING against targetResource `News Announcement` — a
  handler-level decision denial, a fourth call-site class for the member
  alongside the AUD-P07 middleware 403/401s (§9.3).

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
**Superseded by W2-1 strict dual control (landed `22023eb`): create/update can
no longer reach `syncToExternal: true` — the only path to the live public set
is checker approve (audited, AUD-05), and forced edit-resets now write an
audit row (§9.1 implementation-reality note). The historical table above
describes the pre-W2-1 behavior.**

## 6. Query API

| Endpoint | Access | Behavior (as built) |
|---|---|---|
| GET `/api/audit-logs` | checker, admin (`requireRole('checker','admin')`) | Returns `{ data: [AuditLog…] }`, **all** entries, newest-first. **No filters, no pagination, no query parameters** — the entire trail is transferred in one response. |
| POST `/api/audit-logs` | ~~admin only~~ | **REMOVED per DCR-8 — landed `f6fa52d`**: 404 with the JSON `/api` catch-all body for **every** role incl. admin; audit rows exclusively server-written by `recordAudit()`; GET surface unchanged (flip-pins TC-AUDIT-008 / TC-RBAC-026 flipped and asserted in the default smoke suite). *(Historical as-built until `f6fa52d`: admin-only manual append — body could set `action`, `targetResource`, `resourceId`, `details`, `status`; actor fields and IP server-derived; returned 201.)* |

UI: the CMS "BOT / PDPA Audit Trail" tab (checker+) renders the trail;
`refreshAuditLogs()` is gated to checker+ client-side (Doc 09 §7).

`[PLANNED]` Wave 2 query hardening: server-side pagination (`?page`,
`?limit`), filters (`actor`, `action`, `from`, `to`, `status`), full-text
search over `details`, CSV/PDF export for examiners. The formerly open
"removal or re-scoping of the manual append endpoint" item (integrity risk
noted in Doc 09 §10) is **decided — REMOVED** per DCR-8 (CTO ruling, Wave-2
decision #5/#6; route removal landed at `f6fa52d`).

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
| AUD-P05 | `SYNC_TRIGGER` | POST `/api/sync/trigger` (admin) | Writes only a `sync_logs` row, not an audit entry; the as-built workaround (manual append) is removed by DCR-8, leaving a real audit call site as the only option |
| AUD-P06 | `SYSTEM_EXPORT` | GET `/api/system/export` (admin) | Bulk data exfiltration event (PDPA relevant) — unaudited |
| AUD-P07 | `ACCESS_DENIED` | every 401/403 from `requireAuth`/`requireRole` | Privilege-probing attempts are currently invisible to compliance |
| AUD-P08 | `UPLOAD_REJECTED` | POST `/api/upload` failures (400/413) | Whitelist hits signal malicious probing |
| AUD-P09 | `LOGIN_BAD_REQUEST` | POST `/api/auth/login` validation 401 (non-string/blank fields) | Complements AUD-02 |
| AUD-P10 | `SESSION_REJECTED` | requests with invalid/tampered session signatures | Tamper-detection signal |

**Resolved — P0 tail (landed `4650335`, §9.1):** AUD-P05 (`SYNC_TRIGGER`),
AUD-P06 (`SYSTEM_EXPORT`), and AUD-P07 (`ACCESS_DENIED`, lead-ruled trimmed
coverage) are implemented — they are no longer gaps; their rows above stay
as the historical proposal of record. Still backlog: AUD-P01..03 (vocabulary
plan below unchanged — future P1/P2), AUD-P04, AUD-P08/P09, and AUD-P10's
residual (its tampered-cookie half is absorbed by AUD-P07's 401 coverage).

**Vocabulary plan for AUD-P01..03 (recorded now; executes at P1/P2
ratification):** they land as `CONTENT_CREATE` / `CONTENT_UPDATE` /
`CONTENT_DELETE`, and bare `UPDATE` migrates to `CONTENT_UPDATE` in that
**same phase** (atomic vocabulary unification — no half-migrated state).
Until then `UPDATE` stays live in the union (W2-1 forced-transition audit,
§9.1 implementation-reality note), while `CREATE`/`DELETE` were pruned as
dead in W2-3 (`4650335`, §9.2). Note AUD-P07's trimmed 401 coverage absorbs
the tampered-cookie half of AUD-P10's signal (`ACCESS_DENIED` on
presented-but-failed cookies).

Also recommended with the gaps: include `result` (HTTP status) uniformly and
`userAgent` for the security-relevant events (PDPA proportionality applies —
minimize retained personal data).

### 9.1 Ratified P0 implementation spec (W2-3 — **AS-BUILT, landed `4650335`**)

Implementation-ready spec for the ratified P0 tail, **implemented in the W2-3
code phase (commit `4650335`, stacking on W2-1 `22023eb` → W2-2 `f6fa52d`)**.
The snippets below are the landed implementation (verified: strict `tsc`
after the prune exits 0 — proof no straggler writer emits a removed value;
default smoke suite 99/99 including the flipped TC-SYNC-004 / TC-AUDIT-009 /
TC-AUDIT-010 assertions of Doc 12 §16).

**Union impact (applies to all three gaps; lead-ruled 3-out/3-in form —
LANDED):** one edit to the `AuditLog['action']` union (`src/types.ts:119`)
**removed the three dead members `CREATE`, `DELETE`, `SYNC_PUBLIC`** (each
had lost its only audit writer when DCR-8's code landed; the `CREATE`/`DELETE`
literals in `server.ts` are `sync_logs` writes, a different namespace) and
**added `SYNC_TRIGGER` / `SYSTEM_EXPORT` / `ACCESS_DENIED`**. Net union (14
values) = exactly the live writer set. **`UPDATE` stays**: live via W2-1's
forced-transition audit. No schema change: `audit_logs.action` is plain
`text NOT NULL` (`scripts/schema.sql` §9 and the mirrored `PG_DDL`) — no
enum/CHECK constraint exists, and the seed/migration paths are unaffected.

**Implementation reality vs the §9 proposals:** W2-1 (`22023eb`) implements
the edit-reset guard audit **reusing bare `'UPDATE'`** (`server.ts`, commented
"AUD-P01" — a `<state>`→draft forced transition), and the
submit/approve/reject state guards reuse the existing workflow values
(`SUBMIT_APPROVAL`/`APPROVE`/`REJECT`). The
`CONTENT_CREATE`/`CONTENT_UPDATE`/`CONTENT_DELETE` ids in the §9 gap table
are the **future P1/P2 vocabulary, not what W2-1 shipped** — recorded so
the gate reads no divergence between implementation and proposal. W2-3
additionally reuses **no** proposed ids — it shipped the ruled
`SYNC_TRIGGER`/`SYSTEM_EXPORT`/`ACCESS_DENIED` vocabulary verbatim — and the
lead review fix folded into `4650335` wrapped requireRole's 403 audit write
in try/catch (see Mechanics below).

**AUD-P05 — audit row for `POST /api/sync/trigger`.**
Pre-W2-3 the handler wrote only a `sync_logs` row (`FORCE_SYNC`, `BULK-ALL`)
— the audit trail stayed silent (Doc 12 TC-SYNC-004 pinned that gap). Landed
at `4650335`: immediately after `await repo.insertSyncLog(newLog);` and
before `res.json(...)`:

```ts
await recordAudit({
  actor: req.user!.username,
  actorRole: ROLE_LABELS[req.user!.role],
  action: 'SYNC_TRIGGER',
  targetResource: 'Public Edge Gateway',
  resourceId: 'BULK-ALL',
  details: `Forced full public-web handshake; ${syncCount} item(s) verified.`,
  ipAddress: req.ip,
  status: 'SUCCESS',
});
```

Rationale: `resourceId: 'BULK-ALL'` matches the sync-log `itemId` (exact
cross-table correlation); `targetResource: 'Public Edge Gateway'` matches the
seed fixture's label for gateway operations. `await`-ed in-request, per the
§3 write-path rule. Pin: **TC-SYNC-004 (Doc 12) — flipped and asserted**
(SYNC_TRIGGER row correlates with the FORCE_SYNC sync log).

**AUD-P06 — audit row for `GET /api/system/export`.**
Pre-W2-3 the handler streamed the full snapshot (all content tables incl.
the audit trail itself) with **no audit entry** — a bulk data-exfiltration
event invisible to compliance. Landed at `4650335`:
`const exportTimestamp = new Date().toISOString();` hoisted once (used in
both the audit entry and the response body — response field name stays
`exportTimestamp`, DCR-1), then after the `Promise.all` resolves and before
`res.json(...)`:

```ts
await recordAudit({
  actor: req.user!.username,
  actorRole: ROLE_LABELS[req.user!.role],
  action: 'SYSTEM_EXPORT',
  targetResource: 'System Export',
  resourceId: exportTimestamp,
  details: `Exported full system snapshot (${news.length} news, ${documents.length} documents, ${auditLogs.length} audit rows).`,
  ipAddress: req.ip,
  status: 'SUCCESS',
});
```

Rationale: `resourceId` = the export timestamp correlates the audit row with
the exact snapshot a `migrate.js` consumer would load. The export **response
shape is unchanged** — TC-SYNC-006 does not flip; the coverage is
**TC-AUDIT-009 (Doc 12) — flipped and asserted** (row keyed by this export's
`exportTimestamp`; asserted visible in the *next* export's snapshot, not its
own — the row lands after the snapshot lists were read).

**AUD-P07 — `ACCESS_DENIED` rows for denials (lead-ruled coverage — LANDED).**
Pre-W2-3 `requireAuth` and `requireRole(...)` rejected silently —
privilege-probing was invisible to compliance. Coverage rule as landed
(**lead-ruled, spec of record**):

- **ALL authenticated 403s** — audited unconditionally.
- **401s where a `kbj_session` cookie WAS presented but failed validation**
  (tampered signature, unknown/expired sid, deactivated user) — audited; a
  presented-but-failed cookie is an attack signal.
- **401s with NO cookie presented** — **not audited** (plain anon probes);
  the JSON request logger already records them (one line: method/path/
  status/ip), so nothing is lost — they are simply not duplicated into the
  capped audit store.

Implementation: in each middleware, immediately before the
`res.status(...).json(...)` rejection, write:

```ts
// requireRole — 403 (authenticated caller, role refused) — unconditional
await recordAudit({
  actor: req.user!.username,
  actorRole: ROLE_LABELS[req.user!.role],
  action: 'ACCESS_DENIED',
  targetResource: 'API Access Control',
  resourceId: `${req.method} ${req.path}`,
  details: `Denied ${req.method} ${req.path} - role '${req.user!.role}' not in [${allowedRoles.join(', ')}].`,
  ipAddress: req.ip,
  status: 'WARNING',
});
```

```ts
// requireAuth — 401, only when a cookie was presented and failed
// validation (the `token` local is already parsed at the top of the
// handler; `!user` is the rejection condition being audited)
if (token) {
  await recordAudit({
    actor: 'anonymous',
    actorRole: 'Anonymous',
    action: 'ACCESS_DENIED',
    targetResource: 'API Access Control',
    resourceId: `${req.method} ${req.path}`,
    details: `Denied ${req.method} ${req.path} - presented session cookie failed validation.`,
    ipAddress: req.ip,
    status: 'WARNING',
  });
}
```

Mechanics (as landed, incl. the lead review fix folded into `4650335`):
`requireRole`'s returned handler is `async`, and its 403 audit write is
wrapped in **try/catch — fail-open**: Express 4 does **not** route rejected
middleware promises to the error handler, so an unwrapped `await` whose
write rejected (e.g. a PG blip) would have swallowed the 403 and hung the
request until client timeout. With the wrap, the access decision stands
regardless of audit-write outcome — a failed write logs
`[Audit] Failed to record ACCESS_DENIED 403 audit:` and the 403 still
sends (consistent with the W2-5 fail-open ruling). `requireAuth`'s audit
sits inside its existing try/catch → `next(err)`. Actor for
presented-cookie 401s is
`anonymous`/`Anonymous` — the failed validation means the caller's identity
is unresolvable (same convention as AUD-02; a deactivated user's cookie
cannot be attributed without trusting unvalidated input). **Scope
exclusions:** the login endpoint's own 401s are excluded by construction —
`POST /api/auth/login` is mounted without `requireAuth` and already writes
`LOGIN_FAILED` (AUD-02); adding AUD-P07 there would double-write. Status
`WARNING` (security signal — matches `LOGIN_FAILED`). Response
bodies/status codes are **unchanged** — no TC-RBAC-001..028 expectation
flips; the coverage is **TC-AUDIT-010 (Doc 12) — flipped and asserted**
(staff 403 row; anon no-cookie 401 absent by design; tampered-cookie 401
row as `anonymous`/WARNING; login-endpoint 401s carry `LOGIN_FAILED` only).

**Considered and rejected — full coverage (every 401/403).** The original
AUD-P07 wording would have written a row for every denial including
no-cookie anon probes. Lead rationale for the record: (a) the 5,000-cap
in-memory store evicts oldest rows silently — an anon probe storm under full
coverage would evict exactly the real security events the trail exists to
preserve (self-defeating); (b) the JSON request logger already writes one
line per request with method/path/status/ip, so no-cookie 401s are not lost,
just not duplicated into the capped store; (c) `audit_logs` carries
actor-bearing events — an anon probe has no actor. Residual risk under the
trimmed rule (documented): a cookie-forging flood still floods the trail —
only traffic carrying a presented cookie can — so the §7 retention `[PLANNED]`
work remains the structural fix.

### 9.2 Dead audit-union members — PRUNE ruled and EXECUTED for `CREATE`/`DELETE`/`SYNC_PUBLIC` (lead ruling; landed `4650335`)

**Evidence — writer-set enumeration (code-verified):**

- **`UPDATE` is ALIVE:** W2-1's forced-transition reset audit passes bare
  `'UPDATE'` to `recordAudit` (`server.ts:1397`, in flight). It stays in
  the union.
- **`CREATE` / `DELETE` literals in `server.ts` are `sync_logs` writes, not
  audit rows** — a different namespace: the approve handler's sync-log
  `CREATE` (`server.ts:1538`) and the news-delete handler's sync-log
  `DELETE` (`server.ts:1423`), both inside `repo.insertSyncLog(...)`. As
  AUDIT actions they have **no server-side writer**; their only audit
  writer ever was the manual-append body (DCR-8 removes it).
- **`SYNC_PUBLIC`:** zero `recordAudit` call sites pass it
  (`grep "'SYNC_PUBLIC'" server.ts` → **0 hits**); seed fixture
  `src/data/initialData.ts:698` (one demo row) and display-only AdminCMS
  branches (`:2834`, `:3435`) are its only other appearances — neither is a
  writer.
- **Planned writers:** none in W2-3 (§9.1 adds `SYNC_TRIGGER` /
  `SYSTEM_EXPORT` / `ACCESS_DENIED`). W2-6 (outbound webhook) has no
  ratified audit-action assignment — per-item public sync is already covered
  by `sync_logs` and the approve flow by `APPROVE` (AUD-05); a future
  webhook audit row would take a fresh descriptive value then.

**Ruling (lead, under delegated authority): PRUNE exactly three dead
audit-union members — `CREATE`, `DELETE`, `SYNC_PUBLIC`.** All three lost
their only audit writer when DCR-8's code landed; keeping any of them
would recreate the DCR-5 dead-member pattern the register already flags as
debt. **Executed at `4650335`**: one `types.ts:119` edit removed
`CREATE`/`DELETE`/`SYNC_PUBLIC` and added
`SYNC_TRIGGER`/`SYSTEM_EXPORT`/`ACCESS_DENIED` — the net union (14 values)
equals exactly the live writer set (`UPDATE` retained per the evidence
above; strict `tsc` after the prune exits 0 — the no-straggler proof). The
P1/P2 vocabulary plan (CONTENT_* unification incl. bare-`UPDATE` migration)
is recorded in §9 and executes only at that ratification. Ripple (executed
checklist):

| Artifact | Change | Landed state (`4650335`) |
|---|---|---|
| `src/types.ts:119` | Removed `'CREATE'`, `'DELETE'`, `'SYNC_PUBLIC'`; added the three §9.1 values | Done — net 14-value union |
| `src/data/initialData.ts:698` | The typed `SYNC_PUBLIC` seed row | Rewritten to `'SYNC_TRIGGER'` (semantically matches the row's gateway-handshake narrative; pre-check confirmed **no audit seed rows used `CREATE`/`DELETE`** — those literals sit in `INITIAL_SYNC_LOGS`, a different namespace, unaffected) |
| `src/components/AdminCMS.tsx` | Two dead `SYNC_PUBLIC` display branches | Both deleted (badge + timeline dot; rows fall to default styling; pre-check confirmed **no branch switched on `CREATE`/`DELETE`**) |
| Doc 07 `audit_logs.action` listing (+ action-column note) | Value list drops the three pruned values | Doc-lane ripple (Doc 07 v1.2.0 `1bc0d6b` pass predates the prune — re-check at the next Doc 07 revision) |
| Doc 05 (SDS) audit-action listing | Same drop | Doc-lane ripple (same re-check) |
| Doc 10 §2 (this doc) | Union narrative flipped to landed state | Done (v1.5.0) |
| Doc 12 TC-SEC-013 | Dual flip-pin wording names the ruled prune | Stated as landed in Doc 12 v1.8.0 (dual flip resolved: W2-2 `f6fa52d` + W2-3 `4650335`) |

Legacy-data caveat: databases seeded before the prune may hold historical
rows carrying `SYNC_PUBLIC` (and, in principle, `CREATE`/`DELETE` rows
inserted via the manual append while it existed) — the column is free text,
so old rows read back fine and render with default styling after the
AdminCMS branches are removed; they simply match no live union value. Treat
as historical/seed data per §3.

### 9.3 Atomic workflow auditing + legacy-decision denial (W2-FIX-1 — landed `2c97cc3`; executor superseded by W2-FIX-3 `bccd441`)

Closes codex REVISE blockers 1–4 (`.omc/artifacts/cto-gate-wave2-verdict.md`;
full API semantics in Doc 08 §6).

**Blocker 4 — atomicity.** Pre-W2-FIX-1 every workflow handler committed
state first and called `recordAudit()` after; an audit-insert failure left a
committed transition with no audit row, and a retry (seeing the new state)
skipped the audit entirely — a committed withdrawal could permanently lack
its required AUD-P01 row. As built (W2-FIX-3): the transactional transition
executor `repo.runNewsTransition(id, plan)` (interface `server.ts:193`;
in-memory `:334`; PG `:1042`) commits the news update, the audit row, and —
on the approve path — the sync-log row as **one all-or-nothing unit**. The
row is re-read `SELECT … FOR UPDATE` inside `BEGIN` and a synchronous pure
plan (every guard evaluated on that locked fresh row) returns the commit
payload; PostgreSQL then runs
them in a single transaction (`BEGIN`/`SELECT … FOR UPDATE` → `UPDATE news`
→ `INSERT audit_logs`
→ (+ `INSERT sync_logs`) → `COMMIT`, `ROLLBACK` on any failure; shared SQL
consts keep the standalone repo methods byte-identical to the transactional
path); the in-memory repository writes state then audit back-to-back and
restores the prior item if the audit write throws. Failure semantics: the
error bridges through `next(err)` to the final handler's 500 envelope
(`{"success":false,"error":"Internal server error"}`) with the state
untouched — **a retry hits the identical pre-transition state and
re-attempts the full unit, so "the retry skips the audit" is structurally
impossible.** (Gate consistency: the ratified requireRole try/catch ruling
authorizes fail-open only for *authorization denials*; it explicitly does
not authorize unaudited successful workflow changes — this is the
enforcement of exactly that line.)

**Blocker 1 — serialization.** All six news mutations (create/PUT/submit/
approve/reject/withdraw) run inside a per-item chained-promise critical
section (`withNewsLock`, `server.ts:1463`) and re-read the item inside
it — a concurrent edit is always seen by the state guards, so an
edit+approve race can never yield `synced`-with-stale-content in either
interleaving (edit wins → the decision 400s, audited WARNING; decision
wins → the next PUT forced-resets the approved content to draft, audited
AUD-P01). Cross-pod scope (W2-FIX-3, `bccd441`): the lock is the
**same-pod** serializer; the cross-pod serialization point is the
`SELECT … FOR UPDATE` re-read inside `runNewsTransition` — under READ
COMMITTED a blocked lock re-reads the **latest committed row** when
granted, so the guards evaluate the winner's state even when a different
pod's transaction wins the race. Safe under the shipped `replicas: 2`
topology (one gateway process per pod); proven by the smoke §18 two-pod
shared-PG races (Doc 12, TC-NEWS-020..022).

**Blocker 2 — legacy-decision denial audit.** Approve/reject on a
`pending_approval` row with no `submittedBy` (pre-migration shape; no API
path can create it today — every submit stamps) is denied 409 pending a
fresh submission cycle, and the denial writes an `ACCESS_DENIED`/WARNING
row — `targetResource: 'News Announcement'`, details `Blocked: decision on
legacy submission "<title…30>..." with no recorded submitter (pre-migration
row) — a fresh submission cycle is required before approve/reject.` This is
a handler-level decision denial — a fourth call-site class for the member
alongside the AUD-P07 middleware 403/401s — reusing an existing union
member (no union change).

**Blocker 3 — withdrawal audit.** The state-only withdrawal endpoint
(Doc 08 §6.8) writes the AUD-P01-shaped `UPDATE`/SUCCESS row with
`prior_status='synced'` in `details` — the same shape as the W2-1
edit-reset rows — committed atomically with the transition inside
`runNewsTransition`. A refused withdrawal (409, not synced) writes
**no** audit row (no transition occurred).

Verified by smoke §17 (Doc 12, TC-NEWS-013..019): audit-failure rollback
proofs in memory and PG, the edit+approve concurrency race in memory and
PG, and the fixture-seeded legacy denial — and, since W2-FIX-3, by smoke
§18 (Doc 12 v1.10.0, TC-NEWS-020..022): two spawned server processes
against one shared PostgreSQL, proving cross-pod state visibility and both
edit-vs-decision races (edit-vs-approve, edit-vs-withdraw) under the
`FOR UPDATE` transitions. The two regression hooks —
`SMOKE_INJECT_AUDIT_FAILURE` (a workflow transition's audit write throws
inside the atomic commit, firing only when the plan actually carries an
audit row) and `SMOKE_SEED_W2FIX1_FIXTURES` (boot-seeds a legacy no-submitter
pending row + a live synced row) — are env-gated **and** inert in
production (`NODE_ENV`-checked); no API path can manufacture the legacy
shape.

## 10. Traceability

| Topic here | Requirement refs (scheme per Doc 03/04) | Verified by (Doc 12) |
|---|---|---|
| Event catalog §5 | FR-AUDIT-* | TC-AUDIT-001…008 |
| Actor authenticity §4 | FR-AUDIT-*, FR-SEC-* | TC-AUDIT-006 (actor integrity), smoke suite §9 |
| Query access §6 | FR-AUDIT-*, FR-AUTH-* | TC-RBAC-013 (maker 403), TC-AUDIT-001 |
| Append-only §3 | FR-AUDIT-* | TC-AUDIT-007 (no mutation routes) |
| Coverage gaps §9 | FR-AUDIT-`[PLANNED]` | Wave 2 test additions |
| W2-3 spec §9.1/§9.2 (ratified P0 tail — **landed `4650335`**; AUD-P07 trim + 3-member prune `CREATE`/`DELETE`/`SYNC_PUBLIC` ruled and executed; `UPDATE` retained) | FR-AUDIT-003 W2-3 extension (Doc 03/04 v1.5.0 — AS-BUILT) — AUD-P05/06/07 | TC-SYNC-004, TC-AUDIT-009/010 (asserted, Doc 12 v1.8.0), TC-SEC-013 (dual flip resolved) |
| W2-FIX-1 atomicity + legacy-decision denial + withdrawal audit §9.3 (**landed `2c97cc3`; executor superseded by W2-FIX-3 `bccd441` — cross-pod `FOR UPDATE` transitions**) | FR-NEWS-009 W2-FIX-1 extension + FR-NEWS-010 cross-pod extension (Doc 03/04 v1.7.0) | TC-NEWS-013..019 (asserted — smoke §17, Doc 12 v1.9.0) + TC-NEWS-020..022 (asserted — smoke §18, Doc 12 v1.10.0) |
| DCR-8 removal (§5 AUD-11 / §6) | FR-AUDIT-004 `[REMOVED per DCR-8]` (Doc 03 v1.2.0) | TC-AUDIT-008 / TC-RBAC-026 (404 — asserted, Doc 12) |

Exact FR identifiers are enumerated in Doc 03 (SRS); Doc 04 (RTM)
reconciles — mismatches resolve to Doc 03 in the Lead pass.
