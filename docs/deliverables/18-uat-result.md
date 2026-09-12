# Deliverable 18 — UAT Result

**Version:** 0.3.3 · **Status:** **Approved — L6 EXITED** (codex re-gate 4 APPROVE @ `e166db9`, decision #27 — scoped delta review: re-gate-3 blocker + closeup NIT VERIFIED CLOSED, evidence ruled discriminating, zero NITs; **v0.3.3: the sole outstanding condition — recorded 18a nominee acceptance — now exists** (18a v0.2.0, signed CIO 2026-09-12 by project-owner directive, evidence-review method; §6); prior chain: re-gate 1 APPROVE @ `f70ae51`, decision #23) · **Date:** 2026-09-12 · **Author:** worker-1 → Lead review → CTO approval

> **v0.3.3 (L6 exit — 18a acceptance recorded):** the sole condition the
> re-gate-4 verdict left outstanding — the recorded business-nominee
> acceptance — now exists: `18a-uat-signoff-sheet.md` **v0.2.0** (2026-09-12)
> carries signed acceptance for all six scenarios + the overall acceptance,
> signatory **CIO**, named by the project owner under the full-authority
> grant (PROJECT-STATE decision #28); method = informed review of the
> archived evidence (§10 index), the CTO-ruling-sanctioned option 2. §6
> criterion-1 flips to MET; **L6 EXITED**. Release proceeds to the
> consolidated Release review (codex), which reviews this record together
> with the post-approval T2 deltas (DCR-11 doc 21 v0.3.0, doc 19 v0.4.2,
> doc 20 v0.1.2 + their code changes).

> **v0.3.2 (re-gate-3 blocker fix — decision #25):** the re-gate-3 verdict
> found FR-CMS-004(b) violated **as-built** — App.tsx seeds
> contacts/documents from bundled samples and, on authenticated hydration
> failure, only toasted, leaving samples feeding the authenticated
> Directory/Documents views (contradicting the documented D7 semantics at
> App.tsx:147). **Fixed (W3-4O-3, this document's commit)**: the
> authenticated catch now empties both slices (empty + error toast — never
> samples). Evidence re-executed with unique server-only
> contact+document probes (O0-PROBES): run `run-2026-09-11T2358Z-offlinesim`
> — **11 PASS / 0 FAIL / +1 OBS**, exit 0 — O4b now asserts the exact toast
> AND both authenticated surfaces render **empty** (server probe strict-0,
> bundled sample strict-0); O4c asserts both probes return on recovery;
> O4a closeup recaptured complete (re-gate-3 NIT). Defect registered as
> DEF-002 (§7, fixed in-cycle). e2e regression 63 PASS / 0 FAIL / 1 known
> FLAKY, exit 0.

> **v0.3.1 (re-gate-2 blocker closure — decision #24):** the re-gate-2
> verdict ruled UAT-043's v0.3.0 PASS overclaimed (O2a evidences the badge
> over the login screen; FR-CMS-004(a) rendered-bundled-content acceptance
> uncovered) and offered **supplying covering evidence** as a closure path.
> Executed: the class-O lane extended with a **surgical data-endpoint
> outage leg (O4, route-abort)** — run `run-2026-09-11T1501Z-offlinesim`
> (**10 PASS / 0 FAIL / +1 non-gating OBS**, exit 0): O4a renders
> **bundled news/rooms/banners in the logged-in portal under the badge**
> with the server-only marker strictly absent (acceptance (a)); O4b surfaces
> the exact authenticated sync-failure toast — no silent substitution
> (acceptance (b)); O4c recovers — server data back, badge gone (acceptance
> (c)). UAT-043 stays **PASS** on full covering evidence (§5); §3/§10
> records updated; slash-separated badge renderings now labeled two-line
> transcriptions (re-gate-2 NIT).

> **v0.3.0 (obs-U1 closure — re-gate-1 rider "offline-simulation evidence
> required before Release review"):** new evidence class **O** (§3): worker-2
> lane `tests/uat-offline-sim.mjs` (:3225, 14:19:40Z→14:20:31Z @ git
> `f9c1f55`) — run `run-2026-09-11T1419Z-offlinesim`: **6 PASS / 0 FAIL**,
> exit 0; offline badge byte-for-byte + bundled sample data *(claim narrowed
> by re-gate 2, decision #24 — rendered-content covering evidence supplied
> at v0.3.1)* + honest offline-login refusal + full recovery.
> **UAT-043 NOT TESTED → PASS** (§5;
> tally 62 PASS · 0 NOT TESTED); obs-U1 disposition EXECUTED (§7); the L6
> outstanding list reduces to the 18a nominee sign-off (§6).

> **v0.2.1 (codex re-gate 1 = APPROVE, decision #23 — 4 NITs applied):**
> (1) the lead-review ruling (a) and the UAT-1 A4-toast sentence are labeled
> superseded by v0.2.0; (2) §10's J-transcript bullet acknowledges the
> concurrent document edits present in the tree during the lane (worker
> judgment call 4); (3) 18a v0.1.1 carries the exact J archive path; §8
> records the `hasThaiReasonInAudit` future-assert note. Verdict: "approved
> as a technical UAT record. Business acceptance remains outstanding."
> Release withheld; L6 exit conditional.

> **v0.2.0 (codex gate-1 = REVISE, decision #21 — fix cycle applied):**
> (1) §6 criterion-1 no longer declared MET — scripted execution is technical
> evidence; Doc 12 §11 acceptance requires **recorded business-nominee
> sign-off** (instrument: `docs/deliverables/18a-uat-signoff-sheet.md`);
> L6 PENDING. (2) §4 W/P attributions corrected (walkthrough C2 uploads then
> cancels — attachment journey evidence re-executed; D2's reject reason is
> English — Thai-reason cycle re-executed in the UI; no-toast criterion now
> swept explicitly) via the journey-evidence lane (§3 class J). (3) §3 W path
> fixed (the root `e2e-results.json` is the earlier 1127Z pre-scope run) and
> probe counts restated as literal verdicts (48 PASS + 1 retained FAIL).
> UAT-043 rationale restated as an accepted exception per the CTO ruling.

> Assembled strictly from archived evidence captured in the W3-4 lane (transcript
> `.omc/reports/w3-4-uat.log`, probe logs under `.omc/reports/w3-4-uat/`,
> walkthrough results JSON, screenshot run directories with SHA256 manifests)
> per Test Plan Doc 12 §9 (evidence capture rules). No number in this document
> is asserted without a cited record; where archived evidence is absent the
> item is marked **NOT TESTED** rather than inferred (§5 row UAT-043). Counts
> are quoted verbatim. UI strings are quoted Thai-first as displayed.

> **Lead review (2026-09-11) — PASS.** Mechanical verification all reconciled:
> tree scope (only this doc + `tests/uat-visuals.mjs` new), transcript tokens,
> both run-dir archives re-verified with fresh `shasum -a 256 -c`, both results
> JSONs (64 rows / 63 PASS + 1 FLAKY; 6 PASS), and the new lane file
> (node --check, env contract). **All 14 worker judgment calls accepted** —
> J-14 corrected in-review: `git show` timestamps prove **no mid-lane HEAD
> move** (`a099586` 12:22:07Z and `e205743` 12:26:48Z both precede lane start
> 12:27:54Z; the draft's "`a099586`→`e205763`" advance was a dispatch-head
> misreading plus a typo — §2 and §9 J-14 amended). **Lead rulings**: (a)
> scripted role proxies satisfy Doc 12 §11 for L6 exit, with the caveat riding
> to the CTO gate — formal business-nominee sign-off scheduled as a
> Release-gate item *(**SUPERSEDED by the codex gate-1 ruling, decision #21**:
> scripted execution ≠ §11 acceptance; recorded nominee sign-off required —
> §6 PENDING, instrument 18a)*; (b) obs-U1 (UAT-043 NOT TESTED) is S3-class coverage
> debt, not a defect — an offline-simulation leg (Playwright
> `context.setOffline`) scheduled before Release-gate review.

---

## 1. Purpose & scope

**Purpose.** Report the executed results of test level **L6 UAT** (Doc 12 §4:
"Business acceptance per role, Thai-first UI, by (proxy) business users") —
the six role scenarios **UAT-1..6** of Doc 12 §5 executed on an
ENV-PROD-MODE server, plus the disposition of every RTM acceptance reference
**UAT-001..065** (Doc 12 §5.1: **65 references covering 62 distinct ids**),
and the L6 exit-criteria assessment against Doc 12 §7. Per Doc 12 §10, the
L6 run produces this document.

**Scenario proxies.** Doc 12 §11 assigns role proxies to "business-side
nominees arranged by Lead". For this Wave-3 execution the scenarios were run
as **scripted role proxies** (worker-1 executing the documented §5 scenario
steps verbatim through the real UI and API as each role) per the W3-4
dispatch. The CTO gate-1 ruling (decision #21) holds: scripted execution is
technical evidence only — §11 acceptance requires **recorded business-nominee
sign-off** (instrument `docs/deliverables/18a-uat-signoff-sheet.md`; §6
PENDING until the recorded acceptance exists — *recorded 2026-09-12, 18a
v0.2.0 signed CIO; §6 MET at v0.3.3*).

**Out of scope (per Doc 12 §10):** L0–L4 → Doc 17; L5 → Doc 19; remediation
re-runs → Doc 20.

## 2. Execution environment & provenance

Doc 12 §9.6 (git sha / env-matrix row / run timestamp) and §4 L6 row
("scripted role scenarios (§5) run on ENV-PROD-MODE with seeded demo data;
recorded screen captures"). All items quoted from the transcript
`.omc/reports/w3-4-uat.log`.

| Item | Record (verbatim from the lane transcript) |
|---|---|
| Git | `e205743d7396520a70d362c4d45250438276c96b` (`develop`) — clean-tree verification recorded at lane start (working tree: only this lane's new files untracked; `server.ts`, `scripts/smoke-test.mjs`, `tests/e2e-walkthrough.mjs` untouched). The lane ran **entirely at `e205743`**: the dispatch text referenced its authoring-time head `a099586`, which the Doc 20 approval flip (`e205743`, docs-only — PROJECT-STATE + doc 20) superseded 66 s before lane start; no commit landed during the lane window (judgment call J-14, §9 — corrected at lead review) |
| Build | `npm run build` → **exit 0**; `dist/server.cjs 162543 bytes` (matches the Doc 17 §2 current-head artifact size) |
| Server | boot #3: `NODE_ENV=production PORT=3223 node dist/server.cjs`, **no `DATABASE_URL`** (in-memory repository — boot `[WARN] NODE_ENV=production without DATABASE_URL` expected per Doc 12 §3), pid 1146, `/healthz` 200 at every lane checkpoint (last: 2026-09-11T13:11Z window) |
| Env matrix row | ENV-PROD-MODE characteristics on the host: `NODE_ENV=production`, disposable env-only `SESSION_SECRET`/`ADMIN_PASSWORD` (values never printed; no `.env` file read or modified; admin password handed to the server via a mode-600 `/tmp` file deleted at lane end). Doc 12 §4's L6 row demands ENV-PROD-MODE + seeded demo data + recorded captures — it does **not** demand compose/PG; the host-run in-memory prod-mode server satisfies the row (judgment call J-1). PG-only behaviors are cited from Doc 17 L4 records (class C, §3) |
| Demo data | server boot seeds (demo news/banners/contacts/rooms/documents) + walkthrough-provisioned role users `maker01`/`checker01`/`staff01` (`E2E-Test@2026`) — S0 provisioned all three (retry evidence attached) |
| Ports | **host :3000 never touched** (operator's unrelated project; verified busy and left alone). Lane used **:3223** exclusively (verified free before bind; released at lane end — §10 teardown tokens). Doc 12 §3's dedicated-port rule (smoke 3210 / e2e 3220) extended with a lane-local port per the dispatch |
| Lane window | `lane_started_utc=2026-09-11T12:27:54Z` → lane end (§10); tooling node v24.13.1, Playwright 1.63.0, darwin 25.5.0 |
| Transcript | `.omc/reports/w3-4-uat.log` — header carries git rev, untracked-file list, UTC window, build provenance; every probe family, walkthrough run, visuals run, invalidation, and teardown token is appended in order |

## 3. Execution method & evidence classes

Doc 12 §5 defines the six scenarios as UI journeys; the repo's walkthrough
(`tests/e2e-walkthrough.mjs`, unmodified) covers most journey steps as
real-browser assertions. Steps not covered were executed as **scripted API
probes in the Doc 19 §5 lane-executed style** (every probe logs method +
path + payload + raw status + untruncated response body; passwords uniformly
redacted). Each UAT-0nn verdict cites one of six evidence classes:

| Class | Meaning | Record |
|---|---|---|
| **W** | Walkthrough row (real-browser UI journey step) | runId **`run-2026-09-11T1243Z-e2e`** — `.omc/reports/w3-4-uat/e2e-results.json`: **64 rows = 63 PASS / 1 FLAKY / 0 FAIL**, exit 0; 46 screenshots + `MANIFEST.sha256` in `.omc/reports/screenshots/run-2026-09-11T1243Z-e2e/` (`shasum -a 256 -c` → exit 0, re-verified fresh at Doc 18 assembly). *(v0.2.0: path corrected — the root `.omc/reports/e2e-results.json` holds the earlier `run-2026-09-11T1127Z-e2e` pre-scope harness verification, a different run)* |
| **P** | Lane probe (scripted curl/node, Doc 19 style) | `.omc/reports/w3-4-uat/probe-*.log` — **43 literal verdicts in the main families: 42 PASS + 1 FAIL**, plus one successful PDF-upload record logged without an explicit verdict line (3 logged probes, 2 verdict lines — `probe-uat2-uploads.log`) (the FAIL is a probe-script assertion bug, not a product behavior — corrected re-probe `probe-export-shape-corrected.log` → PASS; judgment call J-7), **plus 5 addendum PASS** (§5 rows UAT-028/032) = **48 literal PASS verdicts + 1 retained FAIL record** overall *(v0.2.0: counts restated as literal `VERDICT:` lines per the gate-1 ruling; the original logs are unchanged)* |
| **V** | Visual/UI capture leg (`tests/uat-visuals.mjs`, new lane file) | runId **`run-2026-09-11T1255Z-uat`** — `visuals-results.json`: **PASS=6 FAIL=0** (V0 prep + V1..V5), exit 0; 8 screenshots + `MANIFEST.sha256` (`shasum -a 256 -c` → exit 0, re-verified fresh) |
| **J** | Journey-evidence leg (gate-1 fix cycle; `tests/uat-journey-evidence.mjs`, new lane file) | runId **`run-2026-09-11T1344Z-uat2`** — `journey-results.json`: **15 PASS / 0 FAIL** (S0 bootstrap + J1/J2/J3 legs), exit 0; 10 screenshots + `MANIFEST.sha256` (`shasum -a 256 -c` → exit 0); J3 toast ledger: 8 sweeps, summed error surfacing = **0** |
| **O** | Offline-simulation leg (obs-U1 closure v0.3.0; re-gate-2 covering evidence v0.3.1; re-gate-3 blocker fix + re-execution v0.3.2; `tests/uat-offline-sim.mjs`, new lane file) | runId **`run-2026-09-11T2358Z-offlinesim`** — `offline-results.json`: **11 PASS / 0 FAIL** (+1 non-gating OBS), exit 0 (O0 + O0-MARKER + **O0-PROBES** server-only contact/document probes · full-offline legs O1–O3 · route-abort data-outage legs O4-SETUP/O4a/O4b/O4c); 12 screenshots + `MANIFEST.sha256` (`shasum -a 256 -c` → exit 0). *(run history: v0.3.0 `…T1419Z` 6 PASS/4 PNGs → v0.3.1 `…T1501Z` 10 PASS/8 PNGs → v0.3.2 `…T2358Z` — all transcripts retained; each superseded only by extending the same file)* |
| **C** | Cited standing-suite record (no re-execution this lane) | Doc 17 (L2/L4) and Doc 19 (L5) archived records — used only where the behavior is environment-bound (PG persistence, prod-boot secret guard, timing) and the standing record already asserts it |

**FLAKY disposition (Doc 12 §9 rule 4):** the single W FLAKY is row `S0`
("Bootstrap: admin login + role users provisioned via /api/users") with
embedded retry evidence — `"passed on retry: maker01:exists, checker01:exists,
staff01:exists"` — the known S0-retry signature recorded across the standing
gate runs (Doc 17 §3.4). One FLAKY, retry evidence attached; the "two FLAKY
on the same step = FAIL" rule is not triggered.

## 4. Scenario results (Doc 12 §5)

Full-pass criterion per Doc 12 §5: "the scenario completes with the business
outcome and no error toast". All six scenarios completed their business
outcomes with cited evidence. The no-error-toast element is qualified
(v0.2.0, gate-1 ruling): walkthrough A4 verifies an *expected*
wrong-password error and cannot alone substantiate toast absence — the
journey-evidence lane (§3 class J, leg J3) swept **8 success steps with zero
unexpected error surfacing** (`summedErrorSurfacing=0`; 8 benign success
toasts recorded — full ledger in `journey-results.json → toastSweeps`).
Verdicts below cite the covering rows.

| Scenario | Role | Verdict | Evidence (class W unless noted) |
|---|---|---|---|
| **UAT-1** — log in → read news → find colleague → open policy document → book room → release it; no CMS/Sync nav | staff | **PASS** | B0 login → portal home; B4 news ("ข่าวสารและประกาศ") loads seeded articles; B5 article modal; B9/B10 Directory ("สมุดโทรศัพท์") search by name + department chips; B13 document open (category filter); B11 book → In-Use; B12 release → available; B14 header badge STAFF, CMS/External nav absent; B17 logout. No error toast *(v0.2.0 supersession: the original "suite asserts bilingual error surfaced only where expected, A4" sentence established expected-error handling, not toast absence — see §4 intro; J3 supplies the success-step sweep evidence)*. Supplementary: V5 deep-link gate (V), F1 375px no overflow |
| **UAT-2** — CMS create w/ attachment → draft → edit → submit → pending (amber); maker cannot approve own item | maker | **PASS** | C0 CMS nav; C1 create; C4 submit → Thai chip รอการอนุมัติ (amber dot); own-approval blocked server-side (P `maker-self-approve-blocked` → **403**, probe-uat2-maker) and no Approve/Reject controls rendered (C5). Draft edit persistence: C3 (fields preserved) + **J1 (attachment)** — *v0.2.0 attribution fix: walkthrough C2 uploads then cancels the form, so attachment persistence is NOT W-evidenced; J1 closes the gap: the uploaded `/uploads/ecf6a596-…png` survives draft save → editor reopen (form field) → content edit → submit with strict URL equality at every stage, `pending_approval` w/ imageUrl intact*. Supplementary: P full draft/false create contract; V4 External Web Sync preview (V) |
| **UAT-3** — approval queue → reject w/ Thai reason → resubmitted item → approve; audit tab shows both | checker | **PASS** | D0 queue visible; D2 reject with required reason (input `E2E: wording revision required`, English) → ถูกปฏิเสธ; D0a+D1 resubmitted item approved → เผยแพร่แล้ว + sync log entry (✓ approver stamped); D3 Audit Trail tab lists both decisions with correct actors. **Thai-reason cycle in the real UI (J2)** — *v0.2.0 attribution fix: D2's reason is English, so the Thai cycle was P-only at v0.1.0; J2 closes it: checker rejects with `'ทบทวนถ้อยคำภาษาไทยอีกครั้งก่อนเผยแพร่'` (button disabled while empty), ถูกปฏิเสธ; maker reopens (attachment intact), forced draft ร่าง, resubmit → รอการอนุมัติ; approve → เผยแพร่แล้ว (`synced`, `approvedBy=checker01`); Audit Trail shows BOTH the REJECT (Thai reason in the entry) and APPROVE rows*. Supplementary: P full reject-cycle semantics (forced reset, resubmit, stamps) |
| **UAT-4** — user lifecycle → self-deactivation blocked → re-activate → sync trigger → export JSON | admin | **PASS** | E0 admin nav; E4 create staff + duplicate 409 inline; E4b deactivate kills login server-side + reactivate restores; self-deactivation refused (P `self-deactivation-blocked` → **400** with clear message, probe-uat4-admin); E6 force sync trigger reports; E7 JSON export downloads; P `system-export-admin` → 200 with **non-zero counts** `{"news":15,"banners":6,"contacts":9,"meeting_rooms":5,"documents":8,"audit_logs":73,"sync_logs":8}` (DCR-1 top-level `tables` shape; corrected re-probe) |
| **UAT-5** — CMS by URL state; deleted-account login | staff (negative) | **PASS** | V5 staff deep-link `/?view=admin-cms#/cms` → portal chrome renders, `#nav-cms=0`, System Dashboard=0 (view state not URL-addressable; V); A6 deep-link/query params do not bypass auth gate; B14 nav-limited corroboration; deactivated login fails with **generic** error (P `deactivated-login-rejected` → 401, body byte-identical to wrong-password 401 — `generic_error_check: true`, probe-uat5-negative) |
| **UAT-6** — visit portal logged out | anonymous | **PASS** | A1 `/` shows the login screen (auth gate); V3 login at 375px (V); public surfaces answer anonymous (P: `/api/news` 200 non-empty + search, `/api/banners` 200, `/api/rooms` 200, `/api/tools` 200 — probe-uat6-anonymous); directory/documents/users/audit demand login (P: 401 ×4) |

**Scenario tally: 6/6 PASS · 0 FAIL · 0 FLAKY at scenario level.**

## 5. Per-reference results (RTM UAT-001..065 → Doc 12 §5.1)

62 distinct ids (Doc 12 §5.1: 65 references; **UAT-015/023/047 dual-cited**,
**UAT-011 reserved** — FR-SES-005 is TC-only, **UAT-049 retired to TC-only**
per DCR-8, **UAT-050 does not exist**). Verdict rule: PASS only with cited
evidence; **NOT TESTED** where no executable path exists (never inferred).

| Ref | Verdict | One-line evidence (class) |
|---|---|---|
| UAT-001 login | PASS | B0 staff login → portal home; S0 admin login (W) |
| UAT-002 rate limit | PASS | A5 6th failed attempt → rate-limit message (W) |
| UAT-003 logout | PASS | B17 staff logout returns to login screen (W) |
| UAT-004 /me | PASS | `me-self-id` GET /api/auth/me → 200 with user id (P) |
| UAT-005 timing uniformity | PASS | Doc 19 TC-SEC-009: unknown-user median 208.9 ms vs wrong-password 206.5 ms, ratio 1.01, n=10+10 (C); lane corroboration: deactivated-401 body === wrong-password-401 body (P) |
| UAT-006 LOGIN_FAILED audit | PASS | `audit_LOGIN_FAILED_rows: 6` with actor/ip/action sample fields (P) |
| UAT-007 token verify | PASS | smoke §16 tampered-cookie 401 (Doc 17 A.2) (C); valid-token round-trips B0/V5b (W/V) |
| UAT-008 session persistence | PASS | L4 TC-SYS-002: session cookie survived `restart app` (Doc 17 §3.5) (C) |
| UAT-009 cookie flags | PASS | `login_setcookie_flags: {"httpOnly":true,"sameSiteLax":true,"secure":true,"maxAge7d":true}` (P; values redacted, booleans only) |
| UAT-010 isActive gate | PASS | `deactivated-login-rejected` 401 (P) + E4b deactivate kills login server-side (W) |
| UAT-012 secret guard | PASS | TC-SES-006: prod boot w/o SESSION_SECRET → exit 1 + FATAL banner, `w3r1-p0-gaps.log` (C); lane boot #3 likewise required it |
| UAT-013 user list | PASS | E4 User Management list renders (W) |
| UAT-014 create user | PASS | E4 create + duplicate 409 inline (W) + `neg-user-create` 201 (P) |
| UAT-015 activate/deactivate (+self-block) | PASS | `self-deactivation-blocked` 400 clear message; deactivate→401→reactivate→200 cycle (P) + E4b (W). Dual-cited (FR-USER-003 + NFR-COMP-004) |
| UAT-016 no user delete | PASS | TC-USER-008: DELETE /api/users/:id → JSON 404 by design, `w3r2-gap-closures.log` (C) |
| UAT-017 bootstrap | PASS | S0 bootstrap admin + 3 role users (W, FLAKY w/ attached retry evidence — §3); boot `admin_login_smoke_http=200` (transcript) |
| UAT-018 public news list | PASS | B4 news section loads seeded articles (W) + `anon-news-public` 200 non-empty (P) |
| UAT-019 news create | PASS | C1 CMS form create (W) + `news-create-maker` 201, `externalSyncStatus='draft'`, `syncToExternal=false` (P) |
| UAT-020 news update | PASS | C3 edit preserves fields (W) + `maker-edit-rejected-resets-draft` PUT merge → draft (P) |
| UAT-021 admin news delete | PASS | E5 DELETE with confirmation removes disposable item (W) |
| UAT-022 submit-approval | PASS | C4 → รอการอนุมัติ (W) + `news-submit-maker` 200 (P) |
| UAT-023 approve (dual control) | PASS | D1 → เผยแพร่แล้ว + sync log (W) + `maker-self-approve-blocked` 403 / `checker-approve-happy` synced (P). Dual-cited (FR-NEWS-006 + NFR-COMP-001) |
| UAT-024 reject | PASS | D2 reason-required → ถูกปฏิเสธ (W) + `checker-reject-with-thai-reason` rejected (P) |
| UAT-025 important alert | PASS | B16 notification bell opens the urgent-alert article (W); alert flag carried on the public list (P `anon-news-public`) |
| UAT-026 public banners | PASS | `anon-banners-public` 200 (P) |
| UAT-027 banner create | PASS | C7 hero banner create (W) |
| UAT-028 banner update | PASS | `banner-update-maker-UAT-028` PUT 200, merge verified (subtitle replaced, title preserved) — addendum probe (P) |
| UAT-029 banner delete | PASS | `banner-delete-admin` 200 on disposable row (P) |
| UAT-030 directory search | PASS | B9 search by name (n=1) + B10 department chips (W) |
| UAT-031 contact create | PASS | C8 Phone Directory create (W) |
| UAT-032 contact update | PASS | `contact-update-maker-UAT-032` PUT 200, merge verified (position/floor replaced, name/nameEn preserved) — addendum probe (P) |
| UAT-033 contact delete | PASS | `contact-delete-admin` 200 on disposable row (P) |
| UAT-034 documents list | PASS | B13 category filter + document open (W) |
| UAT-035 document register | PASS | C9 register entry (W) + `document-create-disposable` 201 `isNew=true` forced (P) |
| UAT-036 document delete | PASS | `document-delete-admin` 200 (P) |
| UAT-037 public rooms | PASS | `anon-rooms-public` 200 (P) |
| UAT-038 book room | PASS | B11 book → In-Use (W) |
| UAT-039 release room | PASS | B12 release → available, booking cleared (W) |
| UAT-040 CMS view gating | PASS | B14 nav-limited + A6 gate (W) + V5 deep-link `#nav-cms=0`, System Dashboard=0 (V) |
| UAT-041 role-conditional CMS controls | PASS | C5 maker sees no Approve/Reject; C6 no delete/User-Mgmt tab; D4 checker edit allowed / delete forbidden (W) |
| UAT-042 inline errors/toasts | PASS | C-FR failed save keeps form open with entered data (W) |
| UAT-043 offline fallback | **PASS** (v0.3.0; evidence completed v0.3.1; (b) conformance fixed + re-evidenced v0.3.2) | Class **O** (§3): run `run-2026-09-11T2358Z-offlinesim` — FR-CMS-004 acceptance covered in two complementary legs. **(a) rendered sample content with the badge (O4a — surgical data-endpoint route-abort at login-hydration; deterministic; honestly labeled route-abort, not `context.setOffline` — JC5):** the logged-in portal (staff01 real UI login) renders bundled news `บริษัทฯ ขอแจ้งเตือนภัยทุจริต (Anti-Fraud Alert)`, bundled room `Kookmin Room` (after the real Meeting-Rooms-tab click), and bundled banner `เรื่องเงินจบไว ไว้ใจ KASHJOY !` under the offline badge — badge text asserted **strict `===` byte-for-byte** (actual string is two lines, Thai line then English line; transcribed inline with a slash as `โหมดออฟไลน์ — แสดงข้อมูลตัวอย่าง / Offline mode — showing bundled sample data` — re-gate-2 NIT label; runtime src/App.tsx re-read cross-check); server-only dual-control marker strictly absent (count 0; the server seeds the same bundle, so a unique approved item is the discriminator). **(b) authenticated data never substituted with samples (O4b, v0.3.2 — product fix + extended assertions):** re-gate 3 (decision #25) found the as-built client left bundled samples feeding the authenticated views on hydration failure (DEF-002, §7 — fixed in-cycle by W3-4O-3: the authenticated catch now empties both slices). Evidence on the fixed build: exact toast `Directory/documents sync failed: Cannot reach server (network error)` strict `===` (composed from src/App.tsx:181 + src/api.ts:90) AND both authenticated surfaces render **empty during the outage** — the Directory shows neither the unique server-only contact probe nor the bundled sample `คุณวรวุฒิ เกียรติศิริ` (both strict 0), Documents shows neither the server-only document probe nor the bundled sample `จรรยาบรรณในการดำเนินธุรกิจ (Code of Business Conduct & Ethics)` (both strict 0) — no substitution anywhere. **(c) badge clears on reconnect (O4c):** `unrouteAll` + real `page.reload()` → server-seeded news returns (polled), both server-only probes return on their surfaces, and badge count = 0 (strict). **Full-offline corroboration (O2 legs, v0.3.0):** logout-while-offline shows the badge byte-for-byte; offline login retry is refused with the real network error and the badge persists (no fake success); recovery returns server data with the badge gone. *Scope note (honest): the stable logged-in bundled view is not reachable under full offline (offline login refused; an offline reload cannot load the same-origin SPA) — which is precisely why acceptance (a) is evidenced by the surgical data-outage leg O4: `route.abort()` drives the identical client code path (fetch rejection → `publicGet` bundled fallback + offline flag) while the SPA is still served; the recovery first-paint transient was not captured (recorded as a non-gating OBS).* *(v0.3.1 history: (b) was then evidenced by the toast assertion alone — re-gate 3, decision #25, ruled that insufficient and identified the as-built violation; the fix + extended O4b supplied the conforming evidence. v0.3.0 history: the initial PASS rested on the O2 legs alone — re-gate 2, decision #24, ruled the rendered-bundled-content acceptance uncovered; the O4 leg supplied the covering evidence. v0.1.0–v0.2.1 history: NOT TESTED — no scripted offline-sim asset existed L2–L6; obs-U1 §7 CTO-ratified exception required this leg before Release review — RTM maps FR-CMS-004→UAT-043 at `04-rtm.md:129`)* |
| UAT-044 session restore | PASS | V5b reload → still authenticated, no login form (V) |
| UAT-045 public portal components | PASS | `anon-tools-public` 200 (P) + A1/B1 portal chrome and carousel render (W) |
| UAT-046 audit actor stamping | PASS | D3 correct actors (maker01/checker01) on trail (W) + server-derived actor fields on LOGIN_FAILED samples (P) |
| UAT-047 audit trail read | PASS | D3 checker reads trail (W) + `audit-logs-admin-read` 200 array (P). Dual-cited (FR-AUDIT-002 + NFR-COMP-002) |
| UAT-048 audit action types | PASS | `audit_action_union_observed` = `["APPROVE","FILE_UPLOAD","LOGIN","LOGIN_FAILED","LOGOUT","REJECT","SUBMIT_APPROVAL","SYNC_TRIGGER","SYSTEM_EXPORT","UPDATE","USER_ACTIVATE","USER_CREATE","USER_DEACTIVATE"]` — 13 live values incl. the W2-3 additions; pruned members absent (P) |
| UAT-051 sync status machine | PASS | C1→C4→D1/D2 draft→pending→synced/rejected (W) + P full cycle incl. reject→edit-forced-reset→resubmit→approve (`synced`, `approvedBy`) |
| UAT-052 sync-log writes | PASS | D1 sync log entry on approve (W) + E9 Sync Logs tab (W) |
| UAT-053 admin sync-log read | PASS | `sync-logs-admin-read` 200 array (P) + E9 (W) |
| UAT-054 sync trigger | PASS | E6 trigger runs and reports (W) + `sync-trigger-admin` 200 (P) |
| UAT-055 External Web Sync preview | PASS | V4 maker view renders simulator heading (V) + B14 staff-side absence (W) |
| UAT-056 system export | PASS | E7 JSON export downloads (W) + `system-export-admin` 200 DCR-1 top-level `tables` shape, non-zero counts (P, corrected re-probe) |
| UAT-057 upload + audit | PASS | C2 image upload → server URL (W) + `upload-pdf-maker` URL returned (P) |
| UAT-058 whitelist/limits | PASS | `upload-exe-rejected` 400 (P) + L2 §11 whitelist/413 matrix (C) |
| UAT-059 UUID serving | PASS | `uploaded-url-served-anonymously` 200, `x-content-type-options: nosniff`, UUID path (P) |
| UAT-060 global search | PASS | B8 Ctrl+K opens, finds seeded article, keyboard usable (W) |
| UAT-061 public news search | PASS | `anon-news-search-public` 200 (`news_search_hits_for_W34-UAT` recorded) (P) |
| UAT-062 contacts search | PASS | B9 name-field search filters (W) |
| UAT-063 Thai-first strings | PASS | A2 bilingual login labels + hotline 1258; Thai status chips รอการอนุมัติ / เผยแพร่แล้ว / ถูกปฏิเสธ (C4/D1/D2); V3 mobile login Thai-first verbatim (V) |
| UAT-064 bilingual fields | PASS | B8 English-title search ("BOT") (W) + `titleEn` carried and returned on created items (P) |
| UAT-065 Thai dates | PASS | created items return `"publishedAt":"11 ก.ย. 2569"` (Thai-locale, Buddhist era) — verbatim from probe bodies (P) |

**Per-reference tally (v0.3.0): 62 PASS · 0 NOT TESTED · 0 FAIL — 62 distinct
ids accounted.** *(v0.2.1 history: 61 PASS · 1 NOT TESTED (UAT-043).)*

## 6. Exit-criteria assessment (Doc 12 §7 L6 row)

| Criterion (quoted from Doc 12 §7) | Assessment | Evidence |
|---|---|---|
| "All 6 UAT scenarios accepted by role proxies" | **MET (v0.3.3)** — the recorded business-nominee acceptance now exists: 18a v0.2.0 (2026-09-12) carries signed acceptance for all six scenarios — signatory **CIO**, named by the project owner under the full-authority grant (PROJECT-STATE decision #28), method = informed review of the archived evidence (the CTO-ruling-sanctioned option 2; the reviewed set = the §10 evidence index: 76 manifest-hashed screenshots across four run archives + all results JSONs + transcripts, 62/62 references PASS, 0 defects ≥S2 open). *(v0.3.2 and earlier: PENDING — technical execution complete: 6/6 scenarios PASS on executed evidence (§4; scripted role proxies on ENV-PROD-MODE, seeded demo data, recorded captures per Doc 12 §4 L6 row); Doc 12 §11 acceptance required recorded nominee acceptance — CTO gate-1 ruling, decision #21. L6 stayed PENDING until the recorded acceptance existed — it now does)* | §4; W/P/V/J/O records; 18a sheet v0.2.0 |
| "defects ≥S2 = 0 open" | **MET** — zero product defects found at any severity in the lane; nothing ≥S2 open (§7). *(v0.3.2 qualification: DEF-002 (S3, below the S2 bar) was identified at CTO re-gate-3 review and is FIXED in-cycle — §7 register; open ≥S2 remains 0)* | §7 register |

**L6 verdict: EXITED (v0.3.3).** Both criteria MET: 6/6 scenarios accepted
on the recorded business-nominee acceptance (18a v0.2.0, signed CIO
2026-09-12 — §6 criterion 1) and defects ≥S2 = 0 open (§7). Executed
evidence: 6/6 scenarios technically complete (§4), and (v0.3.0) the obs-U1
offline-simulation leg **EXECUTED** (class O, §3/§10), completed at v0.3.1
with the re-gate-2 covering-evidence leg O4 and at v0.3.2 with the
re-gate-3 conformance fix — FR-CMS-004 acceptance (a)/(b)/(c) all evidenced
on the fixed build (§5 UAT-043). *(v0.3.2 and earlier: PENDING — the sole
outstanding item was the recorded business-nominee acceptance for all six
scenarios (18a sheet) per the CTO gate-1 ruling; v0.2.1 history: obs-U1
offline-sim closed by the v0.3.0 class-O lane. v0.3.0 history: re-gate 2,
decision #24, ruled the outstanding list could not yet reduce solely to
18a — resolved by the v0.3.1 O4 covering evidence. v0.3.1 history:
re-gate 3, decision #25, found (b) unestablished and violated as-built —
resolved by the v0.3.2 fix + re-execution.)*

## 7. Findings register (Doc 12 §8 format)

**Product defects: none (0 findings, S1–S4)** *(as executed v0.1.0–v0.3.1:
no error toast, wrong status transition, boundary escape, or data issue was
observed in any scenario, probe, or capture leg. One defect was subsequently
identified by the CTO re-gate-3 **source review** — not by lane execution —
and is registered below as DEF-002, fixed in-cycle at v0.3.2.)*

**Defect register (v0.3.2):**

| id | Severity | Finding | Disposition |
|---|---|---|---|
| DEF-002 | S3 | FR-CMS-004(b) as-built violation (codex re-gate 3, decision #25): on authenticated hydration failure the client left bundled sample contacts/documents in state, feeding the authenticated Directory/Documents views — misleading data during an outage, contradicting the documented D7 semantics (App.tsx:147 "authenticated endpoints surface failures instead of falling back") | **FIXED in-cycle (W3-4O-3, this document's commit)**: the authenticated catch empties both slices (empty + error toast — never samples); verified by extended O4b (both surfaces strict-0 for the server probe AND the bundled samples during the outage) + O4c (probes return on recovery) + e2e regression 63 PASS / 0 FAIL / 1 known FLAKY, exit 0 |

**Coverage-gap observation (non-defect):**

| id | Severity | Observation | Disposition |
|---|---|---|---|
| obs-U1 | S3 (coverage debt) | UAT-043 (FR-CMS-004 offline fallback / offline badge) has no scripted offline-simulation asset in any suite L2–L6; reported **NOT TESTED** per Doc 12 §9 rule 3 rather than inferred | CTO-ratified accepted exception (Doc 18 gate-1, decision #21): an offline-simulation leg (e.g. Playwright `context.setOffline`) is **required before Release-gate review**. UAT-043 is nominally exercised inside scenario UAT-1 per §5.1's containment rule — deferral is an accepted coverage exception, not evidence of coverage. **EXECUTED 2026-09-11 (v0.3.0)**: the required offline-sim leg ran as the class-O lane (§10) — 6 PASS / 0 FAIL, exit 0; UAT-043 flipped to PASS (§5). Debt closed pending codex re-gate 2 → re-gate 2 (decision #24) demanded rendered-content covering evidence → **O4 leg executed (v0.3.1)**: run `run-2026-09-11T1501Z-offlinesim` 10 PASS / 0 FAIL, exit 0 — acceptance (a)/(b)/(c) all evidenced (§5 UAT-043) |

**Lane annotations (verification-methodology notes, retained per
annotate-not-rewrite; none are product findings):**

| id | Annotation |
|---|---|
| L-1 | Walkthrough run 1 (pre-12:43Z) INVALID — a zsh env-prefix scoping bug emptied `E2E_ADMIN_PASSWORD` for the harness; marked INVALID in the transcript, never cited as product evidence. The cited run is the re-executed `run-2026-09-11T1243Z-e2e` |
| L-2 | Visuals run 1 (`run-2026-09-11T1249Z-uat`) V1 page-shot INVALIDATED — the capture raced the ConfirmDialog 150 ms animate-in fade (pixel profile identical to no-dialog: meanLum 234.5/darkFrac 0.008). Re-captured in run 2 (`…T1255Z-uat`) with a 600 ms settle + visibility bracket + element closeup; run-2 verified four ways (DOM exact-substring assertions, closeup visual, PNG luminance physics: meanLum 129.5/darkFrac 0.093 vs no-dialog 234.5–235.3/0.008–0.009, brightened-crop visual). Two image-model reads of the dimmed full-page shot reported "no dialog" — documented as image-model misreads of a scrimmed page (OCR also reads Thai text approximately); DOM-level assertions govern. Run-1 dir retained as history |
| L-3 | Probe `system-export-admin` run-1 EXPECT-FAIL was a **probe-script assertion bug** (asserted the pre-DCR-1 `data.tables` wrapper instead of the top-level `tables` shape). Corrected probe re-executed standalone → PASS (`probe-export-shape-corrected.log`); product behavior conformant. Derived verification artifacts (luminance stats, brightened crop) lived in `/tmp` only and never entered the evidence MANIFEST |

## 8. Doc 21 §12 visual closures (required captures)

All three closures captured in run **`run-2026-09-11T1255Z-uat`**
(`.omc/reports/screenshots/run-2026-09-11T1255Z-uat/`, 8 files +
`MANIFEST.sha256`, `shasum -a 256 -c` → **exit 0**, re-verified fresh at Doc
18 assembly). Captured by `tests/uat-visuals.mjs` (new lane file;
`tests/e2e-walkthrough.mjs` NOT modified — the dispatch's allowed fallback).

| # | Doc 21 §12 requirement | File (sha256 prefix) | Verification |
|---|---|---|---|
| 1 | Withdraw confirm dialog "เพิกถอนจากเว็บไซต์สาธารณะ / Withdraw from public web" — maker create → submit → checker approve → withdraw, screenshot BEFORE confirming | `v1-withdraw-confirm-dialog.png` (`0903b9182f2a65a5…`) + element closeup `v1c-withdraw-dialog-closeup.png` (`9be8ad3c20ee2323…`) + post-confirm `v1b-withdrawn-row-draft.png` (`e43cbc762c1807ed…`) | In-script DOM assertions (exact-substring title/item/consequence ร่าง, visibility bracket, working confirm → row returns ร่าง) + closeup + luminance physics + brightened-crop visual (L-2); OCR reads approximate, DOM governs |
| 2 | NEW badge close-up on a documents card | `v2-new-badge-documents-card.png` (`86069503472bc51c…`) | Badge visibility asserted in-script on a freshly registered card (`isNew` forced server-side); image read confirms the NEW pill top-right of the title line; timestamp suffix ties the frame to run-2 |
| 3 | Login screen at 375px mobile | `v3-login-mobile-375.png` (`2f1aec80f91e45b5…`) | In-script overflow assertion (scrollWidth−clientWidth = 0 px); image read confirms centered, no clipping, Thai-first labels verbatim (ชื่อผู้ใช้งาน / Username · รหัสผ่าน / Password · เข้าสู่ระบบ / Sign in), hotline 1258 |

Extra UI legs captured in the same run (supporting §5 rows): `v4-maker-external-web-sync.png` (UAT-055), `v5-staff-deeplink-no-cms.png` + `v5b-session-restore-after-reload.png` (UAT-040/044).

*codex gate-1 NIT (recorded, non-blocking): `hasConsequence` is logged by the
capture script (`tests/uat-visuals.mjs:138,154`) but is not part of V1's
in-script failure condition — the archived value is `true` and the image
visibly contains ร่าง, so the capture stands; future runs should include it
in the assertion. Re-gate-1 NIT (same class): `hasThaiReasonInAudit` in the
J2 lane is likewise logged (archived value `true` — the Thai reason is
visible in the audit entry) but not asserted; future runs should assert it.*

## 9. Worker judgment calls (flagged for Lead review)

1. **Host-run prod-mode server instead of compose** — Doc 12 §4's L6 row
   demands ENV-PROD-MODE + seeded demo data + recorded captures, not compose
   specifically; host-run `NODE_ENV=production` in-memory satisfies it (the
   §3 in-memory WARN is the documented prod-boot-without-DATABASE_URL path).
2. **No PG run** — the L6 row demands no PG behavior; PG-bound ids cited from
   standing L4 records (UAT-008 → TC-SYS-002).
3. **UAT-6 surface interpretation** — "public marketing surfaces" exist as
   unauthenticated data endpoints (`/api/news`, `/api/banners`, `/api/rooms`,
   `/api/tools` → 200 anonymous) consumed by the authenticated portal; the
   anonymous UI is the login screen; directory/documents/users/audit demand
   login (401). No unauthenticated portal UI exists by design.
4. **UAT-043 NOT TESTED** — no offline-simulation asset exists anywhere;
   reported honestly (obs-U1) rather than inferred.
5. **Walkthrough run-1 invalidation** (L-1) — harness env bug, re-run valid;
   invalid run never cited.
6. **Visuals V1 anomaly handling** (L-2) — run-1 fade-race invalidation,
   run-2 re-capture with settle fix, four-way verification, image-model
   misreads documented as lane annotation; derived verification artifacts
   kept out of the evidence MANIFEST.
7. **Probe export-shape correction** (L-3) — probe-script bug, corrected
   re-probe PASS; the original FAIL verdict reported, not hidden.
8. **Secrets discipline** — passwords redacted («redacted») in every logged
   payload; cookie flags recorded as booleans only; admin password handed to
   the server via mode-600 `/tmp` file, deleted and verified gone at lane
   end; root `.env` never read/printed/modified.
9. **runId suffix `-uat` + lane-scoped paths** — visuals captures write
   `run-…-uat` dirs (distinct from `-e2e` runs); probe/result artifacts under
   `.omc/reports/w3-4-uat/` so no standing-suite artifact is clobbered.
10. **Disposable residue** — lane uploads wrote to gitignored
    `uploads-w34-uat/`; the banner/contact addendum rows remain only on the
    disposable in-memory server, destroyed at lane end.
11. **S0 FLAKY** treated per Doc 12 §9 rule 4 with attached retry evidence
    (known signature, single occurrence).
12. **UAT-017 verdict source** — carried by S0's attached retry evidence plus
    the boot-time admin login token (`admin_login_smoke_http=200`).
13. **Addendum probes** — UAT-028/032 were initially unevidenced; rather than
    reporting NOT TESTED, two merge-semantics probes were executed while the
    lane server was still up (logged in the same style, exit 0).
14. **Dispatch-head supersession (corrected at lead review)** — the draft
    recorded a mid-lane advance `a099586`→`e205763`; in fact `git show`
    timestamps place both commits **before** lane start (`a099586` 12:22:07Z,
    `e205743` 12:26:48Z vs `lane_started_utc` 12:27:54Z): the dispatch text
    referenced its authoring-time head `a099586`, which the Doc 20 approval
    flip superseded before the worker's first command. The lane ran entirely
    at `e205743`, clean tree; no source file was ever in question.

## 10. Evidence index

All paths relative to repo root; untracked lane artifacts — the Lead commits
this document together with the lane's evidence set per the W3-4 dispatch.

**Lane transcript & provenance**

- `.omc/reports/w3-4-uat.log` — the lane transcript: header (git rev
  `e205743…`, untracked list, UTC window, build exit 0 + 162543 bytes), boot
  records, walkthrough run(s), probe families, visuals runs + V1
  invalidation/re-capture, post-run visual verification annotations,
  addendum probes, teardown tokens (`PORT_3223_RELEASED=OK`, password-file
  deletion, lane end UTC).
- `.omc/reports/w3-4-uat/server-boot.log` — boot #3 server output (prod-mode
  banner, in-memory WARN, healthz).

**Walkthrough (class W)**

- `.omc/reports/w3-4-uat/e2e-results.json` — runId
  `run-2026-09-11T1243Z-e2e`, 64 rows, counts `{"flaky":1,"pass":63}`,
  0 FAIL, exit 0 (row ids: S0, A1–A6, B0–B17, C0–C12, C-FR, C-API, D0a,
  D0–D5, E0–E10, E-API, E-API2, F1–F3).
- `.omc/reports/screenshots/run-2026-09-11T1243Z-e2e/` — 46 PNGs +
  `MANIFEST.sha256`; `shasum -a 256 -c` → exit 0 (fresh re-verification at
  Doc 18 assembly).

**Probes (class P)** — `.omc/reports/w3-4-uat/`

- `probes.mjs` + `probe-uat4-admin.log` (12 verdicts: 11 PASS + export-shape
  probe-bug FAIL), `probe-uat2-maker.log` (10 PASS),
  `probe-uat5-negative.log` (10 PASS + cookie-flag/generic-error SUMMARYs),
  `probe-uat6-anonymous.log` (9 PASS), `probe-uat2-uploads.log` (3 logged
  probes, all expectations met), `probe-export-shape-corrected.log` (1 PASS).
- `probes-updates.mjs` + `probe-uat2-updates.log` (addendum: 5 PASS —
  UAT-028/032 merge semantics + maker-DELETE boundary 403).

**Visuals (class V)**

- `tests/uat-visuals.mjs` — new lane file (the only repo code change of the
  lane; `tests/e2e-walkthrough.mjs` untouched).
- `.omc/reports/w3-4-uat/visuals-results.json` — runId
  `run-2026-09-11T1255Z-uat`, PASS=6 FAIL=0, exit 0.
- `.omc/reports/screenshots/run-2026-09-11T1255Z-uat/` — 8 PNGs +
  `MANIFEST.sha256` (exit 0, fresh). §8 closures cited from here.
- `.omc/reports/screenshots/run-2026-09-11T1249Z-uat/` — run 1, retained as
  history (V1 page-shot invalidated — L-2; remaining files valid captures of
  their legs).

**Journey evidence (class J — gate-1 fix cycle, worker-4 lane)**

- `tests/uat-journey-evidence.mjs` — new lane file (the lane's only repo
  write; `tests/e2e-walkthrough.mjs` untouched; modeled on
  `tests/uat-visuals.mjs`: `-uat2` run-id suffix, run-dir + MANIFEST
  convention, results JSON, J3 sweep folded into every success action).
- `.omc/reports/w3-4-uat/journey-results.json` — runId
  `run-2026-09-11T1344Z-uat2`, 15 PASS / 0 FAIL, exit 0; `toastSweeps`
  ledger (8 sweeps, summed error surfacing 0, 8 benign success toasts).
- `.omc/reports/w3-4-uat-journey.log` — lane transcript (header pins git
  `90be09c`; the lane's own untracked outputs were the only files it wrote,
  while concurrent **document** edits by the lead (this doc's v0.2.0
  corrections + the 18a sheet) were present in the working tree and logged
  as such by the worker (judgment call 4) — no code file changed;
  node-check + journey exits; SUMMARY PASS=15 FAIL=0;
  teardown `PORT_3224_RELEASED=OK`, `no_tmp_residue=CONFIRMED`,
  13:38:24Z→13:48:01Z; run-1 of the script itself INVALID-marked via sibling
  file after a harness-side `.replace`-on-Promise bug — pristine run 2 is
  the evidence run).
- `.omc/reports/screenshots/run-2026-09-11T1344Z-uat2/` — 10 PNGs +
  `MANIFEST.sha256` (`shasum -a 256 -c` → exit 0): J1 `form-with-uploaded-image`
  / `draft-reopened-with-image` / `submitted-pending-row`; J2
  `reject-dialog-thai-reason` / `rejected-row` / `resubmitted-pending` /
  `approved-synced` / `audit-both-decisions`.

**Offline simulation (class O — obs-U1 closure v0.3.0 + re-gate-2 covering evidence v0.3.1; worker-2 lanes)**

- `tests/uat-offline-sim.mjs` — new lane file (modeled on the
  visuals/journey lane files; RUN_ID suffix `-offlinesim`; untracked outputs
  only — no tracked file touched; lead gates on the changed tree: tsc 0 ·
  build 0 · smoke 108/108 · node --check 0 · secrets clean,
  `.omc/reports/offlinesim-lead-gates.log`).
- `.omc/reports/w3-4-offlinesim.log` — lane transcript (header pins git
  `f9c1f55` + verbatim status; build / node-check / run exits all 0;
  SUMMARY PASS=6 FAIL=0; teardown `PORT_3225_RELEASED=OK` with post-SIGTERM
  healthz=000/listeners=0 proof, `no_tmp_residue=CONFIRMED`;
  14:19:40Z→14:20:31Z). Runs 1–3 INVALID-marked via sibling files after
  harness-side bugs (missing password default in a helper; emulation-lag
  timeouts fixed by an in-page connectivity probe; login-form
  password-clearing race fixed by re-fill) — run 4 is the evidence run.
- `.omc/reports/w3-4-uat/offline-results.json` — runId
  `run-2026-09-11T1419Z-offlinesim`, 6 PASS / 0 FAIL + 1 non-gating OBS
  (O0 boot+provision · O0-MARKER dual-control approved marker · O1 online
  baseline · O2a badge byte-for-byte · O2b offline login refused · O3
  recovery).
- `.omc/reports/screenshots/run-2026-09-11T1419Z-offlinesim/` — 4 PNGs +
  `MANIFEST.sha256` (`shasum -a 256 -c` → exit 0): O1 online server data,
  O2a badge after logout-while-offline, O2b offline login refused + badge
  persists, O3 recovered server data + badge gone.
- Lane judgment calls (all lead-ACCEPTED): admin password generated via
  `openssl rand` and never logged (placeholder in transcript; same class as
  the journey-lane precedent); server-vs-bundle discrimination via a unique
  dual-control-approved news item (the server seeds the same
  `INITIAL_NEWS` bundle, so the approved marker is the only server-only
  content); the stable logged-in bundled view is NOT user-reachable
  (offline login refused; offline reload cannot load the same-origin SPA)
  so the badge+bundled state is evidenced at logout-while-offline, with the
  recovery first-paint transient recorded as an honest non-captured OBS;
  badge asserted byte-for-byte with a runtime source re-read cross-check.

**v0.3.1 extension (re-gate-2 blocker closure — W3-4O-2 lane, same file
extended):**

- `tests/uat-offline-sim.mjs` — the O4 leg added (the file's only tracked
  change, `M` on top of the v0.3.0 commit). Lead gates on the changed tree
  (tsc 0 · build 0 · smoke 108/108 exit 0 · node --check 0 · secrets
  clean): `.omc/reports/offlinesim2-lead-gates.log`.
- `.omc/reports/w3-4-offlinesim2.log` — evidence-run transcript (run 3):
  header pins git `45187c8` + the verbatim ` M tests/uat-offline-sim.mjs`
  status, node v24.13.1 / Playwright 1.63.0; run exit 0; SUMMARY
  PASS=10 FAIL=0 OBS=1; teardown `PORT_3225_RELEASED=OK` (post-SIGTERM
  healthz=000, listeners=0), `no_tmp_residue=CONFIRMED`;
  15:01:13Z→15:01:21Z. Runs 1–2 INVALID-marked via sibling files after
  harness-side targeting bugs (run 1 assumed the rooms grid renders in the
  default directory view — it renders only under `activeTab='rooms'`; run
  2's "Meeting Rooms Plan" text-filter click resolved to the QuickToolsBar
  button instead of the tab — fixed by targeting the stable id
  `#tab-meeting-rooms`).
- `.omc/reports/w3-4-uat/offline-results.json` — overwritten by the
  evidence run: runId `run-2026-09-11T1501Z-offlinesim`, **10 PASS / 0
  FAIL + 1 non-gating OBS** (O0 · O0-MARKER · O1 · O2a · O2b ·
  O3-TRANSIENT:OBS · O3 · **O4-SETUP · O4a · O4b · O4c**). The v0.3.0
  1419Z counts live on in the retained `w3-4-offlinesim.log` transcript.
- `.omc/reports/screenshots/run-2026-09-11T1501Z-offlinesim/` — 8 PNGs +
  `MANIFEST.sha256` (shasum → exit 0): the four v0.3.0-style captures plus
  `o4a-routeaborted-portal-bundled-content-badge.png` and
  `o4a-routeaborted-newscard-badge-closeup.png` (the blocker-closing
  artifact — bundled news card + two-line badge in one crop; lead-verified
  visually), `o4b-routeaborted-directory-docs-sync-failed-toast.png`,
  `o4c-unrouteall-reload-server-news-back-badge-gone.png`. The v0.3.0
  4-PNG dir `run-2026-09-11T1419Z-offlinesim/` retained as history.
- Extension judgment calls (JC5–JC7, lead-ACCEPTED; JC1–JC4 unchanged):
  **JC5** O4 is a surgical data-endpoint **route-abort** outage, NOT
  `context.setOffline` (the full-offline legs O2a/O2b stay as-is) —
  `route.abort()` drives the identical client code path (fetch rejection →
  `publicGet` bundled fallback + offline flag) while the SPA is still
  served; honestly labeled route-abort everywhere. **JC6** one
  deterministic outage config armed from setup (no mid-flight route
  changes); the 3800 ms auto-dismiss toast polled immediately after login
  and deterministically re-triggered via `page.reload()` if the window was
  lost; exact toast string strict `===`. **JC7** banner surface asserted
  via the carousel current-slide title being a bundled `INITIAL_BANNERS`
  member (during the abort `/api/banners` can never answer, so any
  rendered banner is necessarily the fallback); room surface via exact
  `Kookmin Room` `<h4>` after the real Meeting-Rooms tab click.

**v0.3.2 extension (re-gate-3 blocker fix + re-execution — W3-4O-3 lane):**

- `src/App.tsx` — **DEF-002 fix** (+7 lines): the authenticated
  contacts/documents catch now empties both slices (`setContacts([]);
  setDocuments([])`, `isMounted`-guarded) before the toast, restoring the
  documented D7 semantics. Lands in this document's commit.
- `tests/uat-offline-sim.mjs` — extended (+216/−23): new **O0-PROBES**
  check (unique server-only contact `W34O3 Directory Probe 47275` +
  document `W34O3 Document Probe 47275`, provisioned via maker01); O4b
  adds real-UI navigation to both authenticated surfaces (Directory via
  the Phonebook tab + left rail; Documents via the left-rail
  `แบบฟอร์มเอกสาร (Official Forms)`) asserting the server probe AND the
  bundled sample (`คุณวรวุฒิ เกียรติศิริ` / `จรรยาบรรณในการดำเนินธุรกิจ
  (Code of Business Conduct & Ethics)`) are both strict-0 during the
  outage, with per-surface screenshots; O4c asserts both probes return;
  O4a closeup recaptured with the complete card (NIT — containment of
  card+title+badge inside the 1440×900 viewport asserted **before
  saving**).
- `.omc/reports/w3-4-offlinesim3.log` — evidence-run transcript (run 2):
  header pins git `5417bc8` + the verbatim ` M src/App.tsx` /
  ` M tests/uat-offline-sim.mjs` working-tree status (the fix ran
  uncommitted; it lands with this document's commit); gate matrix
  appendix (node-check 0 · tsc 0 · build 0 · smoke 108/108 in 7.5s ·
  suite exit 0 · e2e 63 PASS / 0 FAIL / 1 known FLAKY / 0 SKIP, 0
  uncaught page errors, exit 0 · secrets diff scan clean); SUMMARY
  PASS=11 FAIL=0 OBS=1; teardown `PORT_3225_RELEASED=OK` +
  `PORT_3226_RELEASED=OK` (e2e), `no_tmp_residue=CONFIRMED`; secrets
  staged via 0600 temp files, removed and verified gone. Run 1
  INVALID-marked (closeup v1 clip-union could not detect its own framing
  bug — the strip decapitated the card; harness-side only, all 11 checks
  had passed) — sibling `.INVALID` file with the preserved log.
- `.omc/reports/w3-4-uat/offline-results.json` — runId
  `run-2026-09-11T2358Z-offlinesim`, **11 PASS / 0 FAIL / +1 non-gating
  OBS** (O0 · O0-MARKER · **O0-PROBES** · O1 · O2a · O2b · O3-TRANSIENT:OBS
  · O3 · O4-SETUP · O4a · O4b · O4c), markers incl. the probe + bundled
  sample names, JC1–JC8.
- `.omc/reports/screenshots/run-2026-09-11T2358Z-offlinesim/` — 12 PNGs +
  `MANIFEST.sha256` (shasum → exit 0): the four base captures, O4a portal
  + **complete closeup**, O4b toast + **directory-empty-no-samples** +
  **documents-empty-no-samples**, O4c recovery + **directory probe back**
  + **documents probe back**. e2e regression archive:
  `.omc/reports/screenshots/run-2026-09-12T0004Z-e2e/` (46 PNGs +
  MANIFEST).
- Extension judgment calls (JC8 + lead rulings, accepted): **JC8**
  real-UI-only navigation (no URL hacks) with byte-exact sample markers;
  the closeup assertion target changed from a self-derived clip to the
  independent viewport (a clip built from the same boxes cannot detect
  its own framing bug — the run-1 lesson); the harness CDN image path
  served a stale run-1 object for the re-uploaded filename, so the
  run-2 closeup was verified by deterministic pixel analysis (title band
  16.7% dark px, card body present, badge border 603 px; run-1 strip
  control 0 px in every card region) — documented in the transcript.

**Sign-off instrument**

- `docs/deliverables/18a-uat-signoff-sheet.md` — business-nominee acceptance
  sheet (Thai-first; six per-scenario sign-off rows; §6 PENDING condition).
  Unexecuted until nominees are arranged — the acceptance record will cite
  it when signed.

**Cited standing records (class C)**

- Doc 17 §3.3/§3.5 + Appendix A (smoke §16 tampered-cookie; TC-SYS-002;
  TC-USER-008 `w3r2-gap-closures.log`; TC-SES-006 `w3r1-p0-gaps.log`; smoke
  §11 upload matrix).
- Doc 19 §TC-SEC-009 row (`tc-sec-009.log`, timing ratio 1.01).
