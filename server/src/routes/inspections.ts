import { Router } from 'express';
import { getTodayIsoDate, isValidIsoDate } from '../../../shared/licenseRules.js';
import type { AuditLogEntry, Inspection, InspectionResult } from '../../../shared/types.js';
import { type AppDatabase, writeAuditLog } from '../db/database.js';
import { type AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import type { EvaluationService } from '../services/evaluation.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';

interface InspectionRowWithMember {
  id: number;
  member_id: number;
  inspected_at: string;
  inspector_user_id: number | null;
  inspector_name: string;
  result: InspectionResult;
  notes: string | null;
  cancelled_at: string | null;
  cancelled_by_name: string | null;
  cancel_reason: string | null;
  checked_eu_card: number;
  checked_fw_license: number;
  checked_restrictions: number;
  created_at: string;
  member_first_name: string;
  member_last_name: string;
  member_unit: string | null;
}

function toInspectionDto(row: InspectionRowWithMember): Inspection {
  return {
    id: Number(row.id),
    member_id: Number(row.member_id),
    inspected_at: row.inspected_at,
    inspector_user_id: row.inspector_user_id !== null ? Number(row.inspector_user_id) : null,
    inspector_name: row.inspector_name,
    result: row.result,
    notes: row.notes,
    cancelled_at: row.cancelled_at,
    cancelled_by_name: row.cancelled_by_name,
    cancel_reason: row.cancel_reason,
    checked_eu_card: Boolean(row.checked_eu_card),
    checked_fw_license: Boolean(row.checked_fw_license),
    checked_restrictions: Boolean(row.checked_restrictions),
    created_at: row.created_at,
    member_first_name: row.member_first_name,
    member_last_name: row.member_last_name,
    member_unit: row.member_unit,
  };
}

export function createInspectionsRouter(
  db: AppDatabase,
  evaluation: EvaluationService,
): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    asyncHandler((req, res) => {
      const q = req.query;
      const memberIdRaw = typeof q.memberId === 'string' && q.memberId ? Number(q.memberId) : undefined;
      if (memberIdRaw !== undefined && (!Number.isInteger(memberIdRaw) || memberIdRaw <= 0)) {
        throw new HttpError(400, 'Ungültige memberId');
      }
      const list = evaluation.listInspections({
        memberId: memberIdRaw,
        unit: typeof q.unit === 'string' ? q.unit : undefined,
        from: typeof q.from === 'string' && q.from ? q.from : undefined,
        to: typeof q.to === 'string' && q.to ? q.to : undefined,
      });
      res.json(list);
    }),
  );

  router.get(
    '/audit',
    requireRole('admin'),
    asyncHandler((_req, res) => {
      const rows = db
        .prepare(`
          SELECT id, actor_user_id, actor_name, action, entity_type, entity_id, details_json, created_at
          FROM audit_logs
          ORDER BY id DESC
          LIMIT 100
        `)
        .all() as unknown as AuditLogEntry[];
      res.json(
        rows.map((r) => ({
          ...r,
          id: Number(r.id),
          actor_user_id: r.actor_user_id !== null ? Number(r.actor_user_id) : null,
          entity_id: r.entity_id !== null ? Number(r.entity_id) : null,
        })),
      );
    }),
  );

  router.post(
    '/',
    requireRole('admin', 'inspector'),
    asyncHandler((req: AuthRequest, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const memberId = Number(body.member_id);
      if (!Number.isInteger(memberId) || memberId <= 0) {
        throw new HttpError(400, 'Gültige member_id ist erforderlich');
      }

      const member = db
        .prepare('SELECT id, first_name, last_name, unit FROM members WHERE id = ?')
        .get(memberId) as
        | { id: number; first_name: string; last_name: string; unit: string | null }
        | undefined;
      if (!member) {
        throw new HttpError(404, 'Kamerad nicht gefunden');
      }

      const today = getTodayIsoDate();
      const inspectedAt =
        body.inspected_at !== undefined && String(body.inspected_at).trim()
          ? String(body.inspected_at).trim()
          : today;
      if (!isValidIsoDate(inspectedAt)) {
        throw new HttpError(400, 'inspected_at muss im Format YYYY-MM-DD sein');
      }
      if (inspectedAt > today) {
        throw new HttpError(400, 'Kontrolldatum darf nicht in der Zukunft liegen');
      }

      const resultRaw = String(body.result ?? 'ok').trim() as InspectionResult;
      if (resultRaw !== 'ok' && resultRaw !== 'issue') {
        throw new HttpError(400, 'result muss "ok" oder "issue" sein');
      }

      const checkedEuCard =
        body.checked_eu_card !== undefined ? Boolean(body.checked_eu_card) : true;
      const checkedFwLicense = Boolean(body.checked_fw_license);
      const checkedRestrictions = Boolean(body.checked_restrictions);

      const notesRaw = body.notes !== undefined && body.notes !== null ? String(body.notes).trim() : '';
      const notes = notesRaw ? notesRaw : null;
      const now = new Date().toISOString();

      let createdId = 0;
      db.exec('BEGIN IMMEDIATE');
      try {
        const insertRes = db
          .prepare(`
            INSERT INTO inspections (
              member_id, inspected_at, inspector_user_id, inspector_name, result, notes,
              checked_eu_card, checked_fw_license, checked_restrictions, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            memberId,
            inspectedAt,
            req.user!.id,
            req.user!.display_name,
            resultRaw,
            notes,
            checkedEuCard ? 1 : 0,
            checkedFwLicense ? 1 : 0,
            checkedRestrictions ? 1 : 0,
            now,
          );

        createdId = Number(insertRes.lastInsertRowid);
        writeAuditLog(db, {
          actorUserId: req.user!.id,
          actorName: req.user!.display_name,
          action: 'create_inspection',
          entityType: 'inspection',
          entityId: createdId,
          details: {
            member_id: memberId,
            inspected_at: inspectedAt,
            result: resultRaw,
            checked_eu_card: checkedEuCard,
            checked_fw_license: checkedFwLicense,
            checked_restrictions: checkedRestrictions,
          },
        });
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }

      const createdRow = db
        .prepare(`
          SELECT i.*, m.first_name AS member_first_name, m.last_name AS member_last_name, m.unit AS member_unit
          FROM inspections i
          JOIN members m ON m.id = i.member_id
          WHERE i.id = ?
        `)
        .get(createdId) as unknown as InspectionRowWithMember;

      res.status(201).json(toInspectionDto(createdRow));
    }),
  );

  router.post(
    '/:id/cancel',
    requireRole('admin'),
    asyncHandler((req: AuthRequest, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new HttpError(400, 'Ungültige Kontroll-ID');
      }

      const existing = db
        .prepare('SELECT id, member_id, cancelled_at FROM inspections WHERE id = ?')
        .get(id) as { id: number; member_id: number; cancelled_at: string | null } | undefined;
      if (!existing) {
        throw new HttpError(404, 'Kontrolle nicht gefunden');
      }
      if (existing.cancelled_at !== null) {
        throw new HttpError(400, 'Kontrolle wurde bereits storniert');
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const reason = String(body.reason ?? body.cancel_reason ?? '').trim();
      if (!reason) {
        throw new HttpError(400, 'Ein Stornierungsgrund ist erforderlich');
      }

      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`
          UPDATE inspections
          SET cancelled_at = ?, cancelled_by_name = ?, cancel_reason = ?
          WHERE id = ?
        `).run(now, req.user!.display_name, reason, id);

        writeAuditLog(db, {
          actorUserId: req.user!.id,
          actorName: req.user!.display_name,
          action: 'cancel_inspection',
          entityType: 'inspection',
          entityId: id,
          details: { member_id: Number(existing.member_id), reason },
        });
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }

      const updatedRow = db
        .prepare(`
          SELECT i.*, m.first_name AS member_first_name, m.last_name AS member_last_name, m.unit AS member_unit
          FROM inspections i
          JOIN members m ON m.id = i.member_id
          WHERE i.id = ?
        `)
        .get(id) as unknown as InspectionRowWithMember;

      res.json(toInspectionDto(updatedRow));
    }),
  );

  router.delete(
    '/:id',
    requireRole('admin'),
    asyncHandler((_req, res) => {
      res.status(405).json({
        error:
          'Kontrollen können aus Revisionsgründen nicht gelöscht werden. Bitte stornieren Sie den Eintrag.',
      });
    }),
  );

  return router;
}
