/**
 * W3-4 worker-4 UAT journey lane — Deliverable 18, codex gate REVISE blocker 2
 * (missing UI journey evidence). NEW FILE: no existing test/script/doc is
 * modified.
 *
 * Three legs, driven in the REAL UI (Playwright, modeled on tests/uat-visuals.mjs
 * which is modeled on tests/e2e-walkthrough.mjs):
 *
 *   J1 — ATTACHMENT SURVIVES THE DRAFT/EDIT/SUBMIT JOURNEY
 *        maker01: CMS -> + New Post -> upload PNG through the form file input
 *        -> #news-image-url carries a /uploads/ URL -> fill ALL required fields
 *        -> save (every save is draft-until-approved, DCR-9) -> REOPEN the item
 *        in the editor -> the image URL field STILL carries the SAME /uploads/
 *        URL (the core CTO assertion) -> API round-trip (imageUrl) -> edit
 *        content -> save -> submit for approval -> row chip รอการอนุมัติ and
 *        API externalSyncStatus=pending_approval with imageUrl still present.
 *
 *   J2 — THAI-REASON REJECT -> RESUBMIT -> APPROVE CYCLE IN THE REAL UI
 *        checker01: reject button disabled while the reason is empty -> type the
 *        THAI reason -> reject -> chip ถูกปฏิเสธ. maker01: reopen the rejected
 *        item (image URL still present), edit + save (forced draft reset),
 *        resubmit. checker01: approve -> chip เผยแพร่แล้ว. Audit Trail tab
 *        shows BOTH the REJECT and APPROVE entries with correct actors.
 *
 *   J3 — NO-UNEXPECTED-TOAST SWEEP (folded into every success action of J1/J2)
 *        after each success action: visible [role="alert"]/[role="status"]
 *        count must be 0 (the app's error-surfacing pattern, cf. walkthrough
 *        C-FR). The app toast (div.fixed.bottom-5.right-5, no role attribute)
 *        is sampled separately and classified by its border class — benign
 *        success toasts are reported, never failed on; error-kind toasts fail.
 *
 * Output:
 *   Screenshots: .omc/reports/screenshots/run-<YYYY-MM-DDTHHMM>Z-uat2/*.png
 *   (own run dir + MANIFEST.sha256, shasum -a 256 format; suffix -uat2
 *    distinguishes this lane's capture set from -e2e and -uat runs)
 *   Results JSON: .omc/reports/w3-4-uat/journey-results.json
 *
 * Env contract: E2E_BASE (default http://127.0.0.1:3224 — disposable server,
 * host port 3000 untouched), E2E_ROLE_PASSWORD (default E2E-Test@2026 —
 * walkthrough-provisioned role users), E2E_ADMIN_PASSWORD (S0 bootstrap admin,
 * passed via the lane env, never logged).
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
  return `run-${t.slice(0, 10)}T${t.slice(11, 13)}${t.slice(14, 16)}Z-uat2`;
})();
const SHOT_DIR = path.join(ROOT, '.omc', 'reports', 'screenshots', RUN_ID);
const RESULTS_JSON = process.env.W34_JOURNEY_RESULTS || path.join(ROOT, '.omc', 'reports', 'w3-4-uat', 'journey-results.json');
const BASE = process.env.E2E_BASE || 'http://127.0.0.1:3224';
const PASSWORD = process.env.E2E_ROLE_PASSWORD || 'E2E-Test@2026';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'E2E-Test@2026';

// Tiny fixture PNG in /tmp (the walkthrough's FIXTURE_PNG approach, lifted out
// of the repo so this lane writes nothing but screenshots): copy the
// walkthrough's tests/fixtures/test-image.png; minimal 1x1 PNG if absent.
const FIXTURE_PNG = '/tmp/kbj-w34-uat2-journey-fixture.png';
{
  const repoFixture = path.join(__dirname, 'fixtures', 'test-image.png');
  if (fs.existsSync(repoFixture)) fs.copyFileSync(repoFixture, FIXTURE_PNG);
  else fs.writeFileSync(FIXTURE_PNG, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));
}

fs.mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
const failures = [];
const toastSweeps = []; // J3 ledger: { label, errorSurfaced, toast }
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
/** Click with one retry (walkthrough idiom: fast failures, never 30s hangs). */
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
/**
 * J3 sweep — run right after each SUCCESS action. Asserts zero visible
 * [role="alert"]/[role="status"] (the app's error-surfacing pattern, cf.
 * walkthrough C-FR). The App toast carries no role attribute; it is sampled
 * separately and classified by border class (border-red-300 = error,
 * border-orange-200 = success). Success toasts are reported, not failed on.
 */
async function sweep(page, label) {
  await sleep(700); // inside the 3800ms toast lifetime; let any surfacing render
  const errorSurfaced = await page.locator('[role="alert"]:visible, [role="status"]:visible').count();
  let toastNote = '';
  const toast = page.locator('div.fixed.bottom-5.right-5:visible').first();
  if (await toast.count()) {
    const cls = (await toast.getAttribute('class').catch(() => '')) || '';
    const text = (await toast.innerText().catch(() => '')).split('\n')[0].slice(0, 90);
    const kind = cls.includes('border-red-300') ? 'error' : 'success';
    toastNote = `; ${kind}Toast="${text}"`;
    if (kind === 'error') throw new Error(`error-kind toast after ${label}: "${text}"`);
  }
  toastSweeps.push({ label, errorSurfaced, toast: toastNote.slice(2) });
  if (errorSurfaced !== 0) throw new Error(`unexpected error surfacing after ${label}: ${errorSurfaced} visible [role=alert]/[role=status]`);
  return `noToastAfter=${label}:${errorSurfaced}${toastNote}`;
}
async function login(page, username, password = PASSWORD) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('#login-username').waitFor({ state: 'visible', timeout: 15000 });
  await page.fill('#login-username', username);
  await page.fill('#login-password', password);
  await click(page.getByRole('button', { name: /เข้าสู่ระบบ \/ Sign in/i }));
  await page.locator('#login-username').waitFor({ state: 'hidden', timeout: 15000 });
}
async function openCmsNews(page) {
  await click(page.locator('#nav-cms'));
  await page.locator('text=System Dashboard').waitFor({ state: 'visible', timeout: 10000 });
  await click(page.getByRole('button', { name: /News & Alerts tab/i }).first());
  await page.waitForTimeout(600);
}
/** Fetch the exact news item via the list endpoint (no per-id GET route exists). */
async function fetchItem(cookie, title) {
  const r = await api(cookie, 'GET', `/api/news?search=${encodeURIComponent(title)}`);
  const list = Array.isArray(r.body?.data) ? r.body.data : [];
  return list.find((n) => n.title === title) || null;
}

const TS = Date.now() % 100000;
const J1_TITLE = `W34UAT2-J1 ไฟล์แนบคงอยู่ตลอดการแก้ไข ${TS}`;
const TITLE_KEY = J1_TITLE.slice(0, 12); // unique prefix, survives audit details' 30-char truncation
const THAI_REASON = 'ทบทวนถ้อยคำภาษาไทยอีกครั้งก่อนเผยแพร่';
const UPLOADS_RX = /^\/uploads\/.+\.(png|jpg|jpeg|webp|gif)$/i;

const browser = await chromium.launch();
let j1Ok = false;
let j2aOk = false; // checker Thai-reason reject
let j2bOk = false; // maker reopen/edit/resubmit
let j2cOk = false; // checker approve + audit trail
let uploadedUrl = ''; // the ONE /uploads/ URL the whole journey must preserve

try {
  // ---------- S0 (API prep): replicate walkthrough bootstrap exactly ----------
  {
    const cookie = await apiLogin('admin', ADMIN_PASSWORD);
    const wanted = [
      { username: 'maker01', password: PASSWORD, displayName: 'E2E Maker', email: 'maker01@kbjcapital.co.th', role: 'maker' },
      { username: 'checker01', password: PASSWORD, displayName: 'E2E Checker', email: 'checker01@kbjcapital.co.th', role: 'checker' },
      { username: 'staff01', password: PASSWORD, displayName: 'E2E Staff', email: 'staff01@kbjcapital.co.th', role: 'staff' },
    ];
    const parts = [];
    for (const u of wanted) {
      const res = await fetch(`${BASE}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify(u),
      });
      parts.push(`${u.username}:${res.status === 201 ? 'created' : res.status === 409 ? 'exists' : `HTTP ${res.status}`}`);
    }
    const bad = parts.filter((o) => !/:created$|:exists$/.test(o));
    if (bad.length) throw new Error(`S0 user provisioning failed: ${bad.join(', ')}`);
    record('S0', 'Bootstrap: admin login + role users provisioned via /api/users (201/409 both pass)', 'PASS', parts.join(', '));
  }

  // ============================ LEG J1 (maker01) ============================
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
      await login(page, 'maker01');
      await openCmsNews(page);
      await shot(page, 'j1-maker-cms-news-tab');

      // -- open the create form and upload a PNG through the form file input --
      await click(page.getByRole('button', { name: /\+ New Post/i }).first());
      await page.locator('text=Create New Announcement').waitFor({ state: 'visible', timeout: 5000 });
      const fileInput = page.locator('input[type="file"][accept*="png"]').first();
      await fileInput.setInputFiles(FIXTURE_PNG);
      const gotUrl = await until(
        () => page.inputValue('#news-image-url').then((v) => UPLOADS_RX.test(v)),
        true, 9000, 400,
      );
      uploadedUrl = await page.inputValue('#news-image-url');
      if (!gotUrl) throw new Error(`upload did not set a /uploads URL (got "${uploadedUrl}")`);
      await page.locator('#news-image-url').scrollIntoViewIfNeeded();
      const shotUpload = await shot(page, 'form-with-uploaded-image');
      record('J1-UPLOAD', 'Form file input upload sets a server /uploads/ URL in #news-image-url', 'PASS',
        `imageUrl="${uploadedUrl}" matches ${UPLOADS_RX}; ${shotUpload}`);

      // -- fill ALL required fields (+ category) and save the draft --
      const newsForm = page.locator('form').filter({ has: page.locator('input[placeholder*="ประกาศมาตรการ"]') });
      await newsForm.locator('input[placeholder*="ประกาศมาตรการ"]').fill(J1_TITLE);
      await newsForm.locator('input[placeholder*="BOT Regulatory"]').fill('W34 UAT2 Journey Attachment Persistence EN');
      await newsForm.locator('textarea[placeholder*="Brief description"]').fill('W34UAT2 J1 summary — attachment must survive draft/edit/submit');
      await newsForm.locator('textarea[placeholder*="Full announcement"]').fill('W34UAT2 J1 full content v1 — ไฟล์แนบต้องคงอยู่ตลอดการเดินทาง');
      const categorySelect = newsForm.locator('select').filter({ has: page.locator('option[value="bot-news"]') }).first();
      await categorySelect.selectOption('bot-news');
      await click(page.getByRole('button', { name: /Save Draft/i }).first()); // create = saves as DRAFT (DCR-9)
      const row = page.locator(`tr:has-text("${J1_TITLE}")`).first();
      const rowShown = await until(() => row.count().then((c) => c > 0), true, 9000);
      if (!rowShown) throw new Error('draft row not found in CMS list after save');
      const draftChip = await until(() => row.locator('text=ร่าง').count().then((c) => c > 0), true, 9000);
      const sweepDraft = await sweep(page, 'save:draft');
      if (!draftChip) throw new Error('draft chip ร่าง not shown on the saved row');
      record('J1-SAVE-DRAFT', 'All required fields filled + category; save enters DRAFT (chip ร่าง)', 'PASS',
        `category=bot-news; chip ร่าง shown; ${sweepDraft}`);

      // -- API round-trip on the created draft --
      const makerCookie = await apiLogin('maker01');
      let item = await fetchItem(makerCookie, J1_TITLE);
      if (!item) throw new Error('created draft not found via API');
      if (item.imageUrl !== uploadedUrl) throw new Error(`API imageUrl mismatch on draft: got "${item.imageUrl}" want "${uploadedUrl}"`);
      record('J1-API-DRAFT', 'GET /api/news (as maker01): draft round-trips the SAME imageUrl', 'PASS',
        `id=${item.id}; imageUrl="${item.imageUrl}"; externalSyncStatus=${item.externalSyncStatus}`);

      // -- reopen THAT item in the editor: the core CTO assertion --
      const editBtn = page.locator(`button[aria-label^="แก้ไขประกาศ: ${J1_TITLE}"]`).first();
      await click(editBtn);
      await page.locator('text=Edit Announcement').waitFor({ state: 'visible', timeout: 5000 });
      const reopenedUrl = await page.inputValue('#news-image-url');
      const sweepReopen = await sweep(page, 'reopen:draft');
      await page.locator('#news-image-url').scrollIntoViewIfNeeded();
      const shotReopen = await shot(page, 'draft-reopened-with-image');
      if (reopenedUrl !== uploadedUrl) throw new Error(`image URL NOT preserved on reopen: got "${reopenedUrl}" want "${uploadedUrl}"`);
      record('J1-REOPEN', 'CORE: reopened draft still carries the SAME /uploads/ URL in the editor', 'PASS',
        `before="${uploadedUrl}" after="${reopenedUrl}" (strict equality); ${shotReopen}; ${sweepReopen}`);

      // -- edit the content and save --
      await page.locator('textarea[placeholder*="Full announcement"]').fill('W34UAT2 J1 full content v2 — แก้ไขรอบสองก่อนส่งอนุมัติ');
      await click(page.getByRole('button', { name: /Save Changes/i }).first());
      const savedChip = await until(() => page.locator(`tr:has-text("${J1_TITLE}")`).first().locator('text=ร่าง').count().then((c) => c > 0), true, 9000);
      const sweepEdit = await sweep(page, 'edit:content');
      if (!savedChip) throw new Error('row did not stay/show draft chip after edit save');
      item = await fetchItem(makerCookie, J1_TITLE);
      if (!item || !String(item.content).includes('v2')) throw new Error('edited content did not round-trip via API');
      if (item.imageUrl !== uploadedUrl) throw new Error(`API imageUrl mismatch after edit: got "${item.imageUrl}"`);
      record('J1-EDIT', 'Content edited + saved; draft state and imageUrl both survive the edit', 'PASS',
        `content v2 round-tripped; externalSyncStatus=${item.externalSyncStatus}; imageUrl="${item.imageUrl}"; ${sweepEdit}`);

      // -- submit for approval --
      const submitBtn = page.locator(`tr:has-text("${J1_TITLE}")`).first().locator('button').filter({ hasText: /\+ Request Approval/i }).first();
      await click(submitBtn);
      const pendingChip = await until(() => page.locator(`tr:has-text("${J1_TITLE}")`).first().locator('text=รอการอนุมัติ').count().then((c) => c > 0), true, 9000);
      const sweepSubmit = await sweep(page, 'submit:approval');
      await page.locator(`tr:has-text("${J1_TITLE}")`).first().scrollIntoViewIfNeeded();
      const shotPending = await shot(page, 'submitted-pending-row');
      if (!pendingChip) throw new Error('pending chip รอการอนุมัติ not shown after submit');
      item = await fetchItem(makerCookie, J1_TITLE);
      if (item?.externalSyncStatus !== 'pending_approval') throw new Error(`API externalSyncStatus=${item?.externalSyncStatus} want pending_approval`);
      if (item.imageUrl !== uploadedUrl) throw new Error(`API imageUrl lost at submit: got "${item.imageUrl}"`);
      record('J1-SUBMIT', 'Submitted for approval: chip รอการอนุมัติ + API pending_approval + imageUrl intact', 'PASS',
        `chip=รอการอนุมัติ; externalSyncStatus=${item.externalSyncStatus}; imageUrl="${item.imageUrl}"; ${shotPending}; ${sweepSubmit}`);

      j1Ok = true;
      record('J1-LEG', 'LEG J1 verdict: attachment survives the draft/edit/submit journey', 'PASS',
        `same /uploads/ URL at upload, reopen (before+after edit) and submit: "${uploadedUrl}"`);
    } catch (err) {
      record('J1-LEG', 'LEG J1 verdict: attachment survives the draft/edit/submit journey', 'FAIL',
        `leg stopped at first failure — ${String(err.message || err).slice(0, 250)}`);
    } finally { await ctx.close(); }
  }

  // ============================ LEG J2 (checker/maker) ============================
  if (!j1Ok) {
    record('J2-LEG', 'LEG J2 verdict: Thai-reason reject -> resubmit -> approve cycle in the real UI', 'FAIL',
      'blocked: leg J1 did not complete — no pending item to reject (no fix attempted, per lane rules)');
  }

  // -- J2a: checker opens the reject flow and rejects with a THAI reason --
  if (j1Ok) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
      await login(page, 'checker01');
      await openCmsNews(page);
      const row = page.locator(`tr:has-text("${J1_TITLE}")`).first();
      await row.waitFor({ state: 'visible', timeout: 8000 });
      if (!(await row.locator('text=รอการอนุมัติ').count())) throw new Error('J1 item not pending for checker');
      await click(row.getByRole('button', { name: /\/ Reject$/i }).first());
      const reasonInput = page.locator('input[aria-label="เหตุผลการปฏิเสธ / Rejection reason"]').first();
      await reasonInput.waitFor({ state: 'visible', timeout: 4000 });
      const disabledWhenEmpty = await row.locator('button').filter({ hasText: /ปฏิเสธ \/ Reject/i }).first().isDisabled();
      await reasonInput.fill(THAI_REASON);
      await row.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const shotRejectDlg = await shot(page, 'reject-dialog-thai-reason');
      if (!disabledWhenEmpty) throw new Error('reject button was NOT disabled while the reason input was empty');
      await click(row.locator('button').filter({ hasText: /ปฏิเสธ \/ Reject/i }).first());
      const rejectedChip = await until(() => page.locator(`tr:has-text("${J1_TITLE}")`).first().locator('text=ถูกปฏิเสธ').count().then((c) => c > 0), true, 9000);
      const sweepReject = await sweep(page, 'reject:decision');
      await page.locator(`tr:has-text("${J1_TITLE}")`).first().scrollIntoViewIfNeeded();
      const shotRejected = await shot(page, 'rejected-row');
      if (!rejectedChip) throw new Error('chip ถูกปฏิเสธ not shown after reject');
      const checkerCookie = await apiLogin('checker01');
      const item = await fetchItem(checkerCookie, J1_TITLE);
      if (item?.externalSyncStatus !== 'rejected') throw new Error(`API externalSyncStatus=${item?.externalSyncStatus} want rejected`);
      if (item.imageUrl !== uploadedUrl) throw new Error(`API imageUrl lost at reject: got "${item.imageUrl}"`);
      record('J2-REJECT', 'Thai-reason reject: button disabled while empty, THAI reason accepted, chip ถูกปฏิเสธ', 'PASS',
        `disabledWhenEmpty=${disabledWhenEmpty}; reason="${THAI_REASON}"; chip=ถูกปฏิเสธ; externalSyncStatus=${item.externalSyncStatus}; imageUrl="${item.imageUrl}"; ${shotRejectDlg}; ${shotRejected}; ${sweepReject}`);
      j2aOk = true;
    } catch (err) {
      record('J2-REJECT', 'Thai-reason reject: button disabled while empty, THAI reason accepted, chip ถูกปฏิเสธ', 'FAIL', String(err.message || err).slice(0, 250));
    } finally { await ctx.close(); }
  }

  // -- J2b: maker reopens the REJECTED item (image must still be there), edits, resubmits --
  if (j2aOk) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
      await login(page, 'maker01');
      await openCmsNews(page);
      const row = page.locator(`tr:has-text("${J1_TITLE}")`).first();
      await row.waitFor({ state: 'visible', timeout: 8000 });
      if (!(await row.locator('text=ถูกปฏิเสธ').count())) throw new Error('item not in rejected state for maker');
      await click(page.locator(`button[aria-label^="แก้ไขประกาศ: ${J1_TITLE}"]`).first());
      await page.locator('text=Edit Announcement').waitFor({ state: 'visible', timeout: 5000 });
      const reopenedRejectedUrl = await page.inputValue('#news-image-url');
      await page.locator('#news-image-url').scrollIntoViewIfNeeded();
      const shotReopenRejected = await shot(page, 'j2-maker-reopened-rejected-with-image');
      if (reopenedRejectedUrl !== uploadedUrl) throw new Error(`image URL NOT preserved on rejected-reopen: got "${reopenedRejectedUrl}" want "${uploadedUrl}"`);
      record('J2-MAKER-REOPEN', 'Maker reopens the REJECTED item: editor reopens with the SAME /uploads/ image URL', 'PASS',
        `imageUrl="${reopenedRejectedUrl}" (strict equality with upload); ${shotReopenRejected}`);
      // edit content + save -> forced draft reset (PUT on rejected => draft)
      await page.locator('textarea[placeholder*="Full announcement"]').fill('W34UAT2 J2 full content v3 — แก้ไขหลังถูกปฏิเสธ แล้วส่งใหม่');
      await click(page.getByRole('button', { name: /Save Changes/i }).first());
      const draftAgain = await until(() => page.locator(`tr:has-text("${J1_TITLE}")`).first().locator('text=ร่าง').count().then((c) => c > 0), true, 9000);
      const sweepResubmitPrep = await sweep(page, 'edit:content');
      if (!draftAgain) throw new Error('rejected item did not return to draft (chip ร่าง) after edit save');
      // resubmit (draft state -> "+ Request Approval")
      const resubmitBtn = page.locator(`tr:has-text("${J1_TITLE}")`).first()
        .locator('button').filter({ hasText: /Re-submit Review|\+ Request Approval/i }).first();
      await click(resubmitBtn);
      const pendingAgain = await until(() => page.locator(`tr:has-text("${J1_TITLE}")`).first().locator('text=รอการอนุมัติ').count().then((c) => c > 0), true, 9000);
      const sweepResubmit = await sweep(page, 'resubmit:approval');
      await page.locator(`tr:has-text("${J1_TITLE}")`).first().scrollIntoViewIfNeeded();
      const shotResubmitted = await shot(page, 'resubmitted-pending');
      if (!pendingAgain) throw new Error('chip รอการอนุมัติ not shown after resubmit');
      const makerCookie = await apiLogin('maker01');
      const item = await fetchItem(makerCookie, J1_TITLE);
      if (item?.externalSyncStatus !== 'pending_approval') throw new Error(`API externalSyncStatus=${item?.externalSyncStatus} want pending_approval`);
      if (item.imageUrl !== uploadedUrl) throw new Error(`API imageUrl lost at resubmit: got "${item.imageUrl}"`);
      record('J2-RESUBMIT', 'Maker edit (forced draft reset) + resubmit: chip รอการอนุมัติ again, imageUrl intact', 'PASS',
        `rejected->edit->draft(chip ร่าง)->resubmit; externalSyncStatus=${item.externalSyncStatus}; imageUrl="${item.imageUrl}"; ${shotResubmitted}; ${sweepResubmitPrep}; ${sweepResubmit}`);
      j2bOk = true;
    } catch (err) {
      record('J2-RESUBMIT', 'Maker edit (forced draft reset) + resubmit: chip รอการอนุมัติ again, imageUrl intact', 'FAIL', String(err.message || err).slice(0, 250));
    } finally { await ctx.close(); }
  } else if (j1Ok) {
    record('J2-RESUBMIT', 'Maker edit (forced draft reset) + resubmit: chip รอการอนุมัติ again, imageUrl intact', 'FAIL',
      'blocked: J2-REJECT did not complete (no rejected item to reopen)');
  }

  // -- J2c: checker approves; audit trail shows BOTH decisions with actors --
  if (j2bOk) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
      await login(page, 'checker01');
      await openCmsNews(page);
      const row = page.locator(`tr:has-text("${J1_TITLE}")`).first();
      await row.waitFor({ state: 'visible', timeout: 8000 });
      if (!(await row.locator('text=รอการอนุมัติ').count())) throw new Error('resubmitted item not pending for checker');
      await click(row.getByRole('button', { name: /\/ Approve$/i }).first());
      const approvedChip = await until(() => page.locator(`tr:has-text("${J1_TITLE}")`).first().locator('text=เผยแพร่แล้ว').count().then((c) => c > 0), true, 9000);
      const sweepApprove = await sweep(page, 'approve:decision');
      await page.locator(`tr:has-text("${J1_TITLE}")`).first().scrollIntoViewIfNeeded();
      const shotApproved = await shot(page, 'approved-synced');
      if (!approvedChip) throw new Error('chip เผยแพร่แล้ว not shown after approve');
      const checkerCookie = await apiLogin('checker01');
      const item = await fetchItem(checkerCookie, J1_TITLE);
      if (item?.externalSyncStatus !== 'synced') throw new Error(`API externalSyncStatus=${item?.externalSyncStatus} want synced`);
      if (item.imageUrl !== uploadedUrl) throw new Error(`API imageUrl lost at approve: got "${item.imageUrl}"`);
      if (item.approvedBy !== 'checker01') throw new Error(`API approvedBy=${item.approvedBy} want checker01`);
      record('J2-APPROVE', 'Checker approves: chip เผยแพร่แล้ว, externalSyncStatus=synced, approvedBy=checker01, imageUrl intact', 'PASS',
        `chip=เผยแพร่แล้ว; externalSyncStatus=${item.externalSyncStatus}; approvedBy=${item.approvedBy}; imageUrl="${item.imageUrl}"; ${shotApproved}; ${sweepApprove}`);

      // Audit Trail: BOTH the REJECT and APPROVE entries with correct actors
      await click(page.getByRole('button', { name: /Audit Trail tab|BOT \/ PDPA Audit Trail/i }).first());
      await page.waitForTimeout(800);
      const auditTable = page.locator('table').filter({ has: page.locator('th', { hasText: 'Actor & Role' }) }).first();
      await auditTable.waitFor({ state: 'visible', timeout: 8000 });
      const rejectRow = auditTable.locator('tr').filter({ hasText: /REJECT/ }).filter({ hasText: 'checker01' }).filter({ hasText: TITLE_KEY }).first();
      const approveRow = auditTable.locator('tr').filter({ hasText: /APPROVE/ }).filter({ hasText: 'checker01' }).filter({ hasText: TITLE_KEY }).first();
      const submitRow = auditTable.locator('tr').filter({ hasText: /SUBMIT_APPROVAL/ }).filter({ hasText: 'maker01' }).filter({ hasText: TITLE_KEY }).first();
      const rejectRowText = (await rejectRow.count()) ? ((await rejectRow.innerText()).replace(/\s+/g, ' ')).slice(0, 200) : '(not found)';
      const approveRowText = (await approveRow.count()) ? ((await approveRow.innerText()).replace(/\s+/g, ' ')).slice(0, 200) : '(not found)';
      const hasThaiReasonInAudit = (await rejectRow.count()) ? (await rejectRow.innerText()).includes(THAI_REASON) : false;
      await auditTable.scrollIntoViewIfNeeded();
      const shotAudit = await shot(page, 'audit-both-decisions');
      if (!(await rejectRow.count())) throw new Error(`audit REJECT entry (checker01 + "${TITLE_KEY}") not found`);
      if (!(await approveRow.count())) throw new Error(`audit APPROVE entry (checker01 + "${TITLE_KEY}") not found`);
      record('J2-AUDIT', 'Audit Trail shows BOTH decisions with correct actors (REJECT + APPROVE by checker01)', 'PASS',
        `REJECT row: ${rejectRowText}; APPROVE row: ${approveRowText}; thaiReasonInRejectEntry=${hasThaiReasonInAudit}; submitEntryWithMaker01=${(await submitRow.count()) > 0}; ${shotAudit}`);
      j2cOk = true;
    } catch (err) {
      record('J2-APPROVE', 'Checker approves + Audit Trail shows BOTH decisions with correct actors', 'FAIL', String(err.message || err).slice(0, 250));
    } finally { await ctx.close(); }
  } else if (j1Ok) {
    record('J2-APPROVE', 'Checker approves + Audit Trail shows BOTH decisions with correct actors', 'FAIL',
      'blocked: J2-RESUBMIT did not complete (no pending item to approve)');
  }

  if (j1Ok) {
    const j2Ok = j2aOk && j2bOk && j2cOk;
    record('J2-LEG', 'LEG J2 verdict: Thai-reason reject -> resubmit -> approve cycle in the real UI', j2Ok ? 'PASS' : 'FAIL',
      j2Ok ? `reject(${j2aOk}) resubmit(${j2bOk}) approve+audit(${j2cOk}); image URL "${uploadedUrl}" survived every hop` : `reject=${j2aOk} resubmit=${j2bOk} approveAudit=${j2cOk}`);
  }
} finally {
  await browser.close();
}

// ---- J3 verdict: aggregate sweep ledger ----
{
  const totalSweeps = toastSweeps.length;
  const errorTotal = toastSweeps.reduce((a, s) => a + s.errorSurfaced, 0);
  const successToasts = toastSweeps.filter((s) => /^successToast=/.test(s.toast));
  record('J3-SWEEP', 'LEG J3 verdict: no-unexpected-toast sweep across all J1/J2 success actions', errorTotal === 0 && totalSweeps >= 7 ? 'PASS' : 'FAIL',
    `sweeps=${totalSweeps} (need >=7); summedErrorSurfacing=${errorTotal}; successToast observations=${successToasts.length}${successToasts.length ? `: ${successToasts.map((s) => `${s.label} ${s.toast}`).join(' | ')}` : ''}`);
}

// ---- finalize: results JSON + per-run MANIFEST.sha256 (same format as e2e harness) ----
fs.writeFileSync(RESULTS_JSON, JSON.stringify({
  runId: RUN_ID, startedAt: RUN_STARTED_AT.toISOString(), finalizedAt: new Date().toISOString(),
  counts: {
    pass: results.filter((r) => r.status === 'PASS').length,
    fail: results.filter((r) => r.status !== 'PASS').length,
  },
  legs: { J1: j1Ok ? 'PASS' : 'FAIL', J2: j2aOk && j2bOk && j2cOk ? 'PASS' : 'FAIL' },
  toastSweeps,
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
console.log(`Journey run dir: ${SHOT_DIR} — ${manifestFiles.length} files, MANIFEST.sha256 written`);
console.log(`SUMMARY PASS=${results.filter((r) => r.status === 'PASS').length} FAIL=${failures.length} J1=${j1Ok ? 'PASS' : 'FAIL'} J2=${j2aOk && j2bOk && j2cOk ? 'PASS' : 'FAIL'}`);
process.exit(failures.length ? 1 : 0);
