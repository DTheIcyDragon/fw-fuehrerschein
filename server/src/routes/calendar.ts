import { createHash, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import type { EvaluationService } from '../services/evaluation.js';
import { generateIcalFeed } from '../services/ical.js';
import type { SettingsService } from '../services/settings.js';
import { HttpError, asyncHandler } from '../utils/asyncHandler.js';

function tokensEqualTimingSafe(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = createHash('sha256').update(provided, 'utf8').digest();
  const b = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(a, b) && provided.length === expected.length;
}

export function createCalendarRouter(deps: {
  evaluation: EvaluationService;
  settings: SettingsService;
}): Router {
  const router = Router();

  const sendCalendar = (): { content: string } => {
    const members = deps.evaluation.listEvaluatedMembers({ status: 'active' });
    const departmentName = deps.settings.getDepartmentName();
    return { content: generateIcalFeed(members, departmentName) };
  };

  router.get(
    '/calendar.ics',
    requireAuth,
    asyncHandler((_req, res) => {
      const { content } = sendCalendar();
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="fw-fuehrerschein.ics"');
      res.send(content);
    }),
  );

  router.get(
    '/calendar/:token.ics',
    asyncHandler((req, res) => {
      const providedToken = typeof req.params.token === 'string' ? req.params.token : '';
      const expectedToken = deps.settings.getIcalToken();
      if (!tokensEqualTimingSafe(providedToken, expectedToken)) {
        throw new HttpError(404, 'Kalender nicht gefunden');
      }

      const { content } = sendCalendar();
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline; filename="fw-fuehrerschein.ics"');
      res.send(content);
    }),
  );

  return router;
}
