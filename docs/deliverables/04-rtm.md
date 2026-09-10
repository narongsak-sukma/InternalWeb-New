# 04 — Requirements Traceability Matrix (RTM)

**KB J Capital Co., Ltd. — Corporate Intranet & Public-Sync Portal (KB J Capital Intranet Portal 2.0)**

**Version:** 1.1.0 · **Status:** Draft · **Date:** 2026-09-10 · **Author:** worker-2 → Lead review → CTO approval

> **Change log:** v1.1.0 (2026-09-10) — CTO gate REVISE applied: FR-NEWS-009 row updated to strict dual-control semantics (no role, admin included, may reach `'synced'` outside the checker approve endpoint; state + submitter≠approver guards; server-controlled workflow fields); NFR-COMP-001 row aligned; DCR-3 strict ruling recorded in §3.2/§3.3. v1.0.0 — initial draft.

Traces every requirement in `03-srs.md` to its design reference, implementation
status, test case and UAT item. 94 requirements total (63 FR + 31 NFR; one FR is `[PLANNED]`).

**Column legend**

- **SRS** — section in `docs/deliverables/03-srs.md`.
- **Design reference** — concrete as-built artifact: `server.ts` route/middleware, `src/` component, `scripts/schema.sql` table, manifest or script. Cross-doc references to `05-sds.md` are given as `05-sds (pending)` until worker-3's SDS lands; the concrete code anchors below are authoritative today.
- **Status** — `AS-BUILT` (present and verifiable in the current tree) · `[PLANNED]` (future work) · `PROPOSED` (target pending measurement at doc 17).
- **Test ref** — `TC-<DOMAIN>-<nnn>`, the scheme reused by `12-test-plan.md` (worker-5). Existing automation that already exercises a row is called out in the *Automated evidence* note per domain; TC IDs denote the planned/canonical test case.
- **UAT ref** — `UAT-<nnn>` (sequential for user-observable requirements); `— (TC-only)` where the requirement is not user-observable and is covered by system test or ops review instead.

---

## 1. Functional requirements matrix

### 1.1 Authentication (AUTH)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| FR-AUTH-001 | §3.1.1 | `server.ts` `POST /api/auth/login` handler (bcrypt compare, cookie issue, `LOGIN` audit); `src/components/LoginPage.tsx`; `src/auth/AuthContext.tsx` | AS-BUILT | TC-AUTH-001 | UAT-001 |
| FR-AUTH-002 | §3.1.1 | `server.ts` `loginLimiter` (express-rate-limit, 5/min/IP, `skipSuccessfulRequests`, draft-7 headers, 429 handler) | AS-BUILT | TC-AUTH-002 | UAT-002 |
| FR-AUTH-003 | §3.1.1 | `server.ts` `POST /api/auth/logout` handler (`destroySession`, cookie clear, `LOGOUT` audit) | AS-BUILT | TC-AUTH-003 | UAT-003 |
| FR-AUTH-004 | §3.1.1 | `server.ts` `GET /api/auth/me` + `requireAuth`; `AuthContext` session restore | AS-BUILT | TC-AUTH-004 | UAT-004 |
| FR-AUTH-005 | §3.1.1 | `server.ts` `DUMMY_PASSWORD_HASH` (precomputed bcrypt) + uniform 401 body | AS-BUILT | TC-AUTH-005 | UAT-005 |
| FR-AUTH-006 | §3.1.1 | `server.ts` login failure branch → `recordAudit( LOGIN_FAILED / WARNING )` | AS-BUILT | TC-AUTH-006 | UAT-006 |

*Automated evidence:* `scripts/smoke-test.mjs` (auth lifecycle; rate limit run last) and `tests/e2e-walkthrough.mjs` cover the login/logout/me and 429 paths.

### 1.2 Session management (SES)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| FR-SES-001 | §3.1.2 | `server.ts` `createSession` / `signValue` / `createSessionToken` / `verifySessionToken` (HMAC-SHA256, `timingSafeEqual`) | AS-BUILT | TC-SES-001 | UAT-007 |
| FR-SES-002 | §3.1.2 | `sessions` table (`scripts/schema.sql` §2; `PG_DDL`) + `PostgresRepository.insertSession/findSession`; in-memory map fallback | AS-BUILT | TC-SES-002 | UAT-008 |
| FR-SES-003 | §3.1.2 | `server.ts` `res.cookie(SESSION_COOKIE, …)` flags (`httpOnly`, `SameSite=Lax`, `Secure` in prod, 7 d, `path=/`) | AS-BUILT | TC-SES-003 | UAT-009 |
| FR-SES-004 | §3.1.2 | `server.ts` `resolveSession` (expiry purge, user lookup, `isActive` gate) behind `requireAuth` | AS-BUILT | TC-SES-004 | UAT-010 |
| FR-SES-005 | §3.1.2 | `server.ts` hourly `sessionSweeper` → `deleteExpiredSessions` (unref'd; cleared on shutdown) | AS-BUILT | TC-SES-005 | — (TC-only) |
| FR-SES-006 | §3.1.2 | `server.ts` SESSION_SECRET production guard (`process.exit(1)`), dev ephemeral secret + warning | AS-BUILT | TC-SES-006 | UAT-012 |

*Automated evidence:* smoke-test spawns the production server with/without `SESSION_SECRET` and asserts the env contract.

### 1.3 User management (USER)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| FR-USER-001 | §3.1.3 | `server.ts` `GET /api/users` (admin, `toSafeUser` projection); `src/components/AdminCMS.tsx` User Management tab | AS-BUILT | TC-USER-001 | UAT-013 |
| FR-USER-002 | §3.1.3 | `server.ts` `POST /api/users` (field validation, 409 dup, `createUser` bcrypt-12, `USER_CREATE` audit); `users` table | AS-BUILT | TC-USER-002 | UAT-014 |
| FR-USER-003 | §3.1.3 | `server.ts` `PATCH /api/users/:id` (boolean `isActive`, self-deactivation block 400, `USER_ACTIVATE`/`USER_DEACTIVATE` audit); AdminCMS activate/deactivate dialog | AS-BUILT | TC-USER-003 | UAT-015 |
| FR-USER-004 | §3.1.3 | Absence of user-delete route (by design); `users.is_active` flag; AdminCMS "ไม่มีการลบข้อมูล / nothing is deleted" confirm | AS-BUILT | TC-USER-004 | UAT-016 |
| FR-USER-005 | §3.1.3 | `server.ts` `bootstrapUsers()` (env-driven admin, prod one-time password, dev demo maker/checker/staff); runs before `listen` | AS-BUILT | TC-USER-005 | UAT-017 |

*Automated evidence:* smoke-test exercises `GET/POST /api/users` and bootstrap admin env (`admin/TestAdmin@2026`).

### 1.4 News & announcements (NEWS)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| FR-NEWS-001 | §3.1.4 | `server.ts` `GET /api/news` (public; `category`/`search` filters); `news` table; `src/components/NewsSection.tsx` | AS-BUILT | TC-NEWS-001 | UAT-018 |
| FR-NEWS-002 | §3.1.4 | `server.ts` `POST /api/news` (maker/admin, defaults, `'draft'`/`'synced'` init, sync log on `syncToExternal`) — **as built: direct publish to `'synced'` without checker approval = DCR-3 (`server.ts:1306,1315`)** | AS-BUILT (DCR-3 bypass documented) | TC-NEWS-002 | UAT-019 |
| FR-NEWS-003 | §3.1.4 | `server.ts` `PUT /api/news/:id` (maker/admin, merge, id protection, 404, sync log) — **as built: update re-syncs to `'synced'` without checker approval = DCR-3 (`server.ts:1346`)** | AS-BUILT (DCR-3 bypass documented) | TC-NEWS-003 | UAT-020 |
| FR-NEWS-004 | §3.1.4 | `server.ts` `DELETE /api/news/:id` (admin-only, `DELETE` sync log) | AS-BUILT | TC-NEWS-004 | UAT-021 |
| FR-NEWS-005 | §3.1.4 | `server.ts` `POST /api/news/:id/submit-approval` (maker/admin → `pending_approval`, `SUBMIT_APPROVAL` audit) | AS-BUILT | TC-NEWS-005 | UAT-022 |
| FR-NEWS-006 | §3.1.4 | `server.ts` `POST /api/news/:id/approve` (checker/admin → `synced`, `approvedBy`/`approvedAt`, `APPROVE` audit, sync log) | AS-BUILT | TC-NEWS-006 | UAT-023 |
| FR-NEWS-007 | §3.1.4 | `server.ts` `POST /api/news/:id/reject` (checker/admin → `rejected`, reason persisted, `REJECT` audit `REJECTED`) | AS-BUILT | TC-NEWS-007 | UAT-024 |
| FR-NEWS-008 | §3.1.4 | `news.is_important_alert` column; `src/components/Header.tsx` unread-alert affordance → `ArticleDetailModal.tsx` | AS-BUILT | TC-NEWS-008 | UAT-025 |
| FR-NEWS-009 | §3.1.4 | No implementation yet — **CTO strict ruling on DCR-3**: post-fix NO role (admin included) reaches `'synced'` outside the checker approve endpoint; approve/reject require `'pending_approval'` (else 400) and submitter ≠ approver (else 403); submit-approval accepts `'draft'` only (else 400); workflow fields (`externalSyncStatus`/`approvedBy`/`approvedAt`/`syncToExternal`) server-controlled, stripped from create/update payloads; future admin override = separate break-glass requirement (out of scope) | **[PLANNED]** | TC-SEC-011 (post-fix, doc 12) | — (TC-only) |

*Automated evidence:* smoke-test and `tests/e2e-walkthrough.mjs` drive the full maker-checker flow.

### 1.5 Hero banners (BANNER)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| FR-BANNER-001 | §3.1.5 | `server.ts` `GET /api/banners` (public); `banners` table (`idx_banners_order`); `src/components/HeroCarousel.tsx` | AS-BUILT | TC-BANNER-001 | UAT-026 |
| FR-BANNER-002 | §3.1.5 | `server.ts` `POST /api/banners` (maker/admin, defaults) | AS-BUILT | TC-BANNER-002 | UAT-027 |
| FR-BANNER-003 | §3.1.5 | `server.ts` `PUT /api/banners/:id` (maker/admin, 404, id protection) | AS-BUILT | TC-BANNER-003 | UAT-028 |
| FR-BANNER-004 | §3.1.5 | `server.ts` `DELETE /api/banners/:id` (admin-only) | AS-BUILT | TC-BANNER-004 | UAT-029 |

### 1.6 Directory contacts (CONTACT)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| FR-CONTACT-001 | §3.1.6 | `server.ts` `GET /api/contacts` (auth; department/floor/search filters); `contacts` table; `src/components/DirectoryAndRooms.tsx` | AS-BUILT | TC-CONTACT-001 | UAT-030 |
| FR-CONTACT-002 | §3.1.6 | `server.ts` `POST /api/contacts` (maker/admin) | AS-BUILT | TC-CONTACT-002 | UAT-031 |
| FR-CONTACT-003 | §3.1.6 | `server.ts` `PUT /api/contacts/:id` (maker/admin, 404) | AS-BUILT | TC-CONTACT-003 | UAT-032 |
| FR-CONTACT-004 | §3.1.6 | `server.ts` `DELETE /api/contacts/:id` (admin-only) | AS-BUILT | TC-CONTACT-004 | UAT-033 |

### 1.7 Policy documents (DOC)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| FR-DOC-001 | §3.1.7 | `server.ts` `GET /api/documents` (auth; category filter); `documents` table; `src/components/GovernanceAndPolicies.tsx` | AS-BUILT | TC-DOC-001 | UAT-034 |
| FR-DOC-002 | §3.1.7 | `server.ts` `POST /api/documents` (maker/admin, defaults, `isNew` forced) | AS-BUILT | TC-DOC-002 | UAT-035 |
| FR-DOC-003 | §3.1.7 | `server.ts` `DELETE /api/documents/:id` (admin-only; no update endpoint by design) | AS-BUILT | TC-DOC-003 | UAT-036 |

### 1.8 Meeting rooms (ROOM)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| FR-ROOM-001 | §3.1.8 | `server.ts` `GET /api/rooms` (public, live status + `currentBooking`); `meeting_rooms` table (jsonb booking) | AS-BUILT | TC-ROOM-001 | UAT-037 |
| FR-ROOM-002 | §3.1.8 | `server.ts` `POST /api/rooms/:id/book` (auth; 404/400; booker from session) | AS-BUILT | TC-ROOM-002 | UAT-038 |
| FR-ROOM-003 | §3.1.8 | `server.ts` `POST /api/rooms/:id/release` (auth; clears booking) | AS-BUILT | TC-ROOM-003 | UAT-039 |

### 1.9 Portal & CMS experience (CMS)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| FR-CMS-001 | §3.1.9 | `src/App.tsx` `allowedViews`/`canShowView` state gate; `ViewMode` in `src/types.ts` | AS-BUILT | TC-CMS-001 | UAT-040 |
| FR-CMS-002 | §3.1.9 | `src/components/AdminCMS.tsx` (role-conditional approve/reject, deletes, "User Management" tab `admin`-only); server RBAC as authority | AS-BUILT | TC-CMS-002 | UAT-041 |
| FR-CMS-003 | §3.1.9 | `src/App.tsx` handlers (throw-on-failure contract) + AdminCMS inline error surfacing; toast system | AS-BUILT | TC-CMS-003 | UAT-042 |
| FR-CMS-004 | §3.1.9 | `src/api.ts` offline fallback + `subscribeOffline`; offline badge in `src/App.tsx` | AS-BUILT | TC-CMS-004 | UAT-043 |
| FR-CMS-005 | §3.1.9 | `src/auth/AuthContext.tsx` session restore; splash/login gate in `src/App.tsx` | AS-BUILT | TC-CMS-005 | UAT-044 |
| FR-CMS-006 | §3.1.9 | `server.ts` `GET /api/tools`; `src/components/HeroCarousel.tsx`, `QuickToolsBar.tsx`, `NewsSection.tsx`, `RegulatoryHub.tsx`, `DirectoryAndRooms.tsx`, `GovernanceAndPolicies.tsx` | AS-BUILT | TC-CMS-006 | UAT-045 |

*Automated evidence:* `tests/e2e-walkthrough.mjs` walks the portal/CMS views end to end.

### 1.10 Audit trail (AUDIT)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| FR-AUDIT-001 | §3.1.10 | `server.ts` `recordAudit()` (session-derived actor, `req.ip`, UTC stamp) | AS-BUILT | TC-AUDIT-001 | UAT-046 |
| FR-AUDIT-002 | §3.1.10 | `server.ts` `GET /api/audit-logs` (checker/admin); AdminCMS audit view | AS-BUILT | TC-AUDIT-002 | UAT-047 |
| FR-AUDIT-003 | §3.1.10 | audit call sites in login/logout/users/news-approval/upload handlers (10 action types) | AS-BUILT | TC-AUDIT-003 | UAT-048 |
| FR-AUDIT-004 | §3.1.10 | `server.ts` `POST /api/audit-logs` (admin, defaults, session-stamped actor) | AS-BUILT | TC-AUDIT-004 | UAT-049 |
| FR-AUDIT-005 | §3.1.10 | No update/delete audit routes; `audit_logs` append-only design (`schema.sql` §9, no update trigger); in-memory cap 5,000 | AS-BUILT | TC-AUDIT-005 | — (TC-only) |

*Automated evidence:* smoke-test "audit-actor integrity" section asserts client-supplied actors are ignored.

### 1.11 Public sync & data migration (SYNC)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| FR-SYNC-001 | §3.1.11 | `news.external_sync_status` + `approved_by`/`approved_at` columns (`schema.sql` §3); submit/approve/reject handlers; `ExternalSyncStatus` type — runtime values `draft`/`pending_approval`/`synced`/`rejected` only ('pending' = dead union member, no 'approved' — **DCR-5**); direct path per **DCR-3** | AS-BUILT (DCR-3/DCR-5 documented) | TC-SYNC-001 | UAT-051 |
| FR-SYNC-002 | §3.1.11 | Sync-log insertions in news create/update/delete/approve handlers; `sync_logs` table | AS-BUILT | TC-SYNC-002 | UAT-052 |
| FR-SYNC-003 | §3.1.11 | `server.ts` `GET /api/sync/logs` (admin); AdminCMS sync view | AS-BUILT | TC-SYNC-003 | UAT-053 |
| FR-SYNC-004 | §3.1.11 | `server.ts` `POST /api/sync/trigger` (admin, `FORCE_SYNC` log, count). **Outbound HTTP call: `[PLANNED]`** | AS-BUILT (outbound `[PLANNED]`) | TC-SYNC-004 | UAT-054 |
| FR-SYNC-005 | §3.1.11 | `src/components/ExternalPublicSyncView.tsx` (maker+ view) | AS-BUILT | TC-SYNC-005 | UAT-055 |
| FR-SYNC-006 | §3.1.11 | `server.ts` `GET /api/system/export` (admin, `tables` payload; top-level timestamp field **`exportTimestamp`, not `generatedAt` — DCR-1**); `scripts/migrate.js` consumer | AS-BUILT | TC-SYNC-006 | UAT-056 |

### 1.12 File upload (UPL)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| FR-UPL-001 | §3.1.12 | `server.ts` `POST /api/upload` (maker/checker/admin, multipart `file`, `FILE_UPLOAD` audit) | AS-BUILT | TC-UPL-001 | UAT-057 |
| FR-UPL-002 | §3.1.12 | `uploadHandler` multer config: 10 MB limit (413), `ALLOWED_UPLOAD_EXTENSIONS` whitelist, `EXPECTED_MIME_BY_EXTENSION` consistency, extension regex guard | AS-BUILT | TC-UPL-002 | UAT-058 |
| FR-UPL-003 | §3.1.12 | `multer.diskStorage` UUID filenames into `UPLOAD_DIR`; `app.use('/uploads', express.static(…))` (maxAge 1 d, no index/redirect) + global nosniff | AS-BUILT | TC-UPL-003 | UAT-059 |

*Automated evidence:* smoke-test asserts the upload whitelist and size-limit contract.

### 1.13 Search (SRCH)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| FR-SRCH-001 | §3.1.13 | `src/components/GlobalSearchModal.tsx` (⌘K handler in `src/App.tsx`; client-side filters over news/contacts/documents/rooms) | AS-BUILT | TC-SRCH-001 | UAT-060 |
| FR-SRCH-002 | §3.1.13 | `GET /api/news?search=` filter in `server.ts` | AS-BUILT | TC-SRCH-002 | UAT-061 |
| FR-SRCH-003 | §3.1.13 | `GET /api/contacts?search=&department=&floor=` filter in `server.ts` | AS-BUILT | TC-SRCH-003 | UAT-062 |

---

## 2. Non-functional requirements matrix

### 2.1 Security (SEC)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| NFR-SEC-001 | §3.2.1 | `server.ts` `BCRYPT_COST = 12`, `createUser`, `toSafeUser` | AS-BUILT | TC-SEC-001 | — (TC-only) |
| NFR-SEC-002 | §3.2.1 | Env-only config; `.dockerignore` env exclusions; `k8s/secret.example.yaml`; SESSION_SECRET guard | AS-BUILT | TC-SEC-002 | — (TC-only) |
| NFR-SEC-003 | §3.2.1 | `server.ts` security-headers middleware (5 headers, every response) | AS-BUILT | TC-SEC-003 | — (TC-only) |
| NFR-SEC-004 | §3.2.1 | `Dockerfile` (uid 10001, multi-stage, prod deps only); `k8s/deployment.yaml` securityContext (read-only rootfs, caps dropped) | AS-BUILT | TC-SEC-004 | — (TC-only) |
| NFR-SEC-005 | §3.2.1 | `k8s/networkpolicy.yaml` (default-deny; ingress controller + same-ns; egress DNS+5432) | AS-BUILT | TC-SEC-005 | — (TC-only) |
| NFR-SEC-006 | §3.2.1 | Cookie `Secure` in prod (`res.cookie`); `verifySessionToken` HMAC + `timingSafeEqual`; `k8s/ingress.yaml` TLS | AS-BUILT | TC-SEC-006 | — (TC-only) |
| NFR-SEC-007 | §3.2.1 | `/api` resource-id guard + `requireResourceId`; `express.json` 10 mb caps; final error handler (400/413/500 JSON); JSON `/api` 404 fallback | AS-BUILT | TC-SEC-007 | — (TC-only) |

### 2.2 Performance (PERF)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| NFR-PERF-001 | §3.2.2 | Repository layer + schema indexes (`idx_news_category`, `idx_contacts_*`, `idx_audit_*`, …); request-logger `durationMs` for measurement | PROPOSED (measure at doc 17) | TC-PERF-001 | — (TC-only) |
| NFR-PERF-002 | §3.2.2 | bcrypt cost-12 comparison is the dominant login cost; uniform failure timing (FR-AUTH-005) | PROPOSED (measure at doc 17) | TC-PERF-002 | — (TC-only) |
| NFR-PERF-003 | §3.2.2 | `express.static('/uploads', { maxAge: '1d' })` + immutable UUID names; Vite content-hashed assets from `dist/` | AS-BUILT | TC-PERF-003 | — (TC-only) |
| NFR-PERF-004 | §3.2.2 | `k8s/hpa.yaml` (2→10); `k8s/deployment.yaml` `maxUnavailable: 0`, anti-affinity; pg pool `max: 10`; RWO PVC note in `k8s/pvc.yaml` | AS-BUILT | TC-PERF-004 | — (TC-only) |

### 2.3 Availability (AVAIL)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| NFR-AVAIL-001 | §3.2.3 | `GET /healthz` handler (+aliases); `Dockerfile` `HEALTHCHECK` (30 s) | AS-BUILT | TC-AVAIL-001 | — (TC-only) |
| NFR-AVAIL-002 | §3.2.3 | `GET /readyz` handler (`repo.checkHealth()` → 503 when PG down) | AS-BUILT | TC-AVAIL-002 | — (TC-only) |
| NFR-AVAIL-003 | §3.2.3 | `shutdown()` SIGTERM/SIGINT sequence + 10 s force timeout; k8s `preStop` + 35 s grace | AS-BUILT | TC-AVAIL-003 | — (TC-only) |
| NFR-AVAIL-004 | §3.2.3 | `PostgresRepository.init()` fail-fast; production-no-DB warning; compose `pgdata` volume | AS-BUILT | TC-AVAIL-004 | — (TC-only) |
| NFR-AVAIL-005 | §3.2.3 | `GET /api/system/export` + `scripts/migrate.js`; compose `pg_isready` healthcheck; `k8s/pvc.yaml`; manual `psql -f schema.sql` upgrade path | AS-BUILT | TC-AVAIL-005 | — (TC-only) |
| NFR-AVAIL-006 | §3.2.3 | `process.on('unhandledRejection')` suppressor; final error handler; k8s startup probe | AS-BUILT | TC-AVAIL-006 | — (TC-only) |

### 2.4 Compliance BOT/PDPA (COMP)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| NFR-COMP-001 | §3.2.4 | `requireRole('checker','admin')` on approve/reject; maker 403; approval stamps. **Strict target (CTO ruling, FR-NEWS-009 `[PLANNED]`): no role — admin included — reaches `'synced'` outside checker approve; state + submitter≠approver guards server-enforced for ALL roles. As-built gap = DCR-3 direct-publish path** | AS-BUILT (strict remediation FR-NEWS-009 `[PLANNED]`, Wave 2) | TC-COMP-001 | UAT-023 (dual control) |
| NFR-COMP-002 | §3.2.4 | Append-only `audit_logs` + `recordAudit`; no-delete user lifecycle; JSON request logs with IP | AS-BUILT | TC-COMP-002 | UAT-047 |
| NFR-COMP-003 | §3.2.4 | `toSafeUser` everywhere; cookie = signed sid only; UUID upload filenames | AS-BUILT | TC-COMP-003 | — (TC-only) |
| NFR-COMP-004 | §3.2.4 | `resolveSession` isActive gate; login isActive rejection; session sweeper | AS-BUILT | TC-COMP-004 | UAT-015 |

### 2.5 Internationalization (I18N)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| NFR-I18N-001 | §3.2.5 | Thai-first bilingual strings across `LoginPage.tsx`, `App.tsx`, `AdminCMS.tsx` (e.g. "เข้าสู่ระบบ / Sign in") | AS-BUILT | TC-I18N-001 | UAT-063 |
| NFR-I18N-002 | §3.2.5 | `news.title_en`, `contacts.name_en`, `documents.title_en` columns; bilingual search paths | AS-BUILT | TC-I18N-002 | UAT-064 |
| NFR-I18N-003 | §3.2.5 | `toLocaleDateString('th-TH')` defaults, Thai read-time ("3 นาที"), `published_at` label semantics (`schema.sql` header note) | AS-BUILT | TC-I18N-003 | UAT-065 |

### 2.6 Maintainability (MAINT)

| REQ ID | SRS | Design reference | Status | Test ref | UAT ref |
|---|---|---|---|---|---|
| NFR-MAINT-001 | §3.2.6 | TypeScript ~5.8 end-to-end; `npm run lint` (`tsc --noEmit`); esbuild `dist/server.cjs`. **DCR-6: `strict` not enabled in `tsconfig.json`** | AS-BUILT (DCR-6 pending) | TC-MAINT-001 | — (TC-only) || NFR-MAINT-002 | §3.2.6 | `GET /api/openapi.json` handler (OpenAPI 3.0.3, cookieAuth scheme, full path list) | AS-BUILT | TC-MAINT-002 | — (TC-only) |
| NFR-MAINT-003 | §3.2.6 | JSON request-logger middleware (time/method/path/status/durationMs/ip) | AS-BUILT | TC-MAINT-003 | — (TC-only) |
| NFR-MAINT-004 | §3.2.6 | `PG_DDL` ≡ `scripts/schema.sql` (lockstep DDL, `IF NOT EXISTS` idempotency); `seedIfEmpty()` | AS-BUILT | TC-MAINT-004 | — (TC-only) |
| NFR-MAINT-005 | §3.2.6 | Single multi-stage image for compose + k8s; all knobs env-driven (`README.md` §4) | AS-BUILT | TC-MAINT-005 | — (TC-only) |
| NFR-MAINT-006 | §3.2.6 | As-built **mixed envelope (DCR-4)**: reads bare `{data[,total]}` (no `success`), mutations `{success:true,…}`, auth/validation errors `{success:false,error}`, per-resource 404s/room errors bare `{error}`; JSON `/api` 404; consistent status taxonomy | AS-BUILT | TC-MAINT-006 | — (TC-only) |
| NFR-MAINT-007 | §3.2.6 | `scripts/migrate.js`, `scripts/seed-users.js`, `scripts/smoke-test.mjs`, `tests/e2e-walkthrough.mjs` | AS-BUILT | TC-MAINT-007 | — (TC-only) |

---

## 3. Coverage summary

### 3.1 Counts per domain

| Domain | Kind | REQs | AS-BUILT | `[PLANNED]` / PROPOSED / open | UAT items |
|---|---|---|---|---|---|
| AUTH | FR | 6 | 6 | 0 | 6 |
| SES | FR | 6 | 6 | 0 | 5 |
| USER | FR | 5 | 5 | 0 | 5 |
| NEWS | FR | 9 | 8 | 1 `[PLANNED]` (FR-NEWS-009, DCR-3 remediation) | 8 |
| BANNER | FR | 4 | 4 | 0 | 4 |
| CONTACT | FR | 4 | 4 | 0 | 4 |
| DOC | FR | 3 | 3 | 0 | 3 |
| ROOM | FR | 3 | 3 | 0 | 3 |
| CMS | FR | 6 | 6 | 0 | 6 |
| AUDIT | FR | 5 | 5 | 0 | 4 |
| SYNC | FR | 6 | 5 + 1 partial | FR-SYNC-004 outbound call `[PLANNED]` | 6 |
| UPL | FR | 3 | 3 | 0 | 3 |
| SRCH | FR | 3 | 3 | 0 | 3 |
| SEC | NFR | 7 | 7 | 0 | 0 (TC-only) |
| PERF | NFR | 4 | 2 | 2 PROPOSED (targets pending doc 17) | 0 |
| AVAIL | NFR | 6 | 6 | 0 | 0 |
| COMP | NFR | 4 | 4 | DCR-3 ruled strict (CTO); remediation FR-NEWS-009 `[PLANNED]` Wave 2 | 2 (shared) |
| I18N | NFR | 3 | 3 | 0 | 3 |
| MAINT | NFR | 7 | 7 | DCR-6 decision pending | 0 |
| **Total** | | **94** | **90 full + 1 partial (FR-SYNC-004)** | 2 `[PLANNED]` items (FR-NEWS-009; FR-SYNC-004 outbound call), 2 proposed targets, 5 DCRs | **63** |

### 3.2 Requirements with no as-built implementation

1. **FR-NEWS-009 `[PLANNED]`:** strict dual-control enforcement per the CTO
   ruling on DCR-3 — post-fix **no role, admin included**, may reach
   `'synced'` outside the checker approve endpoint; approve/reject require
   `'pending_approval'` (400) and submitter ≠ approver (403); submit-approval
   accepts `'draft'` only (400); workflow fields
   (`externalSyncStatus`/`approvedBy`/`approvedAt`/`syncToExternal`) are
   server-controlled and stripped from create/update payloads. Not implemented
   as built — the direct-publish bypass exists today (DCR-3,
   `server.ts:1306,1315,1346`) and is documented as-built in FR-NEWS-002/003;
   implementation lands in Wave 2.
2. **FR-SYNC-004 (partial):** the outbound HTTP call/webhook to the public
   website is **`[PLANNED]`** — `/api/sync/trigger` currently drives the state
   machine and logging only (matches `README.md` §8 and `HANDOVER.md` §10
   "modelled, not wired"). Integration requires the real webhook endpoint and
   an additional egress NetworkPolicy rule.
3. **NFR-PERF-001 / NFR-PERF-002 (PROPOSED):** latency targets are defined in
   this SRS but not yet measured; verification is deferred to system testing
   (`17-system-test-result.md`).

Everything else in the matrix is implemented in the current tree
(`server.ts`, `src/`, `scripts/schema.sql`, `Dockerfile`, `k8s/`).

### 3.3 Open items blocking full traceability sign-off

- **DCR-1** (export field name): `GET /api/system/export` returns
  `exportTimestamp`, not `generatedAt`. Documented as built in FR-SYNC-006
  (this matrix already uses `exportTimestamp`); any other doc using
  `generatedAt` is corrected against it. CTO ratifies at the gate.
- **DCR-6** (tsconfig strict): `tsconfig.json` lacks `"strict": true` while
  conventions claim "TypeScript strict" — affects NFR-MAINT-001 and the SRS
  §2.5 constraint list. Needs CTO decision (enable strict in Wave 2 or amend
  the constraint).
- **DCR-3** (maker-checker bypass): `POST/PUT /api/news` with
  `syncToExternal:true` reaches `'synced'` without checker approval
  (`server.ts:1306,1315,1346`) — affects FR-NEWS-002/003, FR-SYNC-001,
  NFR-COMP-001; remediation requirement FR-NEWS-009 `[PLANNED]` recorded in
  this matrix. **Ruled by the CTO at the Wave-1 gate: strict dual control**
  (no role exemption; state + identity guards; server-controlled workflow
  fields — see FR-NEWS-009). Wave 2 implements; any future admin override
  requires a separate, explicitly risk-accepted break-glass requirement.
- **DCR-4** (mixed envelope): reads return bare `{data[,total]}` and some
  404s/booking errors bare `{error}` — no `success` field. Documented as
  built in NFR-MAINT-006 (SRS §3.2.6); docs claiming a uniform
  `{success:…}` envelope are corrected against it. CTO ratifies at the gate.
- **DCR-5** (state model): runtime `externalSyncStatus` values are
  `draft`/`pending_approval`/`synced`/`rejected` only; the TS union member
  `'pending'` (`src/types.ts:28`) is dead and no `'approved'` status exists.
  Documented as built in FR-SYNC-001. CTO ratifies at the gate.
- **05-sds (pending):** worker-3's SDS should add §-level design references
  to this matrix; today the concrete code anchors above serve as the design
  references.
