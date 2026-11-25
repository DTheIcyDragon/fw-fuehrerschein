import React, { useEffect, useState } from 'react';
import { Truck, X } from 'lucide-react';
import type { EvaluatedVehicle, LicenseClass } from '@shared/types';
import {
  EU_LICENSE_CLASSES,
  FW_LICENSE_CLASSES,
  LICENSE_CLASS_LABELS,
  LICENSE_CLASS_SHORT_LABELS,
} from '@shared/licenseRules';
import { api, ApiError } from '../api';
import { useToast } from '../contexts/ToastContext';

interface VehicleModalProps {
  open: boolean;
  vehicle?: EvaluatedVehicle | null;
  onClose: () => void;
  onSaved: () => void;
}

export function VehicleModal({ open, vehicle, onClose, onSaved }: VehicleModalProps) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [callSign, setCallSign] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [unit, setUnit] = useState('');
  const [requiredClasses, setRequiredClasses] = useState<LicenseClass[]>(['B']);
  const [isAutomatic, setIsAutomatic] = useState(false);
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (vehicle) {
      setName(vehicle.name);
      setCallSign(vehicle.call_sign ?? '');
      setLicensePlate(vehicle.license_plate ?? '');
      setUnit(vehicle.unit ?? '');
      setRequiredClasses(
        vehicle.required_classes.length > 0 ? [...vehicle.required_classes] : ['B'],
      );
      setIsAutomatic(vehicle.is_automatic);
      setActive(vehicle.active);
      setNotes(vehicle.notes ?? '');
    } else {
      setName('');
      setCallSign('');
      setLicensePlate('');
      setUnit('');
      setRequiredClasses(['B']);
      setIsAutomatic(false);
      setActive(true);
      setNotes('');
    }
  }, [open, vehicle]);

  if (!open) return null;

  const toggleClass = (cls: LicenseClass) => {
    setRequiredClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Bitte einen Fahrzeugnamen eingeben.');
      return;
    }
    if (requiredClasses.length === 0) {
      setError('Bitte mindestens eine zulässige Führerscheinklasse auswählen.');
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      call_sign: callSign.trim() || null,
      license_plate: licensePlate.trim() || null,
      unit: unit.trim() || null,
      required_classes: requiredClasses,
      is_automatic: isAutomatic,
      active,
      notes: notes.trim() || null,
    };

    try {
      if (vehicle) {
        await api.updateVehicle(vehicle.id, payload);
        showToast('Fahrzeug aktualisiert.', 'success');
      } else {
        await api.createVehicle(payload);
        showToast('Fahrzeug angelegt.', 'success');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Fahrzeug konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Truck className="h-5 w-5 text-fire-600" />
            <h2 className="text-lg font-semibold">
              {vehicle ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug anlegen'}
            </h2>
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

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Fahrzeugbezeichnung *</label>
              <input
                type="text"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. HLF 20 / TSF-W / MTW"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Funkrufname</label>
              <input
                type="text"
                className="input-field"
                value={callSign}
                onChange={(e) => setCallSign(e.target.value)}
                placeholder="z. B. Florian Muster 44-1"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Kennzeichen</label>
              <input
                type="text"
                className="input-field"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value)}
                placeholder="z. B. AB-FW 112"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Einheit / Standort</label>
              <input
                type="text"
                className="input-field"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="z. B. Löschzug 1"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Getriebeart</label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setIsAutomatic(false)}
                className={`min-h-[44px] rounded-xl border px-3.5 py-2 text-left text-sm font-medium transition-colors ${
                  !isAutomatic
                    ? 'border-fire-500 bg-fire-50 text-fire-800 ring-2 ring-fire-500/20 dark:border-fire-500/80 dark:bg-fire-950/80 dark:text-fire-200'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Schaltgetriebe (Hinweis bei Schlüsselzahl 78)
              </button>
              <button
                type="button"
                onClick={() => setIsAutomatic(true)}
                className={`min-h-[44px] rounded-xl border px-3.5 py-2 text-left text-sm font-medium transition-colors ${
                  isAutomatic
                    ? 'border-fire-500 bg-fire-50 text-fire-800 ring-2 ring-fire-500/20 dark:border-fire-500/80 dark:bg-fire-950/80 dark:text-fire-200'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                Automatikgetriebe (auch mit SZ 78 fahrbar)
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Zulässige Führerscheinklassen (ODER-Auswahl) *
            </label>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
              Es genügt eine der markierten Klassen (z. B. C1 ODER FW 7,5t). Höhere einschließende
              Klassen werden automatisch berücksichtigt.
            </p>

            <div className="space-y-2.5">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Feuerwehrführerschein
                </p>
                <div className="flex flex-wrap gap-2">
                  {FW_LICENSE_CLASSES.map((cls) => {
                    const selected = requiredClasses.includes(cls);
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => toggleClass(cls)}
                        title={LICENSE_CLASS_LABELS[cls]}
                        className={`min-h-[44px] rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                          selected
                            ? 'border-fire-600 bg-fire-600 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {LICENSE_CLASS_LABELS[cls]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  EU-Klassen
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {EU_LICENSE_CLASSES.map((cls) => {
                    const selected = requiredClasses.includes(cls);
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => toggleClass(cls)}
                        title={LICENSE_CLASS_LABELS[cls]}
                        className={`min-h-[44px] min-w-[52px] rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition-colors ${
                          selected
                            ? 'border-fire-600 bg-fire-600 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {LICENSE_CLASS_SHORT_LABELS[cls]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            <span className="text-sm font-medium">Fahrzeug ist aktiv im Dienst</span>
          </label>

          <div>
            <label className="mb-1 block text-sm font-medium">Bemerkungen</label>
            <textarea
              rows={2}
              className="input-field min-h-[68px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="z. B. zulässige Gesamtmasse 7,49 t"
            />
          </div>
        </form>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={saving}
            onClick={(e) => void handleSubmit(e)}
          >
            {saving ? 'Speichert…' : 'Fahrzeug speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
