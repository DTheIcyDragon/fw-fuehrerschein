import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Database, Mail, Settings2, Users } from 'lucide-react';
import type {
  AppSettingsPublic,
  FederalStateCode,
  MailProvider,
  NotificationLogEntry,
  PublicUser,
  StateRuleConfig,
  UserRole,
} from '@shared/types';
import { getDefaultStateRules } from '@shared/licenseRules';
import { api, ApiError } from '../api';
import { ChangePasswordModal } from '../components/ChangePasswordModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CsvImportModal } from '../components/CsvImportModal';
import { BackupSettingsTab } from '../components/settings/BackupSettingsTab';
import { CalendarSettingsTab } from '../components/settings/CalendarSettingsTab';
import { GeneralSettingsTab } from '../components/settings/GeneralSettingsTab';
import { MailSettingsTab } from '../components/settings/MailSettingsTab';
import { UsersSettingsTab } from '../components/settings/UsersSettingsTab';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

type SettingsTab = 'general' | 'mail' | 'calendar' | 'users' | 'backup';

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
      setLogs(await api.getNotificationLogs());
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
      setLogs(await api.getNotificationLogs());
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
    if ((!editingUser || uPassword) && uPassword.length < 8) {
      showToast('Das Passwort muss mindestens 8 Zeichen lang sein.', 'error');
      return;
    }
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
      showToast(
        err instanceof ApiError ? err.message : 'Benutzer konnte nicht gespeichert werden.',
        'error',
      );
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
      showToast(
        err instanceof ApiError ? err.message : 'Benutzer konnte nicht gelöscht werden.',
        'error',
      );
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
          Prüffristen, Bundesland-Regeln, Benachrichtigungen (SMTP / JMAP), Kalender-Abo, Benutzer &
          Datensicherung
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

      {tab === 'general' && (
        <GeneralSettingsTab
          departmentName={departmentName}
          setDepartmentName={setDepartmentName}
          intervalMonths={intervalMonths}
          setIntervalMonths={setIntervalMonths}
          licenseWarnDays={licenseWarnDays}
          setLicenseWarnDays={setLicenseWarnDays}
          inspectionWarnDays={inspectionWarnDays}
          setInspectionWarnDays={setInspectionWarnDays}
          federalState={federalState}
          setFederalState={setFederalState}
          stateRules={stateRules}
          setStateRules={setStateRules}
          compareOpen={compareOpen}
          setCompareOpen={setCompareOpen}
          compareState={compareState}
          setCompareState={setCompareState}
          saving={saving}
          onSave={handleSaveGeneral}
          onNotifyInfo={(msg) => showToast(msg, 'info')}
        />
      )}

      {tab === 'mail' && (
        <MailSettingsTab
          settings={settings}
          mailProvider={mailProvider}
          setMailProvider={setMailProvider}
          smtpHost={smtpHost}
          setSmtpHost={setSmtpHost}
          smtpPort={smtpPort}
          setSmtpPort={setSmtpPort}
          smtpSecure={smtpSecure}
          setSmtpSecure={setSmtpSecure}
          smtpUsername={smtpUsername}
          setSmtpUsername={setSmtpUsername}
          smtpPassword={smtpPassword}
          setSmtpPassword={setSmtpPassword}
          smtpFromEmail={smtpFromEmail}
          setSmtpFromEmail={setSmtpFromEmail}
          smtpFromName={smtpFromName}
          setSmtpFromName={setSmtpFromName}
          smtpRejectUnauth={smtpRejectUnauth}
          setSmtpRejectUnauth={setSmtpRejectUnauth}
          jmapSessionUrl={jmapSessionUrl}
          setJmapSessionUrl={setJmapSessionUrl}
          jmapAuthType={jmapAuthType}
          setJmapAuthType={setJmapAuthType}
          jmapUsername={jmapUsername}
          setJmapUsername={setJmapUsername}
          jmapToken={jmapToken}
          setJmapToken={setJmapToken}
          jmapPassword={jmapPassword}
          setJmapPassword={setJmapPassword}
          jmapFromEmail={jmapFromEmail}
          setJmapFromEmail={setJmapFromEmail}
          jmapFromName={jmapFromName}
          setJmapFromName={setJmapFromName}
          jmapAccountId={jmapAccountId}
          setJmapAccountId={setJmapAccountId}
          digestEnabled={digestEnabled}
          setDigestEnabled={setDigestEnabled}
          digestFreq={digestFreq}
          setDigestFreq={setDigestFreq}
          digestWeekday={digestWeekday}
          setDigestWeekday={setDigestWeekday}
          digestHour={digestHour}
          setDigestHour={setDigestHour}
          digestRecipients={digestRecipients}
          setDigestRecipients={setDigestRecipients}
          membersNotifyEnabled={membersNotifyEnabled}
          setMembersNotifyEnabled={setMembersNotifyEnabled}
          memberDaysBefore={memberDaysBefore}
          setMemberDaysBefore={setMemberDaysBefore}
          testEmail={testEmail}
          setTestEmail={setTestEmail}
          sendingTest={sendingTest}
          runningNotify={runningNotify}
          saving={saving}
          logs={logs}
          onSaveMail={handleSaveMail}
          onSendTestMail={() => void handleSendTestMail()}
          onRunNotifications={() => void handleRunNotifications()}
          onRefreshLogs={async () => setLogs(await api.getNotificationLogs())}
        />
      )}

      {tab === 'calendar' && (
        <CalendarSettingsTab
          icalSubscribeUrl={icalSubscribeUrl}
          onCopyUrl={() => void copyIcalUrl()}
          onOpenRotateConfirm={() => setRotateConfirmOpen(true)}
        />
      )}

      {tab === 'users' && (
        <UsersSettingsTab
          users={users}
          userFormOpen={userFormOpen}
          editingUser={editingUser}
          uUsername={uUsername}
          setUUsername={setUUsername}
          uDisplayName={uDisplayName}
          setUDisplayName={setUDisplayName}
          uEmail={uEmail}
          setUEmail={setUEmail}
          uRole={uRole}
          setURole={setURole}
          uActive={uActive}
          setUActive={setUActive}
          uPassword={uPassword}
          setUPassword={setUPassword}
          savingUser={savingUser}
          onOpenPasswordModal={() => setPwModalOpen(true)}
          onOpenNewUserForm={openNewUserForm}
          onOpenEditUserForm={openEditUserForm}
          onCloseUserForm={() => setUserFormOpen(false)}
          onSaveUser={handleSaveUser}
          onDeleteUser={(u) => setDeleteUserTarget(u)}
        />
      )}

      {tab === 'backup' && (
        <BackupSettingsTab
          onOpenCsvImport={() => setCsvModalOpen(true)}
          onSqliteFileSelect={handleSqliteFileSelect}
          onBackupFileSelect={handleBackupFileSelect}
        />
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
