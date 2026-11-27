import React from 'react';
import { KeyRound, Trash2, UserPlus } from 'lucide-react';
import type { PublicUser, UserRole } from '@shared/types';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  inspector: 'Prüfer',
  viewer: 'Nur Lesen',
};

interface UsersSettingsTabProps {
  users: PublicUser[];
  userFormOpen: boolean;
  editingUser: PublicUser | null;
  uUsername: string;
  setUUsername: (v: string) => void;
  uDisplayName: string;
  setUDisplayName: (v: string) => void;
  uEmail: string;
  setUEmail: (v: string) => void;
  uRole: UserRole;
  setURole: (v: UserRole) => void;
  uActive: boolean;
  setUActive: (v: boolean) => void;
  uPassword: string;
  setUPassword: (v: string) => void;
  savingUser: boolean;
  onOpenPasswordModal: () => void;
  onOpenNewUserForm: () => void;
  onOpenEditUserForm: (u: PublicUser) => void;
  onCloseUserForm: () => void;
  onSaveUser: (e: React.FormEvent) => void;
  onDeleteUser: (u: PublicUser) => void;
}

export function UsersSettingsTab({
  users,
  userFormOpen,
  editingUser,
  uUsername,
  setUUsername,
  uDisplayName,
  setUDisplayName,
  uEmail,
  setUEmail,
  uRole,
  setURole,
  uActive,
  setUActive,
  uPassword,
  setUPassword,
  savingUser,
  onOpenPasswordModal,
  onOpenNewUserForm,
  onOpenEditUserForm,
  onCloseUserForm,
  onSaveUser,
  onDeleteUser,
}: UsersSettingsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Rollen: <strong>Administrator</strong> (Vollzugriff), <strong>Prüfer</strong>{' '}
          (Kameraden & Kontrollen), <strong>Nur Lesen</strong> (Leserecht)
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={onOpenPasswordModal}>
            <KeyRound className="h-4 w-4" />
            <span>Eigenes Passwort</span>
          </button>
          <button type="button" className="btn-primary" onClick={onOpenNewUserForm}>
            <UserPlus className="h-4 w-4" />
            <span>Benutzer anlegen</span>
          </button>
        </div>
      </div>

      {userFormOpen && (
        <form onSubmit={onSaveUser} className="card space-y-4 p-5">
          <h3 className="font-semibold">
            {editingUser ? `Benutzer „${editingUser.username}“ bearbeiten` : 'Neuer Benutzer'}
          </h3>

          <div className="grid gap-4 sm:grid-cols-2">
            {!editingUser && (
              <div>
                <label className="mb-1 block text-sm font-medium">Benutzername *</label>
                <input
                  type="text"
                  className="input-field"
                  value={uUsername}
                  onChange={(e) => setUUsername(e.target.value)}
                  required
                  autoComplete="username"
                  spellCheck={false}
                  autoCapitalize="none"
                  autoCorrect="off"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Anzeigename *</label>
              <input
                type="text"
                className="input-field"
                value={uDisplayName}
                onChange={(e) => setUDisplayName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">E-Mail</label>
              <input
                type="email"
                className="input-field"
                value={uEmail}
                onChange={(e) => setUEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Rolle</label>
              <select
                className="input-field"
                value={uRole}
                onChange={(e) => setURole(e.target.value as UserRole)}
              >
                <option value="admin">Administrator</option>
                <option value="inspector">Prüfer</option>
                <option value="viewer">Nur Lesen</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Passwort (mind. 8 Zeichen) {editingUser ? '(leer lassen = unverändert)' : '*'}
              </label>
              <input
                type="password"
                className="input-field"
                value={uPassword}
                onChange={(e) => setUPassword(e.target.value)}
                required={!editingUser}
                minLength={editingUser && !uPassword ? undefined : 8}
                autoComplete="new-password"
              />
            </div>
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
              checked={uActive}
              onChange={(e) => setUActive(e.target.checked)}
            />
            <span>Konto aktiv</span>
          </label>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={onCloseUserForm}>
              Abbrechen
            </button>
            <button type="submit" className="btn-primary" disabled={savingUser}>
              {savingUser ? 'Speichert…' : 'Speichern'}
            </button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Benutzer</th>
                <th className="px-4 py-3 text-left font-semibold">Rolle</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Letzter Login</th>
                <th className="px-4 py-3 text-right font-semibold">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{u.display_name}</div>
                    <div className="text-xs text-slate-500">
                      @{u.username} {u.email ? `· ${u.email}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">{ROLE_LABELS[u.role]}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        u.active
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {u.active ? 'Aktiv' : 'Deaktiviert'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {u.last_login_at
                      ? new Date(u.last_login_at).toLocaleString('de-DE')
                      : 'Noch nie'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        className="btn-secondary !min-h-[38px] !px-3 text-xs"
                        onClick={() => onOpenEditUserForm(u)}
                      >
                        Bearbeiten
                      </button>
                      <button
                        type="button"
                        className="btn-secondary !min-h-[38px] !px-2.5 text-red-600 hover:bg-red-50 dark:text-red-400"
                        onClick={() => onDeleteUser(u)}
                        aria-label="Benutzer löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
