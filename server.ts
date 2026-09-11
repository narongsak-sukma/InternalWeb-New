import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import bcrypt from 'bcryptjs';
import rateLimit, { type IncrementResponse, type Store } from 'express-rate-limit';
import multer from 'multer';
import { Pool } from 'pg';

// Initial seed data
import {
  INITIAL_NEWS,
  INITIAL_BANNERS,
  INITIAL_CONTACTS,
  INITIAL_ROOMS,
  INITIAL_DOCUMENTS,
  INITIAL_TOOLS,
  INITIAL_SYNC_LOGS,
  INITIAL_AUDIT_LOGS,
} from './src/data/initialData';
import {
  NewsItem,
  NewsCategory,
  BannerSlide,
  DirectoryContact,
  MeetingRoom,
  PolicyDocument,
  SyncLog,
  AuditLog,
  User,
  UserRole,
  SafeUser,
  USER_ROLES,
} from './src/types';

const app = express();
// Single reverse-proxy hop (Docker / K8s ingress) so req.ip reflects the real client
// for rate limiting and audit logs instead of the proxy address.
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enterprise Security Headers (OWASP & BOT Compliance)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Request logger for K8s ingress diagnostics (Structured JSON logging ready for Logstash/CloudWatch)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    // req.originalUrl stays intact even when a mounted middleware (e.g. the /api
    // resource-id guard below) rewrote req.url before ending the response.
    const loggedPath = req.originalUrl.split('?')[0];
    if (!loggedPath.startsWith('/@') && !loggedPath.includes('node_modules')) {
      const logEntry = {
        time: new Date().toISOString(),
        method: req.method,
        path: loggedPath,
        status: res.statusCode,
        durationMs: duration,
        ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
      };
      console.log(JSON.stringify(logEntry));
    }
  });
  next();
});

// ==========================================
// RESOURCE-ID VALIDATION (defense in depth)
// ==========================================

// Two malformed-id shapes reach the API:
//   1. PUT/DELETE /api/news/ — path-to-regexp cannot match an empty segment, so
//      these used to fall through every :id route and surface as an opaque
//      SPA/Express 404. Intercepted here, before routing, with a clean 400.
//   2. PUT /api/news/%20 — whitespace ids DO match /:id after URL decoding;
//      those are rejected per-route by requireResourceId further below.
const ID_ADDRESSABLE_RESOURCES = new Set(['news', 'banners', 'contacts', 'documents', 'users', 'rooms']);

app.use('/api', (req, res, next) => {
  // '/news/' -> ['news', '']; '/news//approve' -> ['news', '', 'approve']
  const [resource, ...idPath] = req.path.replace(/^\//, '').split('/');
  if (!ID_ADDRESSABLE_RESOURCES.has(resource.toLowerCase())) return next();

  // A single trailing slash is just the collection ('/news/'); drop it before
  // looking for genuinely empty id segments.
  const trailingSlashOnly = idPath.length > 0 && idPath[idPath.length - 1] === '';
  const itemPath = trailingSlashOnly ? idPath.slice(0, -1) : idPath;

  // PUT/PATCH/DELETE aimed at the bare collection carry no resource id at all.
  const isIdLessMutation =
    (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') && itemPath.length === 0;
  // '/news//approve' or '/rooms//book' — an empty id segment mid-path (any method).
  const hasEmptyIdSegment = itemPath.some((segment) => segment === '');

  if (isIdLessMutation || hasEmptyIdSegment) {
    return res.status(400).json({ success: false, error: 'Resource id is required' });
  }
  next();
});

// ==========================================
// PERSISTENCE LAYER (D3): repository interface with two implementations.
// The server picks PostgreSQL when DATABASE_URL is set, in-memory otherwise.
// ==========================================

interface SessionRecord {
  sid: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

// Login rate-limit policy (D1): 5 FAILED logins per 60s window per IP. The
// budget is counted in the ACTIVE repository (W2-5, RISK-010) — a PostgreSQL
// atomic upsert shared by every pod when DATABASE_URL is set, per-process
// in-memory in dev. Code constants by design: no env knobs (see W2-5 design
// note §4 — a config case must be made by ops/UAT first).
const LOGIN_RATE_WINDOW_SEC = 60;
const LOGIN_RATE_LIMIT = 5;

// W2-FIX-3 (codex cycle-2 mandate): the verdict a news transition plan returns
// from inside the transactional critical section. `readonly` = guards failed —
// NO writes happen. `commit` = the full payload: the next row (always built
// FROM the locked fresh row), the optional audit row (present for every
// workflow transition; absent for an ordinary draft PUT, which still rides the
// same transactional path), and the optional approve-path sync-log row.
export type NewsTransitionPlan<R> =
  | { kind: 'readonly'; result: R }
  | { kind: 'commit'; next: NewsItem; audit?: AuditLog; syncLog?: SyncLog; result: R };

interface Repository {
  readonly mode: 'memory' | 'postgres';
  /** Ensure schema (pg), seed initial content when tables are empty, no-op for memory. */
  init(): Promise<void>;
  close(): Promise<void>;
  checkHealth(): Promise<boolean>;

  listUsers(): Promise<User[]>;
  findUserByUsername(username: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  insertUser(user: User): Promise<void>;
  saveUser(user: User): Promise<void>;

  insertSession(record: SessionRecord): Promise<void>;
  findSession(sid: string): Promise<SessionRecord | null>;
  deleteSession(sid: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;

  // Shared failed-login budget (W2-5): cluster-wide when PostgreSQL-backed,
  // per-process in dev memory. consumeLoginBudget returns the post-increment
  // failure count for the current window plus the seconds until it resets;
  // the caller (express-rate-limit) compares the count against the limit.
  consumeLoginBudget(ip: string): Promise<{ count: number; retryAfterSec: number }>;
  releaseLoginBudget(ip: string): Promise<void>;
  clearLoginBudget(ip: string): Promise<void>;
  purgeStaleLoginBudgets(): Promise<void>;

  listNews(): Promise<NewsItem[]>;
  findNews(id: string): Promise<NewsItem | null>;
  insertNews(item: NewsItem): Promise<void>;
  saveNews(item: NewsItem): Promise<void>;
  /**
   * W2-FIX-3 (codex cycle-2 mandate): transactional news transition executor —
   * supersedes W2-FIX-1's commitNewsTransition. The row is re-read INSIDE the
   * critical section (PostgreSQL: SELECT ... FOR UPDATE inside BEGIN, so under
   * READ COMMITTED a blocked lock re-reads the LATEST COMMITTED row when
   * granted), the SYNCHRONOUS PURE `plan` callback evaluates every guard
   * against that locked fresh row and either declines ({kind:'readonly'} — no
   * writes at all) or returns the full commit payload (next state + optional
   * audit row + optional sync-log row). State/audit/sync-log then commit (or
   * roll back) as ONE all-or-nothing unit on the SAME locked connection —
   * guards can never run on a stale snapshot, and a lost concurrent edit
   * across pods is impossible. Callers keep holding withNewsLock (in-process
   * serializer for memory mode / same-pod requests); responses and denial
   * audits are written AFTER the transition returns, never inside the plan
   * (a standalone recordAudit runs on a different connection and would not
   * share the row lock).
   */
  runNewsTransition<R>(
    id: string,
    plan: (locked: NewsItem | null) => NewsTransitionPlan<R>,
  ): Promise<R>;
  deleteNews(id: string): Promise<boolean>;

  listBanners(): Promise<BannerSlide[]>;
  findBanner(id: string): Promise<BannerSlide | null>;
  insertBanner(item: BannerSlide): Promise<void>;
  saveBanner(item: BannerSlide): Promise<void>;
  deleteBanner(id: string): Promise<boolean>;

  listContacts(): Promise<DirectoryContact[]>;
  findContact(id: string): Promise<DirectoryContact | null>;
  insertContact(item: DirectoryContact): Promise<void>;
  saveContact(item: DirectoryContact): Promise<void>;
  deleteContact(id: string): Promise<boolean>;

  listRooms(): Promise<MeetingRoom[]>;
  findRoom(id: string): Promise<MeetingRoom | null>;
  saveRoom(item: MeetingRoom): Promise<void>;

  listDocuments(): Promise<PolicyDocument[]>;
  insertDocument(item: PolicyDocument): Promise<void>;
  deleteDocument(id: string): Promise<boolean>;

  listSyncLogs(): Promise<SyncLog[]>;
  insertSyncLog(item: SyncLog): Promise<void>;

  listAuditLogs(): Promise<AuditLog[]>;
  insertAuditLog(item: AuditLog): Promise<void>;
}

// ---- In-memory implementation (dev mode / graceful fallback) ----

class InMemoryRepository implements Repository {
  readonly mode = 'memory' as const;

  private news: NewsItem[] = [...INITIAL_NEWS];
  private banners: BannerSlide[] = [...INITIAL_BANNERS];
  private contacts: DirectoryContact[] = [...INITIAL_CONTACTS];
  private rooms: MeetingRoom[] = [...INITIAL_ROOMS];
  private documents: PolicyDocument[] = [...INITIAL_DOCUMENTS];
  private syncLogs: SyncLog[] = [...INITIAL_SYNC_LOGS];
  private auditLogs: AuditLog[] = [...INITIAL_AUDIT_LOGS];
  private usersById = new Map<string, User>();
  private userIdByUsername = new Map<string, string>();
  private sessionsBySid = new Map<string, SessionRecord>();
  // W2-5: per-process failed-login budget — same contract as the PostgreSQL
  // implementation, scoped to this process by design (dev mode runs a single
  // process; production sets DATABASE_URL and shares the budget in PG).
  private loginBudget = new Map<string, { windowStart: number; failCount: number }>();

  async init(): Promise<void> {
    console.log('[Persistence] Using IN-MEMORY stores (dev mode). Set DATABASE_URL to enable PostgreSQL.');
  }
  async close(): Promise<void> {}
  async checkHealth(): Promise<boolean> {
    return true;
  }

  async listUsers(): Promise<User[]> {
    return [...this.usersById.values()];
  }
  async findUserByUsername(username: string): Promise<User | null> {
    const id = this.userIdByUsername.get(username.trim().toLowerCase());
    return id ? this.usersById.get(id) || null : null;
  }
  async findUserById(id: string): Promise<User | null> {
    return this.usersById.get(id) || null;
  }
  async insertUser(user: User): Promise<void> {
    this.usersById.set(user.id, user);
    this.userIdByUsername.set(user.username.toLowerCase(), user.id);
  }
  async saveUser(user: User): Promise<void> {
    const existing = this.usersById.get(user.id);
    if (existing && existing.username.toLowerCase() !== user.username.toLowerCase()) {
      this.userIdByUsername.delete(existing.username.toLowerCase());
    }
    this.usersById.set(user.id, user);
    this.userIdByUsername.set(user.username.toLowerCase(), user.id);
  }

  async insertSession(record: SessionRecord): Promise<void> {
    this.sessionsBySid.set(record.sid, record);
  }
  async findSession(sid: string): Promise<SessionRecord | null> {
    return this.sessionsBySid.get(sid) || null;
  }
  async deleteSession(sid: string): Promise<void> {
    this.sessionsBySid.delete(sid);
  }
  async deleteExpiredSessions(): Promise<void> {
    const now = Date.now();
    for (const [sid, record] of this.sessionsBySid) {
      if (record.expiresAt < now) this.sessionsBySid.delete(sid);
    }
  }

  async consumeLoginBudget(ip: string): Promise<{ count: number; retryAfterSec: number }> {
    const now = Date.now();
    const entry = this.loginBudget.get(ip);
    if (!entry || now - entry.windowStart >= LOGIN_RATE_WINDOW_SEC * 1000) {
      this.loginBudget.set(ip, { windowStart: now, failCount: 1 });
      return { count: 1, retryAfterSec: LOGIN_RATE_WINDOW_SEC };
    }
    entry.failCount += 1;
    const retryAfterSec = Math.max(0, Math.ceil((entry.windowStart + LOGIN_RATE_WINDOW_SEC * 1000 - now) / 1000));
    return { count: entry.failCount, retryAfterSec };
  }
  async releaseLoginBudget(ip: string): Promise<void> {
    const entry = this.loginBudget.get(ip);
    if (entry) entry.failCount = Math.max(0, entry.failCount - 1);
  }
  async clearLoginBudget(ip: string): Promise<void> {
    this.loginBudget.delete(ip);
  }
  async purgeStaleLoginBudgets(): Promise<void> {
    // Mirrors the PG sweeper: one hour = window + grace. Correctness never
    // depends on this — consumeLoginBudget rolls an expired window over.
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [ip, entry] of this.loginBudget) {
      if (entry.windowStart < cutoff) this.loginBudget.delete(ip);
    }
  }

  async listNews(): Promise<NewsItem[]> {
    return [...this.news];
  }
  async findNews(id: string): Promise<NewsItem | null> {
    return this.news.find((n) => n.id === id) || null;
  }
  async insertNews(item: NewsItem): Promise<void> {
    this.news.unshift(item);
  }
  async saveNews(item: NewsItem): Promise<void> {
    const idx = this.news.findIndex((n) => n.id === item.id);
    if (idx === -1) this.news.unshift(item);
    else this.news[idx] = item;
  }
  async runNewsTransition<R>(
    id: string,
    plan: (locked: NewsItem | null) => NewsTransitionPlan<R>
  ): Promise<R> {
    // W2-FIX-3: same shape as the old W2-FIX-1 memory path — re-read the row
    // (the caller holds withNewsLock, so this is the fresh in-process state),
    // run the sync/pure plan, then apply state + optional audit/sync-log with
    // prior-state restore if the audit write fails: a retry hits the SAME
    // pre-transition state (it can never silently skip the audit row).
    // (The W2-FIX-4 hooks — commit delay / stale-read simulation — are
    // PG-topology test tools and are deliberately NOT mirrored here.)
    const locked = await this.findNews(id);
    const p = plan(locked);
    if (p.kind === 'readonly') return p.result;
    const idx = this.news.findIndex((n) => n.id === p.next.id);
    const prior = idx === -1 ? null : this.news[idx];
    if (idx === -1) this.news.unshift(p.next);
    else this.news[idx] = p.next;
    try {
      // The hook means "audit-write failure": it fires only when an audit row
      // is imminent. An audit-less commit (ordinary draft PUT) has no audit
      // write to fail — it commits 200 exactly as the pre-W2-FIX-3 saveNews
      // path did under injection.
      if (p.audit && AUDIT_FAILURE_INJECTION) {
        throw new Error('[TEST HOOK] injected audit-write failure (SMOKE_INJECT_AUDIT_FAILURE)');
      }
      if (p.audit) {
        this.auditLogs.unshift(p.audit);
        if (this.auditLogs.length > 5000) this.auditLogs.length = 5000;
      }
      if (p.syncLog) this.syncLogs.unshift(p.syncLog);
    } catch (err) {
      if (prior) {
        const ri = this.news.findIndex((n) => n.id === prior.id);
        if (ri !== -1) this.news[ri] = prior;
      } else {
        this.news = this.news.filter((n) => n.id !== p.next.id);
      }
      throw err;
    }
    return p.result;
  }
  async deleteNews(id: string): Promise<boolean> {
    const before = this.news.length;
    this.news = this.news.filter((n) => n.id !== id);
    return this.news.length !== before;
  }

  async listBanners(): Promise<BannerSlide[]> {
    return [...this.banners];
  }
  async findBanner(id: string): Promise<BannerSlide | null> {
    return this.banners.find((b) => b.id === id) || null;
  }
  async insertBanner(item: BannerSlide): Promise<void> {
    this.banners.push(item);
  }
  async saveBanner(item: BannerSlide): Promise<void> {
    const idx = this.banners.findIndex((b) => b.id === item.id);
    if (idx === -1) this.banners.push(item);
    else this.banners[idx] = item;
  }
  async deleteBanner(id: string): Promise<boolean> {
    const before = this.banners.length;
    this.banners = this.banners.filter((b) => b.id !== id);
    return this.banners.length !== before;
  }

  async listContacts(): Promise<DirectoryContact[]> {
    return [...this.contacts];
  }
  async findContact(id: string): Promise<DirectoryContact | null> {
    return this.contacts.find((c) => c.id === id) || null;
  }
  async insertContact(item: DirectoryContact): Promise<void> {
    this.contacts.push(item);
  }
  async saveContact(item: DirectoryContact): Promise<void> {
    const idx = this.contacts.findIndex((c) => c.id === item.id);
    if (idx === -1) this.contacts.push(item);
    else this.contacts[idx] = item;
  }
  async deleteContact(id: string): Promise<boolean> {
    const before = this.contacts.length;
    this.contacts = this.contacts.filter((c) => c.id !== id);
    return this.contacts.length !== before;
  }

  async listRooms(): Promise<MeetingRoom[]> {
    return [...this.rooms];
  }
  async findRoom(id: string): Promise<MeetingRoom | null> {
    return this.rooms.find((r) => r.id === id) || null;
  }
  async saveRoom(item: MeetingRoom): Promise<void> {
    const idx = this.rooms.findIndex((r) => r.id === item.id);
    if (idx === -1) this.rooms.push(item);
    else this.rooms[idx] = item;
  }

  async listDocuments(): Promise<PolicyDocument[]> {
    return [...this.documents];
  }
  async insertDocument(item: PolicyDocument): Promise<void> {
    this.documents.unshift(item);
  }
  async deleteDocument(id: string): Promise<boolean> {
    const before = this.documents.length;
    this.documents = this.documents.filter((d) => d.id !== id);
    return this.documents.length !== before;
  }

  async listSyncLogs(): Promise<SyncLog[]> {
    return [...this.syncLogs];
  }
  async insertSyncLog(item: SyncLog): Promise<void> {
    this.syncLogs.unshift(item);
  }

  async listAuditLogs(): Promise<AuditLog[]> {
    return [...this.auditLogs];
  }
  async insertAuditLog(item: AuditLog): Promise<void> {
    this.auditLogs.unshift(item);
    // Keep the in-memory trail bounded
    if (this.auditLogs.length > 5000) this.auditLogs.length = 5000;
  }
}

// ---- PostgreSQL implementation ----
// Column set is the canonical schema (scripts/schema.sql mirrors this DDL exactly).

// Canonical PostgreSQL DDL — scripts/schema.sql mirrors these statements exactly
// (same tables, same columns). Keep the two in lockstep when changing either.
const PG_DDL = `
DO $$ BEGIN
  CREATE TYPE user_role_enum AS ENUM ('admin', 'checker', 'maker', 'staff');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  email text NOT NULL,
  role user_role_enum NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  sid text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

-- W2-5 (RISK-010): shared failed-login budget for cluster-wide login rate
-- limiting. One row per IP with a recent failed login; the atomic upsert in
-- the repository layer rolls an expired window over on the next hit, so this
-- table self-heals and the hourly sweeper only reclaims storage. Idempotent:
-- existing deployments get it automatically at boot (additive-only, W2-1 pattern).
CREATE TABLE IF NOT EXISTS rate_limit_hits (
  ip text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  fail_count integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS news (
  seq bigserial UNIQUE,
  id text PRIMARY KEY,
  title text NOT NULL,
  title_en text,
  summary text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  category_label text NOT NULL,
  badge text,
  badge_color text,
  image_url text,
  published_at text NOT NULL,
  published_at_ts timestamptz,
  read_time text,
  author text NOT NULL,
  department text NOT NULL,
  is_important_alert boolean NOT NULL DEFAULT false,
  views integer NOT NULL DEFAULT 0,
  sync_to_external boolean NOT NULL DEFAULT false,
  external_sync_status text,
  external_category text,
  attachment_url text,
  attachment_name text,
  approved_by text,
  approved_at text,
  submitted_by text,
  submitted_at text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_news_category ON news (category);
CREATE INDEX IF NOT EXISTS idx_news_sync_status ON news (external_sync_status);
-- W2-1 (FR-NEWS-009): additive columns for existing deployments — CREATE TABLE
-- IF NOT EXISTS does not touch tables that already exist, so the submitter
-- identity columns are ensured here (idempotent, no data change).
ALTER TABLE news ADD COLUMN IF NOT EXISTS submitted_by text;
ALTER TABLE news ADD COLUMN IF NOT EXISTS submitted_at text;

CREATE TABLE IF NOT EXISTS banners (
  seq bigserial UNIQUE,
  id text PRIMARY KEY,
  title text NOT NULL,
  subtitle text NOT NULL,
  badge text NOT NULL,
  image_url text NOT NULL,
  action_url text NOT NULL,
  action_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_banners_order ON banners (sort_order ASC);

CREATE TABLE IF NOT EXISTS contacts (
  seq bigserial UNIQUE,
  id text PRIMARY KEY,
  name text NOT NULL,
  name_en text NOT NULL,
  position text NOT NULL,
  department text NOT NULL,
  extension text NOT NULL,
  direct_phone text,
  email text NOT NULL,
  floor text NOT NULL,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contacts_dept ON contacts (department);
CREATE INDEX IF NOT EXISTS idx_contacts_ext ON contacts (extension);

CREATE TABLE IF NOT EXISTS meeting_rooms (
  seq bigserial UNIQUE,
  id text PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL,
  floor text NOT NULL,
  capacity integer NOT NULL,
  facilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL,
  current_booking jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  seq bigserial UNIQUE,
  id text PRIMARY KEY,
  title text NOT NULL,
  title_en text NOT NULL,
  category text NOT NULL,
  department text NOT NULL,
  version text NOT NULL,
  updated_at text NOT NULL,
  file_size text NOT NULL,
  download_url text NOT NULL,
  is_new boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  row_updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_docs_category ON documents (category);

CREATE TABLE IF NOT EXISTS sync_logs (
  seq bigserial UNIQUE,
  id text PRIMARY KEY,
  timestamp text NOT NULL,
  item_id text NOT NULL,
  item_title text NOT NULL,
  action text NOT NULL,
  status text NOT NULL,
  target_endpoint text NOT NULL,
  synced_by text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sync_logs_ts ON sync_logs (seq DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  seq bigserial UNIQUE,
  id text PRIMARY KEY,
  timestamp text NOT NULL,
  actor text NOT NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  target_resource text NOT NULL,
  resource_id text NOT NULL,
  details text NOT NULL,
  ip_address text,
  status text NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs (actor);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs (seq DESC);

CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- documents.updated_at is the human-readable label from the app, so its row
-- timestamp lives in a dedicated column instead.
CREATE OR REPLACE FUNCTION update_row_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.row_updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_news_modtime ON news;
CREATE TRIGGER update_news_modtime BEFORE UPDATE ON news
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS update_banners_modtime ON banners;
CREATE TRIGGER update_banners_modtime BEFORE UPDATE ON banners
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS update_contacts_modtime ON contacts;
CREATE TRIGGER update_contacts_modtime BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS update_meeting_rooms_modtime ON meeting_rooms;
CREATE TRIGGER update_meeting_rooms_modtime BEFORE UPDATE ON meeting_rooms
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS update_documents_modtime ON documents;
CREATE TRIGGER update_documents_modtime BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_row_timestamp_column();

DROP TRIGGER IF EXISTS update_users_modtime ON users;
CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
`;

// snake_case column <-> camelCase TS field mappers (one per entity)

interface PgRow {
  [column: string]: unknown;
}

function newsFromRow(row: PgRow): NewsItem {
  return {
    id: String(row.id),
    title: String(row.title),
    titleEn: (row.title_en as string) ?? undefined,
    summary: String(row.summary),
    content: String(row.content),
    category: row.category as NewsCategory,
    categoryLabel: String(row.category_label),
    badge: (row.badge as string) ?? undefined,
    badgeColor: row.badge_color as NewsItem['badgeColor'],
    imageUrl: (row.image_url as string) ?? undefined,
    publishedAt: String(row.published_at),
    readTime: (row.read_time as string) ?? undefined,
    author: String(row.author),
    department: String(row.department),
    isImportantAlert: Boolean(row.is_important_alert),
    views: Number(row.views),
    syncToExternal: Boolean(row.sync_to_external),
    externalSyncStatus: row.external_sync_status as NewsItem['externalSyncStatus'],
    externalCategory: row.external_category as NewsItem['externalCategory'],
    attachmentUrl: (row.attachment_url as string) ?? undefined,
    attachmentName: (row.attachment_name as string) ?? undefined,
    approvedBy: (row.approved_by as string) ?? undefined,
    approvedAt: (row.approved_at as string) ?? undefined,
    submittedBy: (row.submitted_by as string) ?? undefined,
    submittedAt: (row.submitted_at as string) ?? undefined,
  };
}

function bannerFromRow(row: PgRow): BannerSlide {
  return {
    id: String(row.id),
    title: String(row.title),
    subtitle: String(row.subtitle),
    badge: String(row.badge),
    imageUrl: String(row.image_url),
    actionUrl: String(row.action_url),
    actionText: String(row.action_text),
    order: Number(row.sort_order),
    isActive: Boolean(row.is_active),
  };
}

function contactFromRow(row: PgRow): DirectoryContact {
  return {
    id: String(row.id),
    name: String(row.name),
    nameEn: String(row.name_en),
    position: String(row.position),
    department: String(row.department),
    extension: String(row.extension),
    directPhone: (row.direct_phone as string) ?? undefined,
    email: String(row.email),
    floor: String(row.floor),
    avatarUrl: (row.avatar_url as string) ?? undefined,
  };
}

// node-postgres already parses json/jsonb columns into JS values; only parse
// when the driver hands us a raw string (e.g. text-typed results).
function parseJsonField<T>(value: unknown): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return JSON.parse(value) as T;
  return value as T;
}

function roomFromRow(row: PgRow): MeetingRoom {
  return {
    id: String(row.id),
    name: String(row.name),
    code: String(row.code),
    floor: String(row.floor),
    capacity: Number(row.capacity),
    facilities: parseJsonField<string[]>(row.facilities) ?? [],
    status: row.status as MeetingRoom['status'],
    currentBooking: parseJsonField<MeetingRoom['currentBooking']>(row.current_booking),
  };
}

function documentFromRow(row: PgRow): PolicyDocument {
  return {
    id: String(row.id),
    title: String(row.title),
    titleEn: String(row.title_en),
    category: row.category as PolicyDocument['category'],
    department: String(row.department),
    version: String(row.version),
    updatedAt: String(row.updated_at),
    fileSize: String(row.file_size),
    downloadUrl: String(row.download_url),
    isNew: Boolean(row.is_new),
  };
}

function syncLogFromRow(row: PgRow): SyncLog {
  return {
    id: String(row.id),
    timestamp: String(row.timestamp),
    itemId: String(row.item_id),
    itemTitle: String(row.item_title),
    action: row.action as SyncLog['action'],
    status: row.status as SyncLog['status'],
    targetEndpoint: String(row.target_endpoint),
    syncedBy: String(row.synced_by),
  };
}

function auditLogFromRow(row: PgRow): AuditLog {
  return {
    id: String(row.id),
    timestamp: String(row.timestamp),
    actor: String(row.actor),
    actorRole: String(row.actor_role),
    action: row.action as AuditLog['action'],
    targetResource: String(row.target_resource),
    resourceId: String(row.resource_id),
    details: String(row.details),
    ipAddress: (row.ip_address as string) ?? undefined,
    status: row.status as AuditLog['status'],
  };
}

function userFromRow(row: PgRow): User {
  return {
    id: String(row.id),
    username: String(row.username),
    passwordHash: String(row.password_hash),
    displayName: String(row.display_name),
    email: String(row.email),
    role: row.role as UserRole,
    createdAt: new Date(row.created_at as string).toISOString(),
    isActive: Boolean(row.is_active),
  };
}

// W2-FIX-1 (codex blocker 4): shared statement text + value tuples so the
// standalone repo methods and the transactional runNewsTransition execute
// byte-identical SQL — the atomic path can never drift from saveNews et al.
const NEWS_UPDATE_SQL = `UPDATE news SET title = $2, title_en = $3, summary = $4, content = $5, category = $6, category_label = $7,
  badge = $8, badge_color = $9, image_url = $10, published_at = $11, read_time = $12, author = $13,
  department = $14, is_important_alert = $15, views = $16, sync_to_external = $17, external_sync_status = $18,
  external_category = $19, attachment_url = $20, attachment_name = $21, approved_by = $22, approved_at = $23,
  submitted_by = $24, submitted_at = $25
 WHERE id = $1`;

function newsUpdateValues(item: NewsItem): unknown[] {
  return [
    item.id, item.title, item.titleEn ?? null, item.summary, item.content, item.category, item.categoryLabel,
    item.badge ?? null, item.badgeColor ?? null, item.imageUrl ?? null, item.publishedAt, item.readTime ?? null,
    item.author, item.department, item.isImportantAlert ?? false, item.views ?? 0, item.syncToExternal ?? false,
    item.externalSyncStatus ?? null, item.externalCategory ?? null, item.attachmentUrl ?? null,
    item.attachmentName ?? null, item.approvedBy ?? null, item.approvedAt ?? null,
    item.submittedBy ?? null, item.submittedAt ?? null,
  ];
}

const AUDIT_INSERT_SQL = `INSERT INTO audit_logs (id, timestamp, actor, actor_role, action, target_resource, resource_id, details, ip_address, status)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  ON CONFLICT (id) DO NOTHING`;

function auditInsertValues(item: AuditLog): unknown[] {
  return [item.id, item.timestamp, item.actor, item.actorRole, item.action, item.targetResource, item.resourceId, item.details, item.ipAddress ?? null, item.status];
}

const SYNCLOG_INSERT_SQL = `INSERT INTO sync_logs (id, timestamp, item_id, item_title, action, status, target_endpoint, synced_by)
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
  ON CONFLICT (id) DO NOTHING`;

function syncLogInsertValues(item: SyncLog): unknown[] {
  return [item.id, item.timestamp, item.itemId, item.itemTitle, item.action, item.status, item.targetEndpoint, item.syncedBy];
}

class PostgresRepository implements Repository {
  readonly mode = 'postgres' as const;
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
    });
    // Out-of-band server termination (e.g. `docker compose stop postgres`) surfaces as a
    // Pool 'error' event, not a query rejection: log and keep serving — /readyz reports
    // 503 and the pool re-connects on demand. Unhandled, this event crashes the process.
    this.pool.on('error', (err) => {
      console.error('[Persistence] Idle/client pool error (server may have terminated connections):', err instanceof Error ? err.message : err);
    });
  }

  async init(): Promise<void> {
    // Fail fast with a clear error when the database is unreachable (no silent
    // fallback in production — D3).
    await this.pool.query('SELECT 1');
    await this.pool.query(PG_DDL);
    await this.seedIfEmpty();
    console.log('[Persistence] PostgreSQL repository initialized (schema ensured, seed data applied where empty).');
  }

  /** Insert the initial demo dataset only into completely empty tables. */
  private async seedIfEmpty(): Promise<void> {
    // Tables listed newest-first in the API (unshift semantics) are seeded in
    // reverse so the bigserial ordering matches the in-memory array order.
    if (await this.isTableEmpty('news')) {
      for (const item of [...INITIAL_NEWS].reverse()) await this.insertNews(item);
    }
    if (await this.isTableEmpty('banners')) {
      for (const item of INITIAL_BANNERS) await this.insertBanner(item);
    }
    if (await this.isTableEmpty('contacts')) {
      for (const item of INITIAL_CONTACTS) await this.insertContact(item);
    }
    if (await this.isTableEmpty('meeting_rooms')) {
      for (const item of INITIAL_ROOMS) await this.saveRoom(item);
    }
    if (await this.isTableEmpty('documents')) {
      for (const item of [...INITIAL_DOCUMENTS].reverse()) await this.insertDocument(item);
    }
    if (await this.isTableEmpty('sync_logs')) {
      for (const item of [...INITIAL_SYNC_LOGS].reverse()) await this.insertSyncLog(item);
    }
    if (await this.isTableEmpty('audit_logs')) {
      for (const item of [...INITIAL_AUDIT_LOGS].reverse()) await this.insertAuditLog(item);
    }
  }

  private async isTableEmpty(table: string): Promise<boolean> {
    const result = await this.pool.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    return result.rows[0].count === 0;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async checkHealth(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async listUsers(): Promise<User[]> {
    const result = await this.pool.query('SELECT * FROM users ORDER BY created_at, username');
    return result.rows.map(userFromRow);
  }
  async findUserByUsername(username: string): Promise<User | null> {
    const result = await this.pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1', [
      username.trim(),
    ]);
    return result.rows[0] ? userFromRow(result.rows[0]) : null;
  }
  async findUserById(id: string): Promise<User | null> {
    const result = await this.pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
    return result.rows[0] ? userFromRow(result.rows[0]) : null;
  }
  async insertUser(user: User): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (id, username, password_hash, display_name, email, role, created_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [user.id, user.username, user.passwordHash, user.displayName, user.email, user.role, user.createdAt, user.isActive]
    );
  }
  async saveUser(user: User): Promise<void> {
    await this.pool.query(
      `UPDATE users SET username = $2, password_hash = $3, display_name = $4, email = $5, role = $6, is_active = $7
       WHERE id = $1`,
      [user.id, user.username, user.passwordHash, user.displayName, user.email, user.role, user.isActive]
    );
  }

  async insertSession(record: SessionRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO sessions (sid, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (sid) DO NOTHING`,
      [record.sid, record.userId, new Date(record.createdAt), new Date(record.expiresAt)]
    );
  }
  async findSession(sid: string): Promise<SessionRecord | null> {
    const result = await this.pool.query('SELECT sid, user_id, created_at, expires_at FROM sessions WHERE sid = $1 LIMIT 1', [sid]);
    const row = result.rows[0];
    if (!row) return null;
    return {
      sid: String(row.sid),
      userId: String(row.user_id),
      createdAt: new Date(row.created_at).getTime(),
      expiresAt: new Date(row.expires_at).getTime(),
    };
  }
  async deleteSession(sid: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE sid = $1', [sid]);
  }
  async deleteExpiredSessions(): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
  }

  async consumeLoginBudget(ip: string): Promise<{ count: number; retryAfterSec: number }> {
    // Atomic window-rollover-and-increment in ONE statement: ON CONFLICT DO
    // UPDATE takes the row lock, so concurrent pods racing on the same IP can
    // never lose counts. An expired window resets fail_count to 1 and slides
    // window_start to now; otherwise fail_count increments within the window.
    const result = await this.pool.query(
      `INSERT INTO rate_limit_hits (ip, window_start, fail_count)
       VALUES ($1, now(), 1)
       ON CONFLICT (ip) DO UPDATE SET
         window_start = CASE WHEN rate_limit_hits.window_start < now() - make_interval(secs => $2)
                             THEN now() ELSE rate_limit_hits.window_start END,
         fail_count   = CASE WHEN rate_limit_hits.window_start < now() - make_interval(secs => $2)
                             THEN 1 ELSE rate_limit_hits.fail_count + 1 END
       RETURNING fail_count,
         GREATEST(0, CEIL(EXTRACT(epoch FROM window_start + make_interval(secs => $2) - now())))::int AS retry_after_sec`,
      [ip, LOGIN_RATE_WINDOW_SEC]
    );
    const row = result.rows[0];
    return { count: Number(row.fail_count), retryAfterSec: Number(row.retry_after_sec) };
  }
  async releaseLoginBudget(ip: string): Promise<void> {
    await this.pool.query('UPDATE rate_limit_hits SET fail_count = GREATEST(0, fail_count - 1) WHERE ip = $1', [ip]);
  }
  async clearLoginBudget(ip: string): Promise<void> {
    await this.pool.query('DELETE FROM rate_limit_hits WHERE ip = $1', [ip]);
  }
  async purgeStaleLoginBudgets(): Promise<void> {
    // One hour = window + grace; purely storage reclamation — the upsert
    // self-heals expired windows, so correctness never depends on this sweep.
    await this.pool.query("DELETE FROM rate_limit_hits WHERE window_start < now() - interval '1 hour'");
  }

  async listNews(): Promise<NewsItem[]> {
    const result = await this.pool.query('SELECT * FROM news ORDER BY seq DESC');
    return result.rows.map(newsFromRow);
  }
  async findNews(id: string): Promise<NewsItem | null> {
    const result = await this.pool.query('SELECT * FROM news WHERE id = $1 LIMIT 1', [id]);
    return result.rows[0] ? newsFromRow(result.rows[0]) : null;
  }
  async insertNews(item: NewsItem): Promise<void> {
    await this.pool.query(
      `INSERT INTO news (id, title, title_en, summary, content, category, category_label, badge, badge_color,
        image_url, published_at, read_time, author, department, is_important_alert, views, sync_to_external,
        external_sync_status, external_category, attachment_url, attachment_name, approved_by, approved_at,
        submitted_by, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
       ON CONFLICT (id) DO NOTHING`,
      [
        item.id, item.title, item.titleEn ?? null, item.summary, item.content, item.category, item.categoryLabel,
        item.badge ?? null, item.badgeColor ?? null, item.imageUrl ?? null, item.publishedAt, item.readTime ?? null,
        item.author, item.department, item.isImportantAlert ?? false, item.views ?? 0, item.syncToExternal ?? false,
        item.externalSyncStatus ?? null, item.externalCategory ?? null, item.attachmentUrl ?? null,
        item.attachmentName ?? null, item.approvedBy ?? null, item.approvedAt ?? null,
        item.submittedBy ?? null, item.submittedAt ?? null,
      ]
    );
  }
  async saveNews(item: NewsItem): Promise<void> {
    await this.pool.query(NEWS_UPDATE_SQL, newsUpdateValues(item));
  }
  async runNewsTransition<R>(
    id: string,
    plan: (locked: NewsItem | null) => NewsTransitionPlan<R>
  ): Promise<R> {
    // W2-FIX-3 (codex cycle-2 mandate): BEGIN → SELECT ... FOR UPDATE → plan
    // → UPDATE → audit/sync-log INSERTs → COMMIT. The row lock IS the
    // cross-pod serialization point: under READ COMMITTED a blocked
    // SELECT ... FOR UPDATE re-reads the LATEST COMMITTED row when the lock
    // is granted, so the plan's guards always evaluate fresh state — two pods
    // can never both pass guards on stale snapshots and last-commit-wins.
    // Guards that fail return readonly: the empty transaction COMMITs with NO
    // writes. Any failure (including the SMOKE_INJECT_AUDIT_FAILURE test hook,
    // which fires after the UPDATE and before the audit insert) rolls back
    // state + audit together — a committed transition without its audit row
    // is impossible, and vice versa.
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // W2-FIX-4 test hooks (PG only — see the hook block near the IS_PRODUCTION
      // guards): SIMULATE_STALE_READ reads the row UNLOCKED and skips the FOR
      // UPDATE select entirely, faithfully reproducing the pre-W2-FIX-3
      // stale-read shape that smoke §18 Family N must be able to detect.
      const sel = SIMULATE_STALE_READ
        ? await client.query('SELECT * FROM news WHERE id = $1 LIMIT 1', [id])
        : await client.query('SELECT * FROM news WHERE id = $1 LIMIT 1 FOR UPDATE', [id]);
      const locked = sel.rows[0] ? newsFromRow(sel.rows[0]) : null;
      const p = plan(locked);
      if (p.kind === 'commit') {
        // W2-FIX-6 pause hook: the TEST HARNESS holds the session-level
        // advisory lock on this key, so this transaction BLOCKS here until
        // the harness releases it — no timer window exists. In normal mode
        // the FOR UPDATE row lock is HELD across the pause (the deterministic
        // lock-handoff point smoke §18 Family O exercises); in
        // SIMULATE_STALE_READ mode the pause holds the unlocked, lock-free
        // window open (the negative control). pg_advisory_xact_lock is
        // transaction-level: it auto-releases at COMMIT/ROLLBACK, so pooled
        // server connections can never leak the lock.
        if (NEWS_PAUSE_ADVISORY_KEY > 0) {
          await client.query('SELECT pg_advisory_xact_lock($1)', [NEWS_PAUSE_ADVISORY_KEY]);
        }
        await client.query(NEWS_UPDATE_SQL, newsUpdateValues(p.next));
        // The hook means "audit-write failure": it fires only when an audit
        // row is imminent (after the UPDATE, immediately before the audit
        // insert). An audit-less commit (ordinary draft PUT) has no audit
        // write to fail — it commits 200 exactly as the pre-W2-FIX-3 saveNews
        // path did under injection.
        if (p.audit && AUDIT_FAILURE_INJECTION) {
          throw new Error('[TEST HOOK] injected audit-write failure (SMOKE_INJECT_AUDIT_FAILURE)');
        }
        if (p.audit) await client.query(AUDIT_INSERT_SQL, auditInsertValues(p.audit));
        if (p.syncLog) await client.query(SYNCLOG_INSERT_SQL, syncLogInsertValues(p.syncLog));
      }
      await client.query('COMMIT');
      return p.result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {
        /* connection-level failure already aborts the tx */
      });
      throw err;
    } finally {
      client.release();
    }
  }
  async deleteNews(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM news WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  async listBanners(): Promise<BannerSlide[]> {
    const result = await this.pool.query('SELECT * FROM banners ORDER BY seq ASC');
    return result.rows.map(bannerFromRow);
  }
  async findBanner(id: string): Promise<BannerSlide | null> {
    const result = await this.pool.query('SELECT * FROM banners WHERE id = $1 LIMIT 1', [id]);
    return result.rows[0] ? bannerFromRow(result.rows[0]) : null;
  }
  async insertBanner(item: BannerSlide): Promise<void> {
    await this.pool.query(
      `INSERT INTO banners (id, title, subtitle, badge, image_url, action_url, action_text, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [item.id, item.title ?? '', item.subtitle ?? '', item.badge, item.imageUrl, item.actionUrl, item.actionText, item.order, item.isActive]
    );
  }
  async saveBanner(item: BannerSlide): Promise<void> {
    await this.pool.query(
      `UPDATE banners SET title = $2, subtitle = $3, badge = $4, image_url = $5, action_url = $6, action_text = $7,
        sort_order = $8, is_active = $9
       WHERE id = $1`,
      [item.id, item.title ?? '', item.subtitle ?? '', item.badge, item.imageUrl, item.actionUrl, item.actionText, item.order, item.isActive]
    );
  }
  async deleteBanner(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM banners WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  async listContacts(): Promise<DirectoryContact[]> {
    const result = await this.pool.query('SELECT * FROM contacts ORDER BY seq ASC');
    return result.rows.map(contactFromRow);
  }
  async findContact(id: string): Promise<DirectoryContact | null> {
    const result = await this.pool.query('SELECT * FROM contacts WHERE id = $1 LIMIT 1', [id]);
    return result.rows[0] ? contactFromRow(result.rows[0]) : null;
  }
  async insertContact(item: DirectoryContact): Promise<void> {
    await this.pool.query(
      `INSERT INTO contacts (id, name, name_en, position, department, extension, direct_phone, email, floor, avatar_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      [item.id, item.name ?? '', item.nameEn ?? '', item.position ?? '', item.department ?? '', item.extension ?? '', item.directPhone ?? null, item.email ?? '', item.floor ?? '', item.avatarUrl ?? null]
    );
  }
  async saveContact(item: DirectoryContact): Promise<void> {
    await this.pool.query(
      `UPDATE contacts SET name = $2, name_en = $3, position = $4, department = $5, extension = $6, direct_phone = $7,
        email = $8, floor = $9, avatar_url = $10
       WHERE id = $1`,
      [item.id, item.name ?? '', item.nameEn ?? '', item.position ?? '', item.department ?? '', item.extension ?? '', item.directPhone ?? null, item.email ?? '', item.floor ?? '', item.avatarUrl ?? null]
    );
  }
  async deleteContact(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM contacts WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  async listRooms(): Promise<MeetingRoom[]> {
    const result = await this.pool.query('SELECT * FROM meeting_rooms ORDER BY seq ASC');
    return result.rows.map(roomFromRow);
  }
  async findRoom(id: string): Promise<MeetingRoom | null> {
    const result = await this.pool.query('SELECT * FROM meeting_rooms WHERE id = $1 LIMIT 1', [id]);
    return result.rows[0] ? roomFromRow(result.rows[0]) : null;
  }
  async saveRoom(item: MeetingRoom): Promise<void> {
    await this.pool.query(
      `INSERT INTO meeting_rooms (id, name, code, floor, capacity, facilities, status, current_booking)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8::jsonb)
       ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, code = EXCLUDED.code, floor = EXCLUDED.floor, capacity = EXCLUDED.capacity,
        facilities = EXCLUDED.facilities, status = EXCLUDED.status, current_booking = EXCLUDED.current_booking`,
      [item.id, item.name ?? '', item.code ?? '', item.floor ?? '', item.capacity ?? 0, JSON.stringify(item.facilities ?? []), item.status, item.currentBooking ? JSON.stringify(item.currentBooking) : null]
    );
  }

  async listDocuments(): Promise<PolicyDocument[]> {
    const result = await this.pool.query('SELECT * FROM documents ORDER BY seq DESC');
    return result.rows.map(documentFromRow);
  }
  async insertDocument(item: PolicyDocument): Promise<void> {
    await this.pool.query(
      `INSERT INTO documents (id, title, title_en, category, department, version, updated_at, file_size, download_url, is_new)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      [item.id, item.title ?? '', item.titleEn ?? '', item.category ?? 'form', item.department ?? '', item.version ?? 'v1.0', item.updatedAt ?? '', item.fileSize ?? '', item.downloadUrl ?? '#', item.isNew ?? false]
    );
  }
  async deleteDocument(id: string): Promise<boolean> {
    const result = await this.pool.query('DELETE FROM documents WHERE id = $1', [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  async listSyncLogs(): Promise<SyncLog[]> {
    const result = await this.pool.query('SELECT * FROM sync_logs ORDER BY seq DESC');
    return result.rows.map(syncLogFromRow);
  }
  async insertSyncLog(item: SyncLog): Promise<void> {
    await this.pool.query(SYNCLOG_INSERT_SQL, syncLogInsertValues(item));
  }

  async listAuditLogs(): Promise<AuditLog[]> {
    const result = await this.pool.query('SELECT * FROM audit_logs ORDER BY seq DESC');
    return result.rows.map(auditLogFromRow);
  }
  async insertAuditLog(item: AuditLog): Promise<void> {
    await this.pool.query(AUDIT_INSERT_SQL, auditInsertValues(item));
  }
}

// ==========================================
// AUTHENTICATION & SESSION MANAGEMENT (D1)
// ==========================================

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_COOKIE = 'kbj_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const BCRYPT_COST = 12;

// Production guard: SESSION_SECRET is mandatory in production. In dev an ephemeral
// secret is generated (sessions simply reset on restart, which is fine locally).
let SESSION_SECRET = process.env.SESSION_SECRET || '';
if (!SESSION_SECRET) {
  if (IS_PRODUCTION) {
    console.error('FATAL: SESSION_SECRET must be set when NODE_ENV=production (32+ random characters).');
    process.exit(1);
  }
  SESSION_SECRET = crypto.randomBytes(32).toString('base64url');
  console.warn('[WARN] SESSION_SECRET not set — using ephemeral dev secret; sessions reset on restart.');
}

if (IS_PRODUCTION && !process.env.DATABASE_URL) {
  console.error(
    '[WARN] NODE_ENV=production without DATABASE_URL — running with IN-MEMORY stores. ' +
      'Data and sessions will be lost on restart / pod reschedule. Set DATABASE_URL for production use.'
  );
}

// ---- W2-FIX-1 test-only hooks (codex fix-cycle regression coverage) ----
// Both are opt-in via env var AND inert in production (same guard style as
// the dev-only paths above): a real deployment never sets SMOKE_* vars, and
// the NODE_ENV check keeps the hooks dead even if one leaks in.
// - SMOKE_INJECT_AUDIT_FAILURE=1: the atomic workflow-transition audit write
//   throws, proving state+audit commit/rollback together (blocker 4).
// - SMOKE_SEED_W2FIX1_FIXTURES=1: boot-seed two regression fixture rows — a
//   legacy pending submission (no submitter identity, blocker 2) and a live
//   synced item (withdrawal path, blocker 3).
const AUDIT_FAILURE_INJECTION =
  process.env.SMOKE_INJECT_AUDIT_FAILURE === '1' && !IS_PRODUCTION;
const SEED_W2FIX1_FIXTURES =
  process.env.SMOKE_SEED_W2FIX1_FIXTURES === '1' && !IS_PRODUCTION;

// ---- W2-FIX-4/W2-FIX-6 test-only hooks (codex fix-cycle regression
// coverage) ----
// Both are PG-topology test tools for smoke §18; the memory repository stays
// hook-free on purpose (single-process semantics have no cross-pod window to
// exercise). Inert unless env-set AND non-production, same guard style as
// the W2-FIX-1 hooks above.
// - SMOKE_NEWS_PAUSE_ADVISORY_KEY: a positive integer; when set, every
//   committed runNewsTransition executes SELECT pg_advisory_xact_lock($key)
//   after the plan decides 'commit' and BEFORE the UPDATE. The TEST HARNESS
//   holds the session-level advisory lock on that key, so the transaction
//   BLOCKS there until the harness explicitly releases it — in normal mode
//   the FOR UPDATE row lock is held ACROSS the pause (the deterministic
//   lock-handoff point smoke §18 Family O exercises); in
//   SMOKE_SIMULATE_STALE_READ mode the pause holds the unlocked window open
//   with NO lock held (the negative control). Transaction-level advisory
//   locks auto-release at COMMIT/ROLLBACK, so pooled server connections can
//   never leak the lock. (Retired in W2-FIX-6: the
//   SMOKE_DELAY_NEWS_COMMIT_MS sleep hook this replaces resumed
//   automatically after N ms, so the harness controlled nothing.)
// - SMOKE_SIMULATE_STALE_READ=1: faithfully reproduce the PRE-W2-FIX-3
//   behavior — read the row WITHOUT FOR UPDATE, run the plan against that
//   unlocked snapshot, and skip the FOR UPDATE select entirely (guards on a
//   stale read; the UPDATE then clobbers by id). Exists so smoke §18
//   Family N can prove the regression suite DETECTS the former stale-read
//   defect.
const NEWS_PAUSE_ADVISORY_KEY = IS_PRODUCTION
  ? 0
  : Math.max(0, Math.trunc(Number(process.env.SMOKE_NEWS_PAUSE_ADVISORY_KEY) || 0));
const SIMULATE_STALE_READ =
  process.env.SMOKE_SIMULATE_STALE_READ === '1' && !IS_PRODUCTION;

function toSafeUser(user: User): SafeUser {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

async function createUser(input: {
  username: string;
  password: string;
  displayName: string;
  email: string;
  role: UserRole;
}): Promise<User> {
  const user: User = {
    id: crypto.randomUUID(),
    username: input.username.trim(),
    passwordHash: await bcrypt.hash(input.password, BCRYPT_COST),
    displayName: input.displayName.trim(),
    email: input.email.trim(),
    role: input.role,
    createdAt: new Date().toISOString(),
    isActive: true,
  };
  await repo.insertUser(user);
  return user;
}

// ---- Signed session tokens: "<sid>.<HMAC-SHA256(sid)>" ----
function signValue(value: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

function createSessionToken(sid: string): string {
  return `${sid}.${signValue(sid)}`;
}

function verifySessionToken(token: string): string | null {
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;
  const sid = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = signValue(sid);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return sid;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      cookies[name] = part.slice(eq + 1).trim();
    }
  }
  return cookies;
}

async function createSession(userId: string): Promise<string> {
  const sid = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  await repo.insertSession({ sid, userId, createdAt: now, expiresAt: now + SESSION_TTL_MS });
  return createSessionToken(sid);
}

async function resolveSession(token: string): Promise<User | null> {
  const sid = verifySessionToken(token);
  if (!sid) return null;
  const record = await repo.findSession(sid);
  if (!record || record.expiresAt < Date.now()) {
    if (record) await repo.deleteSession(sid);
    return null;
  }
  const user = await repo.findUserById(record.userId);
  if (!user || !user.isActive) return null;
  return user;
}

async function destroySession(token: string): Promise<SessionRecord | null> {
  const sid = verifySessionToken(token);
  if (!sid) return null;
  const record = await repo.findSession(sid);
  await repo.deleteSession(sid);
  return record;
}

// Periodic sweep of expired sessions (hourly; unref'd so it never holds the process open)
let sessionSweeper: NodeJS.Timeout | null = null;

// Precomputed hash so failed logins for unknown users run the same bcrypt work as
// real ones — keeps login timing uniform (no username enumeration via response time).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(24).toString('base64url'), BCRYPT_COST);

// Attach the resolved user to the request for downstream handlers
declare global {
  namespace Express {
    interface Request {
      user?: SafeUser;
    }
  }
}

const requireAuth: express.RequestHandler = async (req, res, next) => {
  try {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    const user = token ? await resolveSession(token) : null;
    if (!user) {
      // AUD-P07 (W2-3, lead-ruled trim): a session cookie that was presented
      // but failed validation (tampered signature, unknown/expired sid,
      // deactivated user) is an attack signal — audit it. 401s with no cookie
      // (plain anon probes) stay request-log-only by design: the JSON request
      // logger already records them, and duplicating them into the capped
      // audit store would evict real security events. See doc 10 §9.1.
      if (token) {
        await recordAudit({
          actor: 'anonymous',
          actorRole: 'Anonymous',
          action: 'ACCESS_DENIED',
          targetResource: 'API Access Control',
          resourceId: `${req.method} ${req.path}`,
          details: `Denied ${req.method} ${req.path} - presented session cookie failed validation.`,
          ipAddress: req.ip,
          status: 'WARNING',
        });
      }
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    req.user = toSafeUser(user);
    next();
  } catch (err) {
    next(err);
  }
};

function requireRole(...allowedRoles: UserRole[]): express.RequestHandler {
  return async (req, res, next) => {
    if (!req.user) {
      // Unreachable in practice (every requireRole mount sits behind
      // requireAuth, which owns the presented-cookie 401 audit above) —
      // defense-in-depth only.
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      // AUD-P07 (W2-3): every authenticated 403 is audited unconditionally —
      // privilege probing must be visible to compliance. Lead-ruled coverage;
      // see doc 10 §9.1.
      //
      // The access decision stands regardless of the audit-write outcome:
      // Express 4 does not catch rejected middleware promises, so an unwrapped
      // await here would leave the 403 unsent and the request hanging until
      // client timeout. A failed audit write logs the error and the denial
      // still sends.
      try {
        await recordAudit({
          actor: req.user!.username,
          actorRole: ROLE_LABELS[req.user!.role],
          action: 'ACCESS_DENIED',
          targetResource: 'API Access Control',
          resourceId: `${req.method} ${req.path}`,
          details: `Denied ${req.method} ${req.path} - role '${req.user!.role}' not in [${allowedRoles.join(', ')}].`,
          ipAddress: req.ip,
          status: 'WARNING',
        });
      } catch (auditErr) {
        console.error('[Audit] Failed to record ACCESS_DENIED 403 audit:', auditErr instanceof Error ? auditErr.message : auditErr);
      }
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
}

// Rejects blank resource ids (e.g. whitespace-only) on :id mutation routes with
// a clean 400 instead of a confusing 404 — defense in depth behind the early
// /api resource-id guard above.
const requireResourceId: express.RequestHandler = (req, res, next) => {
  const id = req.params.id;
  if (typeof id !== 'string' || !id.trim()) {
    return res.status(400).json({ success: false, error: 'Resource id is required' });
  }
  next();
};

// Maker-checker workflow fields are SERVER-CONTROLLED (FR-NEWS-009, W2-1):
// no client payload may set publication state or approval stamps — 'synced'
// is reachable only through the checker approve endpoint, for every role
// including admin. Stripping lives here at the validation layer (on the
// request body itself) so every current and future news mutation endpoint
// (create, update, bulk) inherits the rule without per-route repetition.
const NEWS_WORKFLOW_FIELDS = ['externalSyncStatus', 'approvedBy', 'approvedAt', 'syncToExternal'] as const;

function stripNewsWorkflowFields(body: Record<string, unknown> | undefined): void {
  if (!body) return;
  for (const field of NEWS_WORKFLOW_FIELDS) {
    delete body[field];
  }
}

// W2-FIX-1 (codex blocker 1): per-item async critical section for EVERY news
// workflow mutation (create, PUT, submit, approve, reject, withdraw). A
// chained-promise mutex keyed by item id: concurrent requests for the same
// item serialize, and each one re-reads the item INSIDE the lock — a
// concurrent edit commits first and IS seen by the state guards, so
// "edit commits between read and approve" can never yield synced-with-
// stale-content (the edit wins → approve 400s; approve wins → the next PUT
// forced-resets the approved content back to draft). No lost update in any
// interleaving. W2-FIX-3: this lock is the SAME-POD serializer; the
// cross-pod serialization point is the SELECT ... FOR UPDATE re-read inside
// runNewsTransition (PG mode), which makes the guards evaluate the latest
// committed row even when a different pod's transaction wins the race.
const newsWorkflowLocks = new Map<string, Promise<void>>();

function withNewsLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = newsWorkflowLocks.get(id) ?? Promise.resolve();
  const run = prev.then(fn);
  // The tail future callers chain onto never rejects — one failed mutation
  // must not poison the lock for the next requester.
  const tail = run.then(() => undefined, () => undefined);
  newsWorkflowLocks.set(id, tail);
  void tail.then(() => {
    if (newsWorkflowLocks.get(id) === tail) newsWorkflowLocks.delete(id);
  });
  return run;
}

// Login rate limiting: 5 failed attempts per minute per IP (D1), counted in
// the ACTIVE repository (W2-5, RISK-010). The store adapter below delegates
// to `repo` at request time — the module-level default instance serves dev
// wiring, and startServer() swaps in the PostgreSQL repository (which shares
// the budget across every pod) before the port opens, so the limiter always
// counts against the live repository.
//
// FAIL-OPEN POLICY (Lead-confirmed 2026-09-10): if the shared store errors,
// the request proceeds WITHOUT consuming budget. Rationale: rate limiting
// here is defense-in-depth (bcrypt cost 12 + uniform login timing + the
// LOGIN_FAILED audit trail all remain), a full database outage already
// blocks credential verification, and fail-closed would convert a transient
// database blip into a lockout of every user. Every fail-open emits a
// WARNING with the underlying error and a process-local monotonic counter
// ("degradation event #N this process") so system-test reporting
// (deliverable 17) can count degraded events from logs. Counter resets on
// restart. The CTO may overrule at the codex gate — the decision lives
// entirely in withLoginStoreFailOpen below.
let loginStoreDegradationEvents = 0;

async function withLoginStoreFailOpen<T>(
  op: () => Promise<T>,
  fallback: T,
  action: string
): Promise<T> {
  try {
    return await op();
  } catch (err) {
    loginStoreDegradationEvents += 1;
    console.warn(
      `[LoginRateLimit] shared store unavailable, failing open (degradation event #${loginStoreDegradationEvents} this process) during ${action}:`,
      err instanceof Error ? err.message : err
    );
    return fallback;
  }
}

const sharedLoginBudgetStore: Store = {
  async increment(key: string): Promise<IncrementResponse> {
    const { count, retryAfterSec } = await withLoginStoreFailOpen(
      () => repo.consumeLoginBudget(key),
      { count: 0, retryAfterSec: LOGIN_RATE_WINDOW_SEC },
      'increment'
    );
    return {
      totalHits: count,
      resetTime: new Date(Date.now() + retryAfterSec * 1000),
    };
  },
  async decrement(key: string): Promise<void> {
    // Only reached on successful responses (skipSuccessfulRequests): release
    // one budget unit so legitimate rapid logins never self-lockout.
    await withLoginStoreFailOpen(() => repo.releaseLoginBudget(key), undefined, 'decrement');
  },
  async resetKey(key: string): Promise<void> {
    await withLoginStoreFailOpen(() => repo.clearLoginBudget(key), undefined, 'resetKey');
  },
};

const loginLimiter = rateLimit({
  windowMs: LOGIN_RATE_WINDOW_SEC * 1000,
  limit: LOGIN_RATE_LIMIT,
  store: sharedLoginBudgetStore,
  // Only FAILED logins consume the budget (fail2ban-style): brute-force is
  // throttled while legitimate rapid logins / test suites never self-lockout.
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ success: false, error: 'Too many login attempts. Please try again in a minute.' });
  },
});

// Server-side audit trail helper — the actor always comes from the authenticated
// session (or the attempted username for failed logins), never from client input.
type AuditEntryInput = {
  actor: string;
  actorRole: string;
  action: AuditLog['action'];
  targetResource: string;
  resourceId: string;
  details: string;
  ipAddress?: string;
  status: AuditLog['status'];
};

// Pure construction — no store write. W2-FIX-1: the atomic workflow
// transitions build their audit row with this and hand it to
// repo.runNewsTransition so state + audit commit (or roll back) together;
// recordAudit remains the direct write path for post-transition denial
// audits (which run on their own connection by design).
function buildAuditEntry(entry: AuditEntryInput): AuditLog {
  return {
    id: `audit-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    ...entry,
    ipAddress: entry.ipAddress ?? undefined,
  };
}

async function recordAudit(entry: AuditEntryInput): Promise<AuditLog> {
  const auditEntry = buildAuditEntry(entry);
  await repo.insertAuditLog(auditEntry);
  return auditEntry;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  checker: 'Checker (Compliance / VP)',
  maker: 'Maker (Author)',
  staff: 'Staff (Read-only)',
};

// The active repository — assigned in startServer() based on DATABASE_URL.
// The in-memory instance is created eagerly so module-level route wiring has a
// concrete object; startServer replaces it with the PostgreSQL implementation
// before the port opens (routes only run after listen).
let repo: Repository = new InMemoryRepository();

// ==========================================
// KUBERNETES HEALTH CHECK & PROBE ENDPOINTS
// ==========================================

// Liveness Probe (kubelet uses this to know when to restart a container)
app.get(['/healthz', '/health', '/api/health'], (req, res) => {
  res.status(200).json({
    status: 'healthy',
    probe: 'liveness',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    service: 'kbj-intranet-portal',
    version: '2.0.0',
    k8s: {
      podName: process.env.HOSTNAME || 'kbj-intranet-pod-local',
      namespace: process.env.POD_NAMESPACE || 'kbj-intranet',
      nodeName: process.env.NODE_NAME || 'node-prod-asia-se1',
      cluster: 'k8s-prod-cluster-01',
    },
  });
});

// Readiness Probe (kubelet uses this to know when a container is ready to accept traffic)
app.get(['/readyz', '/ready', '/api/ready'], async (req, res) => {
  if (repo.mode === 'postgres') {
    const dbOk = await repo.checkHealth();
    if (!dbOk) {
      return res.status(503).json({
        status: 'not_ready',
        probe: 'readiness',
        reason: 'Database unavailable',
      });
    }
    return res.status(200).json({
      status: 'ready',
      probe: 'readiness',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        cache: 'ready',
        cmsStore: 'initialized',
      },
    });
  }

  // Check if critical stores are hydrated
  const isReady = (await repo.listNews()).length > 0 && (await repo.listContacts()).length > 0;
  if (isReady) {
    res.status(200).json({
      status: 'ready',
      probe: 'readiness',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected',
        cache: 'ready',
        cmsStore: 'initialized',
      },
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      probe: 'readiness',
      reason: 'Stores initializing',
    });
  }
});

// ==========================================
// BUSINESS REST APIS
// ==========================================

// 1. News & Corporate Announcements API
app.get('/api/news', async (req, res) => {
  const { category, search } = req.query;
  let filtered = await repo.listNews();

  if (category && category !== 'all') {
    filtered = filtered.filter((n) => n.category === category);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.titleEn && n.titleEn.toLowerCase().includes(q)) ||
        n.summary.toLowerCase().includes(q) ||
        n.department.toLowerCase().includes(q)
    );
  }

  res.json({ data: filtered, total: filtered.length });
});

app.post('/api/news', requireAuth, requireRole('maker', 'admin'), async (req, res, next) => {
  // FR-NEWS-009: workflow fields are server-controlled — a create can never
  // yield 'synced' regardless of role or payload (strict dual-control ruling).
  stripNewsWorkflowFields(req.body);
  const newItem: NewsItem = {
    id: req.body.id || `news-${Date.now()}`,
    title: req.body.title || 'ประกาศใหม่',
    titleEn: req.body.titleEn || '',
    summary: req.body.summary || '',
    content: req.body.content || '',
    category: req.body.category || 'kbj-news',
    categoryLabel: req.body.categoryLabel || 'News',
    badge: req.body.badge || 'News',
    badgeColor: req.body.badgeColor || 'orange',
    imageUrl: req.body.imageUrl || 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1000&q=80',
    publishedAt: req.body.publishedAt || new Date().toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }),
    readTime: req.body.readTime || '3 นาที',
    author: req.body.author || req.user!.displayName,
    department: req.body.department || 'Corporate Communications',
    isImportantAlert: Boolean(req.body.isImportantAlert),
    views: req.body.views || 0,
    syncToExternal: false, // Live only after checker approve — never at create
    externalSyncStatus: 'draft', // Every item enters the workflow as draft
    externalCategory: req.body.externalCategory || 'press-release',
    attachmentName: req.body.attachmentName,
    attachmentUrl: req.body.attachmentUrl,
  };

  // W2-FIX-1: the workflow mutation serializes per item id (create included —
  // a client-supplied id could collide with a concurrent PUT on that id).
  try {
    await withNewsLock(newItem.id, async () => {
      await repo.insertNews(newItem);
    });
  } catch (err) {
    return next(err);
  }

  // No sync log on create: nothing has left the building. A sync_logs row is
  // written only by the checker approve endpoint (the sole path to 'synced').

  res.status(201).json({ success: true, data: newItem });
});

// W2-FIX-3 route restructure: every news writer route computes a verdict
// INSIDE the transactional transition (the sync/pure plan callback evaluates
// all guards against the locked fresh row) and maps it to a response AFTER
// the transition returns. Denial audits (recordAudit) are likewise written
// post-transition on their own connection — see runNewsTransition.
type NewsPutVerdict =
  | { tag: 'notFound' }
  | { tag: 'ok'; item: NewsItem };
type NewsSubmitVerdict =
  | { tag: 'notFound' }
  | { tag: 'badState'; item: NewsItem }
  | { tag: 'ok'; item: NewsItem; audit: AuditLog };
// Shared by approve + reject (the denial shapes are identical; only the
// response strings/audit details differ per route).
type NewsDecideVerdict =
  | { tag: 'notFound' }
  | { tag: 'badState'; item: NewsItem }
  | { tag: 'legacy'; item: NewsItem }
  | { tag: 'selfDecision'; item: NewsItem }
  | { tag: 'ok'; item: NewsItem; audit: AuditLog };
type NewsWithdrawVerdict =
  | { tag: 'notFound' }
  | { tag: 'notLive'; currentState: string }
  | { tag: 'ok'; item: NewsItem; audit: AuditLog };

app.put('/api/news/:id', requireAuth, requireRole('maker', 'admin'), requireResourceId, async (req, res, next) => {
  const { id } = req.params;
  // FR-NEWS-009: workflow fields are server-controlled — externalSyncStatus,
  // approvedBy/approvedAt and syncToExternal can never be set via the body.
  stripNewsWorkflowFields(req.body);
  try {
    // W2-FIX-3: guards + next-row construction run inside the transactional
    // transition against the row re-read under SELECT ... FOR UPDATE (PG) /
    // inside the per-item lock (memory) — the forced reset applies to the
    // CURRENT committed content, never a pre-transaction snapshot, in every
    // cross-pod interleaving. Ordinary draft PUTs ride the SAME path (audit
    // omitted): no last-writer-wins lost update between pods.
    const verdict = await withNewsLock(id, () =>
      repo.runNewsTransition<NewsPutVerdict>(id, (item): NewsTransitionPlan<NewsPutVerdict> => {
        if (!item) return { kind: 'readonly', result: { tag: 'notFound' } };

        const priorStatus = item.externalSyncStatus;
        // Content change ⇒ draft (FR-NEWS-009). Editing an item in ANY non-draft
        // workflow state returns it to 'draft': a pending item must not be mutated
        // while a checker reviews content they may never see again (TOCTOU), and a
        // live item must not keep modified content public under a stale approval.
        const invalidatesApproval =
          priorStatus === 'pending_approval' || priorStatus === 'synced' || priorStatus === 'rejected';
        const updated: NewsItem = {
          ...item,
          ...req.body,
          id, // protect ID
        };

        // The forced reset clears the prior decision cycle's stamps and drops the
        // item out of the live public set (syncToExternal) — the only legal path is
        // draft -> pending_approval -> synced|rejected, and only checker approve
        // makes content live again.
        if (invalidatesApproval) {
          updated.externalSyncStatus = 'draft';
          updated.syncToExternal = false;
          updated.approvedBy = undefined;
          updated.approvedAt = undefined;
          updated.submittedBy = undefined;
          updated.submittedAt = undefined;
          // Forced transition audit (AUD-P01) commits WITH the state change —
          // one all-or-nothing unit.
          const auditEntry = buildAuditEntry({
            actor: req.user!.username,
            actorRole: ROLE_LABELS[req.user!.role],
            action: 'UPDATE',
            targetResource: 'News Announcement',
            resourceId: updated.id,
            details: `Edit of ${priorStatus} item "${updated.title.substring(0, 30)}..." reset externalSyncStatus to draft (forced transition; approval and submission stamps cleared, item dropped from the live sync set until re-approval).`,
            ipAddress: req.ip,
            status: 'SUCCESS',
          });
          return { kind: 'commit', next: updated, audit: auditEntry, result: { tag: 'ok', item: updated } };
        }
        // Ordinary draft edit: same transactional path, no audit row.
        return { kind: 'commit', next: updated, result: { tag: 'ok', item: updated } };
      }));

    if (verdict.tag === 'notFound') {
      return res.status(404).json({ error: 'News item not found' });
    }

    // No sync log on update: PUT can no longer reach syncToExternal=true —
    // the flag flips only via the checker approve endpoint.

    res.json({ success: true, data: verdict.item });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/news/:id', requireAuth, requireRole('admin'), requireResourceId, async (req, res) => {
  const { id } = req.params;
  const target = await repo.findNews(id);
  await repo.deleteNews(id);

  if (target && target.syncToExternal) {
    await repo.insertSyncLog({
      id: `sync-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      itemId: id,
      itemTitle: target.title,
      action: 'DELETE',
      status: 'SUCCESS',
      targetEndpoint: 'api.kbjcapital.co.th/v1/public/news',
      syncedBy: req.user!.username,
    });
  }

  res.json({ success: true, message: 'Deleted successfully' });
});

// Maker-Checker Dual Approval Endpoints (BOT Governance)
app.post('/api/news/:id/submit-approval', requireAuth, requireRole('maker', 'admin'), requireResourceId, async (req, res, next) => {
  const { id } = req.params;
  try {
    const verdict = await withNewsLock(id, () =>
      repo.runNewsTransition<NewsSubmitVerdict>(id, (item): NewsTransitionPlan<NewsSubmitVerdict> => {
        if (!item) return { kind: 'readonly', result: { tag: 'notFound' } };

        // FR-NEWS-009: submit-approval is legal from 'draft' only. A rejected item
        // must be edited first (the edit resets it to draft); a synced item is
        // already live; a pending item is already in review.
        if (item.externalSyncStatus !== 'draft') {
          return { kind: 'readonly', result: { tag: 'badState', item } };
        }

        // The next state is a NEW object built FROM the locked row — the stored
        // item is never mutated in place — and state + audit commit as one
        // atomic unit.
        const next: NewsItem = {
          ...item,
          externalSyncStatus: 'pending_approval',
          syncToExternal: false, // Not live until approved by Checker
          // Record WHO submitted so approve/reject can bar self-approval (FR-NEWS-009)
          submittedBy: req.user!.id,
          submittedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        };

        const auditEntry = buildAuditEntry({
          actor: req.user!.username,
          actorRole: ROLE_LABELS[req.user!.role],
          action: 'SUBMIT_APPROVAL',
          targetResource: 'News Announcement',
          resourceId: next.id,
          details: `Submitted by ${req.user!.username} (id: ${req.user!.id}): "${next.title.substring(0, 30)}..." for dual-control checker review before public publishing.`,
          ipAddress: req.ip,
          status: 'SUCCESS',
        });
        return { kind: 'commit', next, audit: auditEntry, result: { tag: 'ok', item: next, audit: auditEntry } };
      }));

    if (verdict.tag === 'notFound') {
      return res.status(404).json({ error: 'News item not found' });
    }
    if (verdict.tag === 'badState') {
      // Denial audit AFTER the (empty, write-free) transition: recordAudit
      // runs on its own connection and must never sit inside the row-locked
      // plan callback.
      await recordAudit({
        actor: req.user!.username,
        actorRole: ROLE_LABELS[req.user!.role],
        action: 'SUBMIT_APPROVAL',
        targetResource: 'News Announcement',
        resourceId: verdict.item.id,
        details: `Blocked: submit-approval attempted on item "${verdict.item.title.substring(0, 30)}..." in state '${verdict.item.externalSyncStatus ?? 'none'}' — only draft items can be submitted.`,
        ipAddress: req.ip,
        status: 'WARNING',
      });
      return res.status(400).json({ success: false, error: 'Only draft news items can be submitted for approval' });
    }
    res.json({ success: true, data: verdict.item, audit: verdict.audit });
  } catch (err) {
    next(err);
  }
});

app.post('/api/news/:id/approve', requireAuth, requireRole('checker', 'admin'), requireResourceId, async (req, res, next) => {
  const { id } = req.params;
  try {
    const verdict = await withNewsLock(id, () =>
      repo.runNewsTransition<NewsDecideVerdict>(id, (item): NewsTransitionPlan<NewsDecideVerdict> => {
        if (!item) return { kind: 'readonly', result: { tag: 'notFound' } };

        // FR-NEWS-009: approve is legal only from 'pending_approval' — a checker
        // cannot approve a draft (or re-approve a synced/rejected item).
        if (item.externalSyncStatus !== 'pending_approval') {
          return { kind: 'readonly', result: { tag: 'badState', item } };
        }

        // W2-FIX-1 (codex blocker 2): legacy pre-migration submissions carry no
        // submitter identity — the self-decision guard below would be vacuous,
        // so the original (admin) submitter could decide their own item. Deny
        // the decision; a fresh submission cycle stamps a verified submitter.
        if (!item.submittedBy) {
          return { kind: 'readonly', result: { tag: 'legacy', item } };
        }

        // FR-NEWS-009: the submitter may never approve their own submission — for
        // every role, admin included (strict dual-control ruling).
        if (item.submittedBy === req.user!.id) {
          return { kind: 'readonly', result: { tag: 'selfDecision', item } };
        }

        // Next state built FROM the locked row (never in-place mutation); state +
        // audit + sync log commit as ONE all-or-nothing unit.
        const next: NewsItem = {
          ...item,
          externalSyncStatus: 'synced',
          syncToExternal: true,
          approvedBy: req.user!.username,
          approvedAt: new Date().toISOString().replace('T', ' ').slice(0, 19),
        };

        const auditEntry = buildAuditEntry({
          actor: req.user!.username,
          actorRole: ROLE_LABELS[req.user!.role],
          action: 'APPROVE',
          targetResource: 'News Announcement',
          resourceId: next.id,
          details: `Approved public synchronization to www.kbjcapital.co.th for "${next.title.substring(0, 30)}..." (submitted by id: ${next.submittedBy ?? 'unknown'}).`,
          ipAddress: req.ip,
          status: 'SUCCESS',
        });

        const syncLogEntry: SyncLog = {
          id: `sync-${Date.now()}`,
          timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
          itemId: next.id,
          itemTitle: next.title,
          action: 'CREATE',
          status: 'SUCCESS',
          targetEndpoint: 'api.kbjcapital.co.th/v1/public/news',
          syncedBy: req.user!.username,
        };
        return { kind: 'commit', next, audit: auditEntry, syncLog: syncLogEntry, result: { tag: 'ok', item: next, audit: auditEntry } };
      }));

    if (verdict.tag === 'notFound') {
      return res.status(404).json({ error: 'News item not found' });
    }

    const checkerName = req.user!.username;
    // Denial audits AFTER the (empty, write-free) transition: recordAudit runs
    // on its own connection and must never sit inside the row-locked plan.
    if (verdict.tag === 'badState') {
      await recordAudit({
        actor: checkerName,
        actorRole: ROLE_LABELS[req.user!.role],
        action: 'APPROVE',
        targetResource: 'News Announcement',
        resourceId: verdict.item.id,
        details: `Blocked: approve attempted on item "${verdict.item.title.substring(0, 30)}..." in state '${verdict.item.externalSyncStatus ?? 'none'}' — requires pending_approval.`,
        ipAddress: req.ip,
        status: 'WARNING',
      });
      return res.status(400).json({ success: false, error: 'Only news items pending approval can be approved' });
    }
    if (verdict.tag === 'legacy') {
      await recordAudit({
        actor: checkerName,
        actorRole: ROLE_LABELS[req.user!.role],
        action: 'ACCESS_DENIED',
        targetResource: 'News Announcement',
        resourceId: verdict.item.id,
        details: `Blocked: decision on legacy submission "${verdict.item.title.substring(0, 30)}..." with no recorded submitter (pre-migration row) — a fresh submission cycle is required before approve/reject.`,
        ipAddress: req.ip,
        status: 'WARNING',
      });
      return res.status(409).json({ success: false, error: 'รายการนี้ถูกส่งก่อนการย้ายระบบ กรุณาให้ผู้สร้างส่งคำขออนุมัติใหม่ / Legacy submission requires a fresh submission cycle' });
    }
    if (verdict.tag === 'selfDecision') {
      await recordAudit({
        actor: checkerName,
        actorRole: ROLE_LABELS[req.user!.role],
        action: 'APPROVE',
        targetResource: 'News Announcement',
        resourceId: verdict.item.id,
        details: `Blocked: self-approval attempt — ${checkerName} submitted this item and cannot approve it.`,
        ipAddress: req.ip,
        status: 'WARNING',
      });
      return res.status(403).json({ success: false, error: 'Self-approval is not allowed: the submitter cannot approve their own item' });
    }
    res.json({ success: true, data: verdict.item, audit: verdict.audit });
  } catch (err) {
    next(err);
  }
});

app.post('/api/news/:id/reject', requireAuth, requireRole('checker', 'admin'), requireResourceId, async (req, res, next) => {
  const { id } = req.params;
  try {
    const verdict = await withNewsLock(id, () =>
      repo.runNewsTransition<NewsDecideVerdict>(id, (item): NewsTransitionPlan<NewsDecideVerdict> => {
        if (!item) return { kind: 'readonly', result: { tag: 'notFound' } };

        // FR-NEWS-009: reject is legal only from 'pending_approval'.
        if (item.externalSyncStatus !== 'pending_approval') {
          return { kind: 'readonly', result: { tag: 'badState', item } };
        }

        // W2-FIX-1 (codex blocker 2): same legacy-submission deny as approve —
        // no verified submitter identity, no decision (fresh cycle required).
        if (!item.submittedBy) {
          return { kind: 'readonly', result: { tag: 'legacy', item } };
        }

        // FR-NEWS-009: the submitter may never decide their own submission — for
        // every role, admin included (strict dual-control ruling).
        if (item.submittedBy === req.user!.id) {
          return { kind: 'readonly', result: { tag: 'selfDecision', item } };
        }

        const reason = req.body.reason || 'Content revised or missing mandatory regulatory wording.';
        const next: NewsItem = {
          ...item,
          externalSyncStatus: 'rejected',
          syncToExternal: false,
          approvedBy: `Rejected by ${req.user!.username}: ${reason}`,
        };

        const auditEntry = buildAuditEntry({
          actor: req.user!.username,
          actorRole: ROLE_LABELS[req.user!.role],
          action: 'REJECT',
          targetResource: 'News Announcement',
          resourceId: next.id,
          details: `Rejected approval for "${next.title.substring(0, 30)}...". Reason: ${reason}`,
          ipAddress: req.ip,
          status: 'REJECTED',
        });
        return { kind: 'commit', next, audit: auditEntry, result: { tag: 'ok', item: next, audit: auditEntry } };
      }));

    if (verdict.tag === 'notFound') {
      return res.status(404).json({ error: 'News item not found' });
    }

    const checkerName = req.user!.username;
    // Denial audits AFTER the (empty, write-free) transition: recordAudit runs
    // on its own connection and must never sit inside the row-locked plan.
    if (verdict.tag === 'badState') {
      await recordAudit({
        actor: checkerName,
        actorRole: ROLE_LABELS[req.user!.role],
        action: 'REJECT',
        targetResource: 'News Announcement',
        resourceId: verdict.item.id,
        details: `Blocked: reject attempted on item "${verdict.item.title.substring(0, 30)}..." in state '${verdict.item.externalSyncStatus ?? 'none'}' — requires pending_approval.`,
        ipAddress: req.ip,
        status: 'WARNING',
      });
      return res.status(400).json({ success: false, error: 'Only news items pending approval can be rejected' });
    }
    if (verdict.tag === 'legacy') {
      await recordAudit({
        actor: checkerName,
        actorRole: ROLE_LABELS[req.user!.role],
        action: 'ACCESS_DENIED',
        targetResource: 'News Announcement',
        resourceId: verdict.item.id,
        details: `Blocked: decision on legacy submission "${verdict.item.title.substring(0, 30)}..." with no recorded submitter (pre-migration row) — a fresh submission cycle is required before approve/reject.`,
        ipAddress: req.ip,
        status: 'WARNING',
      });
      return res.status(409).json({ success: false, error: 'รายการนี้ถูกส่งก่อนการย้ายระบบ กรุณาให้ผู้สร้างส่งคำขออนุมัติใหม่ / Legacy submission requires a fresh submission cycle' });
    }
    if (verdict.tag === 'selfDecision') {
      await recordAudit({
        actor: checkerName,
        actorRole: ROLE_LABELS[req.user!.role],
        action: 'REJECT',
        targetResource: 'News Announcement',
        resourceId: verdict.item.id,
        details: `Blocked: self-rejection attempt — ${checkerName} submitted this item and cannot reject it.`,
        ipAddress: req.ip,
        status: 'WARNING',
      });
      return res.status(403).json({ success: false, error: 'Self-decision is not allowed: the submitter cannot reject their own item' });
    }
    res.json({ success: true, data: verdict.item, audit: verdict.audit });
  } catch (err) {
    next(err);
  }
});

// W2-FIX-1 (codex blocker 3): state-only withdrawal of a live item. Rides the
// DCR-9 ratified policy — withdrawal needs NO checker (the safe direction:
// un-publish) — but unlike the old PUT-based action it carries NO client
// payload: the server's CURRENT content is preserved byte-for-byte, so a
// stale browser snapshot can never overwrite a concurrent maker's edits.
// Precondition synced (else 409); success is synced→draft + stamps cleared +
// syncToExternal:false + AUD-P01, committed atomically with the audit row.
// W2-FIX-3: the synced precondition is now evaluated against the row re-read
// INSIDE the transition (SELECT ... FOR UPDATE in PG mode) — a concurrent
// cross-pod edit that reset the item to draft first makes this 409 with the
// CURRENT state; a 200-after-precondition-lapse overwriting that edit is
// impossible.
app.post('/api/news/:id/withdraw', requireAuth, requireRole('maker', 'admin'), requireResourceId, async (req, res, next) => {
  const { id } = req.params;
  try {
    const verdict = await withNewsLock(id, () =>
      repo.runNewsTransition<NewsWithdrawVerdict>(id, (item): NewsTransitionPlan<NewsWithdrawVerdict> => {
        if (!item) return { kind: 'readonly', result: { tag: 'notFound' } };

        // The request body is deliberately ignored — withdrawal is state-only.
        if (item.externalSyncStatus !== 'synced') {
          return { kind: 'readonly', result: { tag: 'notLive', currentState: item.externalSyncStatus ?? 'none' } };
        }

        const next: NewsItem = {
          ...item, // content preserved byte-for-byte — only workflow fields move
          externalSyncStatus: 'draft',
          syncToExternal: false,
          approvedBy: undefined,
          approvedAt: undefined,
          submittedBy: undefined,
          submittedAt: undefined,
        };

        const auditEntry = buildAuditEntry({
          actor: req.user!.username,
          actorRole: ROLE_LABELS[req.user!.role],
          action: 'UPDATE',
          targetResource: 'News Announcement',
          resourceId: next.id,
          details: `Withdrawal from public web: synced item "${next.title.substring(0, 30)}..." withdrawn to draft (state-only transition; prior_status='synced'; content preserved; approval and submission stamps cleared, syncToExternal=false until re-approval).`,
          ipAddress: req.ip,
          status: 'SUCCESS',
        });
        return { kind: 'commit', next, audit: auditEntry, result: { tag: 'ok', item: next, audit: auditEntry } };
      }));

    if (verdict.tag === 'notFound') {
      return res.status(404).json({ error: 'News item not found' });
    }
    if (verdict.tag === 'notLive') {
      // No denial audit by design (W2-FIX-1 contract): a refused withdrawal
      // writes no AUD-P01 row; currentState reports the locked row's state.
      return res.status(409).json({
        success: false,
        error: 'ประกาศไม่ได้อยู่ในสถานะเผยแพร่ / Item is not live on the public web',
        currentState: verdict.currentState,
      });
    }
    res.json({ success: true, data: verdict.item, audit: verdict.audit });
  } catch (err) {
    next(err);
  }
});

// 2. Banner Slides API
app.get('/api/banners', async (req, res) => {
  res.json({ data: await repo.listBanners() });
});

app.post('/api/banners', requireAuth, requireRole('maker', 'admin'), async (req, res) => {
  const newBanner: BannerSlide = {
    id: req.body.id || `banner-${Date.now()}`,
    title: req.body.title,
    subtitle: req.body.subtitle,
    badge: req.body.badge || 'Kashjoy Highlight',
    imageUrl: req.body.imageUrl || 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1400&q=80',
    actionUrl: req.body.actionUrl || '#',
    actionText: req.body.actionText || 'อ่านรายละเอียด',
    order: req.body.order || (await repo.listBanners()).length + 1,
    isActive: req.body.isActive !== undefined ? req.body.isActive : true,
  };
  await repo.insertBanner(newBanner);
  res.status(201).json({ success: true, data: newBanner });
});

app.put('/api/banners/:id', requireAuth, requireRole('maker', 'admin'), requireResourceId, async (req, res) => {
  const { id } = req.params;
  const existing = await repo.findBanner(id);
  if (!existing) return res.status(404).json({ error: 'Banner not found' });
  const updated: BannerSlide = { ...existing, ...req.body, id };
  await repo.saveBanner(updated);
  res.json({ success: true, data: updated });
});

app.delete('/api/banners/:id', requireAuth, requireRole('admin'), requireResourceId, async (req, res) => {
  await repo.deleteBanner(req.params.id);
  res.json({ success: true, message: 'Banner removed' });
});

// 3. Staff Directory Contacts API
app.get('/api/contacts', requireAuth, async (req, res) => {
  const { department, floor, search } = req.query;
  let filtered = await repo.listContacts();

  if (department && department !== 'all') {
    filtered = filtered.filter((c) => c.department === department);
  }
  if (floor && floor !== 'all') {
    filtered = filtered.filter((c) => c.floor === floor);
  }
  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.nameEn.toLowerCase().includes(q) ||
        c.position.toLowerCase().includes(q) ||
        c.extension.includes(q)
    );
  }

  res.json({ data: filtered, total: filtered.length });
});

app.post('/api/contacts', requireAuth, requireRole('maker', 'admin'), async (req, res) => {
  const newContact: DirectoryContact = {
    id: req.body.id || `contact-${Date.now()}`,
    name: req.body.name,
    nameEn: req.body.nameEn || '',
    position: req.body.position,
    department: req.body.department,
    extension: req.body.extension,
    directPhone: req.body.directPhone,
    email: req.body.email,
    floor: req.body.floor || '14th',
    avatarUrl: req.body.avatarUrl,
  };
  await repo.insertContact(newContact);
  res.status(201).json({ success: true, data: newContact });
});

app.put('/api/contacts/:id', requireAuth, requireRole('maker', 'admin'), requireResourceId, async (req, res) => {
  const { id } = req.params;
  const existing = await repo.findContact(id);
  if (!existing) return res.status(404).json({ error: 'Contact not found' });
  const updated: DirectoryContact = { ...existing, ...req.body, id };
  await repo.saveContact(updated);
  res.json({ success: true, data: updated });
});

app.delete('/api/contacts/:id', requireAuth, requireRole('admin'), requireResourceId, async (req, res) => {
  await repo.deleteContact(req.params.id);
  res.json({ success: true, message: 'Contact deleted' });
});

// 4. Meeting Rooms & Real Reservation API
app.get('/api/rooms', async (req, res) => {
  res.json({ data: await repo.listRooms() });
});

app.post('/api/rooms/:id/book', requireAuth, requireResourceId, async (req, res) => {
  const { id } = req.params;
  const { topic, time } = req.body;

  const room = await repo.findRoom(id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  if (room.status !== 'available') {
    return res.status(400).json({ error: 'Room is currently booked or under maintenance' });
  }

  room.status = 'in-use';
  room.currentBooking = {
    topic: topic || 'KB J Internal Meeting',
    booker: req.user!.displayName || req.user!.username,
    time: time || '14:00 - 15:30 น.',
  };
  await repo.saveRoom(room);

  res.json({ success: true, data: room });
});

app.post('/api/rooms/:id/release', requireAuth, requireResourceId, async (req, res) => {
  const { id } = req.params;
  const room = await repo.findRoom(id);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  room.status = 'available';
  room.currentBooking = undefined;
  await repo.saveRoom(room);

  res.json({ success: true, data: room });
});

// 5. Policy & Governance Documents API
app.get('/api/documents', requireAuth, async (req, res) => {
  const { category } = req.query;
  let filtered = await repo.listDocuments();
  if (category && category !== 'all') {
    filtered = filtered.filter((d) => d.category === category);
  }
  res.json({ data: filtered });
});

app.post('/api/documents', requireAuth, requireRole('maker', 'admin'), async (req, res) => {
  const newDoc: PolicyDocument = {
    id: req.body.id || `doc-${Date.now()}`,
    title: req.body.title,
    titleEn: req.body.titleEn || '',
    category: req.body.category || 'form',
    department: req.body.department || 'HR & Corporate Affairs',
    version: req.body.version || 'v1.0',
    updatedAt: req.body.updatedAt || new Date().toISOString().slice(0, 10),
    fileSize: req.body.fileSize || '1.2 MB',
    downloadUrl: req.body.downloadUrl || '#',
    isNew: true,
  };
  await repo.insertDocument(newDoc);
  res.status(201).json({ success: true, data: newDoc });
});

app.delete('/api/documents/:id', requireAuth, requireRole('admin'), requireResourceId, async (req, res) => {
  await repo.deleteDocument(req.params.id);
  res.json({ success: true, message: 'Document deleted' });
});

// 6. Tools API
app.get('/api/tools', (req, res) => {
  res.json({ data: INITIAL_TOOLS });
});

// 7. Public Web Live Synchronization API
app.get('/api/sync/logs', requireAuth, requireRole('admin'), async (req, res) => {
  res.json({ data: await repo.listSyncLogs() });
});

app.post('/api/sync/trigger', requireAuth, requireRole('admin'), async (req, res) => {
  const syncCount = (await repo.listNews()).filter((n) => n.syncToExternal).length;
  const newLog: SyncLog = {
    id: `sync-${Date.now()}`,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    itemId: 'BULK-ALL',
    itemTitle: `Full Handshake Synchronization (${syncCount} Items Verified)`,
    action: 'FORCE_SYNC',
    status: 'SUCCESS',
    targetEndpoint: 'gateway.kbjcapital.co.th/v1/public/cache/purge-and-warm',
    syncedBy: req.user!.username,
  };

  await repo.insertSyncLog(newLog);

  // AUD-P05 (W2-3): the forced handshake is a privileged bulk operation —
  // it leaves an audit trail entry alongside the sync log. resourceId
  // 'BULK-ALL' matches the sync-log itemId for exact cross-table correlation.
  await recordAudit({
    actor: req.user!.username,
    actorRole: ROLE_LABELS[req.user!.role],
    action: 'SYNC_TRIGGER',
    targetResource: 'Public Edge Gateway',
    resourceId: 'BULK-ALL',
    details: `Forced full public-web handshake; ${syncCount} item(s) verified.`,
    ipAddress: req.ip,
    status: 'SUCCESS',
  });

  res.json({
    success: true,
    message: 'Public web synchronized successfully',
    syncedItemsCount: syncCount,
    log: newLog,
  });
});

// 8. Immutable Enterprise Audit Logs API (PDPA / BOT Governance)
app.get('/api/audit-logs', requireAuth, requireRole('checker', 'admin'), async (req, res) => {
  res.json({ data: await repo.listAuditLogs() });
});

// DCR-8 (W2-2): the manual audit-append endpoint (POST /api/audit-logs,
// admin) was REMOVED — it allowed arbitrary fabrication of compliance rows.
// Audit rows are now appended exclusively by server-side recordAudit(), and
// POST /api/audit-logs falls through to the JSON /api 404 catch-all for
// every caller (404 {success:false, error:"No API endpoint for POST
// /api/audit-logs"}). See doc 08 §11.3 and doc 10 §9 (DCR-8).

// ==========================================
// AUTH & USER MANAGEMENT ENDPOINTS
// ==========================================

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const trimmedUsername = username.trim();
  const user = await repo.findUserByUsername(trimmedUsername);
  const passwordMatches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_PASSWORD_HASH);

  if (!user || !passwordMatches || !user.isActive) {
    await recordAudit({
      actor: trimmedUsername,
      actorRole: 'Anonymous',
      action: 'LOGIN_FAILED',
      targetResource: 'Authentication',
      resourceId: user ? user.id : trimmedUsername,
      details: `Failed login attempt for "${trimmedUsername}".`,
      ipAddress: req.ip,
      status: 'WARNING',
    });
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  const token = await createSession(user.id);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PRODUCTION,
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
  await recordAudit({
    actor: user.username,
    actorRole: ROLE_LABELS[user.role],
    action: 'LOGIN',
    targetResource: 'Authentication',
    resourceId: user.id,
    details: `User "${user.username}" logged in successfully.`,
    ipAddress: req.ip,
    status: 'SUCCESS',
  });
  res.json({ success: true, data: toSafeUser(user) });
});

app.post('/api/auth/logout', async (req, res) => {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) {
    const record = await destroySession(token);
    if (record) {
      const user = await repo.findUserById(record.userId);
      await recordAudit({
        actor: user ? user.username : `unknown-user:${record.userId}`,
        actorRole: user ? ROLE_LABELS[user.role] : 'Unknown',
        action: 'LOGOUT',
        targetResource: 'Authentication',
        resourceId: record.userId,
        details: 'User logged out; session destroyed.',
        ipAddress: req.ip,
        status: 'SUCCESS',
      });
    }
  }
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PRODUCTION,
    path: '/',
  });
  res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ success: true, data: req.user });
});

app.get('/api/users', requireAuth, requireRole('admin'), async (req, res) => {
  const users = await repo.listUsers();
  res.json({ data: users.map(toSafeUser) });
});

app.post('/api/users', requireAuth, requireRole('admin'), async (req, res) => {
  const { username, password, displayName, email, role } = req.body || {};

  if (typeof username !== 'string' || !/^[a-zA-Z0-9._-]{3,32}$/.test(username.trim())) {
    return res.status(400).json({ success: false, error: 'Username must be 3-32 characters (letters, digits, dot, underscore, hyphen).' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
  }
  if (typeof displayName !== 'string' || !displayName.trim()) {
    return res.status(400).json({ success: false, error: 'Display name is required.' });
  }
  if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
    return res.status(400).json({ success: false, error: 'A valid email address is required.' });
  }
  if (typeof role !== 'string' || !USER_ROLES.includes(role as UserRole)) {
    return res.status(400).json({ success: false, error: `Role must be one of: ${USER_ROLES.join(', ')}.` });
  }
  if (await repo.findUserByUsername(username)) {
    return res.status(409).json({ success: false, error: 'Username already exists.' });
  }

  const user = await createUser({ username, password, displayName, email, role: role as UserRole });
  await recordAudit({
    actor: req.user!.username,
    actorRole: ROLE_LABELS[req.user!.role],
    action: 'USER_CREATE',
    targetResource: 'User Account',
    resourceId: user.id,
    details: `Created user "${user.username}" with role "${user.role}".`,
    ipAddress: req.ip,
    status: 'SUCCESS',
  });
  res.status(201).json({ success: true, data: toSafeUser(user) });
});

// Activate / deactivate a user account (admin only). Deactivated users are
// rejected at login and their existing sessions stop resolving immediately.
app.patch('/api/users/:id', requireAuth, requireRole('admin'), requireResourceId, async (req, res) => {
  const { id } = req.params;
  const user = await repo.findUserById(id);
  if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

  const body = req.body || {};
  const isActive = body.isActive !== undefined ? body.isActive : body.is_active;
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, error: 'Request body must include a boolean "isActive" field.' });
  }
  if (!isActive && user.id === req.user!.id) {
    return res.status(400).json({ success: false, error: 'You cannot deactivate your own account.' });
  }

  user.isActive = isActive;
  await repo.saveUser(user);
  await recordAudit({
    actor: req.user!.username,
    actorRole: ROLE_LABELS[req.user!.role],
    action: isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE',
    targetResource: 'User Account',
    resourceId: user.id,
    details: `${isActive ? 'Activated' : 'Deactivated'} user "${user.username}".`,
    ipAddress: req.ip,
    status: 'SUCCESS',
  });
  res.json({ success: true, data: toSafeUser(user) });
});

// ==========================================
// FILE UPLOAD API (D4)
// ==========================================

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_UPLOAD_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf', '.docx', '.xlsx']);
// Declared-mimetype sanity check per extension. Browsers frequently send
// application/octet-stream for Office documents, so that generic value is accepted.
const EXPECTED_MIME_BY_EXTENSION: Record<string, string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.gif': ['image/gif'],
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'],
};

function sanitizeUploadExtension(originalName: string): string | null {
  const dot = (originalName || '').lastIndexOf('.');
  if (dot === -1) return null;
  const ext = originalName.slice(dot).toLowerCase();
  if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) return null;
  if (!/^[a-z0-9]+$/.test(ext.slice(1))) return null; // defends against crafted multi-part extensions
  return ext;
}

const uploadHandler = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = sanitizeUploadExtension(file.originalname);
      if (!ext) {
        // fileFilter already rejects these; this is defense in depth. The empty
        // second argument only satisfies multer's callback signature — the error
        // short-circuits the write.
        return cb(new Error(`File type not allowed. Allowed extensions: ${[...ALLOWED_UPLOAD_EXTENSIONS].join(' ')}`), '');
      }
      // Server-generated names only — the client filename never touches the filesystem.
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: UPLOAD_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = sanitizeUploadExtension(file.originalname);
    if (!ext) {
      return cb(new Error(`File type not allowed. Allowed extensions: ${[...ALLOWED_UPLOAD_EXTENSIONS].join(' ')}`));
    }
    const declaredMime = (file.mimetype || '').toLowerCase();
    const expected = EXPECTED_MIME_BY_EXTENSION[ext] || [];
    if (declaredMime && !expected.includes(declaredMime)) {
      return cb(new Error(`File content type "${file.mimetype}" does not match its extension.`));
    }
    cb(null, true);
  },
});

// Uploaded files are served read-only with immutable server-generated names.
// express.static handles directory traversal protection; X-Content-Type-Options:
// nosniff is applied globally above so files are never executed or sniffed as HTML.
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1d', index: false, redirect: false }));

app.post('/api/upload', requireAuth, requireRole('maker', 'checker', 'admin'), (req, res) => {
  uploadHandler.single('file')(req, res, (err) => {
    if (err) {
      const isTooLarge = (err as { code?: string }).code === 'LIMIT_FILE_SIZE';
      return res.status(isTooLarge ? 413 : 400).json({
        success: false,
        error: isTooLarge ? 'File exceeds the 10MB limit.' : err.message || 'Upload failed.',
      });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided. Send multipart/form-data with a "file" field.' });
    }
    void recordAudit({
      actor: req.user!.username,
      actorRole: ROLE_LABELS[req.user!.role],
      action: 'FILE_UPLOAD',
      targetResource: 'File Upload',
      resourceId: req.file.filename,
      details: `Uploaded "${req.file.originalname}" (${req.file.size} bytes).`,
      ipAddress: req.ip,
      status: 'SUCCESS',
    });
    res.status(201).json({
      success: true,
      data: {
        url: `/uploads/${req.file.filename}`,
        fileName: req.file.originalname,
        size: req.file.size,
      },
    });
  });
});

// 9. OpenAPI 3.0 Contract Specification Endpoint (for Backend/Mobile dev teams)
app.get('/api/openapi.json', (req, res) => {
  res.json({
    openapi: '3.0.3',
    info: {
      title: 'KB J Capital Intranet Portal Core API',
      description: 'Production REST API specifications for Intranet portal, CMS, and Edge Sync Gateway',
      version: '2.0.0',
      contact: {
        name: 'Enterprise IT Architecture & DevOps Team',
        email: 'it.architecture@kbjcapital.co.th',
      },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local Container Runtime' },
      { url: 'https://intranet.kbjcapital.co.th', description: 'Production Ingress Gateway' },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'kbj_session',
          description: 'Session cookie issued by POST /api/auth/login (httpOnly, SameSite=Lax, 7-day expiry).',
        },
      },
    },
    paths: {
      '/healthz': { get: { summary: 'Kubernetes Liveness Probe', responses: { '200': { description: 'Container healthy' } } } },
      '/readyz': { get: { summary: 'Kubernetes Readiness Probe', responses: { '200': { description: 'Container ready for ingress' } } } },
      '/api/auth/login': {
        post: {
          summary: 'Authenticate user and issue kbj_session cookie (rate-limited: 5 attempts/min/IP)',
          responses: { '200': { description: 'Authenticated' }, '401': { description: 'Invalid credentials' }, '429': { description: 'Rate limited' } },
        },
      },
      '/api/auth/logout': {
        post: { summary: 'Destroy session and clear cookie', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Logged out' } } },
      },
      '/api/auth/me': {
        get: { summary: 'Current authenticated user', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Current user' }, '401': { description: 'Not authenticated' } } },
      },
      '/api/users': {
        get: { summary: 'List user accounts (admin only)', security: [{ cookieAuth: [] }], responses: { '200': { description: 'User list' }, '403': { description: 'Insufficient permissions' } } },
        post: { summary: 'Create user account (admin only)', security: [{ cookieAuth: [] }], responses: { '201': { description: 'Created' }, '400': { description: 'Validation error' }, '409': { description: 'Username exists' } } },
      },
      '/api/users/{id}': {
        patch: {
          summary: 'Activate or deactivate a user account (admin only; body: {"isActive": boolean})',
          security: [{ cookieAuth: [] }],
          responses: {
            '200': { description: 'Updated user' },
            '400': { description: 'Missing boolean isActive or self-deactivation attempt' },
            '404': { description: 'User not found' },
          },
        },
      },
      '/api/upload': {
        post: {
          summary: 'Upload a file (multipart/form-data, field "file"; maker/checker/admin; 10MB max; .jpg .jpeg .png .webp .gif .pdf .docx .xlsx)',
          security: [{ cookieAuth: [] }],
          requestBody: {
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: { file: { type: 'string', format: 'binary' } },
                  required: ['file'],
                },
              },
            },
          },
          responses: {
            '201': { description: 'Uploaded; returns { url, fileName, size }' },
            '400': { description: 'Missing file or disallowed type' },
            '413': { description: 'File exceeds the 10MB limit' },
          },
        },
      },
      '/api/news': {
        get: { summary: 'List all news, bulletins, and announcements' },
        post: { summary: 'Create new announcement (maker or admin)', security: [{ cookieAuth: [] }], responses: { '201': { description: 'Created' }, '403': { description: 'Insufficient permissions' } } },
      },
      '/api/news/{id}': {
        put: { summary: 'Update announcement (maker or admin)', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Updated' }, '404': { description: 'Not found' } } },
        delete: { summary: 'Delete announcement (admin only)', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Deleted' } } },
      },
      '/api/news/{id}/submit-approval': {
        post: { summary: 'Submit news item for Checker Dual-Approval (maker or admin)', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Submitted' } } },
      },
      '/api/news/{id}/approve': {
        post: { summary: 'Checker approves news for external website synchronization (checker or admin)', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Approved' } } },
      },
      '/api/news/{id}/reject': {
        post: { summary: 'Checker rejects news publication with reason (checker or admin)', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Rejected' } } },
      },
      '/api/news/{id}/withdraw': {
        post: { summary: 'Withdraw a live (synced) item from the public web — state-only, server content preserved byte-for-byte, no checker required (maker or admin; 409 with currentState when not synced)', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Withdrawn to draft (AUD-P01 row committed atomically)' }, '409': { description: 'Item is not live on the public web' } } },
      },
      '/api/banners': {
        get: { summary: 'List carousel banners' },
        post: { summary: 'Add promotional banner (maker or admin)', security: [{ cookieAuth: [] }], responses: { '201': { description: 'Created' } } },
      },
      '/api/contacts': {
        get: { summary: 'Search telephone and employee directory (authenticated staff+)', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Contacts' }, '401': { description: 'Authentication required' } } },
        post: { summary: 'Register employee extension (maker or admin)', security: [{ cookieAuth: [] }], responses: { '201': { description: 'Created' } } },
      },
      '/api/rooms': { get: { summary: 'List meeting rooms and current bookings' } },
      '/api/rooms/{id}/book': { post: { summary: 'Reserve meeting room (authenticated staff+)', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Booked' } } } },
      '/api/rooms/{id}/release': { post: { summary: 'Release meeting room (authenticated staff+)', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Released' } } } },
      '/api/documents': {
        get: { summary: 'List policy documents, forms, and compliance guides (authenticated staff+)', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Documents' } } },
        post: { summary: 'Register policy document (maker or admin)', security: [{ cookieAuth: [] }], responses: { '201': { description: 'Created' } } },
      },
      '/api/audit-logs': {
        get: { summary: 'Retrieve immutable BOT compliance audit trail (checker or admin)', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Audit entries' } } },
      },
      '/api/sync/logs': { get: { summary: 'List external synchronization logs (admin only)', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Sync logs' } } } },
      '/api/sync/trigger': { post: { summary: 'Trigger handshake edge cache synchronization (admin only)', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Synchronized' } } } },
      '/api/system/export': { get: { summary: 'Export all JSON stores for PostgreSQL migration (admin only)', security: [{ cookieAuth: [] }], responses: { '200': { description: 'Full export' } } } },
    },
  });
});

// 10. Enterprise Database Migration Export Endpoint (for dev team to seed PostgreSQL / Cloud SQL)
app.get('/api/system/export', requireAuth, requireRole('admin'), async (req, res) => {
  const [news, banners, contacts, rooms, documents, auditLogs, syncLogs] = await Promise.all([
    repo.listNews(),
    repo.listBanners(),
    repo.listContacts(),
    repo.listRooms(),
    repo.listDocuments(),
    repo.listAuditLogs(),
    repo.listSyncLogs(),
  ]);
  // AUD-P06 (W2-3): bulk data exfiltration is a PDPA-relevant event — audit
  // every export. resourceId = the export's own timestamp (DCR-1 field name),
  // correlating the audit row with the exact snapshot a migrate.js consumer
  // loads. The lists above were already read, so this row appears in the
  // NEXT export, not the current one.
  const exportTimestamp = new Date().toISOString();
  await recordAudit({
    actor: req.user!.username,
    actorRole: ROLE_LABELS[req.user!.role],
    action: 'SYSTEM_EXPORT',
    targetResource: 'System Export',
    resourceId: exportTimestamp,
    details: `Exported full system snapshot (${news.length} news, ${documents.length} documents, ${auditLogs.length} audit rows).`,
    ipAddress: req.ip,
    status: 'SUCCESS',
  });
  res.json({
    exportTimestamp,
    version: '2.0.0',
    schemaTarget: 'postgresql',
    storage: repo.mode,
    counts: {
      news: news.length,
      banners: banners.length,
      contacts: contacts.length,
      rooms: rooms.length,
      documents: documents.length,
      auditLogs: auditLogs.length,
      syncLogs: syncLogs.length,
    },
    tables: {
      news,
      banners,
      contacts,
      meeting_rooms: rooms,
      documents,
      audit_logs: auditLogs,
      sync_logs: syncLogs,
    },
  });
});

// Unmatched /api/* requests (e.g. removed endpoints such as the retired
// /api/k8s/diagnostics) answer a JSON 404 here instead of falling through to
// the SPA's index.html fallback, so API clients never receive HTML.
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: `No API endpoint for ${req.method} ${req.originalUrl.split('?')[0]}` });
});

// ==========================================
// FINAL ERROR HANDLER
// ==========================================
// Registered after all routes so it catches next(err) from every handler and
// body-parser failures from the JSON/urlencoded middleware at the top of the
// stack. Async handler rejections are additionally guarded by the
// process-level unhandledRejection hook below so a single bad request can
// never kill the pod. Everything logs exactly one line, no stack spew.
app.use((err: Error & { status?: number; statusCode?: number; type?: string }, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Malformed JSON/urlencoded body from express.json() → clean 400 envelope
  // (body-parser signature: SyntaxError with status 400 / type entity.parse.failed).
  if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && (err.status === 400 || err.statusCode === 400))) {
    console.error(`[Error] ${req.method} ${req.path} rejected: malformed request body`);
    if (!res.headersSent) {
      return res.status(400).json({ success: false, error: 'Invalid JSON body' });
    }
    return;
  }
  // Request entity larger than the configured limit → 413, not a 500.
  if (err.type === 'entity.too.large') {
    console.error(`[Error] ${req.method} ${req.path} rejected: request body too large`);
    if (!res.headersSent) {
      return res.status(413).json({ success: false, error: 'Request body too large' });
    }
    return;
  }
  console.error(`[Error] ${req.method} ${req.path} failed:`, err.message);
  if (!res.headersSent) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[UnhandledRejection] Logged and suppressed to keep the process serving:', reason);
});

// ---- Bootstrap: auto-create the admin account when the user store is empty (D3) ----
async function bootstrapUsers(): Promise<void> {
  if ((await repo.listUsers()).length > 0) return;

  const adminUsername = (process.env.ADMIN_USERNAME || 'admin').trim();
  let adminPassword = process.env.ADMIN_PASSWORD || '';
  if (!adminPassword) {
    if (IS_PRODUCTION) {
      adminPassword = crypto.randomBytes(18).toString('base64url');
      console.warn('='.repeat(72));
      console.warn(`[BOOTSTRAP] ADMIN_PASSWORD not set. Generated one-time password for "${adminUsername}":`);
      console.warn(`            ${adminPassword}`);
      console.warn('            Log in and change it immediately (shown only once, not persisted).');
      console.warn('='.repeat(72));
    } else {
      adminPassword = 'ChangeMe@KBJ2026!';
    }
  }

  await createUser({
    username: adminUsername,
    password: adminPassword,
    displayName: 'System Administrator',
    email: 'admin@kbjcapital.co.th',
    role: 'admin',
  });
  console.log(`[Auth] Bootstrap admin user "${adminUsername}" created.`);

  // Demo role accounts exist only in dev/test mode so the RBAC matrix can be exercised
  if (!IS_PRODUCTION) {
    await createUser({
      username: 'maker',
      password: 'Maker@KBJ2026!',
      displayName: 'Demo Maker (Author)',
      email: 'maker.demo@kbjcapital.co.th',
      role: 'maker',
    });
    await createUser({
      username: 'checker',
      password: 'Checker@KBJ2026!',
      displayName: 'Demo Checker (Compliance)',
      email: 'checker.demo@kbjcapital.co.th',
      role: 'checker',
    });
    await createUser({
      username: 'staff',
      password: 'Staff@KBJ2026!',
      displayName: 'Demo Staff (Read-only)',
      email: 'staff.demo@kbjcapital.co.th',
      role: 'staff',
    });
    console.log('[Auth] Dev demo accounts created: maker / checker / staff (passwords Maker|Checker|Staff@KBJ2026!).');
  }
}

// W2-FIX-1 (codex fix-cycle): boot-time regression fixtures for the spawned
// smoke-test servers only (SMOKE_SEED_W2FIX1_FIXTURES=1, non-production).
//   - w2fix1-legacy-pending: a pre-migration pending submission with NO
//     submitter identity (blocker 2) — approve/reject must deny it with 409
//     until a fresh submission cycle stamps a verified submitter.
//   - w2fix1-live-synced: a live item (blocker 3) for the state-only
//     withdrawal path and the audit-failure rollback probe.
// No API path can manufacture the legacy shape (every submit stamps
// submittedBy), hence the boot-time seed. Re-written on every boot so
// repeated runs start from identical fixture state.
async function seedW2Fix1Fixtures(): Promise<void> {
  const legacyPending: NewsItem = {
    id: 'w2fix1-legacy-pending',
    title: '[W2-FIX-1] Legacy pending submission (no submitter identity)',
    titleEn: '',
    summary: 'Fixture: pre-migration row left in pending_approval by the additive W2-1 migration.',
    content: 'Fixture body — decisions on this row must be denied until a fresh submission cycle stamps a verified submitter.',
    category: 'kbj-news',
    categoryLabel: 'News',
    badge: 'News',
    badgeColor: 'orange',
    imageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1000&q=80',
    publishedAt: '2026-09-10',
    readTime: '3 นาที',
    author: 'Regression Fixture',
    department: 'QA',
    isImportantAlert: false,
    views: 0,
    externalSyncStatus: 'pending_approval',
    syncToExternal: false,
    externalCategory: 'press-release',
    // submittedBy / submittedAt intentionally ABSENT — the legacy shape under
    // test (blocker 2).
  };
  const liveSynced: NewsItem = {
    id: 'w2fix1-live-synced',
    title: '[W2-FIX-1] Live synced item (withdrawal fixture)',
    titleEn: '',
    summary: 'Fixture: a live public item for the state-only withdrawal regression.',
    content: 'Fixture body — withdrawal must preserve this content byte-for-byte while returning the item to draft.',
    category: 'kbj-news',
    categoryLabel: 'News',
    badge: 'News',
    badgeColor: 'orange',
    imageUrl: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1000&q=80',
    publishedAt: '2026-09-10',
    readTime: '3 นาที',
    author: 'Regression Fixture',
    department: 'QA',
    isImportantAlert: false,
    views: 0,
    externalSyncStatus: 'synced',
    syncToExternal: true,
    externalCategory: 'press-release',
    approvedBy: 'fixture-checker',
    approvedAt: '2026-09-10 00:00:00',
    submittedBy: 'fixture-maker',
    submittedAt: '2026-09-10 00:00:00',
  };
  for (const item of [legacyPending, liveSynced]) {
    if (await repo.findNews(item.id)) await repo.saveNews(item);
    else await repo.insertNews(item);
  }
  console.log('[W2-FIX-1] Regression fixtures seeded: w2fix1-legacy-pending (pending_approval, no submitter), w2fix1-live-synced (synced).');
}

// ==========================================
// VITE MIDDLEWARE & SERVER INITIALIZATION
// ==========================================

async function startServer() {
  // Persistence selection (D3): PostgreSQL when DATABASE_URL is set, else in-memory.
  const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
  if (DATABASE_URL) {
    repo = new PostgresRepository(DATABASE_URL);
    try {
      await repo.init();
    } catch (err) {
      console.error('[FATAL] PostgreSQL initialization failed:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  } else {
    await repo.init();
  }

  // Start the expired-session sweeper (hourly; unref'd so it never holds the
  // process open). Also purges stale login-budget windows (W2-5) — storage
  // reclamation only; the upsert self-heals expired windows, so correctness
  // never depends on this sweep.
  sessionSweeper = setInterval(() => {
    repo.deleteExpiredSessions().catch((err) => {
      console.error('[SessionSweeper] Failed to purge expired sessions:', err instanceof Error ? err.message : err);
    });
    repo.purgeStaleLoginBudgets().catch((err) => {
      console.error('[SessionSweeper] Failed to purge stale login-rate-limit windows:', err instanceof Error ? err.message : err);
    });
  }, 60 * 60 * 1000);
  sessionSweeper.unref();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Dev Mode] Vite middleware mounted');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log(`[Production Mode] Serving static assets from ${distPath}`);
  }

  // Ensure the bootstrap admin exists before the port opens, so no login can
  // race user creation at boot.
  await bootstrapUsers();

  // W2-FIX-1 regression fixtures — spawned smoke-test servers only (the hook
  // const is inert unless SMOKE_SEED_W2FIX1_FIXTURES=1 and non-production).
  if (SEED_W2FIX1_FIXTURES) await seedW2Fix1Fixtures();

  const server = app.listen(PORT, HOST, () => {
    console.log(`====================================================`);
    console.log(`🚀 KB J Capital Full-Stack Portal Running`);
    console.log(`📡 URL: http://${HOST}:${PORT}`);
    console.log(`🩺 Liveness Probe:  http://${HOST}:${PORT}/healthz`);
    console.log(`✅ Readiness Probe: http://${HOST}:${PORT}/readyz`);
    console.log(`====================================================`);
  });

  // Graceful shutdown handlers for Kubernetes SIGTERM / SIGINT
  const shutdown = async (signal: string) => {
    console.log(`\n[${signal}] Received. Starting graceful shutdown sequence...`);
    if (sessionSweeper) clearInterval(sessionSweeper);
    server.close(async () => {
      console.log('HTTP server closed cleanly. Kubernetes pod ready to terminate.');
      try {
        await repo.close();
        console.log('Database pool closed.');
      } catch (err) {
        console.error('Error closing database pool:', err instanceof Error ? err.message : err);
      }
      process.exit(0);
    });

    // Force terminate if connections stay alive too long
    setTimeout(() => {
      console.error('Forcefully terminating process after 10s timeout.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
