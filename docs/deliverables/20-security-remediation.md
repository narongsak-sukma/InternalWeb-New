# Deliverable 20 — Security Remediation Report

**Version:** 0.1.2 · **Status:** **Approved** (codex gate @ `aec9779`, 2026-09-11 — `.omc/artifacts/cto-gate-doc20-verdict.md`) · **Date:** 2026-09-11 · **Author:** worker-5 (fresh spawn) → Lead review → CTO approval

> Scope basis: conditional companion to Deliverable 19 — VA/Pentest Report
> `docs/deliverables/19-va-pentest-report.md` **v0.4.1 Approved** (codex re-gate 2
> @ `9d84dc1`, decision #19, PROJECT-STATE.md). The condition is met: every
> remediation this report documents is landed on `develop` — W3-FIX-1 (DEF-001)
> and W3-FIX-2 (VUL-001 + VUL-002). Dispatch record: PROJECT-STATE.md W3-6 row.
>
> Discipline: this is an **as-built record** compiled from existing archived
> evidence — annotate-not-rewrite; all numbers are quoted verbatim from the cited
> records; nothing was re-executed for this document. Anything not present in a
> cited record is marked **NOT RECORDED** — never inferred. Severity labels reuse
> Deliverable 19's framework (Test Plan §8, S1–S4 by functional impact); no new
> severities are minted here.
>
> v0.1.1 (codex gate = **APPROVE** — deliverable #20 PASSED; verdict
> `.omc/artifacts/cto-gate-doc20-verdict.md` @ `aec9779`): no blocking
> findings — R-01/R-02/R-03 remediation claims, residual register, inherited
> severities, gate counts, and the NOT RECORDED honesty all verified
> [OK]. 3 non-blocking NITs applied: (1) §2 R-02 "run twice, second
> idempotent" re-attributed to `summary.md` + the `614dfa5` commit message
> (`audit-fix-output.txt` retains one invocation's output only); (2) §6
> evidence-index gate-log row qualified (`tsc.log` is empty — the exit-0
> transcript lives in `summary.md`; exact build bytes in `summary.md` +
> `lead-gates.log`, `build.log` prints a rounded size); (3) §1 Doc 19
> provenance precision — `9d84dc1` is the reviewed v0.4.0 commit, the
> v0.4.1 Approved flip landed in `f2fd57a`. Status flipped to Approved.
>
> v0.1.2 (2026-09-12, P3 hardening lane — as-built disposition flips,
> annotate-not-rewrite): **DEP-001 → RESOLVED** via the npm `overrides`
> pin (`"qs": "6.16.0"` in package.json — the version already gate-proven
> via body-parser; no new version introduced). As-built tree: `npm ls qs`
> shows a **single qs@6.16.0** (express direct `overridden`,
> body-parser `deduped` — no 6.15.x anywhere) and `npm audit` →
> **0 vulnerabilities** (`.omc/reports/p3b-lane.log` §B2 verbatim).
> **OBS-1 → RESOLVED** in the same lane: `app.set('x-powered-by',
> false)` in server.ts; probe :3228 (§A2 of the same log): 200/400/200
> with no `x-powered-by`, five security headers intact on the 400 path.
> Fix-tree standing gates: tsc 0 · build 0 · smoke 108/108 · e2e :3229
> 63 PASS / 1 FLAKY-known-S0 / 0 FAIL, exit 0. Both code changes ship
> in the same change set as this annotation (lead commit).

## 1. Purpose & scope

Deliverable 20 records the executed remediation of the Deliverable 19 findings
register — VUL-001 and VUL-002 — plus DEF-001, the availability-lane
security-adjacent defect discovered in the Wave-3 L4 system-test lane and
recorded in Deliverable 17 (`docs/deliverables/17-system-test-result.md`,
v1.1.2 Approved). For each item this report states the original finding, the
executed fix (commit, scope, and as-built code location), and the verification
evidence already archived by the fix lanes. No new testing was performed; every
verification claim cites a file under `.omc/reports/` or a gate record in
PROJECT-STATE.md.

In-scope: the three remediation items R-01/R-02/R-03 (§2), the residual risk
register carried forward from Deliverable 19 (§3), and the re-test/verification
summary (§4). Out-of-scope: any new probing, any code change, and any
re-adjudication of Deliverable 19's TC verdicts — those stand as approved.

Timeline (all 2026-09-11, from `git show` on `develop`): DEF-001 fix `7d33fc8`
17:04:25 +0700, merged `27b2622` 17:08:21 +0700; VUL-001 fix `45f0bb0` and
VUL-002 fix `614dfa5` both 17:58:01 +0700. Deliverable 19 v0.4.0 reviewed @
`9d84dc1`, the v0.4.1 Approved flip landed in `f2fd57a` (decision #19). This
document authored at head `13fae9e`.

## 2. Remediation items

### R-01 — VUL-001 (S4): security headers absent on body-parser error responses — FIXED

- **Original finding** (Doc 19 §3): the five security headers
  (X-Content-Type-Options / X-Frame-Options / X-XSS-Protection /
  Referrer-Policy / Permissions-Policy) were absent on the body-parser error
  envelopes — 400 `{"error":"Invalid JSON body"}` and 413
  `{"error":"Request body too large"}` — while every routed response class
  probed (200s, id-guard 400s, 401, 404, 403, 429) carried all five. Cause:
  `express.json` mounted before the header middleware (pre-fix: parser at
  `server.ts:45`, headers at `:49-56`), so parser errors reached the final
  error handler headerless. Severity S4 is a recorded lead judgment (Doc 19
  §3, confirmed in the W3-3 row).
- **Fix — commit `45f0bb0`** "fix(security): VUL-001 — security headers on
  body-parser error responses" (`git show`: `server.ts` 12 lines changed,
  8 insertions / 4 deletions): the five-header middleware moved **before**
  `express.json`/`express.urlencoded` — position-only change, same five
  assignments, plus a comment stating the ordering invariant (headers set on
  `res` on the way in, so downstream error envelopes inherit them).
- **As-built location** (verified on `develop` @ `13fae9e`): invariant comment
  at `server.ts:44-48`, middleware block `:49-56`, parsers at `:59-60`. Diff
  archived at `.omc/reports/w3fix2/server.ts.diff` (stat in
  `git-diff-stat.txt`: server.ts 12 lines).
- **Verification** (all pre-existing archives, `.omc/reports/w3fix2/`):
  - Worker 3-probe regression (:3234, fresh disposable production-mode server):
    GET `/` 200, malformed-JSON PUT 400 `Invalid JSON body`, 11.5 MB body 413
    `Request body too large` — **all five headers present on every probe,
    including both parser-error envelopes** (`hdrs-a-get-root.txt`,
    `hdrs-b-400-malformed-json.txt`, `hdrs-c-413-too-large.txt`; summary in
    `summary.md` §Targeted).
  - Lead independent probe of the then-uncommitted fix (working tree atop
    `4fb1040`, subsequently committed as `45f0bb0`), :3236: truncated-JSON PUT
    → 400 `application/json` body `{"success":false,"error":"Invalid JSON body"}`
    with all five headers listed (`lead-gates.log` §4;
    `PORT_3236_RELEASED=OK`).
  - Standing gates green on the fix tree (W3-FIX-2 row, PROJECT-STATE.md):
    tsc 0 · build 0 (dist/server.cjs 162,543 bytes) · smoke 108/108 · PG-mode
    127/127 ×2 (:55447/:55448). Lead gates same tree: tsc 0 · build 0 · smoke
    108/108 in 7.1 s (`lead-gates.log` §1-§3).
- **Status: FIXED** — matches Doc 19 §3 VUL-001 remediation status (v0.2.0
  annotation, upheld through the v0.4.1 approval).

### R-02 — VUL-002 (S3): three moderate npm advisories — PARTIALLY REMEDIATED

- **Original finding** (Doc 19 §3): `npm audit --omit=dev` exit 1, "3 moderate
  severity vulnerabilities" — `qs` 2.2.5–6.15.3 carrying GHSA-x5fp-wj9c-mxmx
  (array-limit bypass via bracket-key comma parsing) and GHSA-4mjr-xmp4-gh2g
  (DoS via attacker-controlled `isBuffer`), pulled via `body-parser`
  1.20.5–1.20.6 and `express` 4.22.2 (archived:
  `.omc/reports/w3-l5/npm-audit.log`; before-state reprint:
  `.omc/reports/w3fix2/audit-before.txt`). Zero High/Critical before the fix.
- **Fix — commit `614dfa5`** "chore(deps): VUL-002 partial — patch-level
  transitive refresh (3→2 moderates)" (`git show`: `package-lock.json` only,
  24 lines changed, 20 insertions / 4 deletions; **`package.json` untouched**):
  `npm audit fix --omit=dev` (run twice, second idempotent — attested by `summary.md` and the `614dfa5` commit message; `audit-fix-output.txt` retains one invocation's output)
  moved body-parser 1.20.6→1.20.8 and its nested qs→6.16.0. Patch-level
  transitive only — the W3-3 ruling's abort-on-major-bump STOP rule was not
  triggered (`summary.md` §Change 2).
- **Result** (`.omc/reports/w3fix2/audit-after.txt`): "2 moderate severity
  vulnerabilities" — the body-parser-nested occurrence is gone; what remains is
  `express` 4.22.2's own direct `qs ~6.15.1` pin resolving to 6.15.3, inside
  the advisory range. npm counts packages: the unique advisories are the same
  two GHSAs before and after (Doc 19 §3 VUL-002 v0.2.0 annotation). **Zero
  High/Critical before and after** (neither audit file lists any).
- **Residual — ticket DEP-001 (accepted exception)**: remediation options are
  an npm `overrides` entry pinning qs ≥ the patched range, or the next
  express/qs dependency refresh — both manifest/behavior-relevant changes
  deliberately kept outside W3-FIX-2's transitive-patch scope (STOP rule).
  Accepted as a known-issue entry per Test Plan §7 "exceptions accepted",
  tracked as **DEP-001** in the dependency-refresh backlog (registered in the
  PROJECT-STATE W3-FIX-2 row; minted during the Doc 19 gate-1 cycle, decision
  #17). See §3.
- **Verification:** gate runs on the combined W3-FIX-2 tree (both changes
  uncommitted together, per `summary.md` provenance) are the R-01 gate list
  above; the audit delta itself is the targeted evidence
  (`audit-before.txt` 3 moderate → `audit-after.txt` 2 moderate). Recorded
  env note, not a regression: PG run-1 first invocation failed 108/111 with
  `database "kbj_smoke" does not exist` (disposable container ships without
  the DB); `createdb` then rerun → 127/127 — lead-accepted judgment call
  (`summary.md`; W3-FIX-2 row).
- **Status: PARTIALLY REMEDIATED** — matches Doc 19 §3 VUL-002 remediation
  status, residual ticketed.

### R-03 — DEF-001 (S2): unhandled pg pool error event crashed the app — FIXED

- **Original finding** (PROJECT-STATE W3-1 row; Deliverable 17 lane): L4
  TC-SYS-005 FAIL — abrupt PostgreSQL termination (`docker compose stop
  postgres`) surfaces as a node-pg BoundPool `'error'` event, not a query
  rejection; with no `pool.on('error')` handler (pre-fix location cited at
  `server.ts:867`) the event crashed the process and Docker restart-looped
  (ENOTFOUND boot FATAL ×10). During the outage BOTH `/readyz` and `/healthz`
  were dead — breaking the 503-not_ready contract and NFR-AVAIL-001/002
  (liveness must stay 200, no restart loops). Original FAIL record:
  `.omc/reports/w3-l4/tc-sys-005.log` (recovery "readyz=200 after 43s
  (bounded 60s)" via restart backoff).
- **Fix — commit `7d33fc8`** "fix(avail): survive out-of-band PG termination —
  pg pool error handler (DEF-001, W3-FIX-1)" on branch
  `feature/w3-fix-001-pool-error` (`git show`: `server.ts` +6 lines), **merged
  to develop `27b2622`** "merge: feature/w3-fix-001-pool-error -> develop
  (DEF-001 closed, L4 exit 8/8)" — availability lane, lead merge authority
  (W3-FIX-1 row). The PostgresRepository constructor now registers
  `pool.on('error')`: one structured stderr log line, keep serving. As-built
  (verified on `develop` @ `13fae9e`): handler at `server.ts:879-881`
  (`[Persistence] Idle/client pool error (server may have terminated
  connections): …`), with the rationale comment above it. Boot-time fail-fast
  (AVAIL-004), the SELECT 1 readiness probe, and per-request error paths are
  untouched — pool events never carry in-flight query rejections (commit
  message).
- **Verification — TC-SYS-005 re-run PASS** on the rebuilt image
  (`5f2b4eaa6ad7`, git `7d33fc8`; `.omc/reports/w3-l4/tc-sys-005-rerun.log`):
  - Outage window (5 samples × 3 s, 10:05:40–10:05:52Z): `/readyz` **503 ×5**
    with body `{"status":"not_ready","probe":"readiness","reason":"Database
    unavailable"}` + `/healthz` **200 ×5** — the 503-not_ready contract held.
  - App container `Up (healthy)`, **RestartCount 0** before/during/after;
    handler fired exactly once at the stop moment (10:05:30.106Z:
    "terminating connection due to administrator command").
  - Recovery after `docker compose start postgres`: `/readyz` 200 in **1 s**
    (vs 43 s restart-backoff in the original FAIL); post-recovery login 200 +
    GET `/api/news` 200 (26,292 bytes); RestartCount_final 0; teardown clean.
- **Gates on the fix tree** (W3-FIX-1 row; commit message): tsc --noEmit 0 ·
  build OK · smoke 108/108 · PG-mode 127/127 ×2 (19.9 s / 19.7 s, exit 0;
  `.omc/reports/w3fix1-pg-run-{1,2}.log`) · e2e 63 PASS / 1 FLAKY (known
  S0-retry) / 0 FAIL, exit 0.
- **Status: FIXED — DEF-001 CLOSED**; L4 exited 8/8 (W3-FIX-1 row).

## 3. Residual risk register

Carried forward from Deliverable 19 §3; severities per its Test Plan §8
framework — no new severities assigned here.

| ID | Residual | Severity | Disposition |
|---|---|---|---|
| DEP-001 | `express` 4.22.2 direct `qs ~6.15.1` pin resolves to 6.15.3 — inside the GHSA-x5fp-wj9c-mxmx / GHSA-4mjr-xmp4-gh2g advisory range (2 moderates remain; zero High/Critical) | rides VUL-002's S3 | **Accepted exception** per Test Plan §7 "exceptions accepted"; tracked in the dependency-refresh backlog (PROJECT-STATE W3-FIX-2 row). Plan: npm `overrides` pin of qs ≥ patched range, or next express/qs refresh — whichever lands first (§5) *(v0.1.2: **RESOLVED** — npm `overrides` pin qs@6.16.0; single tree-wide version, `npm audit` 0 — v0.1.2 changelog + `.omc/reports/p3b-lane.log` §B2)* |
| OBS-1 | `X-Powered-By: Express` returned on all responses — outside TC-SEC-001's expected header set, hence not a TC violation | advisory observation (no severity minted) | P3 hardening candidate: `app.disable('x-powered-by')` one-liner — **doc-first, no code landed** (§5) *(v0.1.2: **RESOLVED** — suppression landed in the same P3 lane; v0.1.2 changelog + `.omc/reports/p3b-lane.log` §A2)* |
| OBS-2 | `GET /uploads/` answers 200 with the SPA shell; no directory listing (`index:false` holds; SPA catch-all absorbs the path) — TC-SEC-008 "No index" satisfied | informational | None required; recorded so Doc 08/17 readers are not surprised by the 200 (Doc 19 §3 Observations) |

## 4. Re-test & verification summary

All rows quote gate counts as recorded in the PROJECT-STATE W3-FIX-1 /
W3-FIX-2 rows and the archived logs — none re-run for this document.

| Item | Fix commit | Gates on fix tree (as recorded) | Targeted regression evidence |
|---|---|---|---|
| R-01 VUL-001 (S4) | `45f0bb0` (server.ts 12 lines, position-only) | Worker: tsc 0 · build 0 (162,543 B) · smoke 108/108 · PG 127/127 ×2 (:55447/:55448). Lead (same uncommitted tree atop `4fb1040`): tsc 0 · build 0 · smoke 108/108 (7.1 s) | `.omc/reports/w3fix2/hdrs-{a,b,c}-*.txt` 3-probe :3234 (GET 200 / malformed 400 / 413 — all five headers each); `lead-gates.log` §4 malformed-JSON 400 envelope :3236 |
| R-02 VUL-002 (S3) | `614dfa5` (package-lock.json only, 24 lines) | Same W3-FIX-2 tree and gate runs as R-01 (both changes gated together; env note on PG run-1 in §2) | `.omc/reports/w3fix2/audit-before.txt` (3 moderate) → `audit-after.txt` (2 moderate, zero High/Critical); `audit-fix-output.txt` |
| R-03 DEF-001 (S2) | `7d33fc8`, merged `27b2622` (server.ts +6) | tsc 0 · build OK · smoke 108/108 · PG 127/127 ×2 (19.9 s/19.7 s, `.omc/reports/w3fix1-pg-run-{1,2}.log`) · e2e 63 / 1 FLAKY-known / 0 FAIL, exit 0 | `.omc/reports/w3-l4/tc-sys-005-rerun.log` — readyz 503 ×5 + healthz 200 ×5, RestartCount 0, handler fired once, recovery 1 s (original 43 s in `tc-sys-005.log`) |

e2e note: an e2e count is recorded for the W3-FIX-1 tree only; no e2e run for
the W3-FIX-2 tree is recorded in PROJECT-STATE or `.omc/reports/w3fix2/` —
**NOT RECORDED**, not inferred.

## 5. Recommendations (P3 hardening backlog — [PLANNED], no code claims)

*(v0.1.2 annotation: both [PLANNED] items below landed in the 2026-09-12
P3 hardening lane — OBS-1 via `app.set('x-powered-by', false)` (server.ts),
DEP-001 via the npm `overrides` qs@6.16.0 pin. Evidence: v0.1.2 changelog
entry + `.omc/reports/p3b-lane.log`. Original v0.1.1 text retained per
annotate-not-rewrite.)*

- **[PLANNED] OBS-1 X-Powered-By suppression** — add
  `app.disable('x-powered-by')` (one-liner per Doc 19 §3 OBS-1) in a future
  hardening cycle with the standing gates re-run. No code has landed; this
  section makes no code claims.
- **[PLANNED] DEP-001 resolution** — either an npm `overrides` entry pinning
  `qs` ≥ the patched range, or riding the next express/qs dependency refresh;
  both options are manifest/behavior-relevant and were deliberately excluded
  from W3-FIX-2's transitive-patch scope (STOP rule). Remains tracked in the
  dependency backlog until disposed.

## 6. Evidence index

Every file cited above, with one-line content description.

| File | Content |
|---|---|
| `docs/deliverables/19-va-pentest-report.md` | Source register v0.4.1 Approved — VUL-001/VUL-002 findings, remediation statuses, OBS-1/OBS-2, DEP-001 disposition |
| `PROJECT-STATE.md` | W3-1 (DEF-001 discovery), W3-FIX-1, W3-FIX-2, W3-6 rows; decisions #16-#19; deliverable #20 register row |
| `server.ts` (develop @ `13fae9e`) | As-built: header middleware + invariant comment `:44-56`, parsers `:59-60`, `pool.on('error')` handler `:879-881` |
| git `45f0bb0` | VUL-001 fix commit — middleware reorder, server.ts 8+/4− |
| git `614dfa5` | VUL-002 fix commit — package-lock.json 20+/4−, package.json untouched |
| git `7d33fc8` | DEF-001 fix commit — server.ts +6, full rationale + gates in message |
| git `27b2622` | Merge of `feature/w3-fix-001-pool-error` to develop (DEF-001 closed, L4 8/8) |
| `.omc/reports/w3fix2/summary.md` | Worker W3-FIX-2 lane summary — diff scope, audit delta, gates table, 3-probe regression |
| `.omc/reports/w3fix2/server.ts.diff` / `git-diff-stat.txt` | The VUL-001 reorder diff; change-set stat (server.ts 12 / package-lock 24 lines) |
| `.omc/reports/w3fix2/audit-before.txt` / `audit-after.txt` | npm audit 3 → 2 moderates (same two GHSAs; zero High/Critical both) |
| `.omc/reports/w3fix2/audit-fix-output.txt` | `npm audit fix --omit=dev` run transcript |
| `.omc/reports/w3fix2/hdrs-a-get-root.txt` / `hdrs-b-400-malformed-json.txt` / `hdrs-c-413-too-large.txt` | 3-probe five-header regression dumps (:3234) |
| `.omc/reports/w3fix2/tsc.log` / `build.log` / `smoke-default.log` / `smoke-pg-{1,2}.log` | Fix-tree worker gates: tsc 0 · build 162,543 B · smoke 108/108 · PG 127/127 ×2 *(v0.1.1 qualification: `tsc.log` is an empty exit-0 artifact — the run transcript with the exit code lives in `summary.md`; the exact 162,543-byte figure is recorded in `summary.md` + `lead-gates.log`, while `build.log` prints a rounded size)* |
| `.omc/reports/w3fix2/server-3234.log` | Targeted-regression server boot log |
| `.omc/reports/w3fix2/lead-gates.log` | Lead spot-gates atop `4fb1040` + independent malformed-JSON probe (:3236) |
| `.omc/reports/w3-l4/tc-sys-005-rerun.log` | DEF-001 regression re-test PASS (503-not_ready contract, RestartCount 0, 1 s recovery) |
| `.omc/reports/w3-l4/tc-sys-005.log` | Original TC-SYS-005 FAIL record (crash + restart loop; 43 s recovery) — retained per annotate-not-rewrite |
| `.omc/reports/w3fix1-pg-run-1.log` / `w3fix1-pg-run-2.log` | W3-FIX-1 PG-mode smoke 127/127 ×2 (cited via W3-FIX-1 row and Doc 19 §5) |
| `.omc/reports/w3-l5/npm-audit.log` | Original VUL-002 audit evidence (3 moderate, exit 1) — cited via Doc 19 §3 |
| `.omc/artifacts/cto-gate-doc19-regate2-verdict.md` | Codex APPROVE verdict for Doc 19 v0.4.0 @ `9d84dc1` (decision #19) — the trigger for this deliverable |
