import React from 'react';
import {
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  History,
  Info,
} from 'lucide-react';
import type {
  FederalStateCode,
  LegacyLicensePreset,
  LicenseClass,
  MemberLicense,
  StateRuleConfig,
} from '@shared/types';
import {
  EU_LICENSE_CLASSES,
  EXPIRING_CLASSES,
  FEDERAL_STATE_PRESETS,
  FW_LICENSE_CLASSES,
  INCLUDED_BY_CLASS,
  KEY_NUMBER_CATALOG,
  LEGACY_LICENSE_PRESETS,
  LICENSE_CLASS_LABELS,
  LICENSE_CLASS_SHORT_LABELS,
} from '@shared/licenseRules';

interface MemberLicensesTabProps {
  federalState: FederalStateCode;
  stateRules: StateRuleConfig;
  fwInfoOpen: boolean;
  setFwInfoOpen: React.Dispatch<React.SetStateAction<boolean>>;
  autoIncludeClasses: boolean;
  setAutoIncludeClasses: (v: boolean) => void;
  selectedPresetId: string | null;
  setSelectedPresetId: (v: string | null) => void;
  legacyIssuedAt: string;
  setLegacyIssuedAt: (v: string) => void;
  selectedOptionalClasses: LicenseClass[];
  setSelectedOptionalClasses: React.Dispatch<React.SetStateAction<LicenseClass[]>>;
  applyLegacyPreset: (preset: LegacyLicensePreset) => void;
  licensesMap: Partial<Record<LicenseClass, MemberLicense>>;
  selectedClasses: LicenseClass[];
  toggleLicenseClass: (cls: LicenseClass) => void;
  updateLicenseField: <K extends keyof MemberLicense>(
    cls: LicenseClass,
    field: K,
    value: MemberLicense[K],
  ) => void;
  copyDatesToIncluded: (sourceCls: LicenseClass, activeSubClasses: LicenseClass[]) => void;
  addFiveYears: (cls: LicenseClass) => void;
  toggleClassKey: (cls: LicenseClass, code: string) => void;
  classKeyDrafts: Partial<Record<LicenseClass, string>>;
  setClassKeyDrafts: React.Dispatch<
    React.SetStateAction<Partial<Record<LicenseClass, string>>>
  >;
  addCustomClassKey: (cls: LicenseClass) => void;
}

export function MemberLicensesTab({
  federalState,
  stateRules,
  fwInfoOpen,
  setFwInfoOpen,
  autoIncludeClasses,
  setAutoIncludeClasses,
  selectedPresetId,
  setSelectedPresetId,
  legacyIssuedAt,
  setLegacyIssuedAt,
  selectedOptionalClasses,
  setSelectedOptionalClasses,
  applyLegacyPreset,
  licensesMap,
  selectedClasses,
  toggleLicenseClass,
  updateLicenseField,
  copyDatesToIncluded,
  addFiveYears,
  toggleClassKey,
  classKeyDrafts,
  setClassKeyDrafts,
  addCustomClassKey,
}: MemberLicensesTabProps) {
  const activePreset = LEGACY_LICENSE_PRESETS.find((p) => p.id === selectedPresetId) ?? null;

  return (
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
          <span>Eingeschlossene Klassen automatisch mit auswählen (z. B. B → AM, L)</span>
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Hinweis: Erteilungs- und Ablaufdatum je Klasse sind optional – ein leeres Ablaufdatum
          bedeutet <strong>unbefristet gültig</strong>.
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

        {activePreset && (
          <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-700 dark:bg-slate-800/60">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {activePreset.label}
              </p>
              <p className="mt-0.5 text-slate-600 dark:text-slate-300">{activePreset.summary}</p>
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
        )}
      </div>

      {/* Feuerwehrführerschein */}
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

      {/* EU-Klassen */}
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
                          {activeIncluded.map((c) => LICENSE_CLASS_SHORT_LABELS[c]).join(', ')})
                          übernehmen
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
                    Klassen-Schlüsselzahlen (z. B. 78 für Automatik, 79 für alte Klasse 3)
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
                          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
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
  );
}
