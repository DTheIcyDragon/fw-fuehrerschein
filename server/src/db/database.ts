import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { getDefaultStateRules } from '../../../shared/licenseRules.js';

export type AppDatabase = DatabaseSync;

const CURRENT_SCHEMA_VERSION = 2;

const DEFAULT_SETTINGS: Array<[string, unknown]> = [
  ['department_name', 'Freiwillige Feuerwehr'],
  ['inspection_interval_months', 6],
  ['license_warn_days', 90],
  ['inspection_warn_days', 30],
  ['federal_state', 'SH'],
  ['state_rules', getDefaultStateRules('SH')],
  ['mail_provider', 'none'],
  ['notify_digest_enabled', false],
  ['notify_digest_frequency', 'weekly'],
  ['notify_digest_weekday', 1],
  ['notify_digest_hour', 8],
  ['notify_digest_recipients', []],
  ['notify_members_enabled', false],
  ['notify_member_days_before', [90, 30, 7]],
];

export function openDatabase(dataDir: string): AppDatabase {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'fw-fuehrerschein.db');
  const db = new DatabaseSync(dbPath);

  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'inspector', 'viewer')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      personnel_number TEXT,
      birth_date TEXT,
      unit TEXT,
      email TEXT,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
      license_number TEXT,
      card_issued_at TEXT,
      card_expires_at TEXT,
      issuing_authority TEXT,
      global_key_numbers_json TEXT NOT NULL DEFAULT '[]',
      ban_active INTEGER NOT NULL DEFAULT 0,
      ban_from TEXT,
      ban_until TEXT,
      ban_reason TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
    CREATE INDEX IF NOT EXISTS idx_members_name ON members(last_name, first_name);

    CREATE TABLE IF NOT EXISTS member_licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      license_class TEXT NOT NULL,
      issued_at TEXT,
      expires_at TEXT,
      key_numbers_json TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      UNIQUE (member_id, license_class)
    );

    CREATE INDEX IF NOT EXISTS idx_member_licenses_member_id ON member_licenses(member_id);

    CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      inspected_at TEXT NOT NULL,
      inspector_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      inspector_name TEXT NOT NULL,
      result TEXT NOT NULL CHECK (result IN ('ok', 'issue')),
      notes TEXT,
      cancelled_at TEXT,
      cancelled_by_name TEXT,
      cancel_reason TEXT,
      checked_eu_card INTEGER NOT NULL DEFAULT 1,
      checked_fw_license INTEGER NOT NULL DEFAULT 0,
      checked_restrictions INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_inspections_member_date
      ON inspections(member_id, inspected_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      call_sign TEXT,
      license_plate TEXT,
      unit TEXT,
      required_classes_json TEXT NOT NULL DEFAULT '[]',
      is_automatic INTEGER NOT NULL DEFAULT 0,
      requires_trailer INTEGER NOT NULL DEFAULT 0,
      requires_briefing INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vehicle_briefings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      briefed_at TEXT,
      notes TEXT,
      UNIQUE (member_id, vehicle_id)
    );

    CREATE INDEX IF NOT EXISTS idx_vehicle_briefings_member ON vehicle_briefings(member_id);
    CREATE INDEX IF NOT EXISTS idx_vehicle_briefings_vehicle ON vehicle_briefings(vehicle_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      actor_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS notification_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dedupe_key TEXT,
      recipient TEXT NOT NULL,
      channel TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      sent_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notification_logs_dedupe_key
      ON notification_logs(dedupe_key);
    CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at
      ON notification_logs(sent_at DESC, id DESC);
  `);

  const now = new Date().toISOString();
  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)',
  );

  for (const [key, value] of DEFAULT_SETTINGS) {
    insertSetting.run(key, JSON.stringify(value), now);
  }
  insertSetting.run('ical_token', JSON.stringify(randomBytes(32).toString('hex')), now);

  runMigrations(db);

  return db;
}

function ensureColumn(
  db: AppDatabase,
  table: string,
  column: string,
  definition: string,
): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function runMigrations(db: AppDatabase): void {
  const row = db.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined;
  const currentVersion = Number(row?.user_version ?? 0);

  if (currentVersion < 2) {
    ensureColumn(db, 'members', 'birth_date', 'TEXT');
    ensureColumn(db, 'vehicles', 'requires_trailer', 'INTEGER NOT NULL DEFAULT 0');
    ensureColumn(db, 'vehicles', 'requires_briefing', 'INTEGER NOT NULL DEFAULT 0');
    ensureColumn(db, 'inspections', 'cancelled_at', 'TEXT');
    ensureColumn(db, 'inspections', 'cancelled_by_name', 'TEXT');
    ensureColumn(db, 'inspections', 'cancel_reason', 'TEXT');
    ensureColumn(db, 'inspections', 'checked_eu_card', 'INTEGER NOT NULL DEFAULT 1');
    ensureColumn(db, 'inspections', 'checked_fw_license', 'INTEGER NOT NULL DEFAULT 0');
    ensureColumn(db, 'inspections', 'checked_restrictions', 'INTEGER NOT NULL DEFAULT 0');
    db.exec(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION};`);
  }
}

export function writeAuditLog(
  db: AppDatabase,
  entry: {
    actorUserId?: number | null;
    actorName: string;
    action: string;
    entityType: string;
    entityId?: number | null;
    details?: unknown;
  },
): void {
  db.prepare(
    `INSERT INTO audit_logs (actor_user_id, actor_name, action, entity_type, entity_id, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    entry.actorUserId ?? null,
    entry.actorName,
    entry.action,
    entry.entityType,
    entry.entityId ?? null,
    entry.details !== undefined ? JSON.stringify(entry.details) : null,
    new Date().toISOString(),
  );
}

export function backupDatabaseToFile(db: AppDatabase, targetPath: string): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath);
  }
  const escaped = targetPath.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${escaped}'`);
}
