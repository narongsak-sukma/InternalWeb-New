#!/usr/bin/env node
/**
 * KBJ Intranet Portal - zero-dependency end-to-end smoke test suite.
 *
 * Contract under test: .omc/handoffs/team-plan.md (FROZEN)
 *   - Auth API contract (POST /api/auth/login|logout, GET /api/auth/me,
 *     GET/POST /api/users, POST /api/upload)
 *   - RBAC matrix (anon / staff / maker / checker / admin)
 *   - Env contract (SESSION_SECRET required in production, no DATABASE_URL =>
 *     in-memory mode, UPLOAD_DIR, bootstrap admin)
 *
 * What it does:
 *   1. Spawns the built server (`node dist/server.cjs`; falls back to tsx if
 *      dist/ is absent) with a scrubbed environment - NODE_ENV=production,
 *      SESSION_SECRET set, DATABASE_URL removed (in-memory mode),
 *      UPLOAD_DIR=./uploads-test, bootstrap admin admin/TestAdmin@2026.
 *   2. Waits for GET /healthz to answer.
 *   3. Runs the full RBAC matrix, auth lifecycle, maker-checker flow,
 *      audit-actor integrity, upload whitelist/size limits, and the
 *      login rate limit (run last: it exhausts the per-IP budget).
 *   4. Prints one PASS/FAIL line per check, writes
 *      .omc/reports/smoke-report.md, exits 1 on any FAIL, 2 on boot failure.
 *
 * Usage:
 *   node scripts/smoke-test.mjs            # builds must exist (npm run build)
 *   SMOKE_PORT=4321 node scripts/smoke-test.mjs
 *   SMOKE_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/kbj_smoke \
 *     node scripts/smoke-test.mjs
 *     → opt-in: additionally runs section 15 against a SECOND server spawned
 *       in PostgreSQL mode. Use a DISPOSABLE database (the server applies
 *       schema DDL + demo seed): proves the shared login-budget store
 *       (rate_limit_hits) counts across processes, that the table is the
 *       authoritative budget, and the fail-open WARNING path. Requires the
 *       repo `pg` dependency (present in production installs); the default
 *       run stays zero-dependency.
 *
 * Requires Node >= 18.14 (global fetch, FormData, Blob, Headers.getSetCookie).
 * No npm dependencies.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, '.omc', 'reports', 'smoke-report.md');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = Number(process.env.SMOKE_PORT || 3210);
const BASE = `http://127.0.0.1:${PORT}`;
const SESSION_COOKIE = 'kbj_session';
const SESSION_SECRET = 'test-secret-32-chars-minimum-ok';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'TestAdmin@2026';

const MAKER = { username: 'smokemaker', password: 'Smoke@2026!', displayName: 'Smoke Maker', email: 'smokemaker@smoke.local', role: 'maker' };
const CHECKER = { username: 'smokechecker', password: 'Smoke@2026!', displayName: 'Smoke Checker', email: 'smokechecker@smoke.local', role: 'checker' };
const STAFF = { username: 'smokestaff', password: 'Smoke@2026!', displayName: 'Smoke Staff', email: 'smokestaff@smoke.local', role: 'staff' };

// 1x1 transparent PNG
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const TINY_PDF = Buffer.from('%PDF-1.4\n% smoke test document\n1 0 obj\nendobj\ntrailer\n<<>>\n%%EOF\n', 'utf8');
const OVERSIZE_BYTES = 11 * 1024 * 1024 + 1024; // 11MB+1KB - must exceed the 10MB D4 limit

const VERBOSE = Boolean(process.env.SMOKE_VERBOSE);

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------

const results = [];
let currentSection = '';

function section(name) {
  currentSection = name;
  console.log(`\n--- ${name} ---`);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function check(name, fn) {
  let pass = true;
  let detail = '';
  const started = Date.now();
  try {
    detail = (await fn()) || '';
  } catch (err) {
    pass = false;
    detail = err && err.message ? err.message : String(err);
  }
  const ms = Date.now() - started;
  results.push({ section: currentSection, name, pass, detail, ms });
  const suffix = detail ? (pass ? `  (${detail})` : `  -> ${detail}`) : '';
  console.log(`${pass ? '[PASS]' : '[FAIL]'} ${name}${suffix}`);
  return pass;
}

// ---------------------------------------------------------------------------
// HTTP helpers (manual cookie handling - no dependencies)
// ---------------------------------------------------------------------------

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function bodySnippet(r) {
  const snippet = r.text ? r.text.slice(0, 200).replace(/\s+/g, ' ') : '(empty body)';
  return snippet;
}

async function req(method, pathname, opts = {}) {
  const { json, form, cookie, timeoutMs = 20000 } = opts;
  const headers = {};
  if (cookie) headers.cookie = cookie;
  let body;
  if (json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form !== undefined) {
    body = form; // FormData: fetch sets the multipart content-type
  }
  const res = await fetch(BASE + pathname, {
    method,
    headers,
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  const setCookies =
    typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  return { status: res.status, headers: res.headers, text, json: safeJson(text), setCookies };
}

async function fetchBinary(pathname, opts = {}) {
  const headers = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  const res = await fetch(BASE + pathname, {
    headers,
    signal: AbortSignal.timeout(20000),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, buf };
}

/** Extract the kbj_session cookie value from raw Set-Cookie headers. */
function extractSessionCookie(setCookies) {
  for (const raw of setCookies) {
    const pair = raw.split(';')[0];
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    if (pair.slice(0, eq).trim() === SESSION_COOKIE) {
      const value = pair.slice(eq + 1).trim();
      if (value) return { value, raw };
    }
  }
  return null;
}

async function login(username, password) {
  const r = await req('POST', '/api/auth/login', { json: { username, password } });
  const session = extractSessionCookie(r.setCookies);
  return {
    status: r.status,
    json: r.json,
    text: r.text,
    setCookies: r.setCookies,
    rawSetCookie: session ? session.raw : null,
    cookie: session ? `${SESSION_COOKIE}=${session.value}` : null,
  };
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

let child = null;
let serverMode = '';
const serverLogLines = [];

function pushLog(line) {
  serverLogLines.push(line);
  if (serverLogLines.length > 500) serverLogLines.shift();
  if (VERBOSE) process.stdout.write(`[server] ${line}\n`);
}

function buildChildEnv(overrides = {}) {
  // Scrubbed copy of the current env: force in-memory mode (no DATABASE_URL,
  // no stray PG* vars) and pin the frozen env contract values. Overrides let
  // the opt-in PG section (15) re-add DATABASE_URL + its own port.
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (/^(DATABASE_URL|PGHOST|PGPORT|PGUSER|PGPASSWORD|PGDATABASE|PGSSLMODE|PGSSLROOTCERT)$/.test(key)) {
      delete env[key];
    }
  }
  env.NODE_ENV = 'production';
  env.SESSION_SECRET = SESSION_SECRET;
  env.UPLOAD_DIR = './uploads-test';
  env.ADMIN_USERNAME = ADMIN_USERNAME;
  env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  env.PORT = String(PORT);
  env.HOST = '127.0.0.1';
  return { ...env, ...overrides };
}

function serverCommand() {
  // Opt-in override for QA debugging: SMOKE_SERVER_CMD is a space-separated
  // command line (paths must not contain spaces). Default behavior unchanged.
  if (process.env.SMOKE_SERVER_CMD) {
    const parts = process.env.SMOKE_SERVER_CMD.trim().split(/\s+/);
    const cmd = /^node(\.exe)?$/i.test(parts[0]) ? process.execPath : parts[0];
    return { cmd, args: parts.slice(1), mode: `override: ${process.env.SMOKE_SERVER_CMD}` };
  }
  const distServer = path.join(ROOT, 'dist', 'server.cjs');
  if (fs.existsSync(distServer)) {
    return { cmd: process.execPath, args: [distServer], mode: 'dist/server.cjs' };
  }
  const tsxCli = path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  if (fs.existsSync(tsxCli)) {
    return { cmd: process.execPath, args: [tsxCli, path.join(ROOT, 'server.ts')], mode: 'tsx (dev fallback - run npm run build for the real target)' };
  }
  return null;
}

function startServer(cmdSpec) {
  serverMode = cmdSpec.mode;
  child = spawn(cmdSpec.cmd, cmdSpec.args, {
    cwd: ROOT,
    env: buildChildEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => chunk.split(/\r?\n/).forEach(pushLog));
  child.stderr.on('data', (chunk) => chunk.split(/\r?\n/).forEach(pushLog));
  let earlyExit = null;
  child.on('exit', (code, signal) => {
    if (earlyExitResolve) earlyExitResolve({ code, signal });
    earlyExit = { code, signal };
  });
  let earlyExitResolve = null;
  child.earlyExit = () => earlyExit;
  child.waitEarlyExit = () => new Promise((resolve) => {
    if (earlyExit) resolve(earlyExit);
    else earlyExitResolve = resolve;
  });
  return child;
}

async function waitForHealth(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    const exited = child.earlyExit();
    if (exited) {
      throw new Error(`server process exited early (code=${exited.code} signal=${exited.signal}) before answering /healthz`);
    }
    try {
      const res = await fetch(`${BASE}/healthz`, { signal: AbortSignal.timeout(2000) });
      if (res.status === 200) return true;
      lastErr = new Error(`/healthz answered with status ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await sleep(300);
  }
  // Advisory: is something listening on the default port instead?
  let advisory = '';
  try {
    const res = await fetch('http://127.0.0.1:3000/healthz', { signal: AbortSignal.timeout(2000) });
    if (res.status === 200) advisory = ' NOTE: something IS answering on port 3000 - the server may ignore the PORT env variable (env-contract violation), or another dev server is running there.';
  } catch {
    /* nothing on 3000 */
  }
  throw new Error(`/healthz not reachable on port ${PORT} within ${timeoutMs}ms (last error: ${lastErr && lastErr.message}).${advisory}`);
}

async function killServer() {
  if (!child) return;
  const pid = child.pid;
  const exited = new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.once('exit', resolve);
  });
  try {
    child.kill();
  } catch {
    /* already gone */
  }
  const forceTimer = setTimeout(() => {
    if (process.platform === 'win32' && pid) {
      try {
        spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {
        /* best effort */
      }
    } else {
      try {
        child.kill('SIGKILL');
      } catch {
        /* best effort */
      }
    }
  }, 3000);
  await Promise.race([exited, sleep(8000)]);
  clearTimeout(forceTimer);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Assertion helpers shared by checks
// ---------------------------------------------------------------------------

function expectStatus(r, expected, label) {
  assert(
    r.status === expected,
    `${label}: expected HTTP ${expected}, got ${r.status}; body: ${bodySnippet(r)}`,
  );
}

function expectRoleBlocked(r, label) {
  assert(
    r.status === 403,
    `${label}: expected HTTP 403 (role not permitted), got ${r.status}; body: ${bodySnippet(r)}`,
  );
}

function expectAuthRequired(r, label) {
  assert(
    r.status === 401,
    `${label}: expected HTTP 401 (unauthenticated), got ${r.status}; body: ${bodySnippet(r)}`,
  );
}

// ---------------------------------------------------------------------------
// The suite
// ---------------------------------------------------------------------------

async function runSuite() {
  const runId = Date.now();
  let adminCookie = null;
  let makerCookie = null;
  let checkerCookie = null;
  let staffCookie = null;
  let adminRawSetCookie = null;

  // ---- shared state produced during the run, consumed by later sections ----
  let news1 = null; // created by maker, submitted, approved by checker
  let news2 = null; // created by maker, submitted, rejected by checker, then edited back to draft
  let news3 = null; // created by maker, submitted, approved by admin
  let bannerId = null;
  let contactId = null;
  let docId = null;

  // =========================================================================
  section('0. Server health (public probes)');

  await check('GET /healthz returns 200', async () => {
    const r = await req('GET', '/healthz');
    expectStatus(r, 200, 'GET /healthz');
    return 'healthy';
  });

  await check('GET /readyz returns 200', async () => {
    const r = await req('GET', '/readyz');
    expectStatus(r, 200, 'GET /readyz');
    return 'ready';
  });

  await check('GET /api/openapi.json returns 200 + OpenAPI 3 document', async () => {
    const r = await req('GET', '/api/openapi.json');
    expectStatus(r, 200, 'GET /api/openapi.json');
    assert(r.json && typeof r.json.openapi === 'string' && r.json.openapi.startsWith('3'),
      `expected OpenAPI 3.x document, got: ${bodySnippet(r)}`);
    return `openapi ${r.json.openapi}`;
  });

  // =========================================================================
  section('1. Public GET endpoints (anon allowed)');

  for (const p of ['/api/news', '/api/banners', '/api/rooms', '/api/tools']) {
    await check(`GET ${p} returns 200 with data array (anon)`, async () => {
      const r = await req('GET', p);
      expectStatus(r, 200, `GET ${p}`);
      assert(r.json && Array.isArray(r.json.data), `expected {data:[...]}, got: ${bodySnippet(r)}`);
      return `${r.json.data.length} items`;
    });
  }

  // =========================================================================
  section('2. Protected endpoints reject anonymous requests with 401');

  const anonGet401 = ['/api/contacts', '/api/documents', '/api/auth/me', '/api/users', '/api/audit-logs', '/api/sync/logs', '/api/system/export'];
  for (const p of anonGet401) {
    await check(`GET ${p} returns 401 (anon)`, async () => {
      const r = await req('GET', p);
      expectAuthRequired(r, `GET ${p} anon`);
      return '401';
    });
  }

  await check('POST /api/news returns 401 (anon)', async () => {
    const r = await req('POST', '/api/news', { json: { title: 'anon should not pass' } });
    expectAuthRequired(r, 'POST /api/news anon');
    return '401';
  });

  await check('POST /api/banners returns 401 (anon)', async () => {
    const r = await req('POST', '/api/banners', { json: { title: 'anon should not pass' } });
    expectAuthRequired(r, 'POST /api/banners anon');
    return '401';
  });

  await check('POST /api/rooms/:id/book returns 401 (anon)', async () => {
    const rooms = await req('GET', '/api/rooms');
    const room = (rooms.json && rooms.json.data && rooms.json.data[0]) || { id: 'room-1' };
    const r = await req('POST', `/api/rooms/${room.id}/book`, { json: { topic: 'anon' } });
    expectAuthRequired(r, 'POST /api/rooms/:id/book anon');
    return '401';
  });

  await check('DELETE /api/news/:id returns 401 (anon, admin-only route)', async () => {
    const r = await req('DELETE', `/api/news/does-not-exist-${runId}`);
    expectAuthRequired(r, 'DELETE /api/news/:id anon');
    return '401';
  });

  await check('POST /api/upload returns 401 (anon)', async () => {
    const fd = new FormData();
    fd.append('file', new Blob([TINY_PNG], { type: 'image/png' }), 'anon.png');
    const r = await req('POST', '/api/upload', { form: fd });
    expectAuthRequired(r, 'POST /api/upload anon');
    return '401';
  });

  // =========================================================================
  section('3. Bootstrap admin login + session cookie');

  let adminLogin = null;
  await check('POST /api/auth/login (admin) returns 200 with user payload + kbj_session cookie', async () => {
    adminLogin = await login(ADMIN_USERNAME, ADMIN_PASSWORD);
    expectStatus(adminLogin, 200, 'POST /api/auth/login admin');
    assert(adminLogin.cookie, 'expected Set-Cookie: kbj_session=<token> in response');
    adminRawSetCookie = adminLogin.rawSetCookie;
    const data = adminLogin.json && adminLogin.json.data;
    assert(data, `expected {success:true, data:{...}}, got: ${bodySnippet(adminLogin)}`);
    assert(adminLogin.json.success === true, `expected success:true, got: ${bodySnippet(adminLogin)}`);
    for (const key of ['id', 'username', 'displayName', 'role', 'email']) {
      assert(data[key] !== undefined && data[key] !== null, `login data.${key} missing: ${bodySnippet(adminLogin)}`);
    }
    assert(data.username === ADMIN_USERNAME, `expected data.username="${ADMIN_USERNAME}", got "${data.username}"`);
    assert(data.role === 'admin', `expected data.role="admin", got "${data.role}"`);
    return `role=${data.role}`;
  });
  adminCookie = adminLogin ? adminLogin.cookie : null;

  await check('kbj_session cookie flags: HttpOnly + SameSite=Lax + Secure (NODE_ENV=production)', async () => {
    assert(adminRawSetCookie, 'no kbj_session Set-Cookie header captured');
    const raw = adminRawSetCookie.toLowerCase();
    assert(raw.includes('httponly'), `cookie missing HttpOnly flag: ${adminRawSetCookie}`);
    assert(raw.includes('samesite=lax'), `cookie missing SameSite=Lax: ${adminRawSetCookie}`);
    assert(raw.includes('secure'), `NODE_ENV=production but cookie missing Secure flag: ${adminRawSetCookie}`);
    return 'HttpOnly; SameSite=Lax; Secure';
  });

  await check('GET /api/auth/me (admin cookie) returns current user', async () => {
    const r = await req('GET', '/api/auth/me', { cookie: adminCookie });
    expectStatus(r, 200, 'GET /api/auth/me');
    assert(r.json && r.json.success === true && r.json.data, `expected {success:true, data:user}, got: ${bodySnippet(r)}`);
    assert(r.json.data.username === ADMIN_USERNAME, `expected username="${ADMIN_USERNAME}", got "${r.json.data.username}"`);
    return `username=${r.json.data.username}`;
  });

  // =========================================================================
  section('4. User management (admin only)');

  await check('GET /api/users (admin) returns 200 with user list containing bootstrap admin', async () => {
    const r = await req('GET', '/api/users', { cookie: adminCookie });
    expectStatus(r, 200, 'GET /api/users admin');
    assert(r.json && Array.isArray(r.json.data), `expected {data:[...]}, got: ${bodySnippet(r)}`);
    assert(r.json.data.some((u) => u.username === ADMIN_USERNAME), 'bootstrap admin missing from /api/users');
    return `${r.json.data.length} users`;
  });

  for (const user of [MAKER, CHECKER, STAFF]) {
    await check(`POST /api/users (admin) creates role "${user.role}" -> 201`, async () => {
      const r = await req('POST', '/api/users', {
        cookie: adminCookie,
        json: { username: user.username, password: user.password, displayName: user.displayName, email: user.email, role: user.role },
      });
      expectStatus(r, 201, `POST /api/users (${user.role})`);
      return `created ${user.username}`;
    });
  }

  // =========================================================================
  section('5. Role logins');

  for (const user of [MAKER, CHECKER, STAFF]) {
    await check(`POST /api/auth/login (${user.role}) returns 200 with correct role`, async () => {
      const l = await login(user.username, user.password);
      expectStatus(l, 200, `login ${user.role}`);
      assert(l.cookie, `expected kbj_session cookie for ${user.role}`);
      const data = l.json && l.json.data;
      assert(data && data.role === user.role, `expected data.role="${user.role}", got: ${bodySnippet(l)}`);
      if (user.role === 'maker') makerCookie = l.cookie;
      if (user.role === 'checker') checkerCookie = l.cookie;
      if (user.role === 'staff') staffCookie = l.cookie;
      return `role=${data.role}`;
    });
  }

  await check('GET /api/users (staff) returns 403', async () => {
    const r = await req('GET', '/api/users', { cookie: staffCookie });
    expectRoleBlocked(r, 'GET /api/users staff');
    return '403';
  });

  await check('POST /api/users (staff) returns 403', async () => {
    const r = await req('POST', '/api/users', {
      cookie: staffCookie,
      json: { username: 'h4x', password: 'Whatever@2026!', displayName: 'H4x', email: 'h4x@smoke.local', role: 'admin' },
    });
    expectRoleBlocked(r, 'POST /api/users staff');
    return '403 - staff cannot mint users';
  });

  // =========================================================================
  section('6. RBAC matrix - staff-readable + staff-actionable endpoints');

  await check('GET /api/contacts (staff) returns 200', async () => {
    const r = await req('GET', '/api/contacts', { cookie: staffCookie });
    expectStatus(r, 200, 'GET /api/contacts staff');
    assert(r.json && Array.isArray(r.json.data), `expected {data:[...]}, got: ${bodySnippet(r)}`);
    return `${r.json.data.length} contacts`;
  });

  await check('GET /api/documents (staff) returns 200', async () => {
    const r = await req('GET', '/api/documents', { cookie: staffCookie });
    expectStatus(r, 200, 'GET /api/documents staff');
    assert(r.json && Array.isArray(r.json.data), `expected {data:[...]}, got: ${bodySnippet(r)}`);
    return `${r.json.data.length} documents`;
  });

  let bookedRoomId = null;
  await check('POST /api/rooms/:id/book + /release (staff) round-trip 200', async () => {
    const rooms = await req('GET', '/api/rooms');
    const room = rooms.json.data.find((rr) => rr.status === 'available');
    assert(room, 'no room with status "available" found in seed data');
    bookedRoomId = room.id;
    const book = await req('POST', `/api/rooms/${room.id}/book`, {
      cookie: staffCookie,
      json: { topic: 'Smoke test booking', booker: 'smokestaff', time: '10:00 - 11:00' },
    });
    expectStatus(book, 200, 'POST /api/rooms/:id/book staff');
    const release = await req('POST', `/api/rooms/${room.id}/release`, { cookie: staffCookie, json: {} });
    expectStatus(release, 200, 'POST /api/rooms/:id/release staff');
    assert(release.json && release.json.data && release.json.data.status === 'available',
      `room should be available after release, got: ${bodySnippet(release)}`);
    return `room ${room.id} booked + released`;
  });

  // =========================================================================
  section('7. RBAC matrix - content writes (maker+; staff/checker 403)');

  await check('POST /api/news (staff) returns 403', async () => {
    const r = await req('POST', '/api/news', { cookie: staffCookie, json: { title: 'staff should not write' } });
    expectRoleBlocked(r, 'POST /api/news staff');
    return '403';
  });

  await check('POST /api/news (checker) returns 403', async () => {
    const r = await req('POST', '/api/news', { cookie: checkerCookie, json: { title: 'checker should not write' } });
    expectRoleBlocked(r, 'POST /api/news checker');
    return '403 - compliance cannot author';
  });

  await check('POST /api/news (maker) returns 201', async () => {
    const r = await req('POST', '/api/news', {
      cookie: makerCookie,
      json: { title: `[SMOKE ${runId}] Maker announcement`, titleEn: 'Smoke maker announcement', summary: 'Created by smoke suite', content: 'Full body text for the smoke test news item.', category: 'kbj-news', categoryLabel: 'News' },
    });
    expectStatus(r, 201, 'POST /api/news maker');
    assert(r.json && r.json.data && r.json.data.id, `expected {data:{id,...}}, got: ${bodySnippet(r)}`);
    news1 = r.json.data;
    return `id=${news1.id}`;
  });

  await check('PUT /api/news/:id (staff) returns 403', async () => {
    const r = await req('PUT', `/api/news/${news1.id}`, { cookie: staffCookie, json: { title: 'staff should not edit' } });
    expectRoleBlocked(r, 'PUT /api/news/:id staff');
    return '403';
  });

  await check('PUT /api/news/:id (maker) returns 200', async () => {
    const r = await req('PUT', `/api/news/${news1.id}`, { cookie: makerCookie, json: { summary: 'Updated by smoke suite' } });
    expectStatus(r, 200, 'PUT /api/news/:id maker');
    return 'updated';
  });

  await check('POST /api/banners (staff) returns 403', async () => {
    const r = await req('POST', '/api/banners', { cookie: staffCookie, json: { title: 'staff should not write' } });
    expectRoleBlocked(r, 'POST /api/banners staff');
    return '403';
  });

  await check('POST /api/banners (maker) returns 201', async () => {
    const r = await req('POST', '/api/banners', {
      cookie: makerCookie,
      json: { title: `[SMOKE ${runId}] Banner`, subtitle: 'smoke', badge: 'Smoke' },
    });
    expectStatus(r, 201, 'POST /api/banners maker');
    assert(r.json && r.json.data && r.json.data.id, `expected {data:{id,...}}, got: ${bodySnippet(r)}`);
    bannerId = r.json.data.id;
    return `id=${bannerId}`;
  });

  await check('POST /api/contacts (maker) returns 201', async () => {
    const r = await req('POST', '/api/contacts', {
      cookie: makerCookie,
      json: { name: `Smoke Contact ${runId}`, nameEn: 'Smoke Contact', position: 'QA', department: 'IT', extension: '9999', email: 'contact@smoke.local', floor: '14th' },
    });
    expectStatus(r, 201, 'POST /api/contacts maker');
    assert(r.json && r.json.data && r.json.data.id, `expected {data:{id,...}}, got: ${bodySnippet(r)}`);
    contactId = r.json.data.id;
    return `id=${contactId}`;
  });

  await check('POST /api/documents (maker) returns 201', async () => {
    const r = await req('POST', '/api/documents', {
      cookie: makerCookie,
      json: { title: `[SMOKE ${runId}] Policy doc`, category: 'policy', department: 'IT', version: 'v1.0', fileSize: '1 KB' },
    });
    expectStatus(r, 201, 'POST /api/documents maker');
    assert(r.json && r.json.data && r.json.data.id, `expected {data:{id,...}}, got: ${bodySnippet(r)}`);
    docId = r.json.data.id;
    return `id=${docId}`;
  });

  // =========================================================================
  section('8. Maker-checker dual approval flow');

  await check('POST /api/news/:id/submit-approval (staff) returns 403', async () => {
    const r = await req('POST', `/api/news/${news1.id}/submit-approval`, { cookie: staffCookie, json: {} });
    expectRoleBlocked(r, 'submit-approval staff');
    return '403';
  });

  await check('POST /api/news/:id/submit-approval (checker) returns 403', async () => {
    const r = await req('POST', `/api/news/${news1.id}/submit-approval`, { cookie: checkerCookie, json: {} });
    expectRoleBlocked(r, 'submit-approval checker');
    return '403';
  });

  await check('POST /api/news/:id/submit-approval (maker) returns 200 - audit must record SERVER-SIDE actor, not body actor', async () => {
    // Deliberately try to spoof the actor field; the frozen contract requires
    // audit entries to record the authenticated session user.
    const r = await req('POST', `/api/news/${news1.id}/submit-approval`, {
      cookie: makerCookie,
      json: { actor: 'SPOOFED-ACTOR-XYZ' },
    });
    expectStatus(r, 200, 'submit-approval maker');
    return 'submitted';
  });

  await check('POST /api/news/:id/approve (maker) returns 403', async () => {
    const r = await req('POST', `/api/news/${news1.id}/approve`, { cookie: makerCookie, json: {} });
    expectRoleBlocked(r, 'approve maker');
    return '403 - maker cannot self-approve';
  });

  await check('POST /api/news/:id/approve (staff) returns 403', async () => {
    const r = await req('POST', `/api/news/${news1.id}/approve`, { cookie: staffCookie, json: {} });
    expectRoleBlocked(r, 'approve staff');
    return '403';
  });

  await check('POST /api/news/:id/approve (checker) returns 200', async () => {
    const r = await req('POST', `/api/news/${news1.id}/approve`, {
      cookie: checkerCookie,
      json: { checker: 'SPOOFED-CHECKER-XYZ' },
    });
    expectStatus(r, 200, 'approve checker');
    return 'approved';
  });

  // TC-NEWS-011 (FLIPPED, post DCR-3 fix): create-with-publish no longer
  // bypasses dual control. As built pre-fix this returned externalSyncStatus
  // 'synced' + an immediate sync-log CREATE row; the strict ruling (FR-NEWS-009)
  // pins the opposite for every role, admin included.
  await check('TC-NEWS-011 (flipped): POST /api/news with syncToExternal:true stays draft, no sync log', async () => {
    const r = await req('POST', '/api/news', {
      cookie: makerCookie,
      json: {
        title: `[SMOKE ${runId}] Direct publish attempt`,
        summary: 'tries to publish without dual control',
        content: 'body',
        category: 'kbj-news',
        syncToExternal: true,          // must be stripped/ignored
        externalSyncStatus: 'synced',  // must be stripped/ignored
        approvedBy: 'FORGED-APPROVER', // must be stripped/ignored
        approvedAt: '2020-01-01 00:00:00',
      },
    });
    expectStatus(r, 201, 'POST /api/news maker (direct-publish attempt)');
    const item = r.json.data;
    assert(item.externalSyncStatus === 'draft',
      `expected externalSyncStatus="draft" (dual control enforced), got "${item.externalSyncStatus}"`);
    assert(item.syncToExternal === false,
      `expected syncToExternal=false at create, got "${item.syncToExternal}"`);
    assert(!item.approvedBy && !item.approvedAt,
      `workflow stamps must not be settable at create, got approvedBy="${item.approvedBy}" approvedAt="${item.approvedAt}"`);
    // No sync log may exist for this item: nothing has left the building.
    const logs = await req('GET', '/api/sync/logs', { cookie: adminCookie });
    expectStatus(logs, 200, 'GET /api/sync/logs admin (direct-publish check)');
    const rows = (logs.json && Array.isArray(logs.json.data)) ? logs.json.data : [];
    const leaked = rows.filter((l) => String(l.itemId) === String(item.id));
    assert(leaked.length === 0, `create must not write sync logs without checker approval, found ${leaked.length} row(s)`);
    return `id=${item.id} stays draft; 0 sync-log rows`;
  });

  await check('TC-SEC-011: approve on a draft item returns 400 (state guard)', async () => {
    const create = await req('POST', '/api/news', {
      cookie: makerCookie,
      json: { title: `[SMOKE ${runId}] Draft guard probe`, summary: 'never submitted', content: 'body', category: 'kbj-news' },
    });
    expectStatus(create, 201, 'POST /api/news maker (draft guard probe)');
    const draftItem = create.json.data;
    const approve = await req('POST', `/api/news/${draftItem.id}/approve`, { cookie: checkerCookie, json: {} });
    expectStatus(approve, 400, 'approve on draft (checker)');
    const bodyStr = bodySnippet(approve);
    assert(/pending/i.test(bodyStr), `400 body should mention pending_approval requirement, got: ${bodyStr}`);
    const reject = await req('POST', `/api/news/${draftItem.id}/reject`, { cookie: checkerCookie, json: { reason: 'x' } });
    expectStatus(reject, 400, 'reject on draft (checker)');
    return 'approve/reject on draft -> 400';
  });

  await check('TC-SEC-011: submit-approval on a non-draft item returns 400', async () => {
    // news1 is 'synced' at this point (approved by checker earlier).
    const r = await req('POST', `/api/news/${news1.id}/submit-approval`, { cookie: makerCookie, json: {} });
    expectStatus(r, 400, 'submit-approval on synced item');
    assert(r.json && r.json.success === false, `expected success:false envelope, got: ${bodySnippet(r)}`);
    return 're-submit of a synced item -> 400';
  });

  await check('TC-SEC-011: PUT cannot forge workflow fields (approvedBy/externalSyncStatus/syncToExternal)', async () => {
    // news1 is 'synced' with approvedBy=checker; a maker PUT tries to forge
    // approval stamps and re-stamp the state. Every workflow field must be
    // stripped server-side: the resulting state comes from the forced-reset
    // rule (non-draft edit => draft), never from the body — forged values the
    // rule would never produce ('rejected', syncToExternal:true, FORGED
    // approvedBy) prove the strip.
    const r = await req('PUT', `/api/news/${news1.id}`, {
      cookie: makerCookie,
      json: {
        summary: 'Updated again by smoke suite (forge attempt)',
        approvedBy: 'FORGED-BY-PUT',
        approvedAt: '2020-01-01 00:00:00',
        externalSyncStatus: 'rejected',
        syncToExternal: true,
      },
    });
    expectStatus(r, 200, 'PUT /api/news/:id maker (forge attempt)');
    const item = r.json.data;
    assert(item.externalSyncStatus === 'draft',
      `workflow state must be server-controlled (edit of synced forces draft, body 'rejected' ignored), got "${item.externalSyncStatus}"`);
    assert(!/FORGED/i.test(String(item.approvedBy)),
      `approvedBy is forgeable via PUT, got "${item.approvedBy}"`);
    assert(item.syncToExternal === false,
      `syncToExternal must be stripped (body true ignored; live item drops from sync set on edit), got "${item.syncToExternal}"`);
    return 'workflow fields stripped; forced reset applied (synced -> draft)';
  });

  await check('Maker -> submit -> checker reject flow returns 200 and marks item rejected', async () => {
    const create = await req('POST', '/api/news', {
      cookie: makerCookie,
      json: { title: `[SMOKE ${runId}] Rejected item`, summary: 'will be rejected', content: 'body', category: 'kbj-news' },
    });
    expectStatus(create, 201, 'POST /api/news maker (news2)');
    news2 = create.json.data;
    const submit = await req('POST', `/api/news/${news2.id}/submit-approval`, { cookie: makerCookie, json: {} });
    expectStatus(submit, 200, 'submit-approval (news2)');
    const reject = await req('POST', `/api/news/${news2.id}/reject`, {
      cookie: checkerCookie,
      json: { reason: 'smoke rejection reason' },
    });
    expectStatus(reject, 200, 'reject checker (news2)');
    assert(reject.json && reject.json.success === true, `expected success:true, got: ${bodySnippet(reject)}`);
    if (reject.json.data && reject.json.data.externalSyncStatus) {
      assert(reject.json.data.externalSyncStatus === 'rejected',
        `expected externalSyncStatus="rejected", got "${reject.json.data.externalSyncStatus}"`);
    }
    return 'rejected';
  });

  await check('FR-NEWS-009: editing a rejected item resets it to draft (and only then can it be re-submitted)', async () => {
    // news2 is 'rejected' with approvedBy='Rejected by ...'. A content edit
    // must force the draft state and clear the prior cycle's stamps; a
    // re-submit without the edit would 400 (draft-only guard).
    const blockedResubmit = await req('POST', `/api/news/${news2.id}/submit-approval`, { cookie: makerCookie, json: {} });
    expectStatus(blockedResubmit, 400, 'submit-approval on rejected item (pre-edit)');
    const edit = await req('PUT', `/api/news/${news2.id}`, {
      cookie: makerCookie,
      json: { summary: 'Revised after rejection (smoke)' },
    });
    expectStatus(edit, 200, 'PUT rejected item (reset check)');
    const item = edit.json.data;
    assert(item.externalSyncStatus === 'draft',
      `editing a rejected item must reset status to draft, got "${item.externalSyncStatus}"`);
    assert(!item.approvedBy,
      `rejected-cycle approval stamp must be cleared on edit, got approvedBy="${item.approvedBy}"`);
    const resubmit = await req('POST', `/api/news/${news2.id}/submit-approval`, { cookie: makerCookie, json: {} });
    expectStatus(resubmit, 200, 'submit-approval after edit (news2)');
    return 'rejected -> (edit) -> draft -> pending_approval';
  });

  await check('Admin can exercise approve + reject (matrix: checker OR admin)', async () => {
    // Admin acts as checker on ANOTHER maker's submissions (news3 approve,
    // news4 reject) — legal per the role matrix. The former approve-then-
    // reject on one item is now impossible: post-approval the item is
    // 'synced' and reject requires 'pending_approval' (400).
    const create3 = await req('POST', '/api/news', {
      cookie: makerCookie,
      json: { title: `[SMOKE ${runId}] Admin approve flow`, summary: 'admin approve', content: 'body', category: 'kbj-news' },
    });
    expectStatus(create3, 201, 'POST /api/news maker (news3)');
    news3 = create3.json.data;
    const submit3 = await req('POST', `/api/news/${news3.id}/submit-approval`, { cookie: makerCookie, json: {} });
    expectStatus(submit3, 200, 'submit-approval (news3)');
    const approve = await req('POST', `/api/news/${news3.id}/approve`, { cookie: adminCookie, json: {} });
    expectStatus(approve, 200, 'approve admin (news3)');
    const rejectOnSynced = await req('POST', `/api/news/${news3.id}/reject`, { cookie: adminCookie, json: { reason: 'late reject must fail' } });
    expectStatus(rejectOnSynced, 400, 'reject on synced item (admin)');

    const create4 = await req('POST', '/api/news', {
      cookie: makerCookie,
      json: { title: `[SMOKE ${runId}] Admin reject flow`, summary: 'admin reject', content: 'body', category: 'kbj-news' },
    });
    expectStatus(create4, 201, 'POST /api/news maker (news4)');
    const news4 = create4.json.data;
    const submit4 = await req('POST', `/api/news/${news4.id}/submit-approval`, { cookie: makerCookie, json: {} });
    expectStatus(submit4, 200, 'submit-approval (news4)');
    const reject = await req('POST', `/api/news/${news4.id}/reject`, { cookie: adminCookie, json: { reason: 'admin smoke reject' } });
    expectStatus(reject, 200, 'reject admin (news4)');
    return 'admin approve (news3) + reject (news4) on maker submissions OK';
  });

  await check('TC-SEC-011: submitter cannot approve or reject their own submission (403, admin included)', async () => {
    // Admin authors AND submits its own item, then attempts both decisions:
    // role gates pass (admin may author/submit/approve/reject) — the block
    // must come from the identity guard (submitter != approver), proving the
    // guard is stronger than the RBAC matrix.
    const create = await req('POST', '/api/news', {
      cookie: adminCookie,
      json: { title: `[SMOKE ${runId}] Admin self-approval probe`, summary: 'admin submits own item', content: 'body', category: 'kbj-news' },
    });
    expectStatus(create, 201, 'POST /api/news admin (self-approval probe)');
    const ownItem = create.json.data;
    const submit = await req('POST', `/api/news/${ownItem.id}/submit-approval`, { cookie: adminCookie, json: {} });
    expectStatus(submit, 200, 'submit-approval admin (own item)');
    assert(submit.json && submit.json.data && submit.json.data.submittedBy,
      `submittedBy must be persisted for the self-approval guard, got: ${bodySnippet(submit)}`);
    const selfApprove = await req('POST', `/api/news/${ownItem.id}/approve`, { cookie: adminCookie, json: {} });
    expectStatus(selfApprove, 403, 'self-approve (admin on own submission)');
    assert(/self/i.test(bodySnippet(selfApprove)), `403 body should name the self-approval rule, got: ${bodySnippet(selfApprove)}`);
    const selfReject = await req('POST', `/api/news/${ownItem.id}/reject`, { cookie: adminCookie, json: { reason: 'own item' } });
    expectStatus(selfReject, 403, 'self-reject (admin on own submission)');
    // The item must be untouched by both blocked attempts.
    const list = await req('GET', '/api/news', { cookie: adminCookie });
    expectStatus(list, 200, 'GET /api/news after blocked attempts');
    const after = (list.json.data || []).find((n) => String(n.id) === String(ownItem.id));
    assert(after && after.externalSyncStatus === 'pending_approval',
      `blocked attempts must not change the state, got: ${after ? after.externalSyncStatus : 'item not found'}`);
    return 'self-approve -> 403, self-reject -> 403; item still pending_approval';
  });

  await check('FR-NEWS-009: editing a synced item resets it to draft and drops it from the live set', async () => {
    // news3 is 'synced' (admin approved) with syncToExternal:true and
    // approvedBy/approvedAt/submittedBy stamps. An edit must invalidate the
    // approval: modified content may not stay public under a stale stamp.
    const r = await req('PUT', `/api/news/${news3.id}`, {
      cookie: makerCookie,
      json: { summary: 'Edited after going live (smoke reset probe)' },
    });
    expectStatus(r, 200, 'PUT synced item (reset check)');
    const item = r.json.data;
    assert(item.externalSyncStatus === 'draft',
      `editing a synced item must reset status to draft, got "${item.externalSyncStatus}"`);
    assert(item.syncToExternal === false,
      `edited-live item must drop out of the sync set (syncToExternal=false), got "${item.syncToExternal}"`);
    assert(!item.approvedBy && !item.approvedAt,
      `stale approval stamps must be cleared on edit, got approvedBy="${item.approvedBy}" approvedAt="${item.approvedAt}"`);
    assert(!item.submittedBy && !item.submittedAt,
      `submission stamps must be cleared on edit, got submittedBy="${item.submittedBy}" submittedAt="${item.submittedAt}"`);
    return 'synced -> (edit) -> draft; dropped from live set';
  });

  await check('FR-NEWS-009: editing a pending_approval item resets it to draft (no TOCTOU mutation in review)', async () => {
    // news2 is 'pending_approval' (re-submitted earlier). A submitter editing
    // content mid-review must invalidate the submission — the checker may
    // only approve content that cannot change underneath the review.
    const r = await req('PUT', `/api/news/${news2.id}`, {
      cookie: makerCookie,
      json: { summary: 'Edited while pending review (smoke reset probe)' },
    });
    expectStatus(r, 200, 'PUT pending_approval item (reset check)');
    const item = r.json.data;
    assert(item.externalSyncStatus === 'draft',
      `editing a pending_approval item must reset status to draft, got "${item.externalSyncStatus}"`);
    assert(!item.submittedBy && !item.submittedAt,
      `submission stamps must be cleared on edit, got submittedBy="${item.submittedBy}" submittedAt="${item.submittedAt}"`);
    return 'pending_approval -> (edit) -> draft';
  });

  // =========================================================================
  section('9. Audit logs (checker/admin) - actor integrity');

  await check('GET /api/audit-logs (staff) returns 403', async () => {
    const r = await req('GET', '/api/audit-logs', { cookie: staffCookie });
    expectRoleBlocked(r, 'GET /api/audit-logs staff');
    return '403';
  });

  await check('GET /api/audit-logs (maker) returns 403', async () => {
    const r = await req('GET', '/api/audit-logs', { cookie: makerCookie });
    expectRoleBlocked(r, 'GET /api/audit-logs maker');
    return '403';
  });

  await check('GET /api/audit-logs (checker) returns 200', async () => {
    const r = await req('GET', '/api/audit-logs', { cookie: checkerCookie });
    expectStatus(r, 200, 'GET /api/audit-logs checker');
    assert(r.json && Array.isArray(r.json.data), `expected {data:[...]}, got: ${bodySnippet(r)}`);
    return `${r.json.data.length} entries`;
  });

  await check('Audit entries record the authenticated actor (spoofed body actor ignored)', async () => {
    const r = await req('GET', '/api/audit-logs', { cookie: adminCookie });
    expectStatus(r, 200, 'GET /api/audit-logs admin');
    const entries = r.json.data;
    const submitEntry = entries.find((e) => String(e.resourceId) === String(news1.id) && /submit/i.test(String(e.action)));
    assert(submitEntry, `no audit entry found for SUBMIT_APPROVAL on ${news1.id} - actions are not being audited`);
    assert(submitEntry.actor !== 'SPOOFED-ACTOR-XYZ',
      `audit actor is client-spoofable: actor="${submitEntry.actor}" after body actor=SPOOFED-ACTOR-XYZ`);
    assert(String(submitEntry.actor).includes(MAKER.username) || String(submitEntry.actor).includes(MAKER.displayName),
      `audit actor "${submitEntry.actor}" does not identify the authenticated maker (${MAKER.username})`);
    const approveEntry = entries.find((e) => String(e.resourceId) === String(news1.id) && /approve/i.test(String(e.action)));
    assert(approveEntry, `no audit entry found for APPROVE on ${news1.id}`);
    assert(String(approveEntry.actor).includes(CHECKER.username) || String(approveEntry.actor).includes(CHECKER.displayName),
      `approve audit actor "${approveEntry.actor}" does not identify the authenticated checker (${CHECKER.username})`);
    // Auth events must also be audited with server-side actors (AuditLog.action
    // includes LOGIN / LOGIN_FAILED / LOGOUT / USER_CREATE).
    const loginEntry = entries.find((e) => /^login$/i.test(String(e.action)) && (String(e.actor).includes(MAKER.username) || String(e.actor).includes(MAKER.displayName)));
    assert(loginEntry, `no LOGIN audit entry found for the authenticated maker (${MAKER.username}) - auth events are not audited`);
    const userCreateEntry = entries.find((e) => /user[_\s-]?create/i.test(String(e.action)) && String(e.actor).includes(ADMIN_USERNAME));
    assert(userCreateEntry, `no USER_CREATE audit entry found with the admin (${ADMIN_USERNAME}) as actor`);
    return 'server-side actors recorded for submit, approve, login, user-create';
  });

  // TC-AUDIT-008 + TC-RBAC-026 (flipped, post DCR-8 removal): the manual
  // audit-append endpoint no longer exists. Pre-removal as built: admin → 201
  // (defaults applied), other roles → 403. Post-removal contract: 404 with the
  // JSON /api catch-all body for EVERY role incl. admin — audit rows are
  // appended exclusively by server-side recordAudit().
  await check('TC-AUDIT-008/TC-RBAC-026 (flipped): POST /api/audit-logs returns 404 for every role (manual append removed, DCR-8)', async () => {
    const expectedError = 'No API endpoint for POST /api/audit-logs';
    for (const [label, cookie] of [
      ['admin (TC-AUDIT-008)', adminCookie],
      ['checker', checkerCookie],
      ['maker', makerCookie],
      ['staff (TC-RBAC-026)', staffCookie],
    ]) {
      const r = await req('POST', '/api/audit-logs', {
        cookie,
        json: { action: 'UPDATE', details: 'fabrication attempt should be impossible' },
      });
      expectStatus(r, 404, `POST /api/audit-logs ${label}`);
      assert(r.json && r.json.success === false,
        `expected success:false for ${label}, got: ${bodySnippet(r)}`);
      assert(r.json.error === expectedError,
        `expected error "${expectedError}" for ${label}, got: ${bodySnippet(r)}`);
    }
    return '404 catch-all for admin, checker, maker, staff — no API path writes audit rows';
  });

  // =========================================================================
  section('10. Admin-only: sync, system export');

  await check('GET /api/sync/logs (staff) returns 403', async () => {
    const r = await req('GET', '/api/sync/logs', { cookie: staffCookie });
    expectRoleBlocked(r, 'GET /api/sync/logs staff');
    return '403';
  });

  await check('POST /api/sync/trigger (staff) returns 403', async () => {
    const r = await req('POST', '/api/sync/trigger', { cookie: staffCookie, json: {} });
    expectRoleBlocked(r, 'POST /api/sync/trigger staff');
    return '403';
  });

  await check('GET /api/sync/logs (admin) returns 200', async () => {
    const r = await req('GET', '/api/sync/logs', { cookie: adminCookie });
    expectStatus(r, 200, 'GET /api/sync/logs admin');
    assert(r.json && Array.isArray(r.json.data), `expected {data:[...]}, got: ${bodySnippet(r)}`);
    return `${r.json.data.length} sync logs`;
  });

  await check('POST /api/sync/trigger (admin) returns 200', async () => {
    const r = await req('POST', '/api/sync/trigger', { cookie: adminCookie, json: {} });
    expectStatus(r, 200, 'POST /api/sync/trigger admin');
    return 'triggered';
  });

  await check('GET /api/system/export (staff) returns 403', async () => {
    const r = await req('GET', '/api/system/export', { cookie: staffCookie });
    expectRoleBlocked(r, 'GET /api/system/export staff');
    return '403';
  });

  await check('GET /api/system/export (admin) returns 200 with tables payload', async () => {
    const r = await req('GET', '/api/system/export', { cookie: adminCookie });
    expectStatus(r, 200, 'GET /api/system/export admin');
    assert(r.json && r.json.tables && typeof r.json.tables === 'object',
      `expected {tables:{...}} payload shape, got: ${bodySnippet(r)}`);
    assert(Array.isArray(r.json.tables.news), 'export payload tables.news should be an array');
    return `tables: ${Object.keys(r.json.tables).join(', ')}`;
  });

  // =========================================================================
  section('11. Uploads (maker/checker/admin - staff excluded; whitelist + size limit)');

  await check('POST /api/upload (staff) returns 403 - uploads restricted to maker+ (staff excluded)', async () => {
    const fd = new FormData();
    fd.append('file', new Blob([TINY_PNG], { type: 'image/png' }), `staff-${runId}.png`);
    const r = await req('POST', '/api/upload', { form: fd, cookie: staffCookie });
    expectRoleBlocked(r, 'POST /api/upload staff');
    return '403';
  });

  // NOTE: the backend validates the DECLARED part content-type against the
  // extension (EXPECTED_MIME_BY_EXTENSION) - an improvement beyond frozen D4
  // (polyglot-upload defense). Real clients (browsers, curl) always declare
  // proper types, so the suite declares them too; octet-stream .png/.pdf
  // uploads are intentionally rejected by the server.
  await check('POST /api/upload (maker) returns 201 + uploaded file is served byte-identical', async () => {
    const fd = new FormData();
    fd.append('file', new Blob([TINY_PDF], { type: 'application/pdf' }), `maker-${runId}.pdf`);
    const r = await req('POST', '/api/upload', { form: fd, cookie: makerCookie });
    expectStatus(r, 201, 'POST /api/upload maker');
    assert(r.json && r.json.success === true && r.json.data && typeof r.json.data.url === 'string',
      `expected {success:true, data:{url,...}}, got: ${bodySnippet(r)}`);
    assert(typeof r.json.data.size === 'number', `expected numeric data.size, got: ${bodySnippet(r)}`);
    const file = await fetchBinary(r.json.data.url);
    expectStatus(file, 200, `GET ${r.json.data.url}`);
    assert(file.buf.equals(TINY_PDF),
      `served file differs from uploaded bytes (uploaded ${TINY_PDF.length}B, served ${file.buf.length}B)`);
    return `${r.json.data.url} (${file.buf.length}B verified)`;
  });

  await check('POST /api/upload (checker) returns 201 - checker may upload', async () => {
    const fd = new FormData();
    fd.append('file', new Blob([TINY_PNG], { type: 'image/png' }), `checker-${runId}.png`);
    const r = await req('POST', '/api/upload', { form: fd, cookie: checkerCookie });
    expectStatus(r, 201, 'POST /api/upload checker');
    return '201';
  });

  await check('POST /api/upload rejects non-whitelisted extension (.exe)', async () => {
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.from('MZ fake exe payload', 'utf8')]), `evil-${runId}.exe`);
    const r = await req('POST', '/api/upload', { form: fd, cookie: makerCookie });
    assert(r.status >= 400 && r.status < 500,
      `expected 4xx rejection for .exe upload, got ${r.status}; body: ${bodySnippet(r)}`);
    return `rejected with ${r.status}`;
  });

  await check('POST /api/upload rejects oversized file (11MB > 10MB limit)', async () => {
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.alloc(OVERSIZE_BYTES, 65)], { type: 'image/png' }), `big-${runId}.png`);
    try {
      const r = await req('POST', '/api/upload', { form: fd, cookie: makerCookie, timeoutMs: 60000 });
      assert(r.status >= 400 && r.status < 500,
        `expected 4xx rejection for 11MB upload, got ${r.status}; body: ${bodySnippet(r)}`);
      return `rejected with ${r.status}`;
    } catch (err) {
      // A server that aborts the connection mid-upload is also a rejection.
      if (/abort|terminat|econnreset|epipe|socket hang up/i.test(String(err && err.message))) {
        return 'server aborted the upload connection (treated as rejection)';
      }
      throw err;
    }
  });

  // =========================================================================
  section('12. Admin-only DELETE (staff/maker/checker 403, admin 2xx)');

  for (const resource of [
    { label: 'DELETE /api/news/:id', path: () => `/api/news/${news1.id}` },
    { label: 'DELETE /api/banners/:id', path: () => `/api/banners/${bannerId}` },
    { label: 'DELETE /api/contacts/:id', path: () => `/api/contacts/${contactId}` },
    { label: 'DELETE /api/documents/:id', path: () => `/api/documents/${docId}` },
  ]) {
    await check(`${resource.label} (staff) returns 403`, async () => {
      const r = await req('DELETE', resource.path(), { cookie: staffCookie });
      expectRoleBlocked(r, `${resource.label} staff`);
      return '403';
    });
    await check(`${resource.label} (maker) returns 403`, async () => {
      const r = await req('DELETE', resource.path(), { cookie: makerCookie });
      expectRoleBlocked(r, `${resource.label} maker`);
      return '403';
    });
    await check(`${resource.label} (checker) returns 403`, async () => {
      const r = await req('DELETE', resource.path(), { cookie: checkerCookie });
      expectRoleBlocked(r, `${resource.label} checker`);
      return '403';
    });
    await check(`${resource.label} (admin) succeeds`, async () => {
      const r = await req('DELETE', resource.path(), { cookie: adminCookie });
      assert(r.status === 200 || r.status === 204,
        `expected 200/204, got ${r.status}; body: ${bodySnippet(r)}`);
      return String(r.status);
    });
  }

  // =========================================================================
  section('13. Auth lifecycle: bad credentials, logout invalidation');

  await check('POST /api/auth/login with wrong password returns 401 {success:false}', async () => {
    const r = await login(ADMIN_USERNAME, 'DefinitelyWrongPassword!42');
    expectStatus(r, 401, 'login wrong password');
    assert(!r.cookie, '401 login must not set a session cookie');
    assert(r.json && r.json.success === false,
      `expected {success:false, error:...} per frozen contract, got: ${bodySnippet(r)}`);
    return '401 invalid credentials';
  });

  // Runs after all other admin-cookie checks: logout kills the session for good.
  await check('POST /api/auth/logout returns 200 and invalidates the session server-side', async () => {
    const out = await req('POST', '/api/auth/logout', { cookie: adminCookie, json: {} });
    expectStatus(out, 200, 'POST /api/auth/logout');
    assert(out.json && out.json.success === true, `expected {success:true}, got: ${bodySnippet(out)}`);
    const me = await req('GET', '/api/auth/me', { cookie: adminCookie });
    expectAuthRequired(me, 'GET /api/auth/me with stale (logged-out) cookie');
    return 'stale cookie rejected with 401';
  });

  await check('Auth events audited: LOGIN_FAILED after bad login, LOGOUT after logout', async () => {
    const r = await req('GET', '/api/audit-logs', { cookie: checkerCookie });
    expectStatus(r, 200, 'GET /api/audit-logs checker');
    const actions = new Set((r.json.data || []).map((e) => String(e.action || '').toUpperCase()));
    assert(actions.has('LOGIN_FAILED'), 'expected a LOGIN_FAILED audit entry after the wrong-password attempt - failed logins are not audited');
    assert(actions.has('LOGOUT'), 'expected a LOGOUT audit entry after logout - logouts are not audited');
    return 'LOGIN_FAILED + LOGOUT entries present';
  });

  // =========================================================================
  // Section 16 (W2-3 flip-pins) runs HERE - after the admin logout of
  // section 13 (it re-logs-in with fresh sessions) but BEFORE section 14
  // exhausts the failed-login limiter: express-rate-limit blocks every login
  // from a saturated key (successes skip COUNTING, not rejection), so any
  // login after section 14 within the 60s window would 429.
  await runW23AuditSuite();

  // =========================================================================
  section('14. Login rate limit (runs LAST - exhausts the per-IP budget)');

  await check('Repeated bad logins trigger HTTP 429 (5 attempts/min/IP per D1)', async () => {
    let first429At = 0;
    for (let i = 1; i <= 10; i++) {
      const r = await login(ADMIN_USERNAME, `WrongPassword-${runId}-${i}`);
      if (r.status === 429) {
        first429At = i;
        break;
      }
      assert(r.status === 401,
        `attempt ${i}: expected 401 or 429, got ${r.status}; body: ${bodySnippet(r)}`);
    }
    assert(first429At > 0, 'no 429 within 10 consecutive bad login attempts - login rate limit missing or threshold > 10/min');
    return `429 first observed at attempt ${first429At} of this section (limiter counts FAILED logins only; the earlier wrong-password check also counts toward the window)`;
  });
}

// ---------------------------------------------------------------------------
// Opt-in section 15: shared login-budget store in PostgreSQL mode (W2-5,
// RISK-010). Runs only when SMOKE_DATABASE_URL is set. A SECOND server is
// spawned against that (disposable) database; this process then manipulates
// rate_limit_hits directly via the `pg` client, which stands in for "another
// pod": if an out-of-process table write changes what the server does next,
// the budget provably lives in the shared store, not in server memory.
// ---------------------------------------------------------------------------

const PG_PORT = Number(process.env.SMOKE_PG_PORT || 3211);
const PG_BASE = `http://127.0.0.1:${PG_PORT}`;

async function runPgSharedStoreSuite() {
  const databaseUrl = process.env.SMOKE_DATABASE_URL;
  if (!databaseUrl) return;

  let pgChild = null;
  const pgLogLines = [];
  let client = null; // pg Client; connected in the boot check below

  const pushPgLog = (line) => {
    pgLogLines.push(line);
    if (pgLogLines.length > 500) pgLogLines.shift();
    if (VERBOSE) process.stdout.write(`[pg-server] ${line}\n`);
  };

  async function pgBadLogin(attempt) {
    const res = await fetch(`${PG_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'nosuchuser', password: `WrongPassword-${attempt}` }),
      signal: AbortSignal.timeout(10000),
    });
    return res.status;
  }

  async function killPgServer() {
    if (!pgChild) return;
    const exited = new Promise((resolve) => {
      if (pgChild.exitCode !== null || pgChild.signalCode !== null) resolve();
      else pgChild.once('exit', resolve);
    });
    try { pgChild.kill(); } catch { /* already gone */ }
    const forceTimer = setTimeout(() => {
      try { pgChild.kill('SIGKILL'); } catch { /* best effort */ }
    }, 3000);
    await Promise.race([exited, sleep(8000)]);
    clearTimeout(forceTimer);
  }

  section('15. Shared login-budget store - PG mode (W2-5, opt-in)');

  await check('PG-mode server boots against SMOKE_DATABASE_URL (second instance, own port)', async () => {
    const { Client } = await import('pg');
    const cmdSpec = serverCommand();
    assert(cmdSpec, 'no runnable server target for the PG-mode instance');
    pgChild = spawn(cmdSpec.cmd, cmdSpec.args, {
      cwd: ROOT,
      env: buildChildEnv({
        DATABASE_URL: databaseUrl,
        PORT: String(PG_PORT),
        UPLOAD_DIR: './uploads-test-pg',
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    pgChild.stdout.setEncoding('utf8');
    pgChild.stderr.setEncoding('utf8');
    pgChild.stdout.on('data', (chunk) => chunk.split(/\r?\n/).forEach(pushPgLog));
    pgChild.stderr.on('data', (chunk) => chunk.split(/\r?\n/).forEach(pushPgLog));
    const deadline = Date.now() + 30000;
    for (;;) {
      const exited = pgChild.exitCode !== null ? { code: pgChild.exitCode, signal: pgChild.signalCode } : null;
      if (exited) {
        throw new Error(`PG-mode server exited during boot (code=${exited.code} signal=${exited.signal}); last logs: ${pgLogLines.slice(-10).join(' | ')}`);
      }
      try {
        const res = await fetch(`${PG_BASE}/healthz`, { signal: AbortSignal.timeout(2000) });
        if (res.status === 200) break;
      } catch { /* not up yet */ }
      if (Date.now() > deadline) {
        throw new Error(`/healthz not reachable on port ${PG_PORT} within 30s; last logs: ${pgLogLines.slice(-10).join(' | ')}`);
      }
      await sleep(300);
    }
    // Connect out-of-process and reset the budget table so every run starts
    // from a known state regardless of previous runs against this database.
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_hits (
        ip text PRIMARY KEY,
        window_start timestamptz NOT NULL DEFAULT now(),
        fail_count integer NOT NULL DEFAULT 0
      )`);
    await client.query('TRUNCATE rate_limit_hits');
    return `healthy on :${PG_PORT}; rate_limit_hits truncated`;
  });

  if (!client) return; // boot failed; nothing more to probe

  await check('Failed logins are counted in rate_limit_hits and blocked with 429 (shared store active)', async () => {
    let first429At = 0;
    for (let i = 1; i <= 10; i++) {
      const status = await pgBadLogin(`a${i}`);
      if (status === 429) { first429At = i; break; }
      assert(status === 401, `attempt ${i}: expected 401 or 429 from the PG-mode server, got ${status}`);
    }
    assert(first429At > 0, 'no 429 within 10 bad logins against the PG-mode server - shared budget not enforced');
    const { rows } = await client.query('SELECT ip, fail_count FROM rate_limit_hits');
    assert(rows.length === 1, `expected exactly one rate_limit_hits row after truncation, found ${rows.length}: ${JSON.stringify(rows)}`);
    const failCount = Number(rows[0].fail_count);
    assert(failCount >= 5, `rate_limit_hits.fail_count=${failCount} - the 429 did not come from the shared table`);
    return `429 at attempt ${first429At}; rate_limit_hits row ip=${rows[0].ip} fail_count=${failCount}`;
  });

  await check('Out-of-process write to rate_limit_hits changes the verdict (table is the authoritative budget)', async () => {
    const { rows } = await client.query('SELECT ip FROM rate_limit_hits LIMIT 1');
    const ip = rows[0].ip;
    // Zero the budget from OUTSIDE the server: the next failed login must be
    // evaluated against the amended count (401), proving no in-memory cache.
    await client.query('UPDATE rate_limit_hits SET fail_count = 0 WHERE ip = $1', [ip]);
    const afterReset = await pgBadLogin('b1');
    assert(afterReset === 401,
      `after an external fail_count reset the same IP should get 401, got ${afterReset} - budget is cached in-process`);
    // Pre-load the budget to the limit from OUTSIDE: the next attempt must be
    // blocked (429) even though THIS server process never counted those hits.
    await client.query('UPDATE rate_limit_hits SET fail_count = 5 WHERE ip = $1', [ip]);
    const afterLoad = await pgBadLogin('b2');
    assert(afterLoad === 429,
      `after an external fail_count=5 the next login should get 429, got ${afterLoad} - external hits are invisible to the limiter`);
    return 'external reset -> 401; external pre-load to limit -> 429';
  });

  await check('Shared-store failure fails open with a degradation WARNING (no lockout, budget skipped)', async () => {
    // Simulate store unavailability the only way a black-box process allows:
    // remove the table underneath it. Every subsequent increment must fail
    // open - logins proceed as 401 (never 429), and each failure logs the
    // WARNING with the monotonic degradation counter for deliverable-17 style
    // reporting.
    await client.query('DROP TABLE rate_limit_hits');
    const statuses = [];
    for (let i = 1; i <= 7; i++) statuses.push(await pgBadLogin(`c${i}`));
    const blocked = statuses.filter((s) => s === 429).length;
    assert(blocked === 0, `fail-open violated: ${blocked} of 7 attempts were rate-limited (429) with the store gone: ${statuses.join(',')}`);
    assert(statuses.every((s) => s === 401),
      `with the shared store unavailable all attempts must still reach credential checks (401), got ${statuses.join(',')}`);
    await sleep(300); // give stdout/stderr pumps a beat
    const warn = pgLogLines.find((l) => l.includes('[LoginRateLimit]') && l.includes('failing open'));
    assert(warn, 'no "[LoginRateLimit] ... failing open" WARNING found in the PG-mode server log');
    assert(warn.includes('degradation event #1'),
      `fail-open WARNING must carry the monotonic degradation counter, got: ${warn}`);
    return '7/7 attempts 401, zero 429; WARNING logged with "degradation event #1 this process"';
  });

  // Cleanup (not a check): restore the table so the database is left in a
  // runnable state for the next run / deployment.
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limit_hits (
        ip text PRIMARY KEY,
        window_start timestamptz NOT NULL DEFAULT now(),
        fail_count integer NOT NULL DEFAULT 0
      )`);
    await client.query('TRUNCATE rate_limit_hits');
  } catch (err) {
    console.error('[cleanup] failed to restore rate_limit_hits:', err && err.message ? err.message : err);
  } finally {
    try { await client.end(); } catch { /* already closed */ }
    await killPgServer();
  }
}

// ---------------------------------------------------------------------------
// Section 16 (W2-3, default suite): audit-coverage flip-pins — TC-SYNC-004
// (AUD-P05 SYNC_TRIGGER), TC-AUDIT-009 (AUD-P06 SYSTEM_EXPORT) and
// TC-AUDIT-010 (AUD-P07 ACCESS_DENIED, lead-ruled trim). Runs BEFORE
// section 14 saturates the FAILED-login rate-limit key (see the ordering
// comment at the runSuite call site): a saturated key rejects EVERY login
// attempt, successful ones included — skipSuccessfulRequests skips COUNTING
// successful logins, not rejection. Fresh logins here are therefore safe,
// and none of them consume budget.
// ---------------------------------------------------------------------------

async function runW23AuditSuite() {
  section('16. W2-3 audit coverage (flipped): TC-SYNC-004 / TC-AUDIT-009 / TC-AUDIT-010 (AUD-P05/06/07)');

  // Fresh sessions: the default suite logged the section-13 admin out and
  // section-14 hammered the login endpoint; successful logins are unbudgeted.
  const adminLogin = await login(ADMIN_USERNAME, ADMIN_PASSWORD);
  assert(adminLogin.cookie, `admin re-login failed (${adminLogin.status}): ${bodySnippet(adminLogin)}`);
  const admin2 = adminLogin.cookie;
  const staffLogin = await login(STAFF.username, STAFF.password);
  assert(staffLogin.cookie, `staff login failed (${staffLogin.status}): ${bodySnippet(staffLogin)}`);
  const staff2 = staffLogin.cookie;

  const getTrail = async () => {
    const t = await req('GET', '/api/audit-logs', { cookie: admin2 });
    expectStatus(t, 200, 'GET /api/audit-logs admin');
    return t.json.data || [];
  };
  const isAd = (e) => String(e.action || '').toUpperCase() === 'ACCESS_DENIED';

  await check('TC-SYNC-004 (flipped): POST /api/sync/trigger writes a SYNC_TRIGGER audit row (AUD-P05)', async () => {
    const r = await req('POST', '/api/sync/trigger', { cookie: admin2 });
    expectStatus(r, 200, 'POST /api/sync/trigger admin');
    const logs = await req('GET', '/api/sync/logs', { cookie: admin2 });
    expectStatus(logs, 200, 'GET /api/sync/logs admin');
    const forceRow = (logs.json.data || []).find(
      (l) => String(l.action || '').toUpperCase() === 'FORCE_SYNC' && l.itemId === 'BULK-ALL',
    );
    assert(forceRow, 'no FORCE_SYNC / BULK-ALL sync-log row after the trigger - handler changed shape?');
    const auditRow = (await getTrail()).find((e) => String(e.action || '').toUpperCase() === 'SYNC_TRIGGER');
    assert(auditRow, 'expected a SYNC_TRIGGER audit entry after POST /api/sync/trigger - AUD-P05 not implemented');
    assert(String(auditRow.resourceId) === 'BULK-ALL',
      `SYNC_TRIGGER resourceId must be BULK-ALL (sync-log itemId correlation), got "${auditRow.resourceId}"`);
    assert(String(auditRow.targetResource) === 'Public Edge Gateway',
      `SYNC_TRIGGER targetResource must be "Public Edge Gateway", got "${auditRow.targetResource}"`);
    assert(String(auditRow.actor).includes(ADMIN_USERNAME),
      `SYNC_TRIGGER actor must be the admin (${ADMIN_USERNAME}), got "${auditRow.actor}"`);
    assert(String(auditRow.status).toUpperCase() === 'SUCCESS', `SYNC_TRIGGER status must be SUCCESS, got "${auditRow.status}"`);
    assert(String(auditRow.details).includes(`${r.json.syncedItemsCount} item(s)`),
      `SYNC_TRIGGER details must quote the verified count, got: "${auditRow.details}"`);
    return `SYNC_TRIGGER row correlates with the FORCE_SYNC sync log (BULK-ALL, ${r.json.syncedItemsCount} item(s))`;
  });

  await check('TC-AUDIT-009 (flipped): GET /api/system/export writes a SYSTEM_EXPORT row keyed by exportTimestamp (AUD-P06)', async () => {
    const ex1 = await req('GET', '/api/system/export', { cookie: admin2 });
    expectStatus(ex1, 200, 'GET /api/system/export admin');
    const ts1 = ex1.json && ex1.json.exportTimestamp;
    assert(typeof ts1 === 'string' && ts1, `export response must keep exportTimestamp (DCR-1), got: ${bodySnippet(ex1)}`);
    assert(ex1.json.tables && Array.isArray(ex1.json.tables.audit_logs) && Array.isArray(ex1.json.tables.news),
      `export response shape must be unchanged (tables payload), got: ${bodySnippet(ex1)}`);
    const selfRow = (ex1.json.tables.audit_logs || []).find(
      (e) => String(e.action || '').toUpperCase() === 'SYSTEM_EXPORT' && e.resourceId === ts1,
    );
    assert(!selfRow, 'the SYSTEM_EXPORT row lands after the snapshot lists are read - it must not appear in its own export');
    const auditRow = (await getTrail()).find(
      (e) => String(e.action || '').toUpperCase() === 'SYSTEM_EXPORT' && e.resourceId === ts1,
    );
    assert(auditRow, 'expected a SYSTEM_EXPORT audit entry keyed by this export\'s exportTimestamp - AUD-P06 not implemented');
    assert(String(auditRow.actor).includes(ADMIN_USERNAME),
      `SYSTEM_EXPORT actor must be the admin (${ADMIN_USERNAME}), got "${auditRow.actor}"`);
    assert(String(auditRow.status).toUpperCase() === 'SUCCESS', `SYSTEM_EXPORT status must be SUCCESS, got "${auditRow.status}"`);
    assert(String(auditRow.details).includes(`${ex1.json.counts.news} news`),
      `SYSTEM_EXPORT details must quote table counts, got: "${auditRow.details}"`);
    const ex2 = await req('GET', '/api/system/export', { cookie: admin2 });
    expectStatus(ex2, 200, 'GET /api/system/export admin (second)');
    const carried = (ex2.json.tables.audit_logs || []).find(
      (e) => String(e.action || '').toUpperCase() === 'SYSTEM_EXPORT' && e.resourceId === ts1,
    );
    assert(carried, 'the first export\'s SYSTEM_EXPORT row must appear in the NEXT export snapshot');
    return `SYSTEM_EXPORT row correlated to its snapshot (${ts1}); response shape unchanged; visible in the next export`;
  });

  await check('TC-AUDIT-010 class 1 (flipped): authenticated 403 writes an ACCESS_DENIED row (AUD-P07)', async () => {
    const r = await req('GET', '/api/users', { cookie: staff2 });
    expectRoleBlocked(r, 'GET /api/users staff');
    const row = (await getTrail()).find(
      (e) => isAd(e) && String(e.resourceId) === 'GET /api/users' && String(e.actor).includes(STAFF.username),
    );
    assert(row, 'expected an ACCESS_DENIED audit entry for the staff 403 - AUD-P07 (403 class) not implemented');
    assert(String(row.status).toUpperCase() === 'WARNING', `ACCESS_DENIED status must be WARNING, got "${row.status}"`);
    assert(String(row.details).includes("role 'staff'"),
      `ACCESS_DENIED details must name the refused role, got: "${row.details}"`);
    return `staff 403 on GET /api/users audited (${row.details})`;
  });

  await check('TC-AUDIT-010 classes 2+3 (flipped): no-cookie 401 NOT audited; tampered-cookie 401 audited as anonymous (AUD-P07 ruled trim)', async () => {
    // Class 2 - anon probe, no cookie: request-log only, no audit row.
    const before = (await getTrail()).filter(isAd).length;
    const anon = await req('GET', '/api/contacts', {});
    expectAuthRequired(anon, 'GET /api/contacts anon (no cookie)');
    const afterAnon = (await getTrail()).filter(isAd).length;
    assert(afterAnon === before,
      `no-cookie 401 must NOT write an audit row (lead-ruled trim): ACCESS_DENIED count ${before} -> ${afterAnon}`);
    // Class 3 - cookie presented but failed validation: attack signal, audited.
    const bad = await req('GET', '/api/contacts', { cookie: `${SESSION_COOKIE}=forged-session-id.deadbeefsignature` });
    expectAuthRequired(bad, 'GET /api/contacts tampered cookie');
    const row = (await getTrail()).find(
      (e) => isAd(e) && String(e.resourceId) === 'GET /api/contacts' && String(e.actor) === 'anonymous',
    );
    assert(row, 'expected an ACCESS_DENIED audit entry for the presented-but-failed cookie 401 - AUD-P07 (401 class) not implemented');
    assert(String(row.actorRole) === 'Anonymous', `failed-cookie actorRole must be Anonymous, got "${row.actorRole}"`);
    assert(String(row.details).includes('presented session cookie failed validation'),
      `failed-cookie details must say why it was denied, got: "${row.details}"`);
    assert(String(row.status).toUpperCase() === 'WARNING', `ACCESS_DENIED status must be WARNING, got "${row.status}"`);
    // No double-write: login-endpoint 401s carry LOGIN_FAILED only (section 13
    // exercised one; requireAuth is not mounted on the login route).
    const loginAd = (await getTrail()).find(
      (e) => isAd(e) && String(e.resourceId) === 'POST /api/auth/login',
    );
    assert(!loginAd, 'login-endpoint 401s must write LOGIN_FAILED only, never ACCESS_DENIED (no double-write)');
    return 'trim verified: anon 401 silent, tampered-cookie 401 audited (anonymous/WARNING), login 401 not double-written';
  });
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function writeReport(meta, suiteError) {
  const failed = results.filter((r) => !r.pass);
  const lines = [];
  lines.push('# Smoke Test Report');
  lines.push('');
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Node: ${process.version} on ${os.platform()} ${os.release()}`);
  lines.push(`- Target: ${BASE} (spawned \`${meta.serverMode || 'n/a'}\`, PID ${meta.pid || 'n/a'})`);
  lines.push(`- Mode: in-memory (DATABASE_URL removed), NODE_ENV=production, UPLOAD_DIR=./uploads-test${process.env.SMOKE_DATABASE_URL ? `; section 15 opt-in: second server in PG mode on :${PG_PORT} (SMOKE_DATABASE_URL)` : ''}`);
  lines.push(`- Result: **${results.length - failed.length}/${results.length} passed${failed.length ? `, ${failed.length} FAILED` : ''}**`);
  if (suiteError) lines.push(`- Suite aborted early: ${suiteError}`);
  lines.push('');
  lines.push('## Checks');
  lines.push('');
  lines.push('| # | Section | Check | Result | Detail |');
  lines.push('|---|---------|-------|--------|--------|');
  results.forEach((r, i) => {
    const detail = String(r.detail || '').replace(/\|/g, '\\|');
    lines.push(`| ${i + 1} | ${r.section} | ${r.name} | ${r.pass ? 'PASS' : '**FAIL**'} | ${detail} |`);
  });
  if (failed.length || suiteError) {
    lines.push('');
    lines.push('## Failures');
    lines.push('');
    for (const f of failed) {
      lines.push(`### FAIL - ${f.section} | ${f.name}`);
      lines.push('');
      lines.push('```');
      lines.push(f.detail || '(no detail)');
      lines.push('```');
      lines.push('');
    }
    lines.push('## Server log tail (last 40 lines)');
    lines.push('');
    lines.push('```');
    lines.push(...serverLogLines.slice(-40));
    lines.push('```');
  }
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  return REPORT_PATH;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const startedAt = Date.now();
  const meta = { serverMode: '', pid: null };
  let suiteError = null;
  let exitCode = 0;

  console.log('================================================================');
  console.log('KBJ Intranet Portal - smoke test suite');
  console.log(`Target : ${BASE}`);
  console.log(`Node   : ${process.version} (${os.platform()})`);
  console.log(`Report : ${path.relative(process.cwd(), REPORT_PATH)}`);
  console.log('================================================================');

  try {
    const cmdSpec = serverCommand();
    if (!cmdSpec) {
      throw new Error('no runnable server target: dist/server.cjs not found and tsx is not installed - run `npm run build` first');
    }
    meta.serverMode = cmdSpec.mode;
    console.log(`Server : ${cmdSpec.cmd} ${cmdSpec.args.join(' ')}`);
    startServer(cmdSpec);
    meta.pid = child.pid;
    console.log(`Spawned server (pid ${child.pid}, mode: ${cmdSpec.mode}); waiting for /healthz ...`);
    await waitForHealth(30000);
    console.log('Server is healthy. Running checks...');
    await runSuite();
    await runPgSharedStoreSuite(); // no-op unless SMOKE_DATABASE_URL is set
  } catch (err) {
    suiteError = err && err.message ? err.message : String(err);
    console.error(`\n[FATAL] ${suiteError}`);
    if (serverLogLines.length) {
      console.error('\n--- server log tail (last 30 lines) ---');
      for (const line of serverLogLines.slice(-30)) console.error(`[server] ${line}`);
    }
    exitCode = 2;
  } finally {
    await killServer();
    const report = writeReport(meta, suiteError);
    const failed = results.filter((r) => !r.pass).length;
    const total = results.length;
    const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log('\n----------------------------------------------------------------');
    console.log(`RESULT: ${total - failed}/${total} checks passed${failed ? `, ${failed} FAILED` : ''} in ${secs}s`);
    if (failed) {
      console.log('Failed checks:');
      for (const f of results.filter((r) => !r.pass)) console.log(`  [FAIL] ${f.section} | ${f.name}`);
    }
    if (suiteError) console.log(`SUITE ERROR: ${suiteError}`);
    console.log(`Report written to ${report}`);
    console.log('----------------------------------------------------------------');
    if (!suiteError && failed) exitCode = 1;
    if (suiteError && exitCode === 0) exitCode = 2;
    process.exit(exitCode);
  }
}

main().catch((err) => {
  console.error('[FATAL] unhandled suite error:', err);
  process.exit(2);
});
