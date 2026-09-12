# Deliverable 17 — System Test Result

**Version:** 1.1.2 · **Status:** **Approved** (codex re-gate 2 @ `f11e4fe`, 2026-09-11 — `.omc/artifacts/cto-gate-doc17-regate2-verdict.md`) · **Date:** 2026-09-11 · **Author:** worker-5 → Lead review → CTO approval

> v1.0.1 (lead review pass): TC-SYS-006 kustomize half re-executed by the
> lead with raw-log capture (`tc-sys-006-kustomize-rerun.log`) closing §3.6
> item 6; §5.2 records the lead rulings on the worker's five flagged judgment
> calls. No verdicts changed.
>
> v1.1.0 (codex doc17-gate fix cycle 1): the CTO gate verdict
> `.omc/artifacts/cto-gate-doc17-verdict.md` returned **REVISE** with four
> blocking revisions; all four are closed in this revision — (1) TC-SYS-004
> re-executed with the **specified in-memory source precondition**
> (`w3-l4/tc-sys-004-inmemory.log`); (2) per-TC L2/L3 coverage map added as
> **Appendix A**; (3) current-head standing-gate transcript
> `w3r1-standing-gates.log` (tsc / build / default smoke / e2e / PG-mode ×2,
> exit tokens quoted verbatim) restores the Doc 12 §9 transcript evidence
> form; (4) both e2e capture sets archived in run-id directories with
> SHA256 manifests (`screenshots-archive/run-2026-09-11T1000Z-e2e/`,
> `screenshots-archive/run-2026-09-11T1031Z-e2e-w3r1/`; stale-18
> quarantined). §5.2 rulings 2 and 4 annotated OVERTURNED by the gate.
> Gap history retained per annotate-not-rewrite.
>
> v1.1.1 (codex re-gate 1 fix): blockers 1/3/4 verified CLOSED; the residual
> blocker-2 items closed by executed assertions — TC-USER-008 (actual
> DELETE→404 JSON, both unknown and real id) and TC-NEWS-004 (merge
> semantics: PUT summary-only 200 with preserved title/titleEn/content in
> the response data) via `w3r2-gap-closures.log` @ `db6dde6`; TC-ROOM-003
> recaptured with an explicit `book1_http=200` token (regate-1 NIT: the
> first run's status token was consumed by the pretty-print pipe); Appendix
> intro totals reconciled to A.19 (100/18/39); §6 provenance qualifications
> for the overwritten live artifacts. Totals unchanged — the two rows were
> already counted PASS; their evidence now establishes the specified
> assertions.

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
| L0 | `tsc --noEmit` (W3-2R current-head transcript) | `c3874a9` (develop; log header: `git c3874a9 (develop) · dirty: 0 entries`) | transcript window 2026-09-11T10:28:28Z–10:33:21Z | `w3r1-standing-gates.log` §1 (`tsc_exit=0`) |
| L1 | `npm run build` | tree pin `f1df5bb` | 2026-09-11 (as above) | `w2fix3-standing-gates.log` §2 (`build_exit=0`; `dist/server.cjs 158.1kb`) |
| L1 | `npm run build` (W3-FIX-1 gate block) | fix tree → `7d33fc8` | 2026-09-11 17:04:25 +07 | git msg `7d33fc8`: "build OK" (bundle size not recorded — §3.6, closed v1.1.0) |
| L1 | `npm run build` (W3-2R current-head transcript) | `c3874a9` (log header pin, tree clean) | within 10:28:28Z–10:33:21Z | `w3r1-standing-gates.log` §2 (`build_exit=0`; `artifact: dist/server.cjs 162543 bytes`) |
| L2 default | `node scripts/smoke-test.mjs` (in-memory, spawned `dist/server.cjs` :3210, NODE_ENV=production) | sha not embedded in report (§3.6) | report generated 2026-09-11T10:08:31.188Z; Node v24.13.1, darwin 25.5.0 | `.omc/reports/smoke-report.md` — "Result: **108/108 passed**" |
| L2 default (older transcripts) | same | `f1df5bb`; merge resolved tree (`c99abfb` pre-commit) | 2026-09-11 | `w2fix3-standing-gates.log` §3: 108/108 in 7.8s, `smoke_exit=0`; PROJECT-STATE W2-GATE-2 MERGE row: 108/108 (7.0s, exit 0) |
| L2 default (W3-2R current-head transcript) | same | `c3874a9` (log header pin; node v24.13.1, npm 11.18.0) | within 10:28:28Z–10:33:21Z | `w3r1-standing-gates.log` §3: **108/108 checks passed in 7.8s**, `smoke_exit=0` (section headers §0–§14, §16, §17 visible; §15/§18 are the PG opt-ins) |
| L2 PG opt-in (`SMOKE_DATABASE_URL`) | smoke §15+§17+§18 vs disposable PostgreSQL | tree `feature/w3-fix-001-pool-error` (uncommitted fix, pre-review-commit → `7d33fc8`) | run 1 started 09:59:11Z; run 2 09:59:45Z | `w3fix1-pg-run-1.log`: 127/127 in 19.9s; `w3fix1-pg-run-2.log`: 127/127 in 19.7s; exit 0 per git msgs `7d33fc8`/`27b2622` (footer-form closure: §3.6 item 3) |
| L2 PG opt-in (W3-2R current-head transcript) | same | `c3874a9` (log header pin) | run 1 started 10:32:40Z; run 2 10:33:01Z | `w3r1-standing-gates.log` §5: **127/127 checks passed in 19.7s** `pg1_exit=0` (container removed); **127/127 checks passed in 19.5s** `pg2_exit=0` (container removed) |
| L2 PG opt-in (historical) | same | `b96f926e19427a37f43576c94ac0b2955b873bfd`; merge resolved tree | 07:25:40Z / 07:26:11Z / 08:44:10Z / 08:45:14Z | `w2fix6-pg-lead-run-{1,2}.log`: 127/127 19.0s/19.5s, `exit 0` in footers; `w2merge-pg-lead-run-{1,2}.log`: 127/127 18.9s/18.6s, `PG_EXIT=0` |
| L3 | `node tests/e2e-walkthrough.mjs` (Playwright, base `http://127.0.0.1:3220`) | sha not embedded in results JSON (§3.6) | results JSON finalized 10:04:13.853Z; observed capture interval bounded by screenshot mtimes 10:00:17Z–10:04:13Z (§3.4; v1.1.0: that JSON has since been overwritten on disk by the W3-2R run — same counts — and the 10:00Z capture set is preserved in `screenshots-archive/run-2026-09-11T1000Z-e2e/`) | `e2e-results.json` (as of 10:04:13.853Z; superseded on disk, §3.4) + `screenshots-archive/run-2026-09-11T1000Z-e2e/` |
| L3 (older transcript) | same | `f1df5bb` | 2026-09-11 | `w2fix3-standing-gates.log` §4: `e2e_exit=0`, `PORT_3220_RELEASED=OK` |
| L3 (W3-2R current-head transcript) | same | `c3874a9` (log header pin) | e2e section 10:28:39Z–10:31:07Z; results finalized 10:32:38.219Z | `w3r1-standing-gates.log` §4: `e2e_server_healthz=200`; `PASS=63 FAIL=0 FLAKY=1`; `e2e_exit=0`; `e2e_counts={"flaky":1,"pass":63} rows=64 finalizedAt=2026-09-11T10:32:38.219Z`; `PORT_3220_RELEASED=OK` |
| L4 original run | `docker compose up -d --build` + curl probes + `scripts/migrate.js` (ENV-PROD-MODE via `.env.w3l4` from `.env.production.example`) | git `cac252e6f734592aad285570e7c0586f0fbe5aaf` (`develop`); image `kbj-intranet:latest` id `1727c4fa8284`; **host port remapped 3000→3221** (§2.1) | 09:44:05Z (SYS-006 first pass) → 09:48:12Z stack up → 09:53:50Z teardown complete | `.omc/reports/w3-l4/` (l4-summary.md §1 + per-TC logs) |
| L4 re-run (TC-SYS-005 regression) | same stack, rebuilt image | git `7d33fc88f7e37135d7ba07a5ee3694cdd5931960` (`feature/w3-fix-001-pool-error`); image id `5f2b4eaa6ad7`; host 3221→3000 | 10:04:59Z–10:06:29Z | `w3-l4/tc-sys-005-rerun.log` |
| L4 re-run (TC-SYS-004 specified precondition) | host-run in-memory prod server :3232 (NODE_ENV=production, **no DATABASE_URL**) → GET /api/system/export → `node scripts/migrate.js` vs fresh disposable `postgres:16` :55446 | git `c3874a9` (develop, per log header) | 10:29:22Z–10:29:27Z | `w3-l4/tc-sys-004-inmemory.log` (blocker-1 closure, §3.5) |
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
| W3-2R current-head transcript, tree `c3874a9` (develop, log header `dirty: 0 entries`) | **exit 0** (`tsc_exit=0`) | `w3r1-standing-gates.log` §1 |

Strict mode has been the standing merge gate since W2-4 (tsconfig `strict`
flip `97bef96`, merged `a07885e` — PROJECT-STATE W2-4 row). **L0 verdict:
PASS (exit 0)** — as of v1.1.0 the current head (`c3874a9`) carries the
exit token in Doc 12 §9 transcript form (codex blocker 3), not only in the
W3-FIX-1 commit attestations.

### 3.2 L1 — Build (`npm run build`)

| Run | Result | Evidence |
|---|---|---|
| Standing gate transcript, tree `f1df5bb` | **exit 0** (`build_exit=0`); artifacts present: `dist/index.html`, `dist/assets/*` (SPA), `dist/server.cjs 158.1kb` + map | `w2fix3-standing-gates.log` §2 |
| W2-FIX-6 / merge resolved tree | build OK (`dist/server.cjs 158.5kb`) | PROJECT-STATE W2-FIX-6 and W2-GATE-2 MERGE rows |
| W3-FIX-1 fix tree (→ `7d33fc8`) | **build OK** (bundle size not recorded in the archived gate records — §3.6 item 1, closed v1.1.0) | git msgs `7d33fc8` / `27b2622`; PROJECT-STATE W3-FIX-1 row |
| W3-2R current-head transcript, tree `c3874a9` | **exit 0** (`build_exit=0`); artifacts: `dist/index.html` + `dist/assets/*` (SPA) and `dist/server.cjs 162543 bytes` + `dist/server.cjs.map 271.4kb` | `w3r1-standing-gates.log` §2 (`artifact: dist/server.cjs 162543 bytes`) |

**L1 verdict: PASS (exit 0, both artifacts present)** — with the current-head
byte size now recorded (162543 bytes @ `c3874a9`, closing §3.6 item 1) and
the exit token in transcript form (codex blocker 3).

### 3.3 L2 — Smoke / API (`scripts/smoke-test.mjs`)

Default mode (in-memory, spawned `dist/server.cjs`, NODE_ENV=production,
UPLOAD_DIR=./uploads-test):

| Run | Count (verbatim) | Duration | Exit | Evidence |
|---|---|---|---|---|
| Latest archived report *(as of v1.0.1)* | **108/108 passed** | not recorded in report file (§3.6 item 2) | per gate records: exit 0 — *(provenance resolved v1.1.0: that report's 10:08:31.188Z stamp postdates the `27b2622` merge (17:08:21 +07 = 10:08:21Z) by 10 s, so it was produced on the post-merge develop tree; the file has since been overwritten on disk by the W3-2R runs — current on-disk stamp 10:33:21.471Z is the W3-2R PG-run-2 report, 127/127 — and the unambiguous current-head default-mode run is the W3-2R transcript row below)* | `smoke-report.md` (generated 2026-09-11T10:08:31.188Z, Node v24.13.1 darwin 25.5.0, target :3210) |
| W3-2R current-head transcript, tree `c3874a9` (log header pin; node v24.13.1, npm 11.18.0) | **108/108 checks passed** | 7.8s | `smoke_exit=0` | `w3r1-standing-gates.log` §3 — suite section headers §0–§14, §16, §17 visible in the transcript (§15/§18 are the PG opt-ins) |
| `f1df5bb` transcript | **108/108 checks passed** | 7.8s | `smoke_exit=0` | `w2fix3-standing-gates.log` §3 |
| Merge resolved tree | **108/108** | 7.0s | exit 0 | PROJECT-STATE W2-GATE-2 MERGE row |

PG opt-in mode (`SMOKE_DATABASE_URL` set → §15 + §17-PG + §18 checks; 127
total per Doc 12 R2):

| Run | Count (verbatim) | Duration | Exit | Evidence |
|---|---|---|---|---|
| W3-FIX-1 run 1 (09:59:11Z) | **127/127 checks passed** | 19.9s | exit 0 (attested in git msgs — §3.6 item 3, closed v1.1.0) | `w3fix1-pg-run-1.log` |
| W3-FIX-1 run 2 (09:59:45Z) | **127/127 checks passed** | 19.7s | exit 0 (attested in git msgs — §3.6 item 3, closed v1.1.0) | `w3fix1-pg-run-2.log` |
| W3-2R run 1 (`c3874a9`, 10:32:40Z) | **127/127 checks passed** | 19.7s | **`pg1_exit=0`** (transcript footer; `container_kbj-pg-w3r1-1_removed=0`) | `w3r1-standing-gates.log` §5 |
| W3-2R run 2 (`c3874a9`, 10:33:01Z) | **127/127 checks passed** | 19.5s | **`pg2_exit=0`** (transcript footer; `container_kbj-pg-w3r1-2_removed=0`) | `w3r1-standing-gates.log` §5 |
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

**L2 verdict: PASS — default 108/108; PG opt-in 127/127 ×2 at the current
head `c3874a9` (`pg1_exit=0` / `pg2_exit=0` in transcript footers), ×2 on
the W3-FIX-1 tree, and ×4 on the W2-FIX-6 / merge resolved trees (×8
archived green PG runs total). Zero FAIL lines in the archived reports.**
Per-TC L2 coverage against the Doc 12 §6 catalog — the codex blocker-2
requirement beyond suite totals — is mapped in **Appendix A**.

### 3.4 L3 — E2E walkthrough (`tests/e2e-walkthrough.mjs`)

Results record `.omc/reports/e2e-results.json` (base
`http://127.0.0.1:3220`): 64 result rows with statuses **63 PASS / 1 FLAKY /
0 FAIL** (counts object `{"flaky":1,"pass":63}` — no fail-status rows exist;
63 + 1 = 64 rows all accounted). *(v1.1.0 provenance note: that 10:04:13.853Z
record was the W3-FIX-1-era run; the W3-2R transcript §4 subsequently
re-ran e2e at the current head and overwrote the on-disk JSON — its record
now carries `startedAt 2026-09-11T10:32:38.219Z` (the write-time field, §3.6
item 5) with identical counts `{"flaky":1,"pass":63}`; both runs' evidence
is cited below.)* The W3-2R run's transcript tokens, quoted verbatim:
`e2e_server_healthz=200`, summary `PASS=63 FAIL=0 FLAKY=1`,
`e2e_exit=0`, `e2e_counts={"flaky":1,"pass":63} rows=64
finalizedAt=2026-09-11T10:32:38.219Z`, `PORT_3220_RELEASED=OK`
(`w3r1-standing-gates.log` §4 @ `c3874a9`).

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
msgs `7d33fc8`/`27b2622`; PROJECT-STATE W3-FIX-1 row). *(v1.1.0 closure,
codex blocker 3: the current head no longer depends on the attestation —
`w3r1-standing-gates.log` §4 records `e2e_exit=0` and
`PORT_3220_RELEASED=OK` verbatim at `c3874a9`, including the spawned
server's full graceful-shutdown sequence before the port-release token.)*

Visual record *(retention mechanism per Doc 12 §9.5, codex blocker 4 —
v1.1.0)*: each run's capture set is preserved in an immutable run-id
archive with a filename/hash manifest —

- `.omc/reports/screenshots-archive/run-2026-09-11T1000Z-e2e/` — **46
  PNGs** of the 10:00–10:04Z run, copied with mtimes preserved, plus
  `MANIFEST.sha256` (46 lines; verified 0 mismatches on
  `shasum -a 256 -c`). Per the codex advisory, the mtimes
  (2026-09-11 17:00:17–17:04:13 +07 = 10:00:17Z–10:04:13Z) bound the
  **observed capture interval** of this run, not its complete execution
  window.
- `.omc/reports/screenshots-archive/run-2026-09-11T1031Z-e2e-w3r1/` — **46
  PNGs** of the W3-2R transcript's e2e (observed capture interval
  2026-09-11 17:28:41–17:32:37 +07 = 10:28:41Z–10:32:37Z, ending 1 s before
  the results finalize token), same manifest treatment (46 lines; 0
  mismatches).
- The 18 stale files from the 2026-09-10 run are quarantined in
  `.omc/reports/screenshots-archive/stale-2026-09-10-run/` (18 files), no
  longer interleaved with current evidence.
- The harness change itself (run-id subdirectory at write time) remains
  **queued before W3-4/W3-5** — the codex verdict explicitly allows the
  harness change to precede W3-4 while requiring the archive NOW, which the
  two directories above satisfy. The live `.omc/reports/screenshots/`
  directory remains the harness's write target and is no longer cited as
  the retention mechanism.

**L3 verdict: PASS — 63 PASS / 1 FLAKY (S0, retry evidence attached) / 0
FAIL**, evidenced at the current head by the W3-2R transcript (identical
counts to the 10:04Z run). Per-TC L3 coverage against the Doc 12 §6 catalog
is mapped in **Appendix A**.

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
| TC-SYS-004 export → migrate round-trip | **PASS** (v1.1.0: specified precondition now verified — codex blocker 1) | **Primary basis (v1.1.0):** `tc-sys-004-inmemory.log` @ `c3874a9` (10:29:22Z–10:29:27Z) — the **Doc 12 §6.18 specified source precondition ("in-memory data")**: in-memory prod server spawned on :3232 with **no DATABASE_URL** (log: `[WARN] NODE_ENV=production without DATABASE_URL — running with IN-MEMORY stores`); marker `W3R1-SYS004-1789122562` created via POST /api/news **201**; GET /api/system/export 200 with `export_curl_exit=0`, `export_storage=memory`, `export_version=2.0.0`, counts `{"news":13,"banners":5,"contacts":8,"rooms":5,"documents":7,"auditLogs":5,"syncLogs":3}`, `marker_in_export= 1`; server stopped, `PORT_3232_RELEASED=OK`; fresh disposable `postgres:16` :55446 + schema.sql `schema_exit=0`; `node scripts/migrate.js` `migrate_exit=0`; destination verification — all 7 table counts equal export (`dest news=13 … dest sync_logs=3`) and `marker_row_at_dest= W3R1-SYS004-1789122562`; teardown `pg_removed=0`. **Supplementary (original run, retained):** `tc-sys-004.log` + `export.json`: GET /api/system/export 200, counts `{news:13, banners:5, contacts:8, rooms:5, documents:7, auditLogs:5, syncLogs:3}` (verified against the artifact's `counts` object); disposable `postgres:16` (`w3l4-migrate`, host 55439); `node scripts/migrate.js` exit 0; psql COUNTs match export for all 7 tables; marker row present; container removed — same-store (PG-source → fresh-PG) round-trip. Both source preconditions are now evidenced; the **specified migration path is verified** and the L4 exit claim stands unconditional |
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
retained per annotate-not-rewrite; TC-SYS-004 passing on the specified
in-memory-source run (v1.1.0) with the original PG-source run retained as
supplementary same-store evidence — both preconditions evidenced, so the L4
exit claim is unconditional (codex blocker 1 closed).**

### 3.6 Evidence gaps recorded (per Doc 12 §9 — no guessing)

*Gap history retained; v1.1.0 resolutions annotated in place
(annotate-not-rewrite). Items 1, 2, 3 and 4 are closed by the W3-2R
current-head transcript `w3r1-standing-gates.log` @ `c3874a9` (codex
blocker 3); item 6 was closed in v1.0.1 and re-worded per the codex
advisory.*

1. **W3-FIX-1 build bundle size** — the archived gate records (git msgs
   `7d33fc8`/`27b2622`, PROJECT-STATE W3-FIX-1 row) state "build OK" only; no
   byte size is recorded for that tree. (For reference, recorded sizes:
   158.1kb @ `f1df5bb` transcript; 158.5kb @ W2-FIX-6/merge rows.) —
   *(RESOLVED v1.1.0: the current head records the byte size in transcript
   form — `artifact: dist/server.cjs 162543 bytes` @ `c3874a9`,
   `w3r1-standing-gates.log` §2. The W3-FIX-1 tree's own size remains
   unrecorded history.)*
2. **Latest default-smoke duration** — `smoke-report.md` does not embed a
   duration; durations are quoted only where a transcript records them
   (7.8s @ `f1df5bb`; 7.0s @ merge resolved tree). — *(RESOLVED v1.1.0:
   the current-head default run carries its duration in the transcript —
   `RESULT: 108/108 checks passed in 7.8s`, `w3r1-standing-gates.log` §3.
   Provenance of the earlier 10:08:31.188Z report resolved in §3.3: it
   postdates the `27b2622` merge (10:08:21Z) by 10 s — post-merge develop
   tree — and has since been overwritten on disk by the W3-2R runs; the
   W3-2R transcript is now the unambiguous current-head run.)*
3. **W3-FIX-1 PG-run exit codes** — `w3fix1-pg-run-{1,2}.log` have no
   exit-code footer (unlike the w2fix6/w2merge logs); exit 0 for both runs is
   attested in the merge-committed gate blocks (git msgs `7d33fc8`/`27b2622`:
   "exit 0, logs .omc/reports/w3fix1-pg-run-{1,2}.log"). — *(RESOLVED v1.1.0,
   codex blocker 3: the current head has footer-form evidence —
   `pg1_exit=0` (127/127 in 19.7s) and `pg2_exit=0` (127/127 in 19.5s) in
   `w3r1-standing-gates.log` §5. The commit attestations for the W3-FIX-1
   tree runs remain as historical records, no longer load-bearing for the
   L2 exit claim.)*
4. **sha provenance of L2-default / L3 artifacts** — `smoke-report.md` and
   `e2e-results.json` do not embed a git sha; tree identity rests on the
   timestamps (10:08:31Z report; 10:00–10:04Z screenshots) plus the gate
   blocks recorded in the W3-FIX-1 commit/merge messages and PROJECT-STATE.
   — *(RESOLVED v1.1.0 for the current head: the W3-2R transcript's log
   header pins `git c3874a9 (develop) · dirty: 0 entries` (node v24.13.1,
   npm 11.18.0), giving unambiguous tree identity for its default-smoke,
   e2e and PG runs. The earlier artifacts' timestamp-based inference stands
   as history.)*
5. **`e2e-results.json` `startedAt` semantics** — the field is set at
   results-write time (`tests/e2e-walkthrough.mjs:1405-1407`), i.e. it is the
   finalize timestamp; the actual execution window is bounded by the
   screenshot mtimes (10:00:17Z–10:04:13Z). Cited accordingly in §2.
   — *(v1.1.0 corroboration: the on-disk JSON's `startedAt
   2026-09-11T10:32:38.219Z` equals the transcript's `finalizedAt`
   token exactly; per the codex advisory the screenshot mtimes are now
   described as bounding the **observed capture interval**, not the complete
   execution window — §3.4.)*
6. **TC-SYS-006 kustomize success render** — *(closed in v1.0.1)* —
   originally present in `l4-summary.md` §2 only; the raw
   `tc-sys-006.log` records the bare-checkout failure (exit 1) and the compose
   validations, but not the post-copy kustomize exit-0 line. **Closed by the
   lead re-execution** 2026-09-11T10:20:33Z @ `7b23fd4`
   (`tc-sys-006-kustomize-rerun.log`: `kustomize_exit=0`, 388-line render,
   11 kind entries — matching the recorded render statistics of the summary
   claim; wording adjusted per the codex advisory, v1.1.0).

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

### 5.2 Lead review rulings (2026-09-11, v1.0.1) — codex gate dispositions annotated (v1.1.0)

Disposition of each §5.1 item — rulings recorded here rather than rewriting
the worker's text (annotate-not-rewrite). **The codex doc17-gate verdict
(`.omc/artifacts/cto-gate-doc17-verdict.md`) subsequently disposed of these
rulings: upheld 1, 3 and 5; OVERTURNED 2 and 4 as presently written.** The
overturns are annotated on the rulings below; the original ruling text is
retained as history.

1. **TC-SYS-006 evidence shape → CLOSED by re-execution.** The lead
   re-ran the kustomize half with raw-log capture
   (`tc-sys-006-kustomize-rerun.log`, exit 0, 388 lines, 11 kinds @
   `7b23fd4`) — the raw-log-only standard is now met; row PASS stands on
   primary evidence, not summary attestation. *(UPHELD by the codex gate:
   "SYS-006 re-execution log records exit 0, 388 lines, 11 kind entries,
   plus secret-file cleanup.")*
2. **PG exit-code attestation → ACCEPTED.** The gate blocks committed in
   `7d33fc8` and `27b2622` are durable, hash-addressable records produced at
   run time by the operator who executed the runs; equivalence to a log
   footer is accepted for this document. Future lead-run logs keep the
   footer convention (as in the w2fix6/w2merge logs). — *(OVERTURNED by the
   codex gate, blocker 3: commit attestations do not meet the Doc 12 §9
   exit-code evidence form, which requires CI or a recorded shell
   transcript; the equivalence ruling changed the binding rule and is
   withdrawn. Closed by re-running the affected gates at the current head
   with captured exits and provenance — `w3r1-standing-gates.log`
   (`tsc_exit=0`, `build_exit=0`, `smoke_exit=0`, `e2e_exit=0`,
   `pg1_exit=0`, `pg2_exit=0` @ `c3874a9`, §3.1–§3.4). The commit
   attestations remain historical records of the W3-FIX-1 tree runs.)*
3. **`startedAt` semantics → ACCEPTED as documented.** §3.6 item 5's
   write-time explanation plus the screenshot-mtime window bound is an
   honest, sufficient execution-window proof. No harness change required
   for Doc 17. *(UPHELD by the codex gate: "Ruling 3 correctly identifies
   `startedAt` as finalization time" — with the ADVISORY that mtimes bound
   the observed capture interval, not the complete execution window;
   wording applied in §3.4/§3.6 item 5.)*
4. **Screenshot run-id scoping → ACCEPTED as a queued action, not a Doc 17
   blocker.** The 18 stale 2026-09-10 files are quarantined by mtime and the
   §3.4/§6 citations bound this run's 46 files explicitly. Action queued:
   harness scoping (run-id subdirectory) lands **before** W3-4/W3-5, which
   are the lanes that reuse capture sets (recorded in PROJECT-STATE W3-4
   row). — *(OVERTURNED by the codex gate, blocker 4: mtime filtering does
   not satisfy Doc 12 §9.5 retention per run-id and does not protect the
   current evidence from the next overwrite; the deferral is withdrawn.
   Closed NOW by the run-id archives
   `screenshots-archive/run-2026-09-11T1000Z-e2e/` and
   `run-2026-09-11T1031Z-e2e-w3r1/` (46 PNGs + `MANIFEST.sha256` each,
   0 mismatches; stale-18 quarantined — §3.4). The harness change itself
   remains queued before W3-4/W3-5, which the verdict explicitly allows.)*
5. **AVAIL reporting posture → ACCEPTED per Doc 12 design.** §6.19 defines
   TC-AVAIL-002 as overlapping TC-SYS-005, so overlap coverage is the
   specified method, not a shortcut; AVAIL-001's liveness expectation was
   sampled 5/5 inside the same outage window (re-run log). AVAIL-004's
   fail-fast half is designed behavior observed incidentally during DEF-001
   (§2.1) — standalone row remains **NOT TESTED**, and **TC-AVAIL-006
   remains NOT TESTED**; both ride to the Release-gate review as open items
   on the L4 ledger (visible in §3.5), not silently closed. *(UPHELD by the
   codex gate "within its explicitly limited overlap coverage"; the two
   NOT-TESTED rows remain visible in §3.5 and the Release-gate assessment
   in §5. continues to withhold approval.)*

---

## 6. Evidence index

All paths relative to repo root; every file below was read for this document.
Evidence files are unmodified archives (no edits by this author).

**W3-2R fix-cycle evidence (v1.1.0 — closes codex doc17-gate blockers)**

- `.omc/artifacts/cto-gate-doc17-verdict.md` — the binding REVISE verdict
  (4 blockers + advisory) that drives this revision; lead rulings on the
  v1.0.1 §5.2 dispositions quoted in §5.2.
- `.omc/reports/w3r1-standing-gates.log` — one continuous current-head
  transcript, 2026-09-11T10:28:28Z–10:33:21Z, log header `git c3874a9
  (develop) · dirty: 0 entries`, node v24.13.1, npm 11.18.0: §1
  `tsc_exit=0`; §2 `build_exit=0` + `artifact: dist/server.cjs 162543
  bytes`; §3 default smoke **108/108 checks passed in 7.8s** `smoke_exit=0`
  (section headers visible); §4 e2e `e2e_server_healthz=200`, `[FLKY] S0 …
  passed on retry`, `PASS=63 FAIL=0 FLAKY=1`, `e2e_exit=0`,
  `e2e_counts={"flaky":1,"pass":63} rows=64
  finalizedAt=2026-09-11T10:32:38.219Z`, `PORT_3220_RELEASED=OK`; §5 PG
  ×2 — **127/127 in 19.7s** `pg1_exit=0` and **127/127 in 19.5s**
  `pg2_exit=0`, both containers removed (blocker 3 closure).
- `.omc/reports/w3r1-p0-gaps.log` — lead closure run @ `d831feb`
  (2026-09-11T10:47Z) for the three P0 Appendix-A rows the v1.1.0 draft
  flagged unpinned: TC-SES-006 (exit 1 + exact FATAL banner on prod boot
  without SESSION_SECRET), TC-USER-006 (400 `You cannot deactivate your
  own account.` on admin self-PATCH), TC-ROOM-003 (book1 200 → book2 400
  `Room is currently booked or under maintenance`); port released,
  teardown clean (Appendix A rows updated to PASS).
- `.omc/reports/w3r2-gap-closures.log` — lead closure run @ `db6dde6`
  (2026-09-11T10:51Z, regate-1 blocker-2 residuals): TC-USER-008 executed
  assertion (`DELETE /api/users/:id` → 404 `application/json`
  `{"success":false,"error":"No API endpoint for DELETE …"}` for BOTH an
  unknown id and a real just-created id); TC-NEWS-004 merge semantics
  (PUT summary-only → 200, response data preserves
  `title:"W3R2-N004-OriginalTitle"` / `titleEn` / original `content`,
  replaces `summary`); TC-ROOM-003 recapture with explicit
  `book1_http=200` → `book2_http=400` tokens; port released, teardown
  clean.
- `.omc/reports/w3-l4/tc-sys-004-inmemory.log` — TC-SYS-004 re-execution
  with the specified in-memory source precondition (blocker 1 closure):
  :3232 in-memory prod server, marker `W3R1-SYS004-1789122562`,
  `export_storage=memory`, counts
  `{"news":13,"banners":5,"contacts":8,"rooms":5,"documents":7,"auditLogs":5,"syncLogs":3}`,
  `schema_exit=0`, `migrate_exit=0`, all 7 destination counts equal,
  `marker_row_at_dest= W3R1-SYS004-1789122562`, `pg_removed=0`
  (10:29:22Z–10:29:27Z @ `c3874a9`).
- `.omc/reports/screenshots-archive/run-2026-09-11T1000Z-e2e/` — 46 PNGs
  (10:00–10:04Z run) with mtimes preserved + `MANIFEST.sha256` (46 lines;
  `shasum -a 256 -c` → 0 mismatches) — the Doc 12 §9.5 run-id retention
  mechanism (blocker 4 closure).
- `.omc/reports/screenshots-archive/run-2026-09-11T1031Z-e2e-w3r1/` — 46
  PNGs of the W3-2R transcript's e2e (observed capture interval
  10:28:41Z–10:32:37Z) + `MANIFEST.sha256` (46 lines; 0 mismatches).
- `.omc/reports/screenshots-archive/stale-2026-09-10-run/` — the 18 stale
  2026-09-10 PNGs, quarantined out of the current-evidence path.

**L2 / smoke**

- `.omc/reports/smoke-report.md` — *(historical as of v1.1.1)* the
  default-mode report cited throughout §2/§3.3: 108/108 passed; generated
  2026-09-11T10:08:31.188Z; Node v24.13.1 darwin 25.5.0; spawned
  `dist/server.cjs` on :3210; in-memory mode. **Live-file caveat:** the
  harness overwrites this fixed filename per run — as of the v1.1.1
  revision (10:5xZ) the on-disk file held the W3-2R PG-run-2 report (stamp
  10:33:21.471Z, 127/127; it has since advanced again with subsequent
  lanes' runs), same code tree; the 10:08:31Z values here are historical
  record, and the durable
  transcript-form evidence for the current head is
  `w3r1-standing-gates.log` §3.
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

- `.omc/reports/e2e-results.json` — *(historical as of v1.1.1)* the L3 run
  record: 64 rows (63 PASS + 1 FLAKY S0 with retry evidence); counts
  `{"flaky":1,"pass":63}`; base `http://127.0.0.1:3220`; finalized
  2026-09-11T10:04:13.853Z. **Live-file caveat:** overwritten on disk by the
  W3-2R run (live `startedAt` 2026-09-11T10:32:38.219Z, same counts
  63/1/0 — quoted in `w3r1-standing-gates.log` §4); the 10:04:13Z values
  here are the historical 10:00Z-run record whose capture set is preserved
  in `screenshots-archive/run-2026-09-11T1000Z-e2e/`.
- `.omc/reports/screenshots/` — the harness's live write target (fixed
  filenames, no run-id scoping; harness change queued before W3-4/W3-5).
  **Retention citations point at the run-id archives** —
  `screenshots-archive/run-2026-09-11T1000Z-e2e/` (46 PNGs of the
  10:00–10:04Z run + `MANIFEST.sha256`) and
  `screenshots-archive/run-2026-09-11T1031Z-e2e-w3r1/` (46 PNGs of the
  W3-2R run + `MANIFEST.sha256`); the 18 stale 2026-09-10 files are
  quarantined in `screenshots-archive/stale-2026-09-10-run/` (§3.4,
  §5.1 item 4, §5.2 ruling 4).

**L4 / system test (`.omc/reports/w3-l4/`)**

- `l4-summary.md` — W3-1 executor summary: provenance, per-TC verdict table,
  §2.1 re-run record, defects register, teardown.
- `tc-sys-001.log` — compose boot: `up_exit=0`, healthy ~5 s, 10 tables,
  `psql_dt_exit=0`.
- `tc-sys-002.log` — restart persistence: marker `W3L4-SYS002-1789120134`
  survives `restart app`.
- `tc-sys-003.log` — schema.sql ×2 idempotent under `ON_ERROR_STOP=1`.
- `tc-sys-004.log` — export→migrate round-trip; counts match all 7 tables.
- `tc-sys-004-inmemory.log` — (v1.1.0, blocker 1) same round-trip with the
  specified in-memory source: `export_storage=memory`, `schema_exit=0`,
  `migrate_exit=0`, 7/7 destination counts equal, marker row present,
  `pg_removed=0` @ `c3874a9`.
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

---

## Appendix A — Per-TC L2/L3 coverage map (Doc 12 §6 catalog)

*(Added v1.1.0 — codex blocker 2: Doc 12 §7/§9-level reporting requires
per-TC verdicts, which suite totals cannot establish.)*

**Method (mechanical, no invention):** the Doc 12 §6 catalog was enumerated
per series; every check label in the current-head smoke transcript
(`w3r1-standing-gates.log` §3 default run — 108 checks — and §5 PG runs —
127 checks each, all section headers and `[PASS]` labels read) and the check
strings in `scripts/smoke-test.mjs` were searched for each TC id and its
specified behavior; the 64 e2e result rows (`e2e-results.json` `id`/`name`
fields, quoted in the w3r1 transcript §4: S0, A1–A6, B0–B17, C0–C12, C-FR,
C-API, D0a, D0–D5, E0–E10, E-API, E-API2, F1–F3) were mapped to the Doc 12
§5/§6 journeys their names describe. A row is **PASS** only where a
covering check asserts the TC's core expectation; **PARTIAL** where a
subset of the expected assertions is pinned; **NOT COVERED at L2/L3** where
no check exists — with a pointer to where it is covered (L4 = §3.5, L5 =
Doc 19, L6 = Doc 18) or an explicit open-gap flag. Honesty over
completeness: aggregate green counts above say nothing about catalog
coverage; this table is the coverage claim.

**Totals: 157 rows — 100 PASS · 18 PARTIAL · 39 NOT COVERED at L2/L3**
*(v1.1.0-draft counts were 97/18/42; only the three P0 closures shifted
PASS up — the v1.1.1 executed-assertion closures upgraded evidence on rows
already counted PASS and changed no totals; A.19 is the authoritative
reconciliation).*

### A.1 §6.1 Authentication — AUTH

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-AUTH-001 | PASS | smoke §3 "POST /api/auth/login (admin) returns 200 with user payload + kbj_session cookie"; §5 maker/checker/staff logins; e2e B0/C0/D0/E0 |
| TC-AUTH-002 | PASS | smoke §13 "POST /api/auth/login with wrong password returns 401" + "Auth events audited: LOGIN_FAILED … LOGOUT"; e2e A4 |
| TC-AUTH-003 | NOT COVERED at L2/L3 | no unknown-user uniform-401 pin in any suite; rides to L5 (Doc 19, alongside TC-SEC-009) |
| TC-AUTH-004 | NOT COVERED at L2/L3 | no blank/malformed login-body pin; P2; rides to L5 (Doc 19) |
| TC-AUTH-005 | PASS | smoke §3 "GET /api/auth/me (admin cookie) returns current user" + §2 "GET /api/auth/me returns 401 (anon)" |
| TC-AUTH-006 | PASS | smoke §13 "POST /api/auth/logout returns 200 and invalidates the session server-side (stale cookie rejected with 401)"; e2e B17/E10 |
| TC-AUTH-007 | PASS | smoke §16 TC-AUDIT-010 classes 2+3 — "tampered-cookie 401 audited as anonymous" (the tampered-cookie → 401 rejection itself is the asserted behavior) |
| TC-AUTH-008 | PASS | smoke §3 "kbj_session cookie flags: HttpOnly + SameSite=Lax + Secure (NODE_ENV=production)" |
| TC-AUTH-009 | PASS | smoke §14 "Repeated bad logins trigger HTTP 429 (5 attempts/min/IP per D1)"; e2e A5 (rate-limit message on 6th attempt) |
| TC-AUTH-010 | PASS | smoke §5 five rapid successful logins (admin + maker/checker/staff) all 200, no 429; §14 PASS detail "(limiter counts FAILED logins only …)" |

### A.2 §6.2 Session management — SES (001–006; probes 010–013 in A.14)

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-SES-001 | NOT COVERED at L2/L3 | no 7-day-TTL expiry pin in any suite; no L4/L5 slot scheduled — open item (P1) |
| TC-SES-002 | NOT COVERED at L2/L3 | no expired-session sweeper pin (PG §15 covers rate_limit_hits only); P2 |
| TC-SES-003 | PARTIAL | e2e E4b "deactivate kills login server-side" pins the relogin-401 half; immediate revocation of the victim's live cookie (me → 401 without relogin) not asserted |
| TC-SES-004 | NOT COVERED at L2/L3 | covered at **L4** — §3.5 TC-SYS-002 ("session cookie also survived (sessions durable)") |
| TC-SES-005 | NOT COVERED at L2/L3 | documented dev-mode behavior (P2); memory-restart session loss not pinned |
| TC-SES-006 | PASS (lead closure run 2026-09-11T10:47Z) | prod boot w/o SESSION_SECRET: exit code 1 + `FATAL: SESSION_SECRET must be set when NODE_ENV=production (32+ random characters).` — `w3r1-p0-gaps.log` @ `d831feb` |

### A.3 §6.3 News — NEWS

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-NEWS-001 | PASS | smoke §1 "GET /api/news returns 200 with data array (anon) (12 items)"; search path via e2e B8 |
| TC-NEWS-002 | PASS | smoke §7 "POST /api/news (maker) returns 201 (id=…)"; e2e C1 (defaults visible in CMS list) |
| TC-NEWS-003 | PARTIAL | 200-edit pinned (smoke §7 "PUT /api/news/:id (maker) returns 200"; e2e C3); unknown-id 404 and id-immutability not separately pinned at L2/L3 |
| TC-NEWS-004 | PASS (lead closure run 2026-09-11T10:51Z) | merge-semantics executed per §6.3: create (title `W3R2-N004-OriginalTitle`, titleEn, content, category) → `PUT` **summary only** → **200** with response data showing `title:"W3R2-N004-OriginalTitle"` + `titleEn` + `content:"<p>original body W3R2-N004</p>"` **preserved** and `summary:"UPDATED summary only — merge test"` **replaced** — `w3r2-gap-closures.log` @ `db6dde6` (e2e C3 form-prefill + smoke §7 PUT-200 retained as corroboration) |
| TC-NEWS-005 | PASS | smoke §12 "DELETE /api/news/:id (admin) succeeds (200)"; e2e E5 (confirm dialog + removal) |
| TC-NEWS-006 | PASS | smoke §8 "POST /api/news/:id/submit-approval (maker) returns 200"; audit actor asserted in §9; e2e C4 |
| TC-NEWS-007 | PASS | smoke §8 "POST /api/news/:id/approve (checker) returns 200 (approved)"; e2e D1 |
| TC-NEWS-008 | PASS | smoke §8 "Maker -> submit -> checker reject flow returns 200 and marks item rejected"; e2e D2 |
| TC-NEWS-009 | NOT COVERED at L2/L3 | reject default-reason wording not pinned (e2e D2 pins reason-required only); P2 |
| TC-NEWS-010 | NOT COVERED at L2/L3 | list ordering not asserted; P2 |
| TC-NEWS-011 | PASS | smoke §8 "TC-NEWS-011 (flipped): POST /api/news with syncToExternal:true stays draft, no sync log" |
| TC-NEWS-012 | PARTIAL | all four live states (`draft`/`pending_approval`/`synced`/`rejected`) driven and quoted in §8/§17 PASS details; no dedicated exhaustive no-`pending`-emission pin (that negative = TC-SEC-013, PARTIAL in A.17) |
| TC-NEWS-013 | PASS | smoke §17 "blocker 2 (approve): legacy pending without submittedBy is DENIED 409, state + audit enforced" |
| TC-NEWS-014 | PASS | smoke §17 "blocker 2 (reject): same legacy deny on the reject path (admin deciding)" |
| TC-NEWS-015 | PASS | smoke §17 "blocker 3 (precondition): withdraw on a NON-synced item returns 409, no state change, no AUD-P01" |
| TC-NEWS-016 | PASS | smoke §17 "blocker 3 (happy path): withdraw synced -> draft, content byte-for-byte, stamps cleared, AUD-P01 prior_status=synced" (+ PG COMMIT variant §17-PG) |
| TC-NEWS-017 | PASS | smoke §17 "blocker 4 (submit)" + "blocker 4 (withdraw)": audit-write failure → 500 envelope AND state rolled back |
| TC-NEWS-018 | PASS | PG §17 "W2-FIX-1 PG ROLLBACK variant" + "W2-FIX-1 PG COMMIT + concurrency variant" |
| TC-NEWS-019 | PASS | smoke §17 "blocker 1 (race): concurrent edit + approve can never yield synced-with-stale-content" (+ PG variant) |
| TC-NEWS-020 | PASS | PG §18 boot check labelled (TC-NEWS-020) — item created via pod A reads back byte-identical via pod B |
| TC-NEWS-021 | PASS | PG §18 Family S (race1-A/B), O (race1 + reversed), N (race1), F (race1) — every check labelled (TC-NEWS-021) |
| TC-NEWS-022 | PASS | PG §18 Family S (race2-A/B), O (race2 + reversed), N (race2), F (race2) — every check labelled (TC-NEWS-022) |

### A.4 §6.4 Banners — BANNER

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-BANNER-001 | PASS | smoke §1 "GET /api/banners returns 200 with data array (anon) (5 items)" |
| TC-BANNER-002 | PASS | smoke §7 "POST /api/banners (maker) returns 201"; e2e C7 |
| TC-BANNER-003 | NOT COVERED at L2/L3 | banner PUT not pinned in smoke or e2e; P1 — open gap |
| TC-BANNER-004 | PASS | smoke §12 "DELETE /api/banners/:id (admin) succeeds (200)" |
| TC-BANNER-005 | NOT COVERED at L2/L3 | sort order not asserted; P2 |

### A.5 §6.5 Contacts directory — CONTACT

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-CONTACT-001 | PASS | smoke §6 "GET /api/contacts (staff) returns 200 (8 contacts)"; e2e B9/B10 (search + department filter) |
| TC-CONTACT-002 | PASS | smoke §2 "GET /api/contacts returns 401 (anon)" |
| TC-CONTACT-003 | PASS | smoke §7 "POST /api/contacts (maker) returns 201"; e2e C8 |
| TC-CONTACT-004 | NOT COVERED at L2/L3 | contact PUT not pinned in smoke or e2e; P1 — open gap |
| TC-CONTACT-005 | PASS | smoke §12 "DELETE /api/contacts/:id (admin) succeeds (200)" |

### A.6 §6.6 Policy documents — DOC

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-DOC-001 | PASS | smoke §6 "GET /api/documents (staff) returns 200 (7 documents)"; e2e B13 (category filter) |
| TC-DOC-002 | PASS | smoke §2 "GET /api/documents returns 401 (anon)" |
| TC-DOC-003 | PASS | smoke §7 "POST /api/documents (maker) returns 201"; e2e C9 |
| TC-DOC-004 | PASS | smoke §12 "DELETE /api/documents/:id (admin) succeeds (200)" |
| TC-DOC-005 | NOT COVERED at L2/L3 | "เอกสารใหม่" (isNew) badge rendering not asserted in any e2e result name; P2 |

### A.7 §6.7 Meeting rooms — ROOM

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-ROOM-001 | PASS | smoke §1 "GET /api/rooms returns 200 with data array (anon) (5 items)" |
| TC-ROOM-002 | PASS | smoke §6 "POST /api/rooms/:id/book + /release (staff) round-trip 200 (room room-1 booked + released)"; e2e B11 |
| TC-ROOM-003 | PASS (lead closure runs 2026-09-11T10:47Z + recapture 10:51Z) | `book1_http=200` (explicit token, success body w/ booking data) → `book2_http=400` `Room is currently booked or under maintenance` — `w3r2-gap-closures.log` @ `db6dde6` (recapture: the first run's `w3r1-p0-gaps.log` retained the success body but its `-w` status token was consumed by the JSON pretty-print pipe — regate-1 NIT; first log kept as history) |
| TC-ROOM-004 | PASS | smoke §6 release half of the round-trip; e2e B12 "release booking control returns room to available — booking cleared" |
| TC-ROOM-005 | NOT COVERED at L2/L3 | unknown-room 404 not pinned; P1 |
| TC-ROOM-006 | NOT COVERED at L2/L3 | rooms empty-id 400 not pinned (the id-guard is pinned for news via e2e C-API); P1 |

### A.8 §6.8 CMS / maker-checker workflow — CMS

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-CMS-001 | PASS | e2e B14 "Header role badge shows STAFF; nav limited to allowed views — CMS/External nav absent" |
| TC-CMS-002 | PASS | e2e C1→C4 (create → submit → รอการอนุมัติ) + D1 (approve → เผยแพร่แล้ว + sync log entry) |
| TC-CMS-003 | PASS | e2e D2 "Reject with reason (required) … reject disabled when empty=true" |
| TC-CMS-004 | PASS | smoke §7 "POST /api/news (checker) returns 403 (403 - compliance cannot author)"; e2e D4 (checker edit allowed by rank, delete=0) |
| TC-CMS-005 | PASS | e2e C6 "Maker has NO delete buttons and NO User Management tab" |
| TC-CMS-006 | PARTIAL | checker visibility pinned (e2e D3 "Audit Trail tab lists the actions just performed with correct actors"); maker-side absence of the BOT/PDPA audit tab not explicitly asserted |
| TC-CMS-007 | PASS | smoke §8 "TC-SEC-011: approve on a draft item returns 400 (state guard)" |
| TC-CMS-008 | PASS | API-level pin = smoke §8 TC-NEWS-011 + the four TC-SEC-011 checks; the pre-fix UI step no longer exists (DCR-9 Option C removed the sync toggle — Doc 12 §6.8 note), so there is no UI path to run |

### A.9 §6.9 User management — USER

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-USER-001 | PASS | smoke §3 "POST /api/auth/login (admin) returns 200 with user payload (role=admin)"; w3r1 §4 bootstrap admin line |
| TC-USER-002 | NOT COVERED at L2/L3 | one-time-password bootstrap not exercised (L4 §2.1 env set ADMIN_PASSWORD); P1 |
| TC-USER-003 | PARTIAL | valid creates pinned (smoke §4 maker/checker/staff → 201); the ×6 bad-payload validation matrix not pinned |
| TC-USER-004 | PASS | e2e E4 "create user + duplicate 409 inline (fix #19)" |
| TC-USER-005 | PASS | e2e E4b "deactivated … login -> 401" |
| TC-USER-006 | PASS (lead closure run 2026-09-11T10:47Z) | admin PATCH own id `{"isActive":false}` → 400 `You cannot deactivate your own account.` — `w3r1-p0-gaps.log` @ `d831feb` |
| TC-USER-007 | PASS | e2e E4b "reactivated; login -> 200" |
| TC-USER-008 | PASS (lead closure run 2026-09-11T10:51Z) | executed assertion per §6.9: admin `DELETE /api/users/nonexistent-id-404` → **404** `application/json` `{"success":false,"error":"No API endpoint for DELETE /api/users/…"}`; same for a real just-created user id (no endpoint exists by design) — `w3r2-gap-closures.log` @ `db6dde6` (e2e E4b's design note retained as corroboration) |

### A.10 §6.10 Audit trail — AUDIT

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-AUDIT-001 | PASS | smoke §9 "GET /api/audit-logs (checker) returns 200 (44 entries)"; e2e D3 |
| TC-AUDIT-002 | PASS | smoke §13 "Auth events audited: LOGIN_FAILED after bad login, LOGOUT after logout" |
| TC-AUDIT-003 | PASS | smoke §9 actor-integrity "(server-side actors recorded for submit, approve, login, user-create)"; e2e D3 (SUBMIT/APPROVE/REJECT with maker01/checker01 actors) |
| TC-AUDIT-004 | PARTIAL | USER_CREATE pinned (§9 detail); USER_ACTIVATE / USER_DEACTIVATE rows not asserted anywhere (e2e E4b performs the actions but never reads the trail) |
| TC-AUDIT-005 | PARTIAL | upload 201 + byte-identical serving pinned (§11); the FILE_UPLOAD audit row itself not asserted |
| TC-AUDIT-006 | PASS | smoke §9 "Audit entries record the authenticated actor (spoofed body actor ignored)" |
| TC-AUDIT-007 | PARTIAL | POST removal pinned (§9 TC-AUDIT-008/TC-RBAC-026 — 404 every role); PUT/DELETE/PATCH mutation variants not separately pinned |
| TC-AUDIT-008 | PASS | smoke §9 "TC-AUDIT-008/TC-RBAC-026 (flipped): POST /api/audit-logs returns 404 for every role (manual append removed, DCR-8)" |
| TC-AUDIT-009 | PASS | smoke §16 "TC-AUDIT-009 (flipped): GET /api/system/export writes a SYSTEM_EXPORT row keyed by exportTimestamp (AUD-P06)" |
| TC-AUDIT-010 | PASS | smoke §16 "TC-AUDIT-010 class 1 (flipped)" + "TC-AUDIT-010 classes 2+3 (flipped)" (anon-401/tampered-401 split asserted) |

### A.11 §6.11 Public sync — SYNC

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-SYNC-001 | PASS | smoke §10 "GET /api/sync/logs (admin) returns 200 (5 sync logs)"; e2e E9 |
| TC-SYNC-002 | PASS | smoke §10 "POST /api/sync/trigger (admin) returns 200 (triggered)"; FORCE_SYNC/BULK-ALL row quoted in §16 TC-SYNC-004 detail; e2e E6 |
| TC-SYNC-003 | PARTIAL | sync-log-on-approve pinned (e2e D1 "+ sync log entry"); the endpoint-field detail (api.kbjcapital.co.th/v1/public/news) not asserted |
| TC-SYNC-004 | PASS | smoke §16 "TC-SYNC-004 (flipped): POST /api/sync/trigger writes a SYNC_TRIGGER audit row (AUD-P05)" |
| TC-SYNC-005 | PASS | e2e E1 "External Web Sync view renders and can switch to CMS"; staff-side absence e2e B14 ("CMS/External nav absent") |
| TC-SYNC-006 | PASS | smoke §10 "(admin) returns 200 with tables payload (tables: news, banners, contacts, meeting_rooms, documents, audit_logs, sync_logs)"; migrate.js consumer half at **L4** — §3.5 TC-SYS-004 (both runs) |

### A.12 §6.12 Uploads — UPL

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-UPL-001 | PASS | smoke §11 "(maker) returns 201 + uploaded file is served byte-identical (65B verified)" — fixture is a whitelisted `.pdf` (the doc's 1×1-PNG variant is not the suite's fixture) |
| TC-UPL-002 | PARTIAL | representative pinned: §11 "rejects non-whitelisted extension (.exe)" → 400; the full `.sh/.html/.svg/.js/.txt` list not enumerated |
| TC-UPL-003 | NOT COVERED at L2/L3 | crafted-extension variants (.jpg.exe, %00, trailing dot) not pinned; P1 → L5 (Doc 19) |
| TC-UPL-004 | NOT COVERED at L2/L3 | MIME/extension mismatch not pinned; P1 → L5 (Doc 19) |
| TC-UPL-005 | PASS | smoke §11 "rejects oversized file (11MB > 10MB limit)" → 413 |
| TC-UPL-006 | NOT COVERED at L2/L3 | empty-multipart 400 not pinned; P2 |
| TC-UPL-007 | PASS | smoke §11 "(staff) returns 403 - uploads restricted to maker+ (staff excluded)" |
| TC-UPL-008 | PARTIAL | served-200 half pinned (§11 byte-identical); nosniff header + directory-traversal block not asserted → L5 (Doc 19) |

### A.13 §6.13 Search — SRCH

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-SRCH-001 | PARTIAL | English-title path pinned (e2e B8 "Global search (Ctrl+K) opens, finds a seeded article … results shown for 'BOT'"); title-TH/summary/department matchers not enumerated |
| TC-SRCH-002 | NOT COVERED at L2/L3 | no case-mix pin (B8 exercises a single uppercase query); P2 |
| TC-SRCH-003 | PARTIAL | name field pinned (e2e B9 "search by name filters contacts (n=1)"); nameEn/position/extension not enumerated |
| TC-SRCH-004 | PARTIAL | single-filter paths pinned (e2e B10 department chips; B13 news category); combined-filter intersection not asserted |

### A.14 §6.14 Probes & platform — SES-010..013

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-SES-010 | PASS | smoke §0 "GET /healthz returns 200 (healthy)"; w3r1 §4 `e2e_server_healthz=200` |
| TC-SES-011 | PARTIAL | healthy half: smoke §0 "GET /readyz returns 200 (ready)"; kill-PG → 503 half covered at **L4** — §3.5 TC-SYS-005 (5/5 samples 503 `not_ready`) |
| TC-SES-012 | PASS | smoke §0 readyz 200 against the in-memory spawned server (default mode) |
| TC-SES-013 | NOT COVERED at L2/L3 | covered at **L4** — §3.5 TC-AVAIL-003 (SIGTERM sequence, `ExitCode=0`); also observed on the host-spawned e2e server teardown in w3r1 §4 (graceful-shutdown lines before `PORT_3220_RELEASED=OK`) |

### A.15 §6.15 Performance — PERF

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-PERF-001 | NOT COVERED at L2/L3 | no latency assertion in smoke or e2e; P2 ("document, not fail") — not scheduled at L4–L6 |
| TC-PERF-002 | NOT COVERED at L2/L3 | no login-latency sampling; P2 (design-bounded) |
| TC-PERF-003 | NOT COVERED at L2/L3 | no audit-payload measurement; P2 (feeds Doc 10 §6 `[PLANNED]`) |
| TC-PERF-004 | NOT COVERED at L2/L3 | no upload-throughput loop; P2 |

### A.16 §6.16 RBAC negative matrix — RBAC

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-RBAC-001 | PASS | smoke §2 "GET /api/contacts returns 401 (anon)" |
| TC-RBAC-002 | PASS | smoke §2 "GET /api/documents returns 401 (anon)" |
| TC-RBAC-003 | PASS | smoke §7 "POST /api/news (staff) returns 403" |
| TC-RBAC-004 | PASS | smoke §7 "POST /api/news (checker) returns 403 (compliance cannot author)" |
| TC-RBAC-005 | PASS | smoke §7 "PUT /api/news/:id (staff) returns 403" |
| TC-RBAC-006 | PASS | smoke §7 "POST /api/banners (staff) returns 403" |
| TC-RBAC-007 | NOT COVERED at L2/L3 | staff POST /api/contacts 403 not pinned (maker 201 pinned §7; staff 403 pinned for news/banners only) |
| TC-RBAC-008 | NOT COVERED at L2/L3 | staff POST /api/documents 403 not pinned (maker 201 pinned §7) |
| TC-RBAC-009 | PASS | smoke §8 "submit-approval (staff) returns 403" |
| TC-RBAC-010 | PASS | smoke §8 "submit-approval (checker) returns 403" |
| TC-RBAC-011 | PASS | smoke §8 "approve (maker) returns 403 (maker cannot self-approve)" |
| TC-RBAC-012 | PASS | smoke §8 "approve (staff) returns 403" |
| TC-RBAC-013 | PASS | smoke §9 "GET /api/audit-logs (maker) returns 403" |
| TC-RBAC-014 | PASS | smoke §9 "GET /api/audit-logs (staff) returns 403" |
| TC-RBAC-015 | NOT COVERED at L2/L3 | maker GET /api/sync/logs 403 not pinned (staff variant pinned §10) |
| TC-RBAC-016 | NOT COVERED at L2/L3 | checker POST /api/sync/trigger 403 not pinned (staff variant pinned §10) |
| TC-RBAC-017 | NOT COVERED at L2/L3 | maker GET /api/system/export 403 not pinned (staff variant pinned §10) |
| TC-RBAC-018 | PASS | smoke §5 "GET /api/users (staff) returns 403" |
| TC-RBAC-019 | NOT COVERED at L2/L3 | checker POST /api/users 403 not pinned (staff variant pinned §5) |
| TC-RBAC-020 | NOT COVERED at L2/L3 | staff PATCH /api/users/:id 403 not pinned (no negative PATCH check exists) |
| TC-RBAC-021 | PASS | smoke §11 "(staff) returns 403 - uploads restricted to maker+" |
| TC-RBAC-022 | PASS | smoke §12 "DELETE /api/news/:id (maker) returns 403" |
| TC-RBAC-023 | PASS | smoke §12 "DELETE /api/banners/:id (checker) returns 403" |
| TC-RBAC-024 | PASS | smoke §12 "DELETE /api/contacts/:id (maker) returns 403" |
| TC-RBAC-025 | PASS | smoke §12 "DELETE /api/documents/:id (checker) returns 403" |
| TC-RBAC-026 | PASS | smoke §9 "TC-AUDIT-008/TC-RBAC-026 (flipped): POST /api/audit-logs returns 404 for every role" |
| TC-RBAC-027 | PASS | smoke §2 "POST /api/upload returns 401 (anon)" |
| TC-RBAC-028 | PASS | smoke §2 "GET /api/users returns 401 (anon)" |
| TC-RBAC-029 | PASS | smoke §6 "POST /api/rooms/:id/book + /release (staff) round-trip 200" (positive control) |
| TC-RBAC-030 | PASS | smoke §9 "GET /api/audit-logs (checker) returns 200 (44 entries)" (positive control) |

### A.17 §6.17 Security — SEC (L2/L3-applicable rows; the rest ride to Doc 19)

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-SEC-001 | NOT COVERED at L2/L3 | no security-header assertion in smoke or e2e; P0 → L5 (Doc 19) |
| TC-SEC-002 | PASS | e2e E-API2 "GET /api/k8s/diagnostics -> 404, no SPA HTML fallback (application/json; charset=utf-8)" — representative JSON-404 pin |
| TC-SEC-003 | PASS | e2e E-API "malformed JSON gets a clean 400 envelope (fix #20) — HTTP 400 JSON envelope: Invalid JSON body" |
| TC-SEC-004 | NOT COVERED at L2/L3 | no oversized-JSON-body pin (§11 413 is multipart upload, not JSON); → L5 (Doc 19) |
| TC-SEC-005 | PASS | e2e C-API "empty-id PUT/DELETE return 400 envelope (fix #20) — 'Resource id is required'" |
| TC-SEC-006 | NOT COVERED at L2/L3 | `npm audit` is not part of L2/L3 suites; P0 → L5 (Doc 19) |
| TC-SEC-007 | NOT COVERED at L2/L3 | repo/image secret scan not run at L2/L3 (L4-adjacent evidence only: obs-2 `k8s/secret.yaml` gitignored `cac252e`, §4); → L5 (Doc 19) |
| TC-SEC-008 | NOT COVERED at L2/L3 | uploads-dir listing not asserted; P2 → L5 (Doc 19) |
| TC-SEC-009 | NOT COVERED at L2/L3 | login timing uniformity not measured; P2 → L5 (Doc 19) |
| TC-SEC-010 | NOT COVERED at L2/L3 | container-hardening inspection not asserted (L4 TC-SYS-006 renders the manifest but asserts no hardening); P1 → L5 (Doc 19) |
| TC-SEC-011 | PASS | smoke §8 — four explicit checks: "approve on a draft item returns 400 (state guard)", "submit-approval on a non-draft item returns 400", "PUT cannot forge workflow fields", "submitter cannot approve or reject their own submission (403, admin included)" |
| TC-SEC-012 | PARTIAL | envelope classes exercised across suites (reads `{data}` asserted throughout §1/§6; id-guard 400 `success:false` via e2e C-API; malformed-JSON 400 via e2e E-API; JSON 404 via e2e E-API2); no single dedicated exhaustive-envelope check |
| TC-SEC-013 | PARTIAL | positive half observed (live states only, §8/§17 details; live audit actions incl. SYNC_TRIGGER/SYSTEM_EXPORT/ACCESS_DENIED in §16); the never-emitted negatives (no `'pending'`, no CREATE/DELETE/SYNC_PUBLIC audit actions) have no runtime exhaustive pin — type-level proof is the L0 strict-tsc gate |

### A.18 §6.22 Internationalization — I18N

| TC | Verdict | Covering evidence |
|---|---|---|
| TC-I18N-001 | PASS | e2e A2 "Login screen renders bilingual labels, hotline 1258 and brand"; Thai status chips รอการอนุมัติ/เผยแพร่แล้ว/ถูกปฏิเสธ (C4/D1/D2); bilingual CMS labels throughout C/D sections |
| TC-I18N-002 | PARTIAL | English-title news search pinned (e2e B8, query "BOT"); contacts-by-English-name not asserted |
| TC-I18N-003 | NOT COVERED at L2/L3 | Thai `publishedAt` / "3 นาที" defaults not asserted in any result name; P2 |

### A.19 Appendix summary

157 TC rows mapped (the L2/L3-applicable Doc 12 §6 series plus the SEC
rows): **100 PASS · 18 PARTIAL · 39 NOT COVERED at L2/L3**. Of the 39
NOT-COVERED rows, 2 carry L4 pointers (TC-SES-004 → TC-SYS-002;
TC-SES-013 → TC-AVAIL-003), 11 carry explicit L5 (Doc 19) pointers
(TC-AUTH-003/004, TC-UPL-003/004, TC-SEC-001/004/006/007/008/009/010), and
the remainder (26) are open gaps flagged for lead triage. The three **P0**
rows the v1.1.0 draft flagged as having no automated pin anywhere
(**TC-ROOM-003** double-booking, **TC-USER-006** self-deactivation,
**TC-SES-006** missing-SESSION_SECRET boot fail) were closed by the lead's
deterministic closure run `w3r1-p0-gaps.log` @ `d831feb` (2026-09-11T10:47Z)
— all three behaved exactly per Doc 12 §6 expected strings. The remaining
open items do not alter the L2/L3 exit verdicts (the suites' own exit
criteria are met — §3.3/§3.4), but they ride to the Release-gate review as
catalog-coverage debt, visible here rather than hidden behind aggregate
counts. (TC-SYNC-006 is counted PASS; its migrate.js consumer half is
covered at L4 — TC-SYS-004.)
