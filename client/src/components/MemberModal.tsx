import React, { useEffect, useState } from 'react';
import { Ban, CreditCard, Shield, UserPlus } from 'lucide-react';
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
  EXPIRING_CLASSES,
  INCLUDED_BY_CLASS,
  LICENSE_CLASS_SHORT_LABELS,
  addMonthsIso,
  getTodayIsoDate,
  isValidIsoDate,
} from '@shared/licenseRules';
import { api, ApiError } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ModalShell } from './ModalShell';
import { MemberBanTab } from './member/MemberBanTab';
import { MemberLicensesTab } from './member/MemberLicensesTab';
import { MemberMasterTab } from './member/MemberMasterTab';

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
  const [birthDate, setBirthDate] = useState('');
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
    setFwInfoOpen(false);
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
      setBirthDate(member.birth_date ?? '');
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
      setBirthDate('');
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
      birth_date: birthDate || null,
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
    <ModalShell
      open={open}
      onClose={onClose}
      title={
        member ? `${member.first_name} ${member.last_name} bearbeiten` : 'Neuen Kameraden anlegen'
      }
      icon={<UserPlus className="h-5 w-5 text-fire-600" />}
      maxWidthClass="max-w-3xl"
      tabs={
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-5 pt-2 dark:border-slate-800">
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
      }
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button type="submit" form="member-modal-form" className="btn-primary" disabled={saving}>
            {saving ? 'Speichert…' : 'Änderungen speichern'}
          </button>
        </>
      }
    >
      <form id="member-modal-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
            {error}
          </div>
        )}

        {tab === 'master' && (
          <MemberMasterTab
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            personnelNumber={personnelNumber}
            setPersonnelNumber={setPersonnelNumber}
            birthDate={birthDate}
            setBirthDate={setBirthDate}
            unit={unit}
            setUnit={setUnit}
            email={email}
            setEmail={setEmail}
            phone={phone}
            setPhone={setPhone}
            status={status}
            setStatus={setStatus}
            licenseNumber={licenseNumber}
            setLicenseNumber={setLicenseNumber}
            cardIssuedAt={cardIssuedAt}
            setCardIssuedAt={setCardIssuedAt}
            cardExpiresAt={cardExpiresAt}
            setCardExpiresAt={setCardExpiresAt}
            issuingAuthority={issuingAuthority}
            setIssuingAuthority={setIssuingAuthority}
            globalKeyNumbers={globalKeyNumbers}
            toggleGlobalKey={toggleGlobalKey}
            customKeyInput={customKeyInput}
            setCustomKeyInput={setCustomKeyInput}
            addCustomGlobalKey={addCustomGlobalKey}
            notes={notes}
            setNotes={setNotes}
          />
        )}

        {tab === 'licenses' && (
          <MemberLicensesTab
            federalState={federalState}
            stateRules={stateRules}
            fwInfoOpen={fwInfoOpen}
            setFwInfoOpen={setFwInfoOpen}
            autoIncludeClasses={autoIncludeClasses}
            setAutoIncludeClasses={setAutoIncludeClasses}
            selectedPresetId={selectedPresetId}
            setSelectedPresetId={setSelectedPresetId}
            legacyIssuedAt={legacyIssuedAt}
            setLegacyIssuedAt={setLegacyIssuedAt}
            selectedOptionalClasses={selectedOptionalClasses}
            setSelectedOptionalClasses={setSelectedOptionalClasses}
            applyLegacyPreset={applyLegacyPreset}
            licensesMap={licensesMap}
            selectedClasses={selectedClasses}
            toggleLicenseClass={toggleLicenseClass}
            updateLicenseField={updateLicenseField}
            copyDatesToIncluded={copyDatesToIncluded}
            addFiveYears={addFiveYears}
            toggleClassKey={toggleClassKey}
            classKeyDrafts={classKeyDrafts}
            setClassKeyDrafts={setClassKeyDrafts}
            addCustomClassKey={addCustomClassKey}
          />
        )}

        {tab === 'ban' && (
          <MemberBanTab
            banActive={banActive}
            setBanActive={setBanActive}
            banFrom={banFrom}
            setBanFrom={setBanFrom}
            banUntil={banUntil}
            setBanUntil={setBanUntil}
            banReason={banReason}
            setBanReason={setBanReason}
          />
        )}
      </form>
    </ModalShell>
  );
}
