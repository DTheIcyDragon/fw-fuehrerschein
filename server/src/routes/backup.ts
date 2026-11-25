import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import express, { Router } from 'express';
import { type AppDatabase, backupDatabaseToFile } from '../db/database.js';
import { requireRole } from '../middleware/auth.js';
import type { SettingsService } from '../services/settings.js';
import { HttpError, asyncHandler } from '../utils/asyncHandler.js';

interface BackupMemberRow {
  id: number;
  first_name: string;
  last_name: string;
  personnel_number: string | null;
  unit: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  license_number: string | null;
  card_issued_at: string | null;
  card_expires_at: string | null;
  issuing_authority: string | null;
  global_key_numbers_json: string;
  ban_active: number;
  ban_from: string | null;
  ban_until: string | null;
  ban_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface BackupLicenseRow {
  id: number;
  member_id: number;
  license_class: string;
  issued_at: string | null;
  expires_at: string | null;
  key_numbers_json: string;
  notes: string | null;
}

interface BackupInspectionRow {
  id: number;
  member_id: number;
  inspected_at: string;
  inspector_user_id: number | null;
  inspector_name: string;
  result: string;
  notes: string | null;
  created_at: string;
}

interface BackupVehicleRow {
  id: number;
  name: string;
  call_sign: string | null;
  license_plate: string | null;
  unit: string | null;
  required_classes_json: string;
  is_automatic: number;
  notes: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

const SAFE_SETTINGS_KEYS = [
  'department_name',
  'federal_state',
  'state_rules',
  'inspection_interval_months',
  'license_warn_days',
  'inspection_warn_days',
  'notify_digest_enabled',
  'notify_digest_frequency',
  'notify_digest_weekday',
  'notify_digest_hour',
  'notify_digest_recipients',
  'notify_members_enabled',
  'notify_member_days_before',
] as const;

const REQUIRED_SQLITE_TABLES = [
  'members',
  'member_licenses',
  'inspections',
  'vehicles',
  'settings',
] as const;

const SQLITE_MAGIC = Buffer.from('SQLite format 3\0', 'ascii');

function safeJsonArray(value: unknown, fallback = '[]'): string {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
    } catch {
      // fall through
    }
  }
  return fallback;
}

function restoreBackupDataAtomically(
  deps: { db: AppDatabase; settings: SettingsService },
  data: {
    members: Array<Record<string, unknown>>;
    memberLicenses: Array<Record<string, unknown>>;
    inspections: Array<Record<string, unknown>>;
    vehicles: Array<Record<string, unknown>>;
    settingsObj?: Record<string, unknown>;
  },
): { members: number; member_licenses: number; inspections: number; vehicles: number } {
  const { members, memberLicenses, inspections, vehicles, settingsObj } = data;
  const userExistsStmt = deps.db.prepare('SELECT id FROM users WHERE id = ?');
  const now = new Date().toISOString();

  deps.db.exec('BEGIN IMMEDIATE');
  try {
    deps.db.exec('DELETE FROM inspections');
    deps.db.exec('DELETE FROM member_licenses');
    deps.db.exec('DELETE FROM members');
    deps.db.exec('DELETE FROM vehicles');

    const insertMember = deps.db.prepare(`
      INSERT INTO members (
        id, first_name, last_name, personnel_number, unit, email, phone, status,
        license_number, card_issued_at, card_expires_at, issuing_authority,
        global_key_numbers_json, ban_active, ban_from, ban_until, ban_reason,
        notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const m of members) {
      const status =
        m.status === 'inactive' || m.status === 'archived' ? m.status : 'active';
      insertMember.run(
        Number(m.id),
        String(m.first_name).trim(),
        String(m.last_name).trim(),
        m.personnel_number ? String(m.personnel_number) : null,
        m.unit ? String(m.unit) : null,
        m.email ? String(m.email) : null,
        m.phone ? String(m.phone) : null,
        status,
        m.license_number ? String(m.license_number) : null,
        m.card_issued_at ? String(m.card_issued_at) : null,
        m.card_expires_at ? String(m.card_expires_at) : null,
        m.issuing_authority ? String(m.issuing_authority) : null,
        safeJsonArray(m.global_key_numbers ?? m.global_key_numbers_json),
        m.ban_active ? 1 : 0,
        m.ban_from ? String(m.ban_from) : null,
        m.ban_until ? String(m.ban_until) : null,
        m.ban_reason ? String(m.ban_reason) : null,
        m.notes ? String(m.notes) : null,
        m.created_at ? String(m.created_at) : now,
        m.updated_at ? String(m.updated_at) : now,
      );
    }

    const insertLicense = deps.db.prepare(`
      INSERT INTO member_licenses (member_id, license_class, issued_at, expires_at, key_numbers_json, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const l of memberLicenses) {
      insertLicense.run(
        Number(l.member_id),
        String(l.license_class),
        l.issued_at ? String(l.issued_at) : null,
        l.expires_at ? String(l.expires_at) : null,
        safeJsonArray(l.key_numbers ?? l.key_numbers_json),
        l.notes ? String(l.notes) : null,
      );
    }

    const insertInspection = deps.db.prepare(`
      INSERT INTO inspections (
        id, member_id, inspected_at, inspector_user_id, inspector_name, result, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const insp of inspections) {
      let inspectorUserId: number | null = null;
      if (insp.inspector_user_id !== null && insp.inspector_user_id !== undefined) {
        const uid = Number(insp.inspector_user_id);
        if (Number.isInteger(uid) && userExistsStmt.get(uid)) {
          inspectorUserId = uid;
        }
      }
      insertInspection.run(
        insp.id !== undefined && Number.isInteger(Number(insp.id)) ? Number(insp.id) : null,
        Number(insp.member_id),
        String(insp.inspected_at),
        inspectorUserId,
        String(insp.inspector_name ?? 'System'),
        String(insp.result),
        insp.notes ? String(insp.notes) : null,
        insp.created_at ? String(insp.created_at) : now,
      );
    }

    const insertVehicle = deps.db.prepare(`
      INSERT INTO vehicles (
        id, name, call_sign, license_plate, unit, required_classes_json,
        is_automatic, notes, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const v of vehicles) {
      insertVehicle.run(
        v.id !== undefined && Number.isInteger(Number(v.id)) ? Number(v.id) : null,
        String(v.name).trim(),
        v.call_sign ? String(v.call_sign) : null,
        v.license_plate ? String(v.license_plate) : null,
        v.unit ? String(v.unit) : null,
        safeJsonArray(v.required_classes ?? v.required_classes_json),
        v.is_automatic ? 1 : 0,
        v.notes ? String(v.notes) : null,
        v.active === false || v.active === 0 ? 0 : 1,
        v.created_at ? String(v.created_at) : now,
        v.updated_at ? String(v.updated_at) : now,
      );
    }

    if (settingsObj) {
      const allowedPatch: Record<string, unknown> = {};
      for (const key of SAFE_SETTINGS_KEYS) {
        if (key in settingsObj) allowedPatch[key] = settingsObj[key];
      }
      if (Object.keys(allowedPatch).length > 0) {
        deps.settings.updateSettings(allowedPatch);
      }
    }

    deps.db.exec('COMMIT');
  } catch (err) {
    try {
      deps.db.exec('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    throw err;
  }

  return {
    members: members.length,
    member_licenses: memberLicenses.length,
    inspections: inspections.length,
    vehicles: vehicles.length,
  };
}

export function createBackupRouter(deps: {
  db: AppDatabase;
  settings: SettingsService;
}): Router {
  const router = Router();

  router.get(
    '/backup/sqlite',
    requireRole('admin'),
    asyncHandler((_req, res, next) => {
      const tmpPath = path.join(os.tmpdir(), `fw-fuehrerschein-backup-${Date.now()}-${randomUUID()}.db`);
      try {
        backupDatabaseToFile(deps.db, tmpPath);
      } catch (err) {
        try {
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch {
          // ignore cleanup failure
        }
        next(err);
        return;
      }

      const cleanup = () => {
        try {
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch {
          // ignore cleanup failure
        }
      };

      res.setHeader('Content-Type', 'application/x-sqlite3');
      res.download(tmpPath, 'fw-fuehrerschein-backup.db', (err) => {
        cleanup();
        if (err && !res.headersSent) {
          next(err);
        }
      });
    }),
  );

  router.get(
    '/backup/json',
    requireRole('admin'),
    asyncHandler((_req, res) => {
      const membersRaw = deps.db.prepare('SELECT * FROM members ORDER BY id ASC').all() as unknown as BackupMemberRow[];
      const licensesRaw = deps.db
        .prepare('SELECT * FROM member_licenses ORDER BY id ASC')
        .all() as unknown as BackupLicenseRow[];
      const inspectionsRaw = deps.db
        .prepare('SELECT * FROM inspections ORDER BY id ASC')
        .all() as unknown as BackupInspectionRow[];
      const vehiclesRaw = deps.db.prepare('SELECT * FROM vehicles ORDER BY id ASC').all() as unknown as BackupVehicleRow[];

      const pub = deps.settings.getPublicSettings();
      const nonSensitiveSettings = {
        department_name: pub.department_name,
        federal_state: pub.federal_state,
        state_rules: pub.state_rules,
        inspection_interval_months: pub.inspection_interval_months,
        license_warn_days: pub.license_warn_days,
        inspection_warn_days: pub.inspection_warn_days,
        notify_digest_enabled: pub.notify_digest_enabled,
        notify_digest_frequency: pub.notify_digest_frequency,
        notify_digest_weekday: pub.notify_digest_weekday,
        notify_digest_hour: pub.notify_digest_hour,
        notify_digest_recipients: pub.notify_digest_recipients,
        notify_members_enabled: pub.notify_members_enabled,
        notify_member_days_before: pub.notify_member_days_before,
      };

      const payload = {
        version: 1,
        exported_at: new Date().toISOString(),
        members: membersRaw.map((m) => ({
          ...m,
          ban_active: Boolean(m.ban_active),
          global_key_numbers: JSON.parse(m.global_key_numbers_json || '[]') as string[],
        })),
        member_licenses: licensesRaw.map((l) => ({
          ...l,
          key_numbers: JSON.parse(l.key_numbers_json || '[]') as string[],
        })),
        inspections: inspectionsRaw,
        vehicles: vehiclesRaw.map((v) => ({
          ...v,
          is_automatic: Boolean(v.is_automatic),
          active: Boolean(v.active),
          required_classes: JSON.parse(v.required_classes_json || '[]') as string[],
        })),
        settings: nonSensitiveSettings,
      };

      res.setHeader('Content-Disposition', 'attachment; filename="fw-fuehrerschein-backup.json"');
      res.json(payload);
    }),
  );

  router.post(
    '/restore/json',
    requireRole('admin'),
    asyncHandler((req, res) => {
      const body = req.body as Record<string, unknown> | undefined;
      if (!body || typeof body !== 'object') {
        throw new HttpError(400, 'Ungültiges Backup-JSON');
      }

      const members = body.members;
      const memberLicenses = body.member_licenses;
      const inspections = body.inspections;
      const vehicles = body.vehicles;

      if (
        !Array.isArray(members) ||
        !Array.isArray(memberLicenses) ||
        !Array.isArray(inspections) ||
        !Array.isArray(vehicles)
      ) {
        throw new HttpError(
          400,
          'Backup-JSON muss Arrays für members, member_licenses, inspections und vehicles enthalten.',
        );
      }

      const memberIdSet = new Set<number>();
      for (const m of members) {
        if (!m || typeof m !== 'object') {
          throw new HttpError(400, 'Ungültiger Kamerad-Eintrag im Backup');
        }
        const rec = m as Record<string, unknown>;
        const id = Number(rec.id);
        if (!Number.isInteger(id) || id <= 0 || !String(rec.first_name ?? '').trim() || !String(rec.last_name ?? '').trim()) {
          throw new HttpError(400, 'Kamerad-Eintrag im Backup benötigt gültige id, first_name und last_name');
        }
        memberIdSet.add(id);
      }

      for (const l of memberLicenses) {
        if (!l || typeof l !== 'object') {
          throw new HttpError(400, 'Ungültiger Führerschein-Eintrag im Backup');
        }
        const rec = l as Record<string, unknown>;
        if (!memberIdSet.has(Number(rec.member_id)) || !String(rec.license_class ?? '').trim()) {
          throw new HttpError(400, 'Führerschein-Eintrag verweist auf ungültigen Kameraden oder fehlende Klasse');
        }
      }

      for (const insp of inspections) {
        if (!insp || typeof insp !== 'object') {
          throw new HttpError(400, 'Ungültiger Kontroll-Eintrag im Backup');
        }
        const rec = insp as Record<string, unknown>;
        if (!memberIdSet.has(Number(rec.member_id)) || !String(rec.inspected_at ?? '').trim()) {
          throw new HttpError(400, 'Kontroll-Eintrag verweist auf ungültigen Kameraden oder fehlendes Datum');
        }
        if (rec.result !== 'ok' && rec.result !== 'issue') {
          throw new HttpError(400, 'Kontroll-Eintrag hat ungültiges result (ok oder issue erwartet)');
        }
      }

      for (const v of vehicles) {
        if (!v || typeof v !== 'object') {
          throw new HttpError(400, 'Ungültiger Fahrzeug-Eintrag im Backup');
        }
        const rec = v as Record<string, unknown>;
        if (!String(rec.name ?? '').trim()) {
          throw new HttpError(400, 'Fahrzeug-Eintrag benötigt einen Namen');
        }
      }

      const restored = restoreBackupDataAtomically(deps, {
        members: members as Array<Record<string, unknown>>,
        memberLicenses: memberLicenses as Array<Record<string, unknown>>,
        inspections: inspections as Array<Record<string, unknown>>,
        vehicles: vehicles as Array<Record<string, unknown>>,
        settingsObj:
          body.settings && typeof body.settings === 'object'
            ? (body.settings as Record<string, unknown>)
            : undefined,
      });

      res.json({
        ok: true,
        restored,
      });
    }),
  );

  router.post(
    '/restore/sqlite',
    requireRole('admin'),
    express.raw({ type: ['application/octet-stream', 'application/x-sqlite3'], limit: '50mb' }),
    asyncHandler((req, res) => {
      const body = req.body;
      if (
        !Buffer.isBuffer(body) ||
        body.length < 100 ||
        !body.subarray(0, SQLITE_MAGIC.length).equals(SQLITE_MAGIC)
      ) {
        throw new HttpError(400, 'Ungültige SQLite-Backup-Datei.');
      }

      const tmpPath = path.join(os.tmpdir(), `fw-restore-${randomUUID()}.db`);
      let tmpDb: DatabaseSync | null = null;

      try {
        fs.writeFileSync(tmpPath, body);

        try {
          tmpDb = new DatabaseSync(tmpPath, { readOnly: true });
          const integrity = tmpDb.prepare('PRAGMA integrity_check').get() as
            | { integrity_check?: string }
            | undefined;
          if (integrity?.integrity_check !== 'ok') {
            throw new HttpError(400, 'SQLite-Backup-Datei ist beschädigt (integrity_check fehlgeschlagen).');
          }

          const tableRows = tmpDb
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
            .all() as Array<{ name: string }>;
          const tableSet = new Set(tableRows.map((r) => r.name));
          for (const requiredTable of REQUIRED_SQLITE_TABLES) {
            if (!tableSet.has(requiredTable)) {
              throw new HttpError(
                400,
                `SQLite-Backup enthält nicht die erforderliche Tabelle "${requiredTable}".`,
              );
            }
          }
        } catch (err) {
          if (err instanceof HttpError) throw err;
          throw new HttpError(400, 'Ungültige oder beschädigte SQLite-Datenbankdatei.');
        }

        const members = tmpDb
          .prepare('SELECT * FROM members ORDER BY id ASC')
          .all() as unknown as Array<Record<string, unknown>>;
        const memberLicenses = tmpDb
          .prepare('SELECT * FROM member_licenses ORDER BY id ASC')
          .all() as unknown as Array<Record<string, unknown>>;
        const inspections = tmpDb
          .prepare('SELECT * FROM inspections ORDER BY id ASC')
          .all() as unknown as Array<Record<string, unknown>>;
        const vehicles = tmpDb
          .prepare('SELECT * FROM vehicles ORDER BY id ASC')
          .all() as unknown as Array<Record<string, unknown>>;

        const settingsRows = tmpDb
          .prepare('SELECT key, value_json FROM settings')
          .all() as Array<{ key: string; value_json: string }>;
        const settingsObj: Record<string, unknown> = {};
        const safeKeySet = new Set<string>(SAFE_SETTINGS_KEYS);
        for (const row of settingsRows) {
          if (safeKeySet.has(row.key)) {
            try {
              settingsObj[row.key] = JSON.parse(row.value_json);
            } catch {
              // ignore malformed setting json
            }
          }
        }

        const restored = restoreBackupDataAtomically(deps, {
          members,
          memberLicenses,
          inspections,
          vehicles,
          settingsObj,
        });

        res.json({
          ok: true,
          restored,
        });
      } finally {
        if (tmpDb) {
          try {
            tmpDb.close();
          } catch {
            // ignore close error
          }
        }
        try {
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch {
          // ignore cleanup failure
        }
      }
    }),
  );

  return router;
}
