import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import type { EvaluationService } from '../services/evaluation.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export function createDashboardRouter(evaluation: EvaluationService): Router {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    asyncHandler((_req, res) => {
      res.json(evaluation.getDashboardSummary());
    }),
  );

  return router;
}
