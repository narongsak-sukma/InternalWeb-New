# Project Plan — KB J Capital Intranet Rebuild

**Version:** 1.0.0 · **Status:** Draft · **Date:** 2026-09-10 · **Author:** worker-1 → Lead review → CTO approval

> This plan governs the rebuild of the KB J Capital corporate intranet portal
> that replaces the outdated legacy intranet web. The project runs doc-first:
> the CTO must approve the deliverable-document plan BEFORE any vibe coding
> (PROJECT-STATE.md §2). The system itself already exists as a working
> baseline on branch `feature/wave1-deliverable-docs`; this plan describes how
> that baseline is documented, hardened, completed, tested, and shipped.

---

## 1. Executive summary

KB J Capital Co., Ltd. operates an outdated legacy intranet web that no longer
meets the needs of a BOT-supervised personal-loan provider: content publishing
is manual, there is no controlled path from internal announcements to the
public website (www.kbjcapital.co.th), and compliance cannot evidence who
published what.

This project replaces the legacy intranet with a single-process full-stack
portal **already built as a working baseline** in this repository:

- **Frontend:** React 19 + Vite 6 + Tailwind CSS 4 Thai/English SPA with
  exactly three views (Intranet portal / Admin CMS / External Web Sync) plus an
  anonymous login screen.
- **Backend:** Express 4 TypeScript gateway (`server.ts`) serving the JSON API,
  uploaded files, and the built SPA from one port (3000).
- **Data:** PostgreSQL 16 when `DATABASE_URL` is set; seeded in-memory stores
  otherwise (dev mode only).
- **Governance features as built:** session auth with bcrypt (cost 12), a
  four-role RBAC hierarchy (`admin` > `checker` > `maker` > `staff`), a
  maker-checker approval workflow for public-web publishing, and an
  actor-stamped append-only audit trail supporting BOT governance and PDPA
  B.E. 2562 accountability.
- **Ops assets as built:** multi-stage non-root Dockerfile, docker-compose
  (app + PostgreSQL 16), hardened Kubernetes manifests (`k8s/`) applied via
  Kustomize, `deploy-k8s.sh`, `scripts/schema.sql`, `scripts/migrate.js`,
  `scripts/smoke-test.mjs`, `tests/e2e-walkthrough.mjs`.

The rebuild proceeds in waves: Wave 0 (governance — completed 2026-09-10),
Wave 1 (twelve deliverable documents, this document included), Wave 2
(implementation of remaining scope from the approved docs), Wave 3 (system
test, UAT, VA/pentest, remediation, user manual), then deployment and
hypercare. Every gate and merge passes a CTO verdict (codex CLI, read-only).

## 2. Objectives (SMART)

| # | Objective | Specific measure | Target |
|---|---|---|---|
| O1 | Produce the complete Wave-1 deliverable document set | Deliverables 01–12 authored, cross-reviewed by Lead, APPROVED verdict from CTO gate | 12/12 docs approved by 2026-09-15 |
| O2 | Complete implementation per approved docs on `develop` | All Wave-2 feature tasks merged through Lead review; merge gates green (`tsc --noEmit`, smoke tests, build, secrets scan) on every merge | 100% of merges gated by 2026-10-07 |
| O3 | Wire the outbound public-web sync (currently modelled, not wired — README §8) | `/api/sync/trigger` performs a real outbound call to the public-site endpoint with egress NetworkPolicy rule; sync logs reflect server truth | CTO PASS on auth/security lane by 2026-10-07 |
| O4 | Pass system test and UAT | Deliverables 17 (System Test Result) and 18 (UAT Result): zero open critical defects, ≥90% test-case pass rate | by 2026-10-28 |
| O5 | Clear the security gate | Deliverable 19 (VA/Pentest Report) + 20 (Security Remediation): all critical/high findings remediated and re-tested | by 2026-10-28 |
| O6 | Publish the User Manual | Deliverable 21 (Thai/English user manual) approved by Lead + CTO | by 2026-10-28 |
| O7 | Production cutover with hypercare | Deployment on the company Kubernetes cluster (intranet.kbjcapital.co.th / portal.kbjcapital.co.th), 2-week hypercare with <3 P1 incidents | cutover 2026-10-30; hypercare ends 2026-11-13 |

All target dates are planning targets relative to the project start date
2026-09-10 and remain subject to CTO gate outcomes; slipping a gate moves the
downstream dates at the Lead's discretion, recorded in the CTO decision log.

## 3. Scope

### 3.1 In scope (as built or planned)

| Area | Delivered capability (source) |
|---|---|
| Internal communications | News & announcements with categories (KBJ news, NCB news, BOT news, regulation, HR announcement, money tips, lifestyle), urgent alert flagging, hero banner carousel (README §5; `src/types.ts`) |
| Staff directory | Internal telephone directory with Thai/English names, extensions, departments, floors (`DirectoryAndRooms.tsx`) |
| Meeting rooms | Room listing (14th–15th floors) with booking and release control (`POST /api/rooms/:id/book\|release`) |
| Policy documents | Governance/policy/work-rules/forms/handbook repository with version, size, download (`GovernanceAndPolicies.tsx`) |
| Quick tools | Links to HR System, IT-Request, KB J-E-DMS, Meeting Room Booking, Kashjoy Core Portal, public website (`QuickToolsBar.tsx`, `src/data/initialData.ts`) |
| CMS | Self-service Admin CMS (maker+): news studio with maker-checker flow, banner manager, directory editor, document upload (`POST /api/upload`, 10 MB, extension whitelist), room status control |
| User management | Admin-only User Management tab: list / create / activate / deactivate accounts (deactivation only — accounts are never deleted, for audit-trail integrity) |
| Public web sync | Maker-checker publishing (`submit-approval` → `approve`/`reject`), sync status model, sync log view, External Web Sync preview view; **outbound HTTP call [PLANNED] Wave 2** |
| Compliance | Checker+ audit trail view (actor, action, target, IP, result); admin system export (`GET /api/system/export`) |
| AuthN/AuthZ | Session cookie auth (httpOnly, SameSite=Lax, Secure in prod, 7-day server-side expiry), bcrypt cost 12, login rate limit 5/min/IP, RBAC matrix (HANDOVER §4) |
| Platform | Docker/compose/Kubernetes deployment assets, health probes, graceful shutdown, JSON request logging, security headers |

### 3.2 Out of scope (current plan)

- Native mobile applications (the SPA is responsive; no app store build).
- SSO / LDAP / Active Directory integration — local username/password accounts
  only, provisioned by the admin via the CMS.
- Self-service password reset or email-based recovery — not implemented; only
  an admin can act on accounts.
- Account deletion — by design (deactivate only; README §8).
- Dark mode and a formal i18n framework — Thai/English strings are authored
  inline (see 11-ui-prototype.md §6).
- Object storage / RWX migration for uploads — tracked as risk RISK-006, not
  scheduled before cutover.
- Migration of legacy intranet content in bulk — content enters via the CMS or
  the documented export/import path (`scripts/migrate.js` reads
  `payload.tables` from `GET /api/system/export` output).
- Legacy intranet decommissioning work beyond cutover (handled by IT ops
  outside this project team).

## 4. Stakeholders

| Stakeholder | Portal role | Interest / responsibility |
|---|---|---|
| KB J Capital staff (all employees) | `staff` | Read authenticated content, book/release meeting rooms; primary daily users of the portal |
| Department content makers | `maker` | Create/edit news, banners, contacts, documents; submit for approval; upload files |
| Compliance officers | `checker` | Approve/reject public-sync submissions; review the audit trail (BOT/PDPA accountability) |
| IT administrator | `admin` | User account lifecycle, deletes, full-sync operations, system export; runs deployment |
| Public website audience | — (indirect) | Consumers of content cleared through the maker-checker flow to www.kbjcapital.co.th |
| Project CTO (codex CLI gate) | — | Final APPROVE/REVISE/REJECT verdict on every gate and merge; auth/security/data lanes never merge without codex PASS |
| Project Lead / PM | — | Decomposition, task board, routing, triage, review + merge; sole channel for user directives; sole merge authority |
| Development workers ×5 | — | Executor agents implementing exactly per docs; never edit docs, never merge, never commit |
| Bank of Thailand (context) | — | Financial-institution governance expectations; the maker-checker dual control and actor-stamped audit trail are the supporting controls |
| PDPA regime (context) | — | Thailand Personal Data Protection Act B.E. 2562 (2018): accountability, audit trail, personal-data handling in the directory and audit logs |

## 5. Phase plan (waves) and milestones

The project runs in waves defined in PROJECT-STATE.md §3. Wave 0 completed on
the start date; all later dates below are targets relative to 2026-09-10.

| Phase | Wave | Content | Milestone / exit criterion | Target dates |
|---|---|---|---|---|
| Governance | 0 | Branches (`main` pristine, `develop` integration, `feature/*`), PROJECT-STATE.md second brain, wave board, CTO decision log | Charter CHARTERED; board operational | **Done 2026-09-10** |
| Deliverable docs | 1 | Deliverables 01–12 authored by the 5 workers in parallel lanes (PM/UI, requirements, architecture, data/API, security/QA) | All 12 docs written | 2026-09-10 → 2026-09-12 |
| Doc consolidation | 1 (tail) | Lead review of the doc set: consistency, cross-references, no divergence | Lead review complete | by 2026-09-14 |
| Doc gate | 1 (gate) | CTO gate: deliverable docs reviewed by codex (read-only) | CTO verdict APPROVE | by 2026-09-15 |
| Implementation | 2 | Implementation waves decomposed from approved docs (incl. outbound sync wiring O3, remediation of doc-flagged gaps); merge gates on every merge | All Wave-2 tasks merged green on `develop` | 2026-09-16 → 2026-10-07 |
| Test & assurance | 3 | System test (17), UAT (18), VA/pentest (19), security remediation (20), user manual (21) | Deliverables 17–21 approved; zero critical defects | 2026-10-08 → 2026-10-28 |
| Deployment | — | Image build/push, k8s secret provisioning, `./deploy-k8s.sh` rollout, smoke verification in prod | Production live on intranet.kbjcapital.co.th / portal.kbjcapital.co.th | 2026-10-29 → 2026-10-30 |
| Hypercare | — | Two weeks of elevated monitoring, incident triage, quick fixes via the same gate discipline | <3 P1 incidents; handover to IT ops | 2026-10-31 → 2026-11-13 |

Dependencies: Wave 2 is blocked by the Wave-1 CTO gate; Wave 3 is blocked by
Wave 2; deployment is blocked by deliverables 17–20 being approved.

## 6. Team organization and RACI

### 6.1 Organization (PROJECT-STATE.md §1, binding)

| Tier | Role | Runtime | Responsibility |
|---|---|---|---|
| Top | CTO | codex CLI 0.153.4, `--sandbox read-only` | FINAL verdict APPROVE/REVISE/REJECT on every gate/merge; auth/security/data lanes never merge without codex PASS |
| Middle | Lead / PM / Senior Dev | glm-5.3 session | Decomposition, task board, routing, triage, review + merge; sole channel for user directives; sole merge authority |
| Worker ×5 | Dev positions | executor agents, sonnet tier | Implement exactly per docs. Never edit docs, never merge, never commit to `develop` |

Model routing (binding): deterministic checks first (tsc/tests/git — free) →
worker tier (80% of tokens) → lead tier (20%) → codex ONLY at milestone gates
and hard blocks. Escalation ladder: worker fails >3 retries → middle tier
retries ≤3 → CTO solves directly.

### 6.2 RACI

R = Responsible, A = Accountable, C = Consulted, I = Informed.

| Activity | CTO | Lead | Workers |
|---|---|---|---|
| Project charter & wave model | A | R | I |
| Deliverable docs 01–12 (Wave 1) | A (gate) | C (conventions) + R (review) | R (own files) |
| DCR decisions (doc/code contradictions) | A (decides) | R (files, revises docs) | C (reports findings) |
| Implementation tasks (Wave 2) | A (gates, hard lanes) | R (review + merge) | R (code) |
| Merge to `develop` / branches | I | A/R (sole authority) | — (never) |
| Auth/security/data lane merges | A (codex PASS required) | R | R (code only) |
| System test / UAT execution (Wave 3) | A (gate) | R | R |
| VA/pentest remediation | A | R | R |
| Deployment & cutover | A (approval) | R | C |
| Hypercare triage | I | A/R | R |

## 7. Communication and reporting

- **Second brain:** `PROJECT-STATE.md` is the single resume point for every
  session; the Lead updates and commits it at every stage transition. It
  carries the wave board (§3), the 21-deliverable checklist (§2), and the git
  protocol (§5).
- **CTO decision log:** append-only table in PROJECT-STATE.md §4; every gate
  verdict and binding decision is recorded there with a date.
- **Worker reporting:** each worker reports completion or blockage directly to
  the Lead (task claim → result, files, evidence, DCRs found); workers never
  report around the Lead.
- **Gate reviews:** at each wave boundary the Lead consolidates, the CTO
  issues a verdict; fix cycles continue until PASS — never merge on BLOCKING.
- **DCR channel:** if code reveals a doc problem, a Document Change Request
  (doc §section, problem, proposed fix) goes to the Lead → CTO decides → doc
  revised FIRST (version bump) → coding resumes. No silent divergence.
- **Cadence:** continuous within a wave (worker lanes run in parallel); formal
  checkpoints at wave boundaries and gates only — no standing meetings.

## 8. Success criteria

Success = the 21-deliverable checklist from PROJECT-STATE.md §2 reaching
Approved status through the CTO gates, plus a stable production cutover.

| # | Deliverable | Artifact | Status at plan date |
|---|---|---|---|
| 1 | Project Plan | `docs/deliverables/01-project-plan.md` | this document (Wave 1) |
| 2 | Risk Register | `docs/deliverables/02-risk-register.md` | Wave 1 |
| 3 | SRS | `docs/deliverables/03-srs.md` | Wave 1 |
| 4 | Requirement Traceability Matrix | `docs/deliverables/04-rtm.md` | Wave 1 |
| 5 | SDS | `docs/deliverables/05-sds.md` | Wave 1 |
| 6 | Architecture Diagram | `docs/deliverables/06-architecture-diagram.md` | Wave 1 |
| 7 | Data Dictionary | `docs/deliverables/07-data-dictionary.md` | Wave 1 |
| 8 | API Specification | `docs/deliverables/08-api-specification.md` | Wave 1 |
| 9 | RBAC Design | `docs/deliverables/09-rbac-design.md` | Wave 1 |
| 10 | Audit Log Design | `docs/deliverables/10-audit-log-design.md` | Wave 1 |
| 11 | UI Prototype | `docs/deliverables/11-ui-prototype.md` | Wave 1 |
| 12 | Test Plan | `docs/deliverables/12-test-plan.md` | Wave 1 |
| 13 | Developed System | working system on `develop` | Wave 2+ |
| 14 | Source Code | repo (`develop`) | ongoing |
| 15 | Database Script | `scripts/schema.sql` + migrations | exists / extend |
| 16 | Deployment Package | Dockerfile, compose, `k8s/` | exists / extend |
| 17 | System Test Result | `docs/deliverables/17-system-test-result.md` | Wave 3 |
| 18 | UAT Result | `docs/deliverables/18-uat-result.md` | Wave 3 |
| 19 | VA/Pentest Report | `docs/deliverables/19-va-pentest-report.md` | Wave 3 |
| 20 | Security Remediation Report | `docs/deliverables/20-security-remediation.md` | Wave 3 |
| 21 | User Manual | `docs/deliverables/21-user-manual.md` | Wave 3 |

Additional hard criteria: merge gates never bypassed (`tsc --noEmit` green,
smoke tests green, build green, secrets scan clean; codex PASS additionally
for auth/security/data lanes); no feature merged against an open DCR.

## 9. Constraints and assumptions

### 9.1 Constraints

1. **Doc-first:** the CTO must approve the plan before vibe coding; docs are
   revised before code when contradictions surface (DCR process).
2. **Sole merge authority:** only the Lead reviews and merges; workers never
   commit/merge (PROJECT-STATE.md §5).
3. **Branch discipline:** `main` pristine upstream; `develop` integration;
   `feature/*` per wave/task.
4. **Token budget routing:** worker tier ~80% of token spend, lead ~20%,
   codex only at milestone gates and hard blocks.
5. **Compliance posture:** maker-checker dual control and the actor-stamped
   audit trail are non-negotiable for BOT governance and PDPA accountability;
   changes to those lanes always require a codex PASS.
6. **Single-process architecture:** one Express gateway serves API, uploads,
   and SPA; horizontal scaling is limited by the ReadWriteOnce uploads PVC
   until RISK-006 is retired.
7. **Accounts are never deleted** — deactivation only (audit-trail integrity).

### 9.2 Assumptions

1. The company Kubernetes cluster provides a NetworkPolicy-enforcing CNI, an
   ingress controller with TLS (secret `kbj-intranet-tls`), and reachability
   of the image registry (`harbor.kbj.local` per README §3) — else RISK-003
   materializes.
2. PostgreSQL 16 is available via `DATABASE_URL` in every non-dev environment;
   in-memory mode is dev-only.
3. Departments supply Thai/English content; bilingual copy for banners, news,
   and policies is authored in the CMS, not by this team.
4. Legacy content migration, if required, uses the documented export/import
   path (`GET /api/system/export` → `scripts/migrate.js`).
5. A 7-day server-side session lifetime and per-IP login throttling satisfy
   internal security policy for hypercare; tightening is a post-cutover option.
6. Target dates in §5 hold while gates pass on first or second cycle; each
   REVISE verdict adds roughly one fix cycle to the downstream schedule.

## 10. References

- `PROJECT-STATE.md` — charter, roster, deliverable checklist, wave board, git protocol, doc conventions
- `README.md` — system overview, quickstart, deployment, known limitations (§8)
- `HANDOVER.md` — architecture, RBAC matrix, maker-checker flow, security details, known limitations (§10)
- `docs/deliverables/02-risk-register.md` — companion risk register
- `docs/deliverables/11-ui-prototype.md` — UI prototype record
