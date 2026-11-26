import React from 'react';
import { ChevronDown, ChevronUp, MapPin, Save } from 'lucide-react';
import type { FederalStateCode, StateRuleConfig } from '@shared/types';
import {
  FEDERAL_STATE_LIST,
  FEDERAL_STATE_PRESETS,
  getDefaultStateRules,
} from '@shared/licenseRules';

interface GeneralSettingsTabProps {
  departmentName: string;
  setDepartmentName: (v: string) => void;
  intervalMonths: number;
  setIntervalMonths: (v: number) => void;
  licenseWarnDays: number;
  setLicenseWarnDays: (v: number) => void;
  inspectionWarnDays: number;
  setInspectionWarnDays: (v: number) => void;
  federalState: FederalStateCode;
  setFederalState: (v: FederalStateCode) => void;
  stateRules: StateRuleConfig;
  setStateRules: React.Dispatch<React.SetStateAction<StateRuleConfig>>;
  compareOpen: boolean;
  setCompareOpen: React.Dispatch<React.SetStateAction<boolean>>;
  compareState: FederalStateCode;
  setCompareState: (v: FederalStateCode) => void;
  saving: boolean;
  onSave: (e: React.FormEvent) => void;
  onNotifyInfo: (msg: string) => void;
}

export function GeneralSettingsTab({
  departmentName,
  setDepartmentName,
  intervalMonths,
  setIntervalMonths,
  licenseWarnDays,
  setLicenseWarnDays,
  inspectionWarnDays,
  setInspectionWarnDays,
  federalState,
  setFederalState,
  stateRules,
  setStateRules,
  compareOpen,
  setCompareOpen,
  compareState,
  setCompareState,
  saving,
  onSave,
  onNotifyInfo,
}: GeneralSettingsTabProps) {
  const activePreset = FEDERAL_STATE_PRESETS[federalState];
  const comparePreset = FEDERAL_STATE_PRESETS[compareState];

  return (
    <form onSubmit={onSave} className="max-w-3xl space-y-6">
      <div className="card space-y-5 p-6">
        <h2 className="text-base font-semibold">Feuerwehr & Warnfristen</h2>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Name der Feuerwehr / Organisation
          </label>
          <input
            type="text"
            className="input-field"
            value={departmentName}
            onChange={(e) => setDepartmentName(e.target.value)}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Kontrollintervall (Monate)</label>
            <input
              type="number"
              min={1}
              max={120}
              className="input-field"
              value={intervalMonths}
              onChange={(e) => setIntervalMonths(Number(e.target.value))}
              required
            />
            <p className="mt-1 text-xs text-slate-500">Standard: 6 Monate</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Vorwarnzeit Klassen (Tage)</label>
            <input
              type="number"
              min={0}
              max={730}
              className="input-field"
              value={licenseWarnDays}
              onChange={(e) => setLicenseWarnDays(Number(e.target.value))}
              required
            />
            <p className="mt-1 text-xs text-slate-500">Ampel Gelb vor Ablauf</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Vorwarnzeit Kontrolle (Tage)</label>
            <input
              type="number"
              min={0}
              max={365}
              className="input-field"
              value={inspectionWarnDays}
              onChange={(e) => setInspectionWarnDays(Number(e.target.value))}
              required
            />
            <p className="mt-1 text-xs text-slate-500">Ampel Gelb vor Fälligkeit</p>
          </div>
        </div>
      </div>

      {/* Bundesland & Feuerwehrführerschein-Regeln */}
      <div className="card space-y-5 p-6">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-fire-600" />
          <h2 className="text-base font-semibold">Bundesland & Feuerwehrführerschein-Regeln</h2>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Hinweis: Alle 16 Bundesland-Presets bauen auf der bundeseinheitlichen StVG-Basis
          (§ 2 Abs. 10a StVG: 2 Jahre Klasse B, 4,75 t / 7,5 t) auf und ergänzen jeweils die
          landesspezifische Verordnung sowie Prüf-/Ausbildungsdetails.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium">Aktives Bundesland</label>
            <select
              className="input-field"
              value={federalState}
              onChange={(e) => setFederalState(e.target.value as FederalStateCode)}
            >
              {FEDERAL_STATE_LIST.map((st) => (
                <option key={st.code} value={st.code}>
                  {st.name} ({st.code})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn-secondary shrink-0"
            onClick={() => {
              const defaults = getDefaultStateRules(federalState);
              setStateRules((prev) => ({
                ...defaults,
                custom_rules_notes: prev.custom_rules_notes,
              }));
              onNotifyInfo(`Standardregeln für ${activePreset.name} geladen.`);
            }}
          >
            Standardregeln für {activePreset.name} übernehmen
          </button>
        </div>

        {/* Infokarte aktive Landesverordnung */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-800/50">
          <p className="font-semibold text-slate-900 dark:text-white">
            {activePreset.name}: {activePreset.regulationName}
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{activePreset.summary}</p>
          <ul className="mt-2.5 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {activePreset.highlights.map((hl, idx) => (
              <li key={idx} className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fire-600" />
                <span>{hl}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Sonderregeln einzeln einstellbar */}
        <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Regel-Konfiguration (aktiv für Bewertung & Ampel)
          </h3>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
                checked={stateRules.fw_475_enabled}
                onChange={(e) =>
                  setStateRules((prev) => ({ ...prev, fw_475_enabled: e.target.checked }))
                }
              />
              <span>Feuerwehrführerschein bis 4,75 t aktiv</span>
            </label>

            <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
                checked={stateRules.fw_750_enabled}
                onChange={(e) =>
                  setStateRules((prev) => ({ ...prev, fw_750_enabled: e.target.checked }))
                }
              />
              <span>Feuerwehrführerschein bis 7,5 t aktiv</span>
            </label>

            <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
                checked={stateRules.fw_require_valid_b}
                onChange={(e) =>
                  setStateRules((prev) => ({ ...prev, fw_require_valid_b: e.target.checked }))
                }
              />
              <span>Gültige Klasse B zwingend (sonst Rot)</span>
            </label>

            <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
                checked={stateRules.fw_allow_trailers}
                onChange={(e) =>
                  setStateRules((prev) => ({ ...prev, fw_allow_trailers: e.target.checked }))
                }
              />
              <span>Anhänger/Kombinationen bis zGM zulässig</span>
            </label>
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm dark:border-amber-900/60 dark:bg-amber-950/30">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
              checked={stateRules.strict_inspection_blocking}
              onChange={(e) =>
                setStateRules((prev) => ({
                  ...prev,
                  strict_inspection_blocking: e.target.checked,
                }))
              }
            />
            <span>
              Strenge Kontrollsperre: Überfällige oder fehlende Kontrolle sperrt Fahrer in
              Fahrzeuglisten sofort auf <strong>Rot</strong> (statt Gelb)
            </span>
          </label>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
              checked={Boolean(stateRules.expired_card_blocks_driving)}
              onChange={(e) =>
                setStateRules((prev) => ({
                  ...prev,
                  expired_card_blocks_driving: e.target.checked,
                }))
              }
            />
            <span>
              Abgelaufene Plastikkarte (Feld 4b) sperrt auf <strong>Rot</strong> statt Gelb
              (Standard: Gelb / Hinweis gemäß § 24a FeV)
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Mindest-Vorbesitz Klasse B (Jahre)
              </label>
              <input
                type="number"
                min={0}
                max={20}
                className="input-field"
                value={stateRules.fw_min_b_years}
                onChange={(e) =>
                  setStateRules((prev) => ({
                    ...prev,
                    fw_min_b_years: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
              <p className="mt-1 text-xs text-slate-500">Standard in SH & Bund: 2 Jahre</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Befristung FW-Führerschein (Monate, leer = unbefristet)
              </label>
              <input
                type="number"
                min={1}
                max={240}
                className="input-field"
                value={stateRules.fw_renewal_months ?? ''}
                placeholder="Unbefristet"
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  setStateRules((prev) => ({
                    ...prev,
                    fw_renewal_months: raw ? Math.max(1, Number(raw) || 1) : null,
                  }));
                }}
              />
              <p className="mt-1 text-xs text-slate-500">
                Greift, wenn bei FW 4,75t / 7,5t kein eigenes Ablaufdatum gepflegt ist
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Eigene Dienstanweisung / Sonderregeln vor Ort
            </label>
            <textarea
              rows={2}
              className="input-field min-h-[68px]"
              value={stateRules.custom_rules_notes}
              onChange={(e) =>
                setStateRules((prev) => ({ ...prev, custom_rules_notes: e.target.value }))
              }
              placeholder="z. B. Jährliche Einweisungsfahrt auf HLF erforderlich; Fahrten außerhalb des Kreisgebiets nur mit…"
            />
          </div>
        </div>

        {/* Klappbarer Bereich: Andere Bundesländer vergleichen */}
        <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setCompareOpen((v) => !v)}
            className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
          >
            <span>Sonderregeln anderer Bundesländer nachschlagen & vergleichen</span>
            {compareOpen ? (
              <ChevronUp className="h-4 w-4 text-slate-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-500" />
            )}
          </button>

          {compareOpen && (
            <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Bundesland zum Nachschlagen auswählen
                  </label>
                  <select
                    className="input-field"
                    value={compareState}
                    onChange={(e) => setCompareState(e.target.value as FederalStateCode)}
                  >
                    {FEDERAL_STATE_LIST.map((st) => (
                      <option key={st.code} value={st.code}>
                        {st.name} ({st.code})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn-secondary shrink-0 text-xs"
                  onClick={() => {
                    setFederalState(compareState);
                    setStateRules((prev) => ({
                      ...getDefaultStateRules(compareState),
                      custom_rules_notes: prev.custom_rules_notes,
                    }));
                    onNotifyInfo(
                      `Bundesland & Standardregeln für ${comparePreset.name} übernommen (noch speichern).`,
                    );
                  }}
                >
                  Regeln von {comparePreset.name} übernehmen
                </button>
              </div>

              <div className="text-xs text-slate-700 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-white">
                  {comparePreset.regulationName}
                </p>
                <p className="mt-0.5">{comparePreset.summary}</p>
                <ul className="mt-2 space-y-1">
                  {comparePreset.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save className="h-4 w-4" />
            <span>{saving ? 'Speichert…' : 'Allgemein & Landesregeln speichern'}</span>
          </button>
        </div>
      </div>
    </form>
  );
}
