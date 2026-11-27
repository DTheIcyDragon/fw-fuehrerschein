import React, { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardCheck, Search, ShieldAlert, XCircle } from 'lucide-react';
import type { EvaluatedMember, InspectionResult } from '@shared/types';
import {
  formatDateDe,
  getTodayIsoDate,
  LICENSE_CLASS_SHORT_LABELS,
} from '@shared/licenseRules';
import { api, ApiError } from '../api';
import { useToast } from '../contexts/ToastContext';
import { ModalShell } from './ModalShell';

interface InspectionModalProps {
  open: boolean;
  members: EvaluatedMember[];
  initialMemberId?: number | null;
  loadAllActive?: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function InspectionModal({
  open,
  members,
  initialMemberId,
  loadAllActive = false,
  onClose,
  onSaved,
}: InspectionModalProps) {
  const { showToast } = useToast();
  const [fetchedMembers, setFetchedMembers] = useState<EvaluatedMember[] | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberId, setMemberId] = useState<number>(0);
  const [inspectedAt, setInspectedAt] = useState(getTodayIsoDate());
  const [result, setResult] = useState<InspectionResult>('ok');
  const [notes, setNotes] = useState('');
  const [checkedEuCard, setCheckedEuCard] = useState(true);
  const [checkedFwLicense, setCheckedFwLicense] = useState(false);
  const [checkedRestrictions, setCheckedRestrictions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceMembers = fetchedMembers ?? members;
  const selectableMembers = sourceMembers.filter(
    (m) => m.status === 'active' || m.id === initialMemberId,
  );
  const selectedMember = selectableMembers.find((m) => m.id === memberId) ?? null;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setMemberSearch('');
    setInspectedAt(getTodayIsoDate());
    setResult('ok');
    setNotes('');
    setCheckedEuCard(true);

    let active = true;
    if (loadAllActive && !initialMemberId) {
      api
        .listMembers({ status: 'active' })
        .then((list) => {
          if (!active) return;
          setFetchedMembers(list);
          setMemberId((prev) => (prev === 0 && list.length > 0 ? list[0].id : prev));
        })
        .catch(() => {
          // fallback to provided members list
        });
    } else {
      setFetchedMembers(null);
    }

    const candidates = members.filter((m) => m.status === 'active' || m.id === initialMemberId);
    if (initialMemberId) {
      setMemberId(initialMemberId);
    } else if (candidates.length > 0) {
      setMemberId(candidates[0].id);
    } else {
      setMemberId(0);
    }

    return () => {
      active = false;
    };
  }, [open, initialMemberId, loadAllActive, members]);

  useEffect(() => {
    if (!open || !selectedMember) return;
    const hasFw = selectedMember.licenses.some(
      (l) => l.license_class === 'FW_475' || l.license_class === 'FW_750',
    );
    const hasRestrictions =
      selectedMember.global_key_numbers.length > 0 ||
      selectedMember.licenses.some((l) => l.key_numbers.length > 0);
    setCheckedFwLicense(hasFw);
    setCheckedRestrictions(hasRestrictions);
  }, [open, selectedMember]);

  const q = memberSearch.trim().toLowerCase();
  const filteredMembers = q
    ? selectableMembers.filter((m) =>
        `${m.last_name} ${m.first_name} ${m.unit ?? ''} ${m.personnel_number ?? ''}`
          .toLowerCase()
          .includes(q),
      )
    : selectableMembers;

  const hasFwClass = Boolean(
    selectedMember?.licenses.some(
      (l) => l.license_class === 'FW_475' || l.license_class === 'FW_750',
    ),
  );

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
        checked_eu_card: checkedEuCard,
        checked_fw_license: checkedFwLicense,
        checked_restrictions: checkedRestrictions,
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
    <ModalShell
      open={open}
      onClose={onClose}
      title="Führerscheinkontrolle erfassen"
      icon={<ClipboardCheck className="h-5 w-5 text-fire-600" />}
      maxWidthClass="max-w-xl"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button
            type="submit"
            form="inspection-modal-form"
            className="btn-primary"
            disabled={saving}
          >
            {saving ? 'Speichert…' : 'Kontrolle speichern'}
          </button>
        </>
      }
    >
      <form id="inspection-modal-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Durchsuchbare Kameraden-Auswahl */}
        {!initialMemberId && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Kamerad / Fahrer auswählen</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                className="input-field pl-9"
                placeholder="Name, Einheit oder Personalnummer suchen…"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
            </div>
            <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 dark:border-slate-800 dark:divide-slate-800">
              {filteredMembers.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-500">
                  Kein passender Kamerad gefunden.
                </div>
              ) : (
                filteredMembers.map((m) => {
                  const selected = m.id === memberId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMemberId(m.id)}
                      className={`flex min-h-[42px] w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                        selected
                          ? 'bg-fire-50 font-semibold text-fire-900 dark:bg-fire-950/80 dark:text-fire-200'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span>
                        {m.last_name}, {m.first_name}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {m.unit || m.personnel_number || ''}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Prüfkarte zum Abgleich mit dem Originaldokument */}
        {selectedMember && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-800/50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Prüfkarte: {selectedMember.first_name} {selectedMember.last_name}
              </p>
              {selectedMember.unit && (
                <span className="rounded bg-white px-2 py-0.5 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  {selectedMember.unit}
                </span>
              )}
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <span className="text-slate-500 dark:text-slate-400">FS-Nummer: </span>
                <strong className="font-mono">{selectedMember.license_number || '–'}</strong>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">Karten-Ablauf (4b): </span>
                <strong>{formatDateDe(selectedMember.card_expires_at)}</strong>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedMember.licenses.length === 0 ? (
                <span className="text-slate-400">Keine Klassen eingetragen</span>
              ) : (
                selectedMember.licenses.map((l) => (
                  <span
                    key={l.license_class}
                    className="rounded border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {LICENSE_CLASS_SHORT_LABELS[l.license_class]}
                    {l.expires_at ? ` (bis ${formatDateDe(l.expires_at)})` : ' (unbefristet)'}
                    {l.key_numbers.length > 0 ? ` · SZ ${l.key_numbers.join(',')}` : ''}
                  </span>
                ))
              )}
            </div>

            {selectedMember.global_key_numbers.length > 0 && (
              <p className="mt-2 flex items-center gap-1 text-amber-800 dark:text-amber-300">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                <span>Globale Schlüsselzahlen: {selectedMember.global_key_numbers.join(', ')}</span>
              </p>
            )}
          </div>
        )}

        {/* Geprüfte Dokumente / Checkboxes */}
        <div className="space-y-2 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Dokumenten-Abgleich (Sichtprüfung)
          </p>
          <label className="flex min-h-[38px] cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
              checked={checkedEuCard}
              onChange={(e) => setCheckedEuCard(e.target.checked)}
            />
            <span>Original-EU-Führerschein (Plastikkarte / Papier) vorgelegt</span>
          </label>

          <label className="flex min-h-[38px] cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
              checked={checkedFwLicense}
              onChange={(e) => setCheckedFwLicense(e.target.checked)}
            />
            <span>
              FW-Fahrberechtigung vorgelegt{' '}
              {hasFwClass ? '(bei FW-Klassen erforderlich)' : '(falls vorhanden)'}
            </span>
          </label>

          <label className="flex min-h-[38px] cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
              checked={checkedRestrictions}
              onChange={(e) => setCheckedRestrictions(e.target.checked)}
            />
            <span>Auflagen / Schlüsselzahlen & Fristen mit Dokument abgeglichen</span>
          </label>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Kontrolldatum</label>
          <input
            type="date"
            className="input-field"
            value={inspectedAt}
            max={getTodayIsoDate()}
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
            rows={2}
            className="input-field min-h-[68px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              result === 'issue'
                ? 'z. B. Dokument nicht vorgelegt, unleserlich, geänderte Auflagen…'
                : 'z. B. Originaldokument beim Dienstabend vorgelegt'
            }
          />
        </div>
      </form>
    </ModalShell>
  );
}
