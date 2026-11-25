import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ClipboardCheck,
  Download,
  Edit3,
  FileText,
  Search,
  UserPlus,
} from 'lucide-react';
import type { EvaluatedMember, LicenseClass, MemberStatus } from '@shared/types';
import {
  ALL_LICENSE_CLASSES,
  formatDateDe,
  LICENSE_CLASS_SHORT_LABELS,
} from '@shared/licenseRules';
import { api, ApiError } from '../api';
import { InspectionModal } from '../components/InspectionModal';
import { MemberModal } from '../components/MemberModal';
import { TrafficLightBadge } from '../components/TrafficLightBadge';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
  archived: 'Archiviert',
};

export function MembersPage() {
  const { canEditMembers, canInspect } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [unit, setUnit] = useState(searchParams.get('unit') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? 'active');
  const [licenseClass, setLicenseClass] = useState(searchParams.get('licenseClass') ?? '');
  const [trafficLight, setTrafficLight] = useState(searchParams.get('trafficLight') ?? '');

  const [members, setMembers] = useState<EvaluatedMember[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<EvaluatedMember | null>(null);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [inspectMemberId, setInspectMemberId] = useState<number | null>(null);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const [list, unitList] = await Promise.all([
        api.listMembers({
          search: search.trim() || undefined,
          unit: unit || undefined,
          status: status || undefined,
          licenseClass: licenseClass || undefined,
          trafficLight: trafficLight || undefined,
        }),
        api.listUnits(),
      ]);
      setMembers(list);
      setUnits(unitList);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Kameraden konnten nicht geladen werden.',
        'error',
      );
    } finally {
      setLoading(false);
    }
  }, [search, unit, status, licenseClass, trafficLight, showToast]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadMembers();
    }, 180);
    return () => window.clearTimeout(t);
  }, [loadMembers]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set('search', search);
    if (unit) next.set('unit', unit);
    if (status && status !== 'active') next.set('status', status);
    if (licenseClass) next.set('licenseClass', licenseClass);
    if (trafficLight) next.set('trafficLight', trafficLight);
    setSearchParams(next, { replace: true });
  }, [search, unit, status, licenseClass, trafficLight, setSearchParams]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kameraden</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Mitglieder, EU- & Feuerwehrführerscheinklassen, Kontrollen & Sperren
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={api.urls.membersCsv()} className="btn-secondary">
            <Download className="h-4 w-4" />
            <span>CSV-Export</span>
          </a>
          <a href={api.urls.membersPdf(unit || undefined)} className="btn-secondary">
            <FileText className="h-4 w-4" />
            <span>PDF</span>
          </a>
          {canEditMembers && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setEditingMember(null);
                setMemberModalOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4" />
              <span>Kamerad anlegen</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              className="input-field pl-9"
              placeholder="Name, Personalnummer, FS-Nummer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="input-field"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            aria-label="Einheit filtern"
          >
            <option value="">Alle Einheiten</option>
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          <select
            className="input-field"
            value={licenseClass}
            onChange={(e) => setLicenseClass(e.target.value)}
            aria-label="Führerscheinklasse filtern"
          >
            <option value="">Alle Klassen</option>
            {ALL_LICENSE_CLASSES.map((cls: LicenseClass) => (
              <option key={cls} value={cls}>
                {LICENSE_CLASS_SHORT_LABELS[cls]}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <select
              className="input-field"
              value={trafficLight}
              onChange={(e) => setTrafficLight(e.target.value)}
              aria-label="Ampel filtern"
            >
              <option value="">Alle Ampeln</option>
              <option value="green">Grün</option>
              <option value="yellow">Gelb</option>
              <option value="red">Rot</option>
            </select>

            <select
              className="input-field"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Status filtern"
            >
              <option value="active">Aktiv</option>
              <option value="inactive">Inaktiv</option>
              <option value="archived">Archiv</option>
              <option value="all">Alle Status</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm text-slate-500">Lade Kameraden…</div>
      ) : members.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Keine Kameraden für die aktuellen Filter gefunden.
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="space-y-3 md:hidden">
            {members.map((m) => (
              <div key={m.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link
                      to={`/members/${m.id}`}
                      className="text-base font-semibold text-slate-900 hover:text-fire-600 dark:text-white"
                    >
                      {m.last_name}, {m.first_name}
                    </Link>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {[m.unit, m.personnel_number ? `Pers.-Nr. ${m.personnel_number}` : null, STATUS_LABELS[m.status]]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <TrafficLightBadge status={m.evaluation.overallStatus} compact />
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {m.evaluation.licenses.length === 0 ? (
                    <span className="text-xs text-slate-400">Keine Klassen erfasst</span>
                  ) : (
                    m.evaluation.licenses.map((l) => (
                      <span
                        key={l.license_class}
                        className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                          l.status === 'red'
                            ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            : l.status === 'yellow'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {LICENSE_CLASS_SHORT_LABELS[l.license_class]}
                      </span>
                    ))
                  )}
                </div>

                {m.evaluation.reasons.length > 0 && (
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                    {m.evaluation.reasons[0]}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <Link to={`/members/${m.id}`} className="btn-secondary flex-1 text-xs">
                    Details
                  </Link>
                  {canInspect && (
                    <button
                      type="button"
                      className="btn-secondary flex-1 text-xs"
                      onClick={() => {
                        setInspectMemberId(m.id);
                        setInspectOpen(true);
                      }}
                    >
                      <ClipboardCheck className="h-4 w-4 text-fire-600" />
                      Prüfen
                    </button>
                  )}
                  {canEditMembers && (
                    <button
                      type="button"
                      className="btn-secondary !px-3 text-xs"
                      onClick={() => {
                        setEditingMember(m);
                        setMemberModalOpen(true);
                      }}
                      aria-label="Kamerad bearbeiten"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Einheit</th>
                    <th className="px-4 py-3 text-left font-semibold">Klassen</th>
                    <th className="px-4 py-3 text-left font-semibold">Letzte / Nächste Kontrolle</th>
                    <th className="px-4 py-3 text-left font-semibold">Ampel & Hinweise</th>
                    <th className="px-4 py-3 text-right font-semibold">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <Link
                          to={`/members/${m.id}`}
                          className="font-semibold text-slate-900 hover:text-fire-600 dark:text-white dark:hover:text-fire-400"
                        >
                          {m.last_name}, {m.first_name}
                        </Link>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {m.personnel_number ? `Pers.-Nr. ${m.personnel_number}` : '–'}
                          {m.status !== 'active' && ` · ${STATUS_LABELS[m.status]}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {m.unit || '–'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {m.evaluation.licenses.length === 0 ? (
                            <span className="text-xs text-slate-400">Keine</span>
                          ) : (
                            m.evaluation.licenses.map((l) => (
                              <span
                                key={l.license_class}
                                title={l.reason}
                                className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                                  l.status === 'red'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                    : l.status === 'yellow'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {LICENSE_CLASS_SHORT_LABELS[l.license_class]}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        <div>Letzte: {formatDateDe(m.evaluation.inspection.lastInspectedAt)}</div>
                        <div className="text-slate-400">
                          Nächste: {formatDateDe(m.evaluation.inspection.nextDueAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <TrafficLightBadge status={m.evaluation.overallStatus} compact />
                          {m.evaluation.reasons.length > 0 && (
                            <p className="max-w-xs truncate text-xs text-slate-500 dark:text-slate-400" title={m.evaluation.reasons.join(' | ')}>
                              {m.evaluation.reasons[0]}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {canInspect && (
                            <button
                              type="button"
                              onClick={() => {
                                setInspectMemberId(m.id);
                                setInspectOpen(true);
                              }}
                              className="btn-secondary !min-h-[38px] !px-2.5 text-xs"
                              title="Führerscheinkontrolle erfassen"
                            >
                              <ClipboardCheck className="h-4 w-4 text-fire-600" />
                            </button>
                          )}
                          {canEditMembers && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMember(m);
                                setMemberModalOpen(true);
                              }}
                              className="btn-secondary !min-h-[38px] !px-2.5 text-xs"
                              title="Bearbeiten"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          )}
                          <Link
                            to={`/members/${m.id}`}
                            className="btn-secondary !min-h-[38px] !px-3 text-xs"
                          >
                            Details
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <MemberModal
        open={memberModalOpen}
        member={editingMember}
        onClose={() => setMemberModalOpen(false)}
        onSaved={() => void loadMembers()}
      />

      <InspectionModal
        open={inspectOpen}
        members={members}
        initialMemberId={inspectMemberId}
        onClose={() => setInspectOpen(false)}
        onSaved={() => void loadMembers()}
      />
    </div>
  );
}
