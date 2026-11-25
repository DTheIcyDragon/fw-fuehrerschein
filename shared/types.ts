export type LicenseClass =
  | 'AM'
  | 'A1'
  | 'A2'
  | 'A'
  | 'B'
  | 'BE'
  | 'C1'
  | 'C1E'
  | 'C'
  | 'CE'
  | 'D1'
  | 'D1E'
  | 'D'
  | 'DE'
  | 'L'
  | 'T'
  | 'FW_475'
  | 'FW_750';

export type TrafficLight = 'green' | 'yellow' | 'red';

export type MemberStatus = 'active' | 'inactive' | 'archived';

export type UserRole = 'admin' | 'inspector' | 'viewer';

export type InspectionResult = 'ok' | 'issue';

export type MailProvider = 'none' | 'smtp' | 'jmap';

export type FederalStateCode =
  | 'SH'
  | 'BW'
  | 'BY'
  | 'BE'
  | 'BB'
  | 'HB'
  | 'HH'
  | 'HE'
  | 'MV'
  | 'NI'
  | 'NW'
  | 'RP'
  | 'SL'
  | 'SN'
  | 'ST'
  | 'TH';

export interface StateRuleConfig {
  fw_475_enabled: boolean;
  fw_750_enabled: boolean;
  fw_require_valid_b: boolean;
  fw_min_b_years: number;
  fw_allow_trailers: boolean;
  fw_renewal_months: number | null;
  strict_inspection_blocking: boolean;
  custom_rules_notes: string;
}

export interface FederalStatePreset {
  code: FederalStateCode;
  name: string;
  regulationName: string;
  summary: string;
  highlights: string[];
  defaults: StateRuleConfig;
}

export interface LegacyLicensePreset {
  id: string;
  shortLabel: string;
  label: string;
  mappedClasses: LicenseClass[];
  optionalClasses?: Array<{ license_class: LicenseClass; key_numbers: string[]; label: string }>;
  summary: string;
  specialNotes: string[];
  defaultNote: string;
}

export interface MemberLicense {
  id?: number;
  member_id?: number;
  license_class: LicenseClass;
  issued_at: string | null;
  expires_at: string | null;
  key_numbers: string[];
  notes: string | null;
}

export interface Member {
  id: number;
  first_name: string;
  last_name: string;
  personnel_number: string | null;
  unit: string | null;
  email: string | null;
  phone: string | null;
  status: MemberStatus;
  license_number: string | null;
  card_issued_at: string | null;
  card_expires_at: string | null;
  issuing_authority: string | null;
  global_key_numbers: string[];
  ban_active: boolean;
  ban_from: string | null;
  ban_until: string | null;
  ban_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  licenses: MemberLicense[];
}

export interface Inspection {
  id: number;
  member_id: number;
  inspected_at: string;
  inspector_user_id: number | null;
  inspector_name: string;
  result: InspectionResult;
  notes: string | null;
  created_at: string;
  member_first_name?: string;
  member_last_name?: string;
  member_unit?: string | null;
}

export interface Vehicle {
  id: number;
  name: string;
  call_sign: string | null;
  license_plate: string | null;
  unit: string | null;
  required_classes: LicenseClass[];
  is_automatic: boolean;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleSettings {
  inspection_interval_months: number;
  license_warn_days: number;
  inspection_warn_days: number;
  federal_state?: FederalStateCode;
  state_rules?: Partial<StateRuleConfig>;
}

export interface InspectionEvaluation {
  status: TrafficLight;
  lastInspectedAt: string | null;
  lastResult: InspectionResult | null;
  nextDueAt: string | null;
  daysUntilDue: number | null;
  reason: string;
}

export interface EvaluatedLicense extends MemberLicense {
  status: TrafficLight;
  daysUntilExpiry: number | null;
  reason: string;
}

export interface MemberEvaluation {
  overallStatus: TrafficLight;
  banCurrentlyActive: boolean;
  reasons: string[];
  inspection: InspectionEvaluation;
  cardStatus: TrafficLight;
  cardDaysUntilExpiry: number | null;
  cardReason: string | null;
  licenses: EvaluatedLicense[];
  validCoveredClasses: LicenseClass[];
  anyCoveredClasses: LicenseClass[];
}

export interface EvaluatedMember extends Member {
  last_inspection: Inspection | null;
  evaluation: MemberEvaluation;
}

export interface VehicleDriverEntry {
  memberId: number;
  firstName: string;
  lastName: string;
  unit: string | null;
  personnelNumber: string | null;
  status: TrafficLight;
  coveringClass: LicenseClass | null;
  directOrIncluded: 'direct' | 'included';
  reasons: string[];
  lastInspectedAt: string | null;
  nextInspectionDueAt: string | null;
}

export interface EvaluatedVehicle extends Vehicle {
  drivers: VehicleDriverEntry[];
  counts: {
    green: number;
    yellow: number;
    red: number;
    total: number;
  };
}

export interface PublicUser {
  id: number;
  username: string;
  display_name: string;
  email: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface SmtpSettingsPublic {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  hasPassword: boolean;
  fromEmail: string;
  fromName: string;
  rejectUnauthorized: boolean;
}

export interface JmapSettingsPublic {
  sessionUrl: string;
  authType: 'bearer' | 'basic';
  username: string;
  hasToken: boolean;
  hasPassword: boolean;
  fromEmail: string;
  fromName: string;
  accountId: string;
}

export interface AppSettingsPublic {
  department_name: string;
  inspection_interval_months: number;
  license_warn_days: number;
  inspection_warn_days: number;
  federal_state: FederalStateCode;
  state_rules: StateRuleConfig;
  ical_token: string;
  mail_provider: MailProvider;
  smtp: SmtpSettingsPublic;
  jmap: JmapSettingsPublic;
  notify_digest_enabled: boolean;
  notify_digest_frequency: 'daily' | 'weekly';
  notify_digest_weekday: number;
  notify_digest_hour: number;
  notify_digest_recipients: string[];
  notify_members_enabled: boolean;
  notify_member_days_before: number[];
}

export interface NotificationLogEntry {
  id: number;
  dedupe_key: string | null;
  recipient: string;
  channel: string;
  subject: string;
  status: string;
  error_message: string | null;
  sent_at: string;
}
