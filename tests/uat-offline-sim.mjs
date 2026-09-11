/**
 * W3-4O offline-simulation UAT lane — obs-U1, Doc 18 §7 / CTO decision #23 rider
 * (UAT-043 / FR-CMS-004: offline fallback badge + bundled sample data).
 * NEW FILE: no existing test/script/doc is modified. Modeled on
 * tests/uat-visuals.mjs and tests/uat-journey-evidence.mjs (same harness idioms).
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
    markers: { serverSeeded: SERVER_TITLE, bundledSample: SAMPLE_TITLE },
    judgmentCalls: [
      'JC1 boot: ADMIN_PASSWORD passed via env (never logged) — production boot would otherwise print a generated admin password into the transcript',
      'JC2 markers: unique approved news item = server-only marker (in-memory server seeds the exact INITIAL_NEWS bundle, so server/bundle start identical)',
      'JC3 logged-in portal cannot stably display bundled sample data via real user actions (hydration re-runs only on auth flips; login offline impossible; reload offline cannot load the SPA) — captured as non-gating first-paint transient OBS instead',
      'JC4 badge text asserted strict === against literals copied from src/App.tsx:593/595, cross-checked against the source file at runtime',
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
  console.log(`SUMMARY PASS=${results.filter((r) => r.status === 'PASS').length} FAIL=${failures.length}`);
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
} finally {
  await finalize();
}

process.exit(failures.length ? 1 : 0);
