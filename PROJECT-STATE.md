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
| 1 | Project Plan | `docs/deliverables/01-project-plan.md` | Approved (W1 gate 2026-09-10) |
| 2 | Risk Register | `docs/deliverables/02-risk-register.md` | Approved (W1 gate 2026-09-10) |
| 3 | SRS | `docs/deliverables/03-srs.md` | Approved (W1 gate 2026-09-10) |
| 4 | Requirement Traceability Matrix | `docs/deliverables/04-rtm.md` | Approved (W1 gate 2026-09-10) |
| 5 | SDS | `docs/deliverables/05-sds.md` | Approved (W1 gate 2026-09-10) |
| 6 | Architecture Diagram | `docs/deliverables/06-architecture-diagram.md` | Approved (W1 gate 2026-09-10) |
| 7 | Data Dictionary | `docs/deliverables/07-data-dictionary.md` | Approved (W1 gate 2026-09-10) |
| 8 | API Specification | `docs/deliverables/08-api-specification.md` | Approved (W1 gate 2026-09-10) |
| 9 | RBAC Design | `docs/deliverables/09-rbac-design.md` | Approved (W1 gate 2026-09-10) |
| 10 | Audit Log Design | `docs/deliverables/10-audit-log-design.md` | Approved (W1 gate 2026-09-10) |
| 11 | UI Prototype | `docs/deliverables/11-ui-prototype.md` | Approved (W1 gate 2026-09-10) |
| 12 | Test Plan | `docs/deliverables/12-test-plan.md` | Approved (W1 gate 2026-09-10) |
| 13 | Developed System | working system on `develop` | Wave 2+ |
| 14 | Source Code | repo (`develop`) | ongoing |
| 15 | Database Script | `scripts/schema.sql` + migrations | exists / extend |
| 16 | Deployment Package | Dockerfile, compose, `k8s/` | exists / extend |
| 17 | System Test Result | `docs/deliverables/17-system-test-result.md` | Wave 3 |
| 18 | UAT Result | `docs/deliverables/18-uat-result.md` | Wave 3 |
| 19 | VA/Pentest Report | `docs/deliverables/19-va-pentest-report.md` | Wave 3 |
| 20 | Security Remediation Report | `docs/deliverables/20-security-remediation.md` | Wave 3 |
| 21 | User Manual | `docs/deliverables/21-user-manual.md` | Wave 3 |

## 3. Wave board (task → owner → status)

| Wave | Task | Owner | Status |
|---|---|---|---|
| 0 | Governance: branches, PROJECT-STATE, board | lead | done 2026-09-10 |
| 1 | Docs 01+02+11 (PM/UI lane) | worker-1 | done 2026-09-10 (+follow-up RISK-021) |
| 1 | Docs 03+04 (requirements lane) | worker-2 | done 2026-09-10 |
| 1 | Docs 05+06 (architecture lane) | worker-3 | done 2026-09-10 |
| 1 | Docs 07+08 (data/API lane) | worker-4 | done 2026-09-10 |
| 1 | Docs 09+10+12 (security/QA lane) | worker-5 | done 2026-09-10 |
| 1 | Lead review of doc set (consistency, cross-refs, no divergence) | lead | done 2026-09-10 |
| 1 | CTO gate: deliverable docs (substitute opus critic, per decision #4) | CTO | APPROVED 2026-09-10 (decision #6) — merged to develop |
| 2 | Implementation waves (decomposed from approved docs) | workers | unblocked — see .omc/handoffs/wave2-plan-draft.md |
| 2 | W2-1 dual-control bundle (DCR-3+7+AUD-P01/02/03) | worker-2 | CODE DONE 2026-09-10 — 22023eb on feature/w2-1-dual-control (workflow-field strip, state+identity guards, forced non-draft→draft reset, AUD-P01/02/03 audits; smoke 94/94). Holding with branch for codex |
| 2 | W2-2 audit-endpoint removal (DCR-8) | worker-5 doc / worker-2 code | COMPLETE 2026-09-10 — doc phase eb4c9b5 (develop) + code phase f6fa52d (branch): route + openapi post entry removed (404 catch-all for every role incl. admin; recordAudit sole audit writer), smoke 95/95, doc 09 v1.2.0. Merges with P0 chain at codex gate |
| 2 | W2-3 audit coverage gaps AUD-P06/05/07 | worker-5 | rulings issued (decision #7: AUD-P07 trimmed to presented-cookie 401s; audit-union prune CREATE/DELETE/SYNC_PUBLIC with UPDATE staying — single types.ts edit; CONTENT_* migration plan). DOC PHASE COMMITTED f569be1 (doc 10 v1.4.0 + 03-srs/04-rtm v1.3.0 FR-AUDIT-003 ext + doc 12 v1.6.0). Code phase COMPLETE — see code-phase row |
| 2 | W2-4 TypeScript strict (DCR-6) | worker-3 | Phases A+B DONE 2026-09-10 — root cause: @types/react{,-dom} missing (React=any, checker blind to frontend); with types: exactly 1 strict error (AdminCMS L331 union), fixed type-only. Lead landed feature/w2-4-strict-mode (3077e52 types+fix, 97bef96 strict flip; `tsc --noEmit` exit 0 incl. W2-1 in-flight tree). MERGED to develop 2026-09-10 (a07885e) — strict tsc is now the STANDING merge gate; independently verified by worker-3 in an isolated worktree (PASS matrix + isolation spot-check). **DCR-6 CLOSED** |
| 2 | W2-5 shared rate-limit store (RISK-010) | worker-1 | COMPLETE 2026-09-10 — code 1b237cd (repo +4 login-budget methods, PG atomic upsert, rate_limit_hits DDL lockstep, fail-open + degradation counter, smoke §15 opt-in PG mode; README §8 + HANDOVER §10 + doc 02 v1.3.0 RISK-010→Mitigating). Lead independent evidence: tsc --strict 0 · build 0 · smoke 95/95 · PG-mode 99/99. Doc flips (03 v1.4.0 FR-AUTH-002(d)(e) + 04 cell + 12 ENV row) landed 36ad1eb; security lane holds with branch for codex |
| 2 | W2-6 sync webhook (FR-SYNC-004) design + k8s egress | worker-4 | design draft IN FLIGHT 2026-09-11 (.omc/research/w2-6-sync-webhook-design.md; codex advisory riding: must address external withdrawal propagation). Code phase still external-blocked |
| 2 | W2-UX inert sync toggles (DCR-9) — doc-first pass | worker-3 | DONE 2026-09-10 — 36ad1eb (task #17, three lanes: doc 11 v1.1.0 target state G-1 closed; 05/06 v1.1.0 single-path truth pass; W2-5 flips 03 v1.4.0/04/12; + lead review fix doc 05 §8 row 3). Inventories 94/94/170 verified. Negative finding: 03 has no toggle text. externalCategory zero-consumer evidence → DCR-10 |
| 2 | DCR-9 code phase (Option C UI) | worker-4 | COMPLETE 2026-09-10 — **2d41c39** (task #19): toggles removed, "Withdraw from public" row action + confirm dialog, response-discard/fabricated-log/toast fixes + lead in-commit review fix (honest form headings + draft-until-approved subtext; 4 e2e selectors in lockstep). Lead gates: tsc --strict 0 · build 0 · smoke 99/99 · e2e 63/0/1 vs fresh prod server :3220 (dead-port e2e run diagnosed: suite requires QA-spawned server). Manifest sync **c7db581** (chore w2-4). **Worker-1 independent verification PASS** (all 4 checks; fresh gates re-run incl. e2e 63/0/1/0 exit 0; symbol sweep 0 hits incl. comments; wasNonDraft-before-await + AUD-P01 prior-status semantics confirmed vs server.ts; 2 non-blocking observations: defensive-but-honest unreachable toast branches; doc 11 anchors are §5.7+§5.8+G-1). Doc 11 v1.2.0 as-built flip landed (30d8476); gate-brief updated+verified by worker-2 (20-commit snapshot at 146111a; head drift to 6a6786d absorbed by the pre-gate checklist item); merge conflict map EMPIRICALLY confirmed by dry-run 2026-09-10 (conflicts: PROJECT-STATE.md + AdminCMS.tsx only; manifests/package files merge clean). Codex gate SCHEDULED 2026-09-15 09:05 (durable task 431b173f: pre-gate checklist → codex verdict → on APPROVE merge with mapped resolutions) |
| 2 | Docs 07/08 W2-1 as-built truth pass | worker-4 | COMPLETE 2026-09-10 — 1bc0d6b (task #18): doc 07 v1.2.0 + doc 08 v1.3.0 aligned to landed strict dual-control; stale-bypass divergence closed. W2-6 remains parked on external blocker |
| 2 | W2-3 audit coverage — CODE PHASE | worker-5 | COMPLETE 2026-09-10 — 4650335 on feature/w2-1-dual-control (5 files, +208/−9): AUD-P05 sync/trigger + AUD-P06 system/export (shared exportTimestamp) + AUD-P07 requireAuth presented-cookie 401 `if (token)` guard & requireRole async all-403 audit; types.ts:119 union prune (net 14 live writers); initialData audit-4 seed → SYNC_TRIGGER; AdminCMS dead SYNC_PUBLIC branches deleted; smoke §16 flip-pins (99/99; §16 runs before §14 — rate-limit key saturation). LEAD REVIEW FIX in-commit: requireRole 403 audit try/catch-wrapped (Express 4 rejects unwrapped middleware promises → 403 would hang on audit-store failure; fail-open consistent w/ W2-5). Lead evidence: tsc --strict 0 (prune proof) · build 0 · smoke 99/99. Worker-1 independent verification PASS (recorded 88ada8b; its one finding — stale smoke §16 docstring — fixed comment-only b5154b0). As-built doc flips LANDED 0be867c (doc 10 v1.5.0 + 03 v1.5.0 + 04 v1.5.0 [91 full + 1 partial] + 12 v1.8.0 [170 TC]; lead review ACCEPTED worker-5's two disclosed judgment calls). Ripple debt queued: doc 05 §3.5 action listing + doc 07 audit action list re-check at each doc's next revision (flagged doc 10 §9.2). Security lane holds with branch for codex |
| 2 | W2-FIX-1 codex blockers 1+2+4 + state-only withdraw endpoint (server+client+tests) | worker-2 | DISPATCHED 2026-09-11 (decision #8 fix cycle) |
| 2 | W2-FIX-2 doc bundle: 08 withdraw endpoint · 10 audit atomicity · 12 TCs+inventory · 03/04 rows · 05 §3.5 (closes ripple debt) | worker-5 | queued after W2-FIX-1 |
| 2 | W2-GATE-2 codex re-gate after fix verification | CTO | queued after W2-FIX-1/2 + worker-1 verification + brief update |
| 3 | Test/UAT/pentest/manual deliverables 17–21 | workers | blocked by Wave 2 |

## 4. CTO decision log (append-only)

| # | Date | Decision | Verdict |
|---|---|---|---|
| 1 | 2026-09-10 | Project charter: doc-first, 21-deliverable checklist, wave model; workers=flash-class executors; codex=CTO gate; lead sole merge authority | CHARTERED (lead, per user full-authority grant) |
| 2 | 2026-09-10 | DCR-1..5 triage (see §8). DCR-3 maker-checker bypass CONFIRMED in code by lead (server.ts:1306) → as-built documented everywhere, dual-control enforcement queued as Wave-2 P0 backlog, CTO ratifies at Wave-1 gate | TRIAGED (lead) — pending CTO ratification |
| 3 | 2026-09-10 | Lead review of 12-doc set PASSED: REQ SRS↔RTM 1:1 (94); all RTM TC refs resolve in doc 12 (168 TC defs, 21 series); UAT-001..065 mapped; DCR numbering unified to §8 register (strict-mode=DCR-6); RTM FR-NEWS-009 TC ref fixed to TC-SEC-011; role matrices 08↔09 agree; 9 tables + 13 components covered; HANDOVER fixed per DCR-1/2 | REVIEW PASSED (lead) → to CTO gate |
| 4 | 2026-09-10 | codex CTO gate ABORTED — account usage limit hit (resets 2026-09-15 09:01 or on credit top-up); no verdict produced (.omc/artifacts/cto-gate-wave1.md). SUBSTITUTE: Wave-1 docs gate runs via independent opus critic agent (read-only, fresh context, same verdict contract — not lead self-approval). codex remains BINDING for auth/security/data-lane CODE merges in Wave 2; if still rate-limited at that point, merges hold until codex returns or user tops up credits (surfaced to user) | OUTAGE PROTOCOL (lead, per full-authority grant) |
| 5 | 2026-09-10 | Substitute CTO gate verdict = **REVISE** (full verdict: .omc/artifacts/cto-gate-wave1-substitute.md). All 8 DCRs RATIFIED. STRICT dual-control ruling adopted (no role incl. admin reaches 'synced' outside checker approve; state+identity guards; workflow fields server-controlled; break-glass = separate future requirement). Wave-2 priorities ratified: P0 dual-control bundle (DCR-3+7 + AUD-P01/02/03) → DCR-8 (prefer REMOVAL of POST /api/audit-logs) → AUD-P06/05/07; P1 strict mode + shared rate-limit store + sync webhook; P2 envelope + RWX + migration tooling; P3 dead-enum + audit hardening + DB immutability. 3 blockers (SRS FR-NEWS-009 carve-out; doc 12 TC-SEC-011 carve-out; doc 07 §12 DCR numbering) → fix round dispatched to workers 2/5/4 + RISK-022/023 to worker-1; critic re-review limited to the three fixes → APPROVE flip | REVISE — fix round 1 of 3 (lead executed, per decision #4 authority) |
| 6 | 2026-09-10 | Substitute CTO gate re-verification of fix round (commit 43d8591): **APPROVE** — all 3 blockers closed exactly as ruled, no new defects; regression integrity held (94 REQ, 168 TCs, as-built pins intact). Merge to develop AUTHORIZED; Wave-2 decomposition authorized per ratified priorities. **Conditions riding the approval:** (1) Wave-2 auth/security/data merges still require codex PASS — DCR-3+7 and DCR-8 sit in that lane (hold if codex limited, per #4); (2) flip-test discipline — when TC-NEWS-011/CMS-008/SEC-012/013 pins flip due to fixes, linked DCR/REQ/TC statuses in docs 03/04/12 flip in the SAME PR; (3) resolve rejected-item re-submission UX during P0 decomposition (doc 09 §8.3 rule 4), not after implementation; (4) P0 order as ratified. Watch items: strip workflow fields at payload-validation layer (governs future bulk endpoints too); tighten ~74 non-RTM TC→REQ mappings to specific IDs before Doc 17 | APPROVE (substitute critic; codex binding for W2 code merges unchanged) |
| 8 | 2026-09-11 | **codex CTO gate Wave-2** (head 66380a7, 22 commits; brief `.omc/artifacts/cto-gate-wave2.md`; verdict `.omc/artifacts/cto-gate-wave2-verdict.md`): **REVISE** — ALL 10 ratification asks RATIFIED (decision #7 five sub-rulings; W2-5 fail-open; requireRole 403-audit try/catch; §16/§14 ordering; DCR-9 Option C policy incl. withdraw-by-maker-without-checker — "withdrawal must preserve current content and remain audited"; DCR-10 DEFER). 4 blockers, each reproduced in isolation by codex: (1) non-atomic workflow transitions — approve races a concurrent PUT and overwrites the newer draft with stale content as synced (server.ts:909/938/1673/1714); (2) legacy pending items without submittedBy bypass both self-decision guards — original admin submitter can approve own pre-migration submission (server.ts:470/1696/1769); (3) withdrawal sends the full stale browser snapshot via PUT — silently replaces concurrent edits; already-draft withdraw yields no AUD-P01 (App.tsx:291, server.ts:1565); (4) state commits before recordAudit — audit-insert failure leaves an unaudited draft; retry skips the audit; approval same (server.ts:1582/1588/1714). Fix direction (codex-instructed): transactional locking or version-checked transitions across edit/submit/approve/reject rejecting stale ops; deny decisions lacking verified submitter identity (fresh submission cycle); state-only withdrawal from current server content with atomic synced precondition; commit state+audit atomically (same transaction PG / same critical section in-memory); regression coverage for concurrency, legacy-submission, stale-withdrawal, audit-failure; then re-run gates + return. Advisory: W2-6 design must address external withdrawal propagation (local draft reset must remove an already-delivered public copy). **NO MERGE authorized**; §5 conflict plan stands for subsequent APPROVE | REVISE — fix cycle 1 |

## 8. DCR register (doc change requests)

| DCR | Source | Finding (verified against code) | Disposition |
|---|---|---|---|
| DCR-1 | worker-4 | Export field is `exportTimestamp` (server.ts:2072), not `generatedAt` (HANDOVER §5 wrong) | ACCEPT — fix HANDOVER §5 in W1 review pass |
| DCR-2 | worker-4 | No `PUT /api/documents` route exists; HANDOVER §5 implies it | ACCEPT — fix HANDOVER §5 |
| DCR-3 | worker-4, confirmed by lead | `POST /api/news` (and update) with `syncToExternal=true` creates directly as `externalSyncStatus:'synced'` (server.ts:1306,1315,1346) — maker bypasses checker dual control (BOT governance violation). **Corollary (worker-5, verified):** bypass path writes ONLY sync_logs (admin-only visibility) and NO audit entry — invisible to checkers | ACCEPT as finding — **CTO-RATIFIED w/ conditions**: STRICT semantics (no role incl. admin reaches 'synced' outside approve; approver≠submitter guard; submit draft-only; workflow fields stripped/server-controlled); AUD-P01/02/03 audit coverage in the SAME change; Wave-2 P0 bundle with DCR-7; RISK-021 |
| DCR-4 | worker-4 | Response envelope inconsistent — reads & some 404s return bare data, no `success` field | ACCEPT — doc 08 as-built; [PLANNED] normalization Wave-2 P2 |
| DCR-5 | worker-4, corrected by CTO gate | TS union declares `'pending'` as the ONLY dead member (there is NO 'approved' member — src/types.ts:28); runtime values: draft/pending_approval/synced/rejected | ACCEPT — RATIFIED with correction; docs aligned; dead-union cleanup Wave-2 P3 |
| DCR-6 | worker-2, confirmed by lead | `tsconfig.json` has NO `"strict": true` (nor strictNullChecks) — "TypeScript strict" is convention only; code passes tsc in non-strict mode | ACCEPT — enable strict + fix fallout in Wave-2 P1 (MAINT quality gate); SRS states as-built + [PLANNED] |
| DCR-7 | worker-5, confirmed by lead | NO server-side state guards on maker-checker: approve/reject callable from ANY state (server.ts:1407/1444); submit-approval accepts any state (1384); PUT spread overwrites approvedBy/approvedAt (1338-1342) | ACCEPT — **CTO-RATIFIED**; Wave-2 P0 bundle WITH DCR-3 (one work item); scope adendum: submit guarded to draft, workflow fields stripped on create/update, approver≠submitter guard; RISK-022 |
| DCR-8 | worker-5, confirmed by lead | `POST /api/audit-logs` (server.ts:1670, admin) appends arbitrary audit rows under an "Immutable" comment (1665) — audit-trail integrity risk | ACCEPT — **CTO-RATIFIED w/ instruction**: PREFER REMOVAL of the endpoint over restriction; if break-glass retained, the append act itself must be audit-logged and role-scoped below blanket admin; Wave-2 P0; codex PASS mandatory; RISK-023 |
| DCR-9 | worker-3 (.omc/research/inert-sync-toggles-ux.md), confirmed by lead | Post-W2-1 the external-sync UI is worse than inert: form toggle inert but chip claims "Auto-sync enabled"; DRAFT-row toggle FABRICATES synced state client-side (App.tsx:307 discards server response; fake "now LIVE" toast; fabricated SyncLog); SYNCED-row toggle = accidental unpublish via forced reset; create/update toasts keyed on payload flag not server response (App.tsx:227-275) — UI lies about publication state in a BOT-governed workflow | ACCEPT — **lead-ruled (2026-09-10, full-authority grant)**: Option C — remove publish-promising toggles; add honest "Withdraw from public" row action riding existing PUT forced-reset semantics (maker/admin RBAC inherited, AUD-P01 fires); fix response-discard + fabricated-log bugs. Doc-first revision BEFORE code (doc 11 + ripple 03/04/12 + docs 05/06 truth). **Doc phase DONE 36ad1eb**; code phase IN FLIGHT (task #19, worker-4). Withdraw-by-maker-without-checker + the whole ruling ride to codex with the P0 chain |
| DCR-10 | worker-3 (repo-wide grep evidence, task #17), confirmed by lead | `NewsItem.externalCategory` has ZERO consumers: union def (types.ts:29), stored/round-tripped (server row-mapper/save/default), written by the AdminCMS form, seeded in initialData — nothing reads it for display, filter, or export (public view filters `item.category`); its only UI entry point was the DCR-9-removed toggle's form select (doc 11 §5.9 documents the fact) | ACCEPT as finding — **lead-ruled (2026-09-10): DEFER** — removal decision blocked until the W2-6 webhook payload is specified (the outbound public-site sync is the only plausible consumer); if the W2-6 payload does not use it, removal rides the P1/P2 CONTENT_* audit-vocabulary migration (single types/schema/server pass). No action now; DCR-9 code removes only the form select. Rides to codex with the chain |

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
