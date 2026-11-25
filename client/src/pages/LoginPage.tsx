import React, { useState } from 'react';
import { Flame, LogIn, Moon, Sun } from 'lucide-react';
import { ApiError } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export function LoginPage() {
  const { login, departmentName } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Anmeldung fehlgeschlagen.');
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

      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-fire-600 text-white shadow-lg">
            <Flame className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{departmentName}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Führerscheinverwaltung · Anmeldung
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6 sm:p-8">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Benutzername</label>
            <input
              type="text"
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Passwort</label>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            <LogIn className="h-4 w-4" />
            <span>{submitting ? 'Anmelden…' : 'Anmelden'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
