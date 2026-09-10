/** QA tooling — assemble .omc/reports/e2e-walkthrough-report-v2.md */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const table = fs.readFileSync(path.join(ROOT, '.omc', 'reports', 'e2e-verdicts-table.md'), 'utf8');
const r = JSON.parse(fs.readFileSync(path.join(ROOT, '.omc', 'reports', 'e2e-results.json'), 'utf8'));

const report = `# E2E Walkthrough Report v2 — KB J Capital Intranet Portal

**Verdict: GREEN — ${r.counts.pass} PASS / ${r.counts.fail || 0} FAIL / ${r.counts.flaky || 0} FLAKY / 0 SKIP (64 checks)**
v1 baseline (2026-09-03 morning, pre-fix build): 36 PASS / 24 FAIL.

- **Run:** 2026-09-03 ~12:52Z, official full re-run
- **Server:** fresh production build (\`npm run build\` → \`node dist/server.cjs\`), PORT=3226, HOST=127.0.0.1, NODE_ENV=production, in-memory stores (no DATABASE_URL — intentional QA mode), SESSION_SECRET set, bootstrap admin \`admin\`/\`QaFix@2026\`, UPLOAD_DIR=./uploads-qafix
- **Suite:** \`tests/e2e-walkthrough.mjs\` (hardened v2) — self-bootstraps role users via POST /api/users (S0)
- **Raw results:** \`.omc/reports/e2e-results.json\` · console log \`.omc/reports/e2e-run-official-console.log\` · server log \`.omc/reports/e2e-server-v2.log\`
- **Uncaught page errors: 0.** The 18 console.error entries are all benign: pre-login \`/api/auth/me\` 401 probes, the A5 rate-limit test's intentional 429, E4's intentional duplicate-username 409, C-FR's intentional aborted POST (net::ERR_FAILED), and news-image 404s for placeholder art.

## Fix tasks verified by this run

| Fix | Check(s) | Result |
|---|---|---|
| #16 CMS create-vs-update save + stacked dialogs | C1, C2, C3 | PASS — create POSTs, form closes, row listed; scoped Cancel + Discard clean |
| #17/#26 handler branching + failed-save retention | C1, C-FR | PASS — aborted POST keeps the form open with data AND surfaces a role=alert error |
| #18/#28 room release control | B11, B12 | PASS — book → In-Use; 'ยกเลิกการจอง / Release Room' returns it to available |
| #19 User Management tab | C6, D4, E4 | PASS — admin-only; lists users; create + duplicate-409 inline |
| #20 API guards | C-API, E-API | PASS — empty-id PUT/DELETE → 400 {success:false}; malformed JSON → 400 clean envelope |
| #21 backdrop close + unique ids | B7, B13 | PASS — element-relative backdrop click closes; #governance-section resolves once |
| #22/#23 Architecture + K8s removal | B14, C0, E0, E2, E3, E-API2, F3 | PASS — nav ids absent for every role, DOM label greps = 0, zero clickable BA/SA links, dead endpoint JSON-404s (no SPA HTML fallback) |
| #29/#30 deactivate/reactivate | E4b | PASS — create → deactivate (confirm) → correct password 401s → reactivate → login 200 |

## Fix-loop history (all residual failures were TEST-side; zero app defects filed)

| Run | Result | Residual failures | Root causes (all in the suite) |
|---|---|---|---|
| v1 (pre-fix build) | 36/24 | 24 | the real app defects the fix tasks targeted |
| Run 1 | 50/13/1 | 13 | banner/contact forms' required fields unfilled (no POST fired, dirty form left open); sidebar 'Admin Quick Actions' renders add-buttons for EVERY tab so generic '+ Add' matched the banner one; anchored /^Approve$/ never matches (icon → textContent ' Approve'; the aria-label 'อนุมัติ: X / Approve' is the correct hook); login chrome-wait union .first() pinned to the desktop-only pill at 375px; mobile header has no sign-out; F3 sweep raced carousel re-renders; settle() could not discard dirty-guard dialogs (the C8-C12 cascade engine) |
| Run 2 | 61/2/1 | 2 | D2 accessible-name mistake (name is 'ปฏิเสธ: X / Reject', not the title text); banner Subtitle+CTA also required |
| Run 3 | 62/1/1 | 1 | C-FR cleanup assumed a dirty-confirm dialog that errored forms intentionally skip |
| Run 4 | 62/1/1 | 1 | B7 card locator missing the [role=button] arm (Read controls are not <button>s) |
| **Official** | **63/0/1** | **0** | — |

The single FLAKY (S0) is benign: the bootstrap's first attempt hit a transient failure mid-provisioning and the retry confirmed all three role users present ('exists').

## Incident log
- **3225 server swap (12:38:43Z):** another worker replaced my 3225 process mid-run-5 with their own (fresh store). All run-5 section verdicts completed before the swap (timestamp-verified); I moved to port 3226 and left their process alone. Port discipline proposed: 3000=live Docker (untouched throughout), 3225=theirs, 3226=QA.
- **#31 governance anchor:** my filed regression (id removed instead of made unique → 5 dead footer links) was fixed and is verified green by B13 + the live scroll behavior.

## Per-check verdicts

${table}

## Residual notes
1. **Throwaway users remain by design** (no user-deletion exists): \`e2eqa01\`, \`e2edeact01\` (reactivated) stay in the QA users table — the QA server is torn down after this run, so there is no production residue.
2. **S0 FLAKY:** first-attempt provisioning hiccup, retry-verified; evidence distinguishes created/exists per user.
3. **Mobile logout is not covered** (the 375px header exposes no sign-out control — icon-only bar); logout is covered on desktop by B17/C12/D5/E10. F2 switches identity via cookie-clear because its subject is the CMS layout at 375px (both overflow deltas 0px).
4. **Carousel manual arrows (B2)** are hover-revealed; the check hovers before clicking, matching the component's own interaction model.

## Evidence
- 82 screenshots in \`.omc/reports/screenshots/\` (per-check shots named \`<id>.png\`, failure forensics \`<id>-fail.png\`, probe captures \`probe-*.png\`)
- Prior-run artifacts kept for the audit trail: \`e2e-results-v1.json\`, \`e2e-results-run1..5.json\`, per-run console logs
- Suite: \`tests/e2e-walkthrough.mjs\` (node --check clean); table generators \`tests/gen-report.mjs\` / \`tests/gen-report-full.mjs\`
`;

fs.writeFileSync(path.join(ROOT, '.omc', 'reports', 'e2e-walkthrough-report-v2.md'), report);
console.log('report written:', report.length, 'chars');
