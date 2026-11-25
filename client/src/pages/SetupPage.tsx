import React, { useState } from 'react';
import { Flame, Moon, ShieldCheck, Sun } from 'lucide-react';
import type { FederalStateCode } from '@shared/types';
import { FEDERAL_STATE_LIST, FEDERAL_STATE_PRESETS } from '@shared/licenseRules';
import { ApiError } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export function SetupPage() {
  const { setup } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [departmentName, setDepartmentName] = useState('Freiwillige Feuerwehr');
  const [federalState, setFederalState] = useState<FederalStateCode>('SH');
  const [intervalMonths, setIntervalMonths] = useState(6);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPreset = FEDERAL_STATE_PRESETS[federalState];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    setSubmitting(true);
    try {
      await setup({
        department_name: departmentName.trim(),
        inspection_interval_months: intervalMonths,
        federal_state: federalState,
        username: username.trim(),
        display_name: displayName.trim() || username.trim(),
        email: email.trim(),
        password,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ersteinrichtung fehlgeschlagen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-10 dark:bg-slate-950">
      <div className="fixed right-4 top-4">
        <button
          type="button"
          onClick={toggleTheme}
          className="btn-secondary !px-3"
          aria-label="Farbschema wechseln"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-fire-600 text-white shadow-lg">
            <Flame className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Ersteinrichtung der Führerscheinverwaltung
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Legen Sie Ihre Wehr, das Bundesland und das erste Administratorkonto an.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-5 p-6 sm:p-8">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <ShieldCheck className="h-4 w-4 text-fire-600" />
              Feuerwehr, Bundesland & Prüffrist
            </h2>

            <div>
              <label className="mb-1 block text-sm font-medium">Name der Feuerwehr / Organisation</label>
              <input
                type="text"
                className="input-field"
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                placeholder="z. B. Freiwillige Feuerwehr Musterstadt"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Bundesland (Feuerwehrführerschein)</label>
              <select
                className="input-field"
                value={federalState}
                onChange={(e) => setFederalState(e.target.value as FederalStateCode)}
              >
                {FEDERAL_STATE_LIST.map((st) => (
                  <option key={st.code} value={st.code}>
                    {st.name} ({st.code})
                  </option>
                ))}
              </select>
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/50">
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {selectedPreset.regulationName}
                </p>
                <p className="mt-0.5 text-slate-600 dark:text-slate-300">{selectedPreset.summary}</p>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Kontrollintervall Führerscheinkontrolle (Monate)
              </label>
              <select
                className="input-field"
                value={intervalMonths}
                onChange={(e) => setIntervalMonths(Number(e.target.value))}
              >
                <option value={6}>Halbjährlich (6 Monate – Standard gemäß DGUV)</option>
                <option value={12}>Jährlich (12 Monate)</option>
                <option value={3}>Vierteljährlich (3 Monate)</option>
              </select>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Administratorkonto
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Benutzername</label>
                <input
                  type="text"
                  className="input-field"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Anzeigename</label>
                <input
                  type="text"
                  className="input-field"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="z. B. Wehrführer Max Mustermann"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">E-Mail-Adresse (optional)</label>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@feuerwehr.de"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Passwort (mind. 8 Zeichen)</label>
                <input
                  type="password"
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Passwort wiederholen</label>
                <input
                  type="password"
                  className="input-field"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Wird eingerichtet…' : 'Einrichtung abschließen & anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}
