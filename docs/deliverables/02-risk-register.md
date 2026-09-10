# Risk Register — KB J Capital Intranet Rebuild

**Version:** 1.2.0 · **Status:** Draft · **Date:** 2026-09-10 · **Author:** worker-1 → Lead review → CTO approval

> **Change log:** 1.2.0 — added RISK-022 (DCR-7, dual-control state-machine bypass) and RISK-023 (DCR-8, audit-trail fabrication) per CTO gate REVISE Blocker 3; register now 23 risks. 1.1.0 — added RISK-021 (maker-checker bypass on `/api/news`, verified at `server.ts:1306`), lead-triaged as DCR-3, pending CTO ratification at the Wave-1 gate. 1.0.0 — initial register (20 risks).

> Companion to `docs/deliverables/01-project-plan.md`. Seeded from the
> documented limitations (README §8, HANDOVER §10) plus delivery, security,
> compliance, and operational risks identified for the wave-based rebuild.
> Owners map to the PROJECT-STATE.md §1 roster (CTO = codex gate, Lead, 5
> workers) and to the IT administrator who operates the deployment.

## 1. Methodology

- **Likelihood (L):** H = expected to occur / already the as-built state, M = plausible during the project, L = unlikely.
- **Impact (I):** H = blocks a gate, breaches compliance, or loses data; M = degrades service or schedule; L = cosmetic/minor rework.
- **Score = L × I** on a 3-point scale (H=3, M=2, L=1): **9 critical**, **6 high**, **4 medium**, **3 / 2 / 1 low**.
- **Review cadence:** re-scored by the Lead at every wave boundary and at each
  CTO gate; changes recorded in the PROJECT-STATE.md decision log when a risk
  changes tier or an owner changes.
- **Status values:** Open (no mitigation yet), Mitigating (control in force,
  risk not retired), Accepted (documented tradeoff), Planned (mitigation
  scheduled in a wave).

## 2. Risk register (ordered by score, descending)

| Risk ID | Description | Category | L | I | Score | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| RISK-001 | Outbound public-web sync is modelled, not wired: sync statuses, logs, and `/api/sync/trigger` drive the state machine but no outbound HTTP call to the public website is performed (README §8, HANDOVER §10). The intranet UI optimistically shows "synced to www.kbjcapital.co.th" without a real transfer. | technical | H | H | **9** | Wave 2 objective O3: implement the real webhook/integration, add the required egress NetworkPolicy rule, and make UI state derive from server truth; auth/security lane → codex PASS required. | Lead (decomposition) + worker lane | Planned |
| RISK-021 | Maker-checker bypass: `POST /api/news` (and `PUT /api/news/:id` via body spread) accepts `syncToExternal: true` from a maker and stamps `externalSyncStatus: 'synced'` directly (`server.ts:1306`), skipping the `submit-approval` → checker `approve` step — a BOT dual-control violation. *(Added via DCR-3, CTO-ratified at gate 1.)* | compliance | H | H | **9** | Wave-2 **P0** enforcement fix, bundled with DCR-7 (RISK-022) as ONE work item per CTO: server forces `pending_approval` on any external-publish intent instead of trusting client-supplied sync flags (both POST and PUT paths); extend audit-log coverage to capture the forced transition; add TC-SEC regression tests proving a maker cannot reach `synced` without checker approval. Auth/security lane → codex PASS mandatory. | Lead (fix) / CTO gate | Open — DCR-3 |
| RISK-022 | Dual-control state-machine bypass: `submit-approval` accepts ANY current state — no draft-only guard (`server.ts:1384`); `approve`/`reject` have no `pending_approval` precondition (`server.ts:1407`/`1444`) so content can be approved from any state; and `PUT /api/news/:id` spreads `req.body` over the workflow fields, overwriting `approvedBy`/`approvedAt` (`server.ts:1338-1342`) — approval stamps are forgeable by a plain update. BOT dual-control violation. *(Added via DCR-7, CTO gate REVISE Blocker 3.)* | compliance | H | H | **9** | Wave-2 **P0** enforcement bundle WITH DCR-3 (one work item per CTO): allow only legal transitions (`draft`→`pending_approval`→`synced`\|`rejected`); guard `submit-approval` to `draft`; strip workflow fields (`externalSyncStatus`, `syncToExternal`, `approvedBy`, `approvedAt`) from PUT bodies; enforce approver ≠ submitter; codex PASS mandatory. | Lead (fix) / CTO gate | Open — DCR-7 |
| RISK-023 | Audit-trail fabrication: `POST /api/audit-logs` (`server.ts:1670`, admin) appends rows with arbitrary client-supplied `action`/`details`/`status` into the audit store — directly under the section comment claiming "Immutable Enterprise Audit Logs" (`server.ts:1665`). The audit trail is therefore not append-only/trustworthy, undermining PDPA/BOT accountability evidence. *(Added via DCR-8, CTO gate REVISE Blocker 3.)* | compliance | H | H | **9** | CTO ruled **PREFER REMOVAL** of the endpoint over restriction in the Wave-2 P0 lane: audit entries must be generated only server-side by `recordAudit` on real actions; verify GET-only surface afterwards. Codex PASS mandatory. | Lead (fix) / CTO gate | Open — DCR-8 |
| RISK-002 | Doc/code drift: deliverable docs (Wave 1) diverge from the codebase as Wave 2 proceeds, defeating the doc-first control. | project | M | H | 6 | DCR process is mandatory (PROJECT-STATE §7): doc problem → DCR to Lead → CTO decides → doc revised FIRST with version bump → coding resumes; Lead consistency review before every gate. | Lead | Mitigating |
| RISK-003 | Kubernetes NetworkPolicies (default-deny, ingress/egress limits) are only as good as the CNI: on a non-enforcing CNI the namespace's network isolation silently does not exist. | security | M | H | 6 | Verify CNI enforcement (e.g., Calico/Cilium with NetworkPolicy support) as a deployment precondition; retest isolation during Wave 3 VA; document in deliverable 16/19. | Lead + IT admin | Open |
| RISK-004 | Secrets handling: `SESSION_SECRET`, `ADMIN_PASSWORD`, DB credentials and `k8s/secret.yaml` (created from `secret.example.yaml`) could be committed, logged, or left weak; a leak enables session forgery or admin takeover. | security | M | H | 6 | Secrets only via environment/K8s Secret (never baked into the image; `.dockerignore` excludes env files); `SESSION_SECRET` mandatory in production (process exits without it); secrets scan is a standing merge gate; rotation runbook in deployment package. | Lead (gate) + IT admin (ops) | Mitigating |
| RISK-005 | Bootstrap admin uses a documented default password (`ChangeMe@KBJ2026!`) created whenever the users store is empty; a default-password instance exposed beyond localhost is an instant compromise. | security | M | H | 6 | Production deployment checklist must set a strong `ADMIN_PASSWORD`/`ADMIN_USERNAME` before first exposure; verify no default-credential login survives into prod during UAT; change-after-first-login guidance in the user manual. | IT admin + Lead | Open |
| RISK-006 | Upload volume durability: uploaded files live on a single ReadWriteOnce PVC (`kbj-intranet-uploads`, 5Gi) with no documented backup or replication; volume loss or node failure orphans all uploaded attachments. | operational | M | H | 6 | Define backup/restore for the uploads PVC (snapshots or sync to object storage) before cutover; long-term move to RWX/object storage when scaling out (HANDOVER §10). | IT admin + Lead | Open |
| RISK-007 | Database backup/DR undefined: PostgreSQL data sits in the compose `pgdata` volume / managed DB with no documented backup schedule, restore test, or RPO/RTO. | operational | M | H | 6 | Document and rehearse a backup + restore procedure (pg_dump schedule + restore drill) in the deployment package; include restore test in Wave 3 system test. | IT admin | Open |
| RISK-008 | Manual schema upgrades: the postgres init-once mechanism only applies `schema.sql` to an empty volume; upgrades on existing databases are manual `psql` steps and can be forgotten or misapplied. | operational | H | M | 6 | Ship migration discipline in Wave 2 (numbered, idempotent migrations like `scripts/schema.sql` + `scripts/migrate.js`); upgrade runbook in deliverable 16; schema drift check in the deployment checklist. | Lead + worker lane | Planned |
| RISK-009 | RWO PVC blocks multi-replica scheduling: deployment runs 2 replicas with HPA 2→10, but a second pod on another node stays Pending while the PVC is attached (README §8, `k8s/pvc.yaml`); autoscaling silently caps at one writer per node. | operational | H | M | 6 | Accept for cutover (single-writer works); pin scaling expectations in the runbook; move to RWX/object storage before true scale-out (pairs with RISK-006). | Lead | Accepted (interim) |
| RISK-010 | Per-pod rate limiting: login throttling (5 attempts/min/IP) and failed-login tracking are in-memory per process; with replicas behind an ingress an attacker distributes guesses across pods, weakening brute-force protection. | security | M | M | 4 | Document the limitation; if stricter enforcement is required, add consistent hashing at ingress or a shared store (README §8); reassess after RISK-009 scale-out decision. | Lead + IT admin | Accepted (interim) |
| RISK-011 | Accounts deactivated, never deleted (audit-trail integrity): retired employees remain in the directory/user list indefinitely; PDPA data-retention obligations for personal data (directory entries, audit actor names) are unaddressed. | compliance | M | M | 4 | Define a retention/de-identification policy for deactivated accounts and directory personal data; record PDPA basis in deliverables 09/10; IT admin reviews the deactivated list quarterly. | IT admin + Lead | Open |
| RISK-012 | Worker-tier quality: executor workers (sonnet/flash class) implement most code; a misunderstood doc or shallow fix can pass surface checks while breaching intent, especially in auth/security/data lanes. | project | M | M | 4 | Merge gates (tsc, smoke tests, build, secrets scan) on every merge; codex PASS mandatory for auth/security/data lanes; escalation ladder (worker >3 retries → lead ≤3 → CTO); Lead review before every merge. | Lead | Mitigating |
| RISK-013 | Single-lead merge bottleneck: one Lead reviews and merges everything; a large Wave-2 backlog or Lead unavailability stalls all lanes. | project | M | M | 4 | Batch reviews at fixed points; wave board keeps parallel workers unblocked on independent files; PROJECT-STATE.md resume procedure allows session continuity; CTO can be pulled in for hard blocks. | Lead | Mitigating |
| RISK-014 | Upload content safety: uploads are gated by size (10 MB) and extension whitelist only (.jpg .jpeg .png .webp .gif .pdf .docx .xlsx); no malware scanning, and extension checks do not validate file content. | security | M | M | 4 | Serve uploads read-only from `/uploads/*` (as built); assess AV scanning (e.g., ClamAV sidecar) before or shortly after cutover; include upload abuse cases in the VA scope (deliverable 19). | Lead + IT admin | Open |
| RISK-015 | No standing CI pipeline: merge gates (tsc, smoke, build, secrets scan) are executed manually per merge; a skipped step breaks the gate guarantee. | project | M | M | 4 | Wire the existing checks (`npm run lint`, `scripts/smoke-test.mjs`, `npm run build`) into a pipeline/pre-merge script during Wave 2 so gates are deterministic rather than procedural. | Lead | Planned |
| RISK-016 | Late security findings: VA/pentest (Wave 3, deliverable 19) discovering architectural issues forces rework after implementation is "done". | project | M | M | 4 | Security design reviewed at the Wave-1 doc gate (RBAC design 09, audit log design 10); run smoke-level security tests during Wave 2; remediation window reserved in the schedule (O5). | Lead + CTO | Open |
| RISK-017 | Session store in the database: sessions persist server-side in the `sessions` table with 7-day expiry; a stolen DB dump contains live session identifiers (replay), and DB unavailability logs everyone out simultaneously. | security | L | H | 3 | Sessions are HMAC-SHA256 signed with `SESSION_SECRET`; restrict DB access via NetworkPolicy egress limits (as built); plan session invalidation/rotation on secret change; document that a DB compromise implies session invalidation response. | Lead | Open |
| RISK-018 | Accidental in-memory mode in production: if `DATABASE_URL` is missing the server silently runs with seeded in-memory stores — data resets on restart and looks functional in a smoke test. | operational | L | H | 3 | Deployment checklist requires `DATABASE_URL` verification; runbook symptom table already documents "data resets after restart"; add a startup banner/health distinction if needed in Wave 2. | IT admin | Open |
| RISK-019 | Bilingual (Thai/English) drift: user-facing strings are authored inline as "ไทย / English" pairs without an i18n framework; new screens or rush fixes may ship English-only or with inconsistent Thai. | operational | M | L | 2 | Doc convention keeps Thai-first for quoted UI strings (PROJECT-STATE §7); UI prototype doc (11) records the bilingual pattern; Lead review checks new user-facing strings. | Lead + workers | Mitigating |
| RISK-020 | Key-person dependency on the Lead session: project memory lives in PROJECT-STATE.md maintained by one Lead session; loss of continuity (compaction, session loss) risks decisions living only in transcripts. | project | L | M | 2 | Second-brain protocol is already binding: PROJECT-STATE.md updated at every stage transition; decision log append-only; resume procedure (§6) reconstructs state from the file, not memory. | Lead | Mitigating |

## 3. Heat-map summary

Counts of register entries by likelihood × impact (L/I):

| | **I = Low** | **I = Medium** | **I = High** |
|---|---|---|---|
| **L = High** | — | 2 (RISK-008, RISK-009) | 4 (RISK-001, RISK-021, RISK-022, RISK-023) |
| **L = Medium** | 1 (RISK-019) | 7 (RISK-010…016) | 6 (RISK-002…007) |
| **L = Low** | — | 1 (RISK-020) | 2 (RISK-017, RISK-018) |

Reading of the map:

- **4 critical (score 9):** RISK-001 (sync not wired) is both certain as
  built and core to the product promise — it is the primary Wave-2 objective
  (O3). RISK-021 (maker-checker bypass), RISK-022 (dual-control state-machine
  bypass), and RISK-023 (audit-trail fabrication) are compliance violations
  present in the as-built API. Per the CTO gate ruling, DCR-3 + DCR-7 ship as
  ONE Wave-2 **P0** enforcement work item (legal transitions only, workflow
  fields stripped, approver ≠ submitter), with DCR-8's audit-endpoint removal
  in the same P0 lane; codex PASS is mandatory for all three.
- **8 high (score 6):** dominated by security (secrets, bootstrap admin, CNI)
  and operational durability (uploads, DB backup) gaps that must be closed
  with runbooks or code before cutover; plus the two scheduling constraints
  (manual schema upgrades, RWO scaling) that are accepted only as interim.
- **7 medium (score 4):** process risks (worker quality, lead bottleneck, no
  CI, late findings) and hardening items (rate limiting, retention, upload
  safety) — all carry active or planned controls.
- **4 low (score ≤3):** monitored; none currently justifies schedule impact.

Top actions for the next wave boundary: schedule the Wave-2 **P0 compliance
bundle** first — RISK-021 + RISK-022 as one enforcement work item
(DCR-3/DCR-7) plus RISK-023 audit-endpoint removal (DCR-8); then confirm
RISK-003 CNI enforcement, close RISK-005/006/007 in the deployment runbook,
and decompose RISK-001 into Wave-2 tasks with codex-gated acceptance.

## 4. References

- `README.md` §8 (Known limitations), §3–4 (deployment, environment)
- `HANDOVER.md` §10 (Known limitations & follow-ups), §8–9 (deployment, security)
- `docs/deliverables/01-project-plan.md` §2 (objectives O3/O5), §9 (constraints/assumptions)
- `PROJECT-STATE.md` §1 (roster/escalation), §5 (git protocol & merge gates), §7 (doc conventions/DCR)
