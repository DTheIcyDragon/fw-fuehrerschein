import PDFDocument from 'pdfkit';
import {
  LICENSE_CLASS_SHORT_LABELS,
  formatDateDe,
  getTodayIsoDate,
} from '../../../shared/licenseRules.js';
import type {
  EvaluatedMember,
  EvaluatedVehicle,
  Inspection,
  TrafficLight,
} from '../../../shared/types.js';

/**
 * Normalize text to WinAnsi/Latin-1 safe characters so built-in PDFKit fonts
 * (Helvetica) never render garbled glyphs for arrows, dashes, or emojis,
 * while keeping German umlauts (äöüÄÖÜß) intact.
 */
function safePdfText(input: string | null | undefined): string {
  if (!input) return '-';
  return input
    .replace(/\u2192|\u2794|\u27A1/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/[\u201E\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/\u2022/g, '*')
    .replace(/\u20AC/g, 'EUR')
    .replace(/\u2026/g, '...')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '?');
}

function statusTag(status: TrafficLight): string {
  if (status === 'green') return '[OK]';
  if (status === 'yellow') return '[WARNUNG]';
  return '[GESPERRT]';
}

function statusColor(status: TrafficLight): string {
  if (status === 'green') return '#15803d';
  if (status === 'yellow') return '#b45309';
  return '#b91c1c';
}

function createPdfBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      bufferPages: true,
      info: {
        Producer: 'FW-Führerscheinverwaltung',
        Creator: 'FW-Führerscheinverwaltung',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      build(doc);
      // Add page footers across all pages
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(range.start + i);
        const prevBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#64748b')
          .text(
            safePdfText(`Seite ${i + 1} von ${range.count} - Erstellt am ${formatDateDe(getTodayIsoDate())}`),
            40,
            doc.page.height - 28,
            { align: 'right', width: doc.page.width - 80, lineBreak: false },
          );
        doc.page.margins.bottom = prevBottom;
      }
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function drawHeader(doc: PDFKit.PDFDocument, departmentName: string, title: string, subtitle?: string): void {
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#b91c1c')
    .text(safePdfText(departmentName), 40, 36);

  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#0f172a')
    .text(safePdfText(title), 40, 50);

  if (subtitle) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#475569')
      .text(safePdfText(subtitle), 40, 70);
    doc.y = 88;
  } else {
    doc.y = 74;
  }

  doc
    .moveTo(40, doc.y)
    .lineTo(doc.page.width - 40, doc.y)
    .strokeColor('#cbd5e1')
    .lineWidth(1)
    .stroke();
  doc.y += 12;
}

function ensureSpace(doc: PDFKit.PDFDocument, neededHeight: number): void {
  if (doc.y + neededHeight > doc.page.height - 50) {
    doc.addPage();
    doc.y = 40;
  }
}

export function generateInspectionsPdf(options: {
  departmentName: string;
  inspections: Inspection[];
  filterLabel?: string;
}): Promise<Buffer> {
  return createPdfBuffer((doc) => {
    const subtitleParts = [`Stand: ${formatDateDe(getTodayIsoDate())}`, `Einträge: ${options.inspections.length}`];
    if (options.filterLabel) subtitleParts.push(options.filterLabel);

    drawHeader(
      doc,
      options.departmentName,
      'Prüfprotokoll Führerscheinkontrollen',
      subtitleParts.join(' | '),
    );

    const colX = { date: 40, member: 105, unit: 225, result: 300, inspector: 375, notes: 455 };

    const drawTableHead = () => {
      const y = doc.y;
      doc.rect(40, y, doc.page.width - 80, 18).fill('#f1f5f9');
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1e293b');
      doc.text('Datum', colX.date + 4, y + 5, { width: 60 });
      doc.text('Kamerad', colX.member, y + 5, { width: 115 });
      doc.text('Einheit', colX.unit, y + 5, { width: 70 });
      doc.text('Ergebnis', colX.result, y + 5, { width: 70 });
      doc.text('Prüfer', colX.inspector, y + 5, { width: 75 });
      doc.text('Bemerkung', colX.notes, y + 5, { width: 100 });
      doc.y = y + 22;
    };

    drawTableHead();

    if (options.inspections.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#64748b')
        .text('Keine Führerscheinkontrollen im gewählten Zeitraum vorhanden.', 40, doc.y + 6);
      doc.y += 28;
    } else {
      for (const insp of options.inspections) {
        const isCancelled = Boolean(insp.cancelled_at);
        const dateText = safePdfText(formatDateDe(insp.inspected_at));
        const memberName = safePdfText(
          `${insp.member_last_name ?? ''}, ${insp.member_first_name ?? ''}`.replace(/^,\s*/, '') ||
            `#${insp.member_id}`,
        );
        const unitText = safePdfText(insp.member_unit ?? '-');
        const resultStr = isCancelled
          ? '[STORNIERT]'
          : insp.result === 'ok'
            ? '[OK] Ohne Befund'
            : '[BEANSTANDUNG]';
        const inspectorText = safePdfText(insp.inspector_name);

        const noteParts: string[] = [];
        if (isCancelled) {
          const cancelDate = insp.cancelled_at ? formatDateDe(insp.cancelled_at.slice(0, 10)) : '';
          noteParts.push(
            `Storniert${cancelDate && cancelDate !== '–' ? ` am ${cancelDate}` : ''}: ${insp.cancel_reason || 'Ohne Angabe'}`,
          );
        }
        if (insp.notes) {
          noteParts.push(insp.notes);
        }
        const notesText = safePdfText(noteParts.length > 0 ? noteParts.join(' | ') : '-');

        doc.font('Helvetica').fontSize(8.5);
        const rowHeight = Math.max(
          18,
          doc.heightOfString(dateText, { width: 60 }) + 6,
          doc.heightOfString(memberName, { width: 115 }) + 6,
          doc.heightOfString(unitText, { width: 70 }) + 6,
          doc.heightOfString(resultStr, { width: 72 }) + 6,
          doc.heightOfString(inspectorText, { width: 75 }) + 6,
          doc.heightOfString(notesText, { width: 100 }) + 6,
        );

        if (doc.y + rowHeight + 8 > doc.page.height - 60) {
          doc.addPage();
          doc.y = 40;
          drawTableHead();
        }

        const y = doc.y;
        const textColor = isCancelled ? '#64748b' : '#0f172a';

        doc.font('Helvetica').fontSize(8.5).fillColor(textColor);
        doc.text(dateText, colX.date + 4, y + 2, { width: 60 });
        doc.text(memberName, colX.member, y + 2, { width: 115 });
        doc.text(unitText, colX.unit, y + 2, { width: 70 });

        doc.fillColor(isCancelled ? '#64748b' : insp.result === 'ok' ? '#15803d' : '#b91c1c');
        doc.text(resultStr, colX.result, y + 2, { width: 72 });

        doc.fillColor(textColor);
        doc.text(inspectorText, colX.inspector, y + 2, { width: 75 });
        doc.text(notesText, colX.notes, y + 2, { width: 100 });

        doc
          .moveTo(40, y + rowHeight)
          .lineTo(doc.page.width - 40, y + rowHeight)
          .strokeColor('#e2e8f0')
          .lineWidth(0.5)
          .stroke();

        doc.y = y + rowHeight + 3;
      }
    }

    // Signature box for filing (Abheften)
    ensureSpace(doc, 95);
    doc.y += 18;
    const boxY = doc.y;
    doc
      .rect(40, boxY, doc.page.width - 80, 74)
      .strokeColor('#94a3b8')
      .lineWidth(0.8)
      .stroke();

    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor('#0f172a')
      .text('Prüfvermerk / Dokumentation zum Abheften', 50, boxY + 8);

    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor('#475569')
      .text(
        'Hiermit wird die ordnungsgemäße Durchführung bzw. Prüfung der oben aufgeführten Führerscheinkontrollen bestätigt.',
        50,
        boxY + 23,
        { width: doc.page.width - 100 },
      );

    const lineY = boxY + 58;
    doc.moveTo(50, lineY).lineTo(220, lineY).strokeColor('#475569').lineWidth(0.7).stroke();
    doc.moveTo(260, lineY).lineTo(540, lineY).strokeColor('#475569').lineWidth(0.7).stroke();

    doc.fontSize(8).fillColor('#64748b');
    doc.text('Ort, Datum', 50, lineY + 3);
    doc.text('Unterschrift Wehrführung / Beauftragter', 260, lineY + 3);
  });
}

export function generateVehiclesPdf(options: {
  departmentName: string;
  vehicles: EvaluatedVehicle[];
}): Promise<Buffer> {
  return createPdfBuffer((doc) => {
    drawHeader(
      doc,
      options.departmentName,
      'Fahrzeug-Fahrerliste (3-Stufen-Ampel)',
      `Stand: ${formatDateDe(getTodayIsoDate())} | Fahrzeuge: ${options.vehicles.length}`,
    );

    if (options.vehicles.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#64748b')
        .text('Keine Fahrzeuge vorhanden.', 40, doc.y + 6);
      return;
    }

    for (let vIdx = 0; vIdx < options.vehicles.length; vIdx++) {
      const v = options.vehicles[vIdx];
      ensureSpace(doc, 90);

      const titleLine = [
        v.name,
        v.call_sign ? `(${v.call_sign})` : '',
        v.license_plate ? `- ${v.license_plate}` : '',
      ]
        .filter(Boolean)
        .join(' ');

      const reqClasses = v.required_classes.map((c) => LICENSE_CLASS_SHORT_LABELS[c] ?? c).join(' / ');
      const metaLine = [
        v.unit ? `Einheit: ${v.unit}` : null,
        `Klassen (ODER): ${reqClasses || 'B'}`,
        `Getriebe: ${v.is_automatic ? 'Automatik' : 'Schaltgetriebe'}`,
        `[OK]: ${v.counts.green}  [WARNUNG]: ${v.counts.yellow}  [GESPERRT]: ${v.counts.red}`,
      ]
        .filter(Boolean)
        .join('  |  ');

      const boxY = doc.y;
      doc.rect(40, boxY, doc.page.width - 80, 36).fill('#f8fafc').stroke('#cbd5e1');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(safePdfText(titleLine), 48, boxY + 6);
      doc.font('Helvetica').fontSize(8).fillColor('#475569').text(safePdfText(metaLine), 48, boxY + 21);
      doc.y = boxY + 42;

      if (v.drivers.length === 0) {
        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor('#64748b')
          .text('Keine aktiven Kameraden mit passender Führerscheinklasse.', 48, doc.y);
        doc.y += 18;
      } else {
        for (const d of v.drivers) {
          const reasonStr = safePdfText(d.reasons.join('; '));
          const nameStr = safePdfText(`${d.lastName}, ${d.firstName}`);
          const unitStr = safePdfText(d.unit ?? '-');
          const classInfo = safePdfText(
            d.coveringClass
              ? `${LICENSE_CLASS_SHORT_LABELS[d.coveringClass]} (${d.directOrIncluded === 'direct' ? 'direkt' : 'inkl.'})`
              : '-',
          );

          doc.font('Helvetica').fontSize(8.5);
          const rowHeight = Math.max(
            16,
            doc.heightOfString(nameStr, { width: 115 }) + 4,
            doc.heightOfString(unitStr, { width: 65 }) + 4,
            doc.heightOfString(classInfo, { width: 70 }) + 4,
            doc.heightOfString(reasonStr, { width: 185 }) + 4,
          );
          ensureSpace(doc, rowHeight + 6);

          const y = doc.y;
          doc.font('Helvetica-Bold').fontSize(8).fillColor(statusColor(d.status));
          doc.text(statusTag(d.status), 44, y + 2, { width: 65 });

          doc.font('Helvetica').fontSize(8.5).fillColor('#0f172a');
          doc.text(nameStr, 112, y + 2, { width: 115 });
          doc.text(unitStr, 230, y + 2, { width: 65 });
          doc.text(classInfo, 298, y + 2, { width: 70 });

          doc.fontSize(8).fillColor('#334155').text(reasonStr, 370, y + 2, { width: 185 });

          doc
            .moveTo(40, y + rowHeight)
            .lineTo(doc.page.width - 40, y + rowHeight)
            .strokeColor('#e2e8f0')
            .lineWidth(0.5)
            .stroke();
          doc.y = y + rowHeight + 2;
        }
      }

      if (vIdx < options.vehicles.length - 1) {
        doc.y += 12;
      }
    }
  });
}

export function generateMembersPdf(options: {
  departmentName: string;
  members: EvaluatedMember[];
  filterLabel?: string;
}): Promise<Buffer> {
  return createPdfBuffer((doc) => {
    const subtitleParts = [
      `Stand: ${formatDateDe(getTodayIsoDate())}`,
      `Kameraden: ${options.members.length}`,
    ];
    if (options.filterLabel) subtitleParts.push(options.filterLabel);

    drawHeader(
      doc,
      options.departmentName,
      'Gesamtübersicht Kameraden & Führerscheine',
      subtitleParts.join(' | '),
    );

    if (options.members.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#64748b')
        .text('Keine Kameraden gefunden.', 40, doc.y + 6);
      return;
    }

    for (const m of options.members) {
      const classesText =
        m.licenses.length > 0
          ? m.licenses
              .map((l) =>
                l.expires_at
                  ? `${LICENSE_CLASS_SHORT_LABELS[l.license_class]} (bis ${formatDateDe(l.expires_at)})`
                  : LICENSE_CLASS_SHORT_LABELS[l.license_class],
              )
              .join(', ')
          : 'Keine Klassen hinterlegt';

      const cardText = m.card_expires_at
        ? `Karte bis ${formatDateDe(m.card_expires_at)}`
        : 'Karte: kein Ablaufdatum';
      const inspText = m.evaluation.inspection.nextDueAt
        ? `Kontrolle: ${formatDateDe(m.evaluation.inspection.lastInspectedAt)} -> fällig ${formatDateDe(m.evaluation.inspection.nextDueAt)}`
        : 'Kontrolle: noch nicht erfolgt';
      const reasonsText = m.evaluation.reasons.length > 0 ? m.evaluation.reasons.join(' | ') : 'Alles aktuell';

      const detailLine = safePdfText(`Klassen: ${classesText}`);
      const statusLine = safePdfText(`${cardText} | ${inspText}`);
      const hintLine = safePdfText(`Hinweis: ${reasonsText}`);

      const blockHeight =
        20 +
        doc.heightOfString(detailLine, { width: doc.page.width - 96 }) +
        doc.heightOfString(statusLine, { width: doc.page.width - 96 }) +
        doc.heightOfString(hintLine, { width: doc.page.width - 96 }) +
        14;

      ensureSpace(doc, blockHeight + 6);
      const y = doc.y;

      doc.rect(40, y, doc.page.width - 80, blockHeight).strokeColor('#cbd5e1').lineWidth(0.6).stroke();

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(statusColor(m.evaluation.overallStatus))
        .text(statusTag(m.evaluation.overallStatus), 48, y + 6, { width: 65 });

      const headerStr = [
        `${m.last_name}, ${m.first_name}`,
        m.personnel_number ? `(PersNr. ${m.personnel_number})` : '',
        m.unit ? `- ${m.unit}` : '',
      ]
        .filter(Boolean)
        .join(' ');

      doc
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .fillColor('#0f172a')
        .text(safePdfText(headerStr), 116, y + 6, { width: doc.page.width - 166 });

      let innerY = y + 20;
      doc.font('Helvetica').fontSize(8.2).fillColor('#1e293b');
      doc.text(detailLine, 48, innerY, { width: doc.page.width - 96 });
      innerY = doc.y + 2;
      doc.fillColor('#475569').text(statusLine, 48, innerY, { width: doc.page.width - 96 });
      innerY = doc.y + 2;
      doc.fillColor(statusColor(m.evaluation.overallStatus)).text(hintLine, 48, innerY, {
        width: doc.page.width - 96,
      });

      doc.y = y + blockHeight + 6;
    }
  });
}
