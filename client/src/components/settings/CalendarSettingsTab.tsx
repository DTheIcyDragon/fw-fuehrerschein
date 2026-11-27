import { Copy, Download, RefreshCw } from 'lucide-react';
import { api } from '../../api';

interface CalendarSettingsTabProps {
  icalSubscribeUrl: string;
  onCopyUrl: () => void;
  onOpenRotateConfirm: () => void;
}

export function CalendarSettingsTab({
  icalSubscribeUrl,
  onCopyUrl,
  onOpenRotateConfirm,
}: CalendarSettingsTabProps) {
  return (
    <div className="card max-w-2xl space-y-5 p-6">
      <div>
        <h2 className="text-base font-semibold">Kalender-Abonnement (iCal / .ics)</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Abonnieren Sie fällige Führerscheinkontrollen, ablaufende Klassen und Karten direkt in
          Nextcloud, Outlook, Apple Kalender oder Google Kalender.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">Persönliche Abo-URL</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            readOnly
            className="input-field font-mono text-xs"
            value={icalSubscribeUrl}
          />
          <button type="button" className="btn-secondary shrink-0" onClick={onCopyUrl}>
            <Copy className="h-4 w-4" />
            <span>Kopieren</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <a href={api.urls.calendarIcs()} className="btn-primary">
          <Download className="h-4 w-4" />
          <span>.ics Datei herunterladen</span>
        </a>
        <button type="button" className="btn-secondary" onClick={onOpenRotateConfirm}>
          <RefreshCw className="h-4 w-4" />
          <span>Abo-Token neu generieren</span>
        </button>
      </div>
    </div>
  );
}
