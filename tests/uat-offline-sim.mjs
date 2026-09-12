/**
 * W3-4O offline-simulation UAT lane — obs-U1, Doc 18 §7 / CTO decision #23 rider
 * (UAT-043 / FR-CMS-004: offline fallback badge + bundled sample data).
 * Originally a NEW FILE (tracked at HEAD); EXTENDED IN PLACE for W3-4O-2
 * (Doc 18 re-gate-2 fix) with the O4 route-abort leg family — no other
 * test/script/doc is modified. Modeled on tests/uat-visuals.mjs and
 * tests/uat-journey-evidence.mjs (same harness idioms).
 * EXTENDED IN PLACE for W3-4O-3 (codex re-gate-3, FR-CMS-004(b) as-built
 * fix): src/App.tsx now EMPTIES contacts/documents inside the authenticated
 * hydration catch, so authenticated views render empty (never samples) during
 * a data outage. O0 additionally provisions a unique server-only CONTACT +
 * DOCUMENT (maker01 via the API); O4b asserts on the REAL Directory and
 * Documents surfaces (UI clicks only) that BOTH the server-only markers AND
 * known bundled INITIAL_CONTACTS/INITIAL_DOCUMENTS sample names are ABSENT
 * (strict 0) during the outage; O4c asserts both markers RETURN after
 * unrouteAll + reload. The O4a closeup was recaptured (NIT fix, run 2 — run 1
 * INVALID: the first clip-union attempt still cropped the card) so the
 * COMPLETE news card AND badge are provably framed: the page is scrolled
 * until card + title + badge boxes all sit fully inside the 1440x900
 * viewport (asserted before saving), then a plain viewport shot is taken.
 *
 * Trigger analysis (src/api.ts + src/App.tsx, verified before writing):
 *   - ANY fetch that fails at network level raises the D7 offline flag
 *     (rawRequest catch -> setOfflineMode(true), src/api.ts:86-91).
 *   - Displayed content swaps to bundled INITIAL_* data ONLY inside
 *     loadPublicData's publicGet fallbacks (src/api.ts:124-134), and that
 *     hydration effect re-runs only on [isAuthenticated, user?.role] flips
 *     (src/App.tsx:147-211). A full page reload while offline cannot even load
 *     the SPA (same-origin HTML/JS), and logging IN while offline is refused by
 *     the server call failing — so the ONE user-reachable in-app refresh that
 *     re-runs hydration offline is LOGOUT. The lane therefore drives:
 *
 *   O0 — boot prep (done by the lane runner): build + production server on
 *        :3225 (in-memory), /healthz 200. In-script: S0 bootstrap (admin via
 *        E2E_ADMIN_PASSWORD env, role users @ E2E-Test@2026, 201/409 both ok)
 *        + a unique APPROVED news item = the SERVER-SEEDED MARKER (the
 *        in-memory repo seeds [...INITIAL_NEWS], so server and bundle start
 *        identical — the marker is the only server-only content).
 *   O1 — staff01 logs in through the real UI (online): portal shows the
 *        server-seeded marker, offline badge ABSENT.
 *   O2a — context.setOffline(true) -> click "ออกจากระบบ / Sign out": the failed
 *        logout POST raises the flag; the auth flip re-runs hydration offline
 *        (publicGet fallback -> bundled sample data held in state). Assert the
 *        badge text BYTE-FOR-BYTE from src/App.tsx:593/595 (Thai first line,
 *        English second line, strict ===), badge visible over the login page.
 *   O2b — still offline: staff01 retries login -> the app surfaces the real
 *        network error ("Cannot reach server (network error)") and the badge
 *        persists (no fake success, no silent recovery).
 *   O3 — context.setOffline(false) -> login succeeds -> server-seeded marker
 *        RETURNS, badge GONE (flag clears on the first successful publicGet).
 *   O3-TRANSIENT (OBS, non-gating) — the portal's FIRST paint after the
 *        recovery login still renders the bundled fallback + badge until
 *        getNews() lands; sampled immediately, reported, never failed on
 *        (first-paint vs localhost roundtrip is a race by nature).
 *
 *   O4 — W3-4O-2 (Doc 18 re-gate-2 blocker closure, FR-CMS-004 covering
 *        evidence). SURGICAL DATA-ENDPOINT OUTAGE SIMULATION (route-abort):
 *        Playwright route interception ABORTS exactly the public data GETs
 *        (glob patterns "api/news", "api/banners", "api/rooms" with trailing
 *        wildcards to cover query strings) and — for the O4b sub-check — the
 *        authenticated data GETs (contacts, documents), while ALLOWING
 *        /api/auth endpoints, /healthz and static assets. route.abort() makes
 *        fetch() reject, which is the SAME client code path as network-down
 *        (src/api.ts rawRequest catch -> ApiError(0, 'Cannot reach server
 *        (network error)') + setOfflineMode).
 *        This is NOT context.setOffline — the full-offline legs O2a/O2b stay
 *        as-is; O4 is honestly labeled a route-abort data outage everywhere.
 *        Why this route exists at all: JC3 showed the logged-in portal cannot
 *        STABLY display bundled data through real full-offline user actions
 *        (hydration re-runs only on auth flips; offline login is refused;
 *        offline reload cannot even load the SPA). With route-abort the SPA is
 *        still served, login works, and the auth flip re-runs hydration with
 *        every public data GET deterministically failing — DETERMINISTIC, no
 *        races — exactly FR-CMS-004(a)'s "portal still renders sample
 *        news/banners/rooms with the offline badge visible" state.
 *   O4a — with aborts active: staff01 logs in through the real UI (login POST
 *        + /api/auth/me allowed) -> auth flip re-runs hydration -> public GETs
 *        abort -> bundled fallback lands in state. On the LOGGED-IN portal:
 *        badge byte-for-byte (strict === + src re-read cross-check), bundled
 *        sample news marker RENDERED (INITIAL_NEWS[0] featured card), the
 *        server-only dual-control marker ABSENT (strict count 0), a bundled
 *        ROOM marker rendered (Kookmin Room, exact, after the real user
 *        action of opening the "Meeting Rooms Plan" tab — the grid is behind
 *        activeTab='directory' by default) and the banner carousel showing a
 *        bundled slide title — all three public surfaces. Shots:
 *        full page (badge + bundled content) + closeup framing the COMPLETE
 *        news card together with the badge (viewport shot after scrolling
 *        both fully into the 1440x900 viewport — card/title/badge bounding
 *        boxes asserted inside the viewport before saving).
 *   O4b — FR-CMS-004(b): contacts+documents also aborted -> the authenticated
 *        hydration ERRORS OUT with the toast "Directory/documents sync
 *        failed: Cannot reach server (network error)" (exact string from
 *        src/App.tsx:181 + src/api.ts:90) — authenticated data never silently
 *        substitutes. The toast auto-dismisses after 3800ms (src/App.tsx:94),
 *        so the check polls fast right after login and, if it lost that
 *        window, DETERMINISTICALLY re-triggers it via page.reload() with the
 *        aborts still active (session restore -> loadAuthenticatedData fails
 *        again -> fresh toast).
 *        W3-4O-3 extension (the as-built fix this lane now covers): the
 *        hydration catch EMPTIES the slices (src/App.tsx), so on the REAL
 *        Directory surface (#tab-phonebook click — O4a left the rooms tab
 *        active) and the REAL Documents surface (left-rail "แบบฟอร์มเอกสาร
 *        (Official Forms)" navigation click) BOTH the unique server-only
 *        contact/document AND a known bundled INITIAL_CONTACTS/
 *        INITIAL_DOCUMENTS sample are ABSENT (strict count 0) — authenticated
 *        views render empty, NEVER samples. Both surfaces are screenshotted
 *        during the outage.
 *   O4c — FR-CMS-004(c) recovery: ctx.unrouteAll() (ALL interception removed)
 *        -> page.reload() (real user action; SPA loads because connectivity
 *        is real) -> session restore via /api/auth/me -> hydration re-runs ->
 *        public GETs succeed -> badge GONE (strict count 0) AND the
 *        server-only marker VISIBLE again (server data back). W3-4O-3: the
 *        unique server-only CONTACT and DOCUMENT are also asserted BACK
 *        (visible) on the recovered authenticated surfaces.
 *
 * Judgment calls (JC, numbered; also embedded in the results JSON):
 *   JC1 — In-memory server boot requires ADMIN_PASSWORD to be set explicitly:
 *         NODE_ENV=production otherwise generates one and PRINTS it to stdout,
 *         which would leak a credential into the lane transcript. The lane
 *         runner passes a random value via env; it is never logged.
 *   JC2 — Server-seeded vs bundled-sample distinction is manufactured via a
 *         unique approved news item, because server boot seeds the exact
 *         INITIAL_NEWS bundle (server.ts memory repo). Server data = marker +
 *         bundle; fallback = bundle only (marker absent).
 *   JC3 — "Logged-in portal displaying bundled sample data under the badge" is
 *         NOT reachable as a stable state through real user actions (hydration
 *         only re-runs on auth flips; login offline is impossible; reload
 *         offline cannot load the SPA). It is captured as the documented
 *         first-paint transient (O3-TRANSIENT, OBS) instead of a faked or
 *         weakened gate.
 *   JC4 — The offline badge is asserted byte-for-byte (strict ===) against
 *         literals copied from src/App.tsx:593/595; a source cross-check re-reads
 *         src/App.tsx at runtime and fails loudly if the literals ever drift.
 *   JC5 — O4 outage is a surgical data-endpoint route-abort, NOT
 *         context.setOffline: the full-offline mode legs (O2a/O2b) prove the
 *         browser-network-down behavior, but the logged-in portal cannot
 *         STABLY display bundled sample data through real full-offline user
 *         actions (JC3). route.abort() drives the identical client code path
 *         (fetch rejection) while the SPA itself is still served, which is
 *         FR-CMS-004(a)'s data-unreachable state — labeled honestly as a
 *         route-abort simulation in comments, transcript and results JSON.
 *   JC6 — O4b aborts /api/contacts + /api/documents from setup (one
 *         deterministic outage configuration; no mid-flight route changes
 *         while the app is running). The toast auto-dismisses at 3800ms
 *         (src/App.tsx:94): the check polls immediately after login and, if
 *         the window was lost, re-triggers the toast deterministically via
 *         page.reload() with aborts still active, then asserts the EXACT
 *         string "Directory/documents sync failed: Cannot reach server
 *         (network error)" (src/App.tsx:181 + src/api.ts:90).
 *   JC7 — The banner surface is asserted via the carousel's CURRENT slide
 *         title being one of the bundled INITIAL_BANNERS titles
 *         (src/components/HeroCarousel.tsx renders exactly one slide's title
 *         at any instant). The server seeds the identical banner bundle, but
 *         during the abort /api/banners can never answer, so any rendered
 *         banner title is necessarily the bundled fallback. The room surface
 *         is asserted after the real user action of clicking the "Meeting
 *         Rooms Plan" tab (the rooms grid renders only under activeTab=
 *         'rooms'; default is 'directory') — exact "Kookmin Room" <h4> text.
 *   JC8 — W3-4O-3 surface navigation is REAL UI ONLY: the Directory surface is
 *         reached by clicking the #tab-phonebook segmented-control tab (the
 *         O4a room check leaves activeTab='rooms'; idempotent if a toast
 *         re-trigger reload already reset it to 'directory') and scrolling
 *         via the left-rail "Internal Phonebook" button; the Documents
 *         surface is reached via the left-rail "แบบฟอร์มเอกสาร (Official
 *         Forms)" button (scrolls #governance-section into view — the list
 *         renders under the default activeCategory='all', no category click
 *         required). No URL hacks. Sample markers are copied BYTE-FOR-BYTE
 *         from src/data/initialData.ts (INITIAL_CONTACTS[0].name,
 *         INITIAL_DOCUMENTS[0].title); the O4a closeup NIT fix (run 2 — run 1
 *         INVALID: the clip-union still cropped the card, see
 *         w3-4-offlinesim3-run-1.log.INVALID) SCROLLS the COMPLETE card +
 *         badge fully into the 1440x900 viewport and ASSERTS card/title/badge
 *         bounding boxes all sit fully inside the viewport before saving a
 *         plain viewport shot.
 *
 * Output:
 *   Screenshots: .omc/reports/screenshots/run-<YYYY-MM-DDTHHMM>Z-offlinesim/*.png
 *   (own run dir + MANIFEST.sha256, shasum -a 256 format; suffix -offlinesim
 *    distinguishes this lane's capture set from -e2e/-uat/-uat2 runs)
 *   Results JSON: .omc/reports/w3-4-uat/offline-results.json
 *
 * Env contract: E2E_BASE (default http://127.0.0.1:3225 — disposable server,
 * host port 3000 untouched), E2E_ROLE_PASSWORD (default E2E-Test@2026 —
 * documented demo convention), E2E_ADMIN_PASSWORD (S0 bootstrap admin, passed
 * via the lane env, never logged), W34_OFFLINE_RESULTS (results JSON override).
 */
import { strictEqual } from 'node:assert';
import { chromium } from 'playwright';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RUN_STARTED_AT = new Date();
const RUN_ID = (() => {
  const t = RUN_STARTED_AT.toISOString();
  return `run-${t.slice(0, 10)}T${t.slice(11, 13)}${t.slice(14, 16)}Z-offlinesim`;
})();
const SHOT_DIR = path.join(ROOT, '.omc', 'reports', 'screenshots', RUN_ID);
const RESULTS_JSON = process.env.W34_OFFLINE_RESULTS || path.join(ROOT, '.omc', 'reports', 'w3-4-uat', 'offline-results.json');
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3225';
const PASSWORD = process.env.E2E_ROLE_PASSWORD || 'E2E-Test@2026';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'E2E-Test@2026';

// Badge strings copied BYTE-FOR-BYTE from src/App.tsx:593/595 (Thai first).
const BADGE_TH = 'โหมดออฟไลน์ — แสดงข้อมูลตัวอย่าง';
const BADGE_EN = 'Offline mode — showing bundled sample data';
const BADGE_SEL = 'div.fixed.bottom-5.left-5'; // badge is bottom-LEFT (toast is bottom-right)

// Bundled sample-data marker: INITIAL_NEWS[0] title (src/data/initialData.ts),
// present in the bundle AND in the server's [...INITIAL_NEWS] seed — it proves
// content is rendered, while the ABSENT server marker proves it is the fallback.
const SAMPLE_TITLE = 'บริษัทฯ ขอแจ้งเตือนภัยทุจริต (Anti-Fraud Alert)';

// ---- O4 (W3-4O-2) constants — surgical data-endpoint route-abort outage ----
// Authenticated failure toast: exact string from src/App.tsx:181
// (`Directory/documents sync failed: ${errMessage(err)}`) + src/api.ts:90
// (ApiError message on fetch rejection).
const AUTH_SYNC_TOAST = 'Directory/documents sync failed: Cannot reach server (network error)';
const TOAST_SEL = 'div.fixed.bottom-5.right-5'; // toast container (badge is bottom-LEFT)
// Bundled room marker: INITIAL_MEETING_ROOMS[0] name, rendered verbatim in its
// own <h4> in DirectoryAndRooms (src/components/DirectoryAndRooms.tsx:447-449).
const SAMPLE_ROOM = 'Kookmin Room';
// Bundled banner titles (INITIAL_BANNERS, src/data/initialData.ts) — the hero
// carousel renders exactly ONE slide title at any instant; during the abort any
// rendered title is necessarily the bundled fallback (JC7).
const BUNDLED_BANNER_TITLES = [
  'เรื่องเงินจบไว ไว้ใจ KASHJOY !',
  'Internal Phone Number & Directory',
  'Modernized Meeting Rooms Plan 2025',
  'KB J-E-DMS Electronic Document System',
  'KB J Capital Corporate Identity Guidelines',
];
// W3-4O-3 (FR-CMS-004(b) re-gate-3): bundled authenticated-surface sample
// markers, copied BYTE-FOR-BYTE from src/data/initialData.ts —
// INITIAL_CONTACTS[0].name (dir-1) and INITIAL_DOCUMENTS[0].title (doc-1).
// Under the W3-4O-3 App.tsx fix the authenticated hydration catch EMPTIES
// the slices, so authenticated views render NEITHER server rows NOR these
// samples during a data outage (both asserted strict count 0 in O4b).
const SAMPLE_CONTACT = 'คุณวรวุฒิ เกียรติศิริ';
const SAMPLE_DOC_TITLE = 'จรรยาบรรณในการดำเนินธุรกิจ (Code of Business Conduct & Ethics)';
// Real-UI navigation selectors for the authenticated surfaces (JC8): the
// phonebook segmented-control tab id and the left-rail buttons that scroll
// to the directory / governance-documents sections.
const TAB_PHONEBOOK_SEL = '#tab-phonebook';
const SIDEBAR_PHONEBOOK_TEXT = 'Internal Phonebook';
const SIDEBAR_FORMS_TEXT = 'แบบฟอร์มเอกสาร (Official Forms)';

fs.mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
const failures = [];
function record(id, name, status, evidence = '') {
  results.push({ runId: RUN_ID, id, name, status, evidence });
  const icon = status === 'PASS' ? 'PASS' : status === 'FAIL' ? 'FAIL' : 'OBS';
  console.log(`[${icon}] ${id} ${name}${evidence ? ` — ${evidence}` : ''}`);
  if (status === 'FAIL') failures.push(id);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function shot(page, name) {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(SHOT_DIR, file), fullPage: false });
  return `screenshots/${RUN_ID}/${file}`;
}
async function until(fn, expected, timeout = 9000, interval = 400) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await fn()) === expected) return true;
    await sleep(interval);
  }
  return false;
}
/**
 * In-page connectivity probe (run-2 lesson): ctx.setOffline(...) returning does
 * NOT guarantee the renderer's next fetch can (or cannot) leave — the emulation
 * change lags. Poll the PAGE's own fetch('/healthz') until it reflects the
 * intended network state before driving the next user action.
 */
function netReachable(page) {
  return page.evaluate(() => fetch('/healthz', { cache: 'no-store' }).then((r) => r.ok).catch(() => false));
}
/** Click with one retry (walkthrough idiom: fast failures, never 30s hangs). */
async function click(loc, { timeout = 8000 } = {}) {
  try {
    await loc.click({ timeout });
  } catch (first) {
    await sleep(600);
    try {
      await loc.click({ timeout });
    } catch (second) {
      throw new Error(`click failed (2 attempts): ${String(second && second.message ? second.message : second).split('\n')[0].slice(0, 200)}`);
    }
  }
}
async function apiLogin(username, password = PASSWORD) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  if (!res.ok || !cookie) throw new Error(`apiLogin ${username} -> HTTP ${res.status}`);
  return cookie;
}
async function api(cookie, method, p, payload) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: { ...(payload ? { 'Content-Type': 'application/json' } : {}), Cookie: cookie },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  let body = null;
  try { body = await res.json(); } catch { /* */ }
  return { status: res.status, body };
}
async function login(page, username) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('#login-username').waitFor({ state: 'visible', timeout: 15000 });
  await page.fill('#login-username', username);
  await page.fill('#login-password', PASSWORD);
  await click(page.getByRole('button', { name: /เข้าสู่ระบบ \/ Sign in/i }));
  await page.locator('#login-username').waitFor({ state: 'hidden', timeout: 15000 });
}

const TS = Date.now() % 100000;
const SERVER_TITLE = `W34O ข่าวยืนยันเซิร์ฟเวอร์ออนไลน์ ${TS}`; // server-only marker (JC2)
// W3-4O-3 server-only directory/documents markers: unique via a random
// 5-digit number, provisioned in O0 by maker01 through the API (same style
// as the news marker — the in-memory server seeds the exact
// INITIAL_CONTACTS/INITIAL_DOCUMENTS bundles, so these rows are the only
// server-only content on those surfaces).
const RAND5 = String(Math.floor(10000 + Math.random() * 90000));
const SERVER_CONTACT = `W34O3 Directory Probe ${RAND5}`;
const SERVER_DOCUMENT = `W34O3 Document Probe ${RAND5}`;

const browser = await chromium.launch();
let finalized = false;
async function finalize() {
  if (finalized) return;
  finalized = true;
  try { await browser.close(); } catch { /* already closed */ }
  fs.writeFileSync(RESULTS_JSON, JSON.stringify({
    runId: RUN_ID, startedAt: RUN_STARTED_AT.toISOString(), finalizedAt: new Date().toISOString(),
    counts: {
      pass: results.filter((r) => r.status === 'PASS').length,
      fail: results.filter((r) => r.status === 'FAIL').length,
      obs: results.filter((r) => r.status === 'OBS').length,
    },
    badge: { assertedText: `${BADGE_TH}\n${BADGE_EN}`, sourceRef: 'src/App.tsx:589-599' },
    markers: {
      serverSeeded: SERVER_TITLE, bundledSample: SAMPLE_TITLE,
      serverContact: SERVER_CONTACT, serverDocument: SERVER_DOCUMENT,
      bundledContact: SAMPLE_CONTACT, bundledDocument: SAMPLE_DOC_TITLE,
    },
    judgmentCalls: [
      'JC1 boot: ADMIN_PASSWORD passed via env (never logged) — production boot would otherwise print a generated admin password into the transcript',
      'JC2 markers: unique approved news item = server-only marker (in-memory server seeds the exact INITIAL_NEWS bundle, so server/bundle start identical)',
      'JC3 logged-in portal cannot stably display bundled sample data via real user actions (hydration re-runs only on auth flips; login offline impossible; reload offline cannot load the SPA) — captured as non-gating first-paint transient OBS instead',
      'JC4 badge text asserted strict === against literals copied from src/App.tsx:593/595, cross-checked against the source file at runtime',
      'JC5 O4 is a surgical data-endpoint route-abort outage, NOT context.setOffline (full-offline legs O2a/O2b stay as-is): route.abort() drives the identical client code path (fetch rejection -> publicGet fallback + offline flag) while the SPA is still served — FR-CMS-004(a) data-unreachable state, deterministic, honestly labeled route-abort everywhere',
      'JC6 O4b aborts contacts+documents from setup (one deterministic outage config, no mid-flight route changes); the 3800ms auto-dismiss toast is polled immediately after login and, if the window was lost, deterministically re-triggered via page.reload() with aborts still active; the EXACT string "Directory/documents sync failed: Cannot reach server (network error)" is asserted strict === (src/App.tsx:181 + src/api.ts:90)',
      'JC7 banner surface asserted via the carousel current slide title being one of the bundled INITIAL_BANNERS titles (HeroCarousel renders exactly one slide title at any instant; during the abort /api/banners can never answer, so any rendered banner is necessarily the bundled fallback); room surface asserted via exact "Kookmin Room" <h4> text after the real user action of opening the "Meeting Rooms Plan" tab (rooms grid renders only under activeTab=rooms, default directory)',
      'JC8 W3-4O-3 surface navigation is REAL UI ONLY: Directory via the #tab-phonebook segmented-control tab (O4a leaves activeTab=rooms; the click is idempotent if a toast re-trigger reload reset it) + the left-rail "Internal Phonebook" scroll button; Documents via the left-rail "แบบฟอร์มเอกสาร (Official Forms)" scroll button (list renders under default activeCategory=all, no category click required); no URL hacks. Sample markers byte-for-byte from src/data/initialData.ts (INITIAL_CONTACTS[0].name, INITIAL_DOCUMENTS[0].title). O4a closeup NIT fix (run 2 — run 1 INVALID: the clip-union reproduced the old cropped 1332x108 strip because at scroll 0 the card title band overlaps the fixed badge band, and a clip derived from the measured boxes cannot detect its own framing bug): the page is SCROLLED until the COMPLETE card + badge sit fully inside the 1440x900 viewport, card/title/badge bounding boxes are ASSERTED inside the viewport before saving, then a plain viewport screenshot is taken (no clip math) — plus the <h4> text strict === SAMPLE_TITLE',
    ],
    results,
  }, null, 2));

  const manifestFiles = fs.readdirSync(SHOT_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name !== 'MANIFEST.sha256')
    .map((e) => e.name)
    .sort();
  const manifestLines = manifestFiles.map((name) => {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(SHOT_DIR, name))).digest('hex');
    return `${hash}  ${name}`;
  });
  fs.writeFileSync(path.join(SHOT_DIR, 'MANIFEST.sha256'), manifestLines.length ? `${manifestLines.join('\n')}\n` : '');
  console.log(`Offlinesim run dir: ${SHOT_DIR} — ${manifestFiles.length} files, MANIFEST.sha256 written`);
  console.log(`SUMMARY PASS=${results.filter((r) => r.status === 'PASS').length} FAIL=${failures.length} OBS=${results.filter((r) => r.status === 'OBS').length}`);
}
// Graceful SIGTERM teardown (lane convention): close the browser, persist the
// partial results JSON + manifest, exit non-zero so the runner marks the run.
process.on('SIGTERM', async () => {
  console.log('[TEARDOWN] SIGTERM received — closing browser, persisting partial results');
  await finalize();
  process.exit(143);
});

try {
  // ---------- O0: healthz + S0 bootstrap + server-seeded marker ----------
  {
    const health = await fetch(`${BASE}/healthz`).then((r) => r.status).catch(() => 0);
    strictEqual(health, 200, `expected /healthz 200 before any check, got ${health}`);
    const adminCookie = await apiLogin('admin', ADMIN_PASSWORD);
    const wanted = [
      { username: 'maker01', password: PASSWORD, displayName: 'E2E Maker', email: 'maker01@kbjcapital.co.th', role: 'maker' },
      { username: 'checker01', password: PASSWORD, displayName: 'E2E Checker', email: 'checker01@kbjcapital.co.th', role: 'checker' },
      { username: 'staff01', password: PASSWORD, displayName: 'E2E Staff', email: 'staff01@kbjcapital.co.th', role: 'staff' },
    ];
    const parts = [];
    for (const u of wanted) {
      const res = await fetch(`${BASE}/api/users`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify(u),
      });
      parts.push(`${u.username}:${res.status === 201 ? 'created' : res.status === 409 ? 'exists' : `HTTP ${res.status}`}`);
    }
    const bad = parts.filter((o) => !/:created$|:exists$/.test(o));
    if (bad.length) throw new Error(`S0 user provisioning failed: ${bad.join(', ')}`);
    record('O0', 'Boot/healthz + admin bootstrap + role users provisioned via /api/users (201/409 both pass)', 'PASS',
      `healthz=200; ${parts.join(', ')}`);
  }
  {
    // Server-seeded marker (JC2): maker create -> submit -> checker approve (synced).
    const makerCookie = await apiLogin('maker01');
    const checkerCookie = await apiLogin('checker01');
    const created = await api(makerCookie, 'POST', '/api/news', {
      title: SERVER_TITLE, titleEn: `W34O Server Marker EN ${TS}`,
      summary: 'offline-sim lane server-side marker', content: 'offline-sim lane server-side marker body',
    });
    const newsId = created.body?.data?.id;
    if (created.status !== 201 || !newsId) throw new Error(`marker create failed: HTTP ${created.status}`);
    const sub = await api(makerCookie, 'POST', `/api/news/${newsId}/submit-approval`);
    const app = await api(checkerCookie, 'POST', `/api/news/${newsId}/approve`);
    const synced = app.body?.data?.externalSyncStatus === 'synced';
    record('O0-MARKER', 'Server-seeded marker: unique news item approved (synced) via the dual-control API', synced ? 'PASS' : 'FAIL',
      `create=${created.status} submit=${sub.status} approve=${app.status} externalSyncStatus=${app.body?.data?.externalSyncStatus} id=${newsId}`);
    if (!synced) throw new Error('server marker not synced — lane cannot proceed honestly');
  }
  {
    // W3-4O-3: server-only CONTACT + DOCUMENT markers (maker01 via the API,
    // same provisioning style as the news marker above). Both feeds start as
    // the exact bundled INITIAL_CONTACTS/INITIAL_DOCUMENTS seed in the
    // in-memory repo, so these unique rows are the only server-only content
    // the Directory/Documents surfaces can render.
    const makerCookie = await apiLogin('maker01');
    const contact = await api(makerCookie, 'POST', '/api/contacts', {
      name: SERVER_CONTACT,
      nameEn: `W34O3 Directory Probe EN ${RAND5}`,
      position: 'Outage Simulation Probe',
      department: 'General Affairs',
      extension: '1997',
      directPhone: '02-009-1997',
      email: `w34o3-probe-${RAND5}@kbjcapital.co.th`,
      floor: '14th Floor',
    });
    const document = await api(makerCookie, 'POST', '/api/documents', {
      title: SERVER_DOCUMENT,
      titleEn: `W34O3 Document Probe EN ${RAND5}`,
      category: 'form',
      department: 'General Affairs',
      version: 'Probe v1.0',
      fileSize: '1 KB',
      downloadUrl: '#w34o3-probe',
    });
    const contactId = contact.body?.data?.id;
    const docId = document.body?.data?.id;
    const probesOk = contact.status === 201 && document.status === 201 && contactId && docId;
    record('O0-PROBES', 'Server-only markers: unique CONTACT + DOCUMENT created by maker01 via the API', probesOk ? 'PASS' : 'FAIL',
      `contact=${contact.status} id=${contactId}; document=${document.status} id=${docId}`);
    if (!probesOk) throw new Error(`probe provisioning failed: contact HTTP ${contact.status}, document HTTP ${document.status}`);
  }

  // ---------- O1: online baseline (staff01, real UI login) ----------
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await login(page, 'staff01');
    const markerShown = await until(() => page.locator(`text=${SERVER_TITLE}`).count().then((c) => c > 0), true, 10000);
    const badgeCount = await page.locator(BADGE_SEL).count();
    const shotRef = await shot(page, 'o1-online-portal-server-news');
    if (!markerShown) throw new Error(`server-seeded marker "${SERVER_TITLE}" not visible on the online portal`);
    strictEqual(badgeCount, 0, `offline badge must be ABSENT while online (found ${badgeCount})`);
    record('O1', 'Online baseline: portal renders SERVER-seeded news, offline badge ABSENT', 'PASS',
      `serverMarker="${SERVER_TITLE}" visible; badgeCount=${badgeCount} (strict 0); ${shotRef}`);
  } catch (err) {
    record('O1', 'Online baseline: portal renders SERVER-seeded news, offline badge ABSENT', 'FAIL', String(err.message || err).slice(0, 250));
  }

  // ---------- O2a: offline -> logout -> badge, byte-for-byte ----------
  try {
    if (!results.find((r) => r.id === 'O1') || results.find((r) => r.id === 'O1').status !== 'PASS') {
      throw new Error('blocked: O1 did not pass — no authenticated session to take offline');
    }
    await ctx.setOffline(true);
    // Synchronize with the emulation change (run-2 lesson): confirm the page
    // really is cut off BEFORE the user action under test.
    const cutOff = await until(() => netReachable(page), false, 10000, 300);
    if (!cutOff) throw new Error('connectivity did not drop after setOffline(true) — cannot test the offline transition');
    await click(page.locator('button[aria-label="ออกจากระบบ / Sign out"]'));
    const badge = page.locator(BADGE_SEL).first();
    const badgeShown = await until(() => badge.isVisible().catch(() => false), true, 9000, 200);
    await page.locator('#login-username').waitFor({ state: 'visible', timeout: 9000 });
    if (!badgeShown) throw new Error('offline badge did not appear after the failed logout call');
    const badgeText = await badge.innerText();
    // JC4: strict byte-for-byte equality with the source literals.
    strictEqual(badgeText, `${BADGE_TH}\n${BADGE_EN}`, 'badge innerText differs from src/App.tsx:593/595');
    // Runtime cross-check: the literals must still exist verbatim in the source.
    const appSrc = fs.readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf8');
    if (!appSrc.includes(BADGE_TH) || !appSrc.includes(BADGE_EN)) {
      throw new Error('badge literals no longer match src/App.tsx — test constants have drifted from source');
    }
    const shotBadge = await shot(page, 'o2a-offline-badge-after-logout');
    record('O2a', 'Offline (setOffline) + real user action (Sign out): badge visible over the login page, text BYTE-FOR-BYTE from src/App.tsx', 'PASS',
      `badgeText=${JSON.stringify(badgeText)} === "${BADGE_TH}\\n${BADGE_EN}" (strict); src cross-check ok; ${shotBadge}`);
  } catch (err) {
    record('O2a', 'Offline (setOffline) + real user action (Sign out): badge visible over the login page, text BYTE-FOR-BYTE from src/App.tsx', 'FAIL', String(err.message || err).slice(0, 250));
  }

  // ---------- O2b: still offline -> login retry refused, badge persists ----------
  try {
    if (!results.find((r) => r.id === 'O2a') || results.find((r) => r.id === 'O2a').status !== 'PASS') {
      throw new Error('blocked: O2a did not pass — badge state not established');
    }
    await page.fill('#login-username', 'staff01');
    await page.fill('#login-password', PASSWORD);
    await click(page.getByRole('button', { name: /เข้าสู่ระบบ \/ Sign in/i }));
    const netAlert = page.locator('[role="alert"]').filter({ hasText: 'Cannot reach server (network error)' }).first();
    const refused = await until(() => netAlert.isVisible().catch(() => false), true, 9000, 300);
    const badgeCount = await page.locator(BADGE_SEL).count();
    const shotRef = await shot(page, 'o2b-offline-login-refused-badge-persists');
    if (!refused) throw new Error('network-error alert not shown for the offline login attempt');
    strictEqual(badgeCount, 1, `offline badge must persist while still offline (found ${badgeCount})`);
    record('O2b', 'Still offline: login retry surfaces the real network error and the badge persists (no fake success)', 'PASS',
      `alert="Cannot reach server (network error)" visible; badgeCount=${badgeCount} (strict 1); ${shotRef}`);
  } catch (err) {
    record('O2b', 'Still offline: login retry surfaces the real network error and the badge persists (no fake success)', 'FAIL', String(err.message || err).slice(0, 250));
  }

  // ---------- O3: recovery -> server data back, badge gone ----------
  try {
    if (!results.find((r) => r.id === 'O2b') || results.find((r) => r.id === 'O2b').status !== 'PASS') {
      throw new Error('blocked: O2b did not pass — offline state not established for recovery');
    }
    await ctx.setOffline(false);
    // Synchronize with the emulation change (run-2 lesson): the recovery login
    // only proves recovery if the network is REALLY back before the click.
    const netBack = await until(() => netReachable(page), true, 10000, 300);
    if (!netBack) throw new Error('connectivity did not return after setOffline(false) — cannot test recovery');
    // Run-3 lesson: a rejected login CLEARS the password field (LoginPage keeps
    // the username only, src/components/LoginPage.tsx:83) — re-fill both.
    await page.fill('#login-username', 'staff01');
    await page.fill('#login-password', PASSWORD);
    await click(page.getByRole('button', { name: /เข้าสู่ระบบ \/ Sign in/i }));
    await page.locator('#login-username').waitFor({ state: 'hidden', timeout: 15000 });

    // O3-TRANSIENT (OBS, non-gating, JC3): sample the FIRST paint after login —
    // before the online getNews() swap-in, the portal renders the bundled
    // fallback + badge. Reported honestly; a race by nature, never a gate.
    {
      const bCount = await page.locator(BADGE_SEL).count();
      const mCount = await page.locator(`text=${SERVER_TITLE}`).count();
      const sCount = await page.locator(`text=${SAMPLE_TITLE}`).count();
      const captured = bCount > 0 && mCount === 0 && sCount > 0;
      let ev = `captured=${captured}; first-paint badge=${bCount} serverMarker=${mCount} bundledSample="${SAMPLE_TITLE}"=${sCount}`;
      if (captured) {
        const shotT = await shot(page, 'o3-transient-firstpaint-bundled-sample-with-badge');
        ev += `; ${shotT}`;
      } else {
        ev += '; transient not captured (server swap-in won the race) — non-gating by design';
      }
      record('O3-TRANSIENT', 'OBSERVATION (non-gating): first paint after recovery login shows bundled sample data + badge', 'OBS', ev);
    }

    const markerBack = await until(() => page.locator(`text=${SERVER_TITLE}`).count().then((c) => c > 0), true, 10000);
    const badgeGone = await until(() => page.locator(BADGE_SEL).count().then((c) => c === 0), true, 9000, 300);
    const shotRef = await shot(page, 'o3-recovered-server-news-badge-gone');
    if (!markerBack) throw new Error(`server-seeded marker "${SERVER_TITLE}" did not return after recovery`);
    if (!badgeGone) throw new Error('offline badge did not clear after recovery');
    record('O3', 'Recovery (setOffline(false)): server-seeded news RETURNS and the badge is GONE', 'PASS',
      `in-page /healthz probe confirmed connectivity before the retry login; serverMarker back; badgeCount=0 (strict); ${shotRef}`);
  } catch (err) {
    record('O3', 'Recovery (setOffline(false)): server-seeded news RETURNS and the badge is GONE', 'FAIL', String(err.message || err).slice(0, 250));
  } finally {
    await ctx.close();
  }

  // ---------- O4: SURGICAL DATA-ENDPOINT OUTAGE SIMULATION (route-abort) ----------
  // W3-4O-2 / Doc 18 re-gate-2 blocker closure: FR-CMS-004 covering evidence.
  // HONEST LABEL: this leg family is a route-abort data outage — NOT
  // context.setOffline (the full-offline legs O2a/O2b above stay as-is).
  // Patterns are installed on a FRESH context BEFORE any page load, so the
  // outage is deterministic from the first request: no races.
  const ctx4 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page4 = await ctx4.newPage();
  try {
    // O4 setup: abort the public data GETs (news/banners/rooms, FR-CMS-004(a))
    // AND the authenticated data GETs (contacts/documents, the O4b sub-check).
    // /api/auth/**, /healthz and static assets are NOT routed — they stay
    // reachable, so login/session restore/SPA serving all work for real.
    const ABORT_PATTERNS = ['**/api/news**', '**/api/banners**', '**/api/rooms**', '**/api/contacts**', '**/api/documents**'];
    for (const p of ABORT_PATTERNS) {
      await ctx4.route(p, (route) => route.abort());
    }
    await page4.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page4.locator('#login-username').waitFor({ state: 'visible', timeout: 15000 });
    // Deterministic pre-verification from INSIDE the page: the outage is real
    // (public data GET rejects) and the allow-list is real (auth endpoint
    // answers 401 for anonymous instead of rejecting).
    const newsProbe = await page4.evaluate(() => fetch('/api/news', { cache: 'no-store' }).then(() => 'reached').catch(() => 'blocked'));
    const authProbe = await page4.evaluate(() => fetch('/api/auth/me', { cache: 'no-store' }).then((r) => r.status).catch(() => 0));
    if (newsProbe !== 'blocked' || authProbe !== 401) {
      throw new Error(`route-abort not effective: /api/news=${newsProbe} (want blocked), /api/auth/me=${authProbe} (want 401)`);
    }
    record('O4-SETUP', 'Surgical data-endpoint outage (route-abort) armed on a fresh context: data GETs abort; auth/healthz/static allowed (verified in-page)', 'PASS',
      `patterns=${ABORT_PATTERNS.join(' ')}; in-page probes: /api/news=blocked, /api/auth/me=HTTP ${authProbe}`);

    // ---------- O4a: FR-CMS-004(a) — logged-in portal renders bundled news/banners/rooms + badge ----------
    try {
      // Login through the real UI (login POST + /api/auth/me are allowed) — the
      // auth flip re-runs hydration, every public data GET aborts, the bundled
      // fallback lands in state and the portal RENDERS it.
      await page4.fill('#login-username', 'staff01');
      await page4.fill('#login-password', PASSWORD);
      await click(page4.getByRole('button', { name: /เข้าสู่ระบบ \/ Sign in/i }));
      await page4.locator('#login-username').waitFor({ state: 'hidden', timeout: 15000 });
      const badge4 = page4.locator(BADGE_SEL).first();
      const badgeShown4 = await until(() => badge4.isVisible().catch(() => false), true, 9000, 200);
      if (!badgeShown4) throw new Error('offline badge not visible on the route-aborted logged-in portal');
      const featured4 = await until(() => page4.locator('#featured-alert-card').isVisible().catch(() => false), true, 10000);
      if (!featured4) throw new Error('featured bundled news card not visible on the route-aborted logged-in portal');

      // (1) Badge byte-for-byte (JC4 idiom: strict === + runtime source re-read).
      const badgeText4 = await badge4.innerText();
      strictEqual(badgeText4, `${BADGE_TH}\n${BADGE_EN}`, 'badge innerText differs from src/App.tsx:593/595');
      const appSrc4 = fs.readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf8');
      if (!appSrc4.includes(BADGE_TH) || !appSrc4.includes(BADGE_EN)) {
        throw new Error('badge literals no longer match src/App.tsx — test constants have drifted from source');
      }
      // (2) Bundled sample news marker RENDERED in the portal news section
      // (INITIAL_NEWS[0] is the featured alert card under this state).
      const sampleCount4 = await page4.getByText(SAMPLE_TITLE, { exact: false }).count();
      if (!(sampleCount4 > 0)) throw new Error(`bundled sample news marker "${SAMPLE_TITLE}" not rendered (count=${sampleCount4})`);
      // (3) Server-only dual-control marker ABSENT (strict count 0): /api/news
      // is deterministically aborted, so the server list (marker + bundle) can
      // never land in state — only the bundle renders.
      const serverMarkerCount4 = await page4.locator(`text=${SERVER_TITLE}`).count();
      strictEqual(serverMarkerCount4, 0, `server-only marker must be ABSENT under the data outage (found ${serverMarkerCount4})`);
      // (4) Bundled room marker rendered — the rooms grid lives behind the
      // "Meeting Rooms Plan" tab (activeTab defaults to 'directory',
      // src/components/DirectoryAndRooms.tsx:40-41). Click the tab by its
      // stable id (a text filter ALSO matches QuickToolsBar's quick-tool and
      // a Header pill earlier in the DOM) — real user action — then assert
      // the bundled room name in the rendered grid.
      await click(page4.locator('#tab-meeting-rooms'));
      const roomOk4 = await until(() => page4.getByText(SAMPLE_ROOM, { exact: true }).count().then((c) => c > 0), true, 8000, 300);
      const roomCount4 = await page4.getByText(SAMPLE_ROOM, { exact: true }).count();
      if (!roomOk4) throw new Error(`bundled room marker "${SAMPLE_ROOM}" not rendered after opening the rooms tab (count=${roomCount4})`);
      // ...and the banner surface via the carousel's current slide being a
      // bundled title (JC7).
      const bannerOk4 = await until(async () => {
        const t = await page4.locator('#hero-carousel-container h2').first().innerText().catch(() => null);
        return t !== null && BUNDLED_BANNER_TITLES.includes(t.trim());
      }, true, 12000, 300);
      const bannerTitle4 = await page4.locator('#hero-carousel-container h2').first().innerText().catch(() => '<unavailable>');
      if (!bannerOk4) throw new Error(`carousel title ${JSON.stringify(bannerTitle4)} is not one of the bundled INITIAL_BANNERS titles`);

      // Screenshots — the reviewer must SEE rendered bundled content + badge
      // together: one full-viewport shot, one closeup framing the COMPLETE
      // news card TOGETHER WITH the badge.
      const shotFull4 = await shot(page4, 'o4a-routeaborted-portal-bundled-content-badge');
      // NIT fix v2 (W3-4O-3, run 2; run 1 INVALID): the clip-union of the card/
      // title/badge boxes produced the SAME 1332x108 strip as the pre-fix code
      // — at scroll 0 the card's title band sits in the same viewport band
      // (y~778-830) as the FIXED bottom-left badge (y~830-880), so the union
      // is a thin strip that decapitates the card body (and a clip derived
      // FROM the boxes cannot detect that). Robust framing instead: SCROLL so
      // the COMPLETE card sits fully inside the 1440x900 viewport together
      // with the always-visible fixed badge, ASSERT card + title <h4> + badge
      // boxes are ALL fully inside the viewport BEFORE saving, then save a
      // plain viewport screenshot — no clip math at all.
      const VIEWPORT_W4 = 1440;
      const VIEWPORT_H4 = 900;
      const titleLoc4 = page4.locator('#featured-alert-card h4').first();
      const titleText4 = await titleLoc4.innerText();
      strictEqual(titleText4.trim(), SAMPLE_TITLE, 'featured card <h4> is not the bundled sample title — the closeup would frame the wrong card');
      const boxInsideViewport4 = (b) =>
        b.x >= -0.5 && b.y >= -0.5 && b.x + b.width <= VIEWPORT_W4 + 0.5 && b.y + b.height <= VIEWPORT_H4 - 16;
      let closeupFramed4 = false;
      let closeupGeom4 = '';
      for (let attempt4 = 1; attempt4 <= 3 && !closeupFramed4; attempt4++) {
        const cardBox4 = await page4.locator('#featured-alert-card').boundingBox();
        if (!cardBox4) throw new Error(`boundingBox unavailable for #featured-alert-card (closeup attempt ${attempt4})`);
        const scrollBefore4 = await page4.evaluate(() => window.scrollY);
        // Page-absolute card bottom -> scroll target that parks it fully above
        // the viewport bottom (24px breathing room under the badge band).
        const targetScroll4 = Math.max(0, Math.ceil(cardBox4.y + cardBox4.height + scrollBefore4 + 24 - VIEWPORT_H4));
        await page4.evaluate((s) => window.scrollTo(0, s), targetScroll4);
        await sleep(300); // let the scroll + any reflow settle before judging
        const cardBoxNow4 = await page4.locator('#featured-alert-card').boundingBox();
        const titleBox4 = await titleLoc4.boundingBox();
        const badgeBox4 = await badge4.boundingBox();
        if (!cardBoxNow4 || !titleBox4 || !badgeBox4) {
          throw new Error(`boundingBox unavailable after scroll (attempt ${attempt4}: card=${Boolean(cardBoxNow4)}, title=${Boolean(titleBox4)}, badge=${Boolean(badgeBox4)})`);
        }
        closeupGeom4 = `attempt=${attempt4} scrollY=${scrollBefore4}->${targetScroll4} card(y=${Math.round(cardBoxNow4.y)},h=${Math.round(cardBoxNow4.height)}) title(y=${Math.round(titleBox4.y)}) badge(y=${Math.round(badgeBox4.y)})`;
        closeupFramed4 = boxInsideViewport4(cardBoxNow4) && boxInsideViewport4(titleBox4) && boxInsideViewport4(badgeBox4);
      }
      if (!closeupFramed4) {
        throw new Error(`closeup framing failed after 3 attempts — the COMPLETE news card + badge could not be framed inside the viewport (${closeupGeom4})`);
      }
      const CLOSEUP = 'o4a-routeaborted-newscard-badge-closeup.png';
      await page4.screenshot({ path: path.join(SHOT_DIR, CLOSEUP) }); // plain viewport shot — card + badge asserted in-frame
      const shotClose4 = `screenshots/${RUN_ID}/${CLOSEUP}`;

      record('O4a', 'Route-abort data outage, logged-in portal: bundled news/banners/rooms RENDERED + offline badge byte-for-byte; server-only marker ABSENT — FR-CMS-004(a)', 'PASS',
        `badgeText=${JSON.stringify(badgeText4)} === "${BADGE_TH}\\n${BADGE_EN}" (strict); src cross-check ok; bundledSample "${SAMPLE_TITLE}" count=${sampleCount4}; serverMarker count=0 (strict); room "${SAMPLE_ROOM}" count=${roomCount4} (exact); bannerSlide=${JSON.stringify(bannerTitle4.trim())} (bundled); closeup=complete card + badge framed inside the viewport (asserted pre-save): ${closeupGeom4}; ${shotFull4}; ${shotClose4}`);
    } catch (err) {
      record('O4a', 'Route-abort data outage, logged-in portal: bundled news/banners/rooms RENDERED + offline badge byte-for-byte; server-only marker ABSENT — FR-CMS-004(a)', 'FAIL', String(err.message || err).slice(0, 250));
    }

    // ---------- O4b: FR-CMS-004(b) — authenticated data ERRORS OUT, never silently substituted ----------
    try {
      if (!results.find((r) => r.id === 'O4a') || results.find((r) => r.id === 'O4a').status !== 'PASS') {
        throw new Error('blocked: O4a did not pass — no route-aborted portal session for the authenticated-failure check');
      }
      // loadAuthenticatedData fired at the login auth flip; its Promise.all
      // rejects (contacts+documents aborted) -> showToast(...). The toast
      // auto-dismisses after 3800ms (src/App.tsx:94): poll fast first; if the
      // window was lost, DETERMINISTICALLY re-trigger via page.reload() with
      // the aborts still active (session restore -> fresh failure -> fresh
      // toast). The capture path is recorded honestly in the evidence.
      const toastLoc4 = page4.locator(TOAST_SEL).filter({ hasText: 'Directory/documents sync failed' }).first();
      let toastVia = 'login-hydration';
      let toastShown4 = await until(() => toastLoc4.isVisible().catch(() => false), true, 4000, 150);
      if (!toastShown4) {
        toastVia = 'reload-retrigger';
        await page4.reload({ waitUntil: 'domcontentloaded' });
        toastShown4 = await until(() => toastLoc4.isVisible().catch(() => false), true, 9000, 150);
      }
      if (!toastShown4) throw new Error('authenticated sync-failure toast did not surface under the route-abort outage');
      const toastText4 = await page4.locator(`${TOAST_SEL} span.text-xs.font-semibold`).first().innerText();
      strictEqual(toastText4, AUTH_SYNC_TOAST, 'toast text differs from src/App.tsx:181 + src/api.ts:90 composition');
      const shotToast4 = await shot(page4, 'o4b-routeaborted-directory-docs-sync-failed-toast');

      // W3-4O-3 (FR-CMS-004(b) as-built fix): the hydration catch EMPTIES the
      // slices (src/App.tsx), so during the outage the REAL Directory and
      // Documents surfaces render NEITHER the unique server-only rows NOR the
      // bundled samples — strict count 0 on all four markers (JC8 navigation).
      // (a) Directory surface: segmented-control tab click back from the rooms
      // tab O4a left active (idempotent if the toast re-trigger reload already
      // reset activeTab to 'directory'), then scroll via the left rail.
      await click(page4.locator(TAB_PHONEBOOK_SEL));
      const dirToolbar4 = await until(
        () => page4.locator('#directory-rooms-section input[placeholder*="Search by name"]').isVisible().catch(() => false),
        true, 4000, 200,
      );
      if (!dirToolbar4) throw new Error('directory tab did not activate after the #tab-phonebook click');
      await click(page4.locator('aside').getByText(SIDEBAR_PHONEBOOK_TEXT, { exact: true }));
      await sleep(1000); // app scrolls smoothly — let it settle before evidence
      const serverContactCount4 = await page4.getByText(SERVER_CONTACT, { exact: false }).count();
      strictEqual(serverContactCount4, 0, `server-only contact must be ABSENT under the data outage (found ${serverContactCount4})`);
      const sampleContactCount4 = await page4.getByText(SAMPLE_CONTACT, { exact: false }).count();
      strictEqual(sampleContactCount4, 0, `bundled INITIAL_CONTACTS sample must be ABSENT under the data outage — authenticated views never render samples (found ${sampleContactCount4})`);
      const shotDir4 = await shot(page4, 'o4b-routeaborted-directory-empty-no-samples');
      // (b) Documents surface: left-rail "แบบฟอร์มเอกสาร (Official Forms)"
      // navigation click scrolls #governance-section into view; the list
      // renders under the default activeCategory='all' (no category click
      // required by the real UI).
      await click(page4.locator('aside').getByText(SIDEBAR_FORMS_TEXT, { exact: true }));
      await sleep(1000);
      const govHeading4 = await until(
        () => page4.locator('#governance-section h3').first().isVisible().catch(() => false),
        true, 4000, 300,
      );
      if (!govHeading4) throw new Error('governance/documents section not reachable after the sidebar navigation click');
      const serverDocCount4 = await page4.getByText(SERVER_DOCUMENT, { exact: false }).count();
      strictEqual(serverDocCount4, 0, `server-only document must be ABSENT under the data outage (found ${serverDocCount4})`);
      const sampleDocCount4 = await page4.getByText(SAMPLE_DOC_TITLE, { exact: false }).count();
      strictEqual(sampleDocCount4, 0, `bundled INITIAL_DOCUMENTS sample must be ABSENT under the data outage — authenticated views never render samples (found ${sampleDocCount4})`);
      const shotDocs4 = await shot(page4, 'o4b-routeaborted-documents-empty-no-samples');

      record('O4b', 'Route-abort outage on /api/contacts + /api/documents: authenticated hydration ERRORS OUT with the exact toast AND the Directory/Documents surfaces render EMPTY — no server rows, no bundled samples — FR-CMS-004(b)', 'PASS',
        `toastText=${JSON.stringify(toastText4)} === "${AUTH_SYNC_TOAST}" (strict); capturePath=${toastVia}; directory: serverContact=${serverContactCount4} (strict 0), bundledSample=${sampleContactCount4} (strict 0); documents: serverDocument=${serverDocCount4} (strict 0), bundledSample=${sampleDocCount4} (strict 0); ${shotToast4}; ${shotDir4}; ${shotDocs4}`);
    } catch (err) {
      record('O4b', 'Route-abort outage on /api/contacts + /api/documents: authenticated hydration ERRORS OUT with the exact toast AND the Directory/Documents surfaces render EMPTY — no server rows, no bundled samples — FR-CMS-004(b)', 'FAIL', String(err.message || err).slice(0, 250));
    }

    // ---------- O4c: FR-CMS-004(c) recovery — remove ALL interception + real reload ----------
    try {
      if (!results.find((r) => r.id === 'O4b') || results.find((r) => r.id === 'O4b').status !== 'PASS') {
        throw new Error('blocked: O4b did not pass — outage state not established for the recovery check');
      }
      await ctx4.unrouteAll({ behavior: 'wait' }); // ALL route interception removed
      await page4.reload({ waitUntil: 'domcontentloaded' }); // real user action; SPA loads for real
      // Session restore via /api/auth/me (cookie survived in the context) ->
      // authenticated portal -> hydration re-runs -> public GETs succeed ->
      // server data (marker) back, badge cleared (setOfflineMode(false)).
      const markerBack4 = await until(() => page4.locator(`text=${SERVER_TITLE}`).count().then((c) => c > 0), true, 12000);
      const badgeGone4 = await until(() => page4.locator(BADGE_SEL).count().then((c) => c === 0), true, 9000, 300);
      // W3-4O-3: the server-only CONTACT + DOCUMENT markers must be BACK on
      // the recovered authenticated surfaces (after the reload the directory
      // tab is the default and the documents list renders under
      // activeCategory='all' — both reachable in the DOM without further
      // clicks; the clicks below are for the evidence screenshots, JC8).
      const contactBack4 = await until(() => page4.getByText(SERVER_CONTACT, { exact: false }).count().then((c) => c > 0), true, 12000);
      const docBack4 = await until(() => page4.getByText(SERVER_DOCUMENT, { exact: false }).count().then((c) => c > 0), true, 12000);
      const shotRec4 = await shot(page4, 'o4c-unrouteall-reload-server-news-back-badge-gone');
      await click(page4.locator('aside').getByText(SIDEBAR_PHONEBOOK_TEXT, { exact: true }));
      await sleep(1000);
      const shotRecDir4 = await shot(page4, 'o4c-recovered-directory-server-contact-back');
      await click(page4.locator('aside').getByText(SIDEBAR_FORMS_TEXT, { exact: true }));
      await sleep(1000);
      const shotRecDocs4 = await shot(page4, 'o4c-recovered-documents-server-doc-back');
      if (!markerBack4) throw new Error(`server-only marker "${SERVER_TITLE}" did not return after unrouteAll + reload`);
      if (!badgeGone4) throw new Error('offline badge did not clear after unrouteAll + reload');
      if (!contactBack4) throw new Error(`server-only contact "${SERVER_CONTACT}" did not return after unrouteAll + reload`);
      if (!docBack4) throw new Error(`server-only document "${SERVER_DOCUMENT}" did not return after unrouteAll + reload`);
      record('O4c', 'Recovery (unrouteAll + real page.reload()): server-seeded news + server-only contact/document RETURN and the badge is GONE — FR-CMS-004(c)', 'PASS',
        `unrouteAll(behavior:wait) then page.reload(); serverMarker back; badgeCount=0 (strict); serverContact back; serverDocument back; ${shotRec4}; ${shotRecDir4}; ${shotRecDocs4}`);
    } catch (err) {
      record('O4c', 'Recovery (unrouteAll + real page.reload()): server-seeded news + server-only contact/document RETURN and the badge is GONE — FR-CMS-004(c)', 'FAIL', String(err.message || err).slice(0, 250));
    }
  } finally {
    await ctx4.close();
  }
} finally {
  await finalize();
}

process.exit(failures.length ? 1 : 0);
