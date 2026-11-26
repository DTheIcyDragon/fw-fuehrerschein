import type {
  AppSettingsPublic,
  EvaluatedMember,
  EvaluatedVehicle,
  FederalStateCode,
  Inspection,
  InspectionResult,
  LicenseClass,
  MailProvider,
  MemberLicense,
  MemberStatus,
  NotificationLogEntry,
  PublicUser,
  StateRuleConfig,
  UserRole,
} from '@shared/types';

export interface AuthStatusResponse {
  needsSetup: boolean;
  user: PublicUser | null;
  departmentName: string;
  federalState?: FederalStateCode;
  stateRules?: StateRuleConfig;
}

export interface DashboardSummary {
  departmentName: string;
  counts: {
    totalActive: number;
    green: number;
    yellow: number;
    red: number;
    dueInspections: number;
    overdueInspections: number;
    expiringLicenses: number;
    activeBans: number;
    activeVehicles: number;
  };
  attentionMembers: EvaluatedMember[];
  vehicles: EvaluatedVehicle[];
}

export interface MemberPayload {
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
  licenses: MemberLicense[];
}

export interface VehiclePayload {
  name: string;
  call_sign: string | null;
  license_plate: string | null;
  unit: string | null;
  required_classes: LicenseClass[];
  is_automatic: boolean;
  notes: string | null;
  active: boolean;
}

export interface CsvPreviewRow {
  rowNumber: number;
  action: 'create' | 'update' | 'error';
  errors: string[];
  existingMemberId?: number;
  data: {
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
    licenses: MemberLicense[];
    notes: string | null;
  };
}

export interface CsvPreviewResponse {
  delimiter: ';' | ',';
  totalRows: number;
  createCount: number;
  updateCount: number;
  errorCount: number;
  rows: CsvPreviewRow[];
}

export interface CsvCommitResponse {
  created: number;
  updated: number;
  total: number;
}

export interface NotificationRunResponse {
  digestSent: number;
  memberEmailsSent: number;
  errors: string[];
  skippedReason?: string;
}

export interface SettingsUpdatePayload {
  department_name?: string;
  inspection_interval_months?: number;
  license_warn_days?: number;
  inspection_warn_days?: number;
  federal_state?: FederalStateCode;
  state_rules?: Partial<StateRuleConfig>;
  mail_provider?: MailProvider;
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password?: string;
    fromEmail: string;
    fromName: string;
    rejectUnauthorized: boolean;
  };
  jmap?: {
    sessionUrl: string;
    authType: 'bearer' | 'basic';
    username: string;
    token?: string;
    password?: string;
    fromEmail: string;
    fromName: string;
    accountId: string;
  };
  notify_digest_enabled?: boolean;
  notify_digest_frequency?: 'daily' | 'weekly';
  notify_digest_weekday?: number;
  notify_digest_hour?: number;
  notify_digest_recipients?: string[];
  notify_members_enabled?: boolean;
  notify_member_days_before?: number[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    let message = `Fehler ${res.status}`;
    try {
      const data = await res.json();
      if (data && typeof data.error === 'string') {
        message = data.error;
      } else if (data && typeof data.message === 'string') {
        message = data.message;
      }
    } catch {
      const text = await res.text().catch(() => '');
      if (text) message = text;
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      sp.set(k, String(v));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  // Auth
  getAuthStatus: () => request<AuthStatusResponse>('/api/auth/status'),
  setup: (payload: {
    department_name: string;
    inspection_interval_months: number;
    federal_state?: FederalStateCode;
    username: string;
    display_name: string;
    email: string;
    password: string;
  }) => request<{ user: PublicUser; departmentName?: string }>('/api/auth/setup', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  login: (payload: { username: string; password: string }) =>
    request<{ user: PublicUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  logout: () => request<{ ok?: boolean }>('/api/auth/logout', { method: 'POST' }),
  getMe: () => request<{ user: PublicUser } | PublicUser>('/api/auth/me'),
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    request<{ ok?: boolean }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Dashboard
  getDashboard: () => request<DashboardSummary>('/api/dashboard'),

  // Members
  listMembers: (filters?: {
    search?: string;
    unit?: string;
    status?: string;
    licenseClass?: string;
    trafficLight?: string;
  }) => request<EvaluatedMember[]>(`/api/members${buildQuery(filters ?? {})}`),
  listUnits: () => request<string[]>('/api/members/units'),
  getMember: (id: number) => request<EvaluatedMember>(`/api/members/${id}`),
  createMember: (payload: MemberPayload) =>
    request<EvaluatedMember>('/api/members', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateMember: (id: number, payload: MemberPayload) =>
    request<EvaluatedMember>(`/api/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteMember: (id: number) =>
    request<{ ok?: boolean }>(`/api/members/${id}`, { method: 'DELETE' }),

  // Inspections
  listInspections: (filters?: {
    memberId?: number;
    unit?: string;
    from?: string;
    to?: string;
  }) => request<Inspection[]>(`/api/inspections${buildQuery(filters ?? {})}`),
  createInspection: (payload: {
    member_id: number;
    inspected_at: string;
    result: InspectionResult;
    notes: string | null;
  }) =>
    request<Inspection>('/api/inspections', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteInspection: (id: number) =>
    request<{ ok?: boolean }>(`/api/inspections/${id}`, { method: 'DELETE' }),

  // Vehicles
  listVehicles: (options?: { summary?: boolean }) =>
    request<EvaluatedVehicle[]>(options?.summary ? '/api/vehicles?summary=1' : '/api/vehicles'),
  getVehicle: (id: number) => request<EvaluatedVehicle>(`/api/vehicles/${id}`),
  createVehicle: (payload: VehiclePayload) =>
    request<EvaluatedVehicle>('/api/vehicles', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateVehicle: (id: number, payload: VehiclePayload) =>
    request<EvaluatedVehicle>(`/api/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteVehicle: (id: number) =>
    request<{ ok?: boolean }>(`/api/vehicles/${id}`, { method: 'DELETE' }),

  // Users
  listUsers: () => request<PublicUser[]>('/api/users'),
  createUser: (payload: {
    username: string;
    display_name: string;
    email: string | null;
    role: UserRole;
    active: boolean;
    password: string;
  }) =>
    request<PublicUser>('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateUser: (
    id: number,
    payload: {
      username?: string;
      display_name?: string;
      email?: string | null;
      role?: UserRole;
      active?: boolean;
      password?: string;
    },
  ) =>
    request<PublicUser>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteUser: (id: number) =>
    request<{ ok?: boolean }>(`/api/users/${id}`, { method: 'DELETE' }),

  // Settings & Notifications
  getSettings: () => request<AppSettingsPublic>('/api/settings'),
  updateSettings: (patch: SettingsUpdatePayload) =>
    request<AppSettingsPublic>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  rotateIcalToken: () =>
    request<{ ical_token: string }>('/api/settings/ical-token/rotate', {
      method: 'POST',
    }),
  sendTestNotification: (payload: {
    toEmail: string;
    override?: {
      provider?: MailProvider;
      smtp?: SettingsUpdatePayload['smtp'];
      jmap?: SettingsUpdatePayload['jmap'];
    };
  }) =>
    request<{ ok: boolean; message: string }>('/api/notifications/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  runNotifications: (payload?: { forceDigest?: boolean; sendDigest?: boolean; sendMembers?: boolean }) =>
    request<NotificationRunResponse>('/api/notifications/run', {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),
  getNotificationLogs: () => request<NotificationLogEntry[]>('/api/notifications/logs'),

  // CSV Import
  previewCsvImport: (csv: string) =>
    request<CsvPreviewResponse>('/api/import/csv/preview', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    }),
  commitCsvImport: (csv: string) =>
    request<CsvCommitResponse>('/api/import/csv/commit', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    }),

  // Backup / Restore
  restoreJsonBackup: (backup: unknown) =>
    request<{
      ok: boolean;
      restored: {
        members: number;
        member_licenses: number;
        inspections: number;
        vehicles: number;
      };
    }>('/api/admin/restore/json', {
      method: 'POST',
      body: JSON.stringify(backup),
    }),
  restoreSqliteBackup: async (file: File) => {
    const res = await fetch('/api/admin/restore/sqlite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: file,
      credentials: 'include',
    });
    if (!res.ok) {
      let message = `Fehler ${res.status}`;
      try {
        const data = await res.json();
        if (data && typeof data.error === 'string') {
          message = data.error;
        }
      } catch {
        const text = await res.text().catch(() => '');
        if (text) message = text;
      }
      throw new ApiError(res.status, message);
    }
    return (await res.json()) as {
      ok: boolean;
      restored: {
        members: number;
        member_licenses: number;
        inspections: number;
        vehicles: number;
      };
    };
  },

  // Direct download URLs
  urls: {
    inspectionsPdf: (filters?: { unit?: string; from?: string; to?: string }) =>
      `/api/reports/inspections.pdf${buildQuery(filters ?? {})}`,
    vehiclesPdf: (vehicleId?: number) =>
      `/api/reports/vehicles.pdf${buildQuery({ vehicleId })}`,
    membersPdf: (unit?: string) => `/api/reports/members.pdf${buildQuery({ unit })}`,
    membersCsv: () => '/api/export/members.csv',
    csvTemplate: () => '/api/import/template.csv',
    calendarIcs: () => '/api/calendar.ics',
    backupSqlite: () => '/api/admin/backup/sqlite',
    backupJson: () => '/api/admin/backup/json',
  },
};
