/**
 * KB J Capital Intranet — Database Migration Tool
 *
 * Imports an export produced by GET /api/system/export into PostgreSQL.
 * The export shape is { exportTimestamp, version, schemaTarget, storage,
 * counts, tables: { news, banners, contacts, meeting_rooms, documents,
 * audit_logs, sync_logs } } — table keys match the schema table names and
 * field names are the TypeScript camelCase fields from src/types.ts.
 *
 * Usage:
 *   DATABASE_URL="postgresql://user:pass@localhost:5432/kbj_intranet" \
 *     node scripts/migrate.js path/to/export.json
 *
 * Notes:
 *   - Content tables are upserted by id (re-running refreshes rows).
 *   - sync_logs and audit_logs are append-only: ON CONFLICT DO NOTHING.
 *   - Users are NOT part of the export; use scripts/seed-users.js for accounts.
 *   - Run scripts/schema.sql first on a fresh database (or let the server
 *     create the schema at boot).
 */

import fs from 'node:fs';
import { Client } from 'pg';

const NEWS_COLUMNS = `(id, title, title_en, summary, content, category, category_label, badge, badge_color,
  image_url, published_at, read_time, author, department, is_important_alert, views, sync_to_external,
  external_sync_status, external_category, attachment_url, attachment_name, approved_by, approved_at)`;

function newsParams(item) {
  return [
    item.id,
    item.title,
    item.titleEn || null,
    item.summary,
    item.content,
    item.category,
    item.categoryLabel,
    item.badge || null,
    item.badgeColor || null,
    item.imageUrl || null,
    item.publishedAt,
    item.readTime || null,
    item.author,
    item.department,
    Boolean(item.isImportantAlert),
    item.views || 0,
    Boolean(item.syncToExternal),
    item.externalSyncStatus || null,
    item.externalCategory || null,
    item.attachmentUrl || null,
    item.attachmentName || null,
    item.approvedBy || null,
    item.approvedAt || null,
  ];
}

const BANNER_COLUMNS = `(id, title, subtitle, badge, image_url, action_url, action_text, sort_order, is_active)`;

function bannerParams(item) {
  return [
    item.id,
    item.title,
    item.subtitle,
    item.badge,
    item.imageUrl,
    item.actionUrl,
    item.actionText,
    item.order || 0,
    item.isActive !== false,
  ];
}

const CONTACT_COLUMNS = `(id, name, name_en, position, department, extension, direct_phone, email, floor, avatar_url)`;

function contactParams(item) {
  return [
    item.id,
    item.name,
    item.nameEn || '',
    item.position,
    item.department,
    item.extension,
    item.directPhone || null,
    item.email,
    item.floor,
    item.avatarUrl || null,
  ];
}

const ROOM_COLUMNS = `(id, name, code, floor, capacity, facilities, status, current_booking)`;

function roomParams(item) {
  return [
    item.id,
    item.name,
    item.code,
    item.floor,
    item.capacity,
    JSON.stringify(item.facilities || []),
    item.status,
    item.currentBooking ? JSON.stringify(item.currentBooking) : null,
  ];
}

const DOCUMENT_COLUMNS = `(id, title, title_en, category, department, version, updated_at, file_size, download_url, is_new)`;

function documentParams(item) {
  return [
    item.id,
    item.title,
    item.titleEn || '',
    item.category,
    item.department,
    item.version,
    item.updatedAt,
    item.fileSize,
    item.downloadUrl,
    Boolean(item.isNew),
  ];
}

const SYNC_LOG_COLUMNS = `(id, timestamp, item_id, item_title, action, status, target_endpoint, synced_by)`;

function syncLogParams(item) {
  return [
    item.id,
    item.timestamp,
    item.itemId,
    item.itemTitle,
    item.action,
    item.status,
    item.targetEndpoint,
    item.syncedBy,
  ];
}

const AUDIT_LOG_COLUMNS = `(id, timestamp, actor, actor_role, action, target_resource, resource_id, details, ip_address, status)`;

function auditLogParams(item) {
  return [
    item.id,
    item.timestamp,
    item.actor,
    item.actorRole,
    item.action,
    item.targetResource,
    item.resourceId,
    item.details,
    item.ipAddress || null,
    item.status,
  ];
}

function placeholders(count) {
  return Array.from({ length: count }, (_, i) => `$${i + 1}`).join(', ');
}

async function migrate() {
  const exportFilePath = process.argv[2] || './kbj_intranet_backup.json';
  if (!fs.existsSync(exportFilePath)) {
    console.error(`Export file not found: ${exportFilePath}`);
    console.error('Export data first via GET /api/system/export (admin session required).');
    process.exit(1);
  }

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(exportFilePath, 'utf-8'));
  } catch (err) {
    console.error(`Could not parse export JSON: ${err.message}`);
    process.exit(1);
  }

  // The export nests all tables under `tables` (not `data`).
  const tables = payload.tables || {};
  if (!tables.news && !tables.banners && !tables.contacts && !tables.documents) {
    console.error('Export file does not contain a "tables" object with expected keys (news, banners, contacts, ...).');
    console.error('Was this file produced by GET /api/system/export?');
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kbj_intranet';
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database successfully.');
    await client.query('BEGIN');

    const batches = [
      {
        name: 'news',
        label: 'news articles',
        columns: NEWS_COLUMNS,
        params: newsParams,
        conflict: `DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, content = EXCLUDED.content,
          category = EXCLUDED.category, category_label = EXCLUDED.category_label, badge = EXCLUDED.badge,
          badge_color = EXCLUDED.badge_color, image_url = EXCLUDED.image_url, published_at = EXCLUDED.published_at,
          read_time = EXCLUDED.read_time, author = EXCLUDED.author, department = EXCLUDED.department,
          is_important_alert = EXCLUDED.is_important_alert, views = EXCLUDED.views,
          sync_to_external = EXCLUDED.sync_to_external, external_sync_status = EXCLUDED.external_sync_status,
          external_category = EXCLUDED.external_category, attachment_url = EXCLUDED.attachment_url,
          attachment_name = EXCLUDED.attachment_name, approved_by = EXCLUDED.approved_by, approved_at = EXCLUDED.approved_at`,
      },
      {
        name: 'banners',
        label: 'banners',
        columns: BANNER_COLUMNS,
        params: bannerParams,
        conflict: `DO UPDATE SET title = EXCLUDED.title, subtitle = EXCLUDED.subtitle, badge = EXCLUDED.badge,
          image_url = EXCLUDED.image_url, action_url = EXCLUDED.action_url, action_text = EXCLUDED.action_text,
          sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active`,
      },
      {
        name: 'contacts',
        label: 'directory contacts',
        columns: CONTACT_COLUMNS,
        params: contactParams,
        conflict: `DO UPDATE SET name = EXCLUDED.name, name_en = EXCLUDED.name_en, position = EXCLUDED.position,
          department = EXCLUDED.department, extension = EXCLUDED.extension, direct_phone = EXCLUDED.direct_phone,
          email = EXCLUDED.email, floor = EXCLUDED.floor, avatar_url = EXCLUDED.avatar_url`,
      },
      {
        name: 'meeting_rooms',
        label: 'meeting rooms',
        columns: ROOM_COLUMNS,
        params: roomParams,
        conflict: `DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, floor = EXCLUDED.floor,
          capacity = EXCLUDED.capacity, facilities = EXCLUDED.facilities, status = EXCLUDED.status,
          current_booking = EXCLUDED.current_booking`,
      },
      {
        name: 'documents',
        label: 'policy documents',
        columns: DOCUMENT_COLUMNS,
        params: documentParams,
        conflict: `DO UPDATE SET title = EXCLUDED.title, title_en = EXCLUDED.title_en, category = EXCLUDED.category,
          department = EXCLUDED.department, version = EXCLUDED.version, updated_at = EXCLUDED.updated_at,
          file_size = EXCLUDED.file_size, download_url = EXCLUDED.download_url, is_new = EXCLUDED.is_new`,
      },
      {
        name: 'sync_logs',
        label: 'sync logs',
        columns: SYNC_LOG_COLUMNS,
        params: syncLogParams,
        conflict: 'DO NOTHING', // append-only
      },
      {
        name: 'audit_logs',
        label: 'audit logs',
        columns: AUDIT_LOG_COLUMNS,
        params: auditLogParams,
        conflict: 'DO NOTHING', // append-only (BOT/PDPA immutability)
      },
    ];

    for (const batch of batches) {
      const rows = tables[batch.name] || [];
      if (!rows.length) {
        console.log(`No ${batch.label} in export, skipping.`);
        continue;
      }
      console.log(`Migrating ${rows.length} ${batch.label}...`);
      for (const row of rows) {
        const values = batch.params(row);
        await client.query(
          `INSERT INTO ${batch.name} ${batch.columns} VALUES (${placeholders(values.length)})
           ON CONFLICT (id) ${batch.conflict};`,
          values
        );
      }
    }

    await client.query('COMMIT');
    console.log('Database migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    try {
      await client.query('ROLLBACK');
      console.error('Transaction rolled back — database left unchanged.');
    } catch {
      // connection already gone; nothing to roll back
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
