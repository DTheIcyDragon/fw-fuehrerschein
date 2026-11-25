import { Router } from 'express';
import { ALL_LICENSE_CLASSES, isValidIsoDate } from '../../../shared/licenseRules.js';
import type { LicenseClass, MemberStatus } from '../../../shared/types.js';
import type { AppDatabase } from '../db/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import type { EvaluationService } from '../services/evaluation.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';

const VALID_CLASSES = new Set<string>(ALL_LICENSE_CLASSES);
const VALID_STATUSES = new Set<MemberStatus>(['active', 'inactive', 'archived']);

function cleanOptionalText(val: unknown): string | null {
  if (val === undefined || val === null) return null;
  const trimmed = String(val).trim();
  return trimmed ? trimmed : null;
}

function cleanOptionalDate(val: unknown, label: string): string | null {
  const text = cleanOptionalText(val);
  if (!text) return null;
  if (!isValidIsoDate(text)) {
    throw new HttpError(400, `${label} hat kein gültiges Datum (YYYY-MM-DD)`);
  }
  return text;
}

function cleanStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return Array.from(new Set(val.map((v) => String(v).trim()).filter(Boolean)));
}

interface NormalizedLicense {
  license_class: LicenseClass;
  issued_at: string | null;
  expires_at: string | null;
  key_numbers: string[];
  notes: string | null;
}

function normalizeLicenses(raw: unknown): NormalizedLicense[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new HttpError(400, 'licenses muss ein Array sein');
  }

  const byClass = new Map<LicenseClass, NormalizedLicense>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      throw new HttpError(400, 'Ungültiger Führerschein-Eintrag');
    }
    const obj = item as Record<string, unknown>;
    const lc = String(obj.license_class ?? '').trim();
    if (!VALID_CLASSES.has(lc)) {
      throw new HttpError(400, `Unbekannte Führerscheinklasse: ${lc}`);
    }
    const licenseClass = lc as LicenseClass;
    byClass.set(licenseClass, {
      license_class: licenseClass,
      issued_at: cleanOptionalDate(obj.issued_at, `Erteilungsdatum (${lc})`),
      expires_at: cleanOptionalDate(obj.expires_at, `Ablaufdatum (${lc})`),
      key_numbers: cleanStringArray(obj.key_numbers),
      notes: cleanOptionalText(obj.notes),
    });
  }

  return Array.from(byClass.values());
}

export function createMembersRouter(
  db: AppDatabase,
  evaluation: EvaluationService,
): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    asyncHandler((req, res) => {
      const q = req.query;
      const members = evaluation.listEvaluatedMembers({
        search: typeof q.search === 'string' ? q.search : undefined,
        unit: typeof q.unit === 'string' ? q.unit : undefined,
        status: typeof q.status === 'string' ? q.status : undefined,
        licenseClass: typeof q.licenseClass === 'string' ? q.licenseClass : undefined,
        trafficLight: typeof q.trafficLight === 'string' ? q.trafficLight : undefined,
      });
      res.json(members);
    }),
  );

  router.get(
    '/units',
    requireAuth,
    asyncHandler((_req, res) => {
      res.json(evaluation.listUnits());
    }),
  );

  router.get(
    '/:id',
    requireAuth,
    asyncHandler((req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new HttpError(400, 'Ungültige Kameraden-ID');
      }
      const member = evaluation.getEvaluatedMember(id);
      if (!member) {
        throw new HttpError(404, 'Kamerad nicht gefunden');
      }
      res.json(member);
    }),
  );

  router.post(
    '/',
    requireRole('admin', 'inspector'),
    asyncHandler((req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const firstName = String(body.first_name ?? '').trim();
      const lastName = String(body.last_name ?? '').trim();
      if (!firstName || !lastName) {
        throw new HttpError(400, 'Vorname und Nachname sind erforderlich');
      }

      const statusRaw = String(body.status ?? 'active').trim() as MemberStatus;
      if (!VALID_STATUSES.has(statusRaw)) {
        throw new HttpError(400, 'Ungültiger Status');
      }

      const licenses = normalizeLicenses(body.licenses);
      const now = new Date().toISOString();

      let newId = 0;
      db.exec('BEGIN');
      try {
        const insertRes = db
          .prepare(`
            INSERT INTO members (
              first_name, last_name, personnel_number, unit, email, phone, status,
              license_number, card_issued_at, card_expires_at, issuing_authority,
              global_key_numbers_json, ban_active, ban_from, ban_until, ban_reason,
              notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            firstName,
            lastName,
            cleanOptionalText(body.personnel_number),
            cleanOptionalText(body.unit),
            cleanOptionalText(body.email),
            cleanOptionalText(body.phone),
            statusRaw,
            cleanOptionalText(body.license_number),
            cleanOptionalDate(body.card_issued_at, 'Karten-Ausstellungsdatum'),
            cleanOptionalDate(body.card_expires_at, 'Karten-Ablaufdatum'),
            cleanOptionalText(body.issuing_authority),
            JSON.stringify(cleanStringArray(body.global_key_numbers)),
            body.ban_active ? 1 : 0,
            cleanOptionalDate(body.ban_from, 'Fahrverbot ab'),
            cleanOptionalDate(body.ban_until, 'Fahrverbot bis'),
            cleanOptionalText(body.ban_reason),
            cleanOptionalText(body.notes),
            now,
            now,
          );

        newId = Number(insertRes.lastInsertRowid);

        const insertLic = db.prepare(`
          INSERT INTO member_licenses (member_id, license_class, issued_at, expires_at, key_numbers_json, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const lic of licenses) {
          insertLic.run(
            newId,
            lic.license_class,
            lic.issued_at,
            lic.expires_at,
            JSON.stringify(lic.key_numbers),
            lic.notes,
          );
        }

        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }

      res.status(201).json(evaluation.getEvaluatedMember(newId));
    }),
  );

  router.put(
    '/:id',
    requireRole('admin', 'inspector'),
    asyncHandler((req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new HttpError(400, 'Ungültige Kameraden-ID');
      }

      const existing = evaluation.getEvaluatedMember(id);
      if (!existing) {
        throw new HttpError(404, 'Kamerad nicht gefunden');
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const firstName =
        'first_name' in body ? String(body.first_name ?? '').trim() : existing.first_name;
      const lastName =
        'last_name' in body ? String(body.last_name ?? '').trim() : existing.last_name;
      if (!firstName || !lastName) {
        throw new HttpError(400, 'Vorname und Nachname sind erforderlich');
      }

      const statusRaw = (
        'status' in body ? String(body.status ?? '').trim() : existing.status
      ) as MemberStatus;
      if (!VALID_STATUSES.has(statusRaw)) {
        throw new HttpError(400, 'Ungültiger Status');
      }

      const hasLicenses = 'licenses' in body && body.licenses !== undefined;
      const licenses = hasLicenses ? normalizeLicenses(body.licenses) : null;
      const now = new Date().toISOString();

      db.exec('BEGIN');
      try {
        db.prepare(`
          UPDATE members SET
            first_name = ?,
            last_name = ?,
            personnel_number = ?,
            unit = ?,
            email = ?,
            phone = ?,
            status = ?,
            license_number = ?,
            card_issued_at = ?,
            card_expires_at = ?,
            issuing_authority = ?,
            global_key_numbers_json = ?,
            ban_active = ?,
            ban_from = ?,
            ban_until = ?,
            ban_reason = ?,
            notes = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          firstName,
          lastName,
          'personnel_number' in body
            ? cleanOptionalText(body.personnel_number)
            : existing.personnel_number,
          'unit' in body ? cleanOptionalText(body.unit) : existing.unit,
          'email' in body ? cleanOptionalText(body.email) : existing.email,
          'phone' in body ? cleanOptionalText(body.phone) : existing.phone,
          statusRaw,
          'license_number' in body
            ? cleanOptionalText(body.license_number)
            : existing.license_number,
          'card_issued_at' in body
            ? cleanOptionalDate(body.card_issued_at, 'Karten-Ausstellungsdatum')
            : existing.card_issued_at,
          'card_expires_at' in body
            ? cleanOptionalDate(body.card_expires_at, 'Karten-Ablaufdatum')
            : existing.card_expires_at,
          'issuing_authority' in body
            ? cleanOptionalText(body.issuing_authority)
            : existing.issuing_authority,
          'global_key_numbers' in body
            ? JSON.stringify(cleanStringArray(body.global_key_numbers))
            : JSON.stringify(existing.global_key_numbers),
          'ban_active' in body ? (body.ban_active ? 1 : 0) : existing.ban_active ? 1 : 0,
          'ban_from' in body
            ? cleanOptionalDate(body.ban_from, 'Fahrverbot ab')
            : existing.ban_from,
          'ban_until' in body
            ? cleanOptionalDate(body.ban_until, 'Fahrverbot bis')
            : existing.ban_until,
          'ban_reason' in body ? cleanOptionalText(body.ban_reason) : existing.ban_reason,
          'notes' in body ? cleanOptionalText(body.notes) : existing.notes,
          now,
          id,
        );

        if (licenses !== null) {
          db.prepare('DELETE FROM member_licenses WHERE member_id = ?').run(id);
          const insertLic = db.prepare(`
            INSERT INTO member_licenses (member_id, license_class, issued_at, expires_at, key_numbers_json, notes)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (const lic of licenses) {
            insertLic.run(
              id,
              lic.license_class,
              lic.issued_at,
              lic.expires_at,
              JSON.stringify(lic.key_numbers),
              lic.notes,
            );
          }
        }

        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }

      res.json(evaluation.getEvaluatedMember(id));
    }),
  );

  router.delete(
    '/:id',
    requireRole('admin'),
    asyncHandler((req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new HttpError(400, 'Ungültige Kameraden-ID');
      }
      const result = db.prepare('DELETE FROM members WHERE id = ?').run(id);
      if (Number(result.changes) === 0) {
        throw new HttpError(404, 'Kamerad nicht gefunden');
      }
      res.json({ ok: true });
    }),
  );

  return router;
}
