import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  History,
  Trash2,
} from 'lucide-react';
import type { EvaluatedMember, Inspection } from '@shared/types';
import { formatDateDe, getTodayIsoDate } from '@shared/licenseRules';
import { api, ApiError } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { InspectionModal } from '../components/InspectionModal';
import { TrafficLightBadge } from '../components/TrafficLightBadge';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

type Tab = 'due' | 'log';

export function InspectionsPage() {
  const { isAdmin, canInspect } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<Tab>('due');
  const [members, setMembers] = useState<EvaluatedMember[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [showAllActive, setShowAllActive] = useState(false);
  const [loading, setLoading] = useState(true);

  // Protokoll-Filter
  const [unitFilter, setUnitFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modal & Quick-Check
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMemberId, setModalMemberId] = useState<number | null>(null);
  const [quickSavingId, setQuickSavingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [memberList, inspectionList, unitList] = await Promise.all([
        api.listMembers({ status: 'active' }),
        api.listInspections({
          unit: unitFilter || undefined,
          from: fromDate || undefined,
          to: toDate || undefined,
        }),
        api.listUnits(),
      ]);
      setMembers(memberList);
      setInspections(inspectionList);
      setUnits(unitList);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Kontrolldaten konnten nicht geladen werden.',
        'error',
      );
    } finally {
      setLoading(false);
    }
  }, [unitFilter, fromDate, toDate, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleQuickOk = async (member: EvaluatedMember) => {
    setQuickSavingId(member.id);
    try {
      await api.createInspection({
        member_id: member.id,
        inspected_at: getTodayIsoDate(),
        result: 'ok',
        notes: 'Schnellprüfung ohne Beanstandung',
      });
      showToast(`Kontrolle für ${member.first_name} ${member.last_name} erfasst.`, 'success');
      await loadData();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Kontrolle fehlgeschlagen.', 'error');
    } finally {
      setQuickSavingId(null);
    }
  };

  const handleDeleteInspection = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.deleteInspection(deleteId);
      showToast('Prüfeintrag gelöscht.', 'success');
      setDeleteId(null);
      await loadData();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Löschen fehlgeschlagen.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const dueList = members
    .filter((m) => (showAllActive ? true : m.evaluation.inspection.status !== 'green'))
    .sort((a, b) => {
      const rank = { red: 0, yellow: 1, green: 2 };
      const rDiff = rank[a.evaluation.inspection.status] - rank[b.evaluation.inspection.status];
      if (rDiff !== 0) return rDiff;
      const dA = a.evaluation.inspection.daysUntilDue ?? -9999;
      const dB = b.evaluation.inspection.daysUntilDue ?? -9999;
      return dA - dB;
    });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Führerscheinkontrolle</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Fällige Sichtprüfungen durchführen & rechtssicheres Prüfprotokoll abrufen
          </p>
        </div>

        {canInspect && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setModalMemberId(null);
              setModalOpen(true);
            }}
          >
            <ClipboardCheck className="h-4 w-4" />
            <span>Kontrolle erfassen</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setTab('due')}
          className={`flex min-h-[44px] items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition ${
            tab === 'due'
              ? 'border-fire-600 text-fire-600 dark:text-fire-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <ClipboardCheck className="h-4 w-4" />
          <span>Fällige & bald fällige Kontrollen</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('log')}
          className={`flex min-h-[44px] items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition ${
            tab === 'log'
              ? 'border-fire-600 text-fire-600 dark:text-fire-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Prüfprotokoll ({inspections.length})</span>
        </button>
      </div>

      {tab === 'due' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
                checked={showAllActive}
                onChange={(e) => setShowAllActive(e.target.checked)}
              />
              <span>Auch aktuell gültige Kameraden anzeigen</span>
            </label>
          </div>

          {loading ? (
            <div className="card p-8 text-center text-sm text-slate-500">Lade Kontrollen…</div>
          ) : dueList.length === 0 ? (
            <div className="card p-10 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-2 font-semibold">Keine fälligen Kontrollen</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Alle aktiven Kameraden befinden sich im aktuellen Prüfintervall.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {dueList.map((m) => (
                <div
                  key={m.id}
                  className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/members/${m.id}`}
                        className="font-semibold text-slate-900 hover:text-fire-600 dark:text-white"
                      >
                        {m.last_name}, {m.first_name}
                      </Link>
                      <TrafficLightBadge status={m.evaluation.inspection.status} compact />
                      {m.unit && (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {m.unit}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {m.evaluation.inspection.reason}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Letzte Kontrolle: {formatDateDe(m.evaluation.inspection.lastInspectedAt)} ·
                      Nächste fällig: {formatDateDe(m.evaluation.inspection.nextDueAt)}
                    </p>
                  </div>

                  {canInspect && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-primary text-xs"
                        disabled={quickSavingId === m.id}
                        onClick={() => void handleQuickOk(m)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>
                          {quickSavingId === m.id ? 'Speichert…' : '1-Klick: Ohne Beanstandung'}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => {
                          setModalMemberId(m.id);
                          setModalOpen(true);
                        }}
                      >
                        Details / Mangel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'log' && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <select
                className="input-field"
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                aria-label="Einheit filtern"
              >
                <option value="">Alle Einheiten</option>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>

              <input
                type="date"
                className="input-field"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                aria-label="Von Datum"
              />

              <input
                type="date"
                className="input-field"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                aria-label="Bis Datum"
              />

              <a
                href={api.urls.inspectionsPdf({
                  unit: unitFilter || undefined,
                  from: fromDate || undefined,
                  to: toDate || undefined,
                })}
                className="btn-secondary"
              >
                <FileText className="h-4 w-4" />
                <span>Prüfprotokoll PDF</span>
              </a>
            </div>
          </div>

          <div className="card overflow-hidden">
            {inspections.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Keine Kontrollen im gewählten Zeitraum gefunden.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Datum</th>
                      <th className="px-4 py-3 text-left font-semibold">Kamerad</th>
                      <th className="px-4 py-3 text-left font-semibold">Einheit</th>
                      <th className="px-4 py-3 text-left font-semibold">Ergebnis</th>
                      <th className="px-4 py-3 text-left font-semibold">Prüfer</th>
                      <th className="px-4 py-3 text-left font-semibold">Bemerkung</th>
                      {isAdmin && <th className="px-4 py-3 text-right font-semibold">Aktion</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {inspections.map((insp) => (
                      <tr key={insp.id}>
                        <td className="px-4 py-3 font-medium">
                          {formatDateDe(insp.inspected_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/members/${insp.member_id}`}
                            className="font-semibold hover:text-fire-600 dark:hover:text-fire-400"
                          >
                            {insp.member_last_name}, {insp.member_first_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {insp.member_unit || '–'}
                        </td>
                        <td className="px-4 py-3">
                          {insp.result === 'ok' ? (
                            <TrafficLightBadge status="green" label="Ohne Beanstandung" compact />
                          ) : (
                            <TrafficLightBadge status="red" label="Beanstandung" compact />
                          )}
                        </td>
                        <td className="px-4 py-3">{insp.inspector_name}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {insp.notes || '–'}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setDeleteId(insp.id)}
                              className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/60"
                              aria-label="Kontrolleintrag löschen"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <InspectionModal
        open={modalOpen}
        members={members}
        initialMemberId={modalMemberId}
        onClose={() => setModalOpen(false)}
        onSaved={() => void loadData()}
      />

      <ConfirmDialog
        open={deleteId !== null}
        title="Kontrolleintrag löschen?"
        message="Möchten Sie diesen Eintrag aus dem Prüfprotokoll wirklich löschen?"
        confirmLabel="Löschen"
        loading={deleting}
        onConfirm={() => void handleDeleteInspection()}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
