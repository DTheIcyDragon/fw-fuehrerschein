import { Router } from 'express';
import { getTodayIsoDate, isValidIsoDate } from '../../../shared/licenseRules.js';
import type { Inspection, InspectionResult } from '../../../shared/types.js';
import type { AppDatabase } from '../db/database.js';
import { type AuthRequest, requireAuth, requireRole } from '../middleware/auth.js';
import type { EvaluationService } from '../services/evaluation.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';

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

      const inspectedAt =
        body.inspected_at !== undefined && String(body.inspected_at).trim()
          ? String(body.inspected_at).trim()
          : getTodayIsoDate();
      if (!isValidIsoDate(inspectedAt)) {
        throw new HttpError(400, 'inspected_at muss im Format YYYY-MM-DD sein');
      }

      const resultRaw = String(body.result ?? 'ok').trim() as InspectionResult;
      if (resultRaw !== 'ok' && resultRaw !== 'issue') {
        throw new HttpError(400, 'result muss "ok" oder "issue" sein');
      }

      const notesRaw = body.notes !== undefined && body.notes !== null ? String(body.notes).trim() : '';
      const notes = notesRaw ? notesRaw : null;
      const now = new Date().toISOString();

      const insertRes = db
        .prepare(`
          INSERT INTO inspections (member_id, inspected_at, inspector_user_id, inspector_name, result, notes, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          memberId,
          inspectedAt,
          req.user!.id,
          req.user!.display_name,
          resultRaw,
          notes,
          now,
        );

      const createdId = Number(insertRes.lastInsertRowid);
      const created: Inspection = {
        id: createdId,
        member_id: memberId,
        inspected_at: inspectedAt,
        inspector_user_id: req.user!.id,
        inspector_name: req.user!.display_name,
        result: resultRaw,
        notes,
        created_at: now,
        member_first_name: member.first_name,
        member_last_name: member.last_name,
        member_unit: member.unit,
      };

      res.status(201).json(created);
    }),
  );

  router.delete(
    '/:id',
    requireRole('admin'),
    asyncHandler((req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new HttpError(400, 'Ungültige Kontroll-ID');
      }
      const delRes = db.prepare('DELETE FROM inspections WHERE id = ?').run(id);
      if (Number(delRes.changes) === 0) {
        throw new HttpError(404, 'Kontrolle nicht gefunden');
      }
      res.json({ ok: true });
    }),
  );

  return router;
}
