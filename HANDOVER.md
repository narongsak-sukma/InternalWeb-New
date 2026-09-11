# KB J Capital Co., Ltd. — Technical Handover Guide

**Project:** Corporate Intranet & Public Sync Portal
**Target infrastructure:** Company Kubernetes cluster (or single Docker host) + PostgreSQL 16
**Compliance context:** Bank of Thailand (BOT) financial-institution governance, Thailand PDPA B.E. 2562
**Version:** 2.0.0

---

## 1. Executive summary

A single-process full-stack portal that unifies KB J Capital's internal
communications (news, directory, room booking, policy documents) with a
regulated maker-checker workflow for content cleared for publication to the
public website.

Everything runs in one container image:

- **Express 4 TypeScript gateway** (`server.ts`, bundled to `dist/server.cjs`)
  serving the JSON API, uploaded files, and — in production — the built SPA.
- **React 19 + Vite 6 + Tailwind 4 SPA** (Thai/English), built to `dist/`.
- **Repository layer** with two implementations: PostgreSQL (via `pg`, used
  when `DATABASE_URL` is set) and in-memory stores (dev fallback).
- **Ops assets:** multi-stage non-root `Dockerfile`, `docker-compose.yml`
  (app + postgres), hardened `k8s/` manifests, `deploy-k8s.sh`,
  `scripts/schema.sql`, `scripts/migrate.js`, `scripts/smoke-test.mjs`.

Day-to-day operator instructions live in `README.md`; this document explains
what the system is and how it is built.

## 2. Architecture

```
                       [ Employees / Compliance / IT ]
                                     │
                       [ Ingress / reverse proxy, TLS ]
                                     │
              ┌──────────────────────▼──────────────────────┐
              │   Express gateway  (port 3000, uid 10001)   │
              │  ─ /api/*  JSON API (session auth + RBAC)   │
              │  ─ /uploads/*  static uploaded files        │
              │  ─ SPA static assets from dist/ (prod)      │
              │  ─ /healthz /readyz  probes                 │
              └───────┬──────────────────────────┬──────────┘
                      │                          │
        [ PostgreSQL 16 via DATABASE_URL ]   [ UPLOAD_DIR volume ]
        users, sessions, news, banners,       uuid-named files,
        contacts, rooms, documents,           10MB max, extension
        audit_logs, sync_logs                 whitelist
```

Without `DATABASE_URL` the same binary serves seeded in-memory stores —
convenient for demos and development, not for production (data resets on
restart, sessions are per-process).

## 3. Authentication & sessions

- `POST /api/auth/login {username, password}` — bcrypt comparison (cost 12);
  on success sets the `kbj_session` cookie: `httpOnly`, `SameSite=Lax`,
  `Secure` when `NODE_ENV=production`, 7-day server-side expiry.
- Sessions are persisted (DB `sessions` table / in-memory map) and the
  session id is HMAC-SHA256 signed with `SESSION_SECRET`.
- Login is rate-limited to 5 attempts/min/IP (`express-rate-limit`, draft-7
  headers, HTTP 429 with JSON body).
- Failed logins are compared against a dummy hash so response timing does
  not reveal whether a username exists.
- **`SESSION_SECRET` is mandatory in production** — the process exits at
  boot without it. In dev an ephemeral secret is generated with a warning.
- A bootstrap admin (`ADMIN_USERNAME`/`ADMIN_PASSWORD`) is created
  automatically whenever the users store is empty.
- Other endpoints: `POST /api/auth/logout`, `GET /api/auth/me`,
  `GET/POST/PATCH /api/users` (admin).

## 4. Roles & access control (RBAC)

Roles: `admin` > `checker` (compliance) > `maker` (author) > `staff` (read).

| Endpoint | anon | staff | maker | checker | admin |
|---|---|---|---|---|---|
| `GET /healthz` `/readyz` `/api/openapi.json` | yes | yes | yes | yes | yes |
| `GET /api/news` `/api/banners` `/api/tools` `/api/rooms` | yes | yes | yes | yes | yes |
| `POST /api/auth/login` | rate-limited | – | – | – | – |
| `GET /api/contacts` `/api/documents` | 401 | yes | yes | yes | yes |
| `POST /api/rooms/:id/book` `/release` | 401 | yes | yes | yes | yes |
| `POST/PUT /api/news`, `POST /api/banners` `/contacts` `/documents` | 401 | 403 | yes | 403 | yes |
| `POST /api/news/:id/submit-approval` | 401 | 403 | yes | 403 | yes |
| `POST /api/news/:id/approve` `/reject` | 401 | 403 | 403 | yes | yes |
| `DELETE /api/{news,banners,contacts,documents}/:id` | 401 | 403 | 403 | 403 | yes |
| `GET /api/audit-logs` | 401 | 403 | 403 | yes | yes |
| `GET /api/sync/logs`, `POST /api/sync/trigger` | 401 | 403 | 403 | 403 | yes |
| `GET /api/system/export` | 401 | 403 | 403 | 403 | yes |
| `GET/POST /api/users`, `PATCH /api/users/:id` | 401 | 403 | 403 | 403 | yes |
| `POST /api/upload` | 401 | 403 | yes | yes | yes |

Audit-log entries record the **authenticated actor** (id, username, role) —
client-supplied actor strings are not accepted.

### UI views

The SPA exposes exactly three views (`ViewMode`): **Intranet portal**
(every signed-in user; anonymous visitors get the login screen), **Admin CMS**
(`maker` and above — in-CMS capabilities differ per role: approve/reject is
`checker`+, deletes and the User Management tab are `admin`-only), and
**External Web Sync** (`maker` and above). The former Architecture Blueprint
and K8s DevOps internal views were removed; the dead `/api/k8s/diagnostics`
endpoint is gone with them.

### Maker-checker (BOT governance)

Public-sync publishing requires two people by design:
1. **Maker** creates/edits the announcement (`externalSyncStatus: 'draft'`).
2. Maker submits: `POST /api/news/:id/submit-approval` → `'pending_approval'`.
3. **Checker** (compliance) reviews: `/approve` or `/reject`.
4. On approval the item is stamped `approvedBy`/`approvedAt` and transitions
   to `'synced'`; every transition writes an audit-log entry.

## 5. API

Machine-readable contract: `GET /api/openapi.json` (kept in sync with the
routes). Envelope convention: `{success: true, data: …}` /
`{success: false, error: "…"}`.

Representative endpoints (see the OpenAPI document for the full list):

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/login` | anon (limited) | Issue session cookie |
| POST | `/api/auth/logout` | session | Clear session |
| GET | `/api/auth/me` | session | Current user |
| GET/POST | `/api/users` | admin | List / create users |
| PATCH | `/api/users/:id` | admin | Activate/deactivate an account (self-deactivation blocked server-side; deactivated users fail login) |
| POST | `/api/upload` | maker+ | Multipart `file` → `{url:"/uploads/<uuid>.<ext>", fileName, size}` |
| GET/POST/PUT/DELETE | `/api/news` … | per matrix | News CRUD + approval flow |
| GET/POST/PUT/DELETE | `/api/banners`, `/api/contacts` | per matrix | CMS content |
| GET/POST/DELETE | `/api/documents` | per matrix | Policy documents (no update route as built) |
| POST | `/api/rooms/:id/book`, `/release` | staff+ | Room booking |
| GET | `/api/audit-logs` | checker+ | Compliance trail |
| GET/POST | `/api/sync/logs`, `/api/sync/trigger` | admin | Public-sync operations |
| GET | `/api/system/export` | admin | Full JSON export (`{exportTimestamp, tables:{…}}`) |
| GET | `/healthz`, `/readyz` | anon | Liveness / readiness probes |

## 6. Persistence & data migration

- **Schema:** `scripts/schema.sql` — idempotent DDL (safe to re-run).
  Applied automatically by docker-compose on first boot of an empty postgres
  volume; for anything else run it manually:
  ```bash
  psql -h <db-host> -U <user> -d kbj_intranet -f scripts/schema.sql
  ```
  Note: the postgres init mechanism only runs on an *empty* data volume —
  schema upgrades on existing databases are a manual step.
- **Moving in-memory/legacy data into PostgreSQL:** export from the admin UI
  (`GET /api/system/export` → JSON with a `tables` object), then:
  ```bash
  DATABASE_URL=postgresql://… node scripts/migrate.js export.json
  ```
  The migration script reads `payload.tables` (the actual export shape).
- **Health signalling:** `/readyz` reflects repository health (a dead
  PostgreSQL connection fails readiness and pulls the pod out of rotation;
  `/healthz` stays process-level for restart decisions).

## 7. File uploads

- `POST /api/upload` (maker and above), multipart field `file`.
- Limits: 10 MB per file; extension whitelist `.jpg .jpeg .png .webp .gif
  .pdf .docx .xlsx`.
- Files are stored under `UPLOAD_DIR` (default `./uploads`, `/app/uploads`
  in containers) with random UUID filenames; served read-only at
  `/uploads/<uuid>.<ext>`.
- Persistence: mount a volume at `/app/uploads` (compose: named `uploads`
  volume; Kubernetes: `kbj-intranet-uploads` PVC — see the RWO scaling note
  in `k8s/pvc.yaml`).

## 8. Deployment

### Docker Compose (single host)

`docker compose up -d --build` after filling `.env` from
`.env.production.example`. Brings up app + postgres:16-alpine with health
checks, persistent volumes, and first-boot schema init. See README §2.

### Kubernetes

`k8s/` contains namespace, ConfigMap, Secret (template), PVC,
NetworkPolicies, Deployment, Service, Ingress, HPA, and a Kustomization.

`./deploy-k8s.sh` builds + pushes the image, rewrites the kustomize image
reference, applies, and waits for rollout. Manual equivalent in README §3.

Hardening actually present in the manifests:

- Non-root (`runAsNonRoot`, uid/gid 10001), read-only root filesystem,
  `allowPrivilegeEscalation: false`, all capabilities dropped
- Default-deny NetworkPolicy; ingress only from ingress-controller +
  same namespace; egress limited to DNS + PostgreSQL 5432 (requires a CNI
  that enforces NetworkPolicy)
- Liveness/readiness/startup probes wired to `/healthz` `/readyz`
- Rolling update `maxUnavailable: 0`, pod anti-affinity, HPA 2→10 replicas
- Graceful shutdown: SIGTERM handler in the server + `preStop` sleep +
  35s termination grace period

### Container image

Multi-stage `node:20-alpine`; runtime installs production dependencies only
(the server bundle is built with `--packages=external`), runs as uid 10001,
exposes 3000, and has a Docker-level `HEALTHCHECK` on `/healthz`.

## 9. Security details

- Response headers on every request: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Secrets enter only via environment (compose) or Kubernetes Secret;
  `.dockerignore` excludes all env files from the image build context
- Structured JSON request logging (time, method, path, status, duration, IP)
  ready for log aggregation
- Audit trail (PDPA accountability): append-only log with actor, action,
  target, IP, and result for sensitive operations
- TLS terminates at the ingress; the cookie is `Secure` in production

## 10. Known limitations & follow-ups

- **Outbound public sync is modelled, not wired:** sync statuses and logs
  exist and `/api/sync/trigger` drives the state machine, but no outbound
  HTTP call to the public website is performed yet. Integrating the real
  webhook (and adding an egress rule for it) is the next step.
- **Uploads on RWO storage:** multi-replica scheduling is constrained by the
  ReadWriteOnce PVC — a single pod can hold the volume at a time
  (see `k8s/pvc.yaml`); move to RWX or object storage before scaling out.
- **Schema upgrades are manual** on existing databases (the postgres
  init-once mechanism only touches empty volumes).
- **No user deletion by design:** the User Management tab (admin) lists,
  creates, and deactivates/reactivates accounts; records are kept for
  audit-trail integrity, so plan retention accordingly.
- Login rate limiting uses a shared PostgreSQL-backed store (the
  `rate_limit_hits` atomic upsert in the repository layer), so the 5
  failed-attempts/min/IP budget is enforced per cluster, not per pod.
  In-memory dev mode stays per-process, and a transient database error fails
  open with a WARNING rather than locking out all users.

## 11. Verification

- `npm run lint` — TypeScript check (`tsc --noEmit`)
- `node scripts/smoke-test.mjs` — end-to-end API/auth/RBAC suite against a
  running server (see script header for usage)
- `docker compose config` / `kubectl kustomize k8s` — validate deployment
  manifests
