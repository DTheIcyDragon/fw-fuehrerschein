import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Edit3,
  FileText,
  Plus,
  Search,
  Trash2,
  Truck,
} from 'lucide-react';
import type { EvaluatedVehicle, TrafficLight, VehicleDriverEntry } from '@shared/types';
import { formatDateDe, LICENSE_CLASS_SHORT_LABELS } from '@shared/licenseRules';
import { api, ApiError } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { TrafficLightBadge, TrafficLightDot } from '../components/TrafficLightBadge';
import { VehicleModal } from '../components/VehicleModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export function VehiclesPage() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [vehicles, setVehicles] = useState<EvaluatedVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | TrafficLight>('all');
  const [showInactive, setShowInactive] = useState(false);

  const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
  const [driversByVehicle, setDriversByVehicle] = useState<Record<number, VehicleDriverEntry[]>>({});
  const [loadingDrivers, setLoadingDrivers] = useState<Record<number, boolean>>({});
  const [expandingAll, setExpandingAll] = useState(false);
  const [driverSearch, setDriverSearch] = useState<Record<number, string>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<EvaluatedVehicle | null>(null);
  const [deleteVehicle, setDeleteVehicle] = useState<EvaluatedVehicle | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadVehicles = useCallback(
    async (keepExpandedRefresh = false) => {
      setLoading(true);
      try {
        const list = await api.listVehicles({ summary: true });
        setVehicles(list);
        if (keepExpandedRefresh) {
          setDriversByVehicle({});
        }
      } catch (err) {
        showToast(
          err instanceof ApiError ? err.message : 'Fahrzeuge konnten nicht geladen werden.',
          'error',
        );
      } finally {
        setLoading(false);
      }
    },
    [showToast],
  );

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  const fetchVehicleDrivers = useCallback(
    async (vehicleId: number) => {
      setLoadingDrivers((prev) => ({ ...prev, [vehicleId]: true }));
      try {
        const full = await api.getVehicle(vehicleId);
        setDriversByVehicle((prev) => ({ ...prev, [vehicleId]: full.drivers }));
      } catch (err) {
        showToast(
          err instanceof ApiError ? err.message : 'Fahrerliste konnte nicht geladen werden.',
          'error',
        );
      } finally {
        setLoadingDrivers((prev) => ({ ...prev, [vehicleId]: false }));
      }
    },
    [showToast],
  );

  const toggleVehicleExpand = (vehicleId: number) => {
    const nextExpanded = !expandedIds[vehicleId];
    setExpandedIds((prev) => ({ ...prev, [vehicleId]: nextExpanded }));
    if (nextExpanded && !driversByVehicle[vehicleId] && !loadingDrivers[vehicleId]) {
      void fetchVehicleDrivers(vehicleId);
    }
  };

  const visibleVehicles = vehicles.filter((v) => (showInactive ? true : v.active));
  const anyVisibleExpanded = visibleVehicles.some((v) => Boolean(expandedIds[v.id]));

  const handleToggleAll = async () => {
    if (anyVisibleExpanded) {
      setExpandedIds({});
      return;
    }

    const nextExpanded: Record<number, boolean> = {};
    for (const v of visibleVehicles) {
      nextExpanded[v.id] = true;
    }
    setExpandedIds(nextExpanded);

    const hasMissing = visibleVehicles.some((v) => driversByVehicle[v.id] === undefined);
    if (!hasMissing) return;

    setExpandingAll(true);
    try {
      const fullList = await api.listVehicles();
      setVehicles(fullList.map((v) => ({ ...v, drivers: [] })));
      const nextCache: Record<number, VehicleDriverEntry[]> = {};
      for (const v of fullList) {
        nextCache[v.id] = v.drivers;
      }
      setDriversByVehicle(nextCache);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Fahrerlisten konnten nicht geladen werden.',
        'error',
      );
    } finally {
      setExpandingAll(false);
    }
  };

  const handleSavedVehicle = async () => {
    setDriversByVehicle({});
    await loadVehicles(true);
    const openIds = Object.keys(expandedIds)
      .map(Number)
      .filter((id) => expandedIds[id]);
    if (openIds.length > 0) {
      await Promise.all(openIds.map((id) => fetchVehicleDrivers(id)));
    }
  };

  const handleDelete = async () => {
    if (!deleteVehicle) return;
    const deletedId = deleteVehicle.id;
    setDeleting(true);
    try {
      await api.deleteVehicle(deletedId);
      showToast('Fahrzeug gelöscht.', 'success');
      setDeleteVehicle(null);
      setExpandedIds((prev) => {
        const next = { ...prev };
        delete next[deletedId];
        return next;
      });
      setDriversByVehicle((prev) => {
        const next = { ...prev };
        delete next[deletedId];
        return next;
      });
      await loadVehicles();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Löschen fehlgeschlagen.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fahrzeuge & Fahrerlisten</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            3-Stufen-Fahrerliste je Fahrzeug inkl. Klassenvererbung, Kontrollen & Schlüsselzahl 78
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a href={api.urls.vehiclesPdf()} className="btn-secondary">
            <FileText className="h-4 w-4" />
            <span>Gesamt-PDF</span>
          </a>
          {isAdmin && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setEditingVehicle(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              <span>Fahrzeug anlegen</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'all', label: 'Alle Fahrer' },
              { id: 'green', label: 'Grün (Bereit)' },
              { id: 'yellow', label: 'Gelb (Hinweis)' },
              { id: 'red', label: 'Rot (Gesperrt)' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`min-h-[40px] rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                statusFilter === f.id
                  ? 'border-fire-600 bg-fire-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {visibleVehicles.length > 0 && (
            <button
              type="button"
              onClick={() => void handleToggleAll()}
              disabled={expandingAll}
              className="btn-secondary !min-h-[40px] !px-3 text-xs"
            >
              {anyVisibleExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  <span>Alle einklappen</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  <span>{expandingAll ? 'Lädt…' : 'Alle aufklappen'}</span>
                </>
              )}
            </button>
          )}

          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <span>Inaktive Fahrzeuge anzeigen</span>
          </label>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-sm text-slate-500">Lade Fahrzeuge…</div>
      ) : visibleVehicles.length === 0 ? (
        <div className="card p-10 text-center">
          <Truck className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-2 font-medium">Keine Fahrzeuge vorhanden</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Legen Sie Fahrzeuge an, um automatische Fahrerlisten zu erhalten.
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {visibleVehicles.map((vehicle) => {
            const isExpanded = Boolean(expandedIds[vehicle.id]);
            const cachedDrivers = driversByVehicle[vehicle.id];
            const isLoadingList = Boolean(loadingDrivers[vehicle.id]);
            const searchTerm = (driverSearch[vehicle.id] ?? '').trim().toLowerCase();

            const statusFiltered = cachedDrivers
              ? statusFilter === 'all'
                ? cachedDrivers
                : cachedDrivers.filter((d) => d.status === statusFilter)
              : [];

            const filteredDrivers = searchTerm
              ? statusFiltered.filter((d) => {
                  const full = `${d.firstName} ${d.lastName} ${d.unit ?? ''}`.toLowerCase();
                  return full.includes(searchTerm);
                })
              : statusFiltered;

            return (
              <section key={vehicle.id} className="card flex flex-col overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                          {vehicle.name}
                        </h2>
                        {!vehicle.active && (
                          <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Außer Dienst
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {[vehicle.call_sign, vehicle.license_plate, vehicle.unit]
                          .filter(Boolean)
                          .join(' · ') || 'Keine Zusatzdaten'}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <a
                        href={api.urls.vehiclesPdf(vehicle.id)}
                        className="btn-secondary !min-h-[40px] !px-2.5 text-xs"
                        title="Fahrerliste als PDF"
                      >
                        <FileText className="h-4 w-4" />
                        <span>PDF</span>
                      </a>
                      {isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVehicle(vehicle);
                              setModalOpen(true);
                            }}
                            className="btn-secondary !min-h-[40px] !px-2.5"
                            aria-label="Fahrzeug bearbeiten"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteVehicle(vehicle)}
                            className="btn-secondary !min-h-[40px] !px-2.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/60"
                            aria-label="Fahrzeug löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      Klassen (ODER):{' '}
                      {vehicle.required_classes
                        .map((c) => LICENSE_CLASS_SHORT_LABELS[c])
                        .join(', ')}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {vehicle.is_automatic ? 'Automatikgetriebe' : 'Schaltgetriebe'}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {vehicle.counts.green} Bereit
                    </span>
                    <span className="rounded-md bg-amber-100 px-2.5 py-1 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {vehicle.counts.yellow} Warnung / Hinweis
                    </span>
                    <span className="rounded-md bg-red-100 px-2.5 py-1 text-red-800 dark:bg-red-950 dark:text-red-300">
                      {vehicle.counts.red} Gesperrt
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleVehicleExpand(vehicle.id)}
                    aria-expanded={isExpanded}
                    className="mt-4 flex min-h-[44px] w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span>
                      {isExpanded
                        ? `Fahrerliste einklappen (${vehicle.counts.total})`
                        : `Fahrerliste anzeigen (${vehicle.counts.total})`}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    )}
                  </button>
                </div>

                {/* Lazy-geladene Fahrerliste */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-800">
                    {cachedDrivers && cachedDrivers.length > 8 && (
                      <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="search"
                            value={driverSearch[vehicle.id] ?? ''}
                            onChange={(e) =>
                              setDriverSearch((prev) => ({
                                ...prev,
                                [vehicle.id]: e.target.value,
                              }))
                            }
                            placeholder="Fahrer suchen (Name, Einheit)…"
                            className="input-field !min-h-[38px] pl-9 text-xs"
                          />
                        </div>
                      </div>
                    )}

                    <div className="max-h-96 divide-y divide-slate-200 overflow-y-auto dark:divide-slate-800">
                      {isLoadingList || !cachedDrivers ? (
                        <div className="p-5 text-center text-xs text-slate-500 dark:text-slate-400">
                          Lade Fahrerliste…
                        </div>
                      ) : filteredDrivers.length === 0 ? (
                        <div className="p-5 text-center text-xs text-slate-500 dark:text-slate-400">
                          Keine Fahrer in dieser Kategorie.
                        </div>
                      ) : (
                        filteredDrivers.map((driver) => (
                          <div key={driver.memberId} className="px-5 py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <TrafficLightDot status={driver.status} />
                                  <Link
                                    to={`/members/${driver.memberId}`}
                                    className="font-semibold text-slate-900 hover:text-fire-600 dark:text-white dark:hover:text-fire-400"
                                  >
                                    {driver.lastName}, {driver.firstName}
                                  </Link>
                                  {driver.unit && (
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                      ({driver.unit})
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                                  {driver.reasons.join(' · ')}
                                </p>
                                <p className="mt-0.5 text-[11px] text-slate-400">
                                  Klasse:{' '}
                                  {driver.coveringClass
                                    ? LICENSE_CLASS_SHORT_LABELS[driver.coveringClass]
                                    : '–'}{' '}
                                  ({driver.directOrIncluded === 'direct' ? 'direkt' : 'eingeschlossen'})
                                  · Nächste Kontrolle: {formatDateDe(driver.nextInspectionDueAt)}
                                </p>
                              </div>

                              <TrafficLightBadge status={driver.status} compact />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <VehicleModal
        open={modalOpen}
        vehicle={editingVehicle}
        onClose={() => setModalOpen(false)}
        onSaved={() => void handleSavedVehicle()}
      />

      <ConfirmDialog
        open={deleteVehicle !== null}
        title="Fahrzeug löschen?"
        message={`Möchten Sie „${deleteVehicle?.name ?? ''}“ wirklich löschen?`}
        confirmLabel="Löschen"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteVehicle(null)}
      />
    </div>
  );
}
