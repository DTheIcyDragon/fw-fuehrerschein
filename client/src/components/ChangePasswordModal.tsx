import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api, ApiError } from '../api';
import { useToast } from '../contexts/ToastContext';
import { ModalShell } from './ModalShell';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const { showToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('Das neue Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Die neuen Passwörter stimmen nicht überein.');
      return;
    }

    setSaving(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      showToast('Passwort erfolgreich geändert.', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Passwort konnte nicht geändert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Passwort ändern"
      maxWidthClass="max-w-md"
      icon={<KeyRound className="h-5 w-5 text-fire-600" />}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button
            type="submit"
            form="change-password-form"
            className="btn-primary"
            disabled={saving}
          >
            {saving ? 'Speichert…' : 'Passwort speichern'}
          </button>
        </>
      }
    >
      <form id="change-password-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium">Aktuelles Passwort</label>
          <input
            type="password"
            className="input-field"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Neues Passwort (mind. 8 Zeichen)</label>
          <input
            type="password"
            className="input-field"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Neues Passwort bestätigen</label>
          <input
            type="password"
            className="input-field"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>
      </form>
    </ModalShell>
  );
}
