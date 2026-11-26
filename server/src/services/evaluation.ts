import {
  ALL_LICENSE_CLASSES,
  evaluateMember,
  evaluateVehicleDrivers,
  getTodayIsoDate,
} from '../../../shared/licenseRules.js';
import type {
  EvaluatedMember,
  EvaluatedVehicle,
  Inspection,
  LicenseClass,
  Member,
  MemberLicense,
  MemberStatus,
  MemberVehicleSummary,
  TrafficLight,
  Vehicle,
} from '../../../shared/types.js';
import type { AppDatabase } from '../db/database.js';
import type { SettingsService } from './settings.js';

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

interface MemberRow {
  id: number;
  first_name: string;
  last_name: string;
  personnel_number: string | null;
  birth_date: string | null;
  unit: string | null;
  email: string | null;
  phone: string | null;
  status: MemberStatus;
  license_number: string | null;
  card_issued_at: string | null;
  card_expires_at: string | null;
  issuing_authority: string | null;
  global_key_numbers_json: string;
  ban_active: number;
  ban_from: string | null;
  ban_until: string | null;
  ban_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface LicenseRow {
  id: number;
  member_id: number;
  license_class: LicenseClass;
  issued_at: string | null;
  expires_at: string | null;
  key_numbers_json: string;
  notes: string | null;
}

interface InspectionRow {
  id: number;
  member_id: number;
  inspected_at: string;
  inspector_user_id: number | null;
  inspector_name: string;
  result: 'ok' | 'issue';
  notes: string | null;
  cancelled_at: string | null;
  cancelled_by_name: string | null;
  cancel_reason: string | null;
  checked_eu_card: number;
  checked_fw_license: number;
  checked_restrictions: number;
  created_at: string;
  member_first_name?: string;
  member_last_name?: string;
  member_unit?: string | null;
}

interface VehicleRow {
  id: number;
  name: string;
  call_sign: string | null;
  license_plate: string | null;
  unit: string | null;
  required_classes_json: string;
  is_automatic: number;
  requires_trailer: number;
  requires_briefing: number;
  notes: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

function parseStringArray(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
  } catch {
    return [];
  }
}

function parseLicenseClassArray(json: string | null | undefined): LicenseClass[] {
  const raw = parseStringArray(json);
  const valid = new Set<string>(ALL_LICENSE_CLASSES);
  return raw.filter((v): v is LicenseClass => valid.has(v));
}

function mapLicenseRow(row: LicenseRow): MemberLicense {
  return {
    id: Number(row.id),
    member_id: Number(row.member_id),
    license_class: row.license_class,
    issued_at: row.issued_at,
    expires_at: row.expires_at,
    key_numbers: parseStringArray(row.key_numbers_json),
    notes: row.notes,
  };
}

function mapMemberRow(row: MemberRow, licenses: MemberLicense[]): Member {
  return {
    id: Number(row.id),
    first_name: row.first_name,
    last_name: row.last_name,
    personnel_number: row.personnel_number,
    birth_date: row.birth_date ?? null,
    unit: row.unit,
    email: row.email,
    phone: row.phone,
    status: row.status,
    license_number: row.license_number,
    card_issued_at: row.card_issued_at,
    card_expires_at: row.card_expires_at,
    issuing_authority: row.issuing_authority,
    global_key_numbers: parseStringArray(row.global_key_numbers_json),
    ban_active: Boolean(row.ban_active),
    ban_from: row.ban_from,
    ban_until: row.ban_until,
    ban_reason: row.ban_reason,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    licenses,
  };
}

function mapInspectionRow(row: InspectionRow): Inspection {
  const item: Inspection = {
    id: Number(row.id),
    member_id: Number(row.member_id),
    inspected_at: row.inspected_at,
    inspector_user_id: row.inspector_user_id !== null ? Number(row.inspector_user_id) : null,
    inspector_name: row.inspector_name,
    result: row.result,
    notes: row.notes,
    cancelled_at: row.cancelled_at ?? null,
    cancelled_by_name: row.cancelled_by_name ?? null,
    cancel_reason: row.cancel_reason ?? null,
    checked_eu_card: row.checked_eu_card !== undefined ? Boolean(row.checked_eu_card) : true,
    checked_fw_license: Boolean(row.checked_fw_license),
    checked_restrictions: Boolean(row.checked_restrictions),
    created_at: row.created_at,
  };
  if (row.member_first_name !== undefined) {
    item.member_first_name = row.member_first_name;
  }
  if (row.member_last_name !== undefined) {
    item.member_last_name = row.member_last_name;
  }
  if (row.member_unit !== undefined) {
    item.member_unit = row.member_unit;
  }
  return item;
}

function mapVehicleRow(row: VehicleRow): Vehicle {
  return {
    id: Number(row.id),
    name: row.name,
    call_sign: row.call_sign,
    license_plate: row.license_plate,
    unit: row.unit,
    required_classes: parseLicenseClassArray(row.required_classes_json),
    is_automatic: Boolean(row.is_automatic),
    requires_trailer: Boolean(row.requires_trailer),
    requires_briefing: Boolean(row.requires_briefing),
    notes: row.notes,
    active: Boolean(row.active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function minDaysUrgency(member: EvaluatedMember): number {
  const candidates: number[] = [];
  if (member.evaluation.banCurrentlyActive) {
    candidates.push(-10000);
  }
  if (member.evaluation.inspection.lastResult === 'issue') {
    candidates.push(-9000);
  }
  if (member.evaluation.cardDaysUntilExpiry !== null && member.evaluation.cardStatus !== 'green') {
    candidates.push(member.evaluation.cardDaysUntilExpiry);
  }
  for (const lic of member.evaluation.licenses) {
    if (lic.daysUntilExpiry !== null && lic.status !== 'green') {
      candidates.push(lic.daysUntilExpiry);
    }
  }
  if (member.evaluation.inspection.status !== 'green') {
    candidates.push(member.evaluation.inspection.daysUntilDue ?? -1);
  }
  return candidates.length > 0 ? Math.min(...candidates) : 9999;
}

export class EvaluationService {
  constructor(
    private readonly db: AppDatabase,
    private readonly settings: SettingsService,
  ) {}

  private loadBriefingsMaps(): {
    byMember: Map<number, number[]>;
    byVehicle: Map<number, Set<number>>;
  } {
    const rows = this.db
      .prepare('SELECT member_id, vehicle_id FROM vehicle_briefings ORDER BY vehicle_id ASC')
      .all() as Array<{ member_id: number; vehicle_id: number }>;

    const byMember = new Map<number, number[]>();
    const byVehicle = new Map<number, Set<number>>();
    for (const r of rows) {
      const mId = Number(r.member_id);
      const vId = Number(r.vehicle_id);
      const list = byMember.get(mId) ?? [];
      list.push(vId);
      byMember.set(mId, list);

      let set = byVehicle.get(vId);
      if (!set) {
        set = new Set<number>();
        byVehicle.set(vId, set);
      }
      set.add(mId);
    }
    return { byMember, byVehicle };
  }

  private loadAllEvaluatedMembers(today: string = getTodayIsoDate()): EvaluatedMember[] {
    const memberRows = this.db
      .prepare('SELECT * FROM members ORDER BY last_name COLLATE NOCASE ASC, first_name COLLATE NOCASE ASC')
      .all() as unknown as MemberRow[];

    const licenseRows = this.db
      .prepare('SELECT * FROM member_licenses ORDER BY member_id ASC, id ASC')
      .all() as unknown as LicenseRow[];

    const latestInspectionRows = this.db
      .prepare(`
        SELECT i.*, m.first_name AS member_first_name, m.last_name AS member_last_name, m.unit AS member_unit
        FROM inspections i
        JOIN members m ON m.id = i.member_id
        WHERE i.cancelled_at IS NULL
          AND i.id = (
            SELECT i2.id
            FROM inspections i2
            WHERE i2.member_id = i.member_id
              AND i2.cancelled_at IS NULL
            ORDER BY i2.inspected_at DESC, i2.id DESC
            LIMIT 1
          )
      `)
      .all() as unknown as InspectionRow[];

    const { byMember: briefedByMember } = this.loadBriefingsMaps();

    const licensesByMember = new Map<number, MemberLicense[]>();
    for (const row of licenseRows) {
      const memberId = Number(row.member_id);
      const list = licensesByMember.get(memberId) ?? [];
      list.push(mapLicenseRow(row));
      licensesByMember.set(memberId, list);
    }

    const inspectionByMember = new Map<number, Inspection>();
    for (const row of latestInspectionRows) {
      inspectionByMember.set(Number(row.member_id), mapInspectionRow(row));
    }

    const rules = this.settings.getRuleSettings();

    const evaluated = memberRows.map((row) => {
      const id = Number(row.id);
      const member = mapMemberRow(row, licensesByMember.get(id) ?? []);
      const lastInspection = inspectionByMember.get(id) ?? null;
      const evaluation = evaluateMember(member, lastInspection, rules, today);
      return {
        ...member,
        last_inspection: lastInspection,
        briefed_vehicle_ids: briefedByMember.get(id) ?? [],
        evaluation,
      };
    });

    evaluated.sort((a, b) => {
      const ln = a.last_name.localeCompare(b.last_name, 'de');
      return ln !== 0 ? ln : a.first_name.localeCompare(b.first_name, 'de');
    });

    return evaluated;
  }

  listEvaluatedMembers(filters?: {
    search?: string;
    unit?: string;
    status?: string;
    licenseClass?: string;
    trafficLight?: string;
  }): EvaluatedMember[] {
    let items = this.loadAllEvaluatedMembers();

    if (filters?.status && filters.status !== 'all') {
      items = items.filter((m) => m.status === filters.status);
    }

    if (filters?.unit && filters.unit !== 'all') {
      items = items.filter((m) => (m.unit ?? '') === filters.unit);
    }

    if (filters?.licenseClass && filters.licenseClass !== 'all') {
      const lc = filters.licenseClass as LicenseClass;
      items = items.filter(
        (m) =>
          m.licenses.some((l) => l.license_class === lc) ||
          m.evaluation.anyCoveredClasses.includes(lc),
      );
    }

    if (filters?.trafficLight === 'attention') {
      items = items.filter(
        (m) =>
          m.evaluation.overallStatus === 'yellow' || m.evaluation.overallStatus === 'red',
      );
    } else if (
      filters?.trafficLight &&
      (filters.trafficLight === 'green' ||
        filters.trafficLight === 'yellow' ||
        filters.trafficLight === 'red')
    ) {
      items = items.filter((m) => m.evaluation.overallStatus === filters.trafficLight);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      items = items.filter((m) => {
        const haystacks = [
          m.first_name,
          m.last_name,
          `${m.first_name} ${m.last_name}`,
          `${m.last_name} ${m.first_name}`,
          `${m.last_name}, ${m.first_name}`,
          m.personnel_number ?? '',
          m.unit ?? '',
          m.license_number ?? '',
          m.email ?? '',
        ];
        return haystacks.some((h) => h.toLowerCase().includes(q));
      });
    }

    return items;
  }

  getEvaluatedMember(id: number): EvaluatedMember | null {
    const row = this.db
      .prepare('SELECT * FROM members WHERE id = ?')
      .get(id) as MemberRow | undefined;
    if (!row) {
      return null;
    }

    const licenseRows = this.db
      .prepare('SELECT * FROM member_licenses WHERE member_id = ? ORDER BY id ASC')
      .all(id) as unknown as LicenseRow[];

    const latestInspectionRow = this.db
      .prepare(`
        SELECT i.*, m.first_name AS member_first_name, m.last_name AS member_last_name, m.unit AS member_unit
        FROM inspections i
        JOIN members m ON m.id = i.member_id
        WHERE i.member_id = ?
          AND i.cancelled_at IS NULL
        ORDER BY i.inspected_at DESC, i.id DESC
        LIMIT 1
      `)
      .get(id) as InspectionRow | undefined;

    const briefingRows = this.db
      .prepare('SELECT vehicle_id FROM vehicle_briefings WHERE member_id = ? ORDER BY vehicle_id ASC')
      .all(id) as Array<{ vehicle_id: number }>;

    const member = mapMemberRow(row, licenseRows.map(mapLicenseRow));
    const lastInspection = latestInspectionRow ? mapInspectionRow(latestInspectionRow) : null;
    const evaluation = evaluateMember(member, lastInspection, this.settings.getRuleSettings());

    return {
      ...member,
      last_inspection: lastInspection,
      briefed_vehicle_ids: briefingRows.map((b) => Number(b.vehicle_id)),
      evaluation,
    };
  }

  listEvaluatedVehicles(vehicleId?: number): EvaluatedVehicle[] {
    const vehicleRows = (
      vehicleId !== undefined
        ? this.db.prepare('SELECT * FROM vehicles WHERE id = ?').all(vehicleId)
        : this.db.prepare('SELECT * FROM vehicles ORDER BY active DESC, name COLLATE NOCASE ASC').all()
    ) as unknown as VehicleRow[];

    if (vehicleRows.length === 0) {
      return [];
    }

    const evaluatedMembers = this.loadAllEvaluatedMembers();
    const pairs = evaluatedMembers.map((m) => ({
      member: m,
      evaluation: m.evaluation,
    }));
    const rules = this.settings.getRuleSettings();
    const { byVehicle: briefedByVehicle } = this.loadBriefingsMaps();

    return vehicleRows.map((row) => {
      const vehicle = mapVehicleRow(row);
      const drivers = evaluateVehicleDrivers(
        vehicle,
        pairs,
        rules,
        briefedByVehicle.get(vehicle.id),
      );
      let green = 0;
      let yellow = 0;
      let red = 0;
      for (const d of drivers) {
        if (d.status === 'green') green += 1;
        else if (d.status === 'yellow') yellow += 1;
        else red += 1;
      }
      return {
        ...vehicle,
        drivers,
        counts: {
          green,
          yellow,
          red,
          total: drivers.length,
        },
      };
    });
  }

  getMemberVehicles(memberId: number): MemberVehicleSummary[] {
    const member = this.getEvaluatedMember(memberId);
    if (!member) {
      return [];
    }

    const vehicleRows = this.db
      .prepare('SELECT * FROM vehicles ORDER BY active DESC, name COLLATE NOCASE ASC')
      .all() as unknown as VehicleRow[];

    const briefedSet = new Set(member.briefed_vehicle_ids);
    const rules = this.settings.getRuleSettings();
    const pair = [{ member, evaluation: member.evaluation }];

    const summaries: MemberVehicleSummary[] = [];
    for (const row of vehicleRows) {
      const vehicle = mapVehicleRow(row);
      const briefedForVehicle = briefedSet.has(vehicle.id)
        ? new Set<number>([member.id])
        : new Set<number>();
      const entries = evaluateVehicleDrivers(vehicle, pair, rules, briefedForVehicle);
      if (entries.length === 0) continue;
      const entry = entries[0];
      summaries.push({
        vehicleId: vehicle.id,
        name: vehicle.name,
        call_sign: vehicle.call_sign,
        license_plate: vehicle.license_plate,
        unit: vehicle.unit,
        required_classes: vehicle.required_classes,
        is_automatic: vehicle.is_automatic,
        requires_trailer: vehicle.requires_trailer,
        requires_briefing: vehicle.requires_briefing,
        active: vehicle.active,
        status: entry.status,
        coveringClass: entry.coveringClass,
        directOrIncluded: entry.directOrIncluded,
        reasons: entry.reasons,
        isBriefed: entry.isBriefed,
      });
    }

    return summaries;
  }

  listInspections(filters?: {
    memberId?: number;
    unit?: string;
    from?: string;
    to?: string;
  }): Inspection[] {
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (filters?.memberId !== undefined && Number.isFinite(filters.memberId)) {
      conditions.push('i.member_id = ?');
      params.push(filters.memberId);
    }
    if (filters?.unit && filters.unit !== 'all') {
      conditions.push('m.unit = ?');
      params.push(filters.unit);
    }
    if (filters?.from) {
      conditions.push('i.inspected_at >= ?');
      params.push(filters.from);
    }
    if (filters?.to) {
      conditions.push('i.inspected_at <= ?');
      params.push(filters.to);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`
        SELECT i.*, m.first_name AS member_first_name, m.last_name AS member_last_name, m.unit AS member_unit
        FROM inspections i
        JOIN members m ON m.id = i.member_id
        ${whereSql}
        ORDER BY i.inspected_at DESC, i.id DESC
      `)
      .all(...params) as unknown as InspectionRow[];

    return rows.map(mapInspectionRow);
  }

  getDashboardSummary(): DashboardSummary {
    const activeMembers = this.loadAllEvaluatedMembers().filter((m) => m.status === 'active');
    const activeVehicleRows = this.db
      .prepare('SELECT * FROM vehicles WHERE active = 1 ORDER BY name COLLATE NOCASE ASC')
      .all() as unknown as VehicleRow[];
    const pairs = activeMembers.map((m) => ({
      member: m,
      evaluation: m.evaluation,
    }));
    const rules = this.settings.getRuleSettings();
    const { byVehicle: briefedByVehicle } = this.loadBriefingsMaps();

    const vehicles: EvaluatedVehicle[] = activeVehicleRows.map((row) => {
      const vehicle = mapVehicleRow(row);
      const drivers = evaluateVehicleDrivers(
        vehicle,
        pairs,
        rules,
        briefedByVehicle.get(vehicle.id),
      );
      let vGreen = 0;
      let vYellow = 0;
      let vRed = 0;
      for (const d of drivers) {
        if (d.status === 'green') vGreen += 1;
        else if (d.status === 'yellow') vYellow += 1;
        else vRed += 1;
      }
      return {
        ...vehicle,
        drivers: [],
        counts: {
          green: vGreen,
          yellow: vYellow,
          red: vRed,
          total: drivers.length,
        },
      };
    });

    let green = 0;
    let yellow = 0;
    let red = 0;
    let dueInspections = 0;
    let overdueInspections = 0;
    let expiringLicenses = 0;
    let activeBans = 0;

    const attentionMembers: EvaluatedMember[] = [];

    for (const member of activeMembers) {
      const ev = member.evaluation;
      if (ev.overallStatus === 'green') green += 1;
      else if (ev.overallStatus === 'yellow') yellow += 1;
      else red += 1;

      if (ev.inspection.status !== 'green') {
        dueInspections += 1;
      }
      if (ev.inspection.daysUntilDue !== null && ev.inspection.daysUntilDue < 0) {
        overdueInspections += 1;
      }
      if (ev.cardStatus !== 'green' || ev.licenses.some((l) => l.status !== 'green')) {
        expiringLicenses += 1;
      }
      if (ev.banCurrentlyActive) {
        activeBans += 1;
      }

      if (ev.overallStatus !== 'green') {
        attentionMembers.push(member);
      }
    }

    const statusOrder: Record<TrafficLight, number> = { red: 0, yellow: 1, green: 2 };
    attentionMembers.sort((a, b) => {
      const sDiff = statusOrder[a.evaluation.overallStatus] - statusOrder[b.evaluation.overallStatus];
      if (sDiff !== 0) return sDiff;
      const uDiff = minDaysUrgency(a) - minDaysUrgency(b);
      if (uDiff !== 0) return uDiff;
      const ln = a.last_name.localeCompare(b.last_name, 'de');
      return ln !== 0 ? ln : a.first_name.localeCompare(b.first_name, 'de');
    });

    return {
      departmentName: this.settings.getDepartmentName(),
      counts: {
        totalActive: activeMembers.length,
        green,
        yellow,
        red,
        dueInspections,
        overdueInspections,
        expiringLicenses,
        activeBans,
        activeVehicles: vehicles.length,
      },
      attentionMembers,
      vehicles,
    };
  }

  listUnits(): string[] {
    const memberUnits = this.db
      .prepare("SELECT DISTINCT unit FROM members WHERE unit IS NOT NULL AND TRIM(unit) != ''")
      .all() as Array<{ unit: string }>;
    const vehicleUnits = this.db
      .prepare("SELECT DISTINCT unit FROM vehicles WHERE unit IS NOT NULL AND TRIM(unit) != ''")
      .all() as Array<{ unit: string }>;

    const set = new Set<string>();
    for (const r of memberUnits) set.add(r.unit.trim());
    for (const r of vehicleUnits) set.add(r.unit.trim());

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'));
  }
}
