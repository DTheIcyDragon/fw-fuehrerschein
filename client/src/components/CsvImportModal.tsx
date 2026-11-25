import React, { useState } from 'react';
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { LICENSE_CLASS_SHORT_LABELS } from '@shared/licenseRules';
import { api, ApiError, type CsvPreviewResponse } from '../api';
import { useToast } from '../contexts/ToastContext';

interface CsvImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export function CsvImportModal({ open, onClose, onImported }: CsvImportModalProps) {
  const { showToast } = useToast();
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<CsvPreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setCsvText(text);
      setPreview(null);
      setError(null);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handlePreview = async () => {
    if (!csvText.trim()) {
      setError('Bitte eine CSV-Datei auswählen oder CSV-Text einfügen.');
      return;
    }
    setLoadingPreview(true);
    setError(null);
    try {
      const res = await api.previewCsvImport(csvText);
      setPreview(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Vorschau fehlgeschlagen.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCommit = async () => {
    if (!csvText.trim()) return;
    setCommitting(true);
    setError(null);
    try {
      const res = await api.commitCsvImport(csvText);
      showToast(
        `Import abgeschlossen: ${res.created} neu angelegt, ${res.updated} aktualisiert.`,
        'success',
      );
      setCsvText('');
      setPreview(null);
      onImported();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Import fehlgeschlagen.');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="h-5 w-5 text-fire-600" />
            <h2 className="text-lg font-semibold">Kameraden per CSV importieren</h2>
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

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/60 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm dark:border-slate-800 dark:bg-slate-800/50">
            <div>
              <p className="font-medium">Format-Hinweis (Semikolon `;` oder Komma `,`)</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Spalte <code>Klassen</code> z. B.: <code>B, C1:2028-05-01, FW_750</code>
              </p>
            </div>
            <a href={api.urls.csvTemplate()} className="btn-secondary !min-h-[40px]">
              <Download className="h-4 w-4" />
              CSV-Vorlage laden
            </a>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">CSV-Datei auswählen</label>
            <label className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 hover:border-fire-500 hover:text-fire-600 dark:border-slate-700 dark:text-slate-300">
              <Upload className="h-4 w-4" />
              <span>CSV-Datei (.csv) von Gerät wählen</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Oder CSV-Daten direkt einfügen</label>
            <textarea
              rows={6}
              className="input-field min-h-[130px] font-mono text-xs"
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                setPreview(null);
              }}
              placeholder="Personalnummer;Vorname;Nachname;Einheit;Email;Telefon;Status;Fuehrerscheinnummer;Karte_Ablauf;Schluesselzahlen;Klassen"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => void handlePreview()}
              disabled={loadingPreview || !csvText.trim()}
            >
              {loadingPreview ? 'Prüfe…' : 'Vorschau prüfen'}
            </button>
          </div>

          {preview && (
            <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  Neu: {preview.createCount}
                </span>
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  Aktualisierung: {preview.updateCount}
                </span>
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800 dark:bg-red-950 dark:text-red-300">
                  Fehler: {preview.errorCount}
                </span>
              </div>

              {preview.errorCount > 0 && (
                <p className="text-xs font-medium text-red-600 dark:text-red-400">
                  Bitte beheben Sie alle Fehlerzeilen vor dem Import.
                </p>
              )}

              {preview.rows.length > 0 && (
                <div className="max-h-60 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                  <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-800/70">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Zeile</th>
                        <th className="px-3 py-2 text-left font-semibold">Aktion</th>
                        <th className="px-3 py-2 text-left font-semibold">Kamerad</th>
                        <th className="px-3 py-2 text-left font-semibold">Klassen / Fehler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {preview.rows.map((row) => (
                        <tr key={row.rowNumber}>
                          <td className="px-3 py-2 font-mono">{row.rowNumber}</td>
                          <td className="px-3 py-2">
                            {row.action === 'create' && (
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                Neu
                              </span>
                            )}
                            {row.action === 'update' && (
                              <span className="font-semibold text-blue-600 dark:text-blue-400">
                                Update
                              </span>
                            )}
                            {row.action === 'error' && (
                              <span className="font-semibold text-red-600 dark:text-red-400">
                                Fehler
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {[row.data.first_name, row.data.last_name].filter(Boolean).join(' ') || '–'}
                            {row.data.unit ? ` (${row.data.unit})` : ''}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                            {row.errors.length > 0 ? (
                              <span className="text-red-600 dark:text-red-400">
                                {row.errors.join(', ')}
                              </span>
                            ) : row.data.licenses.length > 0 ? (
                              row.data.licenses
                                .map((l) =>
                                  l.expires_at
                                    ? `${LICENSE_CLASS_SHORT_LABELS[l.license_class]} (${l.expires_at})`
                                    : LICENSE_CLASS_SHORT_LABELS[l.license_class],
                                )
                                .join(', ')
                            ) : (
                              'Keine Klassen'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={committing}>
            Schließen
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void handleCommit()}
            disabled={
              committing ||
              !preview ||
              preview.errorCount > 0 ||
              preview.createCount + preview.updateCount === 0
            }
          >
            {committing ? 'Importiert…' : 'Import verbindlich durchführen'}
          </button>
        </div>
      </div>
    </div>
  );
}
