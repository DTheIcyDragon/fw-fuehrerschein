import type { EvaluatedMember, NotificationLogEntry } from '../../../shared/types.js';
import {
  LICENSE_CLASS_SHORT_LABELS,
  formatDateDe,
  getTodayIsoDate,
  isValidIsoDate,
} from '../../../shared/licenseRules.js';
import type { AppDatabase } from '../db/database.js';
import { HttpError } from '../utils/asyncHandler.js';
import type { EvaluationService } from './evaluation.js';
import { sendMail } from './mail.js';
import type { RawMailConfig, SettingsService } from './settings.js';

export interface NotificationRunResult {
  digestSent: number;
  memberEmailsSent: number;
  digestErrors: string[];
  memberErrors: string[];
  errors: string[];
  skippedReason?: string;
}

export interface NotificationServiceDeps {
  db: AppDatabase;
  settings: SettingsService;
  evaluation: EvaluationService;
}

function isUnchangedSecret(value: unknown): boolean {
  return value === undefined || value === null || value === '' || value === '********';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mergeMailConfig(
  stored: RawMailConfig,
  override?: Partial<RawMailConfig>,
): RawMailConfig {
  if (!override) return stored;

  const provider = override.provider ?? stored.provider;
  const ovSmtp = override.smtp;
  const ovJmap = override.jmap;

  return {
    provider,
    smtp: {
      host: ovSmtp?.host ?? stored.smtp.host,
      port: ovSmtp?.port !== undefined ? Number(ovSmtp.port) || 587 : stored.smtp.port,
      secure: ovSmtp?.secure !== undefined ? Boolean(ovSmtp.secure) : stored.smtp.secure,
      username: ovSmtp?.username ?? stored.smtp.username,
      password:
        ovSmtp && !isUnchangedSecret(ovSmtp.password)
          ? String(ovSmtp.password)
          : stored.smtp.password,
      fromEmail: ovSmtp?.fromEmail ?? stored.smtp.fromEmail,
      fromName: ovSmtp?.fromName ?? stored.smtp.fromName,
      rejectUnauthorized:
        ovSmtp?.rejectUnauthorized !== undefined
          ? Boolean(ovSmtp.rejectUnauthorized)
          : stored.smtp.rejectUnauthorized,
    },
    jmap: {
      sessionUrl: ovJmap?.sessionUrl ?? stored.jmap.sessionUrl,
      authType: ovJmap?.authType ?? stored.jmap.authType,
      username: ovJmap?.username ?? stored.jmap.username,
      token:
        ovJmap && !isUnchangedSecret(ovJmap.token)
          ? String(ovJmap.token).trim()
          : stored.jmap.token,
      password:
        ovJmap && !isUnchangedSecret(ovJmap.password)
          ? String(ovJmap.password)
          : stored.jmap.password,
      fromEmail: ovJmap?.fromEmail ?? stored.jmap.fromEmail,
      fromName: ovJmap?.fromName ?? stored.jmap.fromName,
      accountId: ovJmap?.accountId ?? stored.jmap.accountId,
    },
  };
}

function findThresholdBucket(daysRemaining: number, sortedThresholdsAsc: number[]): string | null {
  if (daysRemaining < 0) return 'expired';
  for (const t of sortedThresholdsAsc) {
    if (daysRemaining <= t) {
      return `t${t}`;
    }
  }
  return null;
}

export class NotificationService {
  private readonly db: AppDatabase;
  private readonly settings: SettingsService;
  private readonly evaluation: EvaluationService;

  constructor(deps: NotificationServiceDeps) {
    this.db = deps.db;
    this.settings = deps.settings;
    this.evaluation = deps.evaluation;
  }

  private wasAlreadySent(dedupeKey: string): boolean {
    const row = this.db
      .prepare("SELECT id FROM notification_logs WHERE dedupe_key = ? AND status = 'sent' LIMIT 1")
      .get(dedupeKey) as { id: number } | undefined;
    return Boolean(row);
  }

  private insertLog(entry: {
    dedupe_key: string | null;
    recipient: string;
    channel: string;
    subject: string;
    status: 'sent' | 'failed';
    error_message: string | null;
  }): void {
    this.db
      .prepare(
        `INSERT INTO notification_logs (dedupe_key, recipient, channel, subject, status, error_message, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.dedupe_key,
        entry.recipient,
        entry.channel,
        entry.subject,
        entry.status,
        entry.error_message,
        new Date().toISOString(),
      );
  }

  listLogs(limit = 100): NotificationLogEntry[] {
    const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
    return this.db
      .prepare(
        `SELECT id, dedupe_key, recipient, channel, subject, status, error_message, sent_at
         FROM notification_logs
         ORDER BY id DESC
         LIMIT ?`,
      )
      .all(safeLimit) as unknown as NotificationLogEntry[];
  }

  async sendTestMail(
    toEmail: string,
    overrideRawMail?: Partial<RawMailConfig>,
  ): Promise<void> {
    const trimmedTo = toEmail.trim();
    if (!trimmedTo || !trimmedTo.includes('@')) {
      throw new HttpError(400, 'Bitte eine gültige Empfänger-E-Mail-Adresse angeben.');
    }

    const stored = this.settings.getRawMailConfig();
    const config = mergeMailConfig(stored, overrideRawMail);
    if (config.provider === 'none') {
      throw new HttpError(400, 'Bitte zuerst einen E-Mail-Provider (SMTP oder JMAP) auswählen.');
    }

    const departmentName = this.settings.getDepartmentName();
    const subject = `[${departmentName}] Test-E-Mail (Führerscheinverwaltung)`;
    const text = [
      `Hallo,`,
      ``,
      `dies ist eine Test-E-Mail der Führerscheinverwaltung (${departmentName}).`,
      `Der E-Mail-Versand über ${config.provider.toUpperCase()} funktioniert korrekt.`,
      ``,
      `Zeitstempel: ${new Date().toISOString()}`,
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1e293b;">
        <h2 style="color: #b91c1c; margin-bottom: 8px;">${escapeHtml(departmentName)}</h2>
        <p>Dies ist eine Test-E-Mail der <strong>Führerscheinverwaltung</strong>.</p>
        <p>Der E-Mail-Versand über <strong>${escapeHtml(config.provider.toUpperCase())}</strong> funktioniert korrekt.</p>
        <p style="font-size: 12px; color: #64748b;">Zeitstempel: ${escapeHtml(new Date().toISOString())}</p>
      </div>
    `;

    try {
      await sendMail(config, { to: trimmedTo, subject, text, html });
      this.insertLog({
        dedupe_key: null,
        recipient: trimmedTo,
        channel: config.provider,
        subject,
        status: 'sent',
        error_message: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.insertLog({
        dedupe_key: null,
        recipient: trimmedTo,
        channel: config.provider,
        subject,
        status: 'failed',
        error_message: msg,
      });
      throw new HttpError(502, `Test-E-Mail fehlgeschlagen: ${msg}`);
    }
  }

  private getDigestRecipients(): string[] {
    const publicSettings = this.settings.getPublicSettings();
    const configured = publicSettings.notify_digest_recipients
      .map((r) => r.trim())
      .filter((r) => r.includes('@'));
    if (configured.length > 0) {
      return Array.from(new Set(configured));
    }

    const adminRows = this.db
      .prepare(
        "SELECT email FROM users WHERE active = 1 AND role = 'admin' AND email IS NOT NULL AND trim(email) != ''",
      )
      .all() as Array<{ email: string }>;

    return Array.from(
      new Set(
        adminRows
          .map((r) => r.email.trim())
          .filter((e) => e.includes('@')),
      ),
    );
  }

  private buildDigestContent(
    departmentName: string,
    members: EvaluatedMember[],
  ): { subject: string; text: string; html: string } | null {
    const attention = members.filter((m) => m.evaluation.overallStatus !== 'green');
    if (attention.length === 0) return null;

    const redMembers = attention.filter((m) => m.evaluation.overallStatus === 'red');
    const yellowMembers = attention.filter((m) => m.evaluation.overallStatus === 'yellow');

    const subject = `[${departmentName}] Führerschein-Digest: ${redMembers.length} gesperrt / ${yellowMembers.length} Warnungen`;

    const formatMemberLine = (m: EvaluatedMember): string => {
      const name = `${m.last_name}, ${m.first_name}${m.unit ? ` (${m.unit})` : ''}`;
      return `- ${name}: ${m.evaluation.reasons.join('; ')}`;
    };

    const textParts: string[] = [
      `Führerscheinverwaltung - ${departmentName}`,
      `Stand: ${formatDateDe(getTodayIsoDate())}`,
      ``,
      `Zusammenfassung: ${redMembers.length}x Rot (Handlungsbedarf / Gesperrt), ${yellowMembers.length}x Gelb (Vorwarnung / Fällig)`,
      ``,
    ];

    if (redMembers.length > 0) {
      textParts.push('=== ROT / DRINGEND ===');
      for (const m of redMembers) textParts.push(formatMemberLine(m));
      textParts.push('');
    }
    if (yellowMembers.length > 0) {
      textParts.push('=== GELB / BALD FÄLLIG ===');
      for (const m of yellowMembers) textParts.push(formatMemberLine(m));
      textParts.push('');
    }

    const renderListHtml = (list: EvaluatedMember[], color: string, title: string) => {
      if (list.length === 0) return '';
      const items = list
        .map(
          (m) =>
            `<li><strong>${escapeHtml(m.last_name)}, ${escapeHtml(m.first_name)}</strong>${
              m.unit ? ` (${escapeHtml(m.unit)})` : ''
            }: ${escapeHtml(m.evaluation.reasons.join('; '))}</li>`,
        )
        .join('');
      return `<h3 style="color:${color}; margin-top:16px;">${escapeHtml(title)} (${list.length})</h3><ul>${items}</ul>`;
    };

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1e293b;">
        <h2 style="color: #b91c1c; margin-bottom: 4px;">${escapeHtml(departmentName)} - Führerschein-Digest</h2>
        <p style="color: #64748b; margin-top: 0;">Stand: ${escapeHtml(formatDateDe(getTodayIsoDate()))}</p>
        ${renderListHtml(redMembers, '#b91c1c', 'Rot / Gesperrt / Abgelaufen')}
        ${renderListHtml(yellowMembers, '#b45309', 'Gelb / Fällig / Vorwarnung')}
      </div>
    `;

    return { subject, text: textParts.join('\n'), html };
  }

  async runNotifications(opts?: {
    forceDigest?: boolean;
    sendDigest?: boolean;
    sendMembers?: boolean;
  }): Promise<NotificationRunResult> {
    const mailConfig = this.settings.getRawMailConfig();
    if (mailConfig.provider === 'none') {
      return {
        digestSent: 0,
        memberEmailsSent: 0,
        digestErrors: [],
        memberErrors: [],
        errors: [],
        skippedReason: 'Kein E-Mail-Provider konfiguriert.',
      };
    }

    const sendDigest = opts?.sendDigest !== false;
    const sendMembers = opts?.sendMembers !== false;
    const forceDigest = Boolean(opts?.forceDigest);

    const today = getTodayIsoDate();
    const departmentName = this.settings.getDepartmentName();
    const publicSettings = this.settings.getPublicSettings();
    const activeMembers = this.evaluation.listEvaluatedMembers({ status: 'active' });

    let digestSent = 0;
    let memberEmailsSent = 0;
    const digestErrors: string[] = [];
    const memberErrors: string[] = [];

    if (sendDigest) {
      const digestContent = this.buildDigestContent(departmentName, activeMembers);
      const recipients = this.getDigestRecipients();

      if (digestContent && recipients.length > 0) {
        for (const recipient of recipients) {
          const dedupeKey = forceDigest ? null : `digest:${today}:${recipient.toLowerCase()}`;
          if (dedupeKey && this.wasAlreadySent(dedupeKey)) {
            continue;
          }
          try {
            await sendMail(mailConfig, {
              to: recipient,
              subject: digestContent.subject,
              text: digestContent.text,
              html: digestContent.html,
            });
            this.insertLog({
              dedupe_key: dedupeKey,
              recipient,
              channel: mailConfig.provider,
              subject: digestContent.subject,
              status: 'sent',
              error_message: null,
            });
            digestSent++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            digestErrors.push(`Digest an ${recipient}: ${msg}`);
            this.insertLog({
              dedupe_key: null,
              recipient,
              channel: mailConfig.provider,
              subject: digestContent.subject,
              status: 'failed',
              error_message: msg,
            });
          }
        }
      }
    }

    if (sendMembers) {
      const thresholdsAsc = [...publicSettings.notify_member_days_before]
        .filter((n) => Number.isInteger(n) && n >= 0)
        .sort((a, b) => a - b);

      if (thresholdsAsc.length > 0) {
        for (const member of activeMembers) {
          const email = member.email?.trim();
          if (!email || !email.includes('@')) continue;

          const events: Array<{
            dedupeKey: string;
            subject: string;
            bodyLine: string;
          }> = [];

          // 1. Inspection due / overdue
          const insp = member.evaluation.inspection;
          if (insp.nextDueAt && insp.daysUntilDue !== null && insp.lastResult !== 'issue') {
            const bucket = findThresholdBucket(insp.daysUntilDue, thresholdsAsc);
            if (bucket) {
              events.push({
                dedupeKey: `member:${member.id}:inspection:${insp.nextDueAt}:${bucket}`,
                subject: `[${departmentName}] Erinnerung: Führerscheinkontrolle ${insp.daysUntilDue < 0 ? 'überfällig' : 'fällig'}`,
                bodyLine:
                  insp.daysUntilDue < 0
                    ? `Deine Führerscheinkontrolle ist seit ${formatDateDe(insp.nextDueAt)} überfällig.`
                    : `Deine nächste Führerscheinkontrolle ist am ${formatDateDe(insp.nextDueAt)} fällig (in ${insp.daysUntilDue} Tag(en)).`,
              });
            }
          }

          // 2. Expiring / expired license classes
          for (const lic of member.evaluation.licenses) {
            if (!lic.expires_at || !isValidIsoDate(lic.expires_at) || lic.daysUntilExpiry === null) {
              continue;
            }
            const bucket = findThresholdBucket(lic.daysUntilExpiry, thresholdsAsc);
            if (bucket) {
              const label = LICENSE_CLASS_SHORT_LABELS[lic.license_class];
              events.push({
                dedupeKey: `member:${member.id}:license:${lic.license_class}:${lic.expires_at}:${bucket}`,
                subject: `[${departmentName}] Erinnerung: Klasse ${label} ${lic.daysUntilExpiry < 0 ? 'abgelaufen' : 'läuft ab'}`,
                bodyLine:
                  lic.daysUntilExpiry < 0
                    ? `Deine Führerscheinklasse ${label} ist am ${formatDateDe(lic.expires_at)} abgelaufen.`
                    : `Deine Führerscheinklasse ${label} läuft am ${formatDateDe(lic.expires_at)} ab (in ${lic.daysUntilExpiry} Tag(en)).`,
              });
            }
          }

          // 3. Expiring / expired card
          if (
            member.card_expires_at &&
            isValidIsoDate(member.card_expires_at) &&
            member.evaluation.cardDaysUntilExpiry !== null
          ) {
            const days = member.evaluation.cardDaysUntilExpiry;
            const bucket = findThresholdBucket(days, thresholdsAsc);
            if (bucket) {
              events.push({
                dedupeKey: `member:${member.id}:card:${member.card_expires_at}:${bucket}`,
                subject: `[${departmentName}] Erinnerung: Führerscheinkarte ${days < 0 ? 'abgelaufen' : 'läuft ab'}`,
                bodyLine:
                  days < 0
                    ? `Deine Führerscheinkarte ist am ${formatDateDe(member.card_expires_at)} abgelaufen.`
                    : `Deine Führerscheinkarte läuft am ${formatDateDe(member.card_expires_at)} ab (in ${days} Tag(en)).`,
              });
            }
          }

          for (const ev of events) {
            if (this.wasAlreadySent(ev.dedupeKey)) {
              continue;
            }
            const text = [
              `Hallo ${member.first_name} ${member.last_name},`,
              ``,
              ev.bodyLine,
              ``,
              `Bitte melde dich rechtzeitig bei der Wehrführung bzw. dem Gerätewart zur Prüfung / Vorlage.`,
              ``,
              `Viele Grüße`,
              departmentName,
            ].join('\n');

            const html = `
              <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1e293b;">
                <p>Hallo ${escapeHtml(member.first_name)} ${escapeHtml(member.last_name)},</p>
                <p><strong>${escapeHtml(ev.bodyLine)}</strong></p>
                <p>Bitte melde dich rechtzeitig bei der Wehrführung bzw. dem Gerätewart.</p>
                <p style="color: #64748b;">Viele Grüße<br/>${escapeHtml(departmentName)}</p>
              </div>
            `;

            try {
              await sendMail(mailConfig, {
                to: email,
                subject: ev.subject,
                text,
                html,
              });
              this.insertLog({
                dedupe_key: ev.dedupeKey,
                recipient: email,
                channel: mailConfig.provider,
                subject: ev.subject,
                status: 'sent',
                error_message: null,
              });
              memberEmailsSent++;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              memberErrors.push(`Erinnerung an ${email}: ${msg}`);
              this.insertLog({
                dedupe_key: null,
                recipient: email,
                channel: mailConfig.provider,
                subject: ev.subject,
                status: 'failed',
                error_message: msg,
              });
            }
          }
        }
      }
    }

    return {
      digestSent,
      memberEmailsSent,
      digestErrors,
      memberErrors,
      errors: [...digestErrors, ...memberErrors],
    };
  }
}
