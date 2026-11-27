import {
  FEDERAL_STATE_PRESETS,
  getDefaultStateRules,
} from '../../../shared/licenseRules.js';
import type {
  AppSettingsPublic,
  FederalStateCode,
  MailProvider,
  RuleSettings,
  StateRuleConfig,
} from '../../../shared/types.js';
import type { AppDatabase } from '../db/database.js';
import { HttpError } from '../utils/asyncHandler.js';
import { randomToken, type SecretBox } from '../utils/crypto.js';

export interface RawMailConfig {
  provider: MailProvider;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
    fromEmail: string;
    fromName: string;
    rejectUnauthorized: boolean;
  };
  jmap: {
    sessionUrl: string;
    authType: 'bearer' | 'basic';
    username: string;
    token: string;
    password: string;
    fromEmail: string;
    fromName: string;
    accountId: string;
  };
}

interface StoredSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  passwordEncrypted: string;
  fromEmail: string;
  fromName: string;
  rejectUnauthorized: boolean;
}

interface StoredJmapConfig {
  sessionUrl: string;
  authType: 'bearer' | 'basic';
  username: string;
  tokenEncrypted: string;
  passwordEncrypted: string;
  fromEmail: string;
  fromName: string;
  accountId: string;
}

const DEFAULT_STORED_SMTP: StoredSmtpConfig = {
  host: '',
  port: 587,
  secure: false,
  username: '',
  passwordEncrypted: '',
  fromEmail: '',
  fromName: '',
  rejectUnauthorized: true,
};

const DEFAULT_STORED_JMAP: StoredJmapConfig = {
  sessionUrl: '',
  authType: 'bearer',
  username: '',
  tokenEncrypted: '',
  passwordEncrypted: '',
  fromEmail: '',
  fromName: '',
  accountId: '',
};

function isUnchangedSecret(value: unknown): boolean {
  return value === undefined || value === null || value === '' || value === '********';
}

function asNonNegativeInt(value: unknown, fieldName: string, min = 0, max = 3650): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new HttpError(400, `${fieldName} muss eine ganze Zahl zwischen ${min} und ${max} sein`);
  }
  return num;
}

export class SettingsService {
  constructor(
    private readonly db: AppDatabase,
    private readonly secretBox: SecretBox,
  ) {}

  getSettingRaw<T>(key: string, fallback: T): T {
    const row = this.db
      .prepare('SELECT value_json FROM settings WHERE key = ?')
      .get(key) as { value_json: string } | undefined;
    if (!row) {
      return fallback;
    }
    try {
      return JSON.parse(row.value_json) as T;
    } catch {
      return fallback;
    }
  }

  setSettingRaw(key: string, value: unknown): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO settings (key, value_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET
           value_json = excluded.value_json,
           updated_at = excluded.updated_at`,
      )
      .run(key, JSON.stringify(value), now);
  }

  getDepartmentName(): string {
    const name = this.getSettingRaw<string>('department_name', 'Freiwillige Feuerwehr');
    return typeof name === 'string' && name.trim() ? name.trim() : 'Freiwillige Feuerwehr';
  }

  getFederalState(): FederalStateCode {
    const raw = this.getSettingRaw<string>('federal_state', 'SH');
    if (typeof raw === 'string' && raw in FEDERAL_STATE_PRESETS) {
      return raw as FederalStateCode;
    }
    return 'SH';
  }

  getStateRules(): StateRuleConfig {
    const federalState = this.getFederalState();
    const defaults = getDefaultStateRules(federalState);
    const stored = this.getSettingRaw<Partial<StateRuleConfig>>('state_rules', {});
    if (!stored || typeof stored !== 'object') {
      return defaults;
    }
    const renewalRaw =
      stored.fw_renewal_months === null || stored.fw_renewal_months === undefined
        ? defaults.fw_renewal_months
        : Number(stored.fw_renewal_months);
    return {
      fw_475_enabled:
        stored.fw_475_enabled !== undefined
          ? Boolean(stored.fw_475_enabled)
          : defaults.fw_475_enabled,
      fw_750_enabled:
        stored.fw_750_enabled !== undefined
          ? Boolean(stored.fw_750_enabled)
          : defaults.fw_750_enabled,
      fw_require_valid_b:
        stored.fw_require_valid_b !== undefined
          ? Boolean(stored.fw_require_valid_b)
          : defaults.fw_require_valid_b,
      fw_min_b_years:
        stored.fw_min_b_years !== undefined && Number.isFinite(Number(stored.fw_min_b_years))
          ? Math.max(0, Math.min(20, Math.floor(Number(stored.fw_min_b_years))))
          : defaults.fw_min_b_years,
      fw_allow_trailers:
        stored.fw_allow_trailers !== undefined
          ? Boolean(stored.fw_allow_trailers)
          : defaults.fw_allow_trailers,
      fw_renewal_months:
        renewalRaw !== null && Number.isFinite(renewalRaw) && renewalRaw > 0
          ? Math.floor(renewalRaw)
          : null,
      strict_inspection_blocking:
        stored.strict_inspection_blocking !== undefined
          ? Boolean(stored.strict_inspection_blocking)
          : defaults.strict_inspection_blocking,
      expired_card_blocks_driving:
        stored.expired_card_blocks_driving !== undefined
          ? Boolean(stored.expired_card_blocks_driving)
          : defaults.expired_card_blocks_driving,
      custom_rules_notes:
        stored.custom_rules_notes !== undefined
          ? String(stored.custom_rules_notes)
          : defaults.custom_rules_notes,
    };
  }

  getRuleSettings(): RuleSettings {
    const interval = Number(this.getSettingRaw<number>('inspection_interval_months', 6));
    const licenseWarn = Number(this.getSettingRaw<number>('license_warn_days', 90));
    const inspectionWarn = Number(this.getSettingRaw<number>('inspection_warn_days', 30));
    return {
      inspection_interval_months: Number.isFinite(interval) && interval >= 1 ? interval : 6,
      license_warn_days: Number.isFinite(licenseWarn) && licenseWarn >= 0 ? licenseWarn : 90,
      inspection_warn_days: Number.isFinite(inspectionWarn) && inspectionWarn >= 0 ? inspectionWarn : 30,
      federal_state: this.getFederalState(),
      state_rules: this.getStateRules(),
    };
  }

  getIcalToken(): string {
    const existing = this.getSettingRaw<string>('ical_token', '');
    if (typeof existing === 'string' && existing.trim().length > 0) {
      return existing;
    }
    const token = randomToken(32);
    this.setSettingRaw('ical_token', token);
    return token;
  }

  rotateIcalToken(): string {
    const token = randomToken(32);
    this.setSettingRaw('ical_token', token);
    return token;
  }

  private getStoredSmtp(): StoredSmtpConfig {
    const stored = this.getSettingRaw<Partial<StoredSmtpConfig>>('smtp_config', {});
    return { ...DEFAULT_STORED_SMTP, ...stored };
  }

  private getStoredJmap(): StoredJmapConfig {
    const stored = this.getSettingRaw<Partial<StoredJmapConfig>>('jmap_config', {});
    return { ...DEFAULT_STORED_JMAP, ...stored };
  }

  getRawMailConfig(): RawMailConfig {
    const providerRaw = this.getSettingRaw<string>('mail_provider', 'none');
    const provider: MailProvider =
      providerRaw === 'smtp' || providerRaw === 'jmap' ? providerRaw : 'none';
    const smtp = this.getStoredSmtp();
    const jmap = this.getStoredJmap();

    return {
      provider,
      smtp: {
        host: smtp.host,
        port: Number(smtp.port) || 587,
        secure: Boolean(smtp.secure),
        username: smtp.username,
        password: smtp.passwordEncrypted ? this.secretBox.decrypt(smtp.passwordEncrypted) : '',
        fromEmail: smtp.fromEmail,
        fromName: smtp.fromName,
        rejectUnauthorized: smtp.rejectUnauthorized !== false,
      },
      jmap: {
        sessionUrl: jmap.sessionUrl,
        authType: jmap.authType === 'basic' ? 'basic' : 'bearer',
        username: jmap.username,
        token: jmap.tokenEncrypted ? this.secretBox.decrypt(jmap.tokenEncrypted) : '',
        password: jmap.passwordEncrypted ? this.secretBox.decrypt(jmap.passwordEncrypted) : '',
        fromEmail: jmap.fromEmail,
        fromName: jmap.fromName,
        accountId: jmap.accountId,
      },
    };
  }

  getPublicSettings(): AppSettingsPublic {
    const rules = this.getRuleSettings();
    const providerRaw = this.getSettingRaw<string>('mail_provider', 'none');
    const mail_provider: MailProvider =
      providerRaw === 'smtp' || providerRaw === 'jmap' ? providerRaw : 'none';
    const smtp = this.getStoredSmtp();
    const jmap = this.getStoredJmap();

    const freqRaw = this.getSettingRaw<string>('notify_digest_frequency', 'weekly');
    const notify_digest_frequency: 'daily' | 'weekly' = freqRaw === 'daily' ? 'daily' : 'weekly';

    const recipientsRaw = this.getSettingRaw<unknown>('notify_digest_recipients', []);
    const notify_digest_recipients = Array.isArray(recipientsRaw)
      ? recipientsRaw.map((v) => String(v).trim()).filter(Boolean)
      : [];

    const daysRaw = this.getSettingRaw<unknown>('notify_member_days_before', [90, 30, 7]);
    const notify_member_days_before = Array.isArray(daysRaw)
      ? daysRaw.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n >= 0)
      : [90, 30, 7];

    return {
      department_name: this.getDepartmentName(),
      inspection_interval_months: rules.inspection_interval_months,
      license_warn_days: rules.license_warn_days,
      inspection_warn_days: rules.inspection_warn_days,
      federal_state: this.getFederalState(),
      state_rules: this.getStateRules(),
      ical_token: this.getIcalToken(),
      mail_provider,
      smtp: {
        host: smtp.host,
        port: Number(smtp.port) || 587,
        secure: Boolean(smtp.secure),
        username: smtp.username,
        hasPassword: Boolean(smtp.passwordEncrypted),
        fromEmail: smtp.fromEmail,
        fromName: smtp.fromName,
        rejectUnauthorized: smtp.rejectUnauthorized !== false,
      },
      jmap: {
        sessionUrl: jmap.sessionUrl,
        authType: jmap.authType === 'basic' ? 'basic' : 'bearer',
        username: jmap.username,
        hasToken: Boolean(jmap.tokenEncrypted),
        hasPassword: Boolean(jmap.passwordEncrypted),
        fromEmail: jmap.fromEmail,
        fromName: jmap.fromName,
        accountId: jmap.accountId,
      },
      notify_digest_enabled: Boolean(this.getSettingRaw<boolean>('notify_digest_enabled', false)),
      notify_digest_frequency,
      notify_digest_weekday: Number(this.getSettingRaw<number>('notify_digest_weekday', 1)),
      notify_digest_hour: Number(this.getSettingRaw<number>('notify_digest_hour', 8)),
      notify_digest_recipients,
      notify_members_enabled: Boolean(this.getSettingRaw<boolean>('notify_members_enabled', false)),
      notify_member_days_before,
    };
  }

  updateSettings(patch: Record<string, unknown>): AppSettingsPublic {
    if ('department_name' in patch) {
      const val = String(patch.department_name ?? '').trim();
      if (!val) {
        throw new HttpError(400, 'Name der Feuerwehr darf nicht leer sein');
      }
      this.setSettingRaw('department_name', val);
    }

    if ('inspection_interval_months' in patch) {
      this.setSettingRaw(
        'inspection_interval_months',
        asNonNegativeInt(patch.inspection_interval_months, 'Kontrollintervall (Monate)', 1, 120),
      );
    }

    if ('license_warn_days' in patch) {
      this.setSettingRaw(
        'license_warn_days',
        asNonNegativeInt(patch.license_warn_days, 'Vorwarnzeit Klassen/Karte (Tage)', 0, 730),
      );
    }

    if ('inspection_warn_days' in patch) {
      this.setSettingRaw(
        'inspection_warn_days',
        asNonNegativeInt(patch.inspection_warn_days, 'Vorwarnzeit Kontrolle (Tage)', 0, 365),
      );
    }

    if ('federal_state' in patch) {
      const code = String(patch.federal_state ?? '').trim();
      if (!(code in FEDERAL_STATE_PRESETS)) {
        throw new HttpError(400, `Ungültiges Bundesland: ${code}`);
      }
      this.setSettingRaw('federal_state', code);
    }

    if ('state_rules' in patch) {
      if (!patch.state_rules || typeof patch.state_rules !== 'object') {
        throw new HttpError(400, 'state_rules muss ein Objekt sein');
      }
      const incoming = patch.state_rules as Record<string, unknown>;
      const prev = this.getStateRules();
      let fwRenewalMonths = prev.fw_renewal_months;
      if ('fw_renewal_months' in incoming) {
        const raw = incoming.fw_renewal_months;
        if (raw === null || raw === undefined || raw === '') {
          fwRenewalMonths = null;
        } else {
          fwRenewalMonths = asNonNegativeInt(raw, 'FW-Verlängerungsintervall (Monate)', 1, 240);
        }
      }
      const nextRules: StateRuleConfig = {
        fw_475_enabled:
          'fw_475_enabled' in incoming ? Boolean(incoming.fw_475_enabled) : prev.fw_475_enabled,
        fw_750_enabled:
          'fw_750_enabled' in incoming ? Boolean(incoming.fw_750_enabled) : prev.fw_750_enabled,
        fw_require_valid_b:
          'fw_require_valid_b' in incoming
            ? Boolean(incoming.fw_require_valid_b)
            : prev.fw_require_valid_b,
        fw_min_b_years:
          'fw_min_b_years' in incoming
            ? asNonNegativeInt(incoming.fw_min_b_years, 'Mindestvorbesitz Klasse B (Jahre)', 0, 20)
            : prev.fw_min_b_years,
        fw_allow_trailers:
          'fw_allow_trailers' in incoming
            ? Boolean(incoming.fw_allow_trailers)
            : prev.fw_allow_trailers,
        fw_renewal_months: fwRenewalMonths,
        strict_inspection_blocking:
          'strict_inspection_blocking' in incoming
            ? Boolean(incoming.strict_inspection_blocking)
            : prev.strict_inspection_blocking,
        expired_card_blocks_driving:
          'expired_card_blocks_driving' in incoming
            ? Boolean(incoming.expired_card_blocks_driving)
            : prev.expired_card_blocks_driving,
        custom_rules_notes:
          'custom_rules_notes' in incoming
            ? String(incoming.custom_rules_notes ?? '')
            : prev.custom_rules_notes,
      };
      this.setSettingRaw('state_rules', nextRules);
    }

    if ('mail_provider' in patch) {
      const p = patch.mail_provider;
      if (p !== 'none' && p !== 'smtp' && p !== 'jmap') {
        throw new HttpError(400, 'Ungültiger Mail-Provider');
      }
      this.setSettingRaw('mail_provider', p);
    }

    if (patch.smtp && typeof patch.smtp === 'object') {
      const incoming = patch.smtp as Record<string, unknown>;
      const prev = this.getStoredSmtp();
      const port =
        'port' in incoming
          ? asNonNegativeInt(incoming.port, 'SMTP-Port', 1, 65535)
          : prev.port;

      let passwordEncrypted = prev.passwordEncrypted;
      if (incoming.clearPassword === true) {
        passwordEncrypted = '';
      } else if (!isUnchangedSecret(incoming.password)) {
        passwordEncrypted = this.secretBox.encrypt(String(incoming.password));
      }

      this.setSettingRaw('smtp_config', {
        host: 'host' in incoming ? String(incoming.host ?? '').trim() : prev.host,
        port,
        secure: 'secure' in incoming ? Boolean(incoming.secure) : prev.secure,
        username: 'username' in incoming ? String(incoming.username ?? '').trim() : prev.username,
        passwordEncrypted,
        fromEmail: 'fromEmail' in incoming ? String(incoming.fromEmail ?? '').trim() : prev.fromEmail,
        fromName: 'fromName' in incoming ? String(incoming.fromName ?? '').trim() : prev.fromName,
        rejectUnauthorized:
          'rejectUnauthorized' in incoming
            ? Boolean(incoming.rejectUnauthorized)
            : prev.rejectUnauthorized,
      } satisfies StoredSmtpConfig);
    }

    if (patch.jmap && typeof patch.jmap === 'object') {
      const incoming = patch.jmap as Record<string, unknown>;
      const prev = this.getStoredJmap();

      const authType =
        'authType' in incoming
          ? incoming.authType === 'basic'
            ? 'basic'
            : 'bearer'
          : prev.authType;

      let tokenEncrypted = prev.tokenEncrypted;
      if (incoming.clearToken === true) {
        tokenEncrypted = '';
      } else if (!isUnchangedSecret(incoming.token)) {
        tokenEncrypted = this.secretBox.encrypt(String(incoming.token).trim());
      }

      let passwordEncrypted = prev.passwordEncrypted;
      if (incoming.clearPassword === true) {
        passwordEncrypted = '';
      } else if (!isUnchangedSecret(incoming.password)) {
        passwordEncrypted = this.secretBox.encrypt(String(incoming.password));
      }

      this.setSettingRaw('jmap_config', {
        sessionUrl:
          'sessionUrl' in incoming ? String(incoming.sessionUrl ?? '').trim() : prev.sessionUrl,
        authType,
        username: 'username' in incoming ? String(incoming.username ?? '').trim() : prev.username,
        tokenEncrypted,
        passwordEncrypted,
        fromEmail: 'fromEmail' in incoming ? String(incoming.fromEmail ?? '').trim() : prev.fromEmail,
        fromName: 'fromName' in incoming ? String(incoming.fromName ?? '').trim() : prev.fromName,
        accountId: 'accountId' in incoming ? String(incoming.accountId ?? '').trim() : prev.accountId,
      } satisfies StoredJmapConfig);
    }

    if ('notify_digest_enabled' in patch) {
      this.setSettingRaw('notify_digest_enabled', Boolean(patch.notify_digest_enabled));
    }

    if ('notify_digest_frequency' in patch) {
      const freq = patch.notify_digest_frequency;
      if (freq !== 'daily' && freq !== 'weekly') {
        throw new HttpError(400, 'Digest-Frequenz muss daily oder weekly sein');
      }
      this.setSettingRaw('notify_digest_frequency', freq);
    }

    if ('notify_digest_weekday' in patch) {
      this.setSettingRaw(
        'notify_digest_weekday',
        asNonNegativeInt(patch.notify_digest_weekday, 'Wochentag', 0, 6),
      );
    }

    if ('notify_digest_hour' in patch) {
      this.setSettingRaw(
        'notify_digest_hour',
        asNonNegativeInt(patch.notify_digest_hour, 'Uhrzeit (Stunde)', 0, 23),
      );
    }

    if ('notify_digest_recipients' in patch) {
      const raw = patch.notify_digest_recipients;
      const list = Array.isArray(raw)
        ? raw.map((x) => String(x).trim()).filter(Boolean)
        : typeof raw === 'string'
          ? raw
              .split(/[,;\n]/)
              .map((x) => x.trim())
              .filter(Boolean)
          : [];
      this.setSettingRaw('notify_digest_recipients', Array.from(new Set(list)));
    }

    if ('notify_members_enabled' in patch) {
      this.setSettingRaw('notify_members_enabled', Boolean(patch.notify_members_enabled));
    }

    if ('notify_member_days_before' in patch) {
      const raw = patch.notify_member_days_before;
      if (!Array.isArray(raw)) {
        throw new HttpError(400, 'notify_member_days_before muss ein Array aus Zahlen sein');
      }
      const nums = Array.from(
        new Set(
          raw.map((v) => asNonNegativeInt(v, 'Erinnerungstage', 0, 365)),
        ),
      ).sort((a, b) => b - a);
      this.setSettingRaw('notify_member_days_before', nums);
    }

    return this.getPublicSettings();
  }
}
