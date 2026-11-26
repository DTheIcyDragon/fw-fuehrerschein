import React, { useEffect, useState } from 'react';
import {
  Ban,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  History,
  Info,
  Shield,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  EvaluatedMember,
  LegacyLicensePreset,
  LicenseClass,
  Member,
  MemberLicense,
  MemberStatus,
} from '@shared/types';
import {
  ALL_LICENSE_CLASSES,
  EU_LICENSE_CLASSES,
  EXPIRING_CLASSES,
  FEDERAL_STATE_PRESETS,
  FW_LICENSE_CLASSES,
  INCLUDED_BY_CLASS,
  KEY_NUMBER_CATALOG,
  LEGACY_LICENSE_PRESETS,
  LICENSE_CLASS_LABELS,
  LICENSE_CLASS_SHORT_LABELS,
  addMonthsIso,
  getTodayIsoDate,
  isValidIsoDate,
} from '@shared/licenseRules';
import { api, ApiError } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface MemberModalProps {
  open: boolean;
  member?: Member | EvaluatedMember | null;
  onClose: () => void;
  onSaved: () => void;
}

type ModalTab = 'master' | 'licenses' | 'ban';

function emptyLicense(licenseClass: LicenseClass): MemberLicense {
  return {
    license_class: licenseClass,
    issued_at: null,
    expires_at: null,
    key_numbers: [],
    notes: null,
  };
}

export function MemberModal({ open, member, onClose, onSaved }: MemberModalProps) {
  const { showToast } = useToast();
  const { federalState, stateRules } = useAuth();
  const [tab, setTab] = useState<ModalTab>('master');
  const [fwInfoOpen, setFwInfoOpen] = useState(false);

  // Stammdaten
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [personnelNumber, setPersonnelNumber] = useState('');
  const [unit, setUnit] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<MemberStatus>('active');
  const [notes, setNotes] = useState('');

  // Karte & globale Schlüsselzahlen
  const [licenseNumber, setLicenseNumber] = useState('');
  const [cardIssuedAt, setCardIssuedAt] = useState('');
  const [cardExpiresAt, setCardExpiresAt] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [globalKeyNumbers, setGlobalKeyNumbers] = useState<string[]>([]);
  const [customKeyInput, setCustomKeyInput] = useState('');

  // Fahrverbot
  const [banActive, setBanActive] = useState(false);
  const [banFrom, setBanFrom] = useState('');
  const [banUntil, setBanUntil] = useState('');
  const [banReason, setBanReason] = useState('');

  // Klassen
  const [licensesMap, setLicensesMap] = useState<Partial<Record<LicenseClass, MemberLicense>>>({});
  const [classKeyDrafts, setClassKeyDrafts] = useState<Partial<Record<LicenseClass, string>>>({});
  const [autoIncludeClasses, setAutoIncludeClasses] = useState(true);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [legacyIssuedAt, setLegacyIssuedAt] = useState('');
  const [selectedOptionalClasses, setSelectedOptionalClasses] = useState<LicenseClass[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab('master');
    setError(null);
    setCustomKeyInput('');
    setClassKeyDrafts({});
    setAutoIncludeClasses(true);
    setSelectedPresetId(null);
    setLegacyIssuedAt('');
    setSelectedOptionalClasses([]);

    if (member) {
      setFirstName(member.first_name);
      setLastName(member.last_name);
      setPersonnelNumber(member.personnel_number ?? '');
      setUnit(member.unit ?? '');
      setEmail(member.email ?? '');
      setPhone(member.phone ?? '');
      setStatus(member.status);
      setNotes(member.notes ?? '');

      setLicenseNumber(member.license_number ?? '');
      setCardIssuedAt(member.card_issued_at ?? '');
      setCardExpiresAt(member.card_expires_at ?? '');
      setIssuingAuthority(member.issuing_authority ?? '');
      setGlobalKeyNumbers([...member.global_key_numbers]);

      setBanActive(member.ban_active);
      setBanFrom(member.ban_from ?? '');
      setBanUntil(member.ban_until ?? '');
      setBanReason(member.ban_reason ?? '');

      const map: Partial<Record<LicenseClass, MemberLicense>> = {};
      for (const lic of member.licenses) {
        map[lic.license_class] = { ...lic, key_numbers: [...lic.key_numbers] };
      }
      setLicensesMap(map);
    } else {
      setFirstName('');
      setLastName('');
      setPersonnelNumber('');
      setUnit('');
      setEmail('');
      setPhone('');
      setStatus('active');
      setNotes('');

      setLicenseNumber('');
      setCardIssuedAt('');
      setCardExpiresAt('');
      setIssuingAuthority('');
      setGlobalKeyNumbers([]);

      setBanActive(false);
      setBanFrom('');
      setBanUntil('');
      setBanReason('');

      setLicensesMap({});
    }
  }, [open, member]);

  if (!open) return null;

  const toggleGlobalKey = (code: string) => {
    setGlobalKeyNumbers((prev) =>
      prev.includes(code) ? prev.filter((k) => k !== code) : [...prev, code],
    );
  };

  const addCustomGlobalKey = () => {
    const clean = customKeyInput.trim();
    if (!clean) return;
    if (!globalKeyNumbers.includes(clean)) {
      setGlobalKeyNumbers((prev) => [...prev, clean]);
    }
    setCustomKeyInput('');
  };

  const toggleLicenseClass = (cls: LicenseClass) => {
    setLicensesMap((prev) => {
      const next = { ...prev };
      if (next[cls]) {
        delete next[cls];
      } else {
        next[cls] = emptyLicense(cls);
        if (autoIncludeClasses) {
          for (const sub of INCLUDED_BY_CLASS[cls] ?? []) {
            if (!next[sub]) {
              next[sub] = emptyLicense(sub);
            }
          }
        }
      }
      return next;
    });
  };

  const applyLegacyPreset = (preset: LegacyLicensePreset) => {
    setLicensesMap((prev) => {
      const next = { ...prev };
      const applyClass = (cls: LicenseClass, extraKeys: string[] = []) => {
        const existing = next[cls] ?? emptyLicense(cls);
        const mergedKeys = Array.from(new Set([...existing.key_numbers, ...extraKeys]));
        next[cls] = {
          ...existing,
          issued_at: legacyIssuedAt || existing.issued_at,
          key_numbers: mergedKeys,
          notes: existing.notes || preset.defaultNote,
        };
      };

      for (const cls of preset.mappedClasses) {
        applyClass(cls);
      }
      for (const opt of preset.optionalClasses ?? []) {
        if (selectedOptionalClasses.includes(opt.license_class)) {
          applyClass(opt.license_class, opt.key_numbers);
        }
      }
      return next;
    });
    showToast(`Klassen für „${preset.shortLabel}“ übernommen.`, 'success');
  };

  const copyDatesToIncluded = (sourceCls: LicenseClass, activeSubClasses: LicenseClass[]) => {
    const source = licensesMap[sourceCls];
    if (!source || activeSubClasses.length === 0) return;
    setLicensesMap((prev) => {
      const next = { ...prev };
      for (const sub of activeSubClasses) {
        const target = next[sub];
        if (!target) continue;
        next[sub] = {
          ...target,
          issued_at: source.issued_at ?? target.issued_at,
          expires_at: EXPIRING_CLASSES.includes(sub)
            ? (source.expires_at ?? target.expires_at)
            : target.expires_at,
        };
      }
      return next;
    });
    showToast(
      `Datum auf eingeschlossene Klassen (${activeSubClasses.map((c) => LICENSE_CLASS_SHORT_LABELS[c]).join(', ')}) übernommen.`,
      'success',
    );
  };

  const addFiveYears = (cls: LicenseClass) => {
    const lic = licensesMap[cls];
    if (!lic) return;
    const base = isValidIsoDate(lic.expires_at)
      ? lic.expires_at
      : isValidIsoDate(lic.issued_at)
        ? lic.issued_at
        : getTodayIsoDate();
    updateLicenseField(cls, 'expires_at', addMonthsIso(base, 60));
  };

  const updateLicenseField = <K extends keyof MemberLicense>(
    cls: LicenseClass,
    field: K,
    value: MemberLicense[K],
  ) => {
    setLicensesMap((prev) => {
      const existing = prev[cls];
      if (!existing) return prev;
      return {
        ...prev,
        [cls]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  const toggleClassKey = (cls: LicenseClass, code: string) => {
    const existing = licensesMap[cls];
    if (!existing) return;
    const keys = existing.key_numbers.includes(code)
      ? existing.key_numbers.filter((k) => k !== code)
      : [...existing.key_numbers, code];
    updateLicenseField(cls, 'key_numbers', keys);
  };

  const addCustomClassKey = (cls: LicenseClass) => {
    const val = (classKeyDrafts[cls] ?? '').trim();
    const existing = licensesMap[cls];
    if (!val || !existing) return;
    if (!existing.key_numbers.includes(val)) {
      updateLicenseField(cls, 'key_numbers', [...existing.key_numbers, val]);
    }
    setClassKeyDrafts((prev) => ({ ...prev, [cls]: '' }));
  };

  const selectedClasses = ALL_LICENSE_CLASSES.filter((cls) => Boolean(licensesMap[cls]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError('Vorname und Nachname sind Pflichtfelder.');
      setTab('master');
      return;
    }

    const licenses: MemberLicense[] = selectedClasses.map((cls) => {
      const l = licensesMap[cls]!;
      return {
        license_class: cls,
        issued_at: l.issued_at || null,
        expires_at: l.expires_at || null,
        key_numbers: l.key_numbers,
        notes: l.notes?.trim() || null,
      };
    });

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      personnel_number: personnelNumber.trim() || null,
      unit: unit.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      status,
      license_number: licenseNumber.trim() || null,
      card_issued_at: cardIssuedAt || null,
      card_expires_at: cardExpiresAt || null,
      issuing_authority: issuingAuthority.trim() || null,
      global_key_numbers: globalKeyNumbers,
      ban_active: banActive,
      ban_from: banFrom || null,
      ban_until: banUntil || null,
      ban_reason: banReason.trim() || null,
      notes: notes.trim() || null,
      licenses,
    };

    setSaving(true);
    try {
      if (member) {
        await api.updateMember(member.id, payload);
        showToast('Kamerad aktualisiert.', 'success');
      } else {
        await api.createMember(payload);
        showToast('Kamerad angelegt.', 'success');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <UserPlus className="h-5 w-5 text-fire-600" />
            <h2 className="text-lg font-semibold">
              {member ? `${member.first_name} ${member.last_name} bearbeiten` : 'Neuen Kameraden anlegen'}
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

        {/* Tabs */}
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 px-5 pt-2 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setTab('master')}
            className={`flex min-h-[44px] shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === 'master'
                ? 'border-fire-600 text-fire-600 dark:text-fire-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Stammdaten & Karte
          </button>
          <button
            type="button"
            onClick={() => setTab('licenses')}
            className={`flex min-h-[44px] shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === 'licenses'
                ? 'border-fire-600 text-fire-600 dark:text-fire-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Shield className="h-4 w-4" />
            Klassen ({selectedClasses.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('ban')}
            className={`flex min-h-[44px] shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === 'ban'
                ? 'border-fire-600 text-fire-600 dark:text-fire-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <Ban className="h-4 w-4" />
            Fahrverbot {banActive && <span className="h-2 w-2 rounded-full bg-red-600" />}
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
              {error}
            </div>
          )}

          {tab === 'master' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Vorname *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Nachname *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Personalnummer</label>
                  <input
                    type="text"
                    className="input-field"
                    value={personnelNumber}
                    onChange={(e) => setPersonnelNumber(e.target.value)}
                    placeholder="z. B. FW-042"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Einheit / Löschgruppe</label>
                  <input
                    type="text"
                    className="input-field"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="z. B. Löschzug 1"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Status</label>
                  <select
                    className="input-field"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MemberStatus)}
                  >
                    <option value="active">Aktiv</option>
                    <option value="inactive">Inaktiv / Beurlaubt</option>
                    <option value="archived">Archiviert</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">E-Mail (für Erinnerungen)</label>
                  <input
                    type="email"
                    className="input-field"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="kamerad@feuerwehr.de"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Telefon / Mobil</label>
                  <input
                    type="tel"
                    className="input-field"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <hr className="border-slate-200 dark:border-slate-800" />

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Führerscheinkarte (Dokument)
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Führerscheinnummer</label>
                    <input
                      type="text"
                      className="input-field"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Ausstellende Behörde</label>
                    <input
                      type="text"
                      className="input-field"
                      value={issuingAuthority}
                      onChange={(e) => setIssuingAuthority(e.target.value)}
                      placeholder="z. B. Landkreis Muster"
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Ausstellungsdatum (4a)</label>
                    <input
                      type="date"
                      className="input-field"
                      value={cardIssuedAt}
                      onChange={(e) => setCardIssuedAt(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">Karten-Ablaufdatum (4b)</label>
                    <input
                      type="date"
                      className="input-field"
                      value={cardExpiresAt}
                      onChange={(e) => setCardExpiresAt(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Globale Schlüsselzahlen / Auflagen (Feld 12)
                </label>
                <div className="flex flex-wrap gap-2">
                  {KEY_NUMBER_CATALOG.map((item) => {
                    const active = globalKeyNumbers.includes(item.code);
                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => toggleGlobalKey(item.code)}
                        title={item.label}
                        className={`min-h-[38px] rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                          active
                            ? 'border-fire-600 bg-fire-600 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2.5 flex gap-2">
                  <input
                    type="text"
                    className="input-field max-w-xs"
                    value={customKeyInput}
                    onChange={(e) => setCustomKeyInput(e.target.value)}
                    placeholder="Weitere Schlüsselzahl (z. B. 104)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomGlobalKey();
                      }
                    }}
                  />
                  <button type="button" className="btn-secondary" onClick={addCustomGlobalKey}>
                    Hinzufügen
                  </button>
                </div>
                {globalKeyNumbers.filter((k) => !KEY_NUMBER_CATALOG.some((c) => c.code === k))
                  .length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {globalKeyNumbers
                      .filter((k) => !KEY_NUMBER_CATALOG.some((c) => c.code === k))
                      .map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => toggleGlobalKey(code)}
                          className="inline-flex items-center gap-1 rounded-md bg-slate-200 px-2 py-1 text-xs font-medium text-slate-800 dark:bg-slate-700 dark:text-slate-200"
                        >
                          SZ {code} ×
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Allgemeine Notizen</label>
                <textarea
                  rows={2}
                  className="input-field min-h-[68px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {tab === 'licenses' && (
            <div className="space-y-5">
              {/* Automatisches Einschließen & Hinweis */}
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                <label className="flex min-h-[40px] cursor-pointer items-center gap-2.5 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
                    checked={autoIncludeClasses}
                    onChange={(e) => setAutoIncludeClasses(e.target.checked)}
                  />
                  <span>
                    Eingeschlossene Klassen automatisch mit auswählen (z. B. B → AM, L)
                  </span>
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Hinweis: Erteilungs- und Ablaufdatum je Klasse sind optional – ein leeres
                  Ablaufdatum bedeutet <strong>unbefristet gültig</strong>.
                </p>
              </div>

              {/* Alte Führerscheinklassen (vor 1999) */}
              <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="mb-2 flex items-center gap-2">
                  <History className="h-4 w-4 text-fire-600" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Alte Führerscheinklassen (vor 1999) – Umrechnungshilfe
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {LEGACY_LICENSE_PRESETS.map((preset) => {
                    const isSelected = selectedPresetId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setSelectedPresetId(isSelected ? null : preset.id);
                          setSelectedOptionalClasses([]);
                        }}
                        className={`min-h-[38px] rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                          isSelected
                            ? 'border-fire-600 bg-fire-50 text-fire-900 dark:border-fire-500/80 dark:bg-fire-950/80 dark:text-fire-200'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {preset.shortLabel}
                      </button>
                    );
                  })}
                </div>

                {(() => {
                  const activePreset = LEGACY_LICENSE_PRESETS.find((p) => p.id === selectedPresetId);
                  if (!activePreset) return null;
                  return (
                    <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-700 dark:bg-slate-800/60">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {activePreset.label}
                        </p>
                        <p className="mt-0.5 text-slate-600 dark:text-slate-300">
                          {activePreset.summary}
                        </p>
                      </div>

                      <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                        {activePreset.specialNotes.map((note, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fire-600" />
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>

                      {activePreset.optionalClasses && activePreset.optionalClasses.length > 0 && (
                        <div className="space-y-1.5">
                          {activePreset.optionalClasses.map((opt) => {
                            const checked = selectedOptionalClasses.includes(opt.license_class);
                            return (
                              <label
                                key={opt.license_class}
                                className="flex cursor-pointer items-center gap-2 font-medium text-slate-800 dark:text-slate-200"
                              >
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
                                  checked={checked}
                                  onChange={() =>
                                    setSelectedOptionalClasses((prev) =>
                                      checked
                                        ? prev.filter((c) => c !== opt.license_class)
                                        : [...prev, opt.license_class],
                                    )
                                  }
                                />
                                <span>{opt.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-end">
                        <div className="sm:w-52">
                          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                            Erteilungsdatum (optional)
                          </label>
                          <input
                            type="date"
                            className="input-field !min-h-[38px] text-xs"
                            value={legacyIssuedAt}
                            onChange={(e) => setLegacyIssuedAt(e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => applyLegacyPreset(activePreset)}
                          className="btn-primary !min-h-[38px] text-xs"
                        >
                          <Check className="h-4 w-4" />
                          <span>Zugehörige EU-Klassen übernehmen</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Feuerwehrführerschein (Sonderfahrberechtigung)
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {FEDERAL_STATE_PRESETS[federalState].name} ·{' '}
                      {FEDERAL_STATE_PRESETS[federalState].regulationName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFwInfoOpen((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Info className="h-3.5 w-3.5 text-fire-600" />
                    <span>Voraussetzungen</span>
                    {fwInfoOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {fwInfoOpen && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                    <p className="font-semibold text-slate-800 dark:text-white">
                      {FEDERAL_STATE_PRESETS[federalState].regulationName}
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {FEDERAL_STATE_PRESETS[federalState].highlights.map((h, i) => (
                        <li key={i}>• {h}</li>
                      ))}
                    </ul>
                    {stateRules.custom_rules_notes.trim() && (
                      <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">
                          Dienstanweisung vor Ort:
                        </p>
                        <p className="whitespace-pre-wrap">{stateRules.custom_rules_notes}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {FW_LICENSE_CLASSES.map((cls) => {
                    const active = Boolean(licensesMap[cls]);
                    const disabledByState =
                      (cls === 'FW_475' && !stateRules.fw_475_enabled) ||
                      (cls === 'FW_750' && !stateRules.fw_750_enabled);
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => toggleLicenseClass(cls)}
                        className={`min-h-[44px] rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors ${
                          active
                            ? 'border-fire-600 bg-fire-600 text-white'
                            : disabledByState
                              ? 'border-amber-300 bg-amber-50/70 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <span>{LICENSE_CLASS_LABELS[cls]}</span>
                        {disabledByState && (
                          <span className="ml-2 rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-950 dark:bg-amber-900 dark:text-amber-100">
                            in Landesregeln deaktiviert
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  EU-Führerscheinklassen antippen zum Hinzufügen / Entfernen
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {EU_LICENSE_CLASSES.map((cls) => {
                    const active = Boolean(licensesMap[cls]);
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => toggleLicenseClass(cls)}
                        title={LICENSE_CLASS_LABELS[cls]}
                        className={`min-h-[44px] min-w-[52px] rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition-colors ${
                          active
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

              {selectedClasses.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Noch keine Führerscheinklasse ausgewählt. Wählen Sie oben die vorhandenen Klassen aus.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedClasses.map((cls) => {
                    const lic = licensesMap[cls]!;
                    const activeIncluded = (INCLUDED_BY_CLASS[cls] ?? []).filter((sub) =>
                      Boolean(licensesMap[sub]),
                    );
                    const isExpiringClass = EXPIRING_CLASSES.includes(cls);
                    return (
                      <div
                        key={cls}
                        className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {LICENSE_CLASS_LABELS[cls]}
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            {activeIncluded.length > 0 && (
                              <button
                                type="button"
                                onClick={() => copyDatesToIncluded(cls, activeIncluded)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <Copy className="h-3 w-3" />
                                <span>
                                  Datum auf eingeschlossene (
                                  {activeIncluded
                                    .map((c) => LICENSE_CLASS_SHORT_LABELS[c])
                                    .join(', ')}
                                  ) übernehmen
                                </span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleLicenseClass(cls)}
                              className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                            >
                              Klasse entfernen
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                              Erteilt am (Spalte 10, optional)
                            </label>
                            <input
                              type="date"
                              className="input-field"
                              value={lic.issued_at ?? ''}
                              onChange={(e) =>
                                updateLicenseField(cls, 'issued_at', e.target.value || null)
                              }
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                              Gültig bis / Ablauf (Spalte 11, leer = unbefristet)
                            </label>
                            <div className="flex gap-1.5">
                              <input
                                type="date"
                                className="input-field"
                                value={lic.expires_at ?? ''}
                                onChange={(e) =>
                                  updateLicenseField(cls, 'expires_at', e.target.value || null)
                                }
                              />
                              {isExpiringClass && (
                                <button
                                  type="button"
                                  onClick={() => addFiveYears(cls)}
                                  title="Ablaufdatum um 5 Jahre verlängern"
                                  className="btn-secondary shrink-0 !px-2.5 text-xs"
                                >
                                  <CalendarPlus className="h-3.5 w-3.5" />
                                  <span>+5 Jahre</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                            Klassen-Schlüsselzahlen (z. B. 78 für Automatik)
                          </label>
                          <div className="flex flex-wrap gap-1.5">
                            {KEY_NUMBER_CATALOG.map((item) => {
                              const hasKey = lic.key_numbers.includes(item.code);
                              return (
                                <button
                                  key={item.code}
                                  type="button"
                                  onClick={() => toggleClassKey(cls, item.code)}
                                  title={item.label}
                                  className={`rounded-md border px-2 py-1 text-xs font-medium ${
                                    hasKey
                                      ? 'border-fire-600 bg-fire-600 text-white'
                                      : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                                  }`}
                                >
                                  SZ {item.code}
                                </button>
                              );
                            })}
                            {lic.key_numbers
                              .filter((k) => !KEY_NUMBER_CATALOG.some((c) => c.code === k))
                              .map((custom) => (
                                <button
                                  key={custom}
                                  type="button"
                                  onClick={() => toggleClassKey(cls, custom)}
                                  className="rounded-md border border-fire-600 bg-fire-600 px-2 py-1 text-xs font-medium text-white"
                                >
                                  SZ {custom} ×
                                </button>
                              ))}
                          </div>

                          <div className="mt-2 flex gap-2">
                            <input
                              type="text"
                              className="input-field !min-h-[38px] max-w-[200px] text-xs"
                              placeholder="Eigene SZ…"
                              value={classKeyDrafts[cls] ?? ''}
                              onChange={(e) =>
                                setClassKeyDrafts((prev) => ({ ...prev, [cls]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addCustomClassKey(cls);
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => addCustomClassKey(cls)}
                              className="btn-secondary !min-h-[38px] !px-3 !py-1 text-xs"
                            >
                              + SZ
                            </button>
                          </div>
                        </div>

                        <div className="mt-3">
                          <input
                            type="text"
                            className="input-field !min-h-[38px] text-xs"
                            placeholder="Bemerkung zu dieser Klasse (optional)"
                            value={lic.notes ?? ''}
                            onChange={(e) =>
                              updateLicenseField(cls, 'notes', e.target.value || null)
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'ban' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                Ein aktives Fahrverbot bzw. eine interne Fahrsperre setzt die Ampel des Kameraden
                sofort auf <strong>Rot (Gesperrt)</strong> – sowohl in der Übersicht als auch auf
                allen Fahrzeug-Fahrerlisten.
              </div>

              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                <input
                  type="checkbox"
                  className="h-5 w-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  checked={banActive}
                  onChange={(e) => setBanActive(e.target.checked)}
                />
                <div>
                  <span className="block text-sm font-semibold text-red-700 dark:text-red-400">
                    Fahrverbot / Fahrsperre aktivieren
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Gilt sofort oder im angegebenen Zeitraum
                  </span>
                </div>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Gültig ab (optional)</label>
                  <input
                    type="date"
                    className="input-field"
                    value={banFrom}
                    onChange={(e) => setBanFrom(e.target.value)}
                    disabled={!banActive}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Gültig bis (optional)</label>
                  <input
                    type="date"
                    className="input-field"
                    value={banUntil}
                    onChange={(e) => setBanUntil(e.target.value)}
                    disabled={!banActive}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Grund / Bemerkung</label>
                <textarea
                  rows={3}
                  className="input-field min-h-[84px]"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  disabled={!banActive}
                  placeholder="z. B. Behördliches Fahrverbot / Führerschein in Verwahrung / Interne Sperre"
                />
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={saving}
            onClick={(e) => void handleSubmit(e)}
          >
            {saving ? 'Speichert…' : 'Änderungen speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
