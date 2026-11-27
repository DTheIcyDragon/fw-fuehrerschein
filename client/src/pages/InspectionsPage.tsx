import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Ban,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  History,
  Search,
  Shield,
} from 'lucide-react';
import type { AuditLogEntry, EvaluatedMember, Inspection } from '@shared/types';
import { formatDateDe } from '@shared/licenseRules';
import { api, ApiError } from '../api';
import { InspectionModal } from '../components/InspectionModal';
import { ModalShell } from '../components/ModalShell';
import { TrafficLightBadge } from '../components/TrafficLightBadge';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

type Tab = 'due' | 'log' | 'audit';

export function InspectionsPage() {
  const { isAdmin, canInspect } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<Tab>('due');
  const [members, setMembers] = useState<EvaluatedMember[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [showAllActive, setShowAllActive] = useState(false);
  const [dueSearch, setDueSearch] = useState('');
  const [dueUnit, setDueUnit] = useState('');
  const [loading, setLoading] = useState(true);

  // Protokoll-Filter
  const [unitFilter, setUnitFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modal & Storno
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMemberId, setModalMemberId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Inspection | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

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

      if (isAdmin) {
        try {
          setAuditLogs(await api.getInspectionAuditLogs());
        } catch {
          // ignore if endpoint unavailable
        }
      }
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Kontrolldaten konnten nicht geladen werden.',
        'error',
      );
    } finally {
      setLoading(false);
    }
  }, [unitFilter, fromDate, toDate, isAdmin, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCancelInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      await api.cancelInspection(cancelTarget.id, cancelReason.trim());
      showToast('Kontrolleintrag storniert (im Protokoll vermerkt).', 'success');
      setCancelTarget(null);
      setCancelReason('');
      await loadData();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Stornierung fehlgeschlagen.', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const q = dueSearch.trim().toLowerCase();
  const dueList = members
    .filter((m) => (showAllActive ? true : m.evaluation.inspection.status !== 'green'))
    .filter((m) => (!dueUnit ? true : m.unit === dueUnit))
    .filter((m) =>
      !q
        ? true
        : `${m.last_name} ${m.first_name} ${m.unit ?? ''} ${m.personnel_number ?? ''}`
            .toLowerCase()
            .includes(q),
    )
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
            Fällige Sichtprüfungen durchführen & dokumentiertes Prüfprotokoll abrufen
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
      <div className="flex gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setTab('due')}
          className={`flex min-h-[44px] shrink-0 items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
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
          className={`flex min-h-[44px] shrink-0 items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
            tab === 'log'
              ? 'border-fire-600 text-fire-600 dark:text-fire-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <History className="h-4 w-4" />
          <span>Prüfprotokoll ({inspections.length})</span>
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setTab('audit')}
            className={`flex min-h-[44px] shrink-0 items-center gap-2 border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
              tab === 'audit'
                ? 'border-fire-600 text-fire-600 dark:text-fire-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Shield className="h-4 w-4" />
            <span>Audit-Log ({auditLogs.length})</span>
          </button>
        )}
      </div>

      {tab === 'due' && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  className="input-field pl-9"
                  placeholder="Kamerad suchen (Dienstabend)…"
                  value={dueSearch}
                  onChange={(e) => setDueSearch(e.target.value)}
                />
              </div>

              <select
                className="input-field"
                value={dueUnit}
                onChange={(e) => setDueUnit(e.target.value)}
                aria-label="Einheit filtern"
              >
                <option value="">Alle Einheiten</option>
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>

              <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
                  checked={showAllActive}
                  onChange={(e) => setShowAllActive(e.target.checked)}
                />
                <span>Alle aktiven Kameraden anzeigen</span>
              </label>
            </div>
          </div>

          {loading ? (
            <div className="card p-8 text-center text-sm text-slate-500">Lade Kontrollen…</div>
          ) : dueList.length === 0 ? (
            <div className="card p-10 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-2 font-semibold">Keine fälligen Kontrollen</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Für die gewählten Filter stehen aktuell keine Sichtprüfungen an.
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
                        onClick={() => {
                          setModalMemberId(m.id);
                          setModalOpen(true);
                        }}
                      >
                        <ClipboardCheck className="h-4 w-4" />
                        <span>Prüfen</span>
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
                      <th className="px-4 py-3 text-left font-semibold">Bemerkung / Status</th>
                      {isAdmin && <th className="px-4 py-3 text-right font-semibold">Aktion</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {inspections.map((insp) => {
                      const isCancelled = Boolean(insp.cancelled_at);
                      return (
                        <tr key={insp.id} className={isCancelled ? 'opacity-65' : ''}>
                          <td className={`px-4 py-3 font-medium ${isCancelled ? 'line-through' : ''}`}>
                            {formatDateDe(insp.inspected_at)}
                          </td>
                          <td className={`px-4 py-3 ${isCancelled ? 'line-through' : ''}`}>
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
                            {isCancelled ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                <Ban className="h-3 w-3" />
                                Storniert
                              </span>
                            ) : insp.result === 'ok' ? (
                              <TrafficLightBadge status="green" label="Ohne Beanstandung" compact />
                            ) : (
                              <TrafficLightBadge status="red" label="Beanstandung" compact />
                            )}
                          </td>
                          <td className="px-4 py-3">{insp.inspector_name}</td>
                          <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                            <div>{insp.notes || '–'}</div>
                            {isCancelled && (
                              <div className="mt-1 text-red-600 dark:text-red-400">
                                Storniert von {insp.cancelled_by_name ?? 'Admin'}:{' '}
                                {insp.cancel_reason || 'Ohne Grund'}
                              </div>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right">
                              {!isCancelled && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelTarget(insp);
                                    setCancelReason('');
                                  }}
                                  className="btn-secondary !min-h-[36px] !px-2.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400"
                                >
                                  Stornieren
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'audit' && isAdmin && (
        <div className="card overflow-hidden">
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Noch keine Audit-Einträge vorhanden.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-800">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold">Zeitpunkt</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Akteur</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Aktion</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Objekt</th>
                    <th className="px-4 py-2.5 text-left font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {auditLogs.map((entry) => (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {new Date(entry.created_at).toLocaleString('de-DE')}
                      </td>
                      <td className="px-4 py-2.5 font-medium">{entry.actor_name}</td>
                      <td className="px-4 py-2.5 font-mono">{entry.action}</td>
                      <td className="px-4 py-2.5">
                        {entry.entity_type} {entry.entity_id ? `#${entry.entity_id}` : ''}
                      </td>
                      <td className="max-w-md truncate px-4 py-2.5 text-slate-500 dark:text-slate-400">
                        {entry.details_json || '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <InspectionModal
        open={modalOpen}
        members={members}
        initialMemberId={modalMemberId}
        onClose={() => setModalOpen(false)}
        onSaved={() => void loadData()}
      />

      <ModalShell
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Kontrolleintrag stornieren"
        maxWidthClass="max-w-md"
        icon={<Ban className="h-5 w-5 text-red-600" />}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setCancelTarget(null)}
              disabled={cancelling}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              form="cancel-inspection-form"
              className="btn-danger"
              disabled={cancelling || !cancelReason.trim()}
            >
              {cancelling ? 'Storniert…' : 'Verbindlich stornieren'}
            </button>
          </>
        }
      >
        <form id="cancel-inspection-form" onSubmit={handleCancelInspection} className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Aus Revisionsgründen werden Kontrollen nicht gelöscht, sondern mit Begründung storniert.
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium">Storno-Grund *</label>
            <textarea
              rows={3}
              className="input-field min-h-[84px]"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="z. B. Versehentlich für falschen Kameraden eingetragen"
              required
            />
          </div>
        </form>
      </ModalShell>
    </div>
  );
}
