import type {
  EvaluatedMember,
  LicenseClass,
  MemberLicense,
  MemberStatus,
} from '../../../shared/types.js';
import { ALL_LICENSE_CLASSES, isValidIsoDate } from '../../../shared/licenseRules.js';
import type { AppDatabase } from '../db/database.js';
import { HttpError } from '../utils/asyncHandler.js';

const CSV_HEADERS = [
  'Personalnummer',
  'Vorname',
  'Nachname',
  'Einheit',
  'Email',
  'Telefon',
  'Status',
  'Fuehrerscheinnummer',
  'Karte_Ablauf',
  'Schluesselzahlen',
  'Klassen',
  'Letzte_Kontrolle',
  'Naechste_Kontrolle',
  'Ampel',
] as const;

function quoteCsvCell(value: string | null | undefined): string {
  const str = value ?? '';
  if (/[;"\r\n,]/.test(str) || str.startsWith(' ') || str.endsWith(' ')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatLicensesCell(licenses: MemberLicense[]): string {
  return licenses
    .map((lic) => (lic.expires_at ? `${lic.license_class}:${lic.expires_at}` : lic.license_class))
    .join(', ');
}

function translateTrafficLight(light: 'green' | 'yellow' | 'red'): string {
  if (light === 'green') return 'Grün';
  if (light === 'yellow') return 'Gelb';
  return 'Rot';
}

export function exportMembersCsv(members: EvaluatedMember[]): string {
  const rows: string[] = [CSV_HEADERS.join(';')];

  for (const m of members) {
    const cells = [
      m.personnel_number ?? '',
      m.first_name,
      m.last_name,
      m.unit ?? '',
      m.email ?? '',
      m.phone ?? '',
      m.status,
      m.license_number ?? '',
      m.card_expires_at ?? '',
      m.global_key_numbers.join(', '),
      formatLicensesCell(m.licenses),
      m.evaluation.inspection.lastInspectedAt ?? '',
      m.evaluation.inspection.nextDueAt ?? '',
      translateTrafficLight(m.evaluation.overallStatus),
    ];
    rows.push(cells.map(quoteCsvCell).join(';'));
  }

  return `\uFEFF${rows.join('\r\n')}\r\n`;
}

export function exportCsvTemplate(): string {
  const rows: string[] = [
    CSV_HEADERS.join(';'),
    [
      '001',
      'Max',
      'Mustermann',
      'Löschzug 1',
      'max.mustermann@feuerwehr.local',
      '01701234567',
      'active',
      'B072RRE2I55',
      '2035-06-01',
      '01',
      'B, C1:2028-05-01, FW_750',
      '',
      '',
      '',
    ]
      .map(quoteCsvCell)
      .join(';'),
    [
      '002',
      'Erika',
      'Musterfrau',
      'Löschgruppe Nord',
      'erika.musterfrau@feuerwehr.local',
      '',
      'active',
      '',
      '',
      '',
      'B, BE, C:2027-03-15, CE:2027-03-15',
      '',
      '',
      '',
    ]
      .map(quoteCsvCell)
      .join(';'),
  ];
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}

function detectDelimiter(headerLine: string): ';' | ',' {
  let semi = 0;
  let comma = 0;
  let inQuotes = false;
  for (let i = 0; i < headerLine.length; i++) {
    const ch = headerLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === ';') semi++;
      else if (ch === ',') comma++;
    }
  }
  return semi >= comma ? ';' : ',';
}

function parseCsvRows(input: string): { delimiter: ';' | ','; records: string[][] } {
  const clean = input.replace(/^\uFEFF/, '');
  const firstLineEnd = clean.search(/\r?\n/);
  const firstLine = firstLineEnd === -1 ? clean : clean.slice(0, firstLineEnd);
  const delimiter = detectDelimiter(firstLine);

  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (ch === '\r') {
      if (clean[i + 1] === '\n') i++;
      row.push(field.trim());
      if (row.some((c) => c !== '')) {
        records.push(row);
      }
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field.trim());
      if (row.some((c) => c !== '')) {
        records.push(row);
      }
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    if (row.some((c) => c !== '')) {
      records.push(row);
    }
  }

  return { delimiter, records };
}

type CanonicalField =
  | 'personnel_number'
  | 'first_name'
  | 'last_name'
  | 'unit'
  | 'email'
  | 'phone'
  | 'status'
  | 'license_number'
  | 'card_issued_at'
  | 'card_expires_at'
  | 'issuing_authority'
  | 'global_key_numbers'
  | 'licenses'
  | 'notes';

function normalizeHeaderKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

const HEADER_MAP: Record<string, CanonicalField> = {
  personalnummer: 'personnel_number',
  personnelnumber: 'personnel_number',
  persnr: 'personnel_number',
  pnr: 'personnel_number',
  vorname: 'first_name',
  firstname: 'first_name',
  nachname: 'last_name',
  lastname: 'last_name',
  familienname: 'last_name',
  einheit: 'unit',
  unit: 'unit',
  abteilung: 'unit',
  loeschzug: 'unit',
  loeschgruppe: 'unit',
  email: 'email',
  mail: 'email',
  emailadresse: 'email',
  telefon: 'phone',
  phone: 'phone',
  tel: 'phone',
  telefonnummer: 'phone',
  mobil: 'phone',
  handy: 'phone',
  status: 'status',
  fuehrerscheinnummer: 'license_number',
  licensenumber: 'license_number',
  fsnummer: 'license_number',
  karteausstellung: 'card_issued_at',
  cardissuedat: 'card_issued_at',
  ausstellungsdatum: 'card_issued_at',
  karteablauf: 'card_expires_at',
  cardexpiresat: 'card_expires_at',
  ablaufkarte: 'card_expires_at',
  behoerde: 'issuing_authority',
  ausstellungsbehoerde: 'issuing_authority',
  issuingauthority: 'issuing_authority',
  schluesselzahlen: 'global_key_numbers',
  keynumbers: 'global_key_numbers',
  globalkeynumbers: 'global_key_numbers',
  klassen: 'licenses',
  fuehrerscheinklassen: 'licenses',
  licenses: 'licenses',
  licenseclasses: 'licenses',
  notizen: 'notes',
  notes: 'notes',
  bemerkungen: 'notes',
};

function parseFlexibleDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (isValidIsoDate(trimmed)) return trimmed;
  const deMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  if (deMatch) {
    const iso = `${deMatch[3]}-${deMatch[2].padStart(2, '0')}-${deMatch[1].padStart(2, '0')}`;
    if (isValidIsoDate(iso)) return iso;
  }
  return null;
}

function normalizeStatus(raw: string): MemberStatus | null {
  const val = raw.trim().toLowerCase();
  if (!val || val === 'active' || val === 'aktiv') return 'active';
  if (val === 'inactive' || val === 'inaktiv') return 'inactive';
  if (val === 'archived' || val === 'archiv' || val === 'archiviert') return 'archived';
  return null;
}

function normalizeLicenseClass(raw: string): LicenseClass | null {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (cleaned === 'FW475' || cleaned === 'FW_475' || cleaned === 'FW4,75' || cleaned === 'FW4.75' || cleaned === 'FW_4,75' || cleaned === 'FW_4.75' || cleaned === 'FW475T' || cleaned === 'FW4,75T') {
    return 'FW_475';
  }
  if (cleaned === 'FW750' || cleaned === 'FW_750' || cleaned === 'FW7,5' || cleaned === 'FW7.5' || cleaned === 'FW_7,5' || cleaned === 'FW_7.5' || cleaned === 'FW7,5T' || cleaned === 'FW7.5T') {
    return 'FW_750';
  }
  if ((ALL_LICENSE_CLASSES as string[]).includes(cleaned)) {
    return cleaned as LicenseClass;
  }
  return null;
}

function parseLicensesField(raw: string, errors: string[]): MemberLicense[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const tokens = trimmed
    .split(/[,|]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const byClass = new Map<LicenseClass, MemberLicense>();

  for (const token of tokens) {
    const colonIdx = token.indexOf(':');
    const classPart = colonIdx === -1 ? token : token.slice(0, colonIdx);
    const datePart = colonIdx === -1 ? '' : token.slice(colonIdx + 1).trim();

    const licenseClass = normalizeLicenseClass(classPart);
    if (!licenseClass) {
      errors.push(`Unbekannte Führerscheinklasse "${classPart.trim()}"`);
      continue;
    }

    let expiresAt: string | null = null;
    if (datePart) {
      expiresAt = parseFlexibleDate(datePart);
      if (!expiresAt) {
        errors.push(`Ungültiges Ablaufdatum "${datePart}" bei Klasse ${licenseClass} (erwartet YYYY-MM-DD)`);
        continue;
      }
    }

    byClass.set(licenseClass, {
      license_class: licenseClass,
      issued_at: null,
      expires_at: expiresAt,
      key_numbers: [],
      notes: null,
    });
  }

  return Array.from(byClass.values());
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

export interface CsvImportPreview {
  delimiter: ';' | ',';
  totalRows: number;
  createCount: number;
  updateCount: number;
  errorCount: number;
  rows: CsvPreviewRow[];
}

export function previewCsvImport(csvText: string, db: AppDatabase): CsvImportPreview {
  if (!csvText || !csvText.trim()) {
    throw new HttpError(400, 'CSV-Inhalt darf nicht leer sein.');
  }

  const { delimiter, records } = parseCsvRows(csvText);
  if (records.length < 2) {
    throw new HttpError(400, 'CSV muss eine Kopfzeile und mindestens eine Datenzeile enthalten.');
  }

  const headerRow = records[0];
  const columnMap: Array<CanonicalField | null> = headerRow.map(
    (h) => HEADER_MAP[normalizeHeaderKey(h)] ?? null,
  );

  if (!columnMap.includes('first_name') || !columnMap.includes('last_name')) {
    throw new HttpError(
      400,
      'CSV-Kopfzeile muss mindestens die Spalten "Vorname" und "Nachname" enthalten.',
    );
  }

  const existingByPersonnel = new Map<string, number>();
  const existingByName = new Map<string, number>();

  const existingRows = db
    .prepare('SELECT id, first_name, last_name, personnel_number FROM members')
    .all() as Array<{
    id: number;
    first_name: string;
    last_name: string;
    personnel_number: string | null;
  }>;

  for (const r of existingRows) {
    if (r.personnel_number && r.personnel_number.trim()) {
      existingByPersonnel.set(r.personnel_number.trim().toLowerCase(), r.id);
    }
    const nameKey = `${r.first_name.trim().toLowerCase()}|${r.last_name.trim().toLowerCase()}`;
    if (!existingByName.has(nameKey)) {
      existingByName.set(nameKey, r.id);
    }
  }

  const previewRows: CsvPreviewRow[] = [];
  let createCount = 0;
  let updateCount = 0;
  let errorCount = 0;

  for (let idx = 1; idx < records.length; idx++) {
    const rawRow = records[idx];
    const rowNumber = idx + 1;
    const rawFields: Partial<Record<CanonicalField, string>> = {};

    for (let col = 0; col < columnMap.length; col++) {
      const target = columnMap[col];
      if (!target) continue;
      rawFields[target] = rawRow[col] ?? '';
    }

    const errors: string[] = [];
    const firstName = (rawFields.first_name ?? '').trim();
    const lastName = (rawFields.last_name ?? '').trim();
    if (!firstName) errors.push('Vorname fehlt');
    if (!lastName) errors.push('Nachname fehlt');

    const statusRaw = rawFields.status ?? '';
    const status = normalizeStatus(statusRaw);
    if (!status) {
      errors.push(`Ungültiger Status "${statusRaw}" (erlaubt: active, inactive, archived)`);
    }

    let cardIssuedAt: string | null = null;
    if (rawFields.card_issued_at && rawFields.card_issued_at.trim()) {
      cardIssuedAt = parseFlexibleDate(rawFields.card_issued_at);
      if (!cardIssuedAt) {
        errors.push(`Ungültiges Datum Karte_Ausstellung "${rawFields.card_issued_at}"`);
      }
    }

    let cardExpiresAt: string | null = null;
    if (rawFields.card_expires_at && rawFields.card_expires_at.trim()) {
      cardExpiresAt = parseFlexibleDate(rawFields.card_expires_at);
      if (!cardExpiresAt) {
        errors.push(`Ungültiges Datum Karte_Ablauf "${rawFields.card_expires_at}"`);
      }
    }

    const globalKeys = (rawFields.global_key_numbers ?? '')
      .split(/[,|]/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);

    const licenses = parseLicensesField(rawFields.licenses ?? '', errors);

    const personnelNumber = (rawFields.personnel_number ?? '').trim() || null;
    let existingMemberId: number | undefined;
    if (personnelNumber) {
      existingMemberId = existingByPersonnel.get(personnelNumber.toLowerCase());
    }
    if (existingMemberId === undefined && firstName && lastName) {
      existingMemberId = existingByName.get(`${firstName.toLowerCase()}|${lastName.toLowerCase()}`);
    }

    let action: 'create' | 'update' | 'error';
    if (errors.length > 0) {
      action = 'error';
      errorCount++;
    } else if (existingMemberId !== undefined) {
      action = 'update';
      updateCount++;
    } else {
      action = 'create';
      createCount++;
    }

    previewRows.push({
      rowNumber,
      action,
      errors,
      existingMemberId,
      data: {
        first_name: firstName,
        last_name: lastName,
        personnel_number: personnelNumber,
        unit: (rawFields.unit ?? '').trim() || null,
        email: (rawFields.email ?? '').trim() || null,
        phone: (rawFields.phone ?? '').trim() || null,
        status: status ?? 'active',
        license_number: (rawFields.license_number ?? '').trim() || null,
        card_issued_at: cardIssuedAt,
        card_expires_at: cardExpiresAt,
        issuing_authority: (rawFields.issuing_authority ?? '').trim() || null,
        global_key_numbers: globalKeys,
        licenses,
        notes: (rawFields.notes ?? '').trim() || null,
      },
    });
  }

  return {
    delimiter,
    totalRows: previewRows.length,
    createCount,
    updateCount,
    errorCount,
    rows: previewRows,
  };
}

export interface CsvImportCommitResult {
  created: number;
  updated: number;
  total: number;
}

export function commitCsvImport(csvText: string, db: AppDatabase): CsvImportCommitResult {
  const preview = previewCsvImport(csvText, db);
  if (preview.errorCount > 0) {
    const firstErr = preview.rows.find((r) => r.action === 'error');
    throw new HttpError(
      400,
      `CSV enthält ${preview.errorCount} fehlerhafte Zeile(n). Erste Fehlerzeile (${firstErr?.rowNumber}): ${firstErr?.errors.join(', ')}`,
    );
  }

  const now = new Date().toISOString();
  let created = 0;
  let updated = 0;

  const insertMemberStmt = db.prepare(`
    INSERT INTO members (
      first_name, last_name, personnel_number, unit, email, phone, status,
      license_number, card_issued_at, card_expires_at, issuing_authority,
      global_key_numbers_json, ban_active, ban_from, ban_until, ban_reason,
      notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, ?, ?, ?)
  `);

  const updateMemberStmt = db.prepare(`
    UPDATE members SET
      first_name = ?,
      last_name = ?,
      personnel_number = ?,
      unit = ?,
      email = ?,
      phone = ?,
      status = ?,
      license_number = ?,
      card_issued_at = COALESCE(?, card_issued_at),
      card_expires_at = ?,
      issuing_authority = COALESCE(?, issuing_authority),
      global_key_numbers_json = ?,
      notes = COALESCE(?, notes),
      updated_at = ?
    WHERE id = ?
  `);

  const deleteLicensesStmt = db.prepare('DELETE FROM member_licenses WHERE member_id = ?');
  const insertLicenseStmt = db.prepare(`
    INSERT INTO member_licenses (member_id, license_class, issued_at, expires_at, key_numbers_json, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of preview.rows) {
      const d = row.data;
      let memberId: number;

      if (row.action === 'update' && row.existingMemberId !== undefined) {
        updateMemberStmt.run(
          d.first_name,
          d.last_name,
          d.personnel_number,
          d.unit,
          d.email,
          d.phone,
          d.status,
          d.license_number,
          d.card_issued_at,
          d.card_expires_at,
          d.issuing_authority,
          JSON.stringify(d.global_key_numbers),
          d.notes,
          now,
          row.existingMemberId,
        );
        memberId = row.existingMemberId;
        deleteLicensesStmt.run(memberId);
        updated++;
      } else {
        const res = insertMemberStmt.run(
          d.first_name,
          d.last_name,
          d.personnel_number,
          d.unit,
          d.email,
          d.phone,
          d.status,
          d.license_number,
          d.card_issued_at,
          d.card_expires_at,
          d.issuing_authority,
          JSON.stringify(d.global_key_numbers),
          d.notes,
          now,
          now,
        );
        memberId = Number(res.lastInsertRowid);
        created++;
      }

      for (const lic of d.licenses) {
        insertLicenseStmt.run(
          memberId,
          lic.license_class,
          lic.issued_at,
          lic.expires_at,
          JSON.stringify(lic.key_numbers ?? []),
          lic.notes,
        );
      }
    }

    db.exec('COMMIT');
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback error
    }
    throw err;
  }

  return {
    created,
    updated,
    total: created + updated,
  };
}
