import type { EvaluatedMember } from '../../../shared/types.js';
import {
  LICENSE_CLASS_SHORT_LABELS,
  formatDateDe,
  isValidIsoDate,
  parseIsoDateParts,
} from '../../../shared/licenseRules.js';

function escapeIcalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldIcalLine(line: string): string {
  const maxBytes = 75;
  if (Buffer.byteLength(line, 'utf8') <= maxBytes) {
    return line;
  }

  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;
  let limit = maxBytes;

  for (const char of line) {
    const charBytes = Buffer.byteLength(char, 'utf8');
    if (currentBytes + charBytes > limit && current.length > 0) {
      chunks.push(current);
      current = ` ${char}`;
      currentBytes = 1 + charBytes;
      limit = maxBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks.join('\r\n');
}

function formatIcalDate(iso: string): string {
  return iso.replace(/-/g, '');
}

function addOneDayIso(iso: string): string {
  const { year, month, day } = parseIsoDateParts(iso);
  const dt = new Date(Date.UTC(year, month - 1, day + 1));
  const y = String(dt.getUTCFullYear()).padStart(4, '0');
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDtstampUtc(date: Date = new Date()): string {
  const y = String(date.getUTCFullYear()).padStart(4, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

interface IcalEventSpec {
  uid: string;
  dateIso: string;
  summary: string;
  description: string;
  alarmTrigger: string;
  alarmDescription: string;
}

function renderEvent(ev: IcalEventSpec, dtstamp: string): string[] {
  const dtStart = formatIcalDate(ev.dateIso);
  const dtEnd = formatIcalDate(addOneDayIso(ev.dateIso));
  return [
    'BEGIN:VEVENT',
    `UID:${ev.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${escapeIcalText(ev.summary)}`,
    `DESCRIPTION:${escapeIcalText(ev.description)}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `TRIGGER:${ev.alarmTrigger}`,
    `DESCRIPTION:${escapeIcalText(ev.alarmDescription)}`,
    'END:VALARM',
    'END:VEVENT',
  ];
}

export function generateIcalFeed(evaluatedMembers: EvaluatedMember[], departmentName: string): string {
  const dtstamp = formatDtstampUtc();
  const calName = `${departmentName || 'Feuerwehr'} - Führerscheintermine`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FW-Fuehrerschein//Feuerwehr Fuehrerscheinverwaltung//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcalText(calName)}`,
    'X-WR-TIMEZONE:Europe/Berlin',
  ];

  for (const member of evaluatedMembers) {
    if (member.status !== 'active') continue;

    const fullName = `${member.first_name} ${member.last_name}`.trim();
    const unitPart = member.unit ? `Einheit: ${member.unit}` : 'Einheit: -';

    const nextDue = member.evaluation.inspection.nextDueAt;
    if (nextDue && isValidIsoDate(nextDue)) {
      const lastDate = member.evaluation.inspection.lastInspectedAt
        ? formatDateDe(member.evaluation.inspection.lastInspectedAt)
        : 'Keine';
      lines.push(
        ...renderEvent(
          {
            uid: `fw-inspection-${member.id}-${nextDue}@fw-fuehrerschein`,
            dateIso: nextDue,
            summary: `Führerscheinkontrolle fällig: ${fullName}`,
            description: `${fullName} (${unitPart})\nLetzte Kontrolle: ${lastDate}\nFällig am: ${formatDateDe(nextDue)}`,
            alarmTrigger: '-P14D',
            alarmDescription: `Führerscheinkontrolle für ${fullName} in 14 Tagen fällig`,
          },
          dtstamp,
        ),
      );
    }

    for (const lic of member.evaluation.licenses) {
      if (!lic.expires_at || !isValidIsoDate(lic.expires_at)) continue;
      const classLabel = LICENSE_CLASS_SHORT_LABELS[lic.license_class];
      lines.push(
        ...renderEvent(
          {
            uid: `fw-license-${member.id}-${lic.license_class}-${lic.expires_at}@fw-fuehrerschein`,
            dateIso: lic.expires_at,
            summary: `Klasse ${classLabel} läuft ab: ${fullName}`,
            description: `${fullName} (${unitPart})\nFührerscheinklasse ${classLabel} befristet bis ${formatDateDe(lic.expires_at)}`,
            alarmTrigger: '-P30D',
            alarmDescription: `Klasse ${classLabel} für ${fullName} läuft in 30 Tagen ab`,
          },
          dtstamp,
        ),
      );
    }

    if (member.card_expires_at && isValidIsoDate(member.card_expires_at)) {
      lines.push(
        ...renderEvent(
          {
            uid: `fw-card-${member.id}-${member.card_expires_at}@fw-fuehrerschein`,
            dateIso: member.card_expires_at,
            summary: `Führerscheinkarte läuft ab: ${fullName}`,
            description: `${fullName} (${unitPart})\nFührerschein-Nr.: ${member.license_number || '-'}\nAblaufdatum Karte: ${formatDateDe(member.card_expires_at)}`,
            alarmTrigger: '-P30D',
            alarmDescription: `Führerscheinkarte für ${fullName} läuft in 30 Tagen ab`,
          },
          dtstamp,
        ),
      );
    }
  }

  lines.push('END:VCALENDAR');

  return `${lines.map(foldIcalLine).join('\r\n')}\r\n`;
}
