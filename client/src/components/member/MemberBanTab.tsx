interface MemberBanTabProps {
  banActive: boolean;
  setBanActive: (v: boolean) => void;
  banFrom: string;
  setBanFrom: (v: string) => void;
  banUntil: string;
  setBanUntil: (v: string) => void;
  banReason: string;
  setBanReason: (v: string) => void;
}

export function MemberBanTab({
  banActive,
  setBanActive,
  banFrom,
  setBanFrom,
  banUntil,
  setBanUntil,
  banReason,
  setBanReason,
}: MemberBanTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
        Ein aktives Fahrverbot bzw. eine interne Fahrsperre setzt die Ampel des Kameraden sofort
        auf <strong>Rot (Gesperrt)</strong> – sowohl in der Übersicht als auch auf allen
        Fahrzeug-Fahrerlisten.
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
  );
}
