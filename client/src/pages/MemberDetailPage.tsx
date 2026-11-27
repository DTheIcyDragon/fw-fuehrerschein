import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  ClipboardCheck,
  CreditCard,
  Edit3,
  Save,
  Shield,
  Trash2,
  Truck,
} from 'lucide-react';
import type {
  EvaluatedMember,
  Inspection,
  MemberStatus,
  MemberVehicleSummary,
} from '@shared/types';
import {
  formatDateDe,
  KEY_NUMBER_CATALOG,
  LICENSE_CLASS_LABELS,
  LICENSE_CLASS_SHORT_LABELS,
} from '@shared/licenseRules';
import { api, ApiError } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { InspectionModal } from '../components/InspectionModal';
import { MemberModal } from '../components/MemberModal';
import { ModalShell } from '../components/ModalShell';
import { TrafficLightBadge } from '../components/TrafficLightBadge';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const STATUS_LABELS: Record<MemberStatus, string> = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
  archived: 'Archiviert',
};

export function MemberDetailPage() {
  const { id } = useParams();
  const memberId = Number(id);
  const navigate = useNavigate();
  const { isAdmin, canEditMembers, canInspect } = useAuth();
  const { showToast } = useToast();

  const [member, setMember] = useState<EvaluatedMember | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [eligibleVehicles, setEligibleVehicles] = useState<MemberVehicleSummary[]>([]);
  const [briefedIds, setBriefedIds] = useState<number[]>([]);
  const [savingBriefings, setSavingBriefings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [deleteMemberConfirm, setDeleteMemberConfirm] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Inspection | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!Number.isFinite(memberId) || memberId <= 0) {
      setError('Ungültige Kameraden-ID.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [m, insp, veh] = await Promise.all([
        api.getMember(memberId),
        api.listInspections({ memberId }),
        api.getMemberVehicles(memberId),
      ]);
      setMember(m);
      setInspections(insp);
      setEligibleVehicles(veh);
      setBriefedIds(m.briefed_vehicle_ids ?? []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleDeleteMember = async () => {
    if (!member) return;
    setDeleting(true);
    try {
      await api.deleteMember(member.id);
      showToast('Kamerad gelöscht.', 'success');
      navigate('/members');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Löschen fehlgeschlagen.', 'error');
      setDeleting(false);
    }
  };

  const handleCancelInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget || !cancelReason.trim()) return;
    setDeleting(true);
    try {
      await api.cancelInspection(cancelTarget.id, cancelReason.trim());
      showToast('Kontrolleintrag storniert.', 'success');
      setCancelTarget(null);
      setCancelReason('');
      await loadDetail();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Stornierung fehlgeschlagen.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const toggleBriefing = (vehicleId: number) => {
    setBriefedIds((prev) =>
      prev.includes(vehicleId) ? prev.filter((id) => id !== vehicleId) : [...prev, vehicleId],
    );
  };

  const handleSaveBriefings = async () => {
    if (!member) return;
    setSavingBriefings(true);
    try {
      await api.updateMemberBriefings(member.id, briefedIds);
      showToast('Fahrzeug-Einweisungen gespeichert.', 'success');
      await loadDetail();
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Einweisungen konnten nicht gespeichert werden.',
        'error',
      );
    } finally {
      setSavingBriefings(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-sm text-slate-500">Lade Kameradendaten…</div>;
  }

  if (error || !member) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error ?? 'Kamerad nicht gefunden.'}</p>
        <Link to="/members" className="btn-secondary mt-4">
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  const briefingsChanged =
    JSON.stringify([...briefedIds].sort((a, b) => a - b)) !==
    JSON.stringify([...(member.briefed_vehicle_ids ?? [])].sort((a, b) => a - b));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/members"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-fire-600 dark:text-slate-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Zurück zu Kameraden
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {member.first_name} {member.last_name}
            </h1>
            <TrafficLightBadge status={member.evaluation.overallStatus} />
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {STATUS_LABELS[member.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {[
              member.unit,
              member.personnel_number ? `Personalnummer: ${member.personnel_number}` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Keine Einheit hinterlegt'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canInspect && (
            <button type="button" className="btn-primary" onClick={() => setInspectOpen(true)}>
              <ClipboardCheck className="h-4 w-4" />
              <span>Kontrolle erfassen</span>
            </button>
          )}
          {canEditMembers && (
            <button type="button" className="btn-secondary" onClick={() => setEditOpen(true)}>
              <Edit3 className="h-4 w-4" />
              <span>Bearbeiten</span>
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className="btn-secondary text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
              onClick={() => setDeleteMemberConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
              <span>Löschen</span>
            </button>
          )}
        </div>
      </div>

      {/* Fahrverbot Banner */}
      {member.evaluation.banCurrentlyActive && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950/70 dark:text-red-100">
          <Ban className="mt-0.5 h-6 w-6 shrink-0 text-red-600 dark:text-red-400" />
          <div>
            <h2 className="font-bold">Aktives Fahrverbot / Fahrsperre</h2>
            <p className="mt-0.5 text-sm">
              {member.ban_reason ||
                'Fahrverbot aktiv — Kamerad darf aktuell keine Einsatzfahrzeuge führen.'}
            </p>
            {(member.ban_from || member.ban_until) && (
              <p className="mt-1 text-xs opacity-80">
                Zeitraum: {member.ban_from ? `ab ${formatDateDe(member.ban_from)}` : 'sofort'}{' '}
                {member.ban_until ? `bis ${formatDateDe(member.ban_until)}` : '(unbefristet)'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Hinweise / Bewertung */}
      {member.evaluation.reasons.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Aktuelle Bewertung & Hinweise
          </h2>
          <ul className="mt-2.5 space-y-1.5 text-sm">
            {member.evaluation.reasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fire-600" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stammdaten & Karte */}
        <section className="card p-5">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-fire-600" />
            <h2 className="text-base font-semibold">Stammdaten & Führerscheinkarte</h2>
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Geburtsdatum</dt>
              <dd className="font-medium">{formatDateDe(member.birth_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">E-Mail</dt>
              <dd className="font-medium">{member.email || '–'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Telefon</dt>
              <dd className="font-medium">{member.phone || '–'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Führerscheinnummer</dt>
              <dd className="font-mono font-medium">{member.license_number || '–'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Ausstellende Behörde</dt>
              <dd className="font-medium">{member.issuing_authority || '–'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                Ausstellungsdatum (4a)
              </dt>
              <dd className="font-medium">{formatDateDe(member.card_issued_at)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                Karten-Ablaufdatum (4b)
              </dt>
              <dd className="flex items-center gap-2 font-medium">
                <span>{formatDateDe(member.card_expires_at)}</span>
                {member.card_expires_at && (
                  <TrafficLightBadge status={member.evaluation.cardStatus} compact />
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">Globale Schlüsselzahlen</p>
            {member.global_key_numbers.length === 0 ? (
              <p className="mt-1 text-sm text-slate-400">Keine eingetragen</p>
            ) : (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {member.global_key_numbers.map((code) => {
                  const found = KEY_NUMBER_CATALOG.find((k) => k.code === code);
                  return (
                    <span
                      key={code}
                      title={found?.label ?? `Schlüsselzahl ${code}`}
                      className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {found ? found.label : `SZ ${code}`}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {member.notes && (
            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Notizen</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{member.notes}</p>
            </div>
          )}
        </section>

        {/* Berechtigte Fahrzeuge & Einweisungen */}
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-fire-600" />
              <h2 className="text-base font-semibold">Berechtigte Fahrzeuge & Einweisungen</h2>
            </div>
            {canEditMembers && briefingsChanged && (
              <button
                type="button"
                className="btn-primary !min-h-[36px] !px-3 text-xs"
                onClick={() => void handleSaveBriefings()}
                disabled={savingBriefings}
              >
                <Save className="h-3.5 w-3.5" />
                <span>{savingBriefings ? 'Speichert…' : 'Einweisungen speichern'}</span>
              </button>
            )}
          </div>

          {eligibleVehicles.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {member.status !== 'active'
                ? 'Nur aktive Kameraden werden in Fahrzeug-Fahrerlisten geführt.'
                : 'Keine passenden Führerscheinklassen für aktive Fahrzeuge vorhanden.'}
            </p>
          ) : (
            <div className="space-y-2.5">
              {eligibleVehicles.map((entry) => {
                const checked = briefedIds.includes(entry.vehicleId);
                return (
                  <div
                    key={entry.vehicleId}
                    className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {entry.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {entry.call_sign || entry.license_plate || 'Ohne Funkrufname'} ·{' '}
                          {entry.is_automatic ? 'Automatik' : 'Schaltgetriebe'}
                        </p>
                      </div>
                      <TrafficLightBadge status={entry.status} compact />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">
                      {entry.reasons.join(' · ')}
                    </p>
                    {canEditMembers && (
                      <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
                          checked={checked}
                          onChange={() => toggleBriefing(entry.vehicleId)}
                        />
                        <span>
                          Auf Fahrzeug eingewiesen{' '}
                          {entry.requires_briefing ? '(erforderlich)' : '(optional)'}
                        </span>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Führerscheinklassen */}
      <section className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-fire-600" />
          <h2 className="text-base font-semibold">Führerscheinklassen</h2>
        </div>

        {member.evaluation.licenses.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Noch keine Führerscheinklassen hinterlegt.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {member.evaluation.licenses.map((lic) => (
              <div
                key={lic.license_class}
                className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{LICENSE_CLASS_SHORT_LABELS[lic.license_class]}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {LICENSE_CLASS_LABELS[lic.license_class]}
                    </p>
                  </div>
                  <TrafficLightBadge status={lic.status} compact />
                </div>
                <div className="mt-2.5 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                  <div>Erteilt: {formatDateDe(lic.issued_at)}</div>
                  <div>Ablauf: {lic.expires_at ? formatDateDe(lic.expires_at) : 'Unbefristet'}</div>
                  {lic.key_numbers.length > 0 && (
                    <div>Schlüsselzahlen: {lic.key_numbers.join(', ')}</div>
                  )}
                  {lic.notes && <div className="italic">{lic.notes}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {member.evaluation.validCoveredClasses.length > 0 && (
          <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Gültig abgedeckte Klassen (inkl. automatischer Einschlussregeln):
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {member.evaluation.validCoveredClasses.map((cls) => (
                <span
                  key={cls}
                  className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                >
                  {LICENSE_CLASS_SHORT_LABELS[cls]}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Kontroll-Historie */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-base font-semibold">Kontroll-Historie</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {member.evaluation.inspection.reason}
            </p>
          </div>
          <TrafficLightBadge status={member.evaluation.inspection.status} compact />
        </div>

        {inspections.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Noch keine Führerscheinkontrolle dokumentiert.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Datum</th>
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
      </section>

      <MemberModal
        open={editOpen}
        member={member}
        onClose={() => setEditOpen(false)}
        onSaved={() => void loadDetail()}
      />

      <InspectionModal
        open={inspectOpen}
        members={[member]}
        initialMemberId={member.id}
        onClose={() => setInspectOpen(false)}
        onSaved={() => void loadDetail()}
      />

      <ConfirmDialog
        open={deleteMemberConfirm}
        title="Kameraden löschen?"
        message={`Möchten Sie ${member.first_name} ${member.last_name} inklusive aller Führerscheindaten und Kontrollen unwiderruflich löschen? Alternativ können Sie den Status auf „Archiviert“ setzen.`}
        confirmLabel="Unwiderruflich löschen"
        loading={deleting}
        onConfirm={() => void handleDeleteMember()}
        onCancel={() => setDeleteMemberConfirm(false)}
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
              disabled={deleting}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              form="detail-cancel-inspection-form"
              className="btn-danger"
              disabled={deleting || !cancelReason.trim()}
            >
              {deleting ? 'Storniert…' : 'Verbindlich stornieren'}
            </button>
          </>
        }
      >
        <form
          id="detail-cancel-inspection-form"
          onSubmit={handleCancelInspection}
          className="space-y-4"
        >
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
