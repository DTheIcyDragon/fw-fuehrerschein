import React, { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, X, XCircle } from 'lucide-react';
import type { EvaluatedMember, InspectionResult } from '@shared/types';
import { getTodayIsoDate } from '@shared/licenseRules';
import { api, ApiError } from '../api';
import { useToast } from '../contexts/ToastContext';

interface InspectionModalProps {
  open: boolean;
  members: EvaluatedMember[];
  initialMemberId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export function InspectionModal({
  open,
  members,
  initialMemberId,
  onClose,
  onSaved,
}: InspectionModalProps) {
  const { showToast } = useToast();
  const [memberId, setMemberId] = useState<number>(0);
  const [inspectedAt, setInspectedAt] = useState(getTodayIsoDate());
  const [result, setResult] = useState<InspectionResult>('ok');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeMembers = members.filter((m) => m.status === 'active' || m.id === initialMemberId);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setInspectedAt(getTodayIsoDate());
    setResult('ok');
    setNotes('');
    if (initialMemberId) {
      setMemberId(initialMemberId);
    } else if (activeMembers.length > 0) {
      setMemberId(activeMembers[0].id);
    } else {
      setMemberId(0);
    }
  }, [open, initialMemberId, members.length]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId) {
      setError('Bitte einen Kameraden auswählen.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createInspection({
        member_id: memberId,
        inspected_at: inspectedAt,
        result,
        notes: notes.trim() || null,
      });
      showToast('Führerscheinkontrolle gespeichert.', 'success');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kontrolle konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ClipboardCheck className="h-5 w-5 text-fire-600" />
            <h2 className="text-lg font-semibold">Führerscheinkontrolle erfassen</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Kamerad / Fahrer</label>
            <select
              className="input-field"
              value={memberId}
              onChange={(e) => setMemberId(Number(e.target.value))}
              required
            >
              <option value={0} disabled>
                Bitte auswählen…
              </option>
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.last_name}, {m.first_name}
                  {m.unit ? ` (${m.unit})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Kontrolldatum</label>
            <input
              type="date"
              className="input-field"
              value={inspectedAt}
              onChange={(e) => setInspectedAt(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Ergebnis der Sichtprüfung</label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setResult('ok')}
                className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-medium transition-colors ${
                  result === 'ok'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 dark:border-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-200'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>Ohne Beanstandung</span>
              </button>

              <button
                type="button"
                onClick={() => setResult('issue')}
                className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border p-3 text-left text-sm font-medium transition-colors ${
                  result === 'issue'
                    ? 'border-red-500 bg-red-50 text-red-900 ring-2 ring-red-500/20 dark:border-red-600 dark:bg-red-950/60 dark:text-red-200'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
                <span>Beanstandung / Mangel</span>
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Bemerkung {result === 'issue' ? '(bei Beanstandung empfohlen)' : '(optional)'}
            </label>
            <textarea
              rows={3}
              className="input-field min-h-[84px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                result === 'issue'
                  ? 'z. B. Dokument nicht vorgelegt, unleserlich, geänderte Auflagen…'
                  : 'z. B. Originaldokument vorgelegt'
              }
            />
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Abbrechen
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Speichert…' : 'Kontrolle speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
