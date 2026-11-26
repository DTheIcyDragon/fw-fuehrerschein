import React from 'react';
import { Bell, Mail, Play, RefreshCw, Save } from 'lucide-react';
import type { AppSettingsPublic, MailProvider, NotificationLogEntry } from '@shared/types';

const WEEKDAYS = [
  { value: 1, label: 'Montag' },
  { value: 2, label: 'Dienstag' },
  { value: 3, label: 'Mittwoch' },
  { value: 4, label: 'Donnerstag' },
  { value: 5, label: 'Freitag' },
  { value: 6, label: 'Samstag' },
  { value: 0, label: 'Sonntag' },
];

interface MailSettingsTabProps {
  settings: AppSettingsPublic;
  mailProvider: MailProvider;
  setMailProvider: (v: MailProvider) => void;
  smtpHost: string;
  setSmtpHost: (v: string) => void;
  smtpPort: number;
  setSmtpPort: (v: number) => void;
  smtpSecure: boolean;
  setSmtpSecure: (v: boolean) => void;
  smtpUsername: string;
  setSmtpUsername: (v: string) => void;
  smtpPassword: string;
  setSmtpPassword: (v: string) => void;
  smtpFromEmail: string;
  setSmtpFromEmail: (v: string) => void;
  smtpFromName: string;
  setSmtpFromName: (v: string) => void;
  smtpRejectUnauth: boolean;
  setSmtpRejectUnauth: (v: boolean) => void;
  jmapSessionUrl: string;
  setJmapSessionUrl: (v: string) => void;
  jmapAuthType: 'bearer' | 'basic';
  setJmapAuthType: (v: 'bearer' | 'basic') => void;
  jmapUsername: string;
  setJmapUsername: (v: string) => void;
  jmapToken: string;
  setJmapToken: (v: string) => void;
  jmapPassword: string;
  setJmapPassword: (v: string) => void;
  jmapFromEmail: string;
  setJmapFromEmail: (v: string) => void;
  jmapFromName: string;
  setJmapFromName: (v: string) => void;
  jmapAccountId: string;
  setJmapAccountId: (v: string) => void;
  digestEnabled: boolean;
  setDigestEnabled: (v: boolean) => void;
  digestFreq: 'daily' | 'weekly';
  setDigestFreq: (v: 'daily' | 'weekly') => void;
  digestWeekday: number;
  setDigestWeekday: (v: number) => void;
  digestHour: number;
  setDigestHour: (v: number) => void;
  digestRecipients: string;
  setDigestRecipients: (v: string) => void;
  membersNotifyEnabled: boolean;
  setMembersNotifyEnabled: (v: boolean) => void;
  memberDaysBefore: string;
  setMemberDaysBefore: (v: string) => void;
  testEmail: string;
  setTestEmail: (v: string) => void;
  sendingTest: boolean;
  runningNotify: boolean;
  saving: boolean;
  logs: NotificationLogEntry[];
  onSaveMail: (e: React.FormEvent) => void;
  onSendTestMail: () => void;
  onRunNotifications: () => void;
  onRefreshLogs: () => void;
}

export function MailSettingsTab({
  settings,
  mailProvider,
  setMailProvider,
  smtpHost,
  setSmtpHost,
  smtpPort,
  setSmtpPort,
  smtpSecure,
  setSmtpSecure,
  smtpUsername,
  setSmtpUsername,
  smtpPassword,
  setSmtpPassword,
  smtpFromEmail,
  setSmtpFromEmail,
  smtpFromName,
  setSmtpFromName,
  smtpRejectUnauth,
  setSmtpRejectUnauth,
  jmapSessionUrl,
  setJmapSessionUrl,
  jmapAuthType,
  setJmapAuthType,
  jmapUsername,
  setJmapUsername,
  jmapToken,
  setJmapToken,
  jmapPassword,
  setJmapPassword,
  jmapFromEmail,
  setJmapFromEmail,
  jmapFromName,
  setJmapFromName,
  jmapAccountId,
  setJmapAccountId,
  digestEnabled,
  setDigestEnabled,
  digestFreq,
  setDigestFreq,
  digestWeekday,
  setDigestWeekday,
  digestHour,
  setDigestHour,
  digestRecipients,
  setDigestRecipients,
  membersNotifyEnabled,
  setMembersNotifyEnabled,
  memberDaysBefore,
  setMemberDaysBefore,
  testEmail,
  setTestEmail,
  sendingTest,
  runningNotify,
  saving,
  logs,
  onSaveMail,
  onSendTestMail,
  onRunNotifications,
  onRefreshLogs,
}: MailSettingsTabProps) {
  return (
    <div className="space-y-6">
      <form onSubmit={onSaveMail} className="space-y-6">
        <div className="card space-y-5 p-6">
          <h2 className="text-base font-semibold">Mail-Versandart (SMTP oder JMAP)</h2>

          <div className="grid gap-2.5 sm:grid-cols-3">
            {(
              [
                { id: 'none', title: 'Deaktiviert', desc: 'Kein E-Mail-Versand' },
                { id: 'smtp', title: 'SMTP', desc: 'Klassischer Mailserver (Port 587/465)' },
                { id: 'jmap', title: 'JMAP (RFC 8620/8621)', desc: 'z. B. Stalwart, Fastmail, Cyrus' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMailProvider(opt.id)}
                className={`min-h-[56px] rounded-xl border p-3.5 text-left transition-colors ${
                  mailProvider === opt.id
                    ? 'border-fire-600 bg-fire-50 text-fire-900 ring-2 ring-fire-500/20 dark:border-fire-500/80 dark:bg-fire-950/80 dark:text-fire-200'
                    : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                <div
                  className={`text-sm font-semibold ${
                    mailProvider === opt.id
                      ? 'text-fire-900 dark:text-white'
                      : 'text-slate-900 dark:text-slate-100'
                  }`}
                >
                  {opt.title}
                </div>
                <div
                  className={`text-xs ${
                    mailProvider === opt.id
                      ? 'text-fire-700 dark:text-slate-300'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {opt.desc}
                </div>
              </button>
            ))}
          </div>

          {mailProvider === 'smtp' && (
            <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium">SMTP-Host</label>
                  <input
                    type="text"
                    className="input-field"
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.example.org"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Port</label>
                  <input
                    type="number"
                    className="input-field"
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Benutzername</label>
                  <input
                    type="text"
                    className="input-field"
                    value={smtpUsername}
                    onChange={(e) => setSmtpUsername(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Passwort {settings.smtp.hasPassword && '(gespeichert)'}
                  </label>
                  <input
                    type="password"
                    className="input-field"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder={
                      settings.smtp.hasPassword
                        ? '•••••••• (leer lassen zum Beibehalten)'
                        : 'Passwort eingeben'
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Absender E-Mail</label>
                  <input
                    type="email"
                    className="input-field"
                    value={smtpFromEmail}
                    onChange={(e) => setSmtpFromEmail(e.target.value)}
                    placeholder="fuehrerschein@feuerwehr.de"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Absendername</label>
                  <input
                    type="text"
                    className="input-field"
                    value={smtpFromName}
                    onChange={(e) => setSmtpFromName(e.target.value)}
                    placeholder="Feuerwehr Führerscheinstelle"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
                    checked={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.checked)}
                  />
                  <span>Direktes SSL/TLS (z. B. Port 465)</span>
                </label>

                <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
                    checked={smtpRejectUnauth}
                    onChange={(e) => setSmtpRejectUnauth(e.target.checked)}
                  />
                  <span>TLS-Zertifikat streng prüfen</span>
                </label>
              </div>
            </div>
          )}

          {mailProvider === 'jmap' && (
            <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium">JMAP Session-URL</label>
                  <input
                    type="url"
                    className="input-field"
                    value={jmapSessionUrl}
                    onChange={(e) => setJmapSessionUrl(e.target.value)}
                    placeholder="https://mail.example.org/.well-known/jmap"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Authentifizierung</label>
                  <select
                    className="input-field"
                    value={jmapAuthType}
                    onChange={(e) => setJmapAuthType(e.target.value as 'bearer' | 'basic')}
                  >
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic Auth (Benutzer + Passwort)</option>
                  </select>
                </div>
              </div>

              {jmapAuthType === 'bearer' ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Bearer API-Token {settings.jmap.hasToken && '(gespeichert)'}
                    </label>
                    <input
                      type="password"
                      className="input-field"
                      value={jmapToken}
                      onChange={(e) => setJmapToken(e.target.value)}
                      placeholder={
                        settings.jmap.hasToken
                          ? '•••••••• (leer lassen zum Beibehalten)'
                          : 'API-Token eingeben'
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Account-ID (optional)
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={jmapAccountId}
                      onChange={(e) => setJmapAccountId(e.target.value)}
                      placeholder="Leer = Primary Account aus Session"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Benutzername</label>
                    <input
                      type="text"
                      className="input-field"
                      value={jmapUsername}
                      onChange={(e) => setJmapUsername(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Passwort {settings.jmap.hasPassword && '(gespeichert)'}
                    </label>
                    <input
                      type="password"
                      className="input-field"
                      value={jmapPassword}
                      onChange={(e) => setJmapPassword(e.target.value)}
                      placeholder={
                        settings.jmap.hasPassword
                          ? '•••••••• (leer lassen)'
                          : 'Passwort eingeben'
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Account-ID (optional)
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={jmapAccountId}
                      onChange={(e) => setJmapAccountId(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Absender E-Mail</label>
                  <input
                    type="email"
                    className="input-field"
                    value={jmapFromEmail}
                    onChange={(e) => setJmapFromEmail(e.target.value)}
                    placeholder="fuehrerschein@feuerwehr.de"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Absendername</label>
                  <input
                    type="text"
                    className="input-field"
                    value={jmapFromName}
                    onChange={(e) => setJmapFromName(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Test-Mail */}
          {mailProvider !== 'none' && (
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium">
                  Test-E-Mail-Adresse (testet aktuelle Formularwerte)
                </label>
                <input
                  type="email"
                  className="input-field"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="empfaenger@feuerwehr.de"
                />
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={onSendTestMail}
                disabled={sendingTest}
              >
                <Mail className="h-4 w-4" />
                <span>{sendingTest ? 'Sendet…' : 'Test-Mail senden'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Erinnerungen & Digest */}
        <div className="card space-y-5 p-6">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-fire-600" />
            <h2 className="text-base font-semibold">Automatische Erinnerungen</h2>
          </div>

          <div className="space-y-4">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
                checked={digestEnabled}
                onChange={(e) => setDigestEnabled(e.target.checked)}
              />
              <span className="text-sm font-medium">
                Sammelbericht (Digest) für Wehrführung / Prüfer aktivieren
              </span>
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Rhythmus</label>
                <select
                  className="input-field"
                  value={digestFreq}
                  onChange={(e) => setDigestFreq(e.target.value as 'daily' | 'weekly')}
                >
                  <option value="weekly">Wöchentlich</option>
                  <option value="daily">Täglich</option>
                </select>
              </div>
              {digestFreq === 'weekly' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Wochentag</label>
                  <select
                    className="input-field"
                    value={digestWeekday}
                    onChange={(e) => setDigestWeekday(Number(e.target.value))}
                  >
                    {WEEKDAYS.map((w) => (
                      <option key={w.value} value={w.value}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Uhrzeit (Stunde 0–23)</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  className="input-field"
                  value={digestHour}
                  onChange={(e) => setDigestHour(Number(e.target.value))}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Digest-Empfänger (kommagetrennt; leer = alle aktiven Admins mit E-Mail)
              </label>
              <input
                type="text"
                className="input-field"
                value={digestRecipients}
                onChange={(e) => setDigestRecipients(e.target.value)}
                placeholder="wehrfuehrer@feuerwehr.de, geraetewart@feuerwehr.de"
              />
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          <div className="space-y-3">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
                checked={membersNotifyEnabled}
                onChange={(e) => setMembersNotifyEnabled(e.target.checked)}
              />
              <span className="text-sm font-medium">
                Direkte Erinnerungs-E-Mails an Kameraden vor Ablauf senden
              </span>
            </label>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Erinnerungstage vor Fristablauf (kommagetrennt)
              </label>
              <input
                type="text"
                className="input-field max-w-sm"
                value={memberDaysBefore}
                onChange={(e) => setMemberDaysBefore(e.target.value)}
                placeholder="90, 30, 7"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={onRunNotifications}
              disabled={runningNotify}
            >
              <Play className="h-4 w-4" />
              <span>
                {runningNotify ? 'Wird ausgeführt…' : 'Benachrichtigungen jetzt ausführen'}
              </span>
            </button>

            <button type="submit" className="btn-primary" disabled={saving}>
              <Save className="h-4 w-4" />
              <span>{saving ? 'Speichert…' : 'E-Mail & Erinnerungen speichern'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Versandprotokoll */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-base font-semibold">Versandprotokoll</h2>
          <button
            type="button"
            className="btn-secondary !min-h-[38px] !px-3 text-xs"
            onClick={onRefreshLogs}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Aktualisieren</span>
          </button>
        </div>
        {logs.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            Noch keine E-Mails protokolliert.
          </div>
        ) : (
          <div className="max-h-80 overflow-auto">
            <table className="min-w-full divide-y divide-slate-200 text-xs dark:divide-slate-800">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Zeitpunkt</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Empfänger</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Kanal</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Betreff</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {logs.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      {new Date(entry.sent_at).toLocaleString('de-DE')}
                    </td>
                    <td className="px-4 py-2.5">{entry.recipient}</td>
                    <td className="px-4 py-2.5 uppercase">{entry.channel}</td>
                    <td className="px-4 py-2.5">{entry.subject}</td>
                    <td className="px-4 py-2.5">
                      {entry.status === 'sent' ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Gesendet
                        </span>
                      ) : (
                        <span
                          className="font-semibold text-red-600 dark:text-red-400"
                          title={entry.error_message ?? ''}
                        >
                          Fehler: {entry.error_message || 'Unbekannt'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
