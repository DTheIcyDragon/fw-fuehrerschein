import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import { type AppDatabase, openDatabase } from './db/database.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { createAuthRouter } from './routes/auth.js';
import { createBackupRouter } from './routes/backup.js';
import { createCalendarRouter } from './routes/calendar.js';
import { createDashboardRouter } from './routes/dashboard.js';
import { createInspectionsRouter } from './routes/inspections.js';
import { createMembersRouter } from './routes/members.js';
import { createReportsRouter } from './routes/reports.js';
import { createSettingsRouter } from './routes/settings.js';
import { createUsersRouter } from './routes/users.js';
import { createVehiclesRouter } from './routes/vehicles.js';
import { EvaluationService } from './services/evaluation.js';
import { startScheduler } from './services/scheduler.js';
import { SettingsService } from './services/settings.js';
import { errorHandler, HttpError } from './utils/asyncHandler.js';
import { createSecretBox } from './utils/crypto.js';

export interface CreateAppOptions {
  dataDir: string;
  enableScheduler?: boolean;
}

function resolveClientDistDir(): string | null {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(currentDir, '../../../client/dist'),
    path.resolve(currentDir, '../../../../client/dist'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      return dir;
    }
  }
  return null;
}

export function createApp(options: CreateAppOptions): {
  app: Express;
  db: AppDatabase;
  close: () => void;
} {
  const db = openDatabase(options.dataDir);
  const secretBox = createSecretBox(options.dataDir);
  const settings = new SettingsService(db, secretBox);
  const evaluation = new EvaluationService(db, settings);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.use(createAuthMiddleware(db));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', createAuthRouter(db, settings));
  app.use('/api/dashboard', createDashboardRouter(evaluation));
  app.use('/api/members', createMembersRouter(db, evaluation));
  app.use('/api/inspections', createInspectionsRouter(db, evaluation));
  app.use('/api/vehicles', createVehiclesRouter(db, evaluation));
  app.use('/api/users', createUsersRouter(db));

  app.use('/api', createReportsRouter({ db, evaluation, settings }));
  app.use('/api', createCalendarRouter({ evaluation, settings }));
  app.use('/api', createSettingsRouter({ db, settings, evaluation }));
  app.use('/api/admin', createBackupRouter({ db, settings }));

  app.use('/api', (_req, _res, next) => {
    next(new HttpError(404, 'API-Endpunkt nicht gefunden'));
  });

  const clientDistDir = resolveClientDistDir();
  if (clientDistDir) {
    app.use(express.static(clientDistDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(clientDistDir, 'index.html'));
    });
  }

  app.use(errorHandler);

  const stopScheduler =
    options.enableScheduler !== false
      ? startScheduler({ db, settings, evaluation })
      : () => {};

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    try {
      stopScheduler();
    } finally {
      db.close();
    }
  };

  return { app, db, close };
}
