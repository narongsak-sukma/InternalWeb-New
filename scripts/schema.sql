-- ============================================================================
-- KB J Capital Co., Ltd. - Corporate Intranet & CMS Portal
-- Production PostgreSQL Schema
-- ============================================================================
-- This file is the canonical schema. The server (server.ts PG_DDL) applies the
-- SAME statements automatically at boot via CREATE TABLE IF NOT EXISTS, so this
-- script is only needed for manual provisioning (fresh database, DBA review,
-- CI). Keep the two in lockstep when changing either.
--
-- Column names are the canonical snake_case set mapped 1:1 to the TypeScript
-- types in src/types.ts (one mapper per entity in server.ts):
--   users        -> User            (id, username, password_hash, display_name,
--                                    email, role, is_active, created_at)
--   sessions     -> session records (sid, user_id, created_at, expires_at)
--   news         -> NewsItem        (badge_color, image_url, read_time,
--                                    external_category, attachment_* included)
--   banners      -> BannerSlide     (badge, action_url, action_text,
--                                    sort_order, is_active)
--   contacts     -> DirectoryContact(name_en, direct_phone included)
--   meeting_rooms-> MeetingRoom     (facilities jsonb, current_booking jsonb)
--   documents    -> PolicyDocument  (title_en, department, version,
--                                    file_size, download_url, is_new)
--   sync_logs    -> SyncLog
--   audit_logs   -> AuditLog        (resource_id included)
--
-- Notes:
--   * news.published_at is the display label the UI produces (Thai locale
--     date string) and is stored as-is; published_at_ts is a nullable real
--     timestamp reserved for future sorting/migration tooling.
--   * documents.updated_at is the display label; the DB row timestamp for
--     documents is row_updated_at (separate trigger function).
--   * seq bigserial columns exist purely for stable ordering semantics
--     (matches the in-memory store's newest-first / append ordering).
--   * sync_logs and audit_logs are append-only (BOT/PDPA immutability) —
--     no updated_at trigger by design.
-- ============================================================================

-- 1. ENUM TYPES
DO $$ BEGIN
  CREATE TYPE user_role_enum AS ENUM ('admin', 'checker', 'maker', 'staff');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. USERS & SESSIONS (authentication / RBAC)
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

-- 3. NEWS & REGULATORY ANNOUNCEMENTS
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
  submitted_by text,   -- FR-NEWS-009: submitter user id (self-approval guard)
  submitted_at text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_news_category ON news (category);
CREATE INDEX IF NOT EXISTS idx_news_sync_status ON news (external_sync_status);
-- W2-1 (FR-NEWS-009): ensure the submitter identity columns on pre-existing
-- news tables (CREATE TABLE IF NOT EXISTS does not alter existing tables).
ALTER TABLE news ADD COLUMN IF NOT EXISTS submitted_by text;
ALTER TABLE news ADD COLUMN IF NOT EXISTS submitted_at text;

-- 4. HERO CAROUSEL BANNERS
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

-- 5. INTERNAL PHONE DIRECTORY & CONTACTS
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

-- 6. MEETING ROOMS
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

-- 7. CORPORATE POLICIES & FORMS
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

-- 8. PUBLIC SYNC LOGS (Outbound Webhook Transmission, append-only)
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

-- 9. IMMUTABLE AUDIT TRAIL (BOT & PDPA Compliance, append-only)
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

-- 10. AUTO-UPDATE TIMESTAMP TRIGGERS
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

-- ============================================================================
-- End of Schema Definition
-- ============================================================================
