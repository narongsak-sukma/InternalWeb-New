# 08 — API Specification

**Version:** 1.3.0 · **Status:** Draft (Wave-2 revision) · **Date:** 2026-09-10 · **Author:** worker-4 → Lead review → CTO approval (W2-2 revision: worker-5; W2-1 truth pass: worker-4)

Complete as-built specification of the HTTP API served by the Express gateway in `server.ts` (bundled to `dist/server.cjs`). Every endpoint, status code, validation rule, default value, and side effect below was extracted from the code — nothing is aspirational. A machine-readable (partial) mirror is served at `GET /api/openapi.json`.

---

## 1. Conventions

### 1.1 Base URL & transport

- All JSON endpoints live under **`/api`**. Static uploads live under `/uploads`. Probes live at the root.
- JSON bodies: `Content-Type: application/json`, parsed by `express.json({ limit: '10mb' })`; urlencoded accepted likewise. Bodies over 10 MB → `413` (§16).
- The server trusts exactly **one** reverse-proxy hop (`trust proxy = 1`), so `req.ip` is the real client IP for rate limiting and audit logging.

### 1.2 Authentication — session cookie `kbj_session`

| Property | Value |
|---|---|
| Cookie name | `kbj_session` |
| Value format | `<sid>.<HMAC-SHA256(sid), base64url>` — the sid is 32 random bytes (base64url); the signature is verified with `crypto.timingSafeEqual` before the store is consulted |
| Attributes | `HttpOnly; SameSite=Lax; Path=/; Max-Age=604800` (7 days); **`Secure` added when `NODE_ENV=production`** |
| Server state | `sessions` table / in-memory Map; 7-day server-side expiry; hourly sweeper deletes expired rows; logout deletes immediately |
| Session invalidation | Signature mismatch, unknown/expired sid, user deleted-unknown, or **`user.isActive = false`** — deactivation revokes live sessions on the next request |
| `SESSION_SECRET` | HMAC key. **Mandatory in production** (process exits at boot without it); dev generates an ephemeral secret with a warning |

Other cookies are ignored; there is no bearer-token auth. `POST /api/auth/login` is the only way to obtain a session.

### 1.3 Response envelope (as built)

- Mutations and auth endpoints: success → `{ "success": true, "data": … }` (creations use HTTP 201; deletes return `{ "success": true, "message": "…" }`).
- **Read endpoints return a bare object without `success`**: `{ "data": [...] }`, plus `total` for news/contacts. This is the actual behavior — clients must not require `success` on reads.
- Middleware errors: `{ "success": false, "error": "<message>" }`.
- **Known inconsistency (as built):** route-level 404s on `PUT` mutations and room booking return a bare `{ "error": "…" }` without the `success` field (examples in §4.4, §4.8).

### 1.4 Standard error statuses

| Status | Produced by |
|---|---|
| `400` | Malformed JSON body (`Invalid JSON body`); blank/missing resource id (`Resource id is required`); per-route validation (users, upload, room booking, users PATCH) |
| `401` | `Authentication required` — missing/expired/invalid session on an authenticated route; login failure (`Invalid credentials`) |
| `403` | `Insufficient permissions` — authenticated but role not allowed |
| `404` | Unknown `:id` on PUT/booking routes (`{ "error": "<Resource> not found" }`); unmatched `/api/*` path (`No API endpoint for <METHOD> <path>`) |
| `409` | Username already exists (users POST) |
| `413` | Upload > 10 MB (`File exceeds the 10MB limit.`); JSON/urlencoded body > 10 MB (`Request body too large`) |
| `429` | Login rate limit exceeded |
| `500` | Unhandled error (`Internal server error`) — logged as one line, never a stack trace |
| `503` | `/readyz` when the repository is not healthy (PG mode) or stores are initializing (memory mode) |

### 1.5 Rate limiting — login only

`POST /api/auth/login` is rate-limited: **5 failed attempts per minute per IP** (`express-rate-limit`, 60 s window). Details that matter:

- **Only failed logins consume the budget** (`skipSuccessfulRequests: true`) — legitimate rapid logins never self-lockout; brute-force does.
- Exceeding the limit → `429` with `{"success":false,"error":"Too many login attempts. Please try again in a minute."}`.
- Draft-7 standard headers (`RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`) on login responses; legacy `X-RateLimit-*` headers disabled.
- Counter is per-process/per-pod — behind a multi-replica ingress use consistent hashing or a shared store for stricter enforcement (known limitation).

No other endpoint is rate-limited.

### 1.6 Security headers (every response)

`X-Content-Type-Options: nosniff` · `X-Frame-Options: SAMEORIGIN` · `X-XSS-Protection: 1; mode=block` · `Referrer-Policy: strict-origin-when-cross-origin` · `Permissions-Policy: camera=(), microphone=(), geolocation=()`.

### 1.7 Resource-id guard (defense in depth)

A pre-routing middleware on `/api` covers the id-addressable collections **news, banners, contacts, documents, users, rooms**: a `PUT`/`PATCH`/`DELETE` aimed at a bare collection (e.g. `DELETE /api/news/`), or any path with an empty id segment (e.g. `/api/news//approve`), is answered `400 {"success":false,"error":"Resource id is required"}` before routing. Per-route `requireResourceId` additionally rejects whitespace-only ids (`%20`) on `:id` mutation routes with the same body.

### 1.8 Logging & audit

Every request logs one structured JSON line (`time, method, path, status, durationMs, ip`). Sensitive operations additionally write an `audit_logs` row via `recordAudit()` — the actor is **always** taken from the authenticated session (or the attempted username for failed logins), never from client input. Audit side effects are listed per endpoint below.

---

## 2. Roles & access matrix

Roles: `admin` > `checker` (compliance) > `maker` (author) > `staff` (read-only). Legend: **anon** = no session needed; **auth** = any authenticated role; ✅ = role allowed; — = `403`.

| Endpoint | anon | staff | maker | checker | admin |
|---|---|---|---|---|---|
| `GET /healthz` `/readyz` `/api/openapi.json` | yes | yes | yes | yes | yes |
| `GET /api/news` `/api/banners` `/api/tools` `/api/rooms` | yes | yes | yes | yes | yes |
| `GET /uploads/*` (static files) | yes | yes | yes | yes | yes |
| `POST /api/auth/login` | rate-limited | – | – | – | – |
| `POST /api/auth/logout` | yes | yes | yes | yes | yes |
| `GET /api/auth/me` | 401 | auth | auth | auth | auth |
| `GET /api/contacts` `/api/documents` | 401 | auth | auth | auth | auth |
| `POST /api/rooms/:id/book` `/release` | 401 | auth | auth | auth | auth |
| `POST /api/upload` | 401 | 403 | ✅ | ✅ | ✅ |
| `POST/PUT /api/news`, `POST /api/news/:id/submit-approval` | 401 | 403 | ✅ | 403 | ✅ |
| `POST /api/banners` `/contacts` `/documents`, `PUT /api/banners/:id` `/contacts/:id` | 401 | 403 | ✅ | 403 | ✅ |
| `POST /api/news/:id/approve` `/reject` | 401 | 403 | 403 | ✅ | ✅ |
| `DELETE /api/{news,banners,contacts,documents}/:id` | 401 | 403 | 403 | 403 | ✅ |
| `GET /api/audit-logs` | 401 | 403 | 403 | ✅ | ✅ |
| `POST /api/audit-logs` | 401 | 403 | 403 | 403 | ✅ *(live today)* — **REMOVED per DCR-8**: target 404 for every role incl. admin (as-built until W2-2 code lands; §11.3) |
| `GET /api/sync/logs`, `POST /api/sync/trigger` | 401 | 403 | 403 | 403 | ✅ |
| `GET /api/system/export` | 401 | 403 | 403 | 403 | ✅ |
| `GET/POST /api/users`, `PATCH /api/users/:id` | 401 | 403 | 403 | 403 | ✅ |

Note: **no `PUT /api/documents/:id` route exists** (documents are GET/POST/DELETE only — see §17 DCR-2).

---

## 3. Authentication — `/api/auth`

### 3.1 `POST /api/auth/login`

| anon | staff | maker | checker | admin |
|---|---|---|---|---|
| rate-limited (§1.5) | – | – | – | – |

**Request** `application/json`:

```json
{ "username": "string (trimmed; case-insensitive match)", "password": "string" }
```

Missing/non-string/blank fields → `401` (not 400 — deliberately indistinguishable from a wrong password).

**Behavior.** Username lookup is case-insensitive (`LOWER(username)`). The password is bcrypt-compared (cost 12); for **unknown usernames the comparison runs against a precomputed dummy hash**, so response timing does not reveal whether the account exists. A correct password for an account with `is_active = false` is rejected exactly like a wrong password. On success a session row is created and the signed cookie is set (§1.2).

**Responses**

| Status | Body |
|---|---|
| `200` | `{"success":true,"data":{<SafeUser>}}` + `Set-Cookie: kbj_session=…` — SafeUser = `{id, username, displayName, email, role, createdAt, isActive}` (no password hash) |
| `401` | `{"success":false,"error":"Invalid credentials"}` |
| `429` | `{"success":false,"error":"Too many login attempts. Please try again in a minute."}` + `RateLimit-*` headers |

```json
{
  "success": true,
  "data": {
    "id": "3f2c6b70-…", "username": "admin", "displayName": "System Administrator",
    "email": "admin@kbjcapital.co.th", "role": "admin",
    "createdAt": "2026-08-01T04:00:00.000Z", "isActive": true
  }
}
```

**Side effects.** Success → `audit_logs` row `action=LOGIN`, `status=SUCCESS`, IP recorded. Failure (any cause) → `audit_logs` row `action=LOGIN_FAILED`, `actorRole="Anonymous"`, `status=WARNING`, `resourceId` = user id or the attempted username, IP recorded; the failed attempt consumes one rate-limit token.

### 3.2 `POST /api/auth/logout`

Any caller (a valid session, an invalid cookie, or none). Destroys the server-side session if the cookie resolves, clears the cookie, and returns:

| Status | Body |
|---|---|
| `200` | `{"success":true}` |

**Side effects.** If a session was found and destroyed → `audit_logs` row `action=LOGOUT` (actor resolved from the session's user; `unknown-user:<id>` if the account vanished). Otherwise no audit row.

### 3.3 `GET /api/auth/me`

| anon | staff | maker | checker | admin |
|---|---|---|---|---|
| 401 | auth | auth | auth | auth |

| Status | Body |
|---|---|
| `200` | `{"success":true,"data":{<SafeUser>}}` — the caller, refreshed from the store on every request |
| `401` | `{"success":false,"error":"Authentication required"}` |

---

## 4. User management — `/api/users` (admin only)

### 4.1 `GET /api/users`

| Status | Body |
|---|---|
| `200` | `{"data":[<SafeUser>, …]}` — ordered by `created_at, username`; **password hashes are never included** |
| `401` / `403` | per §1.4 |

### 4.2 `POST /api/users`

**Request** `application/json`:

| Field | Type | Validation (exact rules from code) | Error message on failure |
|---|---|---|---|
| `username` | string | `^[a-zA-Z0-9._-]{3,32}$` on the trimmed value | `Username must be 3-32 characters (letters, digits, dot, underscore, hyphen).` |
| `password` | string | length ≥ 8 | `Password must be at least 8 characters.` |
| `displayName` | string | non-blank after trim | `Display name is required.` |
| `email` | string | `^[^@\s]+@[^@\s]+\.[^@\s]+$` on the trimmed value | `A valid email address is required.` |
| `role` | string | one of `admin, checker, maker, staff` | `Role must be one of: admin, checker, maker, staff.` |

Checks run in the order above; the first failure wins (`400`). A duplicate (case-insensitive) username → `409 {"success":false,"error":"Username already exists."}`.

**Behavior.** The server generates the `id` (UUID v4), hashes the password (bcrypt cost 12), stamps `createdAt`, and inserts with `is_active = true`.

**Responses**

| Status | Body |
|---|---|
| `201` | `{"success":true,"data":{<SafeUser>}}` |
| `400` / `401` / `403` / `409` | per §1.4 and the table above |

**Side effects.** `audit_logs` row `action=USER_CREATE`, details `Created user "<username>" with role "<role>".`

### 4.3 `PATCH /api/users/:id` — activate / deactivate

There is **no user deletion**; this endpoint is the whole account lifecycle. Deactivation additionally revokes the target user's live sessions (§1.2) and blocks future logins.

**Request** `application/json`: `{"isActive": true|false}` — the legacy key `is_active` is also accepted.

| Status | Body / condition |
|---|---|
| `200` | `{"success":true,"data":{<SafeUser>}}` — updated account |
| `400` | `{"success":false,"error":"Request body must include a boolean \"isActive\" field."}` — field missing or not boolean |
| `400` | `{"success":false,"error":"You cannot deactivate your own account."}` — **self-deactivation is blocked server-side** |
| `404` | `{"success":false,"error":"User not found."}` |

**Side effects.** `audit_logs` row `action=USER_ACTIVATE` or `USER_DEACTIVATE`, details ``Activated/Deactivated user "<username>".``

---

## 5. File upload — `/api/upload` and `/uploads`

### 5.1 `POST /api/upload`

| anon | staff | maker | checker | admin |
|---|---|---|---|---|
| 401 | 403 | ✅ | ✅ | ✅ |

**Request** `multipart/form-data` with a single field named **`file`**:

| Rule | Value |
|---|---|
| Max size | **10 MB** (`LIMIT_FILE_SIZE` → 413) |
| Extension whitelist | `.jpg .jpeg .png .webp .gif .pdf .docx .xlsx` (case-insensitive; extension must be purely `[a-z0-9]+` after the dot — crafted multi-part extensions rejected) |
| Declared-MIME sanity check | Extension must match the declared `Content-Type`: images `image/jpeg|png|webp|gif`, `application/pdf` for `.pdf`, the Office OOXML types for `.docx`/`.xlsx` — **`application/octet-stream` is also accepted** for the two Office types (browsers commonly send it) |
| Storage name | **Server-generated `<uuid-v4><ext>`** — the client filename never touches the filesystem |
| Storage location | `UPLOAD_DIR` (default `./uploads`, `/app/uploads` in containers) |

**Responses**

| Status | Body |
|---|---|
| `201` | `{"success":true,"data":{"url":"/uploads/<uuid>.<ext>","fileName":"<original name>","size":<bytes>}}` |
| `400` | `File type not allowed. Allowed extensions: .jpg .jpeg .png .webp .gif .pdf .docx .xlsx` — or `File content type "<mime>" does not match its extension.` — or `No file provided. Send multipart/form-data with a "file" field.` |
| `413` | `{"success":false,"error":"File exceeds the 10MB limit."}` |

```json
{ "success": true, "data": { "url": "/uploads/9b64f3a2-1c5e-4d7a-9f01-2e8c6d5ab741.pdf", "fileName": "Loan_Policy_v2.4.pdf", "size": 482133 } }
```

**Side effects.** `audit_logs` row `action=FILE_UPLOAD`, `resourceId` = stored uuid filename, details `Uploaded "<original name>" (<size> bytes).` Files are **not** tracked in any table and have **no deletion endpoint** — cleanup is a volume-level operational task.

### 5.2 `GET /uploads/<uuid>.<ext>` — static serving (anon)

Read-only `express.static` on `UPLOAD_DIR` with `maxAge: '1d'`, no directory index, no redirect; directory traversal protected by Express; `nosniff` applies (§1.6). Any other name under `/uploads/` that does not exist → falls through (404 / SPA fallback per §13).

---

## 6. News & regulatory announcements — `/api/news`

The richest domain: CRUD plus the BOT maker-checker workflow. State machine as built — **strict dual-control since W2-1** (FR-NEWS-009, commit 22023eb): the workflow fields `externalSyncStatus`, `approvedBy`, `approvedAt`, `syncToExternal` are **server-controlled**, stripped from every create/update body at the validation layer, and `synced` is reachable **only** through checker approve — for every role, admin included.

```
  POST /api/news ──► draft ──submit-approval──► pending_approval ──approve──► synced
 (workflow fields     ▲ ▲                         (maker/admin;        (checker/admin; pending-
  stripped; always    │ │                          draft-only)          only; submitter ≠ approver)
  enters 'draft')     │ │                              │
                      │ └────────── reject ◄───────────┘
                      │            (checker/admin; pending-only; submitter ≠ decider)
                      │                │
                      │                ▼
                      └──────────── rejected
  PUT edit of a pending_approval / synced / rejected item force-resets it to draft
  (approval + submission stamps cleared, syncToExternal=false, AUD-P01 audit row).
```

Every guard rejection (illegal state → 400, self-approval/self-decision → 403) is audited as a `WARNING` row before the error is returned.

### 6.1 `GET /api/news` (anon)

**Query parameters**

| Param | Type | Behavior |
|---|---|---|
| `category` | string | Exact match on the category key; omitted or `all` → no filter |
| `search` | string | Case-insensitive substring across `title`, `titleEn`, `summary`, `department` |

**Responses** — `200` → `{"data":[<NewsItem>…],"total":<n>}` (newest first; no `success` field — §1.3). No error statuses beyond transport-level ones.

### 6.2 `POST /api/news` (maker, admin)

**Request** `application/json` — all fields optional; defaults from code:

| Field | Default when absent |
|---|---|
| `id` | `news-<epoch-ms>` |
| `title` | `ประกาศใหม่` |
| `titleEn` | `""` |
| `summary` / `content` | `""` |
| `category` | `kbj-news` |
| `categoryLabel` | `News` |
| `badge` | `News` |
| `badgeColor` | `orange` |
| `imageUrl` | Unsplash corporate default |
| `publishedAt` | Thai-locale date string, `day 2-digit month short year numeric` (e.g. `10 ก.ย. 2026`) |
| `readTime` | `3 นาที` |
| `author` | caller's `displayName` |
| `department` | `Corporate Communications` |
| `isImportantAlert` / `views` | `false` / `0` |
| `syncToExternal` | **forced `false`** — server-controlled (W2-1): stripped from the body at the validation layer; flips `true` only via checker approve |
| `externalSyncStatus` | **always `draft`** — server-controlled (W2-1): stripped from the body; every create enters the workflow as draft |
| `externalCategory` | `press-release` |
| `attachmentUrl` / `attachmentName` | `undefined` |

(`approvedBy`/`approvedAt`/`submittedBy`/`submittedAt` are likewise server-controlled — any values in the create body are discarded.)

**Responses** — `201` → `{"success":true,"data":{<NewsItem>}}`; `401`/`403` per §1.4.

**Side effects.** None — **no sync log on create and no audit entry**: nothing has left the building; a `sync_logs` row is written only by the checker approve endpoint (the sole path to `synced`). The workflow audit points are submit/approve/reject.

### 6.3 `PUT /api/news/:id` (maker, admin)

**Request:** partial or full `NewsItem` JSON — merged over the stored item (`{...existing, ...body}`); the `id` path parameter always wins over any body `id`. The four workflow fields (`externalSyncStatus`, `approvedBy`, `approvedAt`, `syncToExternal`) are **stripped from the body first** (server-controlled, W2-1) — they can never be set through this endpoint. No other field validation; unknown fields pass into the store shape.

**Forced draft reset (W2-1, FR-NEWS-009).** Editing an item whose current `externalSyncStatus` is `pending_approval`, `synced`, or `rejected` force-resets it: `externalSyncStatus = "draft"`, `syncToExternal = false`, and `approvedBy`/`approvedAt`/`submittedBy`/`submittedAt` all cleared. Rationale (code comment): a pending item must not be mutated while a checker reviews content they may never see again (TOCTOU), and a live item must not keep modified content public under a stale approval.

**Responses**

| Status | Body |
|---|---|
| `200` | `{"success":true,"data":{<updated NewsItem>}}` |
| `404` | `{"error":"News item not found"}` (bare — §1.3) |
| `400` | blank id (§1.7) |

**Side effects.** When the forced reset fires: an `audit_logs` row `action=UPDATE`, `status=SUCCESS` — the AUD-P01 forced-transition record, details `Edit of <priorStatus> item "<title prefix>…" reset externalSyncStatus to draft (forced transition; approval and submission stamps cleared, item dropped from the live sync set until re-approval).` **No sync log on update** — PUT can no longer reach `syncToExternal=true`; the flag flips only via the checker approve endpoint.

### 6.4 `DELETE /api/news/:id` (admin)

**Idempotent** — deleting an unknown id still returns success (no 404 path).

**Responses** — `200` → `{"success":true,"message":"Deleted successfully"}`; `400`/`401`/`403` per §1.4.

**Side effects.** If the deleted item had `syncToExternal=true`: a `sync_logs` row `action=DELETE` is written. The audit trail retains prior references to the item.

### 6.5 `POST /api/news/:id/submit-approval` (maker, admin)

Enters the item into dual-control review — **legal from `draft` only** (W2-1): a rejected item must be edited first (the edit resets it to draft); a synced item is already live; a pending item is already in review.

**Request:** none (body ignored).

| Status | Body |
|---|---|
| `200` | `{"success":true,"data":{<NewsItem>},"audit":{<AuditLog>}}` |
| `400` | `{"success":false,"error":"Only draft news items can be submitted for approval"}` — item not in `draft` (guard rejection audited WARNING first) |
| `404` | `{"error":"News item not found"}` |

**State transition:** `externalSyncStatus = "pending_approval"`, `syncToExternal = false` (not live until checker approval), and the submission is stamped `submittedBy` = submitter's user id, `submittedAt` = `YYYY-MM-DD HH:MM:SS` — the stamps the self-approval guard (§6.6/§6.7) checks and the draft reset (§6.3) clears.

**Side effects.** `audit_logs` row `action=SUBMIT_APPROVAL`, `status=SUCCESS`, details `Submitted by <username> (id: <user id>): "<first 30 chars of title>…" for dual-control checker review before public publishing.` Blocked attempts (non-draft state) write the same action with `status=WARNING` and a `Blocked: …` details line before the 400 is returned.

### 6.6 `POST /api/news/:id/approve` (checker, admin)

**Legal from `pending_approval` only** (W2-1), and **the submitter can never approve their own item** — the guard compares `submittedBy` against the acting checker's user id, so it binds admin too: an admin who submitted the item still cannot approve it.

**Request:** none (body ignored).

| Status | Body |
|---|---|
| `200` | `{"success":true,"data":{<NewsItem>},"audit":{<AuditLog>}}` |
| `400` | `{"success":false,"error":"Only news items pending approval can be approved"}` — item not in `pending_approval` (guard rejection audited WARNING first) |
| `403` | `{"success":false,"error":"Self-approval is not allowed: the submitter cannot approve their own item"}` — acting checker is the submitter (guard rejection audited WARNING first) |
| `404` | `{"error":"News item not found"}` |

**State transition:** `externalSyncStatus = "synced"`, `syncToExternal = true`, `approvedBy` = checker's username, `approvedAt` = `YYYY-MM-DD HH:MM:SS` (UTC label). The `submittedBy`/`submittedAt` stamps remain set — they anchor the approve audit's submitter attribution.

**Side effects.** (1) `audit_logs` row `action=APPROVE`, details `Approved public synchronization to www.kbjcapital.co.th for "<title prefix>…" (submitted by id: <submitter id | unknown>).`; (2) `sync_logs` row `action=CREATE`, `status=SUCCESS`, endpoint `api.kbjcapital.co.th/v1/public/news`, `syncedBy` = checker — **the only code path that writes a sync log for news** (the sole path to `synced`). (The sync log records the state machine; no outbound HTTP occurs — §17.)

### 6.7 `POST /api/news/:id/reject` (checker, admin)

**Legal from `pending_approval` only** (W2-1), and **the submitter can never decide their own item** — same `submittedBy` guard as approve, admin included.

**Request** `application/json` (optional): `{"reason": "string"}` — default reason: `Content revised or missing mandatory regulatory wording.`

| Status | Body |
|---|---|
| `200` | `{"success":true,"data":{<NewsItem>},"audit":{<AuditLog>}}` |
| `400` | `{"success":false,"error":"Only news items pending approval can be rejected"}` — item not in `pending_approval` (guard rejection audited WARNING first) |
| `403` | `{"success":false,"error":"Self-decision is not allowed: the submitter cannot reject their own item"}` — acting checker is the submitter (guard rejection audited WARNING first) |
| `404` | `{"error":"News item not found"}` |

**State transition:** `externalSyncStatus = "rejected"`, `syncToExternal = false`, and `approvedBy` is **overloaded** with `Rejected by <checker username>: <reason>` (there is no separate rejected-by/reason column — see doc 07 §5.3). `submittedBy`/`submittedAt` remain set (cleared only by the §6.3 draft reset when the maker edits the rejected item).

**Side effects.** `audit_logs` row `action=REJECT`, `status=REJECTED`, details `Rejected approval for "<title prefix>…". Reason: <reason>`.

---

## 7. Banners — `/api/banners`

### 7.1 `GET /api/banners` (anon)

`200` → `{"data":[<BannerSlide>…]}` (sort order ascending; bare envelope).

### 7.2 `POST /api/banners` (maker, admin)

**Request** (all optional; defaults): `id` → `banner-<epoch-ms>`; `title`/`subtitle` → `undefined`-passed-through (schema stores text; provide them); `badge` → `Kashjoy Highlight`; `imageUrl` → Unsplash default; `actionUrl` → `#`; `actionText` → `อ่านรายละเอียด`; `order` → current count + 1; `isActive` → `true` (only when the field is absent; explicit `false` honored).

**Responses** — `201` → `{"success":true,"data":{<BannerSlide>}}`; `401`/`403`.

### 7.3 `PUT /api/banners/:id` (maker, admin)

Partial JSON merged over the stored slide; `id` protected. `200` → `{"success":true,"data":{…}}`; `404` → `{"error":"Banner not found"}`; `400` blank id.

### 7.4 `DELETE /api/banners/:id` (admin)

Idempotent. `200` → `{"success":true,"message":"Banner removed"}`. No side effects beyond the delete.

---

## 8. Staff directory — `/api/contacts` (PDPA-critical; doc 07 §5.5)

### 8.1 `GET /api/contacts` (auth — any role)

**Query parameters**

| Param | Behavior |
|---|---|
| `department` | Exact match; `all`/omitted → no filter |
| `floor` | Exact match; `all`/omitted → no filter |
| `search` | Case-insensitive substring across `name`, `nameEn`, `position`, `extension` |

`200` → `{"data":[<DirectoryContact>…],"total":<n>}`; `401` when unauthenticated.

### 8.2 `POST /api/contacts` (maker, admin)

**Request** — required in practice: `name`, `position`, `department`, `extension`, `email`; defaults: `id` → `contact-<epoch-ms>`, `nameEn` → `""`, `floor` → `14th`; optional: `directPhone`, `avatarUrl`. No server-side format validation on phone/e-mail here (unlike users POST).

`201` → `{"success":true,"data":{<DirectoryContact>}}`; `401`/`403`.

### 8.3 `PUT /api/contacts/:id` (maker, admin)

Partial merge; `id` protected. `200` → updated contact; `404` → `{"error":"Contact not found"}`.

### 8.4 `DELETE /api/contacts/:id` (admin)

Idempotent. `200` → `{"success":true,"message":"Contact deleted"}`.

---

## 9. Meeting rooms — `/api/rooms`

### 9.1 `GET /api/rooms` (anon)

`200` → `{"data":[<MeetingRoom>…]}` — each room includes `status` and the current booking blob, if any.

### 9.2 `POST /api/rooms/:id/book` (auth — any role)

**Request** `application/json` (both optional): `{"topic": "string", "time": "string"}` — defaults `KB J Internal Meeting` and `14:00 - 15:30 น.`. `booker` is set server-side to the caller's display name.

| Status | Body / condition |
|---|---|
| `200` | `{"success":true,"data":{<MeetingRoom>}}` — `status:"in-use"`, `currentBooking:{topic,booker,time}` |
| `400` | `{"error":"Room is currently booked or under maintenance"}` — anything other than `status:"available"` |
| `404` | `{"error":"Room not found"}` |
| `400` | blank id (§1.7) |

One concurrent booking per room by design (no booking history table). No audit entry is written.

### 9.3 `POST /api/rooms/:id/release` (auth — any role)

**Request:** none (body ignored). Unconditionally sets `status:"available"` and clears `currentBooking` — releasing a room somebody else booked is permitted (as built).

`200` → `{"success":true,"data":{<MeetingRoom>}}`; `404` → `{"error":"Room not found"}`.

---

## 10. Policy documents — `/api/documents`

### 10.1 `GET /api/documents` (auth — any role)

**Query:** `category` — exact match; `all`/omitted → no filter. `200` → `{"data":[<PolicyDocument>…]}` (newest first); `401`.

### 10.2 `POST /api/documents` (maker, admin)

**Request** (defaults): `id` → `doc-<epoch-ms>`; `title` → pass-through (required in practice); `titleEn` → `""`; `category` → `form`; `department` → `HR & Corporate Affairs`; `version` → `v1.0`; `updatedAt` → today as `YYYY-MM-DD`; `fileSize` → `1.2 MB`; `downloadUrl` → `#`; **`isNew` is forced `true`** (client value ignored).

`201` → `{"success":true,"data":{<PolicyDocument>}}`; `401`/`403`.

### 10.3 `DELETE /api/documents/:id` (admin)

Idempotent. `200` → `{"success":true,"message":"Document deleted"}`. **No `PUT` exists** — version bumps are re-registrations (DCR-2).

---

## 11. Other content

### 11.1 `GET /api/tools` (anon)

Returns the in-code constant `INITIAL_TOOLS` verbatim: `{"data":[{id,name,description,iconName,url,category,isExternal,color}…]}`. Categories `hr`/`it`/`business`/`general`. Not persisted, not mutable via API.

### 11.2 `GET /api/audit-logs` (checker, admin)

`200` → `{"data":[<AuditLog>…]}` (newest first). Fields per doc 07 §5.9. No query/filter parameters are supported (as built).

### 11.3 `POST /api/audit-logs` — **REMOVED per DCR-8** (CTO ruling, RISK-023, decision #5/#6)

**Target state (doc-first):** the endpoint is removed. `POST /api/audit-logs`
returns `404` `{success:false, error:"No API endpoint for POST /api/audit-logs"}`
(the JSON `/api` catch-all) for **every caller — anonymous, staff, maker,
checker, and admin**. Audit rows are appended exclusively by server-side
`recordAudit()`; the API offers no audit-fabrication path. GET `/api/audit-logs`
(§11.2) is unchanged. Verification flip-pins: TC-AUDIT-008 / TC-RBAC-026
(doc 12).

*[As-built today, until the W2-2 code phase lands:* manual audit append for
admin. Request `application/json` (all optional; defaults): `action` →
`UPDATE`; `targetResource` → `General Portal`; `resourceId` → `PORTAL-GEN`;
`details` → `User initiated state change.`; `status` → `SUCCESS`. `actor`,
`actorRole`, `ipAddress`, `id`, `timestamp` always server-controlled; values
not validated against the TS unions (free text accepted). `201` →
`{"success":true,"data":{<AuditLog>}}`; `401`/`403`. — *documented in doc 10
§5 AUD-11 and FR-AUDIT-004 (SRS v1.2.0) for removal.]*

---

## 12. Public-web sync — `/api/sync`

### 12.1 `GET /api/sync/logs` (admin)

`200` → `{"data":[<SyncLog>…]}` (newest first). No filters.

### 12.2 `POST /api/sync/trigger` (admin)

**Request:** none (body ignored). Counts news with `syncToExternal=true`, appends a bulk handshake log, and returns:

```json
{
  "success": true,
  "message": "Public web synchronized successfully",
  "syncedItemsCount": 4,
  "log": {
    "id": "sync-1760000000000",
    "timestamp": "2026-09-10 08:30:00",
    "itemId": "BULK-ALL",
    "itemTitle": "Full Handshake Synchronization (4 Items Verified)",
    "action": "FORCE_SYNC",
    "status": "SUCCESS",
    "targetEndpoint": "gateway.kbjcapital.co.th/v1/public/cache/purge-and-warm",
    "syncedBy": "admin"
  }
}
```

**Important:** this drives the logging/state machine only — **no outbound HTTP request is made** to the public website. The real webhook is `[PLANNED]` (§17).

---

## 13. System, contract & probes

### 13.1 `GET /api/system/export` (admin)

Full JSON export of all content stores (input to `scripts/migrate.js`; shape detailed in doc 07 §11.2):

```json
{
  "exportTimestamp": "2026-09-10T08:30:00.000Z",
  "version": "2.0.0",
  "schemaTarget": "postgresql",
  "storage": "postgres",
  "counts": { "news": 6, "banners": 4, "contacts": 12, "rooms": 5, "documents": 8, "auditLogs": 4, "syncLogs": 3 },
  "tables": {
    "news": [...], "banners": [...], "contacts": [...], "meeting_rooms": [...],
    "documents": [...], "audit_logs": [...], "sync_logs": [...]
  }
}
```

Row fields are the camelCase TS shapes (not snake_case). **Users and sessions are never exported.** Note the field is `exportTimestamp`, not `generatedAt` (DCR-1).

### 13.2 `GET /api/openapi.json` (anon)

OpenAPI 3.0.3 document (info version `2.0.0`, servers `http://localhost:3000` and `https://intranet.kbjcapital.co.th`, `cookieAuth` security scheme). It enumerates paths and response codes for the API surface **but carries no request/response schemas** — this document (08) is the authoritative field-level contract; the JSON is a navigable summary. Treat any divergence as a bug in the JSON mirror.

### 13.3 Probes — `/healthz` vs `/readyz` (anon)

Aliases: `GET /healthz` = `/health` = `/api/health`; `GET /readyz` = `/ready` = `/api/ready`.

| | `/healthz` (liveness) | `/readyz` (readiness) |
|---|---|---|
| Question answered | "Should the container be **restarted**?" | "Should the container **receive traffic**?" |
| Checks | Process-level only — always `200` when the process is up | PG mode: `SELECT 1` against the pool. Memory mode: news **and** contacts stores non-empty |
| Failure | — (unreachable = crash) | `503 {"status":"not_ready","probe":"readiness","reason":"Database unavailable"}` (or `"Stores initializing"` in memory mode) — pulls the pod out of the Service |
| `200` body | `{"status":"healthy","probe":"liveness","timestamp","uptime":<sec>,"service":"kbj-intranet-portal","version":"2.0.0","k8s":{"podName","namespace","nodeName","cluster":"k8s-prod-cluster-01"}}` — pod fields from `HOSTNAME`/`POD_NAMESPACE`/`NODE_NAME` env with dev defaults; `cluster` is a fixed label | `{"status":"ready","probe":"readiness","timestamp","checks":{"database":"connected","cache":"ready","cmsStore":"initialized"}}` |

### 13.4 Unmatched paths & SPA

- Any unmatched method+path under `/api` → `404 {"success":false,"error":"No API endpoint for <METHOD> <path>"}` (JSON, never HTML — includes retired endpoints such as `/api/k8s/diagnostics`).
- In production, non-API paths fall back to the built SPA (`dist/index.html`); in dev, Vite middleware serves the SPA.

---

## 14. Full endpoint index

| # | Method | Path | Auth | Section |
|---|---|---|---|---|
| 1 | GET | `/healthz` (+`/health`, `/api/health`) | anon | §13.3 |
| 2 | GET | `/readyz` (+`/ready`, `/api/ready`) | anon | §13.3 |
| 3 | POST | `/api/auth/login` | anon, rate-limited | §3.1 |
| 4 | POST | `/api/auth/logout` | any | §3.2 |
| 5 | GET | `/api/auth/me` | auth | §3.3 |
| 6 | GET | `/api/users` | admin | §4.1 |
| 7 | POST | `/api/users` | admin | §4.2 |
| 8 | PATCH | `/api/users/:id` | admin | §4.3 |
| 9 | POST | `/api/upload` | maker/checker/admin | §5.1 |
| 10 | GET | `/uploads/*` | anon (static) | §5.2 |
| 11 | GET | `/api/news` | anon | §6.1 |
| 12 | POST | `/api/news` | maker/admin | §6.2 |
| 13 | PUT | `/api/news/:id` | maker/admin | §6.3 |
| 14 | DELETE | `/api/news/:id` | admin | §6.4 |
| 15 | POST | `/api/news/:id/submit-approval` | maker/admin | §6.5 |
| 16 | POST | `/api/news/:id/approve` | checker/admin | §6.6 |
| 17 | POST | `/api/news/:id/reject` | checker/admin | §6.7 |
| 18 | GET | `/api/banners` | anon | §7.1 |
| 19 | POST | `/api/banners` | maker/admin | §7.2 |
| 20 | PUT | `/api/banners/:id` | maker/admin | §7.3 |
| 21 | DELETE | `/api/banners/:id` | admin | §7.4 |
| 22 | GET | `/api/contacts` | auth | §8.1 |
| 23 | POST | `/api/contacts` | maker/admin | §8.2 |
| 24 | PUT | `/api/contacts/:id` | maker/admin | §8.3 |
| 25 | DELETE | `/api/contacts/:id` | admin | §8.4 |
| 26 | GET | `/api/rooms` | anon | §9.1 |
| 27 | POST | `/api/rooms/:id/book` | auth | §9.2 |
| 28 | POST | `/api/rooms/:id/release` | auth | §9.3 |
| 29 | GET | `/api/documents` | auth | §10.1 |
| 30 | POST | `/api/documents` | maker/admin | §10.2 |
| 31 | DELETE | `/api/documents/:id` | admin | §10.3 |
| 32 | GET | `/api/tools` | anon | §11.1 |
| 33 | GET | `/api/audit-logs` | checker/admin | §11.2 |
| 34 | POST | `/api/audit-logs` | ~~admin~~ **REMOVED per DCR-8** (target 404 all roles; as-built live until W2-2) | §11.3 |
| 35 | GET | `/api/sync/logs` | admin | §12.1 |
| 36 | POST | `/api/sync/trigger` | admin | §12.2 |
| 37 | GET | `/api/system/export` | admin | §13.1 |
| 38 | GET | `/api/openapi.json` | anon | §13.2 |

---

## 15. Error catalogue (exhaustive bodies)

| Origin | Status | Body |
|---|---|---|
| Auth middleware | 401 | `{"success":false,"error":"Authentication required"}` |
| Role middleware | 403 | `{"success":false,"error":"Insufficient permissions"}` |
| Login (bad input / bad password / unknown user / deactivated) | 401 | `{"success":false,"error":"Invalid credentials"}` |
| Login rate limit | 429 | `{"success":false,"error":"Too many login attempts. Please try again in a minute."}` |
| Resource-id guard / requireResourceId | 400 | `{"success":false,"error":"Resource id is required"}` |
| Users POST validation | 400 | one of the five messages in §4.2 |
| Users POST duplicate | 409 | `{"success":false,"error":"Username already exists."}` |
| Users PATCH | 400 | `…boolean "isActive" field.` / `You cannot deactivate your own account.` |
| Users PATCH unknown id | 404 | `{"success":false,"error":"User not found."}` |
| Upload (type/mime/missing) | 400 | §5.1 messages |
| Upload (size) | 413 | `{"success":false,"error":"File exceeds the 10MB limit."}` |
| PUT news/banner/contact 404 | 404 | `{"error":"News item not found"}` / `{"error":"Banner not found"}` / `{"error":"Contact not found"}` (bare) |
| News workflow state guard (§6.5–§6.7) | 400 | `{"success":false,"error":"Only draft news items can be submitted for approval"}` / `…Only news items pending approval can be approved` / `…Only news items pending approval can be rejected` — each preceded by a WARNING audit row |
| News self-approval / self-decision guard (§6.6/§6.7) | 403 | `{"success":false,"error":"Self-approval is not allowed: the submitter cannot approve their own item"}` / `…Self-decision is not allowed: the submitter cannot reject their own item` — each preceded by a WARNING audit row |
| Room book/release 404 | 404 | `{"error":"Room not found"}` (bare) |
| Room book conflict | 400 | `{"error":"Room is currently booked or under maintenance"}` (bare) |
| Unmatched /api path | 404 | `{"success":false,"error":"No API endpoint for <METHOD> <path>"}` |
| Malformed JSON body | 400 | `{"success":false,"error":"Invalid JSON body"}` |
| Oversized JSON body | 413 | `{"success":false,"error":"Request body too large"}` |
| Readiness not ready | 503 | `{"status":"not_ready","probe":"readiness","reason":"Database unavailable" | "Stores initializing"}` |
| Unhandled exception | 500 | `{"success":false,"error":"Internal server error"}` |

---

## 16. Deployment-relevant behavior

- Graceful shutdown on SIGTERM/SIGINT: HTTP server closes, DB pool closes, 10 s force-exit timeout (K8s `preStop` + 35 s grace period).
- An `unhandledRejection` hook logs and suppresses — a single bad request never kills the pod.
- Boot order: persistence init (schema ensure + empty-table seed) → session sweeper (hourly) → static/SPA wiring → bootstrap admin creation **before** the port opens (no login can race user creation).
- Production without `DATABASE_URL` logs a prominent warning and runs on in-memory stores (data loss on restart).

## 17. Planned capabilities & documented contradictions (DCRs)

| # | Item | Detail |
|---|---|---|
| Planned | **Outbound public sync webhook** | All sync statuses, logs, and `/api/sync/trigger` exist, but no outbound HTTP call to the public website is performed. Integrating the real webhook (plus the NetworkPolicy egress rule) is the next step. |
| Planned | Upload lifecycle management | No deletion/GC endpoint for uploaded files; volume grows until manually cleaned. |
| DCR-1 | Export shape prose says `generatedAt` | Actual field: **`exportTimestamp`** (§13.1). This document and doc 07 use the code's name. |
| DCR-2 | HANDOVER API table implies `PUT /api/documents` | **Route does not exist** (§10.3). |
| DCR-3 | Create-path dual-control bypass | Pre-W2-1, `POST /api/news` with `syncToExternal=true` landed directly in `synced` + wrote a sync log — no checker involvement. HANDOVER §4 describes creates as `draft`. **Decided — CTO strict ruling (Wave-1 gate):** no role (admin included) reaches `synced` outside checker approve; workflow fields server-controlled; enforcement lands Wave-2 P0 with DCR-7 as one work item (FR-NEWS-009). **RESOLVED — W2-1 (commit 22023eb, FR-NEWS-009):** enforcement landed — workflow fields stripped at the validation layer on every create/update (§6.2/§6.3); create always enters `draft`; state guards on submit/approve/reject (400) + submitter ≠ approver/decider bar (403), admin included, every guard rejection audited WARNING (§6.5–§6.7); edit of a non-draft item force-resets it to `draft` with an AUD-P01 audit (§6.3); `submitted_by`/`submitted_at` columns added in schema lockstep (doc 07 §5.3/§12). |
| DCR-4 | Envelope inconsistency | Reads omit `success`; some 404/400 route errors omit it too (§1.3). Clients must tolerate both. |
| DCR-5 | `pending` dead union member (external sync) | Declared in the TS union (`src/types.ts:28`), never assigned by any code path; it is the **only** dead member — the union contains no `approved` value at all (doc 07 §3.2). |
| DCR-8 | Manual audit append erodes trail integrity | `POST /api/audit-logs` (§11.3) lets an admin fabricate arbitrary `action`/`details` audit rows (RISK-023). **Decided — CTO ruling (Wave-2, decision #5/#6): PREFER REMOVAL.** Target: 404 for every role incl. admin; audit rows exclusively server-written via `recordAudit()`; GET audit surface unchanged. Doc-first revision (this version); route removal + test flips (TC-AUDIT-008 / TC-RBAC-026) land in the W2-2 code phase. |

## 18. Change history

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0.0 | 2026-09-10 | worker-4 | Initial as-built specification: 38 indexed operations (37 API + static uploads), extracted from `server.ts`. |
| 1.1.0 | 2026-09-10 | worker-4 + lead | CTO-gate revision (lead-applied): §17 DCR-5 row corrected to register facts (`pending` is the only dead union member; no `approved` value exists); DCR-3 row updated from "needs a decision" to the CTO strict ruling (Wave-2 P0, bundled with DCR-7). |
| 1.2.0 | 2026-09-10 | worker-5 (W2-2 doc phase) | DCR-8 (CTO: PREFER REMOVAL): §11.3 `POST /api/audit-logs` marked REMOVED (target 404 every role; as-built preserved inline until W2-2 code lands); §2 access-matrix row and endpoint index annotated; §17 DCR-8 row added. GET audit-logs unchanged. |
| 1.3.0 | 2026-09-10 | worker-4 (W2-1 truth pass) | Aligned to W2-1 strict dual-control (commit 22023eb): §6 state machine redrawn as the strict legal path (create-bypass arc removed; workflow fields server-controlled); §6.2 create defaults (syncToExternal forced false, externalSyncStatus always draft; no sync/audit side effects); §6.3 strip rule + forced non-draft→draft reset with AUD-P01 audit; §6.5–§6.7 state guards (400) + submitter ≠ approver/decider (403, admin included) with WARNING audits and submittedBy/At stamping; §15 guard bodies added; §17 DCR-3 marked RESOLVED. |
