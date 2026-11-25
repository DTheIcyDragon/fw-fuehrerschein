import { Router } from 'express';
import { ALL_LICENSE_CLASSES } from '../../../shared/licenseRules.js';
import type { LicenseClass } from '../../../shared/types.js';
import type { AppDatabase } from '../db/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import type { EvaluationService } from '../services/evaluation.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';

const VALID_CLASSES = new Set<string>(ALL_LICENSE_CLASSES);

function cleanOptionalText(val: unknown): string | null {
  if (val === undefined || val === null) return null;
  const trimmed = String(val).trim();
  return trimmed ? trimmed : null;
}

function normalizeRequiredClasses(raw: unknown): LicenseClass[] {
  if (!Array.isArray(raw)) {
    throw new HttpError(400, 'required_classes muss ein Array aus Führerscheinklassen sein');
  }
  const result: LicenseClass[] = [];
  const seen = new Set<LicenseClass>();
  for (const item of raw) {
    const cls = String(item).trim();
    if (!VALID_CLASSES.has(cls)) {
      throw new HttpError(400, `Unbekannte Führerscheinklasse: ${cls}`);
    }
    const typed = cls as LicenseClass;
    if (!seen.has(typed)) {
      seen.add(typed);
      result.push(typed);
    }
  }
  if (result.length === 0) {
    throw new HttpError(400, 'Mindestens eine erforderliche Führerscheinklasse angeben');
  }
  return result;
}

export function createVehiclesRouter(
  db: AppDatabase,
  evaluation: EvaluationService,
): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    asyncHandler((_req, res) => {
      res.json(evaluation.listEvaluatedVehicles());
    }),
  );

  router.get(
    '/:id',
    requireAuth,
    asyncHandler((req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new HttpError(400, 'Ungültige Fahrzeug-ID');
      }
      const list = evaluation.listEvaluatedVehicles(id);
      if (list.length === 0) {
        throw new HttpError(404, 'Fahrzeug nicht gefunden');
      }
      res.json(list[0]);
    }),
  );

  router.post(
    '/',
    requireRole('admin'),
    asyncHandler((req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const name = String(body.name ?? '').trim();
      if (!name) {
        throw new HttpError(400, 'Fahrzeugname ist erforderlich');
      }

      const requiredClasses =
        body.required_classes !== undefined
          ? normalizeRequiredClasses(body.required_classes)
          : (['B'] as LicenseClass[]);

      const now = new Date().toISOString();
      const insertRes = db
        .prepare(`
          INSERT INTO vehicles (
            name, call_sign, license_plate, unit, required_classes_json,
            is_automatic, notes, active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          name,
          cleanOptionalText(body.call_sign),
          cleanOptionalText(body.license_plate),
          cleanOptionalText(body.unit),
          JSON.stringify(requiredClasses),
          body.is_automatic ? 1 : 0,
          cleanOptionalText(body.notes),
          body.active === undefined ? 1 : body.active ? 1 : 0,
          now,
          now,
        );

      const createdId = Number(insertRes.lastInsertRowid);
      const created = evaluation.listEvaluatedVehicles(createdId)[0];
      res.status(201).json(created);
    }),
  );

  router.put(
    '/:id',
    requireRole('admin'),
    asyncHandler((req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new HttpError(400, 'Ungültige Fahrzeug-ID');
      }

      const existingList = evaluation.listEvaluatedVehicles(id);
      if (existingList.length === 0) {
        throw new HttpError(404, 'Fahrzeug nicht gefunden');
      }
      const existing = existingList[0];

      const body = (req.body ?? {}) as Record<string, unknown>;
      const name = 'name' in body ? String(body.name ?? '').trim() : existing.name;
      if (!name) {
        throw new HttpError(400, 'Fahrzeugname ist erforderlich');
      }

      const requiredClasses =
        'required_classes' in body
          ? normalizeRequiredClasses(body.required_classes)
          : existing.required_classes;

      const now = new Date().toISOString();
      db.prepare(`
        UPDATE vehicles SET
          name = ?,
          call_sign = ?,
          license_plate = ?,
          unit = ?,
          required_classes_json = ?,
          is_automatic = ?,
          notes = ?,
          active = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        name,
        'call_sign' in body ? cleanOptionalText(body.call_sign) : existing.call_sign,
        'license_plate' in body ? cleanOptionalText(body.license_plate) : existing.license_plate,
        'unit' in body ? cleanOptionalText(body.unit) : existing.unit,
        JSON.stringify(requiredClasses),
        'is_automatic' in body ? (body.is_automatic ? 1 : 0) : existing.is_automatic ? 1 : 0,
        'notes' in body ? cleanOptionalText(body.notes) : existing.notes,
        'active' in body ? (body.active ? 1 : 0) : existing.active ? 1 : 0,
        now,
        id,
      );

      res.json(evaluation.listEvaluatedVehicles(id)[0]);
    }),
  );

  router.delete(
    '/:id',
    requireRole('admin'),
    asyncHandler((req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new HttpError(400, 'Ungültige Fahrzeug-ID');
      }
      const delRes = db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
      if (Number(delRes.changes) === 0) {
        throw new HttpError(404, 'Fahrzeug nicht gefunden');
      }
      res.json({ ok: true });
    }),
  );

  return router;
}
