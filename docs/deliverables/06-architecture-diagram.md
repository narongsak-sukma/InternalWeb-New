# Deliverable 6 — Architecture Diagrams

**KB J Capital Co., Ltd. — Corporate Intranet & Public Sync Portal**

**Version:** 1.1.0 · **Status:** Draft (W2-1 truth revision) · **Date:** 2026-09-10 · **Author:** worker-3 → Lead review → CTO approval (W2-1 truth pass: worker-3)

> **Change log** — **1.1.0 (2026-09-10)**: W2-1 truth pass (align to the landed branch code): §3 state machine and §5.2 sequence diagram rewritten to the **single legal path** — the Wave-1 direct-publish bypass (PATH A, DCR-3) is closed by FR-NEWS-009 (workflow fields stripped at the validation layer, submit draft-only, approve/reject pending-only, submitter ≠ approver for every role, forced edit-reset audited AUD-P01; sync log written only by approve); appendix source-mapping line references re-baselined. Line references are a snapshot of the Wave-2 working tree (worker-2's W2-3 audit-coverage work is in flight on this branch; its behavior is documented in Doc 10 §9.1 and not restated here — expect minor drift until W2-3 lands). **1.0.0**: initial AS-BUILT record (Wave-1 gate, approved) — its diagrams documented the then-live dual-path behavior.

---

## Contents

1. [System context diagram (C4 Level 1)](#1-system-context-diagram-c4-level-1)
2. [Container diagram (C4 Level 2)](#2-container-diagram-c4-level-2)
3. [Component diagram — server.ts (C4 Level 3)](#3-component-diagram--serverts-c4-level-3)
4. [Deployment diagrams](#4-deployment-diagrams)
   - 4.1 Kubernetes (production target)
   - 4.2 Docker Compose (single host)
5. [Dynamic views — sequence diagrams](#5-dynamic-views--sequence-diagrams)
   - 5.1 Login (rate limit, bcrypt, timing defense, session issue)
   - 5.2 Maker-checker publish (submit → approve/reject → synced + audit)
   - 5.3 Room booking
   - 5.4 File upload
   - 5.5 Graceful shutdown
6. [Data-flow diagram (incl. PDPA-relevant flows)](#6-data-flow-diagram-incl-pdpa-relevant-flows)

**Notation.** All diagrams are GitHub-renderable Mermaid. C4 Levels 1–3 are
drawn as flowcharts styled per the C4 model (person / system / container /
component) for maximum renderer compatibility. Every diagram is **as built**
from `server.ts`, `src/`, `Dockerfile`, `docker-compose.yml`, and `k8s/**`;
future work is marked `[PLANNED]`. Prose detail behind each diagram lives in
`05-sds.md`; section references point there.

---

## 1. System context diagram (C4 Level 1)

```mermaid
flowchart TB
    staff["KB J staff<br/>read portal, book rooms,<br/>search directory"]
    maker["Makers<br/>department authors<br/>create and submit content"]
    checker["Checkers<br/>compliance officers<br/>approve or reject publishing"]
    adminop["Admin operators<br/>IT administrators<br/>users, sync, export"]

    portal(["KB J Capital Intranet Portal<br/>corporate intranet and CMS<br/>maker-checker publishing to public web"])

    pg[("PostgreSQL 16<br/>users, sessions, content,<br/>audit and sync logs")]
    publicweb["KB J public website<br/>www.kbjcapital.co.th<br/>PLANNED outbound sync target"]
    ops["Ops and observability<br/>stdout JSON logs,<br/>probes, Prometheus scrape"]

    staff -->|"HTTPS via ingress"| portal
    maker -->|"author and submit"| portal
    checker -->|"dual-control review"| portal
    adminop -->|"user management,<br/>sync trigger, system export"| portal
    portal -->|"SQL, TCP 5432"| pg
    portal -.->|"PLANNED webhook, HTTPS 443"| publicweb
    portal -->|"logs and metrics"| ops
```

The portal is one organizational system used by four internal audiences
(roles `staff` > `maker` > `checker` > `admin` are enforced server-side, see
`05-sds.md` §3.1 and `09-rbac-design.md`). Its only persistent dependencies
are the company PostgreSQL instance (content, sessions, users, and the
governance logs) and, operationally, whatever collects its stdout JSON logs
and scrapes `/healthz`. The public website appears in the model because the
portal's headline governance feature is the maker-checker workflow that
clears content *for* it — but the outbound arrow is dashed: as built the
workflow manages status and logs only, and the actual outbound HTTP call is
`[PLANNED]` (`05-sds.md` §8.1).

---

## 2. Container diagram (C4 Level 2)

```mermaid
flowchart TB
    browser["Browser<br/>React 19 SPA - Thai and English<br/>kbj_session cookie"]

    subgraph gw ["Express gateway - one Node.js process, port 3000, uid 10001"]
        api["JSON API<br/>/api/* routes<br/>session auth plus RBAC"]
        uploads["Upload file server<br/>/uploads/* read-only,<br/>1-day cache"]
        spa["SPA static hosting<br/>dist assets plus index.html fallback<br/>dev variant: Vite middleware with HMR"]
        repolayer["Repository layer<br/>single interface, selected at boot"]
    end

    subgraph stores ["Backing stores"]
        pg[("PostgreSQL 16<br/>when DATABASE_URL is set<br/>9 tables, pg Pool max 10")]
        mem["In-memory stores<br/>dev fallback<br/>seeded, reset on restart"]
        vol[("UPLOAD_DIR volume<br/>UUID-named files,<br/>10 MB per file, extension whitelist")]
    end

    browser -->|"fetch, same-origin,<br/>credentials included"| api
    browser -->|"GET uploaded files"| uploads
    browser -->|"SPA routes and assets"| spa
    api --> repolayer
    repolayer -->|"parameterized SQL, TCP 5432"| pg
    repolayer -->|"dev and demo mode"| mem
    uploads -->|"filesystem reads"| vol
```

Everything inside the dashed boundary ships in **one container image** and
runs as **one process** listening on one port: the JSON API, the read-only
upload file server, and (in production) the built SPA all share the Express
gateway. The repository layer is the only component that talks to storage;
it has two interchangeable implementations behind one interface — PostgreSQL
(production) and seeded in-memory maps (development/demo) — chosen at boot
from the presence of `DATABASE_URL` (`05-sds.md` §3.2). Uploaded files never
enter the database; they live on a volume under `UPLOAD_DIR`
(`/app/uploads` in containers). In development the same process instead
mounts the Vite middleware, so there is no separate frontend dev server.

---

## 3. Component diagram — server.ts (C4 Level 3)

```mermaid
flowchart TB
    req["Incoming request, port 3000"]

    subgraph mw ["Global middleware chain - registration order, runs for every request"]
        direction TB
        m1["1. body parsers - express.json and urlencoded, 10 MB limit"]
        m2["2. security headers - nosniff, SAMEORIGIN, XSS, referrer, permissions"]
        m3["3. JSON request logger - time, method, path, status, durationMs, ip"]
        m4["4. API resource-id guard - clean 400 for missing or empty ids"]
        m1 --> m2 --> m3 --> m4
    end

    subgraph rlm ["Route-level middleware - applied per route"]
        l1["loginLimiter - login route only,<br/>5 failed attempts per min per IP, draft-7 headers"]
        l2["requireAuth - cookie parse, HMAC verify timing-safe,<br/>session resolve, isActive check"]
        l3["requireRole - per-route RBAC allowlist"]
        l4["requireResourceId - blank id defense on :id routes"]
    end

    subgraph routes ["Route handler groups"]
        h0["probes - healthz, readyz"]
        h1["auth and users - login, logout, me,<br/>user create, activate or deactivate"]
        h2["news plus maker-checker - CRUD,<br/>submit-approval, approve, reject"]
        h3["CMS content - banners, contacts, documents"]
        h4["rooms - list, book, release"]
        h5["upload - multipart via multer"]
        h6["governance - audit-logs, sync logs,<br/>sync trigger, system export"]
        h7["contract - openapi.json"]
    end

    subgraph services ["Cross-cutting services"]
        s1["session core - bcrypt cost 12, HMAC-SHA256 sign,<br/>7-day TTL, hourly sweeper, dummy-hash defense"]
        s2["recordAudit - actor always from session"]
        s3["sync log writer"]
        s4["upload pipeline - whitelist, MIME sanity, UUID names"]
    end

    subgraph repo ["Persistence"]
        i0["Repository interface"]
        i1["PostgresRepository<br/>PG_DDL at boot, seed-if-empty, SELECT 1 health"]
        i2["InMemoryRepository<br/>dev fallback, audit capped 5000"]
    end

    out["Response - JSON envelope, success data or error"]
    tail["Tail of the stack - /uploads static, API 404 JSON fallback,<br/>final error handler, SPA static or Vite dev middleware"]

    req --> mw
    mw --> rlm
    rlm --> routes
    routes --> services
    routes --> i0
    services --> i0
    i0 --> i1
    i0 --> i2
    routes --> out
    mw --> tail
```

This is the internal anatomy of the single `server.ts` file
(`05-sds.md` §2.2–2.3 gives the line-level inventory). A request flows
through four global middleware stages in a fixed order (body limits, then
headers, then logging, then id-shape defense), then through whichever
route-level guards the matched route declares — the rate limiter only on
login, `requireAuth` + `requireRole` on every protected route, and
`requireResourceId` on `:id` mutations. Handlers contain no storage logic:
they call cross-cutting services (session core, audit writer, sync-log
writer, upload pipeline) and the `Repository` interface, which fronts either
the PostgreSQL or the in-memory implementation. The tail of the stack keeps
API 404s as JSON, normalizes all errors into one envelope, and finally
serves `/uploads` and the SPA (or Vite in dev).

**Maker-checker status state machine** (routes `h2` + services `s2`, `s3`;
full prose in `05-sds.md` §3.3). Since **W2-1** (FR-NEWS-009; DCR-3/DCR-7
closed, commit `22023eb`) there is exactly **one path to `synced`** — the
BOT-compliant dual-control path. The Wave-1 direct-publish bypass (PATH A,
DCR-3) that v1.0.0 drew is closed:

```mermaid
stateDiagram-v2
    [*] --> draft : POST /api/news, maker or admin, workflow fields stripped
    draft --> pending_approval : submit-approval, maker or admin, draft-only, stamps submittedBy and submittedAt
    pending_approval --> synced : approve, checker or admin, pending-only, submitter not approver, sync log CREATE
    pending_approval --> rejected : reject, checker or admin, pending-only, reason recorded
    pending_approval --> draft : edit, forced reset, AUD-P01
    synced --> draft : edit, forced reset, AUD-P01, drops from public set
    rejected --> draft : edit, forced reset, AUD-P01
    synced --> [*] : removed by admin DELETE
```

The four workflow fields (`externalSyncStatus`, `approvedBy`, `approvedAt`,
`syncToExternal`) are stripped from every create/update payload at the
validation layer (`stripNewsWorkflowFields`, server.ts L1288–1295) — no
role, admin included, can set publication state outside the checker approve
endpoint; submit-approval is legal from `draft` only, approve/reject from
`pending_approval` only, and the submitter may never approve their own
submission. Editing an item in any non-draft state resets it to `draft`
with the transition audited (AUD-P01). Decision record:
`05-sds.md` §3.3, §7 row 9, §8 row 0.

---

## 4. Deployment diagrams

### 4.1 Kubernetes (production target)

```mermaid
flowchart TB
    user["Staff browser"]

    subgraph cluster ["Kubernetes cluster - CNI must enforce NetworkPolicy"]
        subgraph nsingress ["ingress-nginx namespace"]
            ic["Ingress controller<br/>TLS termination, cert-manager letsencrypt"]
        end
        subgraph ns ["namespace kbj-intranet - default-deny ingress and egress"]
            ing["Ingress kbj-intranet-ingress<br/>hosts intranet and portal kbjcapital co th<br/>TLS secret, ssl-redirect, body size 25m"]
            svc["Service kbj-intranet-service<br/>ClusterIP, 80 to 3000"]
            subgraph dep ["Deployment kbj-intranet-portal - RollingUpdate maxUnavailable 0"]
                podA["Pod intranet-app<br/>uid 10001, read-only rootfs, caps dropped,<br/>tmp emptyDir, preStop sleep 5, grace 35 s"]
                podB["Pod intranet-app<br/>same hardening, anti-affinity preferred"]
            end
            hpa["HPA 2 to 10 replicas<br/>CPU target 75 pct, memory 80 pct"]
            pvc["PVC kbj-intranet-uploads<br/>5Gi ReadWriteOnce"]
            cm["ConfigMap kbj-intranet-config<br/>NODE_ENV, PORT, UPLOAD_DIR"]
            sec["Secret kbj-intranet-secret<br/>DATABASE_URL, SESSION_SECRET, ADMIN"]
            npol["NetworkPolicy allow-app-ingress<br/>only controller and same namespace on 3000<br/>NetworkPolicy allow-app-egress<br/>DNS 53 UDP TCP plus PostgreSQL 5432"]
        end
    end

    db[("PostgreSQL 16<br/>external company database")]

    user -->|"HTTPS 443"| ic
    ic -->|"HTTP 3000, allowed by policy"| ing
    ing --> svc
    svc --> podA
    svc --> podB
    cm -.->|"envFrom"| podA
    cm -.->|"envFrom"| podB
    sec -.->|"envFrom"| podA
    sec -.->|"envFrom"| podB
    podA -->|"read-write mounts, fsGroup 10001"| pvc
    podB -->|"RWO - same node only"| pvc
    podA -->|"SQL 5432, egress allowed"| db
    podB -->|"SQL 5432"| db
    hpa -.->|"scales"| dep
    npol -.->|"guards"| podA
```

Production runs as a hardened Deployment in the `kbj-intranet` namespace:
traffic enters only through the ingress controller (TLS terminates there),
reaches the ClusterIP Service, and load-balances across 2–10 identical pods
(HPA on CPU/memory; `maxUnavailable: 0` keeps rolling updates zero-downtime).
Each pod is non-root (uid/gid 10001), has an immutable root filesystem with
all capabilities dropped, and runs the exact same image as Docker Compose.
Readiness (`/readyz`) is repository-aware, so a database outage removes pods
from rotation without restarting them (`05-sds.md` §3.2). The default-deny
NetworkPolicies reduce the attack surface to: ingress from the controller and
same-namespace pods on 3000, egress to cluster DNS and PostgreSQL 5432.
The uploads PVC is **ReadWriteOnce** — it can attach to a single node, so the
scheduler tends to co-locate replicas (preferred anti-affinity, not required);
scaling beyond that needs RWX or object storage (`05-sds.md` §5.4, §8.4).

### 4.2 Docker Compose (single host)

```mermaid
flowchart TB
    user["Staff browser"]

    subgraph host ["Docker host - docker compose up -d --build"]
        subgraph appsvc ["service app - image kbj-intranet"]
            appc["container, uid 10001<br/>NODE_ENV production<br/>HEALTHCHECK wget /healthz every 30 s"]
            upl[("named volume uploads<br/>mounted at /app/uploads")]
        end
        subgraph dbsvc ["service postgres - postgres:16-alpine"]
            pgc["postgres, healthcheck pg_isready,<br/>port 5432 NOT published to host"]
            pgd[("named volume pgdata<br/>schema.sql applied on first boot only")]
        end
        net["internal compose network<br/>app waits for postgres service_healthy"]
    end

    user -->|"HTTP 3000 published"| appc
    appc -->|"DATABASE_URL to postgres 5432"| pgc
    appc --> upl
    pgc --> pgd
    appc --- net
    pgc --- net
```

The single-host alternative runs the same image beside a PostgreSQL 16
container on one Docker network. The compose file hard-requires
`SESSION_SECRET` and `ADMIN_PASSWORD` (it refuses to start half-configured),
gates app start on the postgres health check, and applies `scripts/schema.sql`
automatically **only** to a freshly created `pgdata` volume — later schema
changes are a deliberate manual step (`05-sds.md` §5.2, §8.2). The database
port is deliberately unreachable from outside the host.

---

## 5. Dynamic views — sequence diagrams

### 5.1 Login (rate limit, bcrypt, dummy-hash timing defense, session issue)

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser SPA
    participant L as loginLimiter
    participant H as login handler
    participant R as repository
    participant A as audit writer

    B->>H: POST /api/auth/login, username and password
    H->>L: check failed-attempt budget, 5 per min per IP
    alt budget exhausted
        L-->>B: 429 Too many login attempts, JSON body, draft-7 headers
    else within budget
        H->>R: findUserByUsername, case-insensitive
        alt user unknown
            H->>H: bcrypt compare against precomputed DUMMY hash, equal timing
        else user found
            H->>H: bcrypt compare against stored hash, cost 12
        end
        alt invalid, inactive, or unknown
            H->>A: LOGIN_FAILED, attempted username plus IP
            A->>R: insertAuditLog
            H-->>B: 401 Invalid credentials
        else credentials valid and active
            H->>R: insertSession, random 256-bit sid, 7-day expiry
            H->>A: LOGIN, actor plus role plus IP
            A->>R: insertAuditLog
            H-->>B: 200 SafeUser, Set-Cookie kbj_session sid.HMAC-SHA256, httpOnly SameSite-Lax Secure-in-prod
        end
    end
```

Login is the most defended single endpoint: the per-IP failure budget runs
before any credential work and only *failures* consume it, so brute force is
throttled while legitimate users never self-lockout. Unknown usernames are
compared against a precomputed dummy bcrypt hash so response timing cannot
enumerate accounts; deactivated accounts fail identically to wrong
passwords. On success the server stores a random session record and hands
the browser only an HMAC-signed, `httpOnly` cookie — every later request
re-resolves the session server-side, which is what makes deactivation
instant (`05-sds.md` §3.1). Both outcomes produce audit entries.

### 5.2 Maker-checker publish — the only path to live (submit → approve/reject → synced + audit)

```mermaid
sequenceDiagram
    autonumber
    participant M as Maker, role maker
    participant C as Checker, role checker
    participant G as Express gateway
    participant N as news store
    participant A as audit_logs
    participant S as sync_logs

    M->>G: POST /api/news, draft
    G->>G: requireRole maker or admin, stripNewsWorkflowFields
    G->>N: insertNews, always draft, syncToExternal false
    M->>G: POST /api/news/id/submit-approval
    G->>G: requireRole maker or admin, draft-only guard
    G->>N: saveNews, status pending_approval, syncToExternal forced false, submittedBy and submittedAt
    G->>A: SUBMIT_APPROVAL, actor maker, IP, status SUCCESS
    alt checker approves
        C->>G: POST /api/news/id/approve
        G->>G: requireRole checker or admin, pending-only guard, submitter not approver
        G->>N: saveNews, status synced, syncToExternal true, approvedBy, approvedAt
        G->>A: APPROVE, actor checker, IP, status SUCCESS
        G->>S: CREATE, item, target api.kbjcapital.co.th/v1/public/news
        G-->>C: 200 item plus audit entry
    else checker rejects
        C->>G: POST /api/news/id/reject, reason
        G->>G: requireRole checker or admin, pending-only guard
        G->>N: saveNews, status rejected, syncToExternal false, approvedBy records rejection
        G->>A: REJECT, actor checker, IP, status REJECTED
        G-->>C: 200 item plus audit entry
    end
    Note over G,S: as built, synced means status plus sync_logs entry only,<br/>no outbound HTTP call to the public site yet, PLANNED, doc 05 section 8.1
```

This is the **only** path to `synced` since W2-1 (FR-NEWS-009, DCR-3/DCR-7
closed, commit `22023eb`): the maker can never publish in one step —
create/update cannot set publication state (workflow fields stripped at the
validation layer) — and can never approve their own submission (`approve`/
`reject` require the `checker` or `admin` role and a different identity than
the submitter). The item is forced non-live while awaiting review, and the
checker's identity is stamped onto the item (`approvedBy`/`approvedAt`) and
into the audit trail on every transition; guard rejections and forced
edit-resets are also audited (AUD-P01). The sync-log row models the handoff
to the public site; the actual outbound webhook is `[PLANNED]` and will
require a new egress rule in the NetworkPolicy (`05-sds.md` §8.1).

### 5.3 Room booking

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser SPA
    participant G as Express gateway
    participant R as repository

    B->>G: GET /api/rooms, public, no auth
    G->>R: listRooms
    R-->>B: rooms with status and currentBooking
    B->>G: POST /api/rooms/id/book, topic and time, session cookie
    G->>G: requireAuth, resolve session user
    G->>R: findRoom
    alt room not available
        G-->>B: 400 Room is currently booked or under maintenance
    else available
        G->>R: saveRoom, status in-use, currentBooking topic booker-from-session time
        G-->>B: 200 updated room
    end
    B->>G: POST /api/rooms/id/release, session cookie
    G->>R: saveRoom, status available, booking cleared
    G-->>B: 200 released room
```

Room listings are public (the SPA renders the floor plan pre-login), but
booking and release require any authenticated staff member; the **booker
identity is taken from the resolved session**, never from the request body,
so one employee cannot book in another's name (`05-sds.md` §2.2, HANDOVER
§4). Availability is checked and written in one handler round-trip through
the repository; a room in `maintenance` or `in-use` is rejected with a clean
400.

### 5.4 File upload

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser SPA
    participant G as Express gateway
    participant MU as multer pipeline
    participant V as UPLOAD_DIR volume
    participant A as audit_logs

    B->>G: POST /api/upload, multipart field file
    G->>G: requireAuth plus requireRole maker checker admin
    G->>MU: accept single file
    MU->>MU: fileFilter, extension whitelist, jpg jpeg png webp gif pdf docx xlsx
    MU->>MU: declared MIME sanity versus extension
    MU->>MU: fileSize limit 10 MB
    alt rejected
        MU-->>G: error, wrong type or LIMIT_FILE_SIZE
        G-->>B: 400 type not allowed, or 413 exceeds the 10MB limit
    else accepted
        MU->>V: write as random-UUID.ext, client filename discarded
        G->>A: FILE_UPLOAD, actor, original name, size, IP
        G-->>B: 201 data url /uploads/uuid.ext plus fileName plus size
    end
    Note over B,V: files served back read-only from /uploads with 1-day cache,<br/>nosniff header, no directory index
```

Uploads pass four independent gates before any byte is stored: role, size,
extension whitelist, and declared-MIME sanity (with `octet-stream` tolerated
for Office documents because browsers send it). Names are replaced with
random UUIDs so the client filename never reaches the filesystem — killing
traversal, collision, and executable-extension risks in one rule — and every
successful upload is audited with actor, original name, stored name, and
size (`05-sds.md` §3.4).

### 5.5 Graceful shutdown

```mermaid
sequenceDiagram
    autonumber
    participant K as kubelet, SIGTERM
    participant P as pod, preStop hook
    participant N as node process
    participant S as HTTP server
    participant D as pg pool

    K->>P: pod deletion or rolling update
    P->>P: preStop sleep 5, endpoint removal propagates
    K->>N: SIGTERM
    N->>N: stop hourly session sweeper
    N->>S: server.close, stop accepting, drain in-flight requests
    S->>D: repo.close, pool.end
    N-->>K: exit 0, clean
    Note over K,N: terminationGracePeriodSeconds 35 overall,<br/>in-process 10 s force-exit backstop if connections hang
```

Rolling updates and node drains lose no requests: Kubernetes removes the pod
from endpoints and the `preStop` hook waits 5 s for that to propagate before
SIGTERM even arrives; the process then drains in-flight work, closes the
database pool, and exits 0. A 10-second in-process backstop guarantees
termination even with hung connections, well inside the 35-second grace
period (`05-sds.md` §5.5).

---

## 6. Data-flow diagram (incl. PDPA-relevant flows)

```mermaid
flowchart LR
    subgraph people ["Data subjects and actors"]
        p1["Employees<br/>username, password, IP"]
        p2["Makers and checkers<br/>content and decisions"]
        p3["Staff directory entries<br/>name, position, phone, email"]
        p4["Uploaded files<br/>images and documents"]
    end

    subgraph edge ["Trust boundary - TLS ingress"]
        tls["nginx ingress, TLS 1.2 plus, cert-managed"]
    end

    subgraph app ["KB J Intranet Portal - namespace kbj-intranet, default-deny"]
        gw["Express gateway"]
        anonout["Anonymous reads<br/>news, banners, rooms, tools"]
        authout["Authenticated reads<br/>directory, documents"]
        logstream["stdout JSON logs<br/>time, method, path, status, ip"]
    end

    subgraph datastores ["PostgreSQL 16"]
        users["users table - PII<br/>username, display name, email,<br/>role, bcrypt password hash"]
        sess["sessions table<br/>sid, user id, expiry"]
        cont["content tables - news, banners,<br/>contacts PII, documents, rooms"]
        audit["audit_logs - PII flow<br/>actor, actor role, action,<br/>details, ip_address"]
        sync["sync_logs"]
    end

    subgraph governance ["Governance consumers"]
        checker["Checkers, audit review<br/>GET /api/audit-logs, checker plus"]
        dpo["DPO and retention ops<br/>deactivate never delete,<br/>manual retention planning"]
    end

    p1 -->|"credentials over TLS only"| tls
    p2 -->|"content and approvals over TLS"| tls
    p3 -->|"directory data"| tls
    p4 -->|"multipart upload, whitelisted"| tls
    tls --> gw
    gw -->|"bcrypt hash before store"| users
    gw -->|"HMAC-signed sid only"| sess
    gw --> cont
    gw -->|"actor stamped from session"| audit
    gw -->|"publish handoff records"| sync
    gw --> anonout
    gw --> authout
    gw --> logstream
    audit -->|"checker plus only"| checker
    users -.->|"accounts deactivated, never deleted,<br/>audit-trail integrity"| dpo
    logstream -.->|"IPs present, aggregate retention<br/>is an operator responsibility"| dpo
```

PDPA-relevant personal-data flows are called out explicitly. Direct PII
rests in three places: the `users` table (identity, role, and a bcrypt hash —
never a plaintext password), the `contacts` content table (business contact
details), and `audit_logs` (actor identity plus client IP per sensitive
action). Two secondary flows carry IPs: the append-only audit trail (which is
the accountability record PDPA asks for) and the operational stdout JSON
request log. Mitigations as built: TLS-only ingress, `httpOnly` session
cookies so PII-bearing tokens are script-invisible, actor names stamped
server-side (never client-supplied), audit access restricted to `checker`
and above, and accounts deactivated rather than deleted so audit references
stay resolvable — deliberate retention planning remains an operator duty
(`05-sds.md` §6.5, `10-audit-log-design.md`). Anonymous visitors can only
ever receive the public read flows (news, banners, rooms, tools), never
directory or document data.

---

## Appendix — diagram inventory and source mapping

| Diagram | Source of truth |
|---|---|
| §1 System context | `HANDOVER.md` §1–§2; `README.md` §6; roles in `server.ts` `ROLE_LABELS` L1392 |
| §2 Container | `server.ts` L37–46, L2537–2628; `src/api.ts`; `Dockerfile` |
| §3 Component | `server.ts` middleware L44–113, auth L1134–1370, routes L1410–2436, repos L135–1130 (`05-sds.md` §2.2–2.3) |
| §3 State machine | `server.ts` L1288–1295 (workflow-field strip), L1477–1788 (news routes incl. submit-approval/approve/reject); `src/types.ts` `externalSyncStatus` |
| §4.1 Kubernetes | `k8s/deployment.yaml`, `hpa.yaml`, `ingress.yaml`, `networkpolicy.yaml`, `pvc.yaml`, `service.yaml`, `configmap.yaml` |
| §4.2 Compose | `docker-compose.yml`; `README.md` §2 |
| §5.1 Login | `server.ts` L1211–1240 (`requireAuth`), L1356–1370 (`loginLimiter`), L2014–2058 (login route) |
| §5.2 Maker-checker | `server.ts` L1618–1788 (submit-approval/approve/reject) |
| §5.3 Room booking | `server.ts` L1881–1918 (rooms + book/release) |
| §5.4 File upload | `server.ts` L2166–2261 |
| §5.5 Graceful shutdown | `server.ts` L2595–2628; `k8s/deployment.yaml` L39, L129–132 |
| §6 Data-flow | `scripts/schema.sql` (PII columns); `server.ts` L58–79 (logs), L1372–1408 (audit); `k8s/networkpolicy.yaml` |

*End of Deliverable 6. Prose specification: `05-sds.md`.*
