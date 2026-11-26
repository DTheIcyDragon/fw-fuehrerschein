import React from 'react';
import { Database, Download, FileSpreadsheet, FileText, Upload } from 'lucide-react';
import { api } from '../../api';

interface BackupSettingsTabProps {
  onOpenCsvImport: () => void;
  onSqliteFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBackupFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function BackupSettingsTab({
  onOpenCsvImport,
  onSqliteFileSelect,
  onBackupFileSelect,
}: BackupSettingsTabProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card space-y-4 p-6">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-fire-600" />
          <h2 className="text-base font-semibold">CSV-Import & Berichte</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Importieren Sie Kameraden und Führerscheinklassen per CSV oder exportieren Sie Listen
          als CSV und PDF.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" className="btn-primary" onClick={onOpenCsvImport}>
            <Upload className="h-4 w-4" />
            <span>CSV-Import starten</span>
          </button>
          <a href={api.urls.membersCsv()} className="btn-secondary">
            <Download className="h-4 w-4" />
            <span>Kameraden CSV</span>
          </a>
          <a href={api.urls.membersPdf()} className="btn-secondary">
            <FileText className="h-4 w-4" />
            <span>PDF-Gesamtübersicht</span>
          </a>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-fire-600" />
          <h2 className="text-base font-semibold">Datensicherung & Wiederherstellung</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Laden Sie ein konsistentes SQLite-Backup oder ein portables JSON-Backup herunter. Beide
          Formate können hier direkt wiederhergestellt werden.
        </p>

        <div className="flex flex-wrap gap-2.5">
          <a href={api.urls.backupSqlite()} className="btn-secondary">
            <Download className="h-4 w-4" />
            <span>SQLite-Backup (.db)</span>
          </a>
          <label className="btn-secondary cursor-pointer">
            <Upload className="h-4 w-4" />
            <span>SQLite-Backup (.db) importieren</span>
            <input
              type="file"
              accept=".db,.sqlite,.sqlite3"
              className="hidden"
              onChange={onSqliteFileSelect}
            />
          </label>
          <a href={api.urls.backupJson()} className="btn-secondary">
            <Download className="h-4 w-4" />
            <span>JSON-Backup (.json)</span>
          </a>
          <label className="btn-primary cursor-pointer">
            <Upload className="h-4 w-4" />
            <span>JSON-Backup einspielen</span>
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={onBackupFileSelect}
            />
          </label>
        </div>
      </section>
    </div>
  );
}
