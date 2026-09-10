# KB J Capital Intranet Portal

Corporate intranet web + CMS for KB J Capital Co., Ltd. — internal news and
announcements, staff directory, meeting-room booking (with release control),
policy documents, user management (create/deactivate accounts from the CMS),
and a regulated maker-checker publishing workflow for content cleared for the
public website. Thai/English React SPA served by a single Express TypeScript
gateway.

- **Frontend:** React 19 + Vite 6 + Tailwind CSS 4 (SPA, built to `dist/`)
- **Backend:** Express 4 gateway (`server.ts` → bundled `dist/server.cjs`)
- **Database:** PostgreSQL 16 when `DATABASE_URL` is set; in-memory stores
  otherwise (dev mode — data resets on restart)
- **Deployment:** Docker (multi-stage, non-root), docker-compose, Kubernetes

---

## 1. Quickstart (development)

Requires Node 20+ (Node 24 used during development).

```bash
npm install
npm run dev            # tsx server.ts + Vite middleware
```

Open http://localhost:3000

With no `DATABASE_URL` set the server runs in **in-memory dev mode**. A
bootstrap admin is created automatically on first boot:

| Setting  | Value (dev default)         |
|----------|-----------------------------|
| Username | `admin`                     |
| Password | `ChangeMe@KBJ2026!`         |

Change this immediately for anything beyond local development
(`POST /api/users` as admin creates real accounts).

Useful scripts:

```bash
npm run lint     # tsc --noEmit type check
npm run build    # vite build + esbuild server bundle → dist/
npm start        # node dist/server.cjs (production server)
```

## 2. Production — Docker Compose (app + PostgreSQL)

One machine, one command, real database with persistent volumes.

```bash
cp .env.production.example .env     # then replace EVERY placeholder in it
docker compose up -d --build
```

- App:      http://localhost:3000 (login with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env`)
- Postgres: `postgres:16-alpine`, data in the `pgdata` volume, health-checked
  with `pg_isready`; the app container waits for it (`service_healthy`)
- Uploads:  `uploads` volume mounted at `/app/uploads`
- Health:   `docker compose ps` shows `(healthy)` — the image health-checks
  `GET /healthz` every 30s

**First boot:** the postgres entrypoint applies `scripts/schema.sql` to the
empty database automatically.

**Upgrading an existing deployment:** `docker-entrypoint-initdb.d` only runs
on an *empty* data volume. After a schema change, apply it manually:

```bash
docker compose exec -T postgres psql -U kbj -d kbj_intranet < scripts/schema.sql
docker compose up -d --build
```

**Using an external database instead:** set `DATABASE_URL` in `.env` and start
only the app: `docker compose up -d --no-deps app`.

## 3. Production — Kubernetes

Hardened manifests live in `k8s/` (namespace, configmap, secret, PVC,
NetworkPolicies, deployment, service, ingress, HPA) applied via Kustomize.

```bash
# 1. Create the secret with real values (never commit secret.yaml)
cp k8s/secret.example.yaml k8s/secret.yaml
$EDITOR k8s/secret.yaml

# 2. Build + push the image, apply, and wait for rollout
DOCKER_REGISTRY=harbor.kbj.local/kbj IMAGE_TAG=2.0.0 ./deploy-k8s.sh
```

Or manually:

```bash
docker build -t <registry>/kbj/intranet:2.0.0 .
docker push <registry>/kbj/intranet:2.0.0
# edit the images: newName/newTag block in k8s/kustomization.yaml
kubectl apply -k ./k8s
kubectl rollout status deployment/kbj-intranet-portal -n kbj-intranet
```

Hardening included in the manifests:

- Non-root pod (uid/gid 10001, `runAsNonRoot`), immutable root filesystem,
  all capabilities dropped, `/tmp` as emptyDir
- NetworkPolicy: default-deny for the namespace; ingress only from the
  ingress controller and same-namespace pods; egress limited to DNS + 5432
  (requires a NetworkPolicy-enforcing CNI — see `k8s/networkpolicy.yaml`)
- Liveness `/healthz`, readiness `/readyz`, startup probe, graceful shutdown
  (`terminationGracePeriodSeconds: 35` + preStop drain)
- Uploads on a PVC (`k8s/pvc.yaml`, 5Gi ReadWriteOnce — read the note there
  before scaling replicas across nodes)

**Adjust before first use:** ingress hostnames (`intranet.kbjcapital.co.th` /
`portal.kbjcapital.co.th` in `k8s/ingress.yaml`), the TLS secret
(`kbj-intranet-tls`), and the image registry in `k8s/kustomization.yaml`.

## 4. Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | prod (for persistence) | — | `postgresql://user:pass@host:5432/kbj_intranet`. Absent → in-memory dev mode |
| `SESSION_SECRET` | **yes when `NODE_ENV=production`** | — | 32+ random chars; the server refuses to start without it |
| `ADMIN_USERNAME` | no | `admin` | Bootstrap admin created when the users store is empty |
| `ADMIN_PASSWORD` | no | `ChangeMe@KBJ2026!` (dev) | Bootstrap admin password — always set a strong one in production |
| `UPLOAD_DIR` | no | `./uploads` | Writable directory for uploaded files (`/app/uploads` in containers) |
| `PORT` / `HOST` | no | `3000` / `0.0.0.0` | Listen address |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | compose only | `kbj` / — / `kbj_intranet` | Provisioning of the compose postgres service |

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 5. Authentication & roles

Session-based auth: `POST /api/auth/login` sets an `httpOnly` cookie
(`kbj_session`, `SameSite=Lax`, `Secure` in production, 7-day expiry, stored
server-side). Passwords hashed with bcrypt (cost 12). Login is rate-limited
to 5 attempts/min/IP.

| Role | Intended user | Can |
|---|---|---|
| `admin` | IT administrator | Everything: user management (list / create / deactivate accounts via the CMS User Management tab), deletes, sync, system export |
| `checker` | Compliance officer | Read + approve/reject public-sync submissions, audit logs |
| `maker` | Department author | Read + create/edit news, banners, contacts, documents; submit for approval; upload files |
| `staff` | Every employee | Read authenticated content, book and release meeting rooms |

The SPA has exactly **three views**:

| View | Who can reach it |
|---|---|
| Intranet portal | Every signed-in user (anonymous visitors get the login screen) |
| Admin CMS | `maker` and above — capabilities inside the CMS differ per role (e.g. only `checker`+ sees approve/reject, only `admin` sees User Management and deletes) |
| External Web Sync | `maker` and above |

Public (no login): news, banners, tools, rooms listings, health probes.
Public-sync publishing follows a maker-checker flow: `submit-approval` →
`approve`/`reject` (checker/admin), with an audit-log entry recording the
authenticated actor for every sensitive action.

Key endpoints: `/api/auth/login|logout|me`, `/api/users` and
`/api/users/:id` (admin — list/create, activate/deactivate),
`/api/upload` (maker+), `/api/news`, `/api/banners`, `/api/contacts`,
`/api/documents`, `/api/rooms/:id/book|release`, `/api/audit-logs`
(checker+), `/api/sync/*` and `/api/system/export` (admin). Full contract:
`GET /api/openapi.json`.

## 6. Architecture

```
Browser ──▶ Express gateway (server.ts, port 3000)
              ├─ serves React SPA from dist/ (production)
              ├─ /api/* JSON endpoints (RBAC middleware)
              ├─ /uploads/* static files (multer uploads, UPLOAD_DIR)
              └─ repository layer
                   ├─ PostgreSQL pool  (DATABASE_URL set — sessions, users, content)
                   └─ in-memory stores (fallback / dev)
```

One process, one port; the same image runs in compose and Kubernetes.

## 7. Security notes

- Secrets are injected via environment (compose) / Kubernetes Secret — never
  baked into the image (`.dockerignore` excludes all env files)
- Container runs as unprivileged uid 10001; K8s adds a read-only root
  filesystem and default-deny network policies
- Security headers on every response (`nosniff`, `SAMEORIGIN`, referrer /
  permissions policy); requests are JSON-logged with the client IP
- Maker-checker dual control and the actor-stamped audit trail support BOT
  governance and PDPA accountability requirements

## 8. Known limitations

- **Outbound public sync is modelled, not wired:** sync statuses, logs, and
  `/api/sync/trigger` drive the state machine, but no outbound HTTP call to
  the public website is performed yet.
- **Uploads on RWO storage:** multi-replica Kubernetes scheduling is
  constrained by the ReadWriteOnce PVC (single writer — see the note in
  `k8s/pvc.yaml`); move to RWX or object storage before scaling out.
- **Login rate limiting is per process/pod** (5 attempts/min/IP, in-memory).
  With many replicas behind an ingress, add consistent hashing or a shared
  store if stricter enforcement is required.
- **Schema upgrades on existing databases are manual** — the postgres
  init-once mechanism only applies `schema.sql` to an empty volume (see §2).
- **User accounts are deactivated, never deleted** (audit-trail integrity);
  plan retention accordingly.

## 9. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Server exits immediately in production | `SESSION_SECRET` missing — the app refuses to start; set it in `.env` / secret |
| Data resets after restart | No `DATABASE_URL` — running in in-memory mode |
| `users`/`sessions` tables missing on an existing DB | `schema.sql` auto-applies only to empty volumes; run `psql -f scripts/schema.sql` manually (see §2) |
| CrashLoopBackOff, log shows `ERR_INVALID_ARG_TYPE ... fileURLToPath` | Image built from a broken revision (`import.meta.url` in the CJS bundle); rebuild the image |
| Uploads fail with permission errors | Volume at `/app/uploads` not writable by uid 10001 (compose: named volume; k8s: `fsGroup: 10001`) |
| Second K8s pod stays Pending | RWO PVC is attached to another node — see the tradeoff note in `k8s/pvc.yaml` |
| Container unhealthy | Check `docker logs` / `kubectl logs`; the probe is `GET /healthz` |
