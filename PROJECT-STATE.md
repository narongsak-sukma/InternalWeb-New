# PROJECT-STATE — KB J Capital Intranet Rebuild (Second Brain)

> Any new session resumes from THIS FILE, never from scratch.
> Updated + committed at every stage transition by the Lead.

**Mission:** Build the new KBJ Capital intranet web portal to replace the
outdated legacy web. Doc-first; every gate/merge passes CTO verdict.

**Started:** 2026-09-10 · **Lead:** team-lead (GLM 5.3 session) · **CTO:** codex CLI (read-only gate)

---

## 1. Team roster & model routing (binding)

| Tier | Role | Runtime | Notes |
|---|---|---|---|
| Top | CTO | codex CLI 0.153.4, `--sandbox read-only` | FINAL verdict APPROVE/REVISE/REJECT on every gate/merge; auth/security/data lanes never merge without codex PASS |
| Middle | Lead / PM / Senior Dev | this session (glm-5.3) | Decomposition, task board, routing, triage, review + merge; SOLE channel for user directives |
| Worker ×5 | Dev positions | executor agents, sonnet tier (flash-class: cheap/fast/parallel) | Implement exactly per docs. Never edit docs, never merge, never commit to develop |

**Model routing:** deterministic checks first (tsc/tests/git — free) → worker
tier (80% of tokens) → lead tier (20%) → codex ONLY at milestone gates and
hard blocks.

**Escalation ladder:** worker fails >3 retries → middle tier retries ≤3 →
CTO (codex) solves directly.

## 2. Deliverable checklist (21 items — CTO must approve plan BEFORE vibe code)

| # | Deliverable | File / artifact | Status |
|---|---|---|---|
| 1 | Project Plan | `docs/deliverables/01-project-plan.md` | Wave 1 |
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
| 21 | User Manual | `docs/deliverables/21-user-manual.md | Wave 3 |

## 3. Wave board (task → owner → status)

| Wave | Task | Owner | Status |
|---|---|---|---|
| 0 | Governance: branches, PROJECT-STATE, board | lead | done 2026-09-10 |
| 1 | Docs 01+02+11 (PM/UI lane) | worker-1 | pending |
| 1 | Docs 03+04 (requirements lane) | worker-2 | pending |
| 1 | Docs 05+06 (architecture lane) | worker-3 | pending |
| 1 | Docs 07+08 (data/API lane) | worker-4 | pending |
| 1 | Docs 09+10+12 (security/QA lane) | worker-5 | pending |
| 1 | Lead review of doc set (consistency, cross-refs, no divergence) | lead | pending |
| 1 | CTO gate: deliverable docs (codex read-only) | CTO | pending |
| 2 | Implementation waves (decomposed from approved docs) | workers | blocked by Wave-1 gate |
| 3 | Test/UAT/pentest/manual deliverables 17–21 | workers | blocked by Wave 2 |

## 4. CTO decision log (append-only)

| # | Date | Decision | Verdict |
|---|---|---|---|
| 1 | 2026-09-10 | Project charter: doc-first, 21-deliverable checklist, wave model; workers=flash-class executors; codex=CTO gate; lead sole merge authority | CHARTERED (lead, per user full-authority grant) |

## 5. Git protocol

- `main` = pristine upstream; `develop` = integration; `feature/*` per wave/task.
- **Lead reviews + merges everything. Workers never commit/merge.**
- Merge gates: `tsc --noEmit` green, smoke tests green, build green, secrets
  scan clean; auth/security/data lanes additionally require codex PASS.
- Fix cycles until PASS — never merge on BLOCKING.

## 6. Resume procedure (new session)

1. Read this file top-to-bottom.
2. `state_read(mode="team")` for OMC team phase; read `.omc/handoffs/*.md`.
3. `git branch --show-current` + `git status --short` — verify on expected branch.
4. `TaskList` — reconcile board vs §3 wave board; resume the last non-terminal
   stage. Never respawn workers that already reported completion.

## 7. Doc conventions (workers follow exactly)

- Location `docs/deliverables/NN-slug.md`; English body (repo convention),
  Thai-first for user-facing strings quoted in docs.
- Header block: Version / Status (Draft→Reviewed→Approved) / Date / Author.
- Docs describe the system AS BUILT (source of truth: `server.ts`, `src/`,
  `scripts/schema.sql`, `README.md`, `HANDOVER.md`); future work marked `[PLANNED]`.
- If code reveals a doc problem → file a DCR to the lead (doc §section,
  problem, proposed fix) → CTO decides → doc revised FIRST (version bump),
  then coding resumes. No silent divergence.
