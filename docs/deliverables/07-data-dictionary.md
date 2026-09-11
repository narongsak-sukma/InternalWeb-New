# 07 — Data Dictionary

**Version:** 1.4.0 · **Status:** Approved (Wave-2 revision) · **Date:** 2026-09-11 · **Author:** worker-4 → Lead review → CTO approval (W2-1 truth pass: worker-4; W2-FIX-1 ripple pass: worker-5; W2-FIX-3 ripple pass: worker-2)

AS-BUILT reference for every data structure the KB J Capital Intranet & CMS Portal persists. Compiled directly from `scripts/schema.sql` (canonical PostgreSQL DDL), the `PG_DDL` constant and repository implementations in `server.ts`, the shared types in `src/types.ts`, and the tooling in `scripts/migrate.js` / `scripts/seed-users.js`. Compliance context: Bank of Thailand (BOT) financial-institution governance and Thailand PDPA B.E. 2562.

---

## 1. Scope

Three storage tiers exist; this document covers all of them:

| Tier | Where | Used when | Authority |
|---|---|---|---|
| **PostgreSQL 16** (canonical) | Tables in §5, applied from `PG_DDL` at server boot or `scripts/schema.sql` manually | `DATABASE_URL` is set | `scripts/schema.sql` ≡ `PG_DDL` in `server.ts` (kept in lockstep by convention) |
| **In-memory stores** (dev) | Arrays/Maps inside `InMemoryRepository` (`server.ts`) | No `DATABASE_URL` (dev/demo; warns in production) | Same TS shapes from `src/types.ts` |
| **Upload volume** | `UPLOAD_DIR` (default `./uploads`, `/app/uploads` in containers) | Always (file bytes are never stored in the DB) | §7 |

A fourth, non-persisted source of data — the code constants (`INITIAL_TOOLS`, seed content in `src/data/initialData.ts`) — is documented in §8 because the API serves it as if it were data.

---

## 2. Conventions used in this document

- **Column names are canonical snake_case** in PostgreSQL; each maps 1:1 to a camelCase TypeScript field via one mapper function per entity in `server.ts` (`newsFromRow`, `bannerFromRow`, `contactFromRow`, `roomFromRow`, `documentFromRow`, `syncLogFromRow`, `auditLogFromRow`, `userFromRow`).
- **Nullable** = whether the column accepts SQL `NULL`.
- **PII (PDPA)** legend:
  - **PDPA-Y** — personal data of an identifiable natural person (name, username, e-mail, phone, IP address, workplace location, photo). Requires PDPA lawful-basis handling and retention control.
  - **Credential** — not personal data per se, but a secret that must never be exposed (password hash, session id).
  - **—** — no personal data.
- All timestamps stored as `timestamptz` are true DB timestamps. Columns typed `text` that hold dates are **display labels produced by the UI** (Thai-locale date strings) and are stored verbatim — see the per-table notes.

---

## 3. Enumerations

### 3.1 Database-level enum (the only one)

`user_role_enum` — the single PostgreSQL `ENUM` type. All other "enum-like" columns are plain `text` validated only at the application layer (see §3.2).

| Value | Meaning | UI label (`ROLE_LABELS`, server.ts) |
|---|---|---|
| `admin` | System administrator | `Administrator` |
| `checker` | Compliance approver (dual-control) | `Checker (Compliance / VP)` |
| `maker` | Content author | `Maker (Author)` |
| `staff` | Read-only employee | `Staff (Read-only)` |

Role hierarchy: `admin` > `checker` > `maker` > `staff`.

### 3.2 Application-level enumerations (text columns)

Enforced by TypeScript types in `src/types.ts` (and by request defaults/validation in `server.ts`). PostgreSQL accepts any text in these columns.

| Field (table.column) | Values | Notes |
|---|---|---|
| `users.is_active` | `true` / `false` | Deactivated accounts are never deleted; login and session resolution reject them. |
| `news.category` | `kbj-news`, `ncb-news`, `bot-news`, `regulation`, `hr-announcement`, `all-about-money`, `lifestyle` | `NewsCategory` (types.ts). GET /api/news filters on exact match; `all` = no filter. |
| `news.badge_color` | `red`, `orange`, `blue`, `emerald`, `amber` | Default on create: `orange`. |
| `news.external_sync_status` | `draft`, `pending_approval`, `rejected`, `synced`, `pending` *(dead)* | `NewsItem['externalSyncStatus']` (`src/types.ts:28`). **Server-controlled (W2-1, FR-NEWS-009):** stripped from create/update request bodies at the validation layer; every create enters as `draft`. Strict machine: create → `draft`, submit → `pending_approval`, approve → `synced`, reject → `rejected`; editing a non-draft item force-resets it to `draft` (stamps cleared); withdraw (W2-FIX-1, `2c97cc3`): `synced → draft` **state-only** — content preserved byte-for-byte, stamps cleared, no checker (DCR-9; `POST /api/news/:id/withdraw`). *`pending` is the only dead member — declared in the union but **no code path ever assigns it** (DCR-5 in §12; DCR-3 resolved — §12). The union contains no `approved` member at all.* |
| `news.external_category` | `press-release`, `csr`, `product-notice`, `compliance`, `money-tips`, `lifestyle` | Default on create: `press-release`. |
| `meeting_rooms.status` | `available`, `in-use`, `maintenance` | Set to `in-use` by POST /api/rooms/:id/book, back to `available` by /release; `maintenance` only via direct DB edit. |
| `documents.category` | `policy`, `work-rules`, `form`, `handbook`, `governance` | Default on create: `form`. |
| `documents.is_new` | `true` / `false` | Forced `true` on create; UI ages it out. |
| `banners.is_active` | `true` / `false` | Default `true`. |
| `sync_logs.action` | `CREATE`, `UPDATE`, `DELETE`, `FORCE_SYNC` | `SyncLog['action']`. |
| `sync_logs.status` | `SUCCESS`, `PENDING`, `FAILED` | As built every runtime write uses `SUCCESS`; `PENDING`/`FAILED` appear only in seed data. |
| `audit_logs.action` | `UPDATE`, `SUBMIT_APPROVAL`, `APPROVE`, `REJECT`, `LOGIN`, `LOGIN_FAILED`, `LOGOUT`, `USER_CREATE`, `USER_ACTIVATE`, `USER_DEACTIVATE`, `FILE_UPLOAD`, `SYNC_TRIGGER`, `SYSTEM_EXPORT`, `ACCESS_DENIED` | 14 values, `AuditLog['action']` (`src/types.ts:119`) — **exactly the live writer set** since the W2-3 prune (`4650335` removed the dead `CREATE`/`DELETE`/`SYNC_PUBLIC`, whose only writer — the manual `POST /api/audit-logs` — had been removed by DCR-8 at `f6fa52d`; `SYNC_TRIGGER`/`SYSTEM_EXPORT`/`ACCESS_DENIED` were added). All 14 are runtime-written server-side; there is no manual append path. W2-FIX-1 (`2c97cc3`) call-site shapes reuse existing members: the state-only withdrawal writes `UPDATE` with `prior_status='synced'` in `details`; a denied decision on a legacy no-submitter pending row writes `ACCESS_DENIED` (handler-level, no state change). Pre-prune databases may still hold legacy rows carrying the removed values (free-text column — treat as historical, Doc 10 §9.2). |
| `audit_logs.status` | `SUCCESS`, `REJECTED`, `WARNING` | `WARNING` = failed login; `REJECTED` = checker rejection; `SUCCESS` = everything else. |

There is **no dedicated `system_tools` table** — see §8.

---

## 4. Schema overview

Nine tables. `seq bigserial UNIQUE` columns exist purely for stable ordering (they mirror the in-memory array ordering: news/documents/sync_logs/audit_logs newest-first; banners/contacts/rooms insertion order) and are never exposed through the API.

```
users ──< sessions            (ON DELETE CASCADE)
news / banners / contacts / meeting_rooms / documents / sync_logs / audit_logs   (independent)
```

Append-only by design: `sync_logs`, `audit_logs` (BOT/PDPA immutability — no UPDATE path, no `updated_at` trigger).

---

## 5. Table reference

### 5.1 `users` — authentication & RBAC accounts

Mapped to `User` (types.ts). No row is ever deleted (audit-trail integrity); deactivation is the lifecycle end-state.

| Column | Type | Nullable | Default | Constraints | Description | PII (PDPA) |
|---|---|---|---|---|---|---|
| `id` | text | NO | — | **PK** | UUID v4 (`crypto.randomUUID()`), generated server-side on create. | Pseudonymous link |
| `username` | text | NO | — | **UNIQUE** (lookup case-insensitive: `LOWER(username)`) | Login identifier. Validated `^[a-zA-Z0-9._-]{3,32}$` at creation. | **PDPA-Y** |
| `password_hash` | text | NO | — | — | bcrypt hash, **cost 12**. Never returned by the API (`SafeUser` strips it). | **Credential** |
| `display_name` | text | NO | — | — | Human-friendly name shown in UI and used as default news author / room booker. | **PDPA-Y** |
| `email` | text | NO | — | — | Work e-mail. Validated `^[^@\s]+@[^@\s]+\.[^@\s]+$` at creation. | **PDPA-Y** |
| `role` | user_role_enum | NO | — | enum (§3.1) | RBAC role. | — |
| `is_active` | boolean | NO | `true` | — | `false` blocks login **and** invalidates existing sessions at next request. | — |
| `created_at` | timestamptz | NO | `now()` | — | Account creation (ISO instant; mapper converts to ISO string). | Metadata |
| `updated_at` | timestamptz | NO | `now()` | trigger `update_users_modtime` | Row last-modified. | Metadata |

Bootstrap: when the table is empty the server auto-creates an admin from `ADMIN_USERNAME`/`ADMIN_PASSWORD` (dev default password `ChangeMe@KBJ2026!`; production generates and prints a one-time random password). In non-production it also creates demo accounts `maker` / `checker` / `staff`.

### 5.2 `sessions` — server-side session store

Mapped to `SessionRecord` (server.ts). Cookie carries `<sid>.<HMAC-SHA256(sid)>`; this table is the only place that authorizes a sid.

| Column | Type | Nullable | Default | Constraints | Description | PII (PDPA) |
|---|---|---|---|---|---|---|
| `sid` | text | NO | — | **PK** | 32 random bytes, base64url. Secret — forging the cookie signature is required to use one. | **Credential** |
| `user_id` | text | NO | — | **FK → users(id) ON DELETE CASCADE** | Owning account. | Pseudonymous link |
| `created_at` | timestamptz | NO | `now()` | — | Login time. | Metadata |
| `expires_at` | timestamptz | NO | — | — | `created_at + 7 days` (`SESSION_TTL_MS`). Expired rows purged hourly. | Metadata |

### 5.3 `news` — corporate news & regulatory announcements

Mapped to `NewsItem`. The richest table; drives the intranet feed and the maker-checker public-sync workflow.

| Column | Type | Nullable | Default | Constraints | Description | PII (PDPA) |
|---|---|---|---|---|---|---|
| `seq` | bigserial | NO | auto | UNIQUE (implicit index) | Ordering only; newest-first via `ORDER BY seq DESC`. | — |
| `id` | text | NO | — | **PK** | Client-supplied or `news-<epoch-ms>`. | — |
| `title` | text | NO | — | — | Thai headline. Create-default `ประกาศใหม่`. | May name individuals |
| `title_en` | text | YES | — | — | English headline. | May name individuals |
| `summary` | text | NO | — | — | Feed excerpt. | — |
| `content` | text | NO | — | — | Full body (markdown-ish). | — |
| `category` | text | NO | — | enum-by-app (§3.2) | Feed category key. Create-default `kbj-news`. | — |
| `category_label` | text | NO | — | — | Display label. Create-default `News`. | — |
| `badge` | text | YES | — | — | Corner badge. Create-default `News`. | — |
| `badge_color` | text | YES | — | — | Badge color. Create-default `orange`. | — |
| `image_url` | text | YES | — | — | Hero image (Unsplash default on create). | — |
| `published_at` | text | NO | — | — | **Display label** (Thai-locale date string produced by the UI), stored verbatim. | — |
| `published_at_ts` | timestamptz | YES | — | — | Real timestamp reserved for future sorting/migration; **never written by any current code path**. | — |
| `read_time` | text | YES | — | — | Reading-time label. Create-default `3 นาที`. | — |
| `author` | text | NO | — | — | Author display name; defaults to the creating user's `displayName`. | **PDPA-Y** |
| `department` | text | NO | — | — | Owning department. Create-default `Corporate Communications`. | — |
| `is_important_alert` | boolean | NO | `false` | — | High-visibility flag. | — |
| `views` | integer | NO | `0` | — | View counter (client-updated via PUT). | — |
| `sync_to_external` | boolean | NO | `false` | — | "Live on public website" flag. **Server-controlled (W2-1):** stripped from create/update bodies — `false` at create, forced `false` on any draft reset, `true` only via the checker approve endpoint. | — |
| `external_sync_status` | text | YES | — | enum-by-app (§3.2) | Maker-checker state machine value. **Server-controlled (W2-1):** stripped from create/update bodies; create always `draft`; transitions only via submit-approval/approve/reject/withdraw (W2-FIX-1: withdraw = the state-only `synced→draft` endpoint `POST /api/news/:id/withdraw`). | — |
| `external_category` | text | YES | — | enum-by-app (§3.2) | Public-site category. Create-default `press-release`. | — |
| `attachment_url` | text | YES | — | — | Uploaded attachment path (`/uploads/<uuid>.<ext>`). | — |
| `attachment_name` | text | YES | — | — | Original attachment filename. | Potentially **PDPA-Y** (filenames can contain names) |
| `approved_by` | text | YES | — | — | Approving checker's username (set only by the approve endpoint). **Overloaded by reject**: set to `Rejected by <username>: <reason>`. | **PDPA-Y** |
| `approved_at` | text | YES | — | — | Approval instant as `YYYY-MM-DD HH:MM:SS` display label. Cleared by the edit-forced draft reset. | Metadata |
| `submitted_by` | text | YES | — | — | **W2-1 (FR-NEWS-009).** User id of the maker/admin who submitted the item for approval; the self-approval guard compares it against the acting checker's id (submitter can never approve or reject their own item — admin included). **W2-FIX-1:** a `pending_approval` row with no `submitted_by` (pre-migration legacy shape) cannot be decided — approve/reject → 409 with an `ACCESS_DENIED` audit row. Cleared by the edit-forced draft reset and the state-only withdrawal. | Pseudonymous link |
| `submitted_at` | text | YES | — | — | **W2-1 (FR-NEWS-009).** Submission instant as `YYYY-MM-DD HH:MM:SS` display label; cleared together with `submitted_by` on draft reset and the state-only withdrawal. | Metadata |
| `created_at` | timestamptz | NO | `now()` | — | Row creation. | Metadata |
| `updated_at` | timestamptz | NO | `now()` | trigger `update_news_modtime` | Row last-modified. | Metadata |

### 5.4 `banners` — hero-carousel slides

Mapped to `BannerSlide`. Ordered by `sort_order` (API field `order`).

| Column | Type | Nullable | Default | Constraints | Description | PII (PDPA) |
|---|---|---|---|---|---|---|
| `seq` | bigserial | NO | auto | UNIQUE | Insertion ordering (`ORDER BY seq ASC`). | — |
| `id` | text | NO | — | **PK** | Client-supplied or `banner-<epoch-ms>`. | — |
| `title` | text | NO | — | — | Slide headline. | — |
| `subtitle` | text | NO | — | — | Slide sub-headline. | — |
| `badge` | text | NO | — | — | Corner badge. Create-default `Kashjoy Highlight`. | — |
| `image_url` | text | NO | — | — | Background image URL. | — |
| `action_url` | text | NO | — | — | CTA link. Create-default `#`. | — |
| `action_text` | text | NO | — | — | CTA label. Create-default `อ่านรายละเอียด`. | — |
| `sort_order` | integer | NO | `0` | — | Display order (API `order`); create-default = current count + 1. | — |
| `is_active` | boolean | NO | `true` | — | Whether the slide is shown. | — |
| `created_at` / `updated_at` | timestamptz | NO | `now()` | trigger `update_banners_modtime` | Row timestamps. | Metadata |

### 5.5 `contacts` — internal phone directory (PDPA-critical table)

Mapped to `DirectoryContact`. Entirely composed of employee work-contact personal data.

| Column | Type | Nullable | Default | Constraints | Description | PII (PDPA) |
|---|---|---|---|---|---|---|
| `seq` | bigserial | NO | auto | UNIQUE | Insertion ordering (`ORDER BY seq ASC`). | — |
| `id` | text | NO | — | **PK** | Client-supplied or `contact-<epoch-ms>`. | — |
| `name` | text | NO | — | — | Full name (Thai). | **PDPA-Y** |
| `name_en` | text | NO | — | — | Full name (English). | **PDPA-Y** |
| `position` | text | NO | — | — | Job title. | **PDPA-Y** |
| `department` | text | NO | — | — | Department (filterable). | **PDPA-Y** |
| `extension` | text | NO | — | — | Internal extension number (filter/searchable). | **PDPA-Y** |
| `direct_phone` | text | YES | — | — | Direct dial number. | **PDPA-Y** |
| `email` | text | NO | — | — | Work e-mail. | **PDPA-Y** |
| `floor` | text | NO | — | — | Office floor / workplace location (filterable). Create-default `14th`. | **PDPA-Y** (location) |
| `avatar_url` | text | YES | — | — | Photo URL. | **PDPA-Y** (image of person) |
| `created_at` / `updated_at` | timestamptz | NO | `now()` | trigger `update_contacts_modtime` | Row timestamps. | Metadata |

Access control is the compensating measure: `GET /api/contacts` requires authentication (any role); mutations require maker/admin; deletion admin-only. There is no anonymization or auto-expiry — retention must be governed operationally.

### 5.6 `meeting_rooms` — rooms & current booking

Mapped to `MeetingRoom`. Booking state is a single JSON blob per room (no separate bookings table — one concurrent booking per room by design).

| Column | Type | Nullable | Default | Constraints | Description | PII (PDPA) |
|---|---|---|---|---|---|---|
| `seq` | bigserial | NO | auto | UNIQUE | Insertion ordering (`ORDER BY seq ASC`). | — |
| `id` | text | NO | — | **PK** | Room identifier. | — |
| `name` | text | NO | — | — | Room display name. | — |
| `code` | text | NO | — | — | Room code. | — |
| `floor` | text | NO | — | — | Floor. | — |
| `capacity` | integer | NO | — | — | Seat count. | — |
| `facilities` | jsonb | NO | `'[]'::jsonb` | — | Array of facility label strings. | — |
| `status` | text | NO | — | enum-by-app (§3.2) | `available` / `in-use` / `maintenance`. | — |
| `current_booking` | jsonb | YES | — | — | `{ "topic": string, "booker": string, "time": string }` — booker is the booking user's display name. | **PDPA-Y** (booker name) |
| `created_at` / `updated_at` | timestamptz | NO | `now()` | trigger `update_meeting_rooms_modtime` | Row timestamps. | Metadata |

### 5.7 `documents` — corporate policies & forms

Mapped to `PolicyDocument`. No UPDATE endpoint exists (new versions are re-registered; `version` is a label).

| Column | Type | Nullable | Default | Constraints | Description | PII (PDPA) |
|---|---|---|---|---|---|---|
| `seq` | bigserial | NO | auto | UNIQUE | Ordering (`ORDER BY seq DESC`, newest-first). | — |
| `id` | text | NO | — | **PK** | Client-supplied or `doc-<epoch-ms>`. | — |
| `title` | text | NO | — | — | Thai title. | — |
| `title_en` | text | NO | — | — | English title. | — |
| `category` | text | NO | — | enum-by-app (§3.2) | Create-default `form`. | — |
| `department` | text | NO | — | — | Owning department. Create-default `HR & Corporate Affairs`. | — |
| `version` | text | NO | — | — | Version label. Create-default `v1.0`. | — |
| `updated_at` | text | NO | — | — | **Display label** (`YYYY-MM-DD`); the DB row timestamp lives in `row_updated_at`. | — |
| `file_size` | text | NO | — | — | Human-readable size. Create-default `1.2 MB`. | — |
| `download_url` | text | NO | — | — | File link (uploaded `/uploads/...` or external). Create-default `#`. | — |
| `is_new` | boolean | NO | `false` | — | Forced `true` on create. | — |
| `created_at` | timestamptz | NO | `now()` | — | Row creation. | Metadata |
| `row_updated_at` | timestamptz | NO | `now()` | trigger `update_documents_modtime` | Row last-modified (dedicated function/column because `updated_at` is app-owned). | Metadata |

### 5.8 `sync_logs` — public-web sync transmission log (append-only)

Mapped to `SyncLog`. Records every simulated outbound transmission to the public website. **No outbound HTTP call is made** — the entry is the record of a state-machine transition (see DCR/known-gap in doc 08 §17).

| Column | Type | Nullable | Default | Constraints | Description | PII (PDPA) |
|---|---|---|---|---|---|---|
| `seq` | bigserial | NO | auto | UNIQUE | Ordering (`ORDER BY seq DESC`). | — |
| `id` | text | NO | — | **PK** | `sync-<epoch-ms>` (runtime) or seed ids. | — |
| `timestamp` | text | NO | — | — | `YYYY-MM-DD HH:MM:SS` display label (UTC, second precision). | Metadata |
| `item_id` | text | NO | — | — | News id, or `BULK-ALL` for manual full sync. | — |
| `item_title` | text | NO | — | — | Title snapshot at sync time. | May name individuals |
| `action` | text | NO | — | enum-by-app (§3.2) | `CREATE`/`UPDATE`/`DELETE`/`FORCE_SYNC`. | — |
| `status` | text | NO | — | enum-by-app (§3.2) | Always `SUCCESS` in runtime writes. | — |
| `target_endpoint` | text | NO | — | — | Logical destination, e.g. `api.kbjcapital.co.th/v1/public/news`; full sync uses `gateway.kbjcapital.co.th/v1/public/cache/purge-and-warm`. | — |
| `synced_by` | text | NO | — | — | Username of the acting user. | **PDPA-Y** |

### 5.9 `audit_logs` — immutable compliance trail (append-only)

Mapped to `AuditLog`. Written server-side via two paths — the direct `recordAudit()` (auth, users, sync-trigger, export, upload) and, for **news workflow transitions** (W2-FIX-3 `bccd441`), the transactional transition executor `repo.runNewsTransition()`: the row is re-read `SELECT … FOR UPDATE` inside `BEGIN`, a pure guard plan runs against the locked fresh row, and the news `UPDATE`, the audit `INSERT` and — on the approve path — the `sync_logs` `INSERT` commit in **one PostgreSQL transaction** and roll back together on any failure (read-only verdicts commit an empty transaction — denial rows are written post-transition via `recordAudit`; in-memory: item lock, state+audit back-to-back with prior-state restore; Doc 10 §9.3 v1.7.0). The actor always comes from the authenticated session (never client input).

| Column | Type | Nullable | Default | Constraints | Description | PII (PDPA) |
|---|---|---|---|---|---|---|
| `seq` | bigserial | NO | auto | UNIQUE | Ordering (`ORDER BY seq DESC`). | — |
| `id` | text | NO | — | **PK** | `audit-<epoch-ms>-<4 hex>` (runtime). | — |
| `timestamp` | text | NO | — | — | `YYYY-MM-DD HH:MM:SS` display label (UTC, second precision). | Metadata |
| `actor` | text | NO | — | — | Username; `Anonymous` for failed logins; `unknown-user:<id>` for logout of an already-deleted user. | **PDPA-Y** |
| `actor_role` | text | NO | — | — | Role label (`ROLE_LABELS`), or `Anonymous`/`Unknown`. | — |
| `action` | text | NO | — | enum-by-app (§3.2) | 14 action values. | — |
| `target_resource` | text | NO | — | — | Human label of the target (e.g. `News Announcement`, `User Account`, `Authentication`). | — |
| `resource_id` | text | NO | — | — | Target id (username for failed logins of unknown users; `PORTAL-GEN` default for manual entries). | — |
| `details` | text | NO | — | — | Free-text description; embeds usernames and content titles. | **PDPA-Y** (embedded identifiers) |
| `ip_address` | text | YES | — | — | Client IP (`req.ip`; single trusted proxy hop). Seed rows show enriched forms like `10.14.22.84 (Corporate Sindhorn)`. | **PDPA-Y** (online identifier) |
| `status` | text | NO | — | enum-by-app (§3.2) | `SUCCESS` / `REJECTED` / `WARNING`. | — |

---

## 6. Index inventory

Explicit indexes created by `schema.sql` / `PG_DDL` (all `IF NOT EXISTS` — idempotent):

| Index | Table | Column(s) | Purpose |
|---|---|---|---|
| `idx_sessions_expires` | sessions | `expires_at` | Hourly expiry sweep (`DELETE … WHERE expires_at < NOW()`). |
| `idx_news_category` | news | `category` | Category filter on GET /api/news. |
| `idx_news_sync_status` | news | `external_sync_status` | Sync-state filtering (External Web Sync view). |
| `idx_banners_order` | banners | `sort_order ASC` | Carousel ordering. |
| `idx_contacts_dept` | contacts | `department` | Directory department filter. |
| `idx_contacts_ext` | contacts | `extension` | Extension lookup/search. |
| `idx_docs_category` | documents | `category` | Document category filter. |
| `idx_sync_logs_ts` | sync_logs | `seq DESC` | Newest-first sync log listing. |
| `idx_audit_actor` | audit_logs | `actor` | Per-user compliance queries. |
| `idx_audit_action` | audit_logs | `action` | Per-action compliance queries. |
| `idx_audit_timestamp` | audit_logs | `seq DESC` | Newest-first audit trail. |

Implicit indexes: each table's `text PRIMARY KEY` and each `seq bigserial UNIQUE` constraint. No additional indexes are created at runtime. Note for DBAs: news/contacts/sync/audit listing queries order by `seq`, which is covered by the UNIQUE constraint's implicit index only for the DESC-ordered log tables via the explicit `*_ts` indexes above.

## 7. Triggers

| Trigger | Table | Function | Effect |
|---|---|---|---|
| `update_news_modtime` | news | `update_timestamp_column()` | `updated_at = CURRENT_TIMESTAMP` on UPDATE. |
| `update_banners_modtime` | banners | `update_timestamp_column()` | Same. |
| `update_contacts_modtime` | contacts | `update_timestamp_column()` | Same. |
| `update_meeting_rooms_modtime` | meeting_rooms | `update_timestamp_column()` | Same. |
| `update_users_modtime` | users | `update_timestamp_column()` | Same. |
| `update_documents_modtime` | documents | `update_row_timestamp_column()` | Sets **`row_updated_at`** (because `documents.updated_at` is the app-supplied display label). |

`sync_logs` and `audit_logs` intentionally have **no** trigger (append-only).

---

## 8. Non-persisted data served through the API

| Data | Source | Behavior |
|---|---|---|
| **System tools** (quick-launch links: `SystemTool` — id, name, description, iconName, url, category `hr`/`it`/`business`/`general`, isExternal, color) | `INITIAL_TOOLS` constant in `src/data/initialData.ts` | `GET /api/tools` returns the constant verbatim. **No table, no write endpoints** — changes require a code deploy. |
| **Uploaded file bytes** | `UPLOAD_DIR` volume (default `./uploads`; `/app/uploads` in containers; created at boot) | See doc 08 §5 (upload API) — files are stored with server-generated `<uuid>.<ext>` names; only the URL string is persisted (news/banners/contacts/documents URL columns). The upload namespace therefore **is** part of the data dictionary: original filenames never reach the filesystem; the mapping original→uuid exists only in the `FILE_UPLOAD` audit entry and any content row that references the URL. |

Seed content (`INITIAL_NEWS`, `INITIAL_BANNERS`, `INITIAL_CONTACTS`, `INITIAL_ROOMS` = `INITIAL_MEETING_ROOMS`, `INITIAL_DOCUMENTS`, `INITIAL_SYNC_LOGS`, `INITIAL_AUDIT_LOGS` from `src/data/initialData.ts`) is demo data used to fill **completely empty** tables on first PostgreSQL boot, and to initialize the in-memory stores.

---

## 9. Dev-mode in-memory mapping

When `DATABASE_URL` is unset, `InMemoryRepository` backs every endpoint. **All of it resets on process restart** (sessions included — every user is logged out); in dev the ephemeral `SESSION_SECRET` also regenerates, invalidating cookie signatures even if a session Map survived.

| PostgreSQL table | In-memory store (server.ts) | Initial value | Ordering semantics |
|---|---|---|---|
| `users` | `usersById: Map<id, User>` + `userIdByUsername: Map<lower(username), id>` | Empty → bootstrap admin (+ demo accounts when not production) | Insertion order (`Map` iteration). |
| `sessions` | `sessionsBySid: Map<sid, SessionRecord>` | Empty | — |
| `news` | `NewsItem[]` | `[...INITIAL_NEWS]` | `unshift` on insert → newest-first (matches `ORDER BY seq DESC`). |
| `banners` | `BannerSlide[]` | `[...INITIAL_BANNERS]` | `push` → insertion order (matches `ORDER BY seq ASC`). |
| `contacts` | `DirectoryContact[]` | `[...INITIAL_CONTACTS]` | `push` → insertion order. |
| `meeting_rooms` | `MeetingRoom[]` | `[...INITIAL_ROOMS]` | Insertion order; `saveRoom` upserts in place. |
| `documents` | `PolicyDocument[]` | `[...INITIAL_DOCUMENTS]` | `unshift` → newest-first. |
| `sync_logs` | `SyncLog[]` | `[...INITIAL_SYNC_LOGS]` | `unshift` → newest-first. |
| `audit_logs` | `AuditLog[]` | `[...INITIAL_AUDIT_LOGS]` | `unshift` → newest-first; **hard-capped at 5,000 entries** (oldest silently dropped — a dev-only divergence from PostgreSQL's unbounded append). |

Differences vs PostgreSQL worth remembering: username lookups trim + lowercase in both, but the in-memory store has no transactional upsert; `insertUser`/`insertNews` etc. mirror `ON CONFLICT (id) DO NOTHING` only for users/news/banners/contacts/documents (a duplicate id silently keeps the existing row), while `saveRoom` is a true upsert.

---

## 10. Data lifecycle & retention (PDPA accountability)

| Data | Lifecycle as built |
|---|---|
| **Sessions** | 7-day expiry (`expires_at = created_at + 7d`); deleted lazily on next use after expiry and swept hourly by the session sweeper (`DELETE FROM sessions WHERE expires_at < NOW()`); destroyed immediately on logout. |
| **Users** | Never deleted (no DELETE endpoint, no cascade in practice). Deactivation (`is_active = false`) blocks login and session resolution but keeps the row and all references. Plan user-data retention/deletion requests as manual DBA procedures under PDPA art. 30/39 duty. |
| **Audit logs** | Append-only; no update/delete path in code. Unbounded in PostgreSQL (retention = operational policy), capped at 5,000 rows in dev memory mode. |
| **Sync logs** | Append-only; unbounded. |
| **News / banners / contacts / documents** | True deletes exist (admin-only endpoints). Deleted content remains referenced in audit_logs/sync_logs text fields — the trail is preserved by design. |
| **Uploaded files** | Persist on the `UPLOAD_DIR` volume until manually removed; **no deletion endpoint and no DB record of the file itself** — deleting a news row does not delete its attachment bytes. Filename namespace: `<uuid v4>.<ext>` where ext ∈ `.jpg .jpeg .png .webp .gif .pdf .docx .xlsx`. |
| **Backups** | `GET /api/system/export` (admin) produces the full JSON export consumed by `scripts/migrate.js`. |

---

## 11. Migration tooling

### 11.1 Schema provisioning — `scripts/schema.sql`

Idempotent DDL: `CREATE TYPE` guarded by `duplicate_object` exception, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER`, and (W2-1) `ALTER TABLE news ADD COLUMN IF NOT EXISTS submitted_by / submitted_at` — the ALTER pair exists because `CREATE TABLE IF NOT EXISTS` does not touch pre-existing tables, so the new columns must be ensured explicitly on existing databases. Safe to re-run. Applied automatically at server boot by `PG_DDL` (identical statements); the script is for manual provisioning, DBA review, and CI. Docker-compose applies it only on a first-boot **empty** postgres volume — schema upgrades on existing databases are a manual step.

### 11.2 Content import — `scripts/migrate.js`

Reads an export produced by `GET /api/system/export`:

```
DATABASE_URL="postgresql://…" node scripts/migrate.js export.json
```

Expected payload shape (the script keys on `payload.tables`; table keys match schema names, row fields are the **camelCase TS fields**, not snake_case):

```
{ "exportTimestamp": "…", "version": "2.0.0", "schemaTarget": "postgresql", "storage": "postgres|memory",
  "counts": { news, banners, contacts, rooms, documents, auditLogs, syncLogs },
  "tables": { "news": [...NewsItem], "banners": [...BannerSlide], "contacts": [...DirectoryContact],
              "meeting_rooms": [...MeetingRoom], "documents": [...PolicyDocument],
              "audit_logs": [...AuditLog], "sync_logs": [...SyncLog] } }
```

- Content tables (news, banners, contacts, meeting_rooms, documents): **upsert** by `id` (`ON CONFLICT (id) DO UPDATE SET …`) — re-running refreshes rows.
- `sync_logs` / `audit_logs`: `ON CONFLICT (id) DO NOTHING` (append-only preserved).
- **Users are not part of the export** — use `scripts/seed-users.js` for accounts.
- Everything runs in one transaction; failure rolls back with no partial state.
- Note: `news.published_at_ts`, `created_at`, `updated_at` row columns are not in the export/import column set — row timestamps are re-derived by the DB.

### 11.3 Account seeding — `scripts/seed-users.js`

Upserts the admin by **username** (`ON CONFLICT (username) DO UPDATE` — resets password, display_name, email, role, reactivates; purpose is password reset). `ADMIN_USERNAME` defaults to `admin`; `ADMIN_PASSWORD` from env or interactive prompt (min 8 chars). `--demo` additionally creates `maker` / `checker` / `staff` with fixed dev passwords (`Maker@KBJ2026!` / `Checker@KBJ2026!` / `Staff@KBJ2026!`) — never in production. Requires the schema to exist.

---

## 12. Reconciliation notes (DCRs against existing prose)

| # | Finding | As-built truth (wins) |
|---|---|---|
| DCR-1 | HANDOVER §5 / export tooling prose describe the export shape as `{generatedAt, tables:{…}}`. | The actual field is **`exportTimestamp`** (server.ts, export endpoint); `migrate.js` reads `payload.tables` regardless. |
| DCR-2 | HANDOVER §5 API table implies `PUT /api/documents` exists ("GET/POST/PUT/DELETE /api/banners, /api/contacts, /api/documents"). | **No PUT documents route exists** — documents support GET/POST/DELETE only. |
| DCR-3 | HANDOVER §4 says the maker's create leaves `externalSyncStatus: 'draft'`. | Pre-W2-1, `POST /api/news` with `syncToExternal=true` created the item **directly as `synced`** and wrote a sync log — a maker acting alone could bypass dual-control at creation. **RESOLVED — W2-1 (commit 22023eb, FR-NEWS-009 strict ruling):** workflow fields (`externalSyncStatus`, `approvedBy`/`approvedAt`, `syncToExternal`) are stripped at the validation layer on every create/update; create always enters `draft`; `synced` is reachable only via checker approve (which now also bars self-approval). Schema lockstep: `submitted_by`/`submitted_at` columns added. |
| DCR-4 | HANDOVER §5 presents the `{success:true, data}` envelope as the universal API convention. | As built, read endpoints return a bare `{data[, total]}` and several route-level 404/400 bodies omit the `success` field — clients must tolerate both shapes (detailed in doc 08 §1.3). |
| DCR-5 | TS union `externalSyncStatus` (`src/types.ts:28`) declares `pending`; no runtime path assigns it. | Declared-but-unassigned dead member; harmless but worth pruning or wiring. (Correction per ratified register: `pending` is the **only** dead member — the union has no `approved` value at all.) |

*Unnumbered operational note (not a DCR):* the dev-mode in-memory audit trail is hard-capped at 5,000 entries — a deliberate memory bound that PostgreSQL mode does not share, and one HANDOVER does not mention. See §9 (dev-mode mapping) and §10 (data lifecycle & retention) for where it applies.

---

## 13. Change history

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0.0 | 2026-09-10 | worker-4 | Initial as-built data dictionary from `scripts/schema.sql`, `server.ts`, `src/types.ts`, `scripts/migrate.js`, `scripts/seed-users.js`. |
| 1.1.0 | 2026-09-10 | worker-4 | CTO-gate revision: DCR numbering aligned to the ratified register (dead-union → DCR-5, envelope inconsistency → DCR-4); 5,000-entry dev audit cap demoted to an unnumbered note; corrected `externalSyncStatus` union facts — `pending` is the only dead member, no `approved` value exists in the union. |
| 1.2.0 | 2026-09-10 | worker-4 (W2-1 truth pass) | Aligned to W2-1 strict dual-control (22023eb): §3.2/§5.3 workflow fields (`sync_to_external`, `external_sync_status`, `approved_by/at`) marked server-controlled (stripped on create/update; create always `draft`); new `submitted_by`/`submitted_at` columns documented (§5.3, §11.1 ALTER TABLE upgrade path); DCR-3 marked RESOLVED. |
| 1.4.0 | 2026-09-11 | worker-2 (W2-FIX-3 ripple pass) | §5.9 write-path sentence re-pinned to the as-built mechanism (code `bccd441`): `repo.commitNewsTransition()` → the transactional transition executor `repo.runNewsTransition()` (`SELECT … FOR UPDATE` re-read inside `BEGIN`, pure guard plan on the locked fresh row, then the one-transaction news `UPDATE` + audit `INSERT` (+ approve-path `sync_logs` `INSERT`) with `ROLLBACK` on any failure); read-only verdicts (denial rows written post-transition via `recordAudit`) noted; memory mirror (item lock + prior-state restore) noted; Doc 10 §9.3 ref bumped to v1.7.0. **Audit action union unchanged** — same 14-value live writer set, no call-site additions or removals. |
| 1.3.0 | 2026-09-11 | worker-5 (W2-FIX-1 ripple pass) | §3.2 `audit_logs.action` trued to the **14-value live writer union** (was the pre-prune Wave-1 list with dead `CREATE`/`DELETE`/`SYNC_PUBLIC` and a stale manual-append note — DCR-8 removal landed `f6fa52d`, prune landed `4650335`; matches Doc 05 §3.5 v1.2.0 / Doc 10 §9.1–§9.3; verified against `src/types.ts:119`) with the W2-FIX-1 call-site shapes (withdrawal `UPDATE` `prior_status='synced'`; legacy-decision `ACCESS_DENIED`, handler-level). §3.2/§5.3 news rows: withdraw edge added to the state machine (`synced→draft` state-only, `2c97cc3`); `external_sync_status` transitions now name all four endpoints; `submitted_by`/`submitted_at` cleared-by list + legacy no-submitter 409 denial noted. §5.9: two audit write paths (`recordAudit` direct vs `commitNewsTransition` single-transaction atomic commit) *(mechanism superseded by `runNewsTransition` in 1.4.0 / W2-FIX-3)*. Closes the doc-07 half of the `0be867c` ripple debt. |
