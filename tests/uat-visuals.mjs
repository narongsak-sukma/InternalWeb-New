/**
 * W3-4 L6 UAT lane — Doc 21 §12 visual closures + UI legs not covered by
 * tests/e2e-walkthrough.mjs (NEW FILE: e2e-walkthrough.mjs is NOT modified).
 *
 * Captures (Doc 21 §12):
 *   V1 withdraw confirm dialog "เพิกถอนจากเว็บไซต์สาธารณะ / Withdraw from public web"
 *      — maker create -> submit -> checker approve -> WITHDRAW (screenshot BEFORE confirm)
 *   V2 NEW badge close-up on a documents card (intranet Governance & Policies)
 *   V3 login screen at 375px mobile viewport
 * Extra UI legs (UAT ids):
 *   V4 maker External Web Sync preview (FR-SYNC-005 / UAT-055, maker+ view)
 *   V5 staff deep-link cannot reach CMS + session restore across reload (UAT-040/044)
 *
 * Output:
 *   Screenshots: .omc/reports/screenshots/run-<YYYY-MM-DDTHHMM>Z-uat/*.png
 *   (own run dir + MANIFEST.sha256, same shasum -a 256 format as the e2e harness;
 *    suffix -uat distinguishes this lane's capture set from -e2e runs)
 *   Results JSON: .omc/reports/w3-4-uat/visuals-results.json
 *
 * Env contract: E2E_BASE (default http://127.0.0.1:3223),
 *   E2E_ROLE_PASSWORD (default E2E-Test@2026 — walkthrough-provisioned role users).
 */
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
  return `run-${t.slice(0, 10)}T${t.slice(11, 13)}${t.slice(14, 16)}Z-uat`;
})();
const SHOT_DIR = path.join(ROOT, '.omc', 'reports', 'screenshots', RUN_ID);
const RESULTS_JSON = process.env.W34_VISUALS_RESULTS || path.join(ROOT, '.omc', 'reports', 'w3-4-uat', 'visuals-results.json');
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3223';
const PASSWORD = process.env.E2E_ROLE_PASSWORD || 'E2E-Test@2026';

fs.mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
const failures = [];
function record(id, name, status, evidence = '') {
  results.push({ runId: RUN_ID, id, name, status, evidence });
  const icon = status === 'PASS' ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${id} ${name}${evidence ? ` — ${evidence}` : ''}`);
  if (status !== 'PASS') failures.push(id);
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
async function apiLogin(username) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD }),
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
  await page.getByRole('button', { name: /เข้าสู่ระบบ \/ Sign in/i }).click();
  await page.locator('#login-username').waitFor({ state: 'hidden', timeout: 15000 });
}

const TS = Date.now();
const NEWS_TITLE = `W34-UAT เพิกถอนภาพ ${TS}`;
const DOC_TITLE = `W34-UAT คู่มือฉบับใหม่ ${TS}`;

const browser = await chromium.launch();

try {
  // ---------- V0 (API prep): maker create -> submit -> checker approve ----------
  const makerCookie = await apiLogin('maker01');
  const checkerCookie = await apiLogin('checker01');
  const created = await api(makerCookie, 'POST', '/api/news', {
    title: NEWS_TITLE, titleEn: 'W34 Withdraw Visual EN', summary: 'visual probe', content: 'visual probe body',
  });
  const newsId = created.body?.data?.id;
  if (created.status !== 201 || !newsId) throw new Error(`V0 create failed: ${created.status}`);
  const sub = await api(makerCookie, 'POST', `/api/news/${newsId}/submit-approval`);
  const app = await api(checkerCookie, 'POST', `/api/news/${newsId}/approve`);
  const synced = app.body?.data?.externalSyncStatus === 'synced';
  record('V0', 'API prep: maker create -> submit -> checker approve (synced)', synced ? 'PASS' : 'FAIL',
    `create=${created.status} submit=${sub.status} approve=${app.status} status=${app.body?.data?.externalSyncStatus} id=${newsId}`);

  // ---------- V1: withdraw confirm dialog (screenshot BEFORE confirming) ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
      await login(page, 'maker01');
      await page.locator('#nav-cms').click();
      await page.locator('text=System Dashboard').waitFor({ state: 'visible', timeout: 10000 });
      await page.getByRole('button', { name: /News & Alerts tab/i }).first().click();
      await page.waitForTimeout(600);
      const row = page.locator(`tr:has-text("${NEWS_TITLE}")`).first();
      await row.waitFor({ state: 'visible', timeout: 8000 });
      const withdrawBtn = row.locator('button[aria-label^="เพิกถอน:"]').first();
      await withdrawBtn.click({ timeout: 8000 });
      const dlg = page.locator('div.fixed.inset-0:visible, [role="dialog"]:visible').first();
      await dlg.waitFor({ state: 'visible', timeout: 6000 });
      // Settle PAST the overlay's 150ms animate-in fade (opacity starts at 0):
      // waitFor(visible) fires on bounding box, and innerText() works on a
      // transparent element — a screenshot racing the fade captures the
      // dashboard with no scrim (run 1's v1 miss; re-capture fix).
      await page.waitForTimeout(600);
      const dlgText = await dlg.innerText();
      const hasTitle = dlgText.includes('เพิกถอนจากเว็บไซต์สาธารณะ / Withdraw from public web');
      const hasItem = dlgText.includes(NEWS_TITLE);
      const hasConsequence = dlgText.includes('ร่าง');
      const visibleBefore = await dlg.isVisible();
      const shotRef = await shot(page, 'v1-withdraw-confirm-dialog'); // BEFORE confirming
      const closeupFile = 'v1c-withdraw-dialog-closeup.png';
      await dlg.locator('[role="alertdialog"]').first().screenshot({ path: path.join(SHOT_DIR, closeupFile) });
      const visibleAfter = await dlg.isVisible();
      if (!hasTitle || !hasItem) throw new Error(`dialog content mismatch: title=${hasTitle} item=${hasItem}`);
      if (!visibleBefore || !visibleAfter) throw new Error(`dialog visibility bracket failed: before=${visibleBefore} after=${visibleAfter}`);
      await dlg.getByRole('button', { name: /^เพิกถอน \/ Withdraw$/i }).click({ timeout: 6000 });
      const backToDraft = await until(
        () => page.locator(`tr:has-text("${NEWS_TITLE}")`).first().locator('text=ร่าง').count().then((c) => c > 0),
        true, 9000,
      );
      await shot(page, 'v1b-withdrawn-row-draft');
      if (!backToDraft) throw new Error('row did not return to ร่าง (draft) after withdraw confirm');
      record('V1', 'Withdraw confirm dialog captured BEFORE confirm; item returns to draft', 'PASS',
        `${shotRef}; ${closeupFile}; dialog title/item/consequence(ร่าง)=${hasTitle}/${hasItem}/${hasConsequence}; overlay visible before/after shots=${visibleBefore}/${visibleAfter}; post-confirm chip ร่าง shown`);
    } catch (err) {
      record('V1', 'Withdraw confirm dialog captured BEFORE confirm; item returns to draft', 'FAIL', String(err.message || err).slice(0, 250));
    } finally { await ctx.close(); }
  }

  // ---------- V2: NEW badge close-up on a documents card ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
      const docRes = await api(makerCookie, 'POST', '/api/documents', {
        title: DOC_TITLE, titleEn: 'W34 New Badge Doc EN', category: 'form',
      });
      const isNew = docRes.body?.data?.isNew === true;
      if (docRes.status !== 201 || !isNew) throw new Error(`doc register failed: ${docRes.status} isNew=${docRes.body?.data?.isNew}`);
      await login(page, 'staff01');
      const section = page.locator('#governance-section').first();
      await section.waitFor({ state: 'visible', timeout: 10000 });
      const card = section.locator('div.p-4', { hasText: DOC_TITLE }).first();
      await card.waitFor({ state: 'visible', timeout: 8000 });
      await card.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      const badge = card.locator('text=NEW').first();
      const badgeVisible = await badge.isVisible().catch(() => false);
      const cardShot = await card.screenshot({ path: path.join(SHOT_DIR, 'v2-new-badge-documents-card.png') });
      if (!badgeVisible) throw new Error('NEW badge not visible on the freshly registered document card');
      record('V2', 'NEW badge close-up on a freshly registered documents card', 'PASS',
        `screenshots/${RUN_ID}/v2-new-badge-documents-card.png; badge visible on card "${DOC_TITLE}" (isNew forced server-side at register)`);
    } catch (err) {
      record('V2', 'NEW badge close-up on a freshly registered documents card', 'FAIL', String(err.message || err).slice(0, 250));
    } finally { await ctx.close(); }
  }

  // ---------- V3: login screen at 375px mobile ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.locator('#login-username').waitFor({ state: 'visible', timeout: 15000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const shotRef = await shot(page, 'v3-login-mobile-375');
      if (overflow > 1) throw new Error(`horizontal overflow at 375px: ${overflow}px`);
      record('V3', 'Login screen at 375px mobile viewport', 'PASS', `${shotRef}; no horizontal overflow (scrollWidth-clientWidth=${overflow}px)`);
    } catch (err) {
      record('V3', 'Login screen at 375px mobile viewport', 'FAIL', String(err.message || err).slice(0, 250));
    } finally { await ctx.close(); }
  }

  // ---------- V4: maker External Web Sync preview (FR-SYNC-005 / UAT-055) ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
      await login(page, 'maker01');
      await page.locator('#nav-external').click();
      const ok = await until(
        () => page.locator('text=Live External Website Simulator: www.kbjcapital.co.th').count().then((c) => c > 0),
        true, 9000,
      );
      const shotRef = await shot(page, 'v4-maker-external-web-sync');
      if (!ok) throw new Error('External Web Sync view did not render for maker');
      record('V4', 'Maker sees the External Web Sync preview view', 'PASS', `${shotRef}; simulator heading rendered`);
    } catch (err) {
      record('V4', 'Maker sees the External Web Sync preview view', 'FAIL', String(err.message || err).slice(0, 250));
    } finally { await ctx.close(); }
  }

  // ---------- V5: staff deep-link cannot reach CMS + session restore on reload ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
      await login(page, 'staff01');
      await page.goto(`${BASE}/?view=admin-cms#/cms`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      const chrome = await page.locator('#btn-global-search, #nav-intranet').first().isVisible().catch(() => false);
      const cmsNav = await page.locator('#nav-cms').count();
      const dashboard = await page.locator('text=System Dashboard').count();
      const shot1 = await shot(page, 'v5-staff-deeplink-no-cms');
      if (!chrome || cmsNav || dashboard) throw new Error(`deep-link gate: chrome=${chrome} cmsNav=${cmsNav} dashboard=${dashboard}`);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(800);
      const stillAuthed = await page.locator('#btn-global-search, #nav-intranet').first().isVisible().catch(() => false);
      const loginForm = await page.locator('#login-username').count();
      const shot2 = await shot(page, 'v5b-session-restore-after-reload');
      if (!stillAuthed || loginForm) throw new Error(`session restore failed: authed=${stillAuthed} loginForm=${loginForm}`);
      record('V5', 'Staff deep-link cannot reach CMS (view state not URL-addressable); session survives reload', 'PASS',
        `${shot1}; portal chrome present, #nav-cms=0, System Dashboard=0; after reload still authenticated (${shot2})`);
    } catch (err) {
      record('V5', 'Staff deep-link cannot reach CMS (view state not URL-addressable); session survives reload', 'FAIL', String(err.message || err).slice(0, 250));
    } finally { await ctx.close(); }
  }
} finally {
  await browser.close();
}

// ---- finalize: results JSON + per-run MANIFEST.sha256 (same format as e2e harness) ----
fs.writeFileSync(RESULTS_JSON, JSON.stringify({
  runId: RUN_ID, startedAt: RUN_STARTED_AT.toISOString(), finalizedAt: new Date().toISOString(),
  counts: {
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status !== 'PASS').length,
  },
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
console.log(`Visuals run dir: ${SHOT_DIR} — ${manifestFiles.length} files, MANIFEST.sha256 written`);
console.log(`SUMMARY PASS=${results.filter((r) => r.status === 'PASS').length} FAIL=${failures.length}`);
process.exit(failures.length ? 1 : 0);
