import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { PublicUser, UserRole } from '../../../shared/types.js';
import type { AppDatabase } from '../db/database.js';
import { HttpError } from '../utils/asyncHandler.js';

export const SESSION_COOKIE_NAME = 'fw_session';

export interface AuthRequest extends Request {
  user?: PublicUser;
  sessionToken?: string;
}

interface SessionUserRow {
  token: string;
  expires_at: string;
  id: number;
  username: string;
  display_name: string;
  email: string | null;
  role: UserRole;
  active: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export function createAuthMiddleware(db: AppDatabase): RequestHandler {
  const selectSession = db.prepare(`
    SELECT
      s.token,
      s.expires_at,
      u.id,
      u.username,
      u.display_name,
      u.email,
      u.role,
      u.active,
      u.created_at,
      u.updated_at,
      u.last_login_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `);

  const deleteSession = db.prepare('DELETE FROM sessions WHERE token = ?');

  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const token = req.cookies?.[SESSION_COOKIE_NAME];
    if (typeof token !== 'string' || !token) {
      next();
      return;
    }

    const row = selectSession.get(token) as SessionUserRow | undefined;
    if (!row) {
      next();
      return;
    }

    if (row.expires_at <= new Date().toISOString() || row.active !== 1) {
      deleteSession.run(token);
      next();
      return;
    }

    req.sessionToken = row.token;
    req.user = {
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

    next();
  };
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new HttpError(401, 'Nicht angemeldet'));
    return;
  }
  next();
}

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new HttpError(401, 'Nicht angemeldet'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new HttpError(403, 'Keine Berechtigung für diese Aktion'));
      return;
    }
    next();
  };
}
