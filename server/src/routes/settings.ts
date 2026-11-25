import { Router } from 'express';
import type { AppDatabase } from '../db/database.js';
import { type AuthRequest, requireRole } from '../middleware/auth.js';
import type { EvaluationService } from '../services/evaluation.js';
import { NotificationService } from '../services/notifications.js';
import type { RawMailConfig, SettingsService } from '../services/settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export function createSettingsRouter(deps: {
  db: AppDatabase;
  settings: SettingsService;
  evaluation: EvaluationService;
}): Router {
  const router = Router();
  const notifications = new NotificationService(deps);

  router.get(
    '/settings',
    requireRole('admin'),
    asyncHandler((_req, res) => {
      res.json(deps.settings.getPublicSettings());
    }),
  );

  router.put(
    '/settings',
    requireRole('admin'),
    asyncHandler((req, res) => {
      const patch = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const updated = deps.settings.updateSettings(patch);
      res.json(updated);
    }),
  );

  router.post(
    '/settings/ical-token/rotate',
    requireRole('admin'),
    asyncHandler((_req, res) => {
      const token = deps.settings.rotateIcalToken();
      res.json({ ical_token: token });
    }),
  );

  router.post(
    '/notifications/test',
    requireRole('admin'),
    asyncHandler(async (req: AuthRequest, res) => {
      const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const toEmail =
        typeof body.toEmail === 'string' && body.toEmail.trim()
          ? body.toEmail.trim()
          : typeof body.to === 'string' && body.to.trim()
            ? body.to.trim()
            : typeof body.email === 'string' && body.email.trim()
              ? body.email.trim()
              : req.user?.email ?? '';

      let override: Partial<RawMailConfig> | undefined;
      if (body.override && typeof body.override === 'object') {
        override = body.override as Partial<RawMailConfig>;
      } else if (body.mailConfig && typeof body.mailConfig === 'object') {
        override = body.mailConfig as Partial<RawMailConfig>;
      } else if ('mail_provider' in body || 'provider' in body || 'smtp' in body || 'jmap' in body) {
        const provider = (body.mail_provider ?? body.provider) as RawMailConfig['provider'] | undefined;
        override = {
          ...(provider ? { provider } : {}),
          ...(body.smtp && typeof body.smtp === 'object' ? { smtp: body.smtp as RawMailConfig['smtp'] } : {}),
          ...(body.jmap && typeof body.jmap === 'object' ? { jmap: body.jmap as RawMailConfig['jmap'] } : {}),
        };
      }

      await notifications.sendTestMail(toEmail, override);
      res.json({ ok: true, message: `Test-E-Mail erfolgreich an ${toEmail} gesendet.` });
    }),
  );

  router.post(
    '/notifications/run',
    requireRole('admin'),
    asyncHandler(async (req, res) => {
      const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const result = await notifications.runNotifications({
        forceDigest: body.forceDigest !== undefined ? Boolean(body.forceDigest) : true,
        sendDigest: body.sendDigest !== undefined ? Boolean(body.sendDigest) : true,
        sendMembers: body.sendMembers !== undefined ? Boolean(body.sendMembers) : true,
      });
      res.json(result);
    }),
  );

  router.get(
    '/notifications/logs',
    requireRole('admin'),
    asyncHandler((req, res) => {
      const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 100;
      const logs = notifications.listLogs(Number.isFinite(limit) ? limit : 100);
      res.json(logs);
    }),
  );

  return router;
}
