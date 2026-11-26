import React, { useCallback, useEffect, useState } from 'react';
import {
  Bell,
  Calendar,
  ChevronDown,
  ChevronUp,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Mail,
  MapPin,
  Play,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import type {
  AppSettingsPublic,
  FederalStateCode,
  MailProvider,
  NotificationLogEntry,
  PublicUser,
  StateRuleConfig,
  UserRole,
} from '@shared/types';
import {
  FEDERAL_STATE_LIST,
  FEDERAL_STATE_PRESETS,
  getDefaultStateRules,
} from '@shared/licenseRules';
import { api, ApiError } from '../api';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CsvImportModal } from '../components/CsvImportModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

type SettingsTab = 'general' | 'mail' | 'calendar' | 'users' | 'backup';

const WEEKDAYS = [
  { value: 1, label: 'Montag' },
  { value: 2, label: 'Dienstag' },
  { value: 3, label: 'Mittwoch' },
  { value: 4, label: 'Donnerstag' },
  { value: 5, label: 'Freitag' },
  { value: 6, label: 'Samstag' },
  { value: 0, label: 'Sonntag' },
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  inspector: 'Prüfer',
  viewer: 'Nur Lesen',
};

export function SettingsPage() {
  const { isAdmin, user: currentUser, refreshAuth } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<SettingsTab>('general');
  const [settings, setSettings] = useState<AppSettingsPublic | null>(null);
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Allgemein & Intervalle
  const [departmentName, setDepartmentName] = useState('');
  const [intervalMonths, setIntervalMonths] = useState(6);
  const [licenseWarnDays, setLicenseWarnDays] = useState(90);
  const [inspectionWarnDays, setInspectionWarnDays] = useState(30);
  const [federalState, setFederalState] = useState<FederalStateCode>('SH');
  const [stateRules, setStateRules] = useState<StateRuleConfig>(() => getDefaultStateRules('SH'));
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareState, setCompareState] = useState<FederalStateCode>('BY');

  // Mail & Benachrichtigungen
  const [mailProvider, setMailProvider] = useState<MailProvider>('none');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFromEmail, setSmtpFromEmail] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('');
  const [smtpRejectUnauth, setSmtpRejectUnauth] = useState(true);

  const [jmapSessionUrl, setJmapSessionUrl] = useState('');
  const [jmapAuthType, setJmapAuthType] = useState<'bearer' | 'basic'>('bearer');
  const [jmapUsername, setJmapUsername] = useState('');
  const [jmapToken, setJmapToken] = useState('');
  const [jmapPassword, setJmapPassword] = useState('');
  const [jmapFromEmail, setJmapFromEmail] = useState('');
  const [jmapFromName, setJmapFromName] = useState('');
  const [jmapAccountId, setJmapAccountId] = useState('');

  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestFreq, setDigestFreq] = useState<'daily' | 'weekly'>('weekly');
  const [digestWeekday, setDigestWeekday] = useState(1);
  const [digestHour, setDigestHour] = useState(8);
  const [digestRecipients, setDigestRecipients] = useState('');
  const [membersNotifyEnabled, setMembersNotifyEnabled] = useState(false);
  const [memberDaysBefore, setMemberDaysBefore] = useState('90, 30, 7');

  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [runningNotify, setRunningNotify] = useState(false);

  // iCal
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  const [rotatingToken, setRotatingToken] = useState(false);

  // Benutzer
  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PublicUser | null>(null);
  const [userFormOpen, setUserFormOpen] = useState(false);
  const [uUsername, setUUsername] = useState('');
  const [uDisplayName, setUDisplayName] = useState('');
  const [uEmail, setUEmail] = useState('');
  const [uRole, setURole] = useState<UserRole>('inspector');
  const [uActive, setUActive] = useState(true);
  const [uPassword, setUPassword] = useState('');
  const [savingUser, setSavingUser] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<PublicUser | null>(null);

  // Import & Backup
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [pendingBackupJson, setPendingBackupJson] = useState<unknown>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [pendingSqliteFile, setPendingSqliteFile] = useState<File | null>(null);
  const [sqliteRestoreConfirmOpen, setSqliteRestoreConfirmOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const applySettingsToState = useCallback((s: AppSettingsPublic) => {
    setSettings(s);
    setDepartmentName(s.department_name);
    setIntervalMonths(s.inspection_interval_months);
    setLicenseWarnDays(s.license_warn_days);
    setInspectionWarnDays(s.inspection_warn_days);
    const nextState = s.federal_state ?? 'SH';
    setFederalState(nextState);
    setStateRules(s.state_rules ?? getDefaultStateRules(nextState));
    setCompareState(nextState === 'BY' ? 'SH' : 'BY');

    setMailProvider(s.mail_provider);
    setSmtpHost(s.smtp.host);
    setSmtpPort(s.smtp.port);
    setSmtpSecure(s.smtp.secure);
    setSmtpUsername(s.smtp.username);
    setSmtpPassword('');
    setSmtpFromEmail(s.smtp.fromEmail);
    setSmtpFromName(s.smtp.fromName);
    setSmtpRejectUnauth(s.smtp.rejectUnauthorized);

    setJmapSessionUrl(s.jmap.sessionUrl);
    setJmapAuthType(s.jmap.authType);
    setJmapUsername(s.jmap.username);
    setJmapToken('');
    setJmapPassword('');
    setJmapFromEmail(s.jmap.fromEmail);
    setJmapFromName(s.jmap.fromName);
    setJmapAccountId(s.jmap.accountId);

    setDigestEnabled(s.notify_digest_enabled);
    setDigestFreq(s.notify_digest_frequency);
    setDigestWeekday(s.notify_digest_weekday);
    setDigestHour(s.notify_digest_hour);
    setDigestRecipients(s.notify_digest_recipients.join(', '));
    setMembersNotifyEnabled(s.notify_members_enabled);
    setMemberDaysBefore(s.notify_member_days_before.join(', '));
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, logList, userList] = await Promise.all([
        api.getSettings(),
        api.getNotificationLogs(),
        api.listUsers(),
      ]);
      applySettingsToState(s);
      setLogs(logList);
      setUsers(userList);
      if (currentUser?.email) {
        setTestEmail((prev) => prev || currentUser.email || '');
      }
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Einstellungen konnten nicht geladen werden.',
        'error',
      );
    } finally {
      setLoading(false);
    }
  }, [applySettingsToState, currentUser?.email, showToast]);

  useEffect(() => {
    if (isAdmin) {
      void loadAll();
    } else {
      setLoading(false);
    }
  }, [isAdmin, loadAll]);

  if (!isAdmin) {
    return (
      <div className="card p-8 text-center">
        <p className="font-semibold">Kein Zugriff</p>
        <p className="mt-1 text-sm text-slate-500">
          Einstellungen sind nur für Administratoren zugänglich.
        </p>
      </div>
    );
  }

  if (loading || !settings) {
    return <div className="p-8 text-center text-sm text-slate-500">Lade Einstellungen…</div>;
  }

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateSettings({
        department_name: departmentName.trim(),
        inspection_interval_months: Number(intervalMonths),
        license_warn_days: Number(licenseWarnDays),
        inspection_warn_days: Number(inspectionWarnDays),
        federal_state: federalState,
        state_rules: stateRules,
      });
      applySettingsToState(updated);
      await refreshAuth();
      showToast('Allgemeine Einstellungen & Landesregeln gespeichert.', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const buildMailPatch = () => {
    const recipients = digestRecipients
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const days = memberDaysBefore
      .split(/[,;\s]/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0);

    return {
      mail_provider: mailProvider,
      smtp: {
        host: smtpHost.trim(),
        port: Number(smtpPort) || 587,
        secure: smtpSecure,
        username: smtpUsername.trim(),
        ...(smtpPassword ? { password: smtpPassword } : {}),
        fromEmail: smtpFromEmail.trim(),
        fromName: smtpFromName.trim(),
        rejectUnauthorized: smtpRejectUnauth,
      },
      jmap: {
        sessionUrl: jmapSessionUrl.trim(),
        authType: jmapAuthType,
        username: jmapUsername.trim(),
        ...(jmapToken ? { token: jmapToken } : {}),
        ...(jmapPassword ? { password: jmapPassword } : {}),
        fromEmail: jmapFromEmail.trim(),
        fromName: jmapFromName.trim(),
        accountId: jmapAccountId.trim(),
      },
      notify_digest_enabled: digestEnabled,
      notify_digest_frequency: digestFreq,
      notify_digest_weekday: Number(digestWeekday),
      notify_digest_hour: Number(digestHour),
      notify_digest_recipients: recipients,
      notify_members_enabled: membersNotifyEnabled,
      notify_member_days_before: days.length > 0 ? days : [90, 30, 7],
    };
  };

  const handleSaveMail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateSettings(buildMailPatch());
      applySettingsToState(updated);
      showToast('E-Mail- & Benachrichtigungseinstellungen gespeichert.', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Speichern fehlgeschlagen.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestMail = async () => {
    if (!testEmail.trim()) {
      showToast('Bitte eine Ziel-E-Mail-Adresse für den Test eingeben.', 'error');
      return;
    }
    setSendingTest(true);
    try {
      const patch = buildMailPatch();
      const res = await api.sendTestNotification({
        toEmail: testEmail.trim(),
        override: {
          provider: mailProvider,
          smtp: patch.smtp,
          jmap: patch.jmap,
        },
      });
      showToast(res.message || 'Test-E-Mail gesendet.', 'success');
      const freshLogs = await api.getNotificationLogs();
      setLogs(freshLogs);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Test-E-Mail fehlgeschlagen.', 'error');
    } finally {
      setSendingTest(false);
    }
  };

  const handleRunNotifications = async () => {
    setRunningNotify(true);
    try {
      const res = await api.runNotifications({
        forceDigest: true,
        sendDigest: true,
        sendMembers: true,
      });
      const freshLogs = await api.getNotificationLogs();
      setLogs(freshLogs);
      if (res.skippedReason) {
        showToast(res.skippedReason, 'info');
      } else if (res.errors.length > 0) {
        showToast(`Lauf beendet mit Fehlern: ${res.errors[0]}`, 'error');
      } else {
        showToast(
          `Benachrichtigungen ausgeführt: ${res.digestSent} Digest, ${res.memberEmailsSent} Kameraden-Mails.`,
          'success',
        );
      }
    } catch (err) {
      showToast(
        err instanceof ApiError ? err.message : 'Benachrichtigungs-Lauf fehlgeschlagen.',
        'error',
      );
    } finally {
      setRunningNotify(false);
    }
  };

  const handleRotateIcal = async () => {
    setRotatingToken(true);
    try {
      const res = await api.rotateIcalToken();
      setSettings((prev) => (prev ? { ...prev, ical_token: res.ical_token } : prev));
      setRotateConfirmOpen(false);
      showToast('Neuer iCal-Abo-Token generiert.', 'success');
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Token-Rotation fehlgeschlagen.', 'error');
    } finally {
      setRotatingToken(false);
    }
  };

  const icalSubscribeUrl = `${window.location.origin}/api/calendar/${settings.ical_token}.ics`;

  const copyIcalUrl = async () => {
    try {
      await navigator.clipboard.writeText(icalSubscribeUrl);
      showToast('Kalender-Abo-URL kopiert.', 'success');
    } catch {
      showToast('Kopieren in die Zwischenablage nicht möglich.', 'error');
    }
  };

  const openNewUserForm = () => {
    setEditingUser(null);
    setUUsername('');
    setUDisplayName('');
    setUEmail('');
    setURole('inspector');
    setUActive(true);
    setUPassword('');
    setUserFormOpen(true);
  };

  const openEditUserForm = (u: PublicUser) => {
    setEditingUser(u);
    setUUsername(u.username);
    setUDisplayName(u.display_name);
    setUEmail(u.email ?? '');
    setURole(u.role);
    setUActive(u.active);
    setUPassword('');
    setUserFormOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, {
          display_name: uDisplayName.trim(),
          email: uEmail.trim() || null,
          role: uRole,
          active: uActive,
          ...(uPassword ? { password: uPassword } : {}),
        });
        showToast('Benutzer aktualisiert.', 'success');
      } else {
        await api.createUser({
          username: uUsername.trim(),
          display_name: uDisplayName.trim() || uUsername.trim(),
          email: uEmail.trim() || null,
          role: uRole,
          active: uActive,
          password: uPassword,
        });
        showToast('Benutzer angelegt.', 'success');
      }
      setUserFormOpen(false);
      setUsers(await api.listUsers());
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Benutzer konnte nicht gespeichert werden.', 'error');
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    try {
      await api.deleteUser(deleteUserTarget.id);
      showToast('Benutzer gelöscht.', 'success');
      setDeleteUserTarget(null);
      setUsers(await api.listUsers());
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Benutzer konnte nicht gelöscht werden.', 'error');
    }
  };

  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? ''));
        setPendingBackupJson(parsed);
        setRestoreConfirmOpen(true);
      } catch {
        showToast('Die ausgewählte Datei enthält kein gültiges JSON.', 'error');
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleRestoreJson = async () => {
    if (!pendingBackupJson) return;
    setRestoring(true);
    try {
      const res = await api.restoreJsonBackup(pendingBackupJson);
      setRestoreConfirmOpen(false);
      setPendingBackupJson(null);
      showToast(
        `Wiederhergestellt: ${res.restored.members} Kameraden, ${res.restored.vehicles} Fahrzeuge, ${res.restored.inspections} Kontrollen.`,
        'success',
      );
      await loadAll();
      await refreshAuth();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'JSON-Restore fehlgeschlagen.', 'error');
    } finally {
      setRestoring(false);
    }
  };

  const handleSqliteFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPendingSqliteFile(file);
    setSqliteRestoreConfirmOpen(true);
  };

  const handleRestoreSqlite = async () => {
    if (!pendingSqliteFile) return;
    setRestoring(true);
    try {
      const res = await api.restoreSqliteBackup(pendingSqliteFile);
      setSqliteRestoreConfirmOpen(false);
      setPendingSqliteFile(null);
      showToast(
        `SQLite-Backup wiederhergestellt: ${res.restored.members} Kameraden, ${res.restored.vehicles} Fahrzeuge, ${res.restored.inspections} Kontrollen.`,
        'success',
      );
      await loadAll();
      await refreshAuth();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'SQLite-Restore fehlgeschlagen.', 'error');
    } finally {
      setRestoring(false);
    }
  };

  const tabs: Array<{ id: SettingsTab; label: string; icon: typeof Settings2 }> = [
    { id: 'general', label: 'Allgemein', icon: Settings2 },
    { id: 'mail', label: 'E-Mail & Erinnerungen', icon: Mail },
    { id: 'calendar', label: 'Kalender (iCal)', icon: Calendar },
    { id: 'users', label: 'Benutzer', icon: Users },
    { id: 'backup', label: 'Import & Backup', icon: Database },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Einstellungen</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Prüffristen, Benachrichtigungen (SMTP / JMAP), Kalender-Abo, Benutzer & Datensicherung
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex min-h-[44px] shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? 'border-fire-600 text-fire-600 dark:text-fire-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Allgemein */}
      {tab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="max-w-3xl space-y-6">
          <div className="card space-y-5 p-6">
            <h2 className="text-base font-semibold">Feuerwehr & Warnfristen</h2>

            <div>
              <label className="mb-1 block text-sm font-medium">Name der Feuerwehr / Organisation</label>
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
                  showToast(
                    `Standardregeln für ${FEDERAL_STATE_PRESETS[federalState].name} geladen.`,
                    'info',
                  );
                }}
              >
                Standardregeln für {FEDERAL_STATE_PRESETS[federalState].name} übernehmen
              </button>
            </div>

            {/* Infokarte aktive Landesverordnung */}
            {(() => {
              const preset = FEDERAL_STATE_PRESETS[federalState];
              return (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-800/50">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {preset.name}: {preset.regulationName}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{preset.summary}</p>
                  <ul className="mt-2.5 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    {preset.highlights.map((hl, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fire-600" />
                        <span>{hl}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

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
                className="flex min-h-[44px] w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5 text-left text-sm font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
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
                        showToast(
                          `Bundesland & Standardregeln für ${FEDERAL_STATE_PRESETS[compareState].name} übernommen (noch speichern).`,
                          'info',
                        );
                      }}
                    >
                      Regeln von {FEDERAL_STATE_PRESETS[compareState].name} übernehmen
                    </button>
                  </div>

                  {(() => {
                    const cp = FEDERAL_STATE_PRESETS[compareState];
                    return (
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {cp.regulationName}
                        </p>
                        <p className="mt-0.5">{cp.summary}</p>
                        <ul className="mt-2 space-y-1">
                          {cp.highlights.map((h, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                              <span>{h}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
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
      )}

      {/* Tab 2: E-Mail & Erinnerungen */}
      {tab === 'mail' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveMail} className="space-y-6">
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
                        mailProvider === opt.id ? 'text-fire-900 dark:text-white' : 'text-slate-900 dark:text-slate-100'
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
                    onClick={() => void handleSendTestMail()}
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
                  onClick={() => void handleRunNotifications()}
                  disabled={runningNotify}
                >
                  <Play className="h-4 w-4" />
                  <span>{runningNotify ? 'Wird ausgeführt…' : 'Benachrichtigungen jetzt ausführen'}</span>
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
                onClick={async () => setLogs(await api.getNotificationLogs())}
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
                        <td className="px-4 py-2.5 whitespace-nowrap">
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
                            <span className="font-semibold text-red-600 dark:text-red-400" title={entry.error_message ?? ''}>
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
      )}

      {/* Tab 3: Kalender (iCal) */}
      {tab === 'calendar' && (
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
              <button type="button" className="btn-secondary shrink-0" onClick={() => void copyIcalUrl()}>
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
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setRotateConfirmOpen(true)}
            >
              <RefreshCw className="h-4 w-4" />
              <span>Abo-Token neu generieren</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Benutzer */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Rollen: <strong>Administrator</strong> (Vollzugriff), <strong>Prüfer</strong>{' '}
              (Kameraden & Kontrollen), <strong>Nur Lesen</strong> (Leserecht)
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={() => setPwModalOpen(true)}>
                <KeyRound className="h-4 w-4" />
                <span>Eigenes Passwort</span>
              </button>
              <button type="button" className="btn-primary" onClick={openNewUserForm}>
                <UserPlus className="h-4 w-4" />
                <span>Benutzer anlegen</span>
              </button>
            </div>
          </div>

          {userFormOpen && (
            <form onSubmit={handleSaveUser} className="card space-y-4 p-5">
              <h3 className="font-semibold">
                {editingUser ? `Benutzer „${editingUser.username}“ bearbeiten` : 'Neuer Benutzer'}
              </h3>

              <div className="grid gap-4 sm:grid-cols-2">
                {!editingUser && (
                  <div>
                    <label className="mb-1 block text-sm font-medium">Benutzername *</label>
                    <input
                      type="text"
                      className="input-field"
                      value={uUsername}
                      onChange={(e) => setUUsername(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-sm font-medium">Anzeigename *</label>
                  <input
                    type="text"
                    className="input-field"
                    value={uDisplayName}
                    onChange={(e) => setUDisplayName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">E-Mail</label>
                  <input
                    type="email"
                    className="input-field"
                    value={uEmail}
                    onChange={(e) => setUEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Rolle</label>
                  <select
                    className="input-field"
                    value={uRole}
                    onChange={(e) => setURole(e.target.value as UserRole)}
                  >
                    <option value="admin">Administrator</option>
                    <option value="inspector">Prüfer</option>
                    <option value="viewer">Nur Lesen</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Passwort {editingUser ? '(leer lassen = unverändert)' : '*'}
                  </label>
                  <input
                    type="password"
                    className="input-field"
                    value={uPassword}
                    onChange={(e) => setUPassword(e.target.value)}
                    required={!editingUser}
                    minLength={editingUser ? undefined : 4}
                  />
                </div>
              </div>

              <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-fire-600 focus:ring-fire-500"
                  checked={uActive}
                  onChange={(e) => setUActive(e.target.checked)}
                />
                <span>Konto aktiv</span>
              </label>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setUserFormOpen(false)}
                >
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary" disabled={savingUser}>
                  {savingUser ? 'Speichert…' : 'Speichern'}
                </button>
              </div>
            </form>
          )}

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Benutzer</th>
                    <th className="px-4 py-3 text-left font-semibold">Rolle</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                    <th className="px-4 py-3 text-left font-semibold">Letzter Login</th>
                    <th className="px-4 py-3 text-right font-semibold">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{u.display_name}</div>
                        <div className="text-xs text-slate-500">
                          @{u.username} {u.email ? `· ${u.email}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">{ROLE_LABELS[u.role]}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            u.active
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {u.active ? 'Aktiv' : 'Deaktiviert'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {u.last_login_at
                          ? new Date(u.last_login_at).toLocaleString('de-DE')
                          : 'Noch nie'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1.5">
                          <button
                            type="button"
                            className="btn-secondary !min-h-[38px] !px-3 text-xs"
                            onClick={() => openEditUserForm(u)}
                          >
                            Bearbeiten
                          </button>
                          <button
                            type="button"
                            className="btn-secondary !min-h-[38px] !px-2.5 text-red-600 hover:bg-red-50 dark:text-red-400"
                            onClick={() => setDeleteUserTarget(u)}
                            aria-label="Benutzer löschen"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Import/Export & Backup */}
      {tab === 'backup' && (
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
              <button type="button" className="btn-primary" onClick={() => setCsvModalOpen(true)}>
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
              Laden Sie ein konsistentes SQLite-Backup oder ein portables JSON-Backup herunter. Ein
              JSON-Backup kann hier direkt wiederhergestellt werden.
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
                  onChange={handleSqliteFileSelect}
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
                  onChange={handleBackupFileSelect}
                />
              </label>
            </div>
          </section>
        </div>
      )}

      <CsvImportModal
        open={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onImported={() => void loadAll()}
      />

      <ChangePasswordModal open={pwModalOpen} onClose={() => setPwModalOpen(false)} />

      <ConfirmDialog
        open={rotateConfirmOpen}
        title="iCal-Token neu generieren?"
        message="Die bisherige Kalender-Abo-URL wird sofort ungültig und muss in allen abonnierten Kalendern aktualisiert werden."
        confirmLabel="Token neu generieren"
        loading={rotatingToken}
        onConfirm={() => void handleRotateIcal()}
        onCancel={() => setRotateConfirmOpen(false)}
      />

      <ConfirmDialog
        open={deleteUserTarget !== null}
        title="Benutzer löschen?"
        message={`Möchten Sie das Konto „${deleteUserTarget?.display_name ?? ''}“ wirklich löschen?`}
        confirmLabel="Löschen"
        onConfirm={() => void handleDeleteUser()}
        onCancel={() => setDeleteUserTarget(null)}
      />

      <ConfirmDialog
        open={restoreConfirmOpen}
        title="JSON-Backup wiederherstellen?"
        message="Achtung: Alle aktuellen Kameraden, Führerscheine, Kontrollen und Fahrzeuge werden durch die Daten aus dem JSON-Backup ersetzt! Benutzerkonten und Mail-Zugangsdaten bleiben erhalten."
        confirmLabel="Jetzt wiederherstellen"
        loading={restoring}
        onConfirm={() => void handleRestoreJson()}
        onCancel={() => {
          setRestoreConfirmOpen(false);
          setPendingBackupJson(null);
        }}
      />

      <ConfirmDialog
        open={sqliteRestoreConfirmOpen}
        title="SQLite-Backup (.db) importieren?"
        message={`Achtung: Alle aktuellen Kameraden, Führerscheine, Kontrollen, Fahrzeuge und allgemeinen Einstellungen werden durch den Inhalt der Datei „${pendingSqliteFile?.name ?? ''}“ ersetzt! Lokale Benutzerkonten und Mail-Zugangsdaten bleiben erhalten.`}
        confirmLabel="SQLite-Backup einspielen"
        loading={restoring}
        onConfirm={() => void handleRestoreSqlite()}
        onCancel={() => {
          setSqliteRestoreConfirmOpen(false);
          setPendingSqliteFile(null);
        }}
      />
    </div>
  );
}
