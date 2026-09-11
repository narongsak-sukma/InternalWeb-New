# Deliverable 17 — System Test Result

**Version:** 1.0.1 · **Status:** Reviewed (lead) · **Date:** 2026-09-11 · **Author:** worker-5 → Lead review → CTO approval

> v1.0.1 (lead review pass): TC-SYS-006 kustomize half re-executed by the
> lead with raw-log capture (`tc-sys-006-kustomize-rerun.log`) closing §3.6
> item 6; §5.2 records the lead rulings on the worker's five flagged judgment
> calls. No verdicts changed.

> Assembled strictly from archived evidence (run logs, report files, git
> commit messages, PROJECT-STATE gate records) per Test Plan Doc 12 §9
> (evidence capture rules). No number in this document is asserted without a
> cited record; where archived evidence is absent the item is marked
> **NOT TESTED** rather than inferred. Counts are quoted verbatim.
> Commit timestamps are quoted as git records them (+07:00); run windows are
> quoted as the logs record them (UTC, `Z`).

---

## 1. Purpose & scope

**Purpose.** Report the executed results of test levels **L0–L4** (Doc 12 §4)
against the KB J Capital intranet portal as built on `develop`, with per-TC
verdicts, the defect register, and the level exit assessment — produced from
recorded runs, not narrative claims (Doc 12 §1).

**In scope (this document):**

| Level | Objective (Doc 12 §4) |
|---|---|
| L0 Static | Type-level correctness — `npm run lint` (`tsc --noEmit`) |
| L1 Build | Both artifacts build — `npm run build` (SPA `dist/` + `dist/server.cjs`) |
| L2 Smoke / API | Full API contract, RBAC matrix, maker-checker, audit, uploads, rate limit vs a real server process (`scripts/smoke-test.mjs`) |
| L3 E2E walkthrough | Real-browser per-role journeys through the Thai-first UI (`tests/e2e-walkthrough.mjs`) |
| L4 System test | Composed docker-compose stack: PG persistence, probes, graceful shutdown, migration/export path (Doc 12 §6.18/§6.19) |

**Out of scope (deferred per Doc 12 §10 deliverable mapping):**
L5 Security → **Doc 19** (VA/Pentest Report); L6 UAT → **Doc 18** (UAT
Result). Both remain open Wave-3 work (PROJECT-STATE §3 W3-3/W3-4). The
Release gate row of Doc 12 §7 ("All levels exited") is therefore **not yet**
assessable from this document alone — see §5.

**System under test.** `develop` head `7b23fd4` (2026-09-11), carrying the
Wave-2 P0 chain (W2-1 dual control, W2-2 audit-endpoint removal, W2-3 audit
coverage, DCR-9 Option C UI, W2-FIX-1..6; merged at `c99abfb`) plus the
W3-FIX-1 availability fix (`7d33fc8`, merged `27b2622`) — per PROJECT-STATE
§3 board rows and `git log develop`.

---

## 2. Environment & provenance

Doc 12 §9.6 requires git sha / image tag / env-matrix row / run timestamp per
result. L0–L3 run on the host (ENV-DEV row, Doc 12 §3: suites spawn
`dist/server.cjs` themselves — no docker image involved); L4 runs on
ENV-PROD-MODE (docker compose). All items below are quoted from the cited
records.

| Level | Command / tool | Git sha / image / port | Run timestamp (evidence) | Evidence file |
|---|---|---|---|---|
| L0 | `npm run lint` (`tsc --noEmit`) | tree pin `f1df5bb` per log header | 2026-09-11 (board record; log has no date line) | `.omc/reports/w2fix3-standing-gates.log` §1 (`tsc_exit=0`) |
| L0 | `tsc --noEmit` (W3-FIX-1 gate block) | fix tree → `7d33fc8` | gates recorded in commit message (2026-09-11 17:04:25 +07) | git msg `7d33fc8` + `27b2622`: "tsc 0"; PROJECT-STATE W3-FIX-1 row |
| L1 | `npm run build` | tree pin `f1df5bb` | 2026-09-11 (as above) | `w2fix3-standing-gates.log` §2 (`build_exit=0`; `dist/server.cjs 158.1kb`) |
| L1 | `npm run build` (W3-FIX-1 gate block) | fix tree → `7d33fc8` | 2026-09-11 17:04:25 +07 | git msg `7d33fc8`: "build OK" (bundle size not recorded — §3.6) |
| L2 default | `node scripts/smoke-test.mjs` (in-memory, spawned `dist/server.cjs` :3210, NODE_ENV=production) | sha not embedded in report (§3.6) | report generated 2026-09-11T10:08:31.188Z; Node v24.13.1, darwin 25.5.0 | `.omc/reports/smoke-report.md` — "Result: **108/108 passed**" |
| L2 default (older transcripts) | same | `f1df5bb`; merge resolved tree (`c99abfb` pre-commit) | 2026-09-11 | `w2fix3-standing-gates.log` §3: 108/108 in 7.8s, `smoke_exit=0`; PROJECT-STATE W2-GATE-2 MERGE row: 108/108 (7.0s, exit 0) |
| L2 PG opt-in (`SMOKE_DATABASE_URL`) | smoke §15+§17+§18 vs disposable PostgreSQL | tree `feature/w3-fix-001-pool-error` (uncommitted fix, pre-review-commit → `7d33fc8`) | run 1 started 09:59:11Z; run 2 09:59:45Z | `w3fix1-pg-run-1.log`: 127/127 in 19.9s; `w3fix1-pg-run-2.log`: 127/127 in 19.7s; exit 0 per git msgs `7d33fc8`/`27b2622` |
| L2 PG opt-in (historical) | same | `b96f926e19427a37f43576c94ac0b2955b873bfd`; merge resolved tree | 07:25:40Z / 07:26:11Z / 08:44:10Z / 08:45:14Z | `w2fix6-pg-lead-run-{1,2}.log`: 127/127 19.0s/19.5s, `exit 0` in footers; `w2merge-pg-lead-run-{1,2}.log`: 127/127 18.9s/18.6s, `PG_EXIT=0` |
| L3 | `node tests/e2e-walkthrough.mjs` (Playwright, base `http://127.0.0.1:3220`) | sha not embedded in results JSON (§3.6) | results JSON finalized 10:04:13.853Z; execution window bounded by screenshot mtimes 10:00:17Z–10:04:13Z (§3.4) | `.omc/reports/e2e-results.json` + `.omc/reports/screenshots/` |
| L3 (older transcript) | same | `f1df5bb` | 2026-09-11 | `w2fix3-standing-gates.log` §4: `e2e_exit=0`, `PORT_3220_RELEASED=OK` |
| L4 original run | `docker compose up -d --build` + curl probes + `scripts/migrate.js` (ENV-PROD-MODE via `.env.w3l4` from `.env.production.example`) | git `cac252e6f734592aad285570e7c0586f0fbe5aaf` (`develop`); image `kbj-intranet:latest` id `1727c4fa8284`; **host port remapped 3000→3221** (§2.1) | 09:44:05Z (SYS-006 first pass) → 09:48:12Z stack up → 09:53:50Z teardown complete | `.omc/reports/w3-l4/` (l4-summary.md §1 + per-TC logs) |
| L4 re-run (TC-SYS-005 regression) | same stack, rebuilt image | git `7d33fc88f7e37135d7ba07a5ee3694cdd5931960` (`feature/w3-fix-001-pool-error`); image id `5f2b4eaa6ad7`; host 3221→3000 | 10:04:59Z–10:06:29Z | `w3-l4/tc-sys-005-rerun.log` |
| L4 teardown | `docker compose down -v` | — | 09:53:49Z–09:53:50Z (original); 10:06:28Z–10:06:29Z (re-run) | `w3-l4/teardown.log` (`down_exit=0`); rerun log (`idempotent_second_down_exit=0`, 0 residue) |

Tooling versions (L4, quoted from `w3-l4/l4-summary.md` §1): Docker server
29.2.0; docker compose v5.0.2; kubectl v1.34.1 (embedded kustomize v5.7.1).

### 2.1 Methodology notes (quoted from the L4 records)

- **Host-port override.** Host port 3000 was held by the operator's unrelated
  dev stack (`ltc-elearning-dev`, `/Users/narongsak/E-Leaning-LTC`) and was
  left untouched; the L4 stack published **3221:3000** via a gitignored
  compose override (`w3-l4/port-override.yml`, `ports: !override
  ["3221:3000"]`). Container-internal port :3000, both healthchecks, and the
  compose service topology are unaffected — probes targeted
  `http://localhost:3221` (l4-summary.md §1).
- **Test env file.** `.env.w3l4` created from `.env.production.example`
  (variable names only: `POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB
  SESSION_SECRET ADMIN_USERNAME ADMIN_PASSWORD`; disposable values, mode 600,
  gitignored; value of `SESSION_SECRET` never printed) — l4-summary.md §1.
- **Boot-time fail-fast is designed behavior (AVAIL-004).** An unreachable
  PostgreSQL **at boot** is a fatal exit with a clear error (no silent
  in-memory fallback) — Doc 12 §6.19 TC-AVAIL-004; PROJECT-STATE W3-1 row:
  "Boot-time fail-fast on unreachable PG is DESIGNED (AVAIL-004) — not a
  defect." The `[FATAL] PostgreSQL initialization failed` lines observed
  during the DEF-001 restart loop (§4) are this designed path, not a second
  defect.

---

## 3. Results per level

### 3.1 L0 — Static (`tsc --noEmit`)

| Run | Result | Evidence |
|---|---|---|
| Standing gate transcript, tree `f1df5bb` | **exit 0** (`tsc_exit=0`) | `w2fix3-standing-gates.log` §1 |
| W3-FIX-1 fix tree (→ `7d33fc8`) | **tsc 0** | git msg `7d33fc8` ("Gates on this tree: tsc --noEmit 0") and merge msg `27b2622`; PROJECT-STATE W3-FIX-1 row |

Strict mode has been the standing merge gate since W2-4 (tsconfig `strict`
flip `97bef96`, merged `a07885e` — PROJECT-STATE W2-4 row). **L0 verdict:
PASS (exit 0).**

### 3.2 L1 — Build (`npm run build`)

| Run | Result | Evidence |
|---|---|---|
| Standing gate transcript, tree `f1df5bb` | **exit 0** (`build_exit=0`); artifacts present: `dist/index.html`, `dist/assets/*` (SPA), `dist/server.cjs 158.1kb` + map | `w2fix3-standing-gates.log` §2 |
| W2-FIX-6 / merge resolved tree | build OK (`dist/server.cjs 158.5kb`) | PROJECT-STATE W2-FIX-6 and W2-GATE-2 MERGE rows |
| W3-FIX-1 fix tree (→ `7d33fc8`) | **build OK** (bundle size not recorded in the archived gate records — §3.6) | git msgs `7d33fc8` / `27b2622`; PROJECT-STATE W3-FIX-1 row |

**L1 verdict: PASS (exit 0, both artifacts present).**

### 3.3 L2 — Smoke / API (`scripts/smoke-test.mjs`)

Default mode (in-memory, spawned `dist/server.cjs`, NODE_ENV=production,
UPLOAD_DIR=./uploads-test):

| Run | Count (verbatim) | Duration | Exit | Evidence |
|---|---|---|---|---|
| Latest archived report | **108/108 passed** | not recorded in report file (§3.6) | per gate records: exit 0 | `smoke-report.md` (generated 2026-09-11T10:08:31.188Z, Node v24.13.1 darwin 25.5.0, target :3210) |
| `f1df5bb` transcript | **108/108 checks passed** | 7.8s | `smoke_exit=0` | `w2fix3-standing-gates.log` §3 |
| Merge resolved tree | **108/108** | 7.0s | exit 0 | PROJECT-STATE W2-GATE-2 MERGE row |

PG opt-in mode (`SMOKE_DATABASE_URL` set → §15 + §17-PG + §18 checks; 127
total per Doc 12 R2):

| Run | Count (verbatim) | Duration | Exit | Evidence |
|---|---|---|---|---|
| W3-FIX-1 run 1 (09:59:11Z) | **127/127 checks passed** | 19.9s | exit 0 (attested in git msgs — §3.6) | `w3fix1-pg-run-1.log` |
| W3-FIX-1 run 2 (09:59:45Z) | **127/127 checks passed** | 19.7s | exit 0 (attested in git msgs — §3.6) | `w3fix1-pg-run-2.log` |
| W2-FIX-6 lead run 1 (`b96f926`, 07:25:40Z) | **127/127 checks passed** | 19.0s | `exit 0` (log footer; tree-clean-files 0) | `w2fix6-pg-lead-run-1.log` |
| W2-FIX-6 lead run 2 (07:26:11Z) | **127/127 checks passed** | 19.5s | `exit 0` (log footer) | `w2fix6-pg-lead-run-2.log` |
| Merge resolved tree run 1 (08:44:10Z) | **127/127 checks passed** | 18.9s | `PG_EXIT=0` | `w2merge-pg-lead-run-1.log` |
| Merge resolved tree run 2 (08:45:14Z) | **127/127 checks passed** | 18.6s | `PG_EXIT=0` | `w2merge-pg-lead-run-2.log` |

Suite character (Doc 12 R2): 19 sections (0–18); §14 rate-limit runs last;
§16 runs before §14 (key-saturation ordering — PROJECT-STATE W2-3 code-phase
row); §15/§17-PG/§18 are the PG opt-ins. The archived PG logs additionally
show the §18 pause-gated cross-pod families (S/O/N/F) quoting observed
synchronization (paused pid, blocked-by pid, polls/ms) in every O/N PASS
detail — e.g. `w3fix1-pg-run-1.log` §18 rows.

**L2 verdict: PASS — default 108/108; PG opt-in 127/127 ×2 on the W3-FIX-1
tree (×6 archived green runs total incl. W2-FIX-6 and the merge resolved
tree). Zero FAIL lines in the archived reports.**

### 3.4 L3 — E2E walkthrough (`tests/e2e-walkthrough.mjs`)

Results record `.omc/reports/e2e-results.json` (base
`http://127.0.0.1:3220`): 64 result rows with statuses **63 PASS / 1 FLAKY /
0 FAIL** (counts object `{"flaky":1,"pass":63}` — no fail-status rows exist;
63 + 1 = 64 rows all accounted).

**FLAKY disposition (Doc 12 §9 rule 4 — FLAKY ≠ PASS without retry
evidence):** the single FLAKY is step `S0` ("Bootstrap: admin login + role
users provisioned via /api/users") with embedded retry evidence —
`"passed on retry: maker01:exists, checker01:exists, staff01:exists"`
(e2e-results.json results[0]). One FLAKY ≤ the L3 exit threshold of 2; the
"two FLAKY on the same step = FAIL" rule is not triggered. The same S0
retry signature appears in the older transcript (`w2fix3-standing-gates.log`
§4: `[FLKY] S0 Bootstrap … passed on retry`), identifying it as the known
S0-retry signature recorded in the W2 gate rows (PROJECT-STATE: "63 PASS / 1
FLAKY (known S0-retry) / 0 FAIL exit 0").

Exit status and port release: `e2e_exit=0` + `PORT_3220_RELEASED=OK` are
recorded verbatim in `w2fix3-standing-gates.log` §4 (older run); for the
2026-09-11T10:04Z run, exit 0 is recorded in the W3-FIX-1 gate block (git
msgs `7d33fc8`/`27b2622`; PROJECT-STATE W3-FIX-1 row).

Visual record: `.omc/reports/screenshots/` contains 46 PNGs with mtimes
2026-09-11 17:00:17–17:04:13 +07 (= 10:00:17Z–10:04:13Z), bounding this
run's execution window; 18 older files from a 2026-09-10 run persist because
the harness writes fixed filenames without run-id scoping (divergence from
Doc 12 §9.5 "keep them per run-id" — noted for the lead, §5.1).

**L3 verdict: PASS — 63 PASS / 1 FLAKY (S0, retry evidence attached) / 0
FAIL.**

### 3.5 L4 — System test (compose stack, ENV-PROD-MODE)

Executed set: TC-SYS-001..006 (Doc 12 §6.18) + TC-AVAIL-003/005 (Doc 12
§6.19) — the W3-1 scope (PROJECT-STATE W3-1 row). **8/8 PASS after the
W3-FIX-1 re-run** (original run 7 PASS / 1 FAIL; the FAIL closed as DEF-001,
§4).

| TC | Verdict | One-line evidence pointer |
|---|---|---|
| TC-SYS-001 compose stack boots healthy | **PASS** | `tc-sys-001.log`: `up -d --build` `up_exit=0` (09:48:12Z); both containers healthy ~5 s; app `0.0.0.0:3221->3000`; `\dt` lists all 10 tables (users … audit_logs), `psql_dt_exit=0` — schema auto-applied on empty pgdata |
| TC-SYS-002 data survives restart | **PASS** | `tc-sys-002.log`: login 200; POST /api/news 201 (marker `W3L4-SYS002-1789120134`); `restart app` exit 0, healthy again ~9 s; GET /api/news 200 with marker present; session cookie also survived (sessions durable) |
| TC-SYS-003 schema.sql idempotent | **PASS** | `tc-sys-003.log`: schema.sql piped ×2 with `ON_ERROR_STOP=1` — run 1 exit 0 / 0 ERROR lines, run 2 exit 0 / 0 ERROR lines (a first invocation attempt hit a zsh word-splitting artifact, exit 127, re-run clean — logged for honesty) |
| TC-SYS-004 export → migrate round-trip | **PASS** | `tc-sys-004.log` + `export.json`: GET /api/system/export 200, counts `{news:13, banners:5, contacts:8, rooms:5, documents:7, auditLogs:5, syncLogs:3}` (verified against the artifact's `counts` object); disposable `postgres:16` (`w3l4-migrate`, host 55439); `node scripts/migrate.js` exit 0; psql COUNTs match export for all 7 tables; marker row present; container removed |
| TC-SYS-005 readiness pulls pod when DB dies | **PASS (re-run on fix `7d33fc8`; original FAIL record retained)** | Re-run `tc-sys-005-rerun.log` (image `5f2b4eaa6ad7`): outage 10:05:30Z→recovery — /readyz **503** ×5 samples (10:05:40–10:05:52Z) with body `{"status":"not_ready","probe":"readiness","reason":"Database unavailable"}`, /healthz **200** ×5, `RestartCount=0` throughout, pool-error handler line fired once at `10:05:30.106Z`, recovery /readyz 200 in **1 s** (10:06:17Z), post-recovery login 200 + GET /api/news 200 (26 292 B). Original `tc-sys-005.log`: FAIL — see DEF-001 (§4) |
| TC-SYS-006 manifest validation | **PASS** (precondition noted — obs-1, §4) | `tc-sys-006.log`: `docker compose … config -q` exit 0 (re-validated with override files, exit 0); `kubectl kustomize k8s` bare-checkout `exit_code=1` (`secret.yaml: no such file`), exit 0 after the documented `cp k8s/secret.example.yaml k8s/secret.yaml` — post-copy success **re-executed by the lead 2026-09-11T10:20:33Z with raw-log capture** (`tc-sys-006-kustomize-rerun.log` @ `7b23fd4`: `kustomize_exit=0`, 388-line render, 11 kind entries — ConfigMap/Deployment/HPA/Ingress/Namespace/NetworkPolicy ×3/PVC/Secret/Service), reproducing l4-summary.md §2 exactly; secret.yaml removed after (bare-checkout state restored) |
| TC-AVAIL-003 graceful shutdown | **PASS** | `tc-avail-003.log`: `stop app` (SIGTERM) 09:53:05Z; logs show the exact sequence `[SIGTERM] Received. Starting graceful shutdown sequence...` → `HTTP server closed cleanly. Kubernetes pod ready to terminate.` → `Database pool closed.`; `ExitCode=0`, `OOMKilled=false`, finished same second |
| TC-AVAIL-005 backup & data portability | **PASS** | `tc-avail-005.log`: postgres healthcheck `pg_isready -U kbj -d kbj_intranet` (5 s interval, 12 retries, 10 s start-period — gating observed; app start gated on `service_healthy` in tc-sys-001.log); app healthcheck `wget /healthz` internal :3000; volumes `kbj-internal-web_uploads` + `kbj-internal-web_pgdata` present; export artifact reused by SYS-004 with matching counts; news count 13 intact after the SYS-005 crash cycle |

**L4 coverage notes (honest reporting per Doc 12 §9.3):**

- **TC-AVAIL-001 / TC-AVAIL-002** — not scripted as standalone rows this
  window; their core expectations were exercised **inside the TC-SYS-005
  outage window** (Doc 12 §6.19 defines AVAIL-002 as overlapping TC-SYS-005):
  /healthz stayed 200 with the DB down (AVAIL-001 liveness expectation) and
  /readyz returned 503 `not_ready` (AVAIL-002 readiness expectation) — 5/5
  samples each, `tc-sys-005-rerun.log`. Standalone rows: covered by overlap,
  not separately executed.
- **TC-AVAIL-004** — durability half evidenced via TC-SYS-002 + TC-AVAIL-005
  (content/users/sessions persisted; counts intact after crash cycle);
  fail-fast half observed incidentally during DEF-001 (designed behavior,
  §2.1). Standalone row: **NOT TESTED** as a separate scripted case this
  window.
- **TC-AVAIL-006** (process resilience) — **NOT TESTED** this window; no
  archived execution exists under `.omc/reports/`.

**L4 verdict: PASS — 8/8 (TC-SYS-001..006 + TC-AVAIL-003/005), with
TC-SYS-005 passing on the W3-FIX-1 regression re-run and the original FAIL
retained per annotate-not-rewrite.**

### 3.6 Evidence gaps recorded (per Doc 12 §9 — no guessing)

1. **W3-FIX-1 build bundle size** — the archived gate records (git msgs
   `7d33fc8`/`27b2622`, PROJECT-STATE W3-FIX-1 row) state "build OK" only; no
   byte size is recorded for that tree. (For reference, recorded sizes:
   158.1kb @ `f1df5bb` transcript; 158.5kb @ W2-FIX-6/merge rows.)
2. **Latest default-smoke duration** — `smoke-report.md` does not embed a
   duration; durations are quoted only where a transcript records them
   (7.8s @ `f1df5bb`; 7.0s @ merge resolved tree).
3. **W3-FIX-1 PG-run exit codes** — `w3fix1-pg-run-{1,2}.log` have no
   exit-code footer (unlike the w2fix6/w2merge logs); exit 0 for both runs is
   attested in the merge-committed gate blocks (git msgs `7d33fc8`/`27b2622`:
   "exit 0, logs .omc/reports/w3fix1-pg-run-{1,2}.log").
4. **sha provenance of L2-default / L3 artifacts** — `smoke-report.md` and
   `e2e-results.json` do not embed a git sha; tree identity rests on the
   timestamps (10:08:31Z report; 10:00–10:04Z screenshots) plus the gate
   blocks recorded in the W3-FIX-1 commit/merge messages and PROJECT-STATE.
5. **`e2e-results.json` `startedAt` semantics** — the field is set at
   results-write time (`tests/e2e-walkthrough.mjs:1405-1407`), i.e. it is the
   finalize timestamp; the actual execution window is bounded by the
   screenshot mtimes (10:00:17Z–10:04:13Z). Cited accordingly in §2.
6. **TC-SYS-006 kustomize success render** — *(closed in this revision,*
   v1.0.1*)* — originally present in `l4-summary.md` §2 only; the raw
   `tc-sys-006.log` records the bare-checkout failure (exit 1) and the compose
   validations, but not the post-copy kustomize exit-0 line. **Closed by the
   lead re-execution** 2026-09-11T10:20:33Z @ `7b23fd4`
   (`tc-sys-006-kustomize-rerun.log`: `kustomize_exit=0`, 388-line render,
   11 kind entries — byte-consistent with the summary claim).

---

## 4. Defects & observations register

Format per Doc 12 §8: id, TC, severity, evidence, environment. Severity
classes per Doc 12 §8 (S1 Critical / S2 Major / S3 Minor / S4 Cosmetic).
Re-test closure requires re-run evidence (§8 triage rule) — attached for
DEF-001.

### DEF-001 — unhandled pg pool `error` event crashes the app on out-of-band PG termination (CLOSED)

| Field | Record |
|---|---|
| id / TC | **DEF-001** / TC-SYS-005 (also breaks the AVAIL-001/002 overlap expectations — liveness must stay 200, readiness must report 503 `not_ready` during the outage) |
| Severity | **S2 Major** (Doc 12 §8: core function fails with wrong behavior; workaround exists — the Docker restart policy recovers the pod once PG returns; no data loss, no security impact) — as registered in `w3-l4/l4-summary.md` §3 and PROJECT-STATE W3-1 row |
| Found | 2026-09-11T09:50:32Z, original L4 run (git `cac252e…`, image `1727c4fa8284`) — `tc-sys-005.log` |
| Finding | `docker compose stop postgres` → server log `error: terminating connection due to administrator command` → node-pg `BoundPool` emits an unhandled `'error'` event (`throw er; // Unhandled 'error' event`, `Emitted 'error' event on BoundPool instance`) → process exits → Docker restart-loops on the designed boot fail-fast (`[FATAL] PostgreSQL initialization failed: getaddrinfo ENOTFOUND postgres`, §2.1). During the outage BOTH `/readyz` and `/healthz` were TCP-refused (`readyz_http=000`) — readiness never reported `not_ready` and liveness died with the process, breaking the 503-not_ready contract and NFR-AVAIL-001/002. Restart accounting: `RestartCount=9` during the outage, final `RestartCount=10` after recovery. Recovery itself worked: `/readyz` 200 after 43 s (bounded 60 s), data intact |
| Root cause | No `pool.on('error', …)` handler on the idle-client error path — node-postgres requires one to survive out-of-band server termination (l4-summary.md §3 root-cause hint) |
| Fix | **`7d33fc8`** (2026-09-11 17:04:25 +07, `feature/w3-fix-001-pool-error`, +6 lines): `pool.on('error')` structured stderr log in the `PostgresRepository` constructor; boot fail-fast, readyz probe, and per-request paths untouched (fix commit message) |
| Fix-tree gates | tsc 0 · build OK · smoke 108/108 · PG-mode 127/127 ×2 (19.9s/19.7s) · e2e 63/1-FLAKY-known/0 FAIL exit 0 (git msgs `7d33fc8`/`27b2622`) |
| Re-test evidence | `tc-sys-005-rerun.log` (image `5f2b4eaa6ad7`, window 10:04:59Z–10:06:29Z): outage window 5/5 samples /readyz=503 + /healthz=200; `RestartCount=0` before/during/after; handler fired exactly once at the stop moment (`10:05:30.106Z`, single line, no FATAL, no crash footer); recovery /readyz 200 in **1 s** (was 43 s restart-backoff); post-recovery login 200 + GET /api/news 200 (26 292 B); teardown `down -v` clean, `idempotent_second_down_exit=0`, 0 residue |
| Status | **CLOSED** — fix merged to develop at **`27b2622`** (2026-09-11 17:08:21 +07; availability lane, lead merge authority; codex visibility rides at this Doc 17 gate). Original FAIL record retained per annotate-not-rewrite |

### Observations (non-defect)

| id | TC | Severity | Observation | Evidence |
|---|---|---|---|---|
| obs-1 | TC-SYS-006 | S4 (doc/CI ergonomics) | Bare-checkout `kubectl kustomize k8s` exits 1 (`secret.yaml: no such file`) until the documented deploy step `cp k8s/secret.example.yaml k8s/secret.yaml` (README L84–86, kustomization.yaml L9–11). Intended secrets hygiene — any CI manifest gate must include the copy step. Process note for CI gates | `tc-sys-006.log` (exit_code=1 + error text); l4-summary.md §3 |
| obs-2 | TC-SYS-006 | S4 (hardening) | `k8s/secret.yaml` was not covered by `.gitignore` despite "never commit" docs; fixed by lead commit **`cac252e`** (2026-09-11 16:46:45 +07) during the W3-1 run | `tc-sys-006.log` context; l4-summary.md §3; git log `cac252e` |

---

## 5. Exit-criteria assessment (Doc 12 §7)

| Level | Exit criteria (quoted from Doc 12 §7) | Assessment | Evidence |
|---|---|---|---|
| L0 Static | "`tsc --noEmit` exit 0" | **MET** | §3.1 — `tsc_exit=0` @ `f1df5bb`; "tsc 0" @ W3-FIX-1 gate block |
| L1 Build | "`npm run build` exit 0; both artifacts present" | **MET** | §3.2 — `build_exit=0` + `dist/` + `dist/server.cjs` @ `f1df5bb`; "build OK" @ W3-FIX-1 gate block |
| L2 Smoke | "All checks PASS; exit 0; smoke-report.md written; zero FAIL lines" | **MET** | §3.3 — 108/108 default (`smoke-report.md` written); 127/127 PG ×2 on the fix tree; zero FAIL lines in archived reports |
| L3 E2E | "0 FAIL; FLAKY ≤ 2 with retry evidence; screenshots + e2e-results.json archived" | **MET** | §3.4 — 63 PASS / 1 FLAKY (retry evidence embedded) / 0 FAIL; screenshots + JSON archived |
| L4 System | "All TC-SYS-* pass; stack torn down cleanly" | **MET** | §3.5 — TC-SYS-001..006 all PASS (005 via re-run); teardown `down_exit=0`, 0 containers/volumes/networks residue, working tree clean |
| L5 Security | (not in this document's scope) | **OPEN** — Wave 3 continues (W3-3) | — |
| L6 UAT | (not in this document's scope) | **OPEN** — queued behind L5 exit (W3-4) | — |
| Release (Doc 17 gate) | "All levels exited" + merge gates + codex PASS for auth/security lanes | **NOT YET** — L5/L6 remain | — |

**Overall statement.** Levels **L0–L4 are EXITED** against Doc 12 §7 as of
2026-09-11, on `develop` head `7b23fd4` (including the DEF-001 fix `7d33fc8`
merged at `27b2622`). The single defect found in this window (DEF-001, S2)
is closed with re-run evidence. **L5 (security → Doc 19) and L6 (UAT → Doc
18) remain open Wave-3 work**, per the Doc 12 §10 deliverable mapping and the
PROJECT-STATE §3 Wave-3 board; the Release gate therefore cannot be declared
from this document.

### 5.1 Items flagged for lead review (worker-5 judgment calls)

1. **TC-SYS-006 evidence shape** — the post-secret-copy kustomize exit-0
   (388-line render / 11 kind entries) exists only in `l4-summary.md`; the
   raw log stops at the bare-checkout failure + compose validations. Verdict
   reported PASS per the summary; if a raw-log-only standard is applied, this
   row's kustomize half should be re-executed with the transcript captured.
2. **Exit-code attestation for `w3fix1-pg-run-{1,2}.log`** — exit 0 is cited
   from the merge-committed gate blocks, not from a footer inside the logs
   (§3.6 item 3).
3. **`e2e-results.json` `startedAt` misnomer** — set at write time; run
   window reported via screenshot mtimes instead (§3.6 item 5).
4. **Screenshots not run-id scoped** — the harness overwrites fixed
   filenames, so 18 stale files from a 2026-09-10 run sit alongside this
   run's 46; diverges from Doc 12 §9.5. Recommend a run-id subdirectory if
   Doc 18/21 will reuse capture sets.
5. **AVAIL-001/002/004/006 reporting posture** — covered-by-overlap /
   incidentally-evidenced / NOT TESTED as stated in §3.5; confirm the lead
   accepts overlap coverage for 001/002 or schedules standalone rows before
   the Release gate.

### 5.2 Lead review rulings (2026-09-11, v1.0.1)

Disposition of each §5.1 item — rulings recorded here rather than rewriting
the worker's text (annotate-not-rewrite):

1. **TC-SYS-006 evidence shape → CLOSED by re-execution.** The lead
   re-ran the kustomize half with raw-log capture
   (`tc-sys-006-kustomize-rerun.log`, exit 0, 388 lines, 11 kinds @
   `7b23fd4`) — the raw-log-only standard is now met; row PASS stands on
   primary evidence, not summary attestation.
2. **PG exit-code attestation → ACCEPTED.** The gate blocks committed in
   `7d33fc8` and `27b2622` are durable, hash-addressable records produced at
   run time by the operator who executed the runs; equivalence to a log
   footer is accepted for this document. Future lead-run logs keep the
   footer convention (as in the w2fix6/w2merge logs).
3. **`startedAt` semantics → ACCEPTED as documented.** §3.6 item 5's
   write-time explanation plus the screenshot-mtime window bound is an
   honest, sufficient execution-window proof. No harness change required
   for Doc 17.
4. **Screenshot run-id scoping → ACCEPTED as a queued action, not a Doc 17
   blocker.** The 18 stale 2026-09-10 files are quarantined by mtime and the
   §3.4/§6 citations bound this run's 46 files explicitly. Action queued:
   harness scoping (run-id subdirectory) lands **before** W3-4/W3-5, which
   are the lanes that reuse capture sets (recorded in PROJECT-STATE W3-4
   row).
5. **AVAIL reporting posture → ACCEPTED per Doc 12 design.** §6.19 defines
   TC-AVAIL-002 as overlapping TC-SYS-005, so overlap coverage is the
   specified method, not a shortcut; AVAIL-001's liveness expectation was
   sampled 5/5 inside the same outage window (re-run log). AVAIL-004's
   fail-fast half is designed behavior observed incidentally during DEF-001
   (§2.1) — standalone row remains **NOT TESTED**, and **TC-AVAIL-006
   remains NOT TESTED**; both ride to the Release-gate review as open items
   on the L4 ledger (visible in §3.5), not silently closed.

---

## 6. Evidence index

All paths relative to repo root; every file below was read for this document.
Evidence files are unmodified archives (no edits by this author).

**L2 / smoke**

- `.omc/reports/smoke-report.md` — latest default-mode smoke report: 108/108
  passed; generated 2026-09-11T10:08:31.188Z; Node v24.13.1 darwin 25.5.0;
  spawned `dist/server.cjs` on :3210; in-memory mode.
- `.omc/reports/w3fix1-pg-run-1.log` — W3-FIX-1 PG opt-in run 1: 127/127 in
  19.9s; started 2026-09-11T09:59:11Z; header pins tree
  `feature/w3-fix-001-pool-error` (uncommitted fix, pre-review-commit).
- `.omc/reports/w3fix1-pg-run-2.log` — W3-FIX-1 PG opt-in run 2: 127/127 in
  19.7s; started 2026-09-11T09:59:45Z; same tree pin.
- `.omc/reports/w2fix6-pg-lead-run-1.log` — 127/127 in 19.0s; commit
  `b96f926e…`; started 07:25:40Z; footer `exit 0`, `tree-clean-files 0`.
- `.omc/reports/w2fix6-pg-lead-run-2.log` — 127/127 in 19.5s; commit
  `b96f926e…`; started 07:26:11Z; footer `exit 0`.
- `.omc/reports/w2merge-pg-lead-run-1.log` — 127/127 in 18.9s; W2-GATE-2
  merge resolved tree (develop + bb7b671, pre-commit); 08:44:10Z;
  `PG_EXIT=0`.
- `.omc/reports/w2merge-pg-lead-run-2.log` — 127/127 in 18.6s; same tree;
  08:45:14Z; `PG_EXIT=0`.

**L0 / L1 / L2 / L3 standing-gate transcript (older)**

- `.omc/reports/w2fix3-standing-gates.log` — full gate transcript at tree pin
  `f1df5bb`: `tsc_exit=0`; `build_exit=0` (`dist/server.cjs 158.1kb`); smoke
  108/108 in 7.8s (`smoke_exit=0`); e2e 63/0/1 with the S0 `[FLKY]` retry
  line, `e2e_exit=0`, `PORT_3220_RELEASED=OK`; PG 117/117 in 16.9s
  (pre-§18-expansion count, Doc 12 v1.10.0 era).

**L3 / e2e**

- `.omc/reports/e2e-results.json` — L3 run record: 64 rows (63 PASS + 1
  FLAKY S0 with retry evidence); counts `{"flaky":1,"pass":63}`; base
  `http://127.0.0.1:3220`; finalized 2026-09-11T10:04:13.853Z.
- `.omc/reports/screenshots/` — 46 PNGs mtimed 10:00:17Z–10:04:13Z (this
  run) + 18 stale files from 2026-09-10 (see §5.1 item 4).

**L4 / system test (`.omc/reports/w3-l4/`)**

- `l4-summary.md` — W3-1 executor summary: provenance, per-TC verdict table,
  §2.1 re-run record, defects register, teardown.
- `tc-sys-001.log` — compose boot: `up_exit=0`, healthy ~5 s, 10 tables,
  `psql_dt_exit=0`.
- `tc-sys-002.log` — restart persistence: marker `W3L4-SYS002-1789120134`
  survives `restart app`.
- `tc-sys-003.log` — schema.sql ×2 idempotent under `ON_ERROR_STOP=1`.
- `tc-sys-004.log` — export→migrate round-trip; counts match all 7 tables.
- `tc-sys-005.log` — original FAIL record (DEF-001): crash + restart loop +
  43 s recovery.
- `tc-sys-005-rerun.log` — W3-FIX-1 regression PASS on `7d33fc8` / image
  `5f2b4eaa6ad7`: 503/200 sampling, RestartCount 0, 1 s recovery.
- `tc-sys-006.log` — manifest validation: compose config exit 0; bare
  kustomize exit 1 (obs-1); compose-with-override exit 0.
- `tc-sys-006-kustomize-rerun.log` — lead evidence-closure re-run
  (v1.0.1): post-secret-copy `kubectl kustomize k8s` exit 0, 388-line
  render, 11 kind entries @ `7b23fd4`, 2026-09-11T10:20:33Z; secret.yaml
  removed after (bare-checkout state restored).
- `tc-avail-003.log` — graceful shutdown sequence + `ExitCode=0`.
- `tc-avail-005.log` — healthcheck gating, volumes, portability checks.
- `export.json` — SYS-004 artifact (counts
  `{news:13, banners:5, contacts:8, rooms:5, documents:7, auditLogs:5,
  syncLogs:3}`; `storage: postgres`; `version: 2.0.0`).
- `port-override.yml` — gitignored host-port override 3221:3000 with the
  lead-ruling comment block.
- `teardown.log` — `down -v` exit 0; 0 residue containers/volumes/networks.

**Committed records (git)**

- `7d33fc8` — DEF-001 fix commit; message carries the fix-tree gate block
  (tsc 0 · build OK · smoke 108/108 · PG 127/127 ×2 19.9s/19.7s exit 0 · e2e
  63/1 FLAKY-known/0 FAIL exit 0).
- `27b2622` — merge to develop (DEF-001 closed, L4 exit 8/8); message
  repeats the gate block + re-run summary.
- `cac252e` — obs-2 hardening: `k8s/secret.yaml` gitignored (W3-1 obs-2).
- `c99abfb` — W2-GATE-2 merge of the Wave-2 P0 chain (system-under-test
  baseline; PROJECT-STATE §3).
- `PROJECT-STATE.md` §3 rows (W3-1, W3-FIX-1, W2-GATE-2 MERGE, W2-4) and
  `.omc/artifacts/cto-gate-wave2-verdict-6.md` (referenced for lineage only).
