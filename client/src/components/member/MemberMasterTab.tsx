import type { MemberStatus } from '@shared/types';
import { KEY_NUMBER_CATALOG } from '@shared/licenseRules';

interface MemberMasterTabProps {
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  personnelNumber: string;
  setPersonnelNumber: (v: string) => void;
  birthDate: string;
  setBirthDate: (v: string) => void;
  unit: string;
  setUnit: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  status: MemberStatus;
  setStatus: (v: MemberStatus) => void;
  licenseNumber: string;
  setLicenseNumber: (v: string) => void;
  cardIssuedAt: string;
  setCardIssuedAt: (v: string) => void;
  cardExpiresAt: string;
  setCardExpiresAt: (v: string) => void;
  issuingAuthority: string;
  setIssuingAuthority: (v: string) => void;
  globalKeyNumbers: string[];
  toggleGlobalKey: (code: string) => void;
  customKeyInput: string;
  setCustomKeyInput: (v: string) => void;
  addCustomGlobalKey: () => void;
  notes: string;
  setNotes: (v: string) => void;
}

export function MemberMasterTab({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  personnelNumber,
  setPersonnelNumber,
  birthDate,
  setBirthDate,
  unit,
  setUnit,
  email,
  setEmail,
  phone,
  setPhone,
  status,
  setStatus,
  licenseNumber,
  setLicenseNumber,
  cardIssuedAt,
  setCardIssuedAt,
  cardExpiresAt,
  setCardExpiresAt,
  issuingAuthority,
  setIssuingAuthority,
  globalKeyNumbers,
  toggleGlobalKey,
  customKeyInput,
  setCustomKeyInput,
  addCustomGlobalKey,
  notes,
  setNotes,
}: MemberMasterTabProps) {
  return (
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <label className="mb-1 block text-sm font-medium">Geburtsdatum (optional)</label>
          <input
            type="date"
            className="input-field"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Für 50-Jahre-Regel (C/CE 79) & Umtauschfrist
          </p>
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
        {globalKeyNumbers.filter((k) => !KEY_NUMBER_CATALOG.some((c) => c.code === k)).length >
          0 && (
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
  );
}
