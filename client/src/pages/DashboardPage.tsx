import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Truck,
  UserPlus,
  Users,
} from 'lucide-react';
import type { EvaluatedMember } from '@shared/types';
import { formatDateDe, LICENSE_CLASS_SHORT_LABELS } from '@shared/licenseRules';
import { api, ApiError, type DashboardSummary } from '../api';
import { InspectionModal } from '../components/InspectionModal';
import { MemberModal } from '../components/MemberModal';
import { TrafficLightBadge } from '../components/TrafficLightBadge';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export function DashboardPage() {
  const { canEditMembers, canInspect } = useAuth();
  const { showToast } = useToast();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [allMembers, setAllMembers] = useState<EvaluatedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inspectMemberId, setInspectMemberId] = useState<number | null>(null);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [dash, members] = await Promise.all([
        api.getDashboard(),
        api.listMembers({ status: 'active' }),
      ]);
      setSummary(dash);
      setAllMembers(members);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Dashboard konnte nicht geladen werden.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500">
        Lade Einsatzbereitschaft…
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error ?? 'Keine Daten verfügbar.'}</p>
        <button type="button" className="btn-secondary mt-4" onClick={() => void loadData()}>
          Erneut laden
        </button>
      </div>
    );
  }

  const { counts, attentionMembers, vehicles } = summary;

  return (
    <div className="space-y-6">
      {/* Header & Schnellaktionen */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Einsatzbereitschaft & Kontrollstatus · {summary.departmentName}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canInspect && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setInspectMemberId(null);
                setInspectOpen(true);
              }}
            >
              <ClipboardCheck className="h-4 w-4" />
              <span>Kontrolle erfassen</span>
            </button>
          )}
          {canEditMembers && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setMemberModalOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
              <span>Kamerad anlegen</span>
            </button>
          )}
          <a href={api.urls.membersPdf()} className="btn-secondary">
            <FileText className="h-4 w-4" />
            <span>PDF-Übersicht</span>
          </a>
        </div>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Link to="/members" className="card p-4 transition hover:border-slate-300 dark:hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Aktive Kameraden
            </span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold">{counts.totalActive}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-medium">
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {counts.green} Grün
            </span>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {counts.yellow} Gelb
            </span>
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-800 dark:bg-red-950 dark:text-red-300">
              {counts.red} Rot
            </span>
          </div>
        </Link>

        <Link to="/inspections" className="card p-4 transition hover:border-slate-300 dark:hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Kontrollen fällig
            </span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold">{counts.dueInspections}</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Davon überfällig:{' '}
            <strong className={counts.overdueInspections > 0 ? 'text-red-600 dark:text-red-400' : ''}>
              {counts.overdueInspections}
            </strong>
          </p>
        </Link>

        <Link
          to="/members?trafficLight=yellow"
          className="card p-4 transition hover:border-slate-300 dark:hover:border-slate-700"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Fristen / Ablauf
            </span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold">{counts.expiringLicenses}</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Bald ablaufende / abgelaufene Klassen
          </p>
        </Link>

        <Link to="/vehicles" className="card p-4 transition hover:border-slate-300 dark:hover:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Fahrzeuge & Sperren
            </span>
            {counts.activeBans > 0 ? (
              <Ban className="h-4 w-4 text-red-500" />
            ) : (
              <Truck className="h-4 w-4 text-emerald-500" />
            )}
          </div>
          <p className="mt-2 text-2xl font-bold">{counts.activeVehicles}</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Aktive Fahrverbote:{' '}
            <strong className={counts.activeBans > 0 ? 'text-red-600 dark:text-red-400' : ''}>
              {counts.activeBans}
            </strong>
          </p>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Handlungsbedarf */}
        <section className="card flex flex-col lg:col-span-3">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold">Handlungsbedarf</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sortiert nach Dringlichkeit (Sperren, abgelaufene Klassen, fällige Kontrollen)
              </p>
            </div>
            <Link to="/inspections" className="text-xs font-semibold text-fire-600 hover:underline dark:text-fire-400">
              Alle Kontrollen
            </Link>
          </div>

          {attentionMembers.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              <p className="mt-2 font-medium text-slate-900 dark:text-white">
                Alles im grünen Bereich
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Aktuell liegt kein Handlungsbedarf bei aktiven Kameraden vor.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {attentionMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/members/${member.id}`}
                        className="font-semibold text-slate-900 hover:text-fire-600 dark:text-white dark:hover:text-fire-400"
                      >
                        {member.last_name}, {member.first_name}
                      </Link>
                      <TrafficLightBadge status={member.evaluation.overallStatus} compact />
                      {member.unit && (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {member.unit}
                        </span>
                      )}
                    </div>
                    <ul className="space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                      {member.evaluation.reasons.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-slate-400">
                      Letzte Kontrolle:{' '}
                      {formatDateDe(member.evaluation.inspection.lastInspectedAt)} · Nächste:{' '}
                      {formatDateDe(member.evaluation.inspection.nextDueAt)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {canInspect && (
                      <button
                        type="button"
                        className="btn-secondary !min-h-[44px] !px-3 text-xs"
                        onClick={() => {
                          setInspectMemberId(member.id);
                          setInspectOpen(true);
                        }}
                      >
                        <ClipboardCheck className="h-4 w-4 text-fire-600" />
                        <span>Prüfen</span>
                      </button>
                    )}
                    <Link
                      to={`/members/${member.id}`}
                      className="btn-secondary !min-h-[44px] !px-3 text-xs"
                    >
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Fahrzeug-Einsatzbereitschaft */}
        <section className="card flex flex-col lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold">Fahrzeug-Besatzung</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verfügbare Maschinisten / Fahrer je Fahrzeug
              </p>
            </div>
            <Link to="/vehicles" className="text-xs font-semibold text-fire-600 hover:underline dark:text-fire-400">
              Details
            </Link>
          </div>

          {vehicles.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Noch keine aktiven Fahrzeuge hinterlegt.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {vehicles.map((vehicle) => (
                <Link
                  key={vehicle.id}
                  to="/vehicles"
                  className="block px-5 py-3.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">
                        {vehicle.name}
                      </p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {[
                          vehicle.call_sign,
                          vehicle.required_classes
                            .map((c) => LICENSE_CLASS_SHORT_LABELS[c])
                            .join(' / '),
                          vehicle.is_automatic ? 'Automatik' : 'Schalter',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs font-semibold">
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {vehicle.counts.green} Bereit
                    </span>
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {vehicle.counts.yellow} Hinweis
                    </span>
                    <span className="rounded-md bg-red-100 px-2 py-0.5 text-red-800 dark:bg-red-950 dark:text-red-300">
                      {vehicle.counts.red} Gesperrt
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <InspectionModal
        open={inspectOpen}
        members={allMembers}
        initialMemberId={inspectMemberId}
        onClose={() => setInspectOpen(false)}
        onSaved={() => void loadData()}
      />

      <MemberModal
        open={memberModalOpen}
        member={null}
        onClose={() => setMemberModalOpen(false)}
        onSaved={() => void loadData()}
      />
    </div>
  );
}
