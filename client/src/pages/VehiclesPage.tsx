import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Edit3, FileText, Plus, Trash2, Truck } from 'lucide-react';
import type { EvaluatedVehicle, TrafficLight } from '@shared/types';
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

  const [modalOpen, setModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<EvaluatedVehicle | null>(null);
  const [deleteVehicle, setDeleteVehicle] = useState<EvaluatedVehicle | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.listVehicles();
      setVehicles(list);
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Fahrzeuge konnten nicht geladen werden.',
        'error',
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  const handleDelete = async () => {
    if (!deleteVehicle) return;
    setDeleting(true);
    try {
      await api.deleteVehicle(deleteVehicle.id);
      showToast('Fahrzeug gelöscht.', 'success');
      setDeleteVehicle(null);
      await loadVehicles();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Löschen fehlgeschlagen.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const visibleVehicles = vehicles.filter((v) => (showInactive ? true : v.active));

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
              className={`min-h-[40px] rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                statusFilter === f.id
                  ? 'border-fire-600 bg-fire-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

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
        <div className="grid gap-5 lg:grid-cols-2">
          {visibleVehicles.map((vehicle) => {
            const filteredDrivers =
              statusFilter === 'all'
                ? vehicle.drivers
                : vehicle.drivers.filter((d) => d.status === statusFilter);

            return (
              <section key={vehicle.id} className="card flex flex-col overflow-hidden">
                <div className="border-b border-slate-200 p-5 dark:border-slate-800">
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
                </div>

                {/* Fahrerliste */}
                <div className="max-h-96 flex-1 divide-y divide-slate-200 overflow-y-auto dark:divide-slate-800">
                  {filteredDrivers.length === 0 ? (
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
              </section>
            );
          })}
        </div>
      )}

      <VehicleModal
        open={modalOpen}
        vehicle={editingVehicle}
        onClose={() => setModalOpen(false)}
        onSaved={() => void loadVehicles()}
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
