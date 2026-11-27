import { Router } from 'express';
import type { PublicUser, UserRole } from '../../../shared/types.js';
import type { AppDatabase } from '../db/database.js';
import { requireRole } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/asyncHandler.js';
import { hashPassword } from '../utils/crypto.js';

const VALID_ROLES = new Set<UserRole>(['admin', 'inspector', 'viewer']);

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

export function createUsersRouter(db: AppDatabase): Router {
  const router = Router();
  router.use(requireRole('admin'));

  function countOtherActiveAdmins(excludeUserId: number): number {
    const row = db
      .prepare(
        "SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin' AND active = 1 AND id != ?",
      )
      .get(excludeUserId) as { cnt: number };
    return Number(row.cnt);
  }

  router.get(
    '/',
    asyncHandler((_req, res) => {
      const rows = db
        .prepare('SELECT * FROM users ORDER BY role ASC, username COLLATE NOCASE ASC')
        .all() as unknown as UserRow[];
      res.json(rows.map(toPublicUser));
    }),
  );

  router.post(
    '/',
    asyncHandler((req, res) => {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const username = String(body.username ?? '').trim();
      const displayName = String(body.display_name ?? '').trim() || username;
      const emailRaw = body.email !== undefined && body.email !== null ? String(body.email).trim() : '';
      const email = emailRaw || null;
      const password = String(body.password ?? '');
      const role = String(body.role ?? 'viewer').trim() as UserRole;
      const active = body.active === undefined ? true : Boolean(body.active);

      if (!username) {
        throw new HttpError(400, 'Benutzername ist erforderlich');
      }
      if (password.length < 8) {
        throw new HttpError(400, 'Passwort muss mindestens 8 Zeichen lang sein');
      }
      if (!VALID_ROLES.has(role)) {
        throw new HttpError(400, 'Ungültige Rolle');
      }

      const duplicate = db
        .prepare('SELECT id FROM users WHERE username = ?')
        .get(username) as { id: number } | undefined;
      if (duplicate) {
        throw new HttpError(409, 'Benutzername ist bereits vergeben');
      }

      const now = new Date().toISOString();
      const insertRes = db
        .prepare(`
          INSERT INTO users (username, display_name, email, password_hash, role, active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          username,
          displayName,
          email,
          hashPassword(password),
          role,
          active ? 1 : 0,
          now,
          now,
        );

      const newId = Number(insertRes.lastInsertRowid);
      const created = db.prepare('SELECT * FROM users WHERE id = ?').get(newId) as unknown as UserRow;
      res.status(201).json(toPublicUser(created));
    }),
  );

  router.put(
    '/:id',
    asyncHandler((req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new HttpError(400, 'Ungültige Benutzer-ID');
      }

      const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
      if (!existing) {
        throw new HttpError(404, 'Benutzer nicht gefunden');
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const displayName =
        'display_name' in body ? String(body.display_name ?? '').trim() : existing.display_name;
      if (!displayName) {
        throw new HttpError(400, 'Anzeigename darf nicht leer sein');
      }

      const email =
        'email' in body
          ? body.email !== null && String(body.email).trim()
            ? String(body.email).trim()
            : null
          : existing.email;

      const role = ('role' in body ? String(body.role ?? '').trim() : existing.role) as UserRole;
      if (!VALID_ROLES.has(role)) {
        throw new HttpError(400, 'Ungültige Rolle');
      }

      const active = 'active' in body ? Boolean(body.active) : Boolean(existing.active);

      if (existing.role === 'admin' && existing.active === 1) {
        if ((role !== 'admin' || !active) && countOtherActiveAdmins(id) === 0) {
          throw new HttpError(
            400,
            'Der letzte aktive Administrator darf nicht deaktiviert oder herabgestuft werden',
          );
        }
      }

      let passwordHash = existing.password_hash;
      let passwordChanged = false;
      if (typeof body.password === 'string' && body.password.length > 0) {
        if (body.password.length < 8) {
          throw new HttpError(400, 'Passwort muss mindestens 8 Zeichen lang sein');
        }
        passwordHash = hashPassword(body.password);
        passwordChanged = true;
      }

      const now = new Date().toISOString();
      db.prepare(`
        UPDATE users SET
          display_name = ?,
          email = ?,
          password_hash = ?,
          role = ?,
          active = ?,
          updated_at = ?
        WHERE id = ?
      `).run(displayName, email, passwordHash, role, active ? 1 : 0, now, id);

      if (!active || passwordChanged) {
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
      }

      const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow;
      res.json(toPublicUser(updated));
    }),
  );

  router.delete(
    '/:id',
    asyncHandler((req, res) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new HttpError(400, 'Ungültige Benutzer-ID');
      }

      const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
      if (!existing) {
        throw new HttpError(404, 'Benutzer nicht gefunden');
      }

      if (existing.role === 'admin' && existing.active === 1 && countOtherActiveAdmins(id) === 0) {
        throw new HttpError(400, 'Der letzte aktive Administrator darf nicht gelöscht werden');
      }

      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      res.json({ ok: true });
    }),
  );

  return router;
}
