import { Router } from 'express';
import type { AppDatabase } from '../db/database.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { commitCsvImport, exportCsvTemplate, exportMembersCsv, previewCsvImport } from '../services/csv.js';
import type { EvaluationService } from '../services/evaluation.js';
import { generateInspectionsPdf, generateMembersPdf, generateVehiclesPdf } from '../services/pdf.js';
import type { SettingsService } from '../services/settings.js';
import { HttpError, asyncHandler } from '../utils/asyncHandler.js';

export function createReportsRouter(deps: {
  db: AppDatabase;
  evaluation: EvaluationService;
  settings: SettingsService;
}): Router {
  const router = Router();

  router.get(
    '/reports/inspections.pdf',
    requireAuth,
    asyncHandler(async (req, res) => {
      const unit = typeof req.query.unit === 'string' && req.query.unit.trim() ? req.query.unit.trim() : undefined;
      const from = typeof req.query.from === 'string' && req.query.from.trim() ? req.query.from.trim() : undefined;
      const to = typeof req.query.to === 'string' && req.query.to.trim() ? req.query.to.trim() : undefined;

      const inspections = deps.evaluation.listInspections({ unit, from, to });
      const filterParts: string[] = [];
      if (unit) filterParts.push(`Einheit: ${unit}`);
      if (from) filterParts.push(`Von: ${from}`);
      if (to) filterParts.push(`Bis: ${to}`);

      const pdf = await generateInspectionsPdf({
        departmentName: deps.settings.getDepartmentName(),
        inspections,
        filterLabel: filterParts.length > 0 ? filterParts.join(', ') : undefined,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="pruefprotokoll.pdf"');
      res.send(pdf);
    }),
  );

  router.get(
    '/reports/vehicles.pdf',
    requireAuth,
    asyncHandler(async (req, res) => {
      let vehicleId: number | undefined;
      if (typeof req.query.vehicleId === 'string' && req.query.vehicleId.trim()) {
        const parsed = Number(req.query.vehicleId);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          throw new HttpError(400, 'Ungültige vehicleId');
        }
        vehicleId = parsed;
      }

      const vehicles = deps.evaluation.listEvaluatedVehicles(vehicleId);
      if (vehicleId !== undefined && vehicles.length === 0) {
        throw new HttpError(404, 'Fahrzeug nicht gefunden');
      }

      const pdf = await generateVehiclesPdf({
        departmentName: deps.settings.getDepartmentName(),
        vehicles,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="fahrzeug-fahrerliste.pdf"');
      res.send(pdf);
    }),
  );

  router.get(
    '/reports/members.pdf',
    requireAuth,
    asyncHandler(async (req, res) => {
      const unit = typeof req.query.unit === 'string' && req.query.unit.trim() ? req.query.unit.trim() : undefined;
      const members = deps.evaluation.listEvaluatedMembers({
        status: 'active',
        unit,
      });

      const pdf = await generateMembersPdf({
        departmentName: deps.settings.getDepartmentName(),
        members,
        filterLabel: unit ? `Einheit: ${unit}` : undefined,
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="kameraden-uebersicht.pdf"');
      res.send(pdf);
    }),
  );

  router.get(
    '/export/members.csv',
    requireAuth,
    asyncHandler((req, res) => {
      const unit = typeof req.query.unit === 'string' && req.query.unit.trim() ? req.query.unit.trim() : undefined;
      const status = typeof req.query.status === 'string' && req.query.status.trim() ? req.query.status.trim() : undefined;
      const search = typeof req.query.search === 'string' && req.query.search.trim() ? req.query.search.trim() : undefined;
      const licenseClass =
        typeof req.query.licenseClass === 'string' && req.query.licenseClass.trim()
          ? req.query.licenseClass.trim()
          : undefined;
      const trafficLight =
        typeof req.query.trafficLight === 'string' && req.query.trafficLight.trim()
          ? req.query.trafficLight.trim()
          : undefined;

      const members = deps.evaluation.listEvaluatedMembers({
        unit,
        status,
        search,
        licenseClass,
        trafficLight,
      });

      const csv = exportMembersCsv(members);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="kameraden-export.csv"');
      res.send(csv);
    }),
  );

  router.get(
    '/import/template.csv',
    requireAuth,
    asyncHandler((_req, res) => {
      const csv = exportCsvTemplate();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="kameraden-vorlage.csv"');
      res.send(csv);
    }),
  );

  router.post(
    '/import/csv/preview',
    requireRole('admin'),
    asyncHandler((req, res) => {
      const csvText = typeof req.body?.csv === 'string' ? req.body.csv : '';
      const preview = previewCsvImport(csvText, deps.db);
      res.json(preview);
    }),
  );

  router.post(
    '/import/csv/commit',
    requireRole('admin'),
    asyncHandler((req, res) => {
      const csvText = typeof req.body?.csv === 'string' ? req.body.csv : '';
      const result = commitCsvImport(csvText, deps.db);
      res.json(result);
    }),
  );

  return router;
}
