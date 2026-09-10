/**
 * E2E walkthrough of the KB J Capital intranet portal (v2 - hardened).
 * Plain Playwright API (no test-runner framework): `node tests/e2e-walkthrough.mjs`
 *
 * Preconditions (QA sets these up when spawning the run):
 *  - Fresh server on http://127.0.0.1:3220 (dedicated E2E instance, port 3000 untouched)
 *  - Users: admin, maker01, checker01, staff01 (all E2E-Test@2026)
 *
 * v2 hardening (task #24) - lessons from the 2026-09-03 run (36 PASS / 24 FAIL):
 *  - Strict-mode-safe locators: the double-Cancel (C2) and duplicate
 *    #governance-section (B13) violations are scoped + .first()-ed; every
 *    text-filter locator that can legitimately match several nodes is scoped.
 *  - Retry-once for flaky clicks (click() helper, 8s budget) and per-step
 *    single retry for idempotent steps only (creates are single-shot).
 *  - Cascade isolation: `needs:` prerequisites make dependent steps SKIP
 *    instantly when a producer step failed (no more 30s-timeout chains), and
 *    settle() dismisses lingering dialogs after every step.
 *  - Updated expectations for the APPROVED changes (tasks #16-#23):
 *      * Architecture + K8s views GONE from every role's nav
 *      * User Management tab present in CMS (admin)
 *      * Release-booking control present and working
 *      * News create flow works end-to-end
 *
 * QA pass additions (worker-qa, task #24 review of the tester's v2):
 *  - S0 self-bootstrap: role users are provisioned via POST /api/users so the
 *    suite runs against any FRESH server (admin password via E2E_ADMIN_PASSWORD).
 *  - C2 Cancel is scoped to the news <form> itself (the form is an inline
 *    panel, NOT a modal overlay — overlay-scoped Cancel would never resolve).
 *  - B1 auto-advance is asserted for real (active dot = widest dot via
 *    getBoundingClientRect; the old findIndex always returned 0).
 *  - B12 release must actually clear the booking (toast text alone is not
 *    evidence); custom confirm overlay is confirmed, native confirms accepted.
 *  - E4 drives the full User Management dogfood: list, create user through
 *    the form, duplicate-username 409 surfaced inline.
 *  - C-API / E-API verify server guards from #20: empty-id PUT/DELETE -> 400
 *    envelope; malformed JSON -> clean 400 JSON envelope.
 *
 * Output:
 *  - Screenshots: .omc/reports/screenshots/*.png
 *  - Machine-readable results: .omc/reports/e2e-results.json (E2E_RESULTS overrides)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHOT_DIR = path.join(ROOT, '.omc', 'reports', 'screenshots');
const RESULTS_JSON = process.env.E2E_RESULTS || path.join(ROOT, '.omc', 'reports', 'e2e-results.json');
const FIXTURE_PNG = path.join(__dirname, 'fixtures', 'test-image.png');
const FIXTURE_PDF = path.join(__dirname, 'fixtures', 'test-doc.pdf');

const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3220';
const PASSWORD = process.env.E2E_ROLE_PASSWORD || 'E2E-Test@2026'; // maker01/checker01/staff01
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'E2E-Test@2026'; // bootstrap admin (fresh prod server: QaFix@2026)

fs.mkdirSync(SHOT_DIR, { recursive: true });

// ----------------------------- results plumbing -----------------------------
const results = [];
const consoleIssues = []; // { context, type, text } for console errors + pageerrors
const buttonInventory = []; // { view, role, text, action } for every button encountered
const outcome = {}; // step id -> PASS | FLAKY | FAIL | SKIP  (for `needs` resolution)
let currentSection = 'setup';

function record(id, name, status, evidence = '') {
  results.push({ section: currentSection, id, name, status, evidence });
  outcome[id] = status;
  const icon = status === 'PASS' ? 'PASS' : status === 'FAIL' ? 'FAIL' : status === 'FLAKY' ? 'FLKY' : 'SKIP';
  console.log(`[${icon}] ${id} ${name}${evidence ? ` — ${evidence}` : ''}`);
}

/**
 * Run one check. Options:
 *  - needs: [ids] - SKIP instantly (no timeout) when any producer step did not pass
 *  - page:   enables automatic failure screenshot + post-step dialog cleanup (settle)
 *  - retry:  false for non-idempotent steps (creates) - single attempt only
 */
async function step(id, name, fn, { skip = false, skipReason = '', needs = [], page = null, retry = true } = {}) {
  if (skip) { record(id, name, 'SKIPPED', skipReason); return null; }
  const blockedBy = needs.filter((n) => outcome[n] !== 'PASS' && outcome[n] !== 'FLAKY');
  if (blockedBy.length) {
    record(id, name, 'SKIPPED', `prerequisite step(s) not green: ${blockedBy.join(', ')}`);
    return null;
  }
  const attempt = async () => {
    try {
      const evidence = await fn();
      return typeof evidence === 'string' ? evidence : '';
    } catch (err) {
      throw new Error(String(err && err.message ? err.message : err).split('\n')[0].slice(0, 300));
    }
  };
  try {
    const evidence = await attempt();
    record(id, name, 'PASS', evidence);
    if (page) await settle(page);
    return true;
  } catch (err) {
    if (retry) {
      try {
        const evidence = await attempt();
        record(id, name, 'FLAKY', `passed on retry: ${evidence}`);
        if (page) await settle(page);
        return true;
      } catch { /* fall through to FAIL below */ }
    }
    if (page) { await shot(page, `${id.toLowerCase()}-fail`); await settle(page); }
    record(id, name, 'FAIL', err.message);
    return null;
  }
}

function trackContext(page, name) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleIssues.push({ context: name, type: 'console.error', text: msg.text().slice(0, 400) });
    }
  });
  page.on('pageerror', (err) => {
    consoleIssues.push({ context: name, type: 'pageerror', text: String(err).split('\n').slice(0, 3).join(' | ').slice(0, 400) });
  });
  // native confirm()/alert() would auto-DISMISS and silently cancel flows
  // (e.g. a window.confirm-based release) — accept them instead.
  page.on('dialog', (d) => { void d.accept().catch(() => {}); });
}

async function shot(page, name) {
  const file = `${name}.png`;
  try { await page.screenshot({ path: path.join(SHOT_DIR, file), fullPage: false }); } catch { /* ignore */ }
  return `screenshots/${file}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Click with one retry and a short budget so failures are FAST, never 30s hangs. */
async function click(loc, { timeout = 8000 } = {}) {
  try {
    await loc.click({ timeout });
  } catch (first) {
    await sleep(600);
    try {
      await loc.click({ timeout });
    } catch (second) {
      throw new Error(`click failed (2 attempts): ${String(second && second.message ? second.message : second).split('\n')[0].slice(0, 200)} / first: ${String(first && first.message ? first.message : first).split('\n')[0].slice(0, 120)}`);
    }
  }
}

/**
 * Dismiss anything a failed step may have left open (modal, drawer, confirm
 * dialog) so one failure cannot blanket-cover later steps. Best-effort.
 */
async function settle(page) {
  try {
    await page.keyboard.press('Escape');
    await sleep(250);
  } catch { /* ignore */ }
  for (let round = 0; round < 3; round++) {
    try {
      const dlg = page.locator('div.fixed.inset-0:visible, [role="dialog"]:visible').first();
      if (!(await dlg.count())) return;
      const txt = (await dlg.innerText().catch(() => '')).slice(0, 300);
      // Unsaved-changes guard: DISCARD (last button) so the dirty form is reset
      // and cannot re-arm the dialog on the next tab click (C8-C12 cascade root).
      if (/ยังไม่ได้บันทึก|unsaved changes/i.test(txt)) {
        const btns = dlg.locator('button');
        if ((await btns.count()) >= 2) { await btns.last().click({ timeout: 2000 }); await sleep(300); continue; }
      }
      const closer = dlg.getByRole('button').last();
      if (!(await closer.count())) return;
      await closer.click({ timeout: 1500 });
      await sleep(250);
    } catch { return; }
  }
}

async function newSectionCtx(browser, viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  ctx.setDefaultTimeout(8000);
  return ctx;
}

/** Poll until fn() === expected or timeout (ms). */
async function until(fn, expected, timeout = 8000, interval = 400) {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await fn();
    if (last === expected) return true;
    await sleep(interval);
  }
  return false;
}

/**
 * If a visible overlay is a confirmation prompt, click its LAST button
 * (the ConfirmDialog idiom renders cancel first, confirm second).
 * Returns true when a confirm button was clicked.
 */
async function confirmOverlay(page) {
  const dlg = page.locator('div.fixed.inset-0:visible, [role="dialog"]:visible').first();
  if (!(await dlg.count())) return false;
  try {
    const txt = (await dlg.innerText().catch(() => '')).slice(0, 300);
    if (!/ยืนยัน|confirm|แน่ใจ|release|ยกเลิกการจอง|delete|ลบ|ปล่อย|ยังไม่ได้บันทึก|unsaved/i.test(txt)) return false;
    const btns = dlg.locator('button');
    if ((await btns.count()) >= 1) { await btns.last().click({ timeout: 4000 }); return true; }
  } catch { /* not a confirmable dialog */ }
  return false;
}

// -------- API helpers (node 24 has global fetch) --------
async function apiLogin(username, password = PASSWORD) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const cookie = (res.headers.get('set-cookie') || '').split(';')[0];
  if (!res.ok || !cookie) throw new Error(`apiLogin ${username} -> HTTP ${res.status}`);
  return cookie;
}

// ----------------------------- shared helpers -----------------------------
async function login(page, username, password = PASSWORD) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('#login-username').waitFor({ state: 'visible', timeout: 15000 });
  await page.fill('#login-username', username);
  await page.fill('#login-password', password);
  await click(page.getByRole('button', { name: /เข้าสู่ระบบ \/ Sign in/i }));
  // Post-login signal must be viewport-independent: at 375px the desktop
  // #btn-global-search pill is hidden and a union-locator .first() would wait
  // on the wrong element. Wait for the login screen to unmount, then for ANY
  // of the header candidates to be visible.
  await page.locator('#login-username').waitFor({ state: 'hidden', timeout: 15000 });
  const chrome = page.locator('#btn-global-search:visible, #nav-intranet:visible, #btn-tools-dropdown:visible, #btn-notifications:visible');
  const ok = await until(() => chrome.count().then((c) => c > 0), true, 8000, 300);
  if (!ok) throw new Error('post-login chrome did not appear (no visible search/nav/tools/notification control)');
}

async function logout(page) {
  const btn = page.locator('button[aria-label="ออกจากระบบ / Sign out"]');
  if (await btn.count()) {
    await click(btn);
    await page.locator('#login-username').waitFor({ state: 'visible', timeout: 10000 });
    return true;
  }
  return false;
}

/** Open the CMS from any authenticated page that shows the header nav. */
async function openCms(page) {
  await click(page.locator('#nav-cms'));
  await page.locator('text=System Dashboard').waitFor({ state: 'visible', timeout: 10000 });
}

/** Inventory every visible button on the page and click the "safe" ones. */
async function clickAllSafeButtons(page, viewLabel, { safe = () => true } = {}) {
  // Atomic snapshot via one JS round-trip: reading textContent per element from
  // Node raced with carousel re-renders in the v2 run (elements detached between
  // query and read -> textContent timeouts).
  const texts = await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((b) => b.offsetParent !== null)
      .map((b) => ((b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)) || b.getAttribute('aria-label') || '(icon)'),
  );
  let clicked = 0;
  const skipped = [];
  const live = page.locator('button:visible');
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    const reason = safe(text);
    if (reason === true) {
      try {
        await live.nth(i).click({ timeout: 2000, noWaitAfter: true });
        clicked++;
        await sleep(150);
        await settle(page); // close anything the click opened before the next one
      } catch {
        skipped.push({ text, reason: 'click failed/covered' });
      }
    } else {
      skipped.push({ text, reason: String(reason) });
    }
    buttonInventory.push({ view: viewLabel, text, action: reason === true ? 'clicked' : `skipped: ${reason}` });
  }
  return { total: texts.length, clicked, skipped };
}

// ================================ MAIN =====================================
const browser = await chromium.launch();

// ============================================================================
// SECTION S — BOOTSTRAP (API): provision role users on a fresh server
// ============================================================================
currentSection = 'S-bootstrap';
await step('S0', 'Bootstrap: admin login + role users provisioned via /api/users', async () => {
  const cookie = await apiLogin('admin', ADMIN_PASSWORD);
  const wanted = [
    { username: 'maker01', password: PASSWORD, displayName: 'E2E Maker', email: 'maker01@kbjcapital.co.th', role: 'maker' },
    { username: 'checker01', password: PASSWORD, displayName: 'E2E Checker', email: 'checker01@kbjcapital.co.th', role: 'checker' },
    { username: 'staff01', password: PASSWORD, displayName: 'E2E Staff', email: 'staff01@kbjcapital.co.th', role: 'staff' },
  ];
  const outcomes = [];
  for (const u of wanted) {
    const res = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify(u),
    });
    outcomes.push(`${u.username}:${res.status === 201 ? 'created' : res.status === 409 ? 'exists' : `HTTP ${res.status}`}`);
  }
  const bad = outcomes.filter((o) => !/:201$|:exists$/.test(o));
  if (bad.length) throw new Error(`user provisioning failed: ${bad.join(', ')} — check E2E_ADMIN_PASSWORD`);
  return outcomes.join(', ');
});

// ============================================================================
// SECTION A — ANONYMOUS
// ============================================================================
currentSection = 'A-anonymous';
{
  const ctx = await newSectionCtx(browser);
  const page = await ctx.newPage();
  trackContext(page, 'A-anonymous');

  await step('A1', '/ shows the login screen (auth gate)', async () => {
    const res = await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.locator('#login-username').waitFor({ state: 'visible', timeout: 15000 });
    if (!res.ok() && res.status() !== 200) throw new Error(`HTTP ${res.status()}`);
    const portalLeak = await page.locator('#btn-global-search').count();
    if (portalLeak) throw new Error('portal chrome visible while anonymous');
    return `HTTP ${res.status()}, login form visible, no portal chrome`;
  });
  await shot(page, 'a-login-screen');

  await step('A2', 'Login screen renders bilingual labels, hotline 1258 and brand', async () => {
    const body = await page.locator('body').innerText();
    const checks = {
      thUsername: body.includes('ชื่อผู้ใช้งาน'),
      enUsername: body.includes('Username'),
      thPassword: body.includes('รหัสผ่าน'),
      hotline: body.includes('1258'),
      brand: body.includes('KB J Capital'),
      thWelcome: body.includes('ยินดีต้อนรับสู่พอร์ทัลพนักงาน'),
    };
    const missing = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) throw new Error(`missing: ${missing.join(', ')}`);
    return 'bilingual labels + hotline 1258 + brand all present';
  });

  await step('A3', 'Client-side validation on empty submit', async () => {
    await click(page.getByRole('button', { name: /เข้าสู่ระบบ \/ Sign in/i }));
    await page.locator('#login-username-error').waitFor({ state: 'visible', timeout: 5000 });
    const pwErr = await page.locator('#login-password-error').isVisible();
    if (!pwErr) throw new Error('password field error missing');
    return 'both field errors shown';
  });

  await step('A4', 'Wrong password shows bilingual server error, password cleared', async () => {
    await page.fill('#login-username', 'staff01');
    await page.fill('#login-password', 'WrongPassword!99');
    await click(page.getByRole('button', { name: /เข้าสู่ระบบ \/ Sign in/i }));
    await page.locator('[role="alert"]').first().waitFor({ state: 'visible', timeout: 8000 });
    const text = await page.locator('[role="alert"]').first().innerText();
    if (!/ไม่สำเร็จ|failed|credentials|incorrect/i.test(text)) throw new Error(`unexpected error text: ${text.slice(0, 120)}`);
    const pw = await page.inputValue('#login-password');
    if (pw !== '') throw new Error('password not cleared after failure');
    await shot(page, 'a-wrong-password-error');
    return `error shown: "${text.split('\n')[0].slice(0, 90)}", password field cleared (attempt 1/5 consumed)`;
  }, { retry: false });

  await step('A5', '6th failed attempt shows rate-limit message', async () => {
    for (let i = 2; i <= 5; i++) {
      await page.fill('#login-username', 'staff01');
      await page.fill('#login-password', `WrongPass-${i}!`);
      await click(page.getByRole('button', { name: /เข้าสู่ระบบ \/ Sign in/i }));
      await page.waitForTimeout(400);
    }
    await page.fill('#login-username', 'staff01');
    await page.fill('#login-password', 'WrongPass-6!');
    await click(page.getByRole('button', { name: /เข้าสู่ระบบ \/ Sign in/i }));
    await page.locator('[role="alert"]').first().waitFor({ state: 'visible', timeout: 8000 });
    const text = await page.locator('[role="alert"]').first().innerText();
    if (!/Too many login attempts/i.test(text)) throw new Error(`expected rate-limit message, got: ${text.slice(0, 120)}`);
    await shot(page, 'a-rate-limit-message');
    return `"${text.split('\n')[0].slice(0, 90)}" shown on 6th attempt (5/min limit)`;
  }, { retry: false });

  await step('A6', 'Deep-link / query params do not bypass the auth gate', async () => {
    await page.goto(`${BASE}/?view=admin-cms#/cms`, { waitUntil: 'domcontentloaded' });
    await page.locator('#login-username').waitFor({ state: 'visible', timeout: 10000 });
    const portalLeak = await page.locator('#btn-global-search').count();
    if (portalLeak) throw new Error('portal chrome leaked on deep link');
    return 'arbitrary deep-link/query state still lands on login (view state is not URL-addressable)';
  });

  // Rate-limit cooldown: the limiter (5 failed/min/IP) must expire before real logins.
  console.log('  ...waiting 65s for login rate-limit window to expire...');
  await sleep(65_000);
  await ctx.close();
}

// ============================================================================
// SECTION B — STAFF ROLE
// ============================================================================
currentSection = 'B-staff';
{
  const ctx = await newSectionCtx(browser);
  const page = await ctx.newPage();
  trackContext(page, 'B-staff');

  await step('B0', 'Staff login succeeds -> portal home', async () => {
    await login(page, 'staff01');
    return await shot(page, 'b-staff-home');
  });

  await step('B1', 'Hero carousel renders slides and auto-advances', async () => {
    // dots: height-2 buttons; the active one is WIDER (w-8 vs w-2). The old
    // findIndex logic always returned 0, so auto-advance was never really
    // checked — use the widest dot as the honest active-index signal.
    const activeDot = () => page.evaluate(() => {
      const els = [...document.querySelectorAll('main button')].filter((b) => /(^|\s)h-2(\s|$)/.test(b.className) && /(^|\s)w-/.test(b.className));
      let idx = -1; let max = -1;
      els.forEach((e, i) => { const w = e.getBoundingClientRect().width; if (w > max) { max = w; idx = i; } });
      return { n: els.length, idx };
    });
    const before = await activeDot();
    if (before.n < 2) throw new Error(`carousel dots not found (n=${before.n})`);
    let after = before;
    for (let t = 0; t < 3 && after.idx === before.idx; t++) { await page.waitForTimeout(4500); after = await activeDot(); }
    if (after.idx === before.idx) throw new Error(`no auto-advance observed within ~13s (active index stayed ${before.idx})`);
    return `dots=${before.n}, active index ${before.idx} -> ${after.idx} (auto-play every 5.5s)`;
  }, { page, retry: false });

  await step('B2', 'Hero carousel manual next/prev navigation works', async () => {
    const arrows = page.locator('main button.absolute.right-3, main button.absolute.left-3');
    const count = await arrows.count();
    if (count >= 2) {
      await arrows.nth(count - 1).hover();
      await click(arrows.nth(count - 1));
      await page.waitForTimeout(400);
      return `clicked next arrow (of ${count} arrows found)`;
    }
    throw new Error(`carousel arrows not found (count=${count})`);
  });

  await step('B3', 'Quick tools bar renders and in-page tool scrolls to section', async () => {
    const tools = page.locator('main button, main a').filter({ hasText: /Meeting|Rooms|ประชุม/i }).first();
    await tools.waitFor({ state: 'visible', timeout: 5000 });
    const scrollY0 = await page.evaluate(() => window.scrollY);
    await click(tools);
    await page.waitForTimeout(1200); // smooth scroll
    const scrollY1 = await page.evaluate(() => window.scrollY);
    if (scrollY1 <= scrollY0) throw new Error(`page did not scroll (${scrollY0} -> ${scrollY1})`);
    return `page scrolled ${scrollY0} -> ${scrollY1}px after clicking meeting-rooms quick link`;
  });

  await step('B4', 'News section loads seeded articles from the server', async () => {
    await click(page.locator('#nav-intranet'));
    await page.waitForTimeout(800);
    const cards = await page.locator('main article, main [class*="group"]').filter({ has: page.locator('h3,h4') }).count();
    const bodyText = await page.locator('main').innerText();
    const hasSeed = /ประกาศ|ธนาคารแห่งประเทศไทย|BOT|NCB|PDPA|KB J/i.test(bodyText);
    if (!hasSeed) throw new Error('no seeded news content found');
    return `news content rendered (approx card containers: ${cards}); seeded keywords present`;
  });

  let articleTitle = '';
  await step('B5', 'Article detail modal opens from a news card', async () => {
    const card = page.locator('main button:visible, main [role="button"]:visible').filter({ hasText: /อ่านต่อ|Read/i }).first();
    await card.waitFor({ state: 'visible', timeout: 5000 });
    articleTitle = (await card.innerText()).split('\n')[0].slice(0, 60);
    await click(card);
    await page.locator('div.fixed.inset-0').first().waitFor({ state: 'visible', timeout: 5000 });
    await shot(page, 'b-article-detail-modal');
    return `modal opened (from card "${articleTitle}…")`;
  }, { page });

  await step('B6', 'Article modal closes via Escape key', async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const modal = await page.locator('div.fixed.inset-0:visible').count();
    if (modal) throw new Error('modal still visible after Escape');
    return 'modal dismissed with Escape';
  });

  await step('B7', 'Article modal closes via backdrop click', async () => {
    await settle(page); // clear any transition/overlay state left by B6's Escape
    // Read controls are [role="button"] elements, not <button>s — AND the union
    // must apply :visible to BOTH arms: without it, DOM-first hidden matches
    // (hidden carousel clones etc.) pin waitFor to the wrong element (v2 flake).
    const card = page.locator('main button:visible, main [role="button"]:visible').filter({ hasText: /อ่านต่อ|Read/i }).first();
    await card.waitFor({ state: 'visible', timeout: 5000 });
    await card.scrollIntoViewIfNeeded().catch(() => {});
    await click(card);
    // poll for the modal (v1/v2 runs hit a rare re-render race right after Escape)
    const opened = await until(() => page.locator('div.fixed.inset-0:visible').count().then((c) => c > 0), true, 8000, 300);
    if (!opened) throw new Error('modal did not re-open after card click');
    // Click the BACKDROP ELEMENT at element-relative coords: the modal container
    // is overflow-y-auto, so when the (taller-than-viewport) modal scrolls, a
    // viewport-coordinate click can land on the handler-less container instead
    // of the absolute-positioned backdrop — element-relative position is immune.
    const backdrop = page.locator('div.fixed.inset-0:visible >> div.absolute.inset-0').first();
    if (!(await backdrop.count())) throw new Error('backdrop layer not found');
    await backdrop.click({ position: { x: 15, y: 450 }, timeout: 5000 });
    const closed = await until(() => page.locator('div.fixed.inset-0:visible').count().then((c) => c === 0), true, 8000, 400);
    if (!closed) throw new Error('modal still visible after backdrop click');
    return 'modal dismissed with off-center backdrop click';
  }, { page });

  await step('B8', 'Global search (Ctrl+K) opens, finds a seeded article, keyboard usable', async () => {
    await page.keyboard.press('Control+k');
    const input = page.locator('input[autofocus], div.fixed input').first();
    await input.waitFor({ state: 'visible', timeout: 5000 });
    await input.fill('BOT');
    await page.waitForTimeout(400);
    const resultsText = await page.locator('div.fixed').first().innerText();
    if (!/BOT|ธนาคารแห่งประเทศไทย|result|ผลลัพธ์/i.test(resultsText)) throw new Error('no BOT results in search modal');
    await shot(page, 'b-global-search-bot');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    const detailOpen = await page.locator('div.fixed.inset-0:visible').count();
    await page.keyboard.press('Escape');
    return `results shown for "BOT"; Tab+Enter navigated (dialog open=${detailOpen > 0}); ESC closed`;
  }, { page });

  await step('B9', 'Directory: search by name filters contacts', async () => {
    // #governance-style duplicate-id defense: scope + .first() everywhere
    const section = page.locator('#directory-rooms-section').first();
    await section.scrollIntoViewIfNeeded();
    const search = section.locator('input[type="text"]').first();
    await search.fill('ธนาคาร');
    let n = await section.locator('.grid .bg-white, tbody tr').count();
    if (!n) { await search.fill('1301'); n = await section.locator('.grid .bg-white, tbody tr').count(); }
    await shot(page, 'b-directory-search');
    if (!n) throw new Error('no contact cards rendered for search term');
    return `filtered contacts rendered (n=${n})`;
  });

  await step('B10', 'Directory: department filter chips work', async () => {
    const section = page.locator('#directory-rooms-section').first();
    await section.locator('input[type="text"]').first().fill('');
    const chip = section.locator('button').filter({ hasText: /^(?!All Departments)/i }).nth(1);
    const chipName = await chip.innerText();
    await click(chip);
    await page.waitForTimeout(400);
    const depts = await section.innerText();
    const ok = depts.toLowerCase().includes(chipName.toLowerCase().slice(0, 8));
    await shot(page, 'b-directory-dept-filter');
    if (!ok) throw new Error(`filter chip "${chipName}" did not change listing`);
    return `filtered by dept "${chipName.trim()}"`;
  });

  await step('B11', 'Meeting rooms: book an available room -> status changes to In-Use', async () => {
    await click(page.locator('#tab-meeting-rooms'));
    const reserve = page.locator('button').filter({ hasText: /Reserve This Room/i }).first();
    await reserve.waitFor({ state: 'visible', timeout: 5000 });
    await click(reserve);
    await page.locator('input[placeholder*="Q3 Sales"]').fill('E2E Test Booking');
    await page.locator('input[placeholder*="Credit Analysis"]').fill('E2E Staff');
    await click(page.getByRole('button', { name: /Confirm Reservation/i }));
    await page.waitForTimeout(1200);
    const inUse = await page.locator('text=E2E Test Booking').count();
    const toast = await page.locator('text=/Room successfully reserved/i').count();
    await shot(page, 'b-room-booked');
    if (!inUse && !toast) throw new Error('booking not confirmed (no In-Use status, no toast)');
    return `room booked: booking card shown=${inUse > 0}, toast shown=${toast > 0}`;
  }, { page, retry: false });

  await step('B12', 'Meeting rooms: release booking control returns room to available', async () => {
    // APPROVED CHANGE (#18): a release control must exist and work.
    // Tolerant label matching, scoped to the rooms tab to avoid matching
    // unrelated ยกเลิก buttons elsewhere on the page.
    const tab = page.locator('#tab-meeting-rooms, #directory-rooms-section').first();
    const release = tab.locator('button').filter({ hasText: /release|ปล่อยห้อง|ปล่อยการจอง|ยกเลิกการจอง|end meeting|check.?out|เสร็จสิ้นการประชุม|ปล่อย/i }).first();
    await release.waitFor({ state: 'visible', timeout: 5000 });
    await click(release);
    const confirmed = await confirmOverlay(page); // custom confirm dialog if present (native ones auto-accept)
    const cleared = await until(() => page.locator('text=E2E Test Booking').count().then((c) => c === 0), true, 9000);
    const toast = await page.locator('text=/release|ปล่อย|สำเร็จ|success|available|ว่าง/i').count();
    await shot(page, 'b-room-released');
    if (!cleared) throw new Error('release clicked but the booking is still shown on the room');
    return `release control used${confirmed ? ' + confirm dialog accepted' : ''}; booking cleared; feedback shown=${toast > 0}`;
  }, { page, needs: ['B11'], retry: false });

  await step('B13', 'Documents/policies: category filter and document open', async () => {
    // duplicate-DOM-id defense: .first()
    const sec = page.locator('#governance-section').first();
    await sec.scrollIntoViewIfNeeded();
    const catBtn = sec.locator('button').filter({ hasText: /Forms|แบบฟอร์ม|Policy|Policies/i }).first();
    if (await catBtn.count()) { await click(catBtn); await page.waitForTimeout(300); }
    const docCard = sec.locator('button, [role="button"], a').filter({ hasText: /v1\.|v\d|Handbook|คู่มือ|แบบฟอร์ม|Regulation/i }).first();
    await click(docCard);
    await page.waitForTimeout(500);
    await shot(page, 'b-document-modal');
    await page.keyboard.press('Escape');
    return 'category filter clicked, document modal opened + Escape closed';
  }, { page });

  await step('B14', 'Header role badge shows STAFF; nav limited to allowed views', async () => {
    // APPROVED CHANGE (#22/#23): Architecture + K8s views are GONE for ALL roles.
    const badge = await page.locator('header').innerText();
    const hasStaff = /STAFF/i.test(badge) && /E2E Staff/.test(badge);
    const navCms = await page.locator('#nav-cms').count();
    const navExt = await page.locator('#nav-external').count();
    const navK8s = await page.locator('#nav-k8s').count();
    const navArch = await page.locator('#nav-architecture').count();
    const cmsLauncher = await page.locator('text=Open Self-Service CMS').count();
    // DOM label grep: the removed views' labels must not exist anywhere
    const blueprintLabels = await page.locator('header, footer, main').filter({ hasText: /BA\/SA Blueprint|BA\/SA Report|Architecture Blueprint/i }).count();
    const k8sLabels = await page.locator('header, footer, main').filter({ hasText: /K8s DevOps|K8s Dashboard/i }).count();
    await shot(page, 'b-staff-header');
    const bad = [];
    if (!hasStaff) bad.push('no STAFF badge');
    if (navCms) bad.push('#nav-cms visible');
    if (navExt) bad.push('#nav-external visible');
    if (navK8s) bad.push('#nav-k8s still visible (approved removal #23 not effective)');
    if (navArch) bad.push('#nav-architecture still visible (approved removal #23 not effective)');
    if (blueprintLabels) bad.push('BA/SA Blueprint|Report labels still in DOM');
    if (k8sLabels) bad.push('K8s DevOps labels still in DOM');
    if (cmsLauncher) bad.push('CMS quick launcher visible');
    if (bad.length) throw new Error(bad.join(', '));
    return 'STAFF badge shown; CMS/External nav absent; Architecture + K8s nav AND labels absent (approved state)';
  });

  await step('B15', 'Internal Tools dropdown opens with corporate links', async () => {
    await click(page.locator('#btn-tools-dropdown'));
    await page.waitForTimeout(300);
    const menu = await page.locator('text=Core Corporate Systems').count();
    await shot(page, 'b-tools-dropdown');
    if (!menu) throw new Error('tools dropdown did not open');
    await click(page.locator('#btn-tools-dropdown'));
    return 'dropdown opened (HR System / IT-Request / KB J-E-DMS links)';
  });

  await step('B16', 'Notification bell opens the urgent alert article', async () => {
    await click(page.locator('#btn-notifications'));
    await page.waitForTimeout(500);
    const modal = await page.locator('div.fixed.inset-0:visible').count();
    await shot(page, 'b-notification-alert');
    await page.keyboard.press('Escape');
    return `alert modal opened=${modal > 0} (only when an isImportantAlert item exists)`;
  }, { page });

  await step('B17', 'Staff logout returns to login screen', async () => {
    const ok = await logout(page);
    if (!ok) throw new Error('sign out button not found');
    return await shot(page, 'b-after-logout');
  });

  await ctx.close();
}

// ============================================================================
// SECTION C — MAKER ROLE
// ============================================================================
currentSection = 'C-maker';
const NEWS_TITLE = `[E2E] ประกาศทดสอบ Maker ${Date.now() % 100000}`;
{
  const ctx = await newSectionCtx(browser);
  const page = await ctx.newPage();
  trackContext(page, 'C-maker');

  await step('C0', 'Maker login; CMS nav visible', async () => {
    await login(page, 'maker01');
    const navCms = await page.locator('#nav-cms').count();
    const navK8s = await page.locator('#nav-k8s').count();
    const navArch = await page.locator('#nav-architecture').count();
    if (!navCms) throw new Error('#nav-cms missing for maker');
    if (navK8s) throw new Error('#nav-k8s still visible for maker (approved removal #23 not effective)');
    if (navArch) throw new Error('#nav-architecture still visible for maker (approved removal #23 not effective)');
    const labels = await page.locator('header, footer, main').filter({ hasText: /BA\/SA Blueprint|BA\/SA Report|K8s DevOps/i }).count();
    if (labels) throw new Error('removed-view labels still in DOM for maker (approved removal #23 not effective)');
    await openCms(page);
    return await shot(page, 'c-maker-cms-dashboard');
  });

  await step('C1', 'Create news article via CMS form', async () => {
    await click(page.getByRole('button', { name: /\+ New Post/i }));
    await page.locator('text=Create & Publish New Announcement').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('input[placeholder*="ประกาศมาตรการ"]').fill(NEWS_TITLE);
    await page.locator('input[placeholder*="BOT Regulatory"]').fill('E2E Test Article EN');
    await page.locator('textarea[placeholder*="Brief description"]').fill('E2E summary for the walkthrough test');
    await page.locator('textarea[placeholder*="Full announcement"]').fill('E2E full content body. Lorem ipsum verification.');
    await click(page.getByRole('button', { name: /Publish Immediately/i }));
    await page.waitForTimeout(1200);
    const row = await page.locator(`tr:has-text("${NEWS_TITLE}")`).count();
    if (!row) throw new Error('created article row not found in list');
    await shot(page, 'c-news-created');
    return `article "${NEWS_TITLE}" appears in CMS list`;
  }, { page, retry: false }); // create action - no retry (double-create risk)

  await step('C2', 'Image upload via file input returns a server URL', async () => {
    await click(page.getByRole('button', { name: /\+ New Post/i }));
    await page.locator('text=Create & Publish New Announcement').waitFor({ state: 'visible', timeout: 5000 });
    const fileInput = page.locator('input[type="file"][accept*="png"]').first();
    await fileInput.setInputFiles(FIXTURE_PNG);
    await page.waitForTimeout(1500);
    const url = await page.inputValue('#news-image-url');
    if (!/^\/uploads\/.+\.(png|jpg|jpeg|webp|gif)$/i.test(url)) throw new Error(`upload did not set /uploads URL (got "${url}")`);
    await shot(page, 'c-image-uploaded-url');
    // cancel the form (dirty guard -> discard). STRICT-MODE FIX: the news form
    // is an INLINE panel (not a modal overlay), and the page can legitimately
    // contain other "Cancel" buttons (banner/contact/document forms +
    // ConfirmDialog) — so scope to the news <form> itself, identified by the
    // Thai title input it contains.
    const newsForm = page.locator('form').filter({ has: page.locator('input[placeholder*="ประกาศมาตรการ"]') });
    await click(newsForm.getByRole('button', { name: /^Cancel$/i }).first());
    await click(page.getByRole('button', { name: /ยกเลิกการแก้ไข \/ Discard/i }).first());
    return `uploaded file URL: ${url}; form cancelled via form-scoped Cancel + Discard`;
  }, { page });

  await step('C-FR', 'Failed save keeps the form open with entered data (fix #26)', async () => {
    await click(page.getByRole('button', { name: /News & Alerts tab/i }).first());
    await click(page.getByRole('button', { name: /\+ New Post/i }).first());
    const heading = page.locator('text=Create & Publish New Announcement').first();
    await heading.waitFor({ state: 'visible', timeout: 5000 });
    const TITLE = '[E2E] failed save retention probe';
    await page.locator('input[placeholder*="ประกาศมาตรการ"]').fill(TITLE);
    await page.locator('textarea[placeholder*="Brief description"]').fill('values that must survive a failed save');
    // ALL required fields must be filled or native validation blocks the
    // submit BEFORE any request fires (root cause of the v2 FAIL: no POST,
    // hence legitimately nothing to surface).
    await page.locator('textarea[placeholder*="Full announcement"]').fill('E2E failed-save probe full content body');
    // simulate a server-side failure: abort the create POST at the network layer
    await page.route('**/api/news', (route) => {
      if (route.request().method() === 'POST') void route.abort('failed').catch(() => {});
      else void route.continue().catch(() => {});
    });
    try {
      await click(page.getByRole('button', { name: /Publish Immediately/i }));
      await page.waitForTimeout(1500); // let the failure propagate through api + handler
      const stillOpen = (await heading.count()) === 1;
      const keptTitle = await page.locator('input[placeholder*="ประกาศมาตรการ"]').inputValue();
      const keptSummary = await page.locator('textarea[placeholder*="Brief description"]').inputValue();
      const errBox = await page.locator('[role="alert"]:visible, [role="status"]:visible').count();
      const errText = errBox ? await page.locator('[role="alert"]:visible, [role="status"]:visible').first().innerText().catch(() => '') : '';
      const surfaced = errBox > 0 && !/เข้าสู่ระบบ|sign in/i.test(errText);
      await shot(page, 'c-failed-save-retention');
      const bad = [];
      if (!stillOpen) bad.push('form closed after failed save');
      if (!keptTitle.includes(TITLE)) bad.push(`title lost (got "${keptTitle.slice(0, 40)}")`);
      if (!keptSummary.includes('survive')) bad.push('summary lost');
      if (!surfaced) bad.push('failure not surfaced to the user (no alert/status visible)');
      if (bad.length) throw new Error(bad.join(', '));
    } finally {
      await page.unroute('**/api/news').catch(() => {});
    }
    // cleanup: close the form. NOTE — an ERRORED form (newsFormError set) skips
    // the dirty-confirm and closes directly, so the Discard click must be
    // conditional (run 3 failed only on this cleanup assumption).
    const newsForm = page.locator('form').filter({ has: page.locator('input[placeholder*="ประกาศมาตรการ"]') });
    const cancelBtn = newsForm.getByRole('button', { name: /^Cancel$/i }).first();
    if (await cancelBtn.count()) {
      await click(cancelBtn);
      const discard = page.getByRole('button', { name: /ยกเลิกการแก้ไข \/ Discard/i }).first();
      if (await discard.count()) await click(discard);
    }
    return 'POST aborted at network layer; form stayed open, title + summary preserved, error surfaced';
  }, { page, retry: false });

  await step('C3', 'Edit article preserves fields', async () => {
    const editBtn = page.locator(`button[aria-label^="แก้ไขประกาศ: ${NEWS_TITLE}"]`).first();
    await click(editBtn);
    await page.locator('text=Edit Article & Sync Settings').waitFor({ state: 'visible', timeout: 5000 });
    const preserved = await page.locator('input[placeholder*="ประกาศมาตรการ"]').inputValue();
    if (!preserved.includes(NEWS_TITLE)) throw new Error(`title not preserved (got "${preserved}")`);
    const summary = await page.locator('textarea[placeholder*="Brief description"]').inputValue();
    if (!summary.includes('E2E summary')) throw new Error('summary not preserved');
    await click(page.getByRole('button', { name: /Save Changes/i }));
    await page.waitForTimeout(1200);
    await shot(page, 'c-news-edited');
    return 'edit form pre-filled (title + summary preserved) and saved';
  }, { page, needs: ['C1'] });

  await step('C4', 'Submit for approval -> Thai status chip รอการอนุมัติ', async () => {
    const row = page.locator(`tr:has-text("${NEWS_TITLE}")`).first();
    await click(row.locator('button').filter({ hasText: /\+ Request Approval/i }).first());
    await page.waitForTimeout(1500);
    const chip = await row.locator('text=รอการอนุมัติ').count();
    await shot(page, 'c-pending-approval-chip');
    if (!chip) throw new Error('pending chip รอการอนุมัติ not shown on row');
    return 'row shows รอการอนุมัติ chip';
  }, { page, needs: ['C1'] });

  await step('C5', 'Maker cannot see Approve/Reject controls on pending item', async () => {
    const row = page.locator(`tr:has-text("${NEWS_TITLE}")`).first();
    // Accessible-NAME matching (aria-label "อนุมัติ: … / Approve"): the old
    // /^Approve$/ textContent filter NEVER matched — the button renders a Check
    // icon before the text, so textContent is " Approve" (leading whitespace)
    // and the absence check was vacuous. Name matchers are proven non-vacuous
    // by D1/D2 using the same matchers successfully as checker.
    const approve = await row.getByRole('button', { name: /\/ Approve$/i }).count();
    const reject = await row.getByRole('button', { name: /\/ Reject$/i }).count();
    const waiting = await row.locator('text=รอ Checker ตรวจสอบ').count();
    if (approve || reject) throw new Error(`approve=${approve} reject=${reject} visible to maker`);
    if (!waiting) throw new Error('"รอ Checker ตรวจสอบ / Awaiting checker review" hint missing');
    return 'no Approve/Reject buttons (name-matched, non-vacuous); awaiting-checker hint shown';
  }, { needs: ['C4'], page });

  await step('C6', 'Maker has NO delete buttons and NO User Management tab', async () => {
    const delNews = await page.locator('button[aria-label^="ลบประกาศ:"]').count();
    const anyTrash = await page.locator('button[title*="Delete" i]').count();
    const userMgmt = await page.getByRole('button', { name: /User Management|จัดการผู้ใช้|ผู้ใช้งาน/i }).count();
    if (delNews || anyTrash) throw new Error(`delete controls visible: news=${delNews} generic=${anyTrash}`);
    if (userMgmt) throw new Error('User Management tab visible to maker (admin-only per #19)');
    return 'no delete controls and no User Management tab rendered for maker';
  });

  await step('C7', 'Banner CRUD: create hero banner slide', async () => {
    await click(page.getByRole('button', { name: /Hero Carousel tab/i }).first());
    await confirmOverlay(page); // discard any stray dirty-guard so the tab switch actually lands
    await click(page.getByRole('button', { name: /Add Banner Slide/i }).first());
    await page.locator('input[placeholder*="Annual Health Checkup"]').first().fill('[E2E] Test Banner Slide');
    // Image URL is REQUIRED (native validation) — the file input is a HIDDEN
    // ref-driven element inside the banner form (accept=".jpg,.jpeg,.png,...",
    // no "image" substring, no aria-label), so scope it through the form.
    const bannerForm = page.locator('form').filter({ has: page.locator('#banner-image-url') });
    const bannerFile = bannerForm.locator('input[type="file"]').first();
    if (await bannerFile.count()) {
      await bannerFile.setInputFiles(FIXTURE_PNG);
      await until(() => page.inputValue('#banner-image-url').then((v) => /^\/uploads\//.test(v)), true, 8000, 500);
    } else {
      // fallback: any absolute path passes the ^(https?:\/\/|\/) handler check
      await page.locator('#banner-image-url').fill('/uploads/e2e-banner-fallback.png');
    }
    // Subtitle + CTA Action Text are ALSO required — fill every empty required
    // input in the banner form or native validation blocks the submit silently.
    const reqInputs = bannerForm.locator('input[required]');
    const nReq = await reqInputs.count();
    for (let i = 0; i < nReq; i++) {
      const inp = reqInputs.nth(i);
      if (!(await inp.inputValue()).trim()) {
        const ph = (await inp.getAttribute('placeholder')) || '';
        await inp.fill(/Short description/i.test(ph) ? '[E2E] banner subtitle' : 'อ่านต่อ / Learn More');
      }
    }
    await click(page.getByRole('button', { name: /Save Banner/i }).first());
    const created = await until(() => page.locator('text=[E2E] Test Banner Slide').count().then((c) => c > 0), true, 9000);
    await shot(page, 'c-banner-created');
    if (!created) throw new Error('banner not created/listed');
    return 'banner slide created (with uploaded image) and listed';
  }, { page, retry: false });

  await step('C8', 'Contact create in Phone Directory tab', async () => {
    await click(page.getByRole('button', { name: /Phone Directory tab/i }).first());
    await confirmOverlay(page); // discard stray dirty-guard so the switch lands
    // The "Admin Quick Actions" rail renders add-buttons for EVERY tab, and the
    // DOM-first /\+ Add|.../ candidate is the BANNER one — that mismatch opened
    // the banner form instead of the contact form (run-2 FAIL). The contacts
    // quick-action has an exact label; from any tab it switches + opens the form.
    await click(page.getByRole('button', { name: /\+ Add Employee Contact/i }).first());
    await page.waitForTimeout(600);
    // ALL FOUR text fields are required (Name TH/EN, Position, Extension) and
    // their "e.g. ..." placeholders carry no field names — the old heuristic
    // loop matched only one field, native validation blocked the submit and no
    // POST ever fired (root cause of the v2 FAIL). Fill each by placeholder.
    const contactField = (needle) => page.locator(`input[placeholder*="${needle}"]`).first();
    await contactField('คุณสมชาย ใจดี').fill('E2E ทดสอบ รายชื่อ');
    await contactField('Somchai Jaidee').fill('E2E Test Contact');
    await contactField('Senior Credit Officer').fill('E2E Tester');
    await contactField('1315').fill('1999');
    const save = page.getByRole('button', { name: /Save Contact/i }).first();
    if (await save.count()) {
      await click(save);
      await page.waitForTimeout(1200);
    }
    const created = await page.locator('text=E2E Test Contact').count();
    await shot(page, 'c-contact-created');
    if (!created) throw new Error('contact not created/listed');
    return 'contact created (all 4 required fields) and listed';
  }, { page, retry: false });

  await step('C9', 'Document upload entry (Policies & Forms tab)', async () => {
    await click(page.getByRole('button', { name: /Policies & Forms tab/i }).first());
    await confirmOverlay(page); // discard stray dirty-guard so the switch lands
    const upBtn = page.getByRole('button', { name: /\+ Upload|Add Document|เพิ่มเอกสาร/i }).first();
    await click(upBtn);
    await page.waitForTimeout(400);
    const fileInput = page.locator('input[type="file"]').first();
    const hasForm = await page.locator('form').count();
    if (await fileInput.count()) {
      await fileInput.setInputFiles(FIXTURE_PDF);
      await page.waitForTimeout(600);
    }
    const titleInput = page.locator('form input[type="text"]').first();
    if (await titleInput.count()) await titleInput.fill('[E2E] Test Policy Document');
    const save = page.getByRole('button', { name: /Upload Document|Save Document/i }).first();
    if (await save.count()) { await click(save); await page.waitForTimeout(1200); }
    const created = await page.locator('text=[E2E] Test Policy Document').count();
    await shot(page, 'c-document-upload');
    if (!created) throw new Error(`document not created (form=${hasForm})`);
    return 'document form opened, PDF attached, saved and listed';
  }, { page, retry: false });

  await step('C10', 'Unsaved-changes guard fires on tab switch', async () => {
    await click(page.getByRole('button', { name: /News & Alerts tab/i }).first());
    await click(page.getByRole('button', { name: /\+ New Post/i }).first());
    await page.locator('input[placeholder*="ประกาศมาตรการ"]').fill('[E2E] unsaved guard probe');
    await click(page.getByRole('button', { name: /Hero Carousel tab/i }).first());
    const dialog = page.locator('text=ยังไม่ได้บันทึกการเปลี่ยนแปลง');
    await dialog.waitFor({ state: 'visible', timeout: 4000 });
    await shot(page, 'c-unsaved-guard-dialog');
    await click(page.getByRole('button', { name: /ยกเลิกการเปลี่ยนแปลง \/ Discard/i }).first());
    await page.waitForTimeout(400);
    return 'guard dialog shown; Discard proceeded to banners tab';
  }, { page });

  await step('C11', 'Meeting Rooms tab: status override buttons work', async () => {
    await click(page.getByRole('button', { name: /Meeting Rooms tab/i }).first());
    await confirmOverlay(page); // discard stray dirty-guard so the switch lands
    // aria-label idiom: "ตั้งสถานะ <room> เป็นปิดซ่อม / Set maintenance"
    const maint = page.locator('button[aria-label*="ปิดซ่อม"]').first();
    await maint.waitFor({ state: 'visible', timeout: 5000 });
    await click(maint);
    const ok = await until(() => page.locator('text=/MAINTENANCE|ปิดซ่อม|Maintenance/i').count().then((c) => c > 0), true, 8000);
    await shot(page, 'c-room-status-maintenance');
    if (!ok) throw new Error('no maintenance status feedback');
    // restore to available so later sections start from a clean room state
    const avail = page.locator('button[aria-label*="เป็นว่าง"]').first();
    if (await avail.count()) await click(avail);
    return 'room status set to MAINTENANCE (then restored to available)';
  }, { page });

  await step('C-API', 'API guard: empty-id PUT/DELETE return 400 envelope (fix #20)', async () => {
    const cookie = await apiLogin('maker01');
    const put = await fetch(`${BASE}/api/news/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ title: 'x' }),
    });
    const del = await fetch(`${BASE}/api/news/`, { method: 'DELETE', headers: { cookie } });
    const putBody = await put.json().catch(() => ({}));
    const delBody = await del.json().catch(() => ({}));
    const bad = [];
    if (put.status !== 400) bad.push(`PUT=${put.status}`);
    if (del.status !== 400) bad.push(`DELETE=${del.status}`);
    if (putBody.success !== false || delBody.success !== false) bad.push('missing success:false envelope');
    if (bad.length) throw new Error(bad.join(', '));
    return `PUT /api/news/ -> 400 "${putBody.error}"; DELETE /api/news/ -> 400 "${delBody.error}"`;
  });

  await step('C12', 'Maker logout', async () => {
    const ok = await logout(page);
    if (!ok) throw new Error('logout failed');
    return 'logged out';
  });

  await ctx.close();
}

// ============================================================================
// SECTION D — CHECKER ROLE
// ============================================================================
currentSection = 'D-checker';
const NEWS_TITLE_2 = `[E2E] ประกาศทดสอบ Reject ${Date.now() % 100000}`;
{
  const mkCtx = await newSectionCtx(browser);
  const mkPage = await mkCtx.newPage();
  trackContext(mkPage, 'D-maker-prep');
  await step('D0a', '(prep) Maker creates + submits a second article for the reject flow', async () => {
    await login(mkPage, 'maker01');
    await openCms(mkPage);
    await click(mkPage.getByRole('button', { name: /\+ New Post/i }).first());
    await mkPage.locator('input[placeholder*="ประกาศมาตรการ"]').fill(NEWS_TITLE_2);
    await mkPage.locator('textarea[placeholder*="Brief description"]').fill('E2E reject flow summary');
    await mkPage.locator('textarea[placeholder*="Full announcement"]').fill('E2E reject flow content');
    await click(mkPage.getByRole('button', { name: /Publish Immediately/i }).first());
    await mkPage.waitForTimeout(1200);
    const row = mkPage.locator(`tr:has-text("${NEWS_TITLE_2}")`).first();
    await click(row.locator('button').filter({ hasText: /\+ Request Approval/i }).first());
    await mkPage.waitForTimeout(1200);
    const chip = await row.locator('text=รอการอนุมัติ').count();
    if (!chip) throw new Error('second article not pending');
    return 'second article pending approval';
  }, { page: mkPage, retry: false });
  await logout(mkPage).catch(() => {});
  await mkCtx.close();

  const ctx = await newSectionCtx(browser);
  const page = await ctx.newPage();
  trackContext(page, 'D-checker');

  await step('D0', 'Checker login; CMS accessible; pending queue visible', async () => {
    await login(page, 'checker01');
    await openCms(page);
    const pending = await page.locator(`tr:has-text("${NEWS_TITLE}")`).first().locator('text=รอการอนุมัติ').count();
    if (!pending) throw new Error('pending item not visible to checker');
    await shot(page, 'd-checker-pending-queue');
    return 'pending items visible with รอการอนุมัติ chips';
  }, { page, needs: ['C1', 'C4'] });

  await step('D1', 'Approve pending item -> status เผยแพร่แล้ว + sync log entry', async () => {
    const row = page.locator(`tr:has-text("${NEWS_TITLE}")`).first();
    // accessible-name match: aria-label is "อนุมัติ: <title> / Approve" —
    // textContent is " Approve" (icon + whitespace), so an anchored /^Approve$/
    // filter matches nothing (root cause of the v2 FAIL here).
    await click(row.getByRole('button', { name: /\/ Approve$/i }).first());
    const ok = await until(() => row.locator('text=เผยแพร่แล้ว').count().then((c) => c > 0)
      || row.locator('text=Approved & Live').count().then((c) => c > 0), true, 9000);
    await shot(page, 'd-approved');
    if (!ok) throw new Error('item did not reach เผยแพร่แล้ว/Approved & Live');
    return 'status เผยแพร่แล้ว shown ("Approved & Live")';
  }, { page, needs: ['C1', 'C4'] });

  await step('D2', 'Reject with reason (required) -> status ถูกปฏิเสธ', async () => {
    const row = page.locator(`tr:has-text("${NEWS_TITLE_2}")`).first();
    // aria-label is "ปฏิเสธ: <title> / Reject" (aria-label OVERRIDES the title
    // attr in accessible-name computation — matching the title text finds nothing)
    await click(row.getByRole('button', { name: /\/ Reject$/i }).first());
    const reasonInput = page.locator('input[aria-label="เหตุผลการปฏิเสธ / Rejection reason"]').first();
    await reasonInput.waitFor({ state: 'visible', timeout: 4000 });
    const disabledWhenEmpty = await row.locator('button').filter({ hasText: /ปฏิเสธ \/ Reject/i }).first().isDisabled();
    await reasonInput.fill('E2E: wording revision required');
    await click(row.locator('button').filter({ hasText: /ปฏิเสธ \/ Reject/i }).first());
    const ok = await until(() => page.locator(`tr:has-text("${NEWS_TITLE_2}")`).first().locator('text=ถูกปฏิเสธ').count().then((c) => c > 0), true, 9000);
    await shot(page, 'd-rejected');
    if (!ok) throw new Error('item did not show ถูกปฏิเสธ');
    return `rejected with reason; reject disabled when empty=${disabledWhenEmpty}; chip ถูกปฏิเสธ shown`;
  }, { page, needs: ['D0a'], retry: false });

  await step('D3', 'Audit Trail tab lists the actions just performed with correct actors', async () => {
    await click(page.getByRole('button', { name: /Audit Trail tab|BOT \/ PDPA Audit Trail/i }).first());
    await page.waitForTimeout(800);
    const body = await page.locator('main').innerText();
    const hasSubmit = /SUBMIT_APPROVAL|Submit/i.test(body);
    const hasApprove = /APPROVE|Approve/i.test(body);
    const hasReject = /REJECT|Reject/i.test(body);
    const hasActor = /maker01|checker01|E2E Maker|E2E Checker/i.test(body);
    await shot(page, 'd-audit-trail');
    const missing = [];
    if (!hasSubmit) missing.push('SUBMIT');
    if (!hasApprove) missing.push('APPROVE');
    if (!hasReject) missing.push('REJECT');
    if (!hasActor) missing.push('actor names');
    if (missing.length) throw new Error(`audit trail missing: ${missing.join(', ')}`);
    return 'audit trail shows SUBMIT/APPROVE/REJECT with maker01/checker01 actors';
  }, { page });

  await step('D4', 'Checker write controls: edit allowed (rank >= maker), delete forbidden', async () => {
    await click(page.getByRole('button', { name: /News & Alerts tab/i }).first());
    await page.waitForTimeout(500);
    const editBtns = await page.locator('button[aria-label^="แก้ไขประกาศ:"]').count();
    const delBtns = await page.locator('button[aria-label^="ลบประกาศ:"]').count();
    const userMgmt = await page.getByRole('button', { name: /User Management|จัดการผู้ใช้|ผู้ใช้งาน/i }).count();
    await shot(page, 'd-checker-write-controls');
    if (delBtns) throw new Error(`delete buttons visible to checker (${delBtns}) — DELETE is admin-only per RBAC matrix`);
    if (userMgmt) throw new Error('User Management tab visible to checker (admin-only per #19)');
    return `edit buttons visible to checker: ${editBtns} (checker rank >= maker — by design); delete=0; no User Management tab`;
  });

  await step('D5', 'Checker logout', async () => {
    const ok = await logout(page);
    if (!ok) throw new Error('logout failed');
    return 'logged out';
  });
  await ctx.close();
}

// ============================================================================
// SECTION E — ADMIN ROLE
// ============================================================================
currentSection = 'E-admin';
{
  const ctx = await newSectionCtx(browser);
  const page = await ctx.newPage();
  trackContext(page, 'E-admin');

  // ---- shared User-Management helpers (E4 + E4b), aligned to the settled markup ----
  const main = page.locator('main');
  /** The create-user form is the form containing the password input (AdminCMS "Create New User Account" panel). */
  const userForm = () => page.locator('form').filter({ has: page.locator('input[type="password"]') }).first();
  /** The form panel is hidden until "Create User Account" is clicked (isAddingUser). */
  const openUserFormUI = async () => {
    if (await userForm().count()) return;
    const open = page.getByRole('button', { name: /Create User Account/i }).first();
    await open.waitFor({ state: 'visible', timeout: 5000 });
    await click(open);
    await userForm().waitFor({ state: 'visible', timeout: 5000 });
  };
  /**
   * Structural field mapping — labels are unassociated sibling <label>s and
   * placeholders carry no field names, so map by input type + DOM order:
   * text inputs are [Username, Display Name]; email and password are
   * type-unique. Placeholder sanity-checked so markup drift fails loudly
   * instead of silently swapping fields.
   */
  const fillUserForm = async (username, displayName = 'E2E QA User') => {
    const form = userForm();
    const textInputs = form.locator('input[type="text"]');
    const nText = await textInputs.count();
    if (nText < 2) throw new Error(`expected >=2 text inputs in user form, found ${nText}`);
    const ph0 = (await textInputs.nth(0).getAttribute('placeholder')) || '';
    if (!/somchai\.k/i.test(ph0)) throw new Error(`username input mapping drifted (placeholder="${ph0}")`);
    await textInputs.nth(0).fill(username); // Username
    await textInputs.nth(1).fill(displayName); // Display Name
    await form.locator('input[type="email"]').fill(`${username}@kbjcapital.co.th`);
    await form.locator('input[type="password"]').fill(PASSWORD);
    return 4;
  };
  const userSubmit = () => userForm().getByRole('button', { name: /create account|save|สร้าง/i }).last();
  // \b-anchored English words do the discrimination ("Reactivate" must NOT
  // satisfy the deactivate matcher and vice versa). Thai trap avoided: the
  // landed labels are bilingual ("ปิดใช้งาน / Deactivate", "เปิดใช้งาน /
  // Reactivate") and 'ปิดใช้งาน' is a SUBSTRING of 'เปิดใช้งาน' — so only the
  // unambiguous Thai terms are kept alongside the English halves.
  const DEACTIVATE_RX = /\b(deactivate|disable)\b|ระงับ/i;
  const REACTIVATE_RX = /\b(reactivate|re-enable|activate|enable)\b|คืนสถานะ/i;

  await step('E0', 'Admin login; nav exposes intranet + CMS + external only', async () => {
    // APPROVED CHANGE (#22/#23): Architecture + K8s views are REMOVED for all
    // roles including admin. E2/E3 (architecture / k8s view walkthroughs) were
    // deleted along with the views themselves.
    await login(page, 'admin', ADMIN_PASSWORD);
    for (const [id, label] of [['#nav-intranet', 'intranet'], ['#nav-cms', 'admin-cms'], ['#nav-external', 'external-web']]) {
      const el = page.locator(id);
      if (!(await el.count())) throw new Error(`${id} missing for admin`);
      await click(el);
      await page.waitForTimeout(600);
    }
    const gone = [];
    if (await page.locator('#nav-architecture').count()) gone.push('#nav-architecture');
    if (await page.locator('#nav-k8s').count()) gone.push('#nav-k8s');
    if (gone.length) throw new Error(`approved-removal not effective, still visible: ${gone.join(', ')}`);
    await shot(page, 'e-admin-nav');
    return 'intranet + CMS + external reachable; Architecture + K8s nav absent';
  });

  await step('E1', 'External Web Sync view renders and can switch to CMS', async () => {
    await click(page.locator('#nav-external'));
    await page.waitForTimeout(700);
    const body = await page.locator('main').innerText();
    if (!/www\.kbjcapital\.co\.th|Public/i.test(body)) throw new Error('external sync view empty');
    const switchBtn = page.getByRole('button', { name: /CMS|Edit in CMS|manage/i }).first();
    if (await switchBtn.count()) await click(switchBtn);
    await page.waitForTimeout(600);
    await shot(page, 'e-external-sync-view');
    return 'external view rendered; switch-to-CMS control present';
  });

  await step('E2', 'Architecture Blueprint view fully REMOVED for every role (approved change #22/#23)', async () => {
    // v1 walked the architecture view as a feature; it is now removed by
    // approved decision. Admin holds the widest nav, so verify absence here.
    await click(page.locator('#nav-intranet'));
    await page.waitForTimeout(600);
    const navArch = await page.locator('#nav-architecture').count();
    const labels = await page.locator('header, footer, main').filter({ hasText: /BA\/SA Blueprint|BA\/SA Report|Architecture Blueprint|สถาปัตยกรรม/i }).count();
    await shot(page, 'e-architecture-removed');
    if (navArch) throw new Error('#nav-architecture still present for admin');
    if (labels) throw new Error('blueprint labels (BA/SA Blueprint|Report, Architecture Blueprint) still in DOM');
    return 'no nav entry; BA/SA Blueprint|Report + Architecture Blueprint labels absent from DOM';
  });

  await step('E3', 'K8s DevOps view fully REMOVED for every role (approved change #22/#23)', async () => {
    const navK8s = await page.locator('#nav-k8s').count();
    const labels = await page.locator('header, footer, main').filter({ hasText: /K8s DevOps|K8s Dashboard|Kubernetes/i }).count();
    await shot(page, 'e-k8s-removed');
    if (navK8s) throw new Error('#nav-k8s still present for admin');
    if (labels) throw new Error('K8s DevOps/Dashboard/Kubernetes labels still in DOM');
    return 'no nav entry; K8s DevOps labels absent from DOM';
  });

  await step('E4', 'User Management tab (admin): list + create user + duplicate 409 inline (fix #19)', async () => {
    // APPROVED CHANGE (#19): the CMS now HAS a user-management tab — drive the
    // full dogfood: list, create through the form, duplicate-username error.
    await openCms(page);
    const tab = page.getByRole('button', { name: /User Management|จัดการผู้ใช้|ผู้ใช้งาน/i }).first();
    await tab.waitFor({ state: 'visible', timeout: 5000 });
    await click(tab);
    await page.waitForTimeout(700);
    const tableLoaded = await until(() => main.innerText().then((t) => t.includes('maker01')), true, 9000);
    if (!tableLoaded) throw new Error('users table did not load (maker01 not listed)');
    const txt0 = await main.innerText();
    if (!/\badmin\b/i.test(txt0)) throw new Error('admin account not listed in users table');
    await openUserFormUI(); // form panel is hidden until "Create User Account" is clicked
    const filled = await fillUserForm('e2eqa01');
    if (filled < 4) throw new Error(`create-user form fields not filled (filled=${filled})`);
    const roleSelect = userForm().locator('select').first();
    if (await roleSelect.count()) await roleSelect.selectOption('staff').catch(() => { /* option values may differ */ });
    await click(userSubmit());
    const listed = await until(() => main.innerText().then((t) => t.includes('e2eqa01')), true, 9000);
    await shot(page, 'e-user-created');
    if (!listed) throw new Error('new user e2eqa01 not listed after create');
    // duplicate username -> server 409 must surface inline (form closes on
    // success, so reopen it; handleSaveUser renders the error INSIDE the form)
    await openUserFormUI();
    await fillUserForm('e2eqa01');
    await click(userSubmit());
    let errShown = false;
    try {
      await userForm().locator('[role="alert"]').first().waitFor({ state: 'visible', timeout: 6000 });
      errShown = true;
    } catch {
      const t = await main.innerText();
      errShown = /already exist|409|ซ้ำ|มีผู้ใช้นี้|duplicate/i.test(t);
    }
    await shot(page, 'e-user-duplicate-409');
    if (!errShown) throw new Error('duplicate username did not surface an inline error');
    return 'users table lists admin + role users; e2eqa01 created through the form; duplicate 409 shown inline';
  }, { page });

  await step('E4b', 'User Management: deactivate kills login server-side; reactivate restores (fix #29/#30)', async () => {
    await click(page.getByRole('button', { name: /User Management|จัดการผู้ใช้|ผู้ใช้งาน/i }).first());
    await page.waitForTimeout(500);
    await openUserFormUI(); // no-op if E4 left the (errored) form open
    const filled = await fillUserForm('e2edeact01', 'E2E Deactivate Probe');
    if (filled < 4) throw new Error(`create-user form fields not filled (filled=${filled})`);
    await click(userSubmit());
    const created = await until(() => main.innerText().then((t) => t.includes('e2edeact01')), true, 9000);
    if (!created) throw new Error('throwaway user e2edeact01 not created');
    const row = () => page.locator('tr').filter({ hasText: 'e2edeact01' }).first();
    await row().waitFor({ state: 'visible', timeout: 5000 });
    // deactivate via the row control
    const deactivate = row().locator('button').filter({ hasText: DEACTIVATE_RX }).first();
    await deactivate.waitFor({ state: 'visible', timeout: 5000 });
    await click(deactivate);
    const confirmed = await confirmOverlay(page);
    const flippedOff = await until(
      () => row().locator('button').filter({ hasText: REACTIVATE_RX }).count().then((c) => c > 0),
      true, 8000,
    );
    await shot(page, 'e-user-deactivated');
    if (!flippedOff) throw new Error('row did not flip to a reactivate control after deactivation');
    // server-side kill: the CORRECT password must now be rejected with 401
    const dead = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'e2edeact01', password: PASSWORD }),
    });
    if (dead.status !== 401) throw new Error(`deactivated user login expected 401, got HTTP ${dead.status}`);
    // reactivate and verify the account works again
    const reactivate = row().locator('button').filter({ hasText: REACTIVATE_RX }).first();
    await click(reactivate);
    await confirmOverlay(page);
    const flippedOn = await until(
      () => row().locator('button').filter({ hasText: DEACTIVATE_RX }).count().then((c) => c > 0),
      true, 8000,
    );
    await shot(page, 'e-user-reactivated');
    if (!flippedOn) throw new Error('row did not flip back to a deactivate control after reactivation');
    const alive = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'e2edeact01', password: PASSWORD }),
    });
    if (alive.status !== 200) throw new Error(`reactivated user login expected 200, got HTTP ${alive.status}`);
    return `e2edeact01 created; deactivated${confirmed ? ' (confirm accepted)' : ''}; login -> 401; reactivated; login -> 200. NOTE: user deletion does not exist by design — throwaway users (e2eqa01, e2edeact01) remain in the QA users table`;
  }, { page, needs: ['E4'], retry: false });

  await step('E5', 'DELETE with confirmation works on a disposable item', async () => {
    await click(page.getByRole('button', { name: /News & Alerts tab/i }).first());
    const row = page.locator(`tr:has-text("${NEWS_TITLE_2}")`).first();
    await click(row.locator('button[aria-label^="ลบประกาศ:"]').first());
    await page.locator('text=ลบประกาศ / Delete announcement').first().waitFor({ state: 'visible', timeout: 4000 });
    await shot(page, 'e-delete-confirm-dialog');
    await click(page.getByRole('button', { name: /^ลบ \/ Delete$/i }).first());
    await page.waitForTimeout(1500);
    const gone = await page.locator(`tr:has-text("${NEWS_TITLE_2}")`).count();
    if (gone) throw new Error('item still listed after confirmed delete');
    return 'confirm dialog shown; item removed after Delete';
  }, { page, needs: ['D2'] });

  await step('E6', 'Force sync trigger runs and reports', async () => {
    await click(page.getByRole('button', { name: /Sync All to Public Web/i }).first());
    await page.waitForTimeout(1800);
    const toast = await page.locator('text=/sync|Handshake|ซิงก์/i').count();
    await shot(page, 'e-force-sync');
    if (!toast) throw new Error('no sync feedback toast');
    return 'sync executed with toast feedback';
  });

  await step('E7', 'JSON export button downloads a file', async () => {
    const dlPromise = page.waitForEvent('download', { timeout: 8000 });
    await click(page.getByRole('button', { name: /Export DB Migration Dump/i }).first());
    const dl = await dlPromise;
    const name = dl.suggestedFilename();
    await shot(page, 'e-export-clicked');
    if (!/\.json$/i.test(name)) throw new Error(`unexpected export filename: ${name}`);
    return `downloaded: ${name}`;
  });

  await step('E8', 'OpenAPI spec link is reachable (HTTP 200 JSON)', async () => {
    const res = await page.request.get(`${BASE}/api/openapi.json`);
    if (res.status() !== 200) throw new Error(`HTTP ${res.status()}`);
    const json = await res.json();
    if (!json.paths || !json.paths['/api/auth/login']) throw new Error('openapi.json missing /api/auth/login path');
    return `openapi.json OK (${Object.keys(json.paths).length} paths)`;
  });

  await step('E-API', 'API guard: malformed JSON gets a clean 400 envelope (fix #20)', async () => {
    const cookie = await apiLogin('admin', ADMIN_PASSWORD);
    const res = await fetch(`${BASE}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: '{not valid json',
    });
    if (res.status !== 400) throw new Error(`expected 400, got HTTP ${res.status}`);
    const body = await res.json(); // throws -> FAIL if the error response is not JSON
    if (body.success !== false) throw new Error(`no success:false envelope (${JSON.stringify(body).slice(0, 120)})`);
    return `HTTP 400 JSON envelope: ${body.error || '(error field present)'}`;
  });

  await step('E-API2', 'API guard: dead /api/k8s/diagnostics endpoint removed (fix #27)', async () => {
    const res = await fetch(`${BASE}/api/k8s/diagnostics`);
    const ct = res.headers.get('content-type') || '';
    if (res.status !== 404) throw new Error(`expected 404, got HTTP ${res.status}`);
    if (ct.includes('text/html')) throw new Error(`SPA fallback served for removed API route (content-type ${ct})`);
    return `GET /api/k8s/diagnostics -> 404, no SPA HTML fallback (${ct || 'no content-type'})`;
  });

  await step('E9', 'Sync Logs tab (admin) lists history', async () => {
    await click(page.getByRole('button', { name: /Public Sync Logs tab/i }).first());
    await page.waitForTimeout(700);
    const rows = await page.locator('main').innerText();
    if (!/SUCCESS|sync|target/i.test(rows)) throw new Error('sync log listing empty');
    await shot(page, 'e-sync-logs');
    return 'sync log entries listed';
  });

  await step('E10', 'Admin logout', async () => {
    const ok = await logout(page);
    if (!ok) throw new Error('logout failed');
    return 'logged out';
  });

  await ctx.close();
}

// ============================================================================
// SECTION F — CROSS-CUTTING
// ============================================================================
currentSection = 'F-crosscutting';
{
  const ctx = await newSectionCtx(browser, { width: 375, height: 812 }); // mobile
  const page = await ctx.newPage();
  trackContext(page, 'F-mobile-375');

  await step('F1', 'Responsive 375px: staff home has no horizontal overflow', async () => {
    await login(page, 'staff01');
    await page.waitForTimeout(1000);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await shot(page, 'f-mobile-home-375');
    if (overflow > 2) throw new Error(`horizontal overflow: ${overflow}px`);
    return `no horizontal overflow (delta=${overflow}px)`;
  });

  await step('F2', 'Responsive 375px: CMS via nav; no overflow (maker)', async () => {
    // The mobile header exposes no sign-out control (icon-only bar), so switch
    // identity by clearing cookies — F2's subject is the CMS layout at 375px,
    // not mobile logout (B17 covers logout on desktop).
    await ctx.clearCookies();
    await login(page, 'maker01');
    await page.waitForTimeout(600);
    // #nav-cms lives in a hidden-lg nav — at 375px the mobile switcher chip is the entry
    await click(page.getByRole('button', { name: /Self-Service CMS/i }).first());
    await page.locator('text=System Dashboard').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await shot(page, 'f-mobile-cms-375');
    if (overflow > 2) throw new Error(`CMS horizontal overflow: ${overflow}px`);
    return `CMS at 375px OK (delta=${overflow}px)`;
  }, { page });

  await ctx.close();
}

// ============================================================================
// SECTION F — button inventory sweep (authenticated staff home, desktop)
// ============================================================================
currentSection = 'F-buttons';
{
  const ctx = await newSectionCtx(browser);
  const page = await ctx.newPage();
  trackContext(page, 'F-buttons');
  await step('F3', 'Button inventory sweep on intranet home (staff)', async () => {
    await login(page, 'staff01');
    await page.waitForTimeout(800);
    // Safe = in-page navigation/scroll/modal controls. Unsafe = opens external window, submits forms.
    const res = await clickAllSafeButtons(page, 'intranet-home/staff', {
      safe: (text) => {
        if (/^1258$/.test(text)) return 'tel: link';
        if (/เข้าสู่ระบบ \/ Sign in|Sign out/i.test(text)) return 'auth action';
        return true;
      },
    });
    await settle(page);
    // approved removal: BA/SA links must not be clickable anywhere on staff home
    const basa = await page.locator('button:visible, a:visible').filter({ hasText: /BA\/SA (Blueprint|Report)/i }).count();
    await shot(page, 'f-button-sweep-after');
    if (basa) throw new Error(`BA/SA Blueprint/Report links still present on staff home (${basa})`);
    return `visible buttons=${res.total}, clicked=${res.clicked}, skipped=${res.skipped.length}; BA/SA links=0`;
  }, { page });
  await ctx.close();
}

// ----------------------------- finalize -----------------------------
const pageErrors = consoleIssues.filter((c) => c.type === 'pageerror');
const consoleErrors = consoleIssues.filter((c) => c.type === 'console.error');
const counts = results.reduce((acc, r) => { acc[r.status.toLowerCase()] = (acc[r.status.toLowerCase()] || 0) + 1; return acc; }, {});

fs.writeFileSync(RESULTS_JSON, JSON.stringify({
  base: BASE,
  startedAt: new Date().toISOString(),
  counts,
  results,
  consoleIssues,
  buttonInventory,
}, null, 2));

console.log('\n================ SUMMARY ================');
console.log(`PASS=${counts.pass || 0} FAIL=${counts.fail || 0} FLAKY=${counts.flaky || 0} SKIP=${counts.skipped || 0}`);
console.log(`Uncaught page errors: ${pageErrors.length}`);
for (const e of pageErrors.slice(0, 10)) console.log(`  [pageerror:${e.context}] ${e.text.slice(0, 150)}`);
console.log(`console.error entries: ${consoleErrors.length}`);
for (const e of consoleErrors.slice(0, 15)) console.log(`  [${e.context}] ${e.text.slice(0, 150)}`);
console.log(`Results JSON: ${RESULTS_JSON}`);

await browser.close();
