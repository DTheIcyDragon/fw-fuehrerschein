import { Router } from 'express';
import {
  FEDERAL_STATE_PRESETS,
  getDefaultStateRules,
} from '../../../shared/licenseRules.js';
import type { FederalStateCode, PublicUser, UserRole } from '../../../shared/types.js';
import type { AppDatabase } from '../db/database.js';
import {
  type AuthRequest,
  requireAuth,
  SESSION_COOKIE_NAME,
} from '../middleware/auth.js';
import type { SettingsService } from '../services/settings.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { hashPassword, randomToken, verifyPassword } from '../utils/crypto.js';

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  email: string | null;
  password_hash: string;
  role: UserRole;
  active: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: Number(row.id),
    username: row.username,
    display_name: row.display_name,
    email: row.email,
    role: row.role,
    active: Boolean(row.active),
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_login_at: row.last_login_at,
  };
}

export function createAuthRouter(db: AppDatabase, settings: SettingsService): Router {
  const router = Router();

  function createSession(userId: number): string {
    const token = randomToken(32);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
    db.prepare(
      'INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    ).run(token, userId, now.toISOString(), expiresAt);
    return token;
  }

  function setSessionCookie(res: import('express').Response, token: string): void {
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS,
    });
  }

  router.get(
    '/status',
    asyncHandler((req: AuthRequest, res) => {
      const row = db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };
      const needsSetup = Number(row.cnt) === 0;
      res.json({
        needsSetup,
        user: req.user ?? null,
        departmentName: settings.getDepartmentName(),
        federalState: settings.getFederalState(),
        stateRules: settings.getStateRules(),
      });
    }),
  );

  router.post(
    '/setup',
    asyncHandler((req: AuthRequest, res) => {
      const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };
      if (Number(countRow.cnt) > 0) {
        throw new HttpError(403, 'Ersteinrichtung wurde bereits abgeschlossen');
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const username = String(body.username ?? '').trim();
      const displayName = String(body.display_name ?? '').trim() || username;
      const emailRaw = body.email !== undefined && body.email !== null ? String(body.email).trim() : '';
      const email = emailRaw || null;
      const password = String(body.password ?? '');

      if (!username) {
        throw new HttpError(400, 'Benutzername ist erforderlich');
      }
      if (password.length < 4) {
        throw new HttpError(400, 'Passwort muss mindestens 4 Zeichen lang sein');
      }

      const patch: Record<string, unknown> = {};
      if (body.department_name !== undefined && String(body.department_name).trim()) {
        patch.department_name = String(body.department_name).trim();
      }
      if (body.inspection_interval_months !== undefined) {
        patch.inspection_interval_months = Number(body.inspection_interval_months);
      }
      const stateCodeRaw =
        body.federal_state !== undefined && String(body.federal_state).trim()
          ? String(body.federal_state).trim()
          : 'SH';
      if (!(stateCodeRaw in FEDERAL_STATE_PRESETS)) {
        throw new HttpError(400, `Ungültiges Bundesland: ${stateCodeRaw}`);
      }
      const federalState = stateCodeRaw as FederalStateCode;
      patch.federal_state = federalState;
      patch.state_rules = getDefaultStateRules(federalState);
      settings.updateSettings(patch);

      const now = new Date().toISOString();
      const passwordHash = hashPassword(password);

      const insertRes = db
        .prepare(`
          INSERT INTO users (username, display_name, email, password_hash, role, active, created_at, updated_at, last_login_at)
          VALUES (?, ?, ?, ?, 'admin', 1, ?, ?, ?)
        `)
        .run(username, displayName, email, passwordHash, now, now, now);

      const userId = Number(insertRes.lastInsertRowid);
      const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown as UserRow;
      const token = createSession(userId);
      setSessionCookie(res, token);

      res.status(201).json({
        user: toPublicUser(userRow),
        departmentName: settings.getDepartmentName(),
        federalState: settings.getFederalState(),
        stateRules: settings.getStateRules(),
      });
    }),
  );

  router.post(
    '/login',
    asyncHandler((req: AuthRequest, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const username = String(body.username ?? '').trim();
      const password = String(body.password ?? '');

      if (!username || !password) {
        throw new HttpError(400, 'Benutzername und Passwort sind erforderlich');
      }

      const userRow = db
        .prepare('SELECT * FROM users WHERE username = ?')
        .get(username) as UserRow | undefined;

      if (!userRow || userRow.active !== 1 || !verifyPassword(password, userRow.password_hash)) {
        throw new HttpError(401, 'Ungültige Anmeldedaten');
      }

      const now = new Date().toISOString();
      db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(
        now,
        now,
        userRow.id,
      );

      const updatedRow = db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(userRow.id) as unknown as UserRow;

      const token = createSession(Number(userRow.id));
      setSessionCookie(res, token);

      res.json({ user: toPublicUser(updatedRow) });
    }),
  );

  router.post(
    '/logout',
    asyncHandler((req: AuthRequest, res) => {
      if (req.sessionToken) {
        db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
      }
      res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
      res.json({ ok: true });
    }),
  );

  router.get(
    '/me',
    requireAuth,
    asyncHandler((req: AuthRequest, res) => {
      res.json({ user: req.user });
    }),
  );

  router.post(
    '/change-password',
    requireAuth,
    asyncHandler((req: AuthRequest, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const currentPassword = String(body.currentPassword ?? '');
      const newPassword = String(body.newPassword ?? '');

      if (!currentPassword || !newPassword) {
        throw new HttpError(400, 'Aktuelles und neues Passwort sind erforderlich');
      }
      if (newPassword.length < 4) {
        throw new HttpError(400, 'Neues Passwort muss mindestens 4 Zeichen lang sein');
      }

      const userRow = db
        .prepare('SELECT * FROM users WHERE id = ?')
        .get(req.user!.id) as UserRow | undefined;

      if (!userRow || !verifyPassword(currentPassword, userRow.password_hash)) {
        throw new HttpError(400, 'Aktuelles Passwort ist nicht korrekt');
      }

      const now = new Date().toISOString();
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
        hashPassword(newPassword),
        now,
        req.user!.id,
      );

      res.json({ ok: true });
    }),
  );

  return router;
}
