# Deliverable 12 — Test Plan

**Version:** 1.0.0 · **Status:** Draft · **Date:** 2026-09-10 · **Author:** worker-5 → Lead review → CTO approval

> This plan governs all verification of the KB J Capital intranet portal —
> both the existing AS-BUILT assets (`scripts/smoke-test.mjs`,
> `tests/e2e-walkthrough.mjs`, `tests/gen-report.mjs`, `scripts/schema.sql`)
> and the Wave 2–3 runs they feed. Sources of truth: `server.ts`,
> `package.json` scripts, `HANDOVER.md` §11, Doc 08 (API Spec), Doc 09 (RBAC
> matrix), Doc 10 (audit catalog). Future work is marked `[PLANNED]`.

---

## 1. Purpose, scope & objectives

**Purpose.** Define what will be tested, how, in which environment, with
which pass/fail evidence — so that Deliverable 17 (System Test Result),
Deliverable 18 (UAT Result), Deliverable 19 (VA/Pentest Report) and
Deliverable 20 (Security Remediation Report) can be produced from recorded
runs, not narrative claims.

**In scope:** Express API (`server.ts` → `dist/server.cjs`), React SPA
(`src/`), persistence (in-memory + PostgreSQL 16), auth/session/RBAC,
maker-checker workflow, audit trail, uploads, docker-compose deployment
topology, security controls listed in Doc 09 §11.

**Out of scope (this plan):** Kubernetes cluster performance under real load
beyond the PERF smoke set, the external public-website sync receiver (modelled,
not wired — HANDOVER §10), and penetration testing of infrastructure outside
the application container (WAF, ingress, cluster).

**Objectives:**

1. Every requirement (Doc 03) has at least one executable test case (Doc 04 RTM).
2. The RBAC matrix (Doc 09 §6) is verified negative-and-positive for every
   protected endpoint — server-enforced, not just UI-hidden.
3. Maker-checker dual control is provably two-person (no self-approval path).
4. Audit events are recorded with session-derived actors for every action in
   Doc 10 §5.
5. No run is reported green without machine evidence (exit codes, counts,
   report files) — **no fake completion**.

## 2. References

| Ref | Artifact |
|---|---|
| R1 | `package.json` scripts: `lint` = `tsc --noEmit`; `build` = `vite build && esbuild …` |
| R2 | `scripts/smoke-test.mjs` — self-spawning API/RBAC suite (15 sections, 62 checks), report → `.omc/reports/smoke-report.md`, exit 1 = FAIL, 2 = boot failure |
| R3 | `tests/e2e-walkthrough.mjs` — Playwright browser walkthrough (S/A/B/C/D/E/F sections, 64 steps), screenshots → `.omc/reports/screenshots/`, results → `.omc/reports/e2e-results.json` |
| R4 | `tests/gen-report.mjs` — renders e2e-results.json as a markdown verdict table |
| R5 | `docker-compose.yml` (app + postgres:16-alpine, healthchecks), `scripts/schema.sql` |
| R6 | `k8s/` manifests + `deploy-k8s.sh` (validate with `docker compose config` / `kubectl kustomize k8s`) |
| R7 | Docs 03 (SRS), 04 (RTM), 08 (API), 09 (RBAC), 10 (Audit), 11 (UI) |

## 3. Test environments (ENV matrix)

| | ENV-DEV (default) | ENV-PROD-MODE |
|---|---|---|
| Used by | L0–L3 static/build/smoke/E2E; dev debugging | L4 system test; L5 security; deployment rehearsal |
| Commands | `npm run dev` (tsx) — smoke suite spawns `node dist/server.cjs` itself | `docker compose up -d --build` after `.env` from `.env.production.example` |
| `NODE_ENV` | unset (dev) | `production` |
| `DATABASE_URL` | **unset** → in-memory repository (data resets on restart) | set → PostgreSQL 16 via compose |
| `SESSION_SECRET` | auto-generated ephemeral (warned); smoke suite sets a fixed test secret | **mandatory** (compose refuses to start without it) |
| Admin bootstrap | `ADMIN_USERNAME`/`ADMIN_PASSWORD` or dev default `admin` / `ChangeMe@KBJ2026!`; demo maker/checker/staff accounts also seeded | one-time random password printed to boot log when `ADMIN_PASSWORD` unset |
| Uploads | `UPLOAD_DIR=./uploads-test` (smoke) | named volume `/app/uploads` |
| Probes | `/healthz` process-level; `/readyz` checks in-memory stores | `/healthz` process-level; `/readyz` = real `SELECT 1` against PostgreSQL (dead DB ⇒ 503, pod leaves rotation) |
| Data reset | restart the process / re-run suite | `docker compose down -v` (destroys pgdata) |

Environment rules:

- Test users are provisioned per-run via `POST /api/users` (smoke suite:
  `smokemaker` / `smokechecker` / `smokestaff`; E2E: `maker01` /
  `checker01` / `staff01`, all `E2E-Test@2026`) so suites run against any
  FRESH server.
- The rate-limit test always runs **last** in a suite (it exhausts the
  per-IP budget for 60 s) — R2 §14, R3 ordering rule.
- Each suite gets a dedicated port (smoke 3210, E2E 3220) so a dev server on
  3000 is never disturbed.

## 4. Test strategy — levels

| Level | Objective | Tool / command | Evidence |
|---|---|---|---|
| L0 Static | Type-level correctness, no debug residue | `npm run lint` (tsc --noEmit) | exit code 0 |
| L1 Build | Both artifacts build (SPA + server bundle) | `npm run build` | exit 0, `dist/` + `dist/server.cjs` exist |
| L2 Smoke / API | Full API contract, RBAC matrix, auth lifecycle, maker-checker, audit actor integrity, upload whitelist/limits, rate limit — against a real server process | `node scripts/smoke-test.mjs` (spawns built server, prod-mode env, in-memory store) | PASS/FAIL per check, `.omc/reports/smoke-report.md`, exit 0 |
| L3 E2E walkthrough | Real-browser, per-role journeys through the Thai-first UI | `node tests/e2e-walkthrough.mjs` (+ `node tests/gen-report.mjs`) | `e2e-results.json`, screenshots, verdict table |
| L4 System test | Composed stack behaves as a system: PG persistence, probes, graceful shutdown, migration/export path | `docker compose up -d --build`; `curl` probes; `scripts/migrate.js`; `GET /api/system/export` | probe outputs, export counts, container logs |
| L5 Security | Negative/abuse testing + dependency/secrets hygiene (feeds Doc 19) | `npm audit --omit=dev`; secrets scan (`.env*` excluded from build context, `git log -p` spot check); scripted RBAC negatives (§6.16); rate-limit 429; upload whitelist negatives; header assertions | findings register → Doc 19 |
| L6 UAT | Business acceptance per role, Thai-first UI, by (proxy) business users | scripted role scenarios (§5) run on ENV-PROD-MODE with seeded demo data; recorded screen captures | signed-off scenario results → Doc 18 |

Mapping to classic levels: L0/L1 = static verification; L2 = API/integration
testing; L3/L4 = system testing; L5 = security testing; L6 = acceptance
testing. Unit testing per-module is not currently an asset in the repo;
`[PLANNED]` a vitest unit layer for pure functions (filters, sanitizers) in
Wave 2 — until then L2 covers those behaviors through the API surface.

## 5. UAT scenarios (role-based, Thai-first UI)

Each scenario is executed in ENV-PROD-MODE by a user holding only the stated
role. UI strings quoted as displayed (Thai first). Full pass criteria: the
scenario completes with the business outcome and no error toast
("เกิดข้อผิดพลาด…" class messages).

| UAT ID | Role | Scenario | Acceptance |
|---|---|---|---|
| UAT-1 | staff | Log in → read news ("ข่าวสารและประกาศ") → find a colleague in Directory ("สมุดโทรศัพท์") by search → open a policy document → book a meeting room → release it | All five tasks complete; no CMS/Sync views appear in the header nav |
| UAT-2 | maker | Log in → CMS ("จัดการเนื้อหา") → create an announcement with attachment upload → see it as draft → edit it → submit for approval ("ส่งขออนุมัติ") → status shows pending (amber dot) | Draft persists, submission changes status, maker cannot approve own item |
| UAT-3 | checker | Log in → approval queue → review pending item → reject with Thai reason ("ปฏิเสธ / Reject" form) → resubmitted item → approve | Reject records reason; approve stamps ✓ approver and status becomes synced; audit trail tab shows both decisions |
| UAT-4 | admin | Log in → User Management ("จัดการผู้ใช้") tab → create a staff account → deactivate it → attempt self-deactivation (blocked) → re-activate → trigger public sync → export system JSON | Account lifecycle works; self-deactivation refused with clear message; export downloads with non-zero counts |
| UAT-5 | staff (negative) | Try to reach CMS by URL state and deleted-account login | CMS never renders (view snaps back); deactivated account login fails with generic error |
| UAT-6 | anonymous | Visit portal logged out | Only public marketing surfaces (news list, banners, rooms, tools) and the login screen; directory/documents demand login |

## 6. Test case catalog

Conventions: ID `TC-<DOMAIN>-<nnn>`; priority **P0** (release gate), **P1**
(must fix before UAT sign-off), **P2** (best effort). REQ refs use the
`FR-<DOMAIN>-<nnn>` scheme; exact identifiers are enumerated in Doc 03 and
reconciled by Doc 04 (RTM) — the Lead pass aligns this table to those IDs.
Preconditions marked "(fresh)" mean a just-started server/stack per §3.

### 6.1 Authentication — AUTH

| ID | Title | Pre | Steps | Expected | REQ | Pri |
|---|---|---|---|---|---|---|
| TC-AUTH-001 | Valid login issues session | (fresh) seeded user | POST /api/auth/login with correct credentials | 200, `{data}` = SafeUser (no passwordHash), Set-Cookie `kbj_session` httpOnly | FR-AUTH | P0 |
| TC-AUTH-002 | Wrong password → 401 + audit | user exists | POST login with bad password | 401 generic error; audit LOGIN_FAILED/WARNING with attempted username | FR-AUTH | P0 |
| TC-AUTH-003 | Unknown user → identical 401 | — | POST login with nonexistent username | Same status/body/timing class as TC-AUTH-002 (dummy-hash uniformity) | FR-SEC | P1 |
| TC-AUTH-004 | Blank/malformed body → 401, no audit | — | POST login `{}`, `{username:1}` | 401; no LOGIN_FAILED row (documented gap AUD-P09) | FR-AUTH | P2 |
| TC-AUTH-005 | `GET /api/auth/me` round-trip | logged in | GET with session cookie | 200 with current user; without cookie 401 | FR-AUTH | P0 |
| TC-AUTH-006 | Logout destroys session | logged in | POST logout, then GET /api/auth/me | Logout 200; subsequent me → 401; audit LOGOUT written | FR-AUTH | P0 |
| TC-AUTH-007 | Tampered cookie rejected | valid cookie | Flip chars in the signature part; GET /api/auth/me | 401; no session side effects | FR-SEC | P0 |
| TC-AUTH-008 | Cookie flags | ENV-PROD-MODE | Inspect Set-Cookie | `Secure` when NODE_ENV=production, `SameSite=Lax`, `HttpOnly`, path=/ | FR-SEC | P1 |
| TC-AUTH-009 | Rate limit 429 | (fresh IP budget) | 6 consecutive bad logins | #1–5 → 401; #6 → 429 with JSON body + draft-7 headers; budget recovers after 60 s | FR-SEC | P0 |
| TC-AUTH-010 | Rate limit counts failures only | valid user | 5 successful logins rapidly | No 429 (skipSuccessfulRequests) | FR-SEC | P1 |

### 6.2 Session management — SES

| ID | Title | Pre | Steps | Expected | REQ | Pri |
|---|---|---|---|---|---|---|
| TC-SES-001 | 7-day TTL enforced | session row | Advance/insert expired session record; call /api/auth/me | 401; expired row deleted by sweeper/resolver | FR-SES | P1 |
| TC-SES-002 | Expired-session sweeper runs | PG mode | Wait for hourly sweep (or verify deleteExpiredSessions SQL) | `sessions.expires_at < now()` rows removed | FR-SES | P2 |
| TC-SES-003 | Deactivation revokes live sessions | admin, victim logged in | PATCH users/:id isActive=false; victim calls /api/auth/me | Victim gets 401 immediately (no re-login) | FR-USER | P0 |
| TC-SES-004 | Sessions persist across restart (PG) | ENV-PROD-MODE | Restart app container; reuse cookie | Session still valid (sessions table) | FR-SES | P1 |
| TC-SES-005 | Sessions lost on restart (memory) — documented | ENV-DEV | Restart dev server; reuse cookie | 401 (accepted dev-mode behavior) | FR-SES | P2 |
| TC-SES-006 | SESSION_SECRET mandatory in prod | NODE_ENV=production, no secret | Start process | Process exits with FATAL message | FR-SEC | P0 |

### 6.3 News — NEWS

| ID | Title | Pre | Steps | Expected | REQ | Pri |
|---|---|---|---|---|---|---|
| TC-NEWS-001 | Anonymous can list/search news | — | GET /api/news, ?search=, ?category= | 200 {data,total}; filters apply (title/titleEn/summary/department match) | FR-NEWS | P0 |
| TC-NEWS-002 | Maker creates announcement | maker | POST /api/news full body | 201; defaults applied (category, badge, publishedAt Thai date, author = display name); status draft when syncToExternal false | FR-NEWS | P0 |
| TC-NEWS-003 | Maker edits announcement | item exists | PUT /api/news/:id partial | 200; id immutable; unknown id 404 | FR-NEWS | P0 |
| TC-NEWS-004 | Update merges, not replaces | item exists | PUT with only summary | Other fields preserved | FR-NEWS | P1 |
| TC-NEWS-005 | Admin deletes announcement | admin | DELETE /api/news/:id | 200; subsequent GET excludes it; externally-synced item also writes sync log DELETE | FR-NEWS | P0 |
| TC-NEWS-006 | Submit-approval transitions state | maker draft | POST /:id/submit-approval | 200; externalSyncStatus=pending_approval; syncToExternal forced false; audit SUBMIT_APPROVAL | FR-CMS | P0 |
| TC-NEWS-007 | Approve stamps checker + syncs | pending item; checker | POST /:id/approve | 200; status synced; approvedBy/approvedAt set; audit APPROVE; sync log CREATE | FR-CMS | P0 |
| TC-NEWS-008 | Reject records reason | pending item; checker | POST /:id/reject {reason} | 200; status rejected; approvedBy embeds reason; audit REJECT/REJECTED | FR-CMS | P0 |
| TC-NEWS-009 | Reject default reason applied | pending item | POST /:id/reject {} | Default regulatory wording used | FR-CMS | P2 |
| TC-NEWS-010 | News list ordering | several items | GET /api/news | Newest first (memory: unshift; PG: seq DESC) | FR-NEWS | P2 |
| TC-NEWS-011 | DCR-3 publish bypass — as-built pin | maker | POST /api/news with `syncToExternal:true` (no submit/approve) | **As built:** 201, `externalSyncStatus='synced'`, sync-log CREATE row with `syncedBy`=maker, and **no audit entry** (Doc 10 §5.1). Test pins current behavior; must FAIL (flip) when the DCR-3 enforcement fix lands — see TC-SEC-011 | FR-CMS | P0 |
| TC-NEWS-012 | externalSyncStatus runtime enum (DCR-5) | maker+checker | Drive all transitions; GET /api/news | Only `draft`, `pending_approval`, `synced`, `rejected` ever appear; the `'pending'` member of the TS union (`src/types.ts:28`) is dead at runtime — no response contains it | FR-CMS | P1 |

### 6.4 Banners — BANNER

| ID | Title | Pre | Steps | Expected | REQ | Pri |
|---|---|---|---|---|---|---|
| TC-BANNER-001 | Anonymous lists banners | — | GET /api/banners | 200 {data} | FR-BANNER | P0 |
| TC-BANNER-002 | Maker creates banner | maker | POST /api/banners | 201 with defaults (badge, actionText "อ่านรายละเอียด", order = length+1, isActive true) | FR-BANNER | P0 |
| TC-BANNER-003 | Maker updates banner | exists | PUT /api/banners/:id | 200; unknown 404 | FR-BANNER | P1 |
| TC-BANNER-004 | Admin deletes banner | admin | DELETE /api/banners/:id | 200 | FR-BANNER | P0 |
| TC-BANNER-005 | Sort order preserved | several banners | GET | Ordered by sort_order/seq ASC | FR-BANNER | P2 |

### 6.5 Contacts directory — CONTACT

| ID | Title | Pre | Steps | Expected | REQ | Pri |
|---|---|---|---|---|---|---|
| TC-CONTACT-001 | Staff searches directory | staff | GET /api/contacts?search=&department=&floor= | 200; match on name/nameEn/position/extension | FR-CONTACT | P0 |
| TC-CONTACT-002 | Anonymous blocked | — | GET /api/contacts | 401 | FR-CONTACT | P0 |
| TC-CONTACT-003 | Maker adds contact | maker | POST /api/contacts | 201; defaults (floor 14th) | FR-CONTACT | P0 |
| TC-CONTACT-004 | Maker updates contact | exists | PUT /api/contacts/:id | 200 | FR-CONTACT | P1 |
| TC-CONTACT-005 | Admin deletes contact | admin | DELETE | 200 | FR-CONTACT | P0 |

### 6.6 Policy documents — DOC

| ID | Title | Pre | Steps | Expected | REQ | Pri |
|---|---|---|---|---|---|---|
| TC-DOC-001 | Staff lists documents | staff | GET /api/documents(?category=) | 200 filtered | FR-DOC | P0 |
| TC-DOC-002 | Anonymous blocked | — | GET /api/documents | 401 | FR-DOC | P0 |
| TC-DOC-003 | Maker registers document | maker | POST /api/documents | 201; isNew=true; defaults v1.0/# | FR-DOC | P0 |
| TC-DOC-004 | Admin deletes document | admin | DELETE /api/documents/:id | 200 | FR-DOC | P0 |
| TC-DOC-005 | Document metadata drives UI badges | several docs | Inspect is_new/category rendering in E2E | "เอกสารใหม่" badge only for isNew | FR-DOC | P2 |

### 6.7 Meeting rooms — ROOM

| ID | Title | Pre | Steps | Expected | REQ | Pri |
|---|---|---|---|---|---|---|
| TC-ROOM-001 | Anonymous lists rooms | — | GET /api/rooms | 200 {data} | FR-ROOM | P0 |
| TC-ROOM-002 | Staff books available room | staff | POST /api/rooms/:id/book {topic,time} | 200; status in-use; currentBooking records booker from session | FR-ROOM | P0 |
| TC-ROOM-003 | Double-booking refused | room in-use | POST book same room | 400 "currently booked or under maintenance" | FR-ROOM | P0 |
| TC-ROOM-004 | Release clears booking | booked room | POST /:id/release | 200; status available; booking cleared (not just toast — E2E B12 verifies state) | FR-ROOM | P0 |
| TC-ROOM-005 | Unknown room 404 | — | POST /api/rooms/nope/book | 404 | FR-ROOM | P1 |
| TC-ROOM-006 | Empty-id room ops → 400 | — | POST /api/rooms//book | 400 "Resource id is required" (id guard) | FR-SEC | P1 |

### 6.8 CMS / maker-checker workflow — CMS

| ID | Title | Pre | Steps | Expected | REQ | Pri |
|---|---|---|---|---|---|---|
| TC-CMS-001 | CMS view hidden below maker | staff session | Open SPA | No "Admin CMS"/"External Web Sync" nav; forced view state resets | FR-CMS | P0 |
| TC-CMS-002 | Full maker→checker happy path | maker+checker | E2E D-section walkthrough: create → submit → approve | Status dot draft→pending(amber pulse)→synced; audit trail shows chain | FR-CMS | P0 |
| TC-CMS-003 | Reject reason mandatory in UI | checker, pending item | Open reject form, clear reason | Reject button disabled until reason non-empty ("ปฏิเสธ / Reject") | FR-CMS | P1 |
| TC-CMS-004 | Checker cannot author | checker session in CMS | Attempt create controls | Authoring controls absent/`canWrite` false; API 403 (TC-RBAC-003) | FR-CMS | P0 |
| TC-CMS-005 | User Management tab admin-only | maker session | Inspect CMS tabs | Tab absent; direct tab state cannot render (canAdmin gate) | FR-USER | P0 |
| TC-CMS-006 | Audit tab checker+ | maker session | Inspect CMS tabs | "BOT / PDPA Audit Trail" tab absent for maker | FR-AUDIT | P1 |
| TC-CMS-007 | Approve-by-API from draft (state guard gap) | draft item; checker | POST approve directly | **As built: succeeds** — DCR-3 known gap; expected result documents current behavior pending Wave 2 fix (then: 400 illegal transition) | FR-CMS | P1 |
| TC-CMS-008 | Create-with-syncToExternal shortcut (UI path) | maker | CMS news form with sync checkbox checked; submit via UI | **As built: status synced + sync log, no checker** — DCR-3 documented (API-level pin: TC-NEWS-011; post-fix expectation: TC-SEC-011) | FR-CMS | P0 |

### 6.9 User management — USER

| ID | Title | Pre | Steps | Expected | REQ | Pri |
|---|---|---|---|---|---|---|
| TC-USER-001 | Bootstrap admin exists | (fresh) empty store | Boot server; login as ADMIN_USERNAME/PASSWORD | Login succeeds; role admin | FR-USER | P0 |
| TC-USER-002 | Prod bootstrap prints one-time password | ENV-PROD-MODE, no ADMIN_PASSWORD | Boot; read logs | Random password printed once with change warning | FR-USER | P1 |
| TC-USER-003 | Create user validations | admin | POST /api/users ×6 bad payloads | 400 for username pattern (3–32, `[a-zA-Z0-9._-]`), password <8, missing displayName, bad email, invalid role | FR-USER | P0 |
| TC-USER-004 | Duplicate username 409 | user exists | POST same username | 409 | FR-USER | P0 |
| TC-USER-005 | Deactivate blocks login | admin, victim | PATCH isActive=false; victim login | Login 401 + LOGIN_FAILED audit | FR-USER | P0 |
| TC-USER-006 | Self-deactivation blocked | admin | PATCH own id isActive=false | 400 "cannot deactivate your own account" | FR-USER | P0 |
| TC-USER-007 | Reactivate restores access | deactivated user | PATCH isActive=true; login | Login succeeds | FR-USER | P1 |
| TC-USER-008 | No user delete endpoint | admin | DELETE /api/users/:id | JSON 404 (no API endpoint) — records kept by design | FR-USER | P1 |

### 6.10 Audit trail — AUDIT

| ID | Title | Pre | Steps | Expected | REQ | Pri |
|---|---|---|---|---|---|---|
| TC-AUDIT-001 | Checker reads trail | checker | GET /api/audit-logs | 200 {data} newest-first | FR-AUDIT | P0 |
| TC-AUDIT-002 | Login events recorded | any login | GET trail after TC-AUTH-001/002 | LOGIN/SUCCESS and LOGIN_FAILED/WARNING rows with IP | FR-AUDIT | P0 |
| TC-AUDIT-003 | Approval chain recorded | run TC-NEWS-006..008 | Inspect trail | SUBMIT_APPROVAL→APPROVE/REJECT with actor roles Checker/Maker | FR-AUDIT | P0 |
| TC-AUDIT-004 | User admin events recorded | run USER cases | Inspect trail | USER_CREATE / USER_ACTIVATE / USER_DEACTIVATE rows | FR-AUDIT | P0 |
| TC-AUDIT-005 | Upload event recorded | maker upload | Inspect trail | FILE_UPLOAD with uuid filename + byte size | FR-AUDIT | P1 |
| TC-AUDIT-006 | Actor integrity (client spoof ignored) | staff session | Perform actions while sending spoofed `actor` fields in body; read trail | Stored actor = session username/role, never client values (smoke §9) | FR-AUDIT | P0 |
| TC-AUDIT-007 | No mutation routes | admin | PUT/DELETE/PATCH /api/audit-logs(:id) | JSON 404 — append-only | FR-AUDIT | P0 |
| TC-AUDIT-008 | Manual append admin-only + actor server-derived | admin/maker | POST /api/audit-logs | admin 201 (actor from session); maker 403; defaults applied | FR-AUDIT | P1 |

### 6.11 Public sync — SYNC

| ID | Title | Pre | Steps | Expected | REQ | Pri |
|---|---|---|---|---|---|---|
| TC-SYNC-001 | Sync logs admin-only readable | admin | GET /api/sync/logs | 200 {data} | FR-SYNC | P0 |
| TC-SYNC-002 | Trigger writes FORCE_SYNC log | admin | POST /api/sync/trigger | 200; log row BULK-ALL with counted items; syncedBy=admin | FR-SYNC | P0 |
| TC-SYNC-003 | Approve writes CREATE sync log | checker approves | Inspect sync logs | Row with item id, endpoint api.kbjcapital.co.th/v1/public/news | FR-SYNC | P1 |
| TC-SYNC-004 | Sync trigger audited? (gap) | admin | Trigger; check audit | **No audit row (sync_logs only)** — documented gap AUD-P05 | FR-AUDIT | P2 |

### 6.12 Uploads — UPL

| ID | Title | Pre | Steps | Expected | REQ | Pri |
|---|---|---|---|---|---|---|
| TC-UPL-001 | Maker uploads PNG | maker | POST /api/upload multipart 1×1 PNG | 201 {url:/uploads/<uuid>.png, fileName, size}; file on disk | FR-UPL | P0 |
| TC-UPL-002 | Whitelist rejects dangerous types | maker | Upload .exe/.sh/.html/.svg/.js/.txt | 400 with allowed-extensions message; nothing written | FR-SEC | P0 |
| TC-UPL-003 | Crafted extensions rejected | maker | `.jpg.exe`, `.jpg%00`, trailing-dot names | 400 | FR-SEC | P1 |
| TC-UPL-004 | MIME/extension mismatch rejected | maker | .png with declared image/gif | 400 content-type mismatch | FR-SEC | P1 |
| TC-UPL-005 | 10MB limit | maker | 11MB+ file | 413 | FR-SEC | P0 |
| TC-UPL-006 | No file field → 400 | maker | Empty multipart | 400 | FR-UPL | P2 |
| TC-UPL-007 | Staff blocked | staff | Valid upload | 403 | FR-UPL | P0 |
| TC-UPL-008 | Uploaded files served safely | any upload | GET /uploads/<uuid>.<ext> | 200 with nosniff header; directory traversal (`/uploads/../server.ts`) blocked by static handler | FR-SEC | P1 |

### 6.13 Search — SRCH

| ID | Title | Pre | Steps | Expected | REQ | Pri |
|---|---|---|---|---|---|---|
| TC-SRCH-001 | News search multi-field | seeded news | GET /api/news?search= by title TH / titleEn / summary / department | All matchers return the item | FR-SRCH | P0 |
| TC-SRCH-002 | Case-insensitive | — | search with mixed case | Matches lowercase comparison | FR-SRCH | P1 |
| TC-SRCH-003 | Contact search fields | staff | ?search= on name/nameEn/position/extension | Matches | FR-SRCH | P1 |
| TC-SRCH-004 | Category filters combine | — | news ?category + contacts ?department+?floor | Intersection respected | FR-SRCH | P2 |

### 6.14 Probes & platform — SES/PLATFORM *(probe cases share the SES domain)*

| ID | Title | Pre | Steps | Expected | REQ | Pri |
|---|---|---|---|---|---|---|
| TC-SES-010 | /healthz liveness | any env | GET /healthz | 200 status healthy, version 2.0.0, uptime present | FR-SES | P0 |
| TC-SES-011 | /readyz PG-aware | ENV-PROD-MODE | GET /readyz | 200 database connected; kill PG → 503 not_ready | FR-SES | P0 |
| TC-SES-012 | /readyz memory-mode | ENV-DEV | GET /readyz | 200 while stores hydrated | FR-SES | P1 |
| TC-SES-013 | Graceful shutdown | compose stack | docker stop app (SIGTERM) | Logs clean shutdown; pool closed; exits 0 within grace period | FR-SES | P1 |

### 6.15 Performance — PERF

| ID | Title | Pre | Steps | Expected | REQ | Pri |
|---|---|---|---|---|---|---|
| TC-PERF-001 | News list latency | seeded data | 100× GET /api/news | p95 < 300 ms (dev host) | FR-PERF | P2 |
| TC-PERF-002 | Login latency (bcrypt cost 12) | — | 20× login | p95 < 1.5 s — bounded by design; document, not fail | FR-PERF | P2 |
| TC-PERF-003 | Audit trail transfer size | ≥5k rows | GET /api/audit-logs | Measures payload; no pagination today → feeds `[PLANNED]` Doc 10 §6 | FR-PERF | P2 |
| TC-PERF-004 | Upload throughput | — | 10× 1MB files | All 201; no fd leaks | FR-PERF | P2 |

### 6.16 RBAC negative matrix — RBAC (the core security regression)

One case per protected endpoint × wrong role, asserted via direct API calls
with a real low-privilege session cookie (server enforcement, not UI). Covered
by smoke suite §2/§6/§7/§8/§10/§12 and extended here for full Doc 09 §6
coverage. Anonymous = no cookie → 401 `Authentication required`;
authenticated-wrong-role → 403 `Insufficient permissions`.

| ID | Request as (role) | Expected | Traces |
|---|---|---|---|
| TC-RBAC-001 | anon GET /api/contacts | 401 | FR-AUTH |
| TC-RBAC-002 | anon GET /api/documents | 401 | FR-AUTH |
| TC-RBAC-003 | staff POST /api/news | 403 | FR-AUTH |
| TC-RBAC-004 | checker POST /api/news (compliance cannot author) | 403 | FR-CMS |
| TC-RBAC-005 | staff PUT /api/news/:id | 403 | FR-AUTH |
| TC-RBAC-006 | staff POST /api/banners | 403 | FR-AUTH |
| TC-RBAC-007 | staff POST /api/contacts | 403 | FR-AUTH |
| TC-RBAC-008 | staff POST /api/documents | 403 | FR-AUTH |
| TC-RBAC-009 | staff POST /api/news/:id/submit-approval | 403 | FR-CMS |
| TC-RBAC-010 | checker POST /api/news/:id/submit-approval | 403 | FR-CMS |
| TC-RBAC-011 | maker POST /api/news/:id/approve (no self-approval) | 403 | FR-CMS |
| TC-RBAC-012 | staff POST /api/news/:id/approve | 403 | FR-CMS |
| TC-RBAC-013 | maker GET /api/audit-logs | 403 | FR-AUDIT |
| TC-RBAC-014 | staff GET /api/audit-logs | 403 | FR-AUDIT |
| TC-RBAC-015 | maker GET /api/sync/logs | 403 | FR-SYNC |
| TC-RBAC-016 | checker POST /api/sync/trigger | 403 | FR-SYNC |
| TC-RBAC-017 | maker GET /api/system/export | 403 | FR-SEC |
| TC-RBAC-018 | staff GET /api/users | 403 | FR-USER |
| TC-RBAC-019 | checker POST /api/users | 403 | FR-USER |
| TC-RBAC-020 | staff PATCH /api/users/:id | 403 | FR-USER |
| TC-RBAC-021 | staff POST /api/upload | 403 | FR-UPL |
| TC-RBAC-022 | maker DELETE /api/news/:id | 403 | FR-SEC |
| TC-RBAC-023 | checker DELETE /api/banners/:id | 403 | FR-SEC |
| TC-RBAC-024 | maker DELETE /api/contacts/:id | 403 | FR-SEC |
| TC-RBAC-025 | checker DELETE /api/documents/:id | 403 | FR-SEC |
| TC-RBAC-026 | checker POST /api/audit-logs | 403 | FR-AUDIT |
| TC-RBAC-027 | anon POST /api/upload | 401 | FR-UPL |
| TC-RBAC-028 | anon GET /api/users | 401 | FR-USER |
| TC-RBAC-029 | staff book/release allowed (positive control) | 200 | FR-ROOM |
| TC-RBAC-030 | checker GET /api/audit-logs allowed (positive control) | 200 | FR-AUDIT |

Positive controls (029/030, plus TC-NEWS-002/007, TC-USER-003) guard against a
middleware regression that 403s everything.

### 6.17 Security — SEC (beyond RBAC; feeds Doc 19)

| ID | Title | Pre | Steps | Expected | REQ | Pri |
|---|---|---|---|---|---|---|
| TC-SEC-001 | Security headers on every response | — | GET / and /api/news, inspect | `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1;mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` camera/mic/geo denied | FR-SEC | P0 |
| TC-SEC-002 | API 404s are JSON, not SPA HTML | — | GET /api/nonsense | 404 `{success:false,error:"No API endpoint…"}` | FR-SEC | P1 |
| TC-SEC-003 | Malformed JSON → clean 400 | any session | PUT /api/news/:id body `{oops` | 400 `{error:"Invalid JSON body"}` (E2E C-API) | FR-SEC | P1 |
| TC-SEC-004 | Oversized JSON body → 413 | — | >10mb JSON | 413 envelope, no 500 | FR-SEC | P1 |
| TC-SEC-005 | Id-less mutations → 400 | — | PUT/DELETE /api/news/ (trailing slash), /news//approve | 400 "Resource id is required" | FR-SEC | P1 |
| TC-SEC-006 | Dependency audit | — | `npm audit --omit=dev` | No High/Critical (or ticketed exceptions) | FR-SEC | P0 |
| TC-SEC-007 | No secrets in repo/image | — | Scan repo + `docker history` | No SESSION_SECRET/DB passwords committed; `.dockerignore` excludes env files | FR-SEC | P0 |
| TC-SEC-008 | Uploads dir not listable | any | GET /uploads/ | No index (index:false) | FR-SEC | P2 |
| TC-SEC-009 | Login timing uniformity | — | Compare unknown-user vs wrong-password latency | Same order of magnitude (dummy bcrypt hash) | FR-SEC | P2 |
| TC-SEC-010 | Container hardening | image built | Inspect Dockerfile/runtime | Non-root uid 10001, read-only rootfs in k8s, HEALTHCHECK wired | FR-SEC | P1 |
| TC-SEC-011 | Dual-control enforcement (post DCR-3 fix) | `[PLANNED]` blocked until Wave 2 fix | POST /api/news `syncToExternal:true`; approve a `draft`; PUT workflow fields | After fix: create/update cannot yield `synced` (strip/ignore → stays `draft`); approve/reject require `pending_approval` (else 400); `approvedBy/approvedAt` server-set only | FR-CMS | P0 |
| TC-SEC-012 | Response-envelope inconsistency (DCR-4, as-built pin) | any session | GET /api/news, /api/banners; GET /api/news/:bad-id (PUT) | **As built:** reads return `{data[,total]}` with **no** `success` field; some 404s return bare `{error}` without `success:false`; the id-guard 400s **do** include `success:false`. Test pins the mixed envelope so clients (and Doc 08) treat `success` as mutation-only until the contract is unified | FR-SEC | P1 |
| TC-SEC-013 | Dead enum values never emitted (DCR-5) | — | Full workflow sweep; inspect all payloads + audit rows | `externalSyncStatus` ∈ {draft, pending_approval, synced, rejected} only (`'pending'` never emitted); audit `action` values limited to the live set of Doc 10 §5 (`SYNC_PUBLIC`/`CREATE`/`UPDATE`/`DELETE` only via manual append) | FR-AUDIT | P2 |

### 6.18 System-level — persistence & migration (L4)

| ID | Title | Pre | Steps | Expected | REQ | Pri |
|---|---|---|---|---|---|---|
| TC-SYS-001 | Compose stack boots healthy | ENV-PROD-MODE | `docker compose up -d --build`; wait healthchecks | Both containers healthy; schema auto-applied on empty volume | FR-SES | P0 |
| TC-SYS-002 | Data survives restart | stack, created content | `docker compose restart app` | Content persisted in PG | FR-SES | P0 |
| TC-SYS-003 | Schema.sql idempotent | PG | Run scripts/schema.sql twice | No errors (CREATE IF NOT EXISTS / DROP TRIGGER IF EXISTS) | FR-SES | P1 |
| TC-SYS-004 | Export → migrate round-trip | in-memory data | GET /api/system/export → `node scripts/migrate.js export.json` against fresh PG | Tables populated; counts match export | FR-SES | P1 |
| TC-SYS-005 | Readiness pulls pod when DB dies | stack | Stop postgres; GET /readyz | 503; recovers 200 on PG restart | FR-SES | P0 |
| TC-SYS-006 | Manifest validation | — | `docker compose config`; `kubectl kustomize k8s` | Both validate | FR-SES | P1 |

## 7. Entry & exit criteria per level

| Level | Entry criteria | Exit criteria (all must hold) |
|---|---|---|
| L0 Static | Source compiles conceptually; branch rebased on develop | `tsc --noEmit` exit 0 |
| L1 Build | L0 exit | `npm run build` exit 0; both artifacts present |
| L2 Smoke | L1 exit (suite spawns `dist/server.cjs`) | All checks PASS; exit 0; smoke-report.md written; zero FAIL lines |
| L3 E2E | L1 exit; fresh server on :3220 (suite self-bootstraps users) | 0 FAIL; FLAKY ≤ 2 with retry evidence; screenshots + e2e-results.json archived |
| L4 System | compose `.env` filled; L1 image build OK | All TC-SYS-* pass; stack torn down cleanly |
| L5 Security | L2/L4 exits | All P0 SEC/RBAC cases pass; dependency audit clean or exceptions accepted; findings register produced |
| L6 UAT | L4/L5 exits; demo data seeded; Thai UI verified | All 6 UAT scenarios accepted by role proxies; defects ≥S2 = 0 open |
| Release (Doc 17 gate) | All levels exited | Merge gates: tsc green, smoke green, build green, secrets clean; auth/security lanes have CTO (codex) PASS |

## 8. Defect severity & triage

| Severity | Definition | Examples | Response |
|---|---|---|---|
| S1 Critical | Security bypass, data loss, or total unavailability of a core flow; no workaround | RBAC 403 bypass; maker self-approval succeeding; session forgery; audit trail writable | Stop testing that lane; fix before any further gate; CTO informed |
| S2 Major | Core function fails or wrong result, workaround exists at best | Maker-checker wrong status transition; deactivation not revoking sessions; upload whitelist miss on a common type | Fix before UAT sign-off; blocks Doc 17 |
| S3 Minor | Non-core function degraded, clear workaround | Filter misspelling; pagination absent (Doc 10 §6); minor Thai UI defect | Scheduled; may ship with entry in known-issues |
| S4 Cosmetic | UI polish, wording, log noise | Toast wording, badge color | Backlog |

Triage: any tester → findings register (id, TC id, severity, evidence,
environment) → Lead triages daily during test waves → S1/S2 assigned
immediately; DCR process (PROJECT-STATE §7) for doc-impacting findings.
Re-test closes a defect only with re-run evidence (exit code + report), never
by assertion.

## 9. Evidence capture rules (no fake completion)

1. **Exit codes are the gate.** `npm run lint` / `npm run build` /
   `node scripts/smoke-test.mjs` must exit 0 (smoke: 1 = FAIL, 2 = boot
   failure). CI or a recorded shell transcript, not screenshots of editors.
2. **Counts recorded**: smoke prints per-section PASS/FAIL and writes
   `.omc/reports/smoke-report.md`; E2E writes `.omc/reports/e2e-results.json`
   with `{results[], counts}` — report the counts verbatim in Doc 17 (e.g.
   "62/62 PASS", "64 steps: X PASS / Y FLAKY / Z FAIL / W SKIP").
3. **SKIPPED is not PASSED.** E2E `needs:`-cascaded SKIPs must be resolved or
   the dependent area marked NOT TESTED in the result doc.
4. **FLAKY ≠ PASS**: a FLAKY verdict passes the gate only with its retry
   evidence attached; two FLAKY on the same step = FAIL.
5. Screenshots (`.omc/reports/screenshots/*.png`) are the UAT/E2E visual
   record; keep them per run-id.
6. Environment provenance: every result doc records git sha, image tag,
   env matrix row (§3), and run timestamp.
7. No placeholder/TODO/stub cases: a TC with no executable path stays
   `NOT AUTOMATED` in Doc 17 — never marked pass by hand for P0/P1.

## 10. Deliverable mapping

| Run | Produces |
|---|---|
| L0–L4 executed on ENV-DEV + ENV-PROD-MODE with archived reports | **Doc 17 — System Test Result** (per-TC verdicts, defect list) |
| L6 role scenarios UAT-1..6 | **Doc 18 — UAT Result** (scenario sign-offs, Thai-UI evidence) |
| L5 SEC/RBAC/UPL/audit-negatives + dependency & secrets scans | **Doc 19 — VA/Pentest Report** |
| Remediation re-runs of Doc 19 findings | **Doc 20 — Security Remediation Report** |
| Doc 21 (User Manual) screenshots reuse L3/L6 capture sets | supporting |

## 11. Responsibilities & schedule (Wave 3 outlook)

| Activity | Owner |
|---|---|
| Maintain/extend smoke + E2E suites per this catalog | Workers (QA lane) |
| Execute L0–L4, archive evidence | Workers |
| L5 security lane execution + findings register | Worker (security) + Lead review |
| UAT scenario proxies (staff/maker/checker/admin) | Business-side nominees arranged by Lead |
| Triage + gate verdicts | Lead; CTO (codex) for auth/security lanes |

Sequencing: Wave 2 implementation merges only under §7 release gates; Wave 3
runs L4→L5→L6 in that order, closing defects per §8 until exit criteria hold,
then Docs 17–20 are assembled from the archived evidence per §9–§10.
