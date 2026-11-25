import type {
  EvaluatedLicense,
  FederalStateCode,
  FederalStatePreset,
  Inspection,
  InspectionEvaluation,
  LegacyLicensePreset,
  LicenseClass,
  Member,
  MemberEvaluation,
  MemberLicense,
  RuleSettings,
  StateRuleConfig,
  TrafficLight,
  Vehicle,
  VehicleDriverEntry,
} from './types.js';

export const EU_LICENSE_CLASSES: LicenseClass[] = [
  'AM',
  'A1',
  'A2',
  'A',
  'B',
  'BE',
  'C1',
  'C1E',
  'C',
  'CE',
  'D1',
  'D1E',
  'D',
  'DE',
  'L',
  'T',
];

export const FW_LICENSE_CLASSES: LicenseClass[] = ['FW_475', 'FW_750'];

export const ALL_LICENSE_CLASSES: LicenseClass[] = [...EU_LICENSE_CLASSES, ...FW_LICENSE_CLASSES];

export const LICENSE_CLASS_LABELS: Record<LicenseClass, string> = {
  AM: 'AM (Kleinkrafträder)',
  A1: 'A1 (Leichtkrafträder)',
  A2: 'A2 (Krafträder bis 35 kW)',
  A: 'A (Krafträder unbeschränkt)',
  B: 'B (PKW bis 3,5 t)',
  BE: 'BE (PKW + Anhänger)',
  C1: 'C1 (LKW bis 7,5 t)',
  C1E: 'C1E (C1 + Anhänger)',
  C: 'C (Schwere LKW)',
  CE: 'CE (LKW + Anhänger)',
  D1: 'D1 (Kleinbusse)',
  D1E: 'D1E (D1 + Anhänger)',
  D: 'D (Busse)',
  DE: 'DE (Busse + Anhänger)',
  L: 'L (Zugmaschinen bis 40 km/h)',
  T: 'T (Zugmaschinen bis 60 km/h)',
  FW_475: 'Feuerwehrführerschein 4,75 t',
  FW_750: 'Feuerwehrführerschein 7,5 t',
};

export const LICENSE_CLASS_SHORT_LABELS: Record<LicenseClass, string> = {
  AM: 'AM',
  A1: 'A1',
  A2: 'A2',
  A: 'A',
  B: 'B',
  BE: 'BE',
  C1: 'C1',
  C1E: 'C1E',
  C: 'C',
  CE: 'CE',
  D1: 'D1',
  D1E: 'D1E',
  D: 'D',
  DE: 'DE',
  L: 'L',
  T: 'T',
  FW_475: 'FW 4,75t',
  FW_750: 'FW 7,5t',
};

export const KEY_NUMBER_CATALOG: Array<{ code: string; label: string }> = [
  { code: '01', label: '01 – Sehhilfe / Korrektur des Sehvermögens' },
  { code: '78', label: '78 – Nur Fahrzeuge mit Automatikgetriebe' },
  { code: '79', label: '79 – Besitzstand alte Klasse 3 (z. B. CE 79 bis 12 t / 3 Achsen)' },
  { code: '95', label: '95 – Berufskraftfahrerqualifikation' },
  { code: '96', label: '96 – Fahrzeugkombination bis 4.250 kg (B96)' },
  { code: '171', label: '171 – Klasse C1 berechtigt Busse (leer) bis 7,5 t' },
  { code: '172', label: '172 – Klasse C berechtigt Busse (leer) über 3,5 t' },
  { code: '196', label: '196 – Krafträder bis 125 ccm mit Klasse B' },
  { code: '197', label: '197 – Automatikprüfung ohne Schaltgetriebe-Beschränkung' },
];

export const INCLUDED_BY_CLASS: Partial<Record<LicenseClass, LicenseClass[]>> = {
  B: ['AM', 'L'],
  BE: ['B', 'AM', 'L'],
  C1: ['B', 'AM', 'L'],
  C1E: ['C1', 'BE', 'B', 'AM', 'L'],
  C: ['C1', 'B', 'AM', 'L'],
  CE: ['C', 'C1E', 'C1', 'BE', 'B', 'AM', 'L'],
  D1: ['B', 'AM', 'L'],
  D1E: ['D1', 'BE', 'B', 'AM', 'L'],
  D: ['D1', 'B', 'AM', 'L'],
  DE: ['D', 'D1E', 'D1', 'BE', 'B', 'AM', 'L'],
  A: ['A2', 'A1', 'AM'],
  A2: ['A1', 'AM'],
  A1: ['AM'],
  T: ['L', 'AM'],
  FW_750: ['FW_475'],
};

export const EXPIRING_CLASSES: LicenseClass[] = ['C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE'];

export const LEGACY_LICENSE_PRESETS: LegacyLicensePreset[] = [
  {
    id: 'klasse_3',
    shortLabel: 'Klasse 3 (vor 1999)',
    label: 'Alte Klasse 3 (Erwerb vor 01.01.1999)',
    mappedClasses: ['B', 'BE', 'C1', 'C1E', 'AM', 'L'],
    optionalClasses: [
      {
        license_class: 'CE',
        key_numbers: ['79'],
        label: 'CE mit Schlüsselzahl 79 (Züge über 7,5 t bis 12 t / max. 3 Achsen)',
      },
    ],
    summary: 'Umfasst unbefristet B, BE, C1, C1E, AM und L sowie optional CE 79 für größere Züge.',
    specialNotes: [
      'Besitzstand C1 und C1E gilt unbefristet (ohne 5-Jahres-Befristung) – ideal für Feuerwehrfahrzeuge bis 7,5 t zGM (z. B. TSF-W, LF 8/6, MLF).',
      'Optionaler Besitzstand CE mit Schlüsselzahl 79 (Züge bis 12 t / 3 Achsen) wird ab dem 50. Lebensjahr alle 5 Jahre untersuchungs- und verlängerungspflichtig.',
      'Hinweis zum Pflichtumtausch: Alte graue/rosa Papierführerscheine müssen gestaffelt gegen EU-Kartenführerscheine umgetauscht werden; der Besitzstand bleibt dabei erhalten.',
    ],
    defaultNote: 'Umschreibung aus alter Klasse 3 (vor 01.01.1999)',
  },
  {
    id: 'klasse_3_1980',
    shortLabel: 'Klasse 3 (vor 04/1980)',
    label: 'Alte Klasse 3 (Erwerb vor 01.04.1980)',
    mappedClasses: ['B', 'BE', 'C1', 'C1E', 'A1', 'AM', 'L'],
    optionalClasses: [
      {
        license_class: 'CE',
        key_numbers: ['79'],
        label: 'CE mit Schlüsselzahl 79 (Züge über 7,5 t bis 12 t / max. 3 Achsen)',
      },
    ],
    summary: 'Wie Klasse 3 vor 1999, zusätzlich mit unbefristetem Einschluss der Leichtkrafträder (Klasse A1).',
    specialNotes: [
      'Zusätzlich zur Klasse 3 vor 1999 ist die Motorrad-Leichtkraftradklasse A1 (bis 125 ccm / 11 kW) unbefristet eingeschlossen.',
      'Besitzstand C1 und C1E gilt unbefristet für Feuerwehrfahrzeuge bis 7,5 t zGM.',
      'Optionaler Besitzstand CE mit Schlüsselzahl 79 (Züge bis 12 t / 3 Achsen) unterliegt ab dem 50. Lebensjahr der 5-jährigen Untersuchungspflicht.',
    ],
    defaultNote: 'Umschreibung aus alter Klasse 3 (vor 01.04.1980, inkl. A1)',
  },
  {
    id: 'klasse_2',
    shortLabel: 'Klasse 2 (vor 1999)',
    label: 'Alte Klasse 2 (Erwerb vor 01.01.1999)',
    mappedClasses: ['C', 'CE', 'C1', 'C1E', 'B', 'BE', 'AM', 'L', 'T'],
    summary: 'Umfasst schwere LKW/Züge (C, CE), C1/C1E, B/BE sowie L, AM und T.',
    specialNotes: [
      'Wichtig: Für die Klassen C und CE besteht ab dem 50. Lebensjahr eine 5-jährige Verlängerungs- und Untersuchungspflicht – Ablaufdatum direkt bei C und CE eintragen!',
      'Die eingeschlossenen Klassen C1 und C1E (bis 7,5 t) sowie B, BE, AM, L und T bleiben aus dem Besitzstand heraus unbefristet gültig.',
      'Berechtigt im Feuerwehrdienst auch für schwere Lösch- und Hubrettungsfahrzeuge (z. B. HLF 20, LF 20, DLK, TLF) bei gültiger C/CE-Verlängerung.',
    ],
    defaultNote: 'Umschreibung aus alter Klasse 2 (vor 01.01.1999)',
  },
  {
    id: 'klasse_1',
    shortLabel: 'Klasse 1 (vor 1999)',
    label: 'Alte Klasse 1 (Motorrad unbeschränkt vor 1999)',
    mappedClasses: ['A', 'A2', 'A1', 'AM'],
    summary: 'Unbefristete Berechtigung für alle Krafträder (A, A2, A1, AM).',
    specialNotes: [
      'Gilt unbefristet ohne regelmäßige ärztliche Verlängerungspflicht.',
      'Enthält die Klassen A, A2, A1 und AM (z. B. für Kradmelder der Feuerwehr).',
    ],
    defaultNote: 'Umschreibung aus alter Klasse 1 (vor 01.01.1999)',
  },
  {
    id: 'klasse_1b',
    shortLabel: 'Klasse 1b (vor 1999)',
    label: 'Alte Klasse 1b (Leichtkrafträder vor 1999)',
    mappedClasses: ['A1', 'AM'],
    summary: 'Unbefristete Berechtigung für Leichtkrafträder bis 125 ccm (A1, AM).',
    specialNotes: [
      'Gilt unbefristet ohne Verlängerungspflicht.',
      'Umfasst die EU-Klassen A1 und AM.',
    ],
    defaultNote: 'Umschreibung aus alter Klasse 1b (vor 01.01.1999)',
  },
  {
    id: 'klasse_4',
    shortLabel: 'Klasse 4 (vor 1999)',
    label: 'Alte Klasse 4 (Kleinkrafträder & Zugmaschinen vor 1999)',
    mappedClasses: ['AM', 'L'],
    summary: 'Unbefristete Berechtigung für Kleinkrafträder (AM) und Zugmaschinen bis 40 km/h (L).',
    specialNotes: [
      'Gilt unbefristet ohne Verlängerungspflicht.',
      'Umfasst die EU-Klassen AM und L.',
    ],
    defaultNote: 'Umschreibung aus alter Klasse 4 (vor 01.01.1999)',
  },
  {
    id: 'klasse_5',
    shortLabel: 'Klasse 5 (vor 1999)',
    label: 'Alte Klasse 5 (Zugmaschinen vor 1999)',
    mappedClasses: ['L'],
    summary: 'Unbefristete Berechtigung für land-/forstwirtschaftliche Zugmaschinen bis 40 km/h (Klasse L).',
    specialNotes: [
      'Gilt unbefristet ohne Verlängerungspflicht.',
      'Entspricht der EU-Klasse L.',
    ],
    defaultNote: 'Umschreibung aus alter Klasse 5 (vor 01.01.1999)',
  },
];

export const FEDERAL_STATE_PRESETS: Record<FederalStateCode, FederalStatePreset> = {
  SH: {
    code: 'SH',
    name: 'Schleswig-Holstein',
    regulationName: 'Fahrberechtigungsverordnung SH (FahrbVO)',
    summary:
      'Feuerwehrführerschein bis 4,75 t und 7,5 t inkl. Kombinationen bei mindestens 2 Jahren Vorbesitz der Klasse B.',
    highlights: [
      'Gilt für Einsatzfahrzeuge bis 4,75 t bzw. 7,5 t zGM jeweils inklusive Kombinationen bis zu dieser Gesamtmasse.',
      'Voraussetzung: mindestens 2 Jahre ununterbrochener Vorbesitz der Klasse B.',
      'Mindestens 45 Minuten praktische Abschlussprüfung; Ausbilder mind. 30 Jahre alt und mind. 5 Jahre Klasse C1.',
      'Fahrberechtigungs-Bescheinigung (Rosa-Format) ist im Dienst stets mitzuführen; bundesweit nur im Ehrenamt gültig.',
    ],
    defaults: {
      fw_475_enabled: true,
      fw_750_enabled: true,
      fw_require_valid_b: true,
      fw_min_b_years: 2,
      fw_allow_trailers: true,
      fw_renewal_months: null,
      strict_inspection_blocking: false,
      custom_rules_notes: '',
    },
  },
  BW: {
    code: 'BW',
    name: 'Baden-Württemberg',
    regulationName: '2. Fahrberechtigungsverordnung BW (2. FbVO)',
    summary:
      'Fahrberechtigung bis 4,75 t und 7,5 t für ehrenamtliche Angehörige der Feuerwehr und Hilfsorganisationen.',
    highlights: [
      'Umfasst Einsatzfahrzeuge bis 4,75 t bzw. 7,5 t zGM inklusive Anhängerkombinationen.',
      'Mindestens 2 Jahre Vorbesitz der gültigen Klasse B erforderlich.',
      'Ausbildung und Einweisung durch qualifizierte organisationsinterne Einweiser oder Fahrschule.',
    ],
    defaults: {
      fw_475_enabled: true,
      fw_750_enabled: true,
      fw_require_valid_b: true,
      fw_min_b_years: 2,
      fw_allow_trailers: true,
      fw_renewal_months: null,
      strict_inspection_blocking: false,
      custom_rules_notes: '',
    },
  },
  BY: {
    code: 'BY',
    name: 'Bayern',
    regulationName: 'Fahrberechtigungsverordnung Bayern (FBerV)',
    summary:
      'Bayerischer Feuerwehrführerschein bis 4,75 t und 7,5 t nach FBerV mit 2 Jahren Klasse-B-Vorbesitz.',
    highlights: [
      'Fahrberechtigung bis 4,75 t bzw. 7,5 t zGM (auch mit Anhänger innerhalb der jeweiligen Gesamtmasse).',
      'Voraussetzung: mindestens 2 Jahre Vorbesitz der Fahrerlaubnisklasse B ohne laufendes Fahrverbot.',
      'Einweisung umfasst mindestens 4 bzw. 6 Übungsfahrten à 45 Min. mit anschließender praktischer Prüfung.',
    ],
    defaults: {
      fw_475_enabled: true,
      fw_750_enabled: true,
      fw_require_valid_b: true,
      fw_min_b_years: 2,
      fw_allow_trailers: true,
      fw_renewal_months: null,
      strict_inspection_blocking: false,
      custom_rules_notes: '',
    },
  },
  BE: {
    code: 'BE',
    name: 'Berlin',
    regulationName: 'Fahrberechtigungsverordnung Berlin (FBV)',
    summary:
      'Landesregelung für ehrenamtliche Einsatzkräfte in Berlin bis 4,75 t und 7,5 t zGM.',
    highlights: [
      'Zulässig für ehrenamtliche Angehörige der Freiwilligen Feuerwehren und anerkannten Hilfsorganisationen.',
      'Mindestens 2 Jahre Vorbesitz der Klasse B zwingend erforderlich.',
      'Nur gültig für Einsatz-, Übungs- und Ausbildungsfahrten im Ehrenamt.',
    ],
    defaults: {
      fw_475_enabled: true,
      fw_750_enabled: true,
      fw_require_valid_b: true,
      fw_min_b_years: 2,
      fw_allow_trailers: true,
      fw_renewal_months: null,
      strict_inspection_blocking: false,
      custom_rules_notes: '',
    },
  },
  BB: {
    code: 'BB',
    name: 'Brandenburg',
    regulationName: 'Brandenburgische Fahrberechtigungsverordnung (BbgFBV)',
    summary:
      'Fahrberechtigung bis 4,75 t und 7,5 t für ehrenamtliche Einsatzkräfte im Land Brandenburg.',
    highlights: [
      'Gilt für Einsatzfahrzeuge und Kombinationen bis 4,75 t bzw. 7,5 t zGM.',
      'Mindestens 2 Jahre Vorbesitz Klasse B sowie gültige Fahrerlaubnis bei jeder Fahrt.',
      'Ausbildung und Prüfungsfahrt durch fachkundigen Ausbilder innerhalb der Organisation.',
    ],
    defaults: {
      fw_475_enabled: true,
      fw_750_enabled: true,
      fw_require_valid_b: true,
      fw_min_b_years: 2,
      fw_allow_trailers: true,
      fw_renewal_months: null,
      strict_inspection_blocking: false,
      custom_rules_notes: '',
    },
  },
  HB: {
    code: 'HB',
    name: 'Bremen',
    regulationName: 'Bremische Fahrberechtigungsverordnung (BremFBVO)',
    summary:
      'Regelung der Freien Hansestadt Bremen für Feuerwehr-Fahrberechtigungen bis 4,75 t und 7,5 t.',
    highlights: [
      'Deckt Einsatzfahrzeuge bis 4,75 t bzw. 7,5 t zGM inkl. Anhänger innerhalb der Massegrenze ab.',
      'Erfordert mindestens 2 Jahre Vorbesitz der Klasse B.',
      'Schriftlicher Nachweis muss bei Fahrten mitgeführt werden.',
    ],
    defaults: {
      fw_475_enabled: true,
      fw_750_enabled: true,
      fw_require_valid_b: true,
      fw_min_b_years: 2,
      fw_allow_trailers: true,
      fw_renewal_months: null,
      strict_inspection_blocking: false,
      custom_rules_notes: '',
    },
  },
  HH: {
    code: 'HH',
    name: 'Hamburg',
    regulationName: 'Hamburgische Feuerwehr-Fahrberechtigungsverordnung (HmbFwFBVO)',
    summary:
      'Hamburger Verordnung für Einsatzfahrzeuge der Freiwilligen Feuerwehr bis 4,75 t und 7,5 t.',
    highlights: [
      'Gilt für ehrenamtliche Mitglieder der Freiwilligen Feuerwehr Hamburg und Hilfsorganisationen.',
      'Mindestens 2 Jahre Vorbesitz der Klasse B; bei Entzug/Sperre von B ruht die Fahrberechtigung.',
      'Ausbildung durch qualifizierte Einweiser der Feuerwehrschule bzw. Organisation.',
    ],
    defaults: {
      fw_475_enabled: true,
      fw_750_enabled: true,
      fw_require_valid_b: true,
      fw_min_b_years: 2,
      fw_allow_trailers: true,
      fw_renewal_months: null,
      strict_inspection_blocking: false,
      custom_rules_notes: '',
    },
  },
  HE: {
    code: 'HE',
    name: 'Hessen',
    regulationName: 'Hessische Fahrberechtigungsverordnung (HFbV)',
    summary:
      'Hessische Regelung für den Feuerwehrführerschein bis 4,75 t und 7,5 t inkl. Kombinationen.',
    highlights: [
      'Stufen bis 4,75 t (kleiner Feuerwehrführerschein) und bis 7,5 t zGM.',
      'Mindestens 2 Jahre Vorbesitz der gültigen Klasse B erforderlich.',
      'Praktische Einweisung und Prüfungsfahrt mit Dokumentation durch den Gemeindebrandinspektor / Leiter der Feuerwehr.',
    ],
    defaults: {
      fw_475_enabled: true,
      fw_750_enabled: true,
      fw_require_valid_b: true,
      fw_min_b_years: 2,
      fw_allow_trailers: true,
      fw_renewal_months: null,
      strict_inspection_blocking: false,
      custom_rules_notes: '',
    },
  },
  MV: {
    code: 'MV',
    name: 'Mecklenburg-Vorpommern',
    regulationName: 'Fahrberechtigungsverordnung M-V (FbVO M-V)',
    summary:
      'Landesverordnung M-V für Fahrberechtigungen bis 4,75 t und 7,5 t im Ehrenamt.',
    highlights: [
      'Umfasst Einsatzfahrzeuge und Kombinationen bis 4,75 t bzw. 7,5 t zGM.',
      'Erfordert mindestens 2 Jahre Vorbesitz der Klasse B.',
      'Nachweisliche Einweisung und Prüfung durch qualifizierten Ausbilder erforderlich.',
    ],
    defaults: {
      fw_475_enabled: true,
      fw_750_enabled: true,
      fw_require_valid_b: true,
      fw_min_b_years: 2,
      fw_allow_trailers: true,
      fw_renewal_months: null,
      strict_inspection_blocking: false,
      custom_rules_notes: '',
    },
  },
  NI: {
    code: 'NI',
    name: 'Niedersachsen',
    regulationName: 'Niedersächsische Fahrberechtigungsverordnung (NFbVO)',
    summary:
      'Niedersächsische Regelung bis 4,75 t und 7,5 t zGM für Feuerwehren und Hilfsorganisationen.',
    highlights: [
      'Stufen bis 4,75 t und 7,5 t zGM (inklusive Anhängerkombinationen innerhalb der Grenze).',
      'Mindestens 2 Jahre Vorbesitz der Klasse B erforderlich.',
      'Gilt nur für ehrenamtliche Aufgabenerfüllung; Bescheinigung ist mitzuführen.',
    ],
    defaults: {
      fw_475_enabled: true,
      fw_750_enabled: true,
      fw_require_valid_b: true,
      fw_min_b_years: 2,
      fw_allow_trailers: true,
      fw_renewal_months: null,
      strict_inspection_blocking: false,
      custom_rules_notes: '',
    },
  },
  NW: {
    code: 'NW',
    name: 'Nordrhein-Westfalen',
    regulationName: 'Fahrberechtigungsverordnung NRW (FbVO NRW)',
    summary:
      'NRW-Verordnung für Einsatzfahrzeuge bis 4,75 t und 7,5 t nach § 2 Abs. 10a StVG.',
    highlights: [
      'Gilt für Einsatzfahrzeuge bis 4,75 t bzw. 7,5 t zGM inklusive Anhänger innerhalb der Massegrenze.',
      'Voraussetzung: mindestens 2 Jahre ununterbrochener Besitz der Klasse B.',
      'Ausbildung durch einweisungsberechtigte Feuerwehrangehörige (mind. 30 Jahre, mind. 5 Jahre Klasse C1) oder Fahrlehrer.',
    ],
    defaults: {
      fw_475_enabled: true,
      fw_750_enabled: true,
      fw_require_valid_b: true,
      fw_min_b_years: 2,
      fw_allow_trailers: true,
      fw_renewal_months: null,
      strict_inspection_blocking: false,
      custom_rules_notes: '',
    },
  },
  RP: {
    code: 'RP',
    name: 'Rheinland-Pfalz',
    regulationName: 'Landesverordnung über die Erteilung von Fahrberechtigungen (FbLVO RP)',
    summary:
      'Rheinland-pfälzische Verordnung für Fahrberechtigungen bis 4,75 t und 7,5 t zGM.',
    highlights: [
      'Umfasst Einsatzfahrzeuge bis 4,75 t und 7,5 t inklusive zulässiger Kombinationen.',
      'Mindestens 2 Jahre Vorbesitz der Klasse B erforderlich.',
      'Erteilung durch Aufgabenträger nach praktischer Einweisung und Prüfungsfahrt.',
    ],
    defaults: {
      fw_475_enabled: true,
      fw_750_enabled: true,
      fw_require_valid_b: true,
      fw_min_b_years: 2,
      fw_allow_trailers: true,
      fw_renewal_months: null,
      strict_inspection_blocking: false,
      custom_rules_notes: '',
    },
  },
  SL: {
    code: 'SL',
    name: 'Saarland',
    regulationName: 'Saarländische Fahrberechtigungsverordnung (SFbVO)',
    summary:
      'Saarländische Landesregelung für den Feuerwehrführerschein bis 4,75 t und 7,5 t.',
    highlights: [
      'Berechtigt zum Führen von Einsatzfahrzeugen bis 4,75 t bzw. 7,5 t zGM im Ehrenamt.',
      'Mindestens 2 Jahre Vorbesitz der gültigen Klasse B erforderlich.',
      'Schriftliche Fahrberechtigung ist bei Dienstfahrten mitzuführen.',
    ],
    defaults: {
      fw_475_enabled: true,
      fw_750_enabled: true,
      fw_require_valid_b: true,
      fw_min_b_years: 2,
      fw_allow_trailers: true,
      fw_renewal_months: null,
      strict_inspection_blocking: false,
      custom_rules_notes: '',
    },
  },
  SN: {
    code: 'SN',
    name: 'Sachsen',
    regulationName: 'Sächsische Feuerwehr-Fahrberechtigungsverordnung (SächsFwFbVO)',
    summary:
      'Sächsische Verordnung über das Führen von Einsatzfahrzeugen bis 4,75 t und 7,5 t zGM.',
    highlights: [
      'Gilt für ehrenamtliche Feuerwehrangehörige bis 4,75 t bzw. 7,5 t zGM.',
      'Mindestens 2 Jahre Vorbesitz Klasse B sowie gültige Fahrerlaubnis erforderlich.',
      'Umfassende Einweisung mit mindestens 45-minütiger Prüfungsfahrt.',
    ],
    defaults: {
      fw_475_enabled: true,
      fw_750_enabled: true,
      fw_require_valid_b: true,
      fw_min_b_years: 2,
      fw_allow_trailers: true,
      fw_renewal_months: null,
      strict_inspection_blocking: false,
      custom_rules_notes: '',
    },
  },
  ST: {
    code: 'ST',
    name: 'Sachsen-Anhalt',
    regulationName: 'Fahrberechtigungsverordnung Sachsen-Anhalt (FbVO LSA)',
    summary:
      'Landesregelung Sachsen-Anhalt für Einsatzfahrzeuge bis 4,75 t und 7,5 t im Ehrenamt.',
    highlights: [
      'Umfasst Einsatzfahrzeuge bis 4,75 t und 7,5 t zGM inkl. Anhänger innerhalb der Grenze.',
      'Erfordert mindestens 2 Jahre Vorbesitz der Klasse B.',
      'Nur gültig für Einsatz- und Übungsfahrten der Feuerwehr / Hilfsorganisationen.',
    ],
    defaults: {
      fw_475_enabled: true,
      fw_750_enabled: true,
      fw_require_valid_b: true,
      fw_min_b_years: 2,
      fw_allow_trailers: true,
      fw_renewal_months: null,
      strict_inspection_blocking: false,
      custom_rules_notes: '',
    },
  },
  TH: {
    code: 'TH',
    name: 'Thüringen',
    regulationName: 'Thüringer Feuerwehr-Fahrberechtigungsverordnung (ThürFwFbVO)',
    summary:
      'Thüringer Verordnung für ehrenamtliche Feuerwehrangehörige bis 4,75 t und 7,5 t zGM.',
    highlights: [
      'Deckt Einsatzfahrzeuge bis 4,75 t bzw. 7,5 t zGM inklusive Kombinationen ab.',
      'Mindestens 2 Jahre Vorbesitz der gültigen Klasse B erforderlich.',
      'Ausbildung durch befähigten Ausbilder mit abschließender praktischer Prüfungsfahrt.',
    ],
    defaults: {
      fw_475_enabled: true,
      fw_750_enabled: true,
      fw_require_valid_b: true,
      fw_min_b_years: 2,
      fw_allow_trailers: true,
      fw_renewal_months: null,
      strict_inspection_blocking: false,
      custom_rules_notes: '',
    },
  },
};

export const FEDERAL_STATE_LIST: FederalStatePreset[] = [
  FEDERAL_STATE_PRESETS.SH,
  ...Object.values(FEDERAL_STATE_PRESETS)
    .filter((p) => p.code !== 'SH')
    .sort((a, b) => a.name.localeCompare(b.name, 'de')),
];

export function getDefaultStateRules(code: FederalStateCode = 'SH'): StateRuleConfig {
  const preset = FEDERAL_STATE_PRESETS[code] ?? FEDERAL_STATE_PRESETS.SH;
  return { ...preset.defaults };
}

export function resolveEffectiveStateRules(settings: RuleSettings): {
  federalState: FederalStateCode;
  stateName: string;
  rules: StateRuleConfig;
} {
  const federalState: FederalStateCode =
    settings.federal_state && FEDERAL_STATE_PRESETS[settings.federal_state]
      ? settings.federal_state
      : 'SH';
  const defaults = getDefaultStateRules(federalState);
  const patch = settings.state_rules ?? {};
  const rules: StateRuleConfig = {
    fw_475_enabled:
      patch.fw_475_enabled !== undefined ? Boolean(patch.fw_475_enabled) : defaults.fw_475_enabled,
    fw_750_enabled:
      patch.fw_750_enabled !== undefined ? Boolean(patch.fw_750_enabled) : defaults.fw_750_enabled,
    fw_require_valid_b:
      patch.fw_require_valid_b !== undefined
        ? Boolean(patch.fw_require_valid_b)
        : defaults.fw_require_valid_b,
    fw_min_b_years:
      patch.fw_min_b_years !== undefined && Number.isFinite(patch.fw_min_b_years)
        ? Math.max(0, Number(patch.fw_min_b_years))
        : defaults.fw_min_b_years,
    fw_allow_trailers:
      patch.fw_allow_trailers !== undefined
        ? Boolean(patch.fw_allow_trailers)
        : defaults.fw_allow_trailers,
    fw_renewal_months:
      patch.fw_renewal_months !== undefined
        ? patch.fw_renewal_months && Number(patch.fw_renewal_months) > 0
          ? Number(patch.fw_renewal_months)
          : null
        : defaults.fw_renewal_months,
    strict_inspection_blocking:
      patch.strict_inspection_blocking !== undefined
        ? Boolean(patch.strict_inspection_blocking)
        : defaults.strict_inspection_blocking,
    custom_rules_notes:
      patch.custom_rules_notes !== undefined
        ? String(patch.custom_rules_notes)
        : defaults.custom_rules_notes,
  };
  return {
    federalState,
    stateName: FEDERAL_STATE_PRESETS[federalState].name,
    rules,
  };
}

/**
 * Mapping: target class -> list of held classes that satisfy/include it.
 * Only non-expired held classes may be used for inclusion during active validation.
 */
export const CLASS_COVERED_BY: Record<LicenseClass, LicenseClass[]> = {
  B: ['B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE'],
  BE: ['BE', 'C1E', 'CE', 'D1E', 'DE'],
  C1: ['C1', 'C1E', 'C', 'CE'],
  C1E: ['C1E', 'CE'],
  C: ['C', 'CE'],
  CE: ['CE'],
  D1: ['D1', 'D1E', 'D', 'DE'],
  D1E: ['D1E', 'DE'],
  D: ['D', 'DE'],
  DE: ['DE'],
  AM: ['AM', 'A1', 'A2', 'A', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE', 'T'],
  A1: ['A1', 'A2', 'A'],
  A2: ['A2', 'A'],
  A: ['A'],
  L: ['L', 'T', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE'],
  T: ['T'],
  FW_475: ['FW_475', 'FW_750', 'C1', 'C1E', 'C', 'CE'],
  FW_750: ['FW_750', 'C1', 'C1E', 'C', 'CE'],
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(value: string | null | undefined): value is string {
  if (!value) return false;
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

export function getTodayIsoDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDateParts(iso: string): { year: number; month: number; day: number } {
  const match = DATE_RE.exec(iso);
  if (!match) {
    throw new Error(`Ungültiges Datumsformat (erwartet YYYY-MM-DD): ${iso}`);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

export function diffDaysIso(fromIso: string, toIso: string): number {
  const a = parseIsoDateParts(fromIso);
  const b = parseIsoDateParts(toIso);
  const utcA = Date.UTC(a.year, a.month - 1, a.day);
  const utcB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((utcB - utcA) / 86_400_000);
}

export function addMonthsIso(iso: string, months: number): string {
  const { year, month, day } = parseIsoDateParts(iso);
  const totalMonths = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const lastDayOfMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfMonth);
  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function formatDateDe(iso: string | null | undefined): string {
  if (!iso || !isValidIsoDate(iso)) return '–';
  const { year, month, day } = parseIsoDateParts(iso);
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
}

export function isBanCurrentlyActive(
  member: Pick<Member, 'ban_active' | 'ban_from' | 'ban_until'>,
  today: string,
): boolean {
  if (!member.ban_active) return false;
  if (member.ban_from && isValidIsoDate(member.ban_from) && today < member.ban_from) {
    return false;
  }
  if (member.ban_until && isValidIsoDate(member.ban_until) && today > member.ban_until) {
    return false;
  }
  return true;
}

export function worstStatus(...statuses: TrafficLight[]): TrafficLight {
  if (statuses.includes('red')) return 'red';
  if (statuses.includes('yellow')) return 'yellow';
  return 'green';
}

export function evaluateInspection(
  lastInspection: Inspection | null,
  settings: RuleSettings,
  today: string,
): InspectionEvaluation {
  if (!lastInspection) {
    return {
      status: 'yellow',
      lastInspectedAt: null,
      lastResult: null,
      nextDueAt: null,
      daysUntilDue: null,
      reason: 'Noch keine Führerscheinkontrolle erfasst',
    };
  }

  const nextDueAt = addMonthsIso(lastInspection.inspected_at, settings.inspection_interval_months);
  const daysUntilDue = diffDaysIso(today, nextDueAt);

  if (lastInspection.result === 'issue') {
    return {
      status: 'red',
      lastInspectedAt: lastInspection.inspected_at,
      lastResult: lastInspection.result,
      nextDueAt,
      daysUntilDue,
      reason: `Letzte Kontrolle mit Beanstandung (${formatDateDe(lastInspection.inspected_at)})`,
    };
  }

  if (daysUntilDue < 0) {
    return {
      status: 'yellow',
      lastInspectedAt: lastInspection.inspected_at,
      lastResult: lastInspection.result,
      nextDueAt,
      daysUntilDue,
      reason: `Führerscheinkontrolle seit ${Math.abs(daysUntilDue)} Tag(en) überfällig (fällig am ${formatDateDe(nextDueAt)})`,
    };
  }

  if (daysUntilDue <= settings.inspection_warn_days) {
    return {
      status: 'yellow',
      lastInspectedAt: lastInspection.inspected_at,
      lastResult: lastInspection.result,
      nextDueAt,
      daysUntilDue,
      reason:
        daysUntilDue === 0
          ? `Führerscheinkontrolle heute fällig (${formatDateDe(nextDueAt)})`
          : `Führerscheinkontrolle in ${daysUntilDue} Tag(en) fällig (${formatDateDe(nextDueAt)})`,
    };
  }

  return {
    status: 'green',
    lastInspectedAt: lastInspection.inspected_at,
    lastResult: lastInspection.result,
    nextDueAt,
    daysUntilDue,
    reason: `Kontrolle aktuell (nächste fällig am ${formatDateDe(nextDueAt)})`,
  };
}

export function evaluateSingleLicense(
  license: MemberLicense,
  settings: RuleSettings,
  today: string,
): EvaluatedLicense {
  if (!license.expires_at || !isValidIsoDate(license.expires_at)) {
    return {
      ...license,
      status: 'green',
      daysUntilExpiry: null,
      reason: 'Unbefristet gültig',
    };
  }

  const days = diffDaysIso(today, license.expires_at);
  if (days < 0) {
    return {
      ...license,
      status: 'red',
      daysUntilExpiry: days,
      reason: `Klasse ${LICENSE_CLASS_SHORT_LABELS[license.license_class]} seit ${formatDateDe(license.expires_at)} abgelaufen`,
    };
  }
  if (days <= settings.license_warn_days) {
    return {
      ...license,
      status: 'yellow',
      daysUntilExpiry: days,
      reason:
        days === 0
          ? `Klasse ${LICENSE_CLASS_SHORT_LABELS[license.license_class]} läuft heute ab`
          : `Klasse ${LICENSE_CLASS_SHORT_LABELS[license.license_class]} läuft in ${days} Tag(en) ab (${formatDateDe(license.expires_at)})`,
    };
  }
  return {
    ...license,
    status: 'green',
    daysUntilExpiry: days,
    reason: `Gültig bis ${formatDateDe(license.expires_at)}`,
  };
}

export function computeCoveredClasses(licenses: MemberLicense[], today: string, onlyValid: boolean): LicenseClass[] {
  const heldSet = new Set<LicenseClass>();
  for (const lic of licenses) {
    if (onlyValid && lic.expires_at && isValidIsoDate(lic.expires_at) && diffDaysIso(today, lic.expires_at) < 0) {
      continue;
    }
    heldSet.add(lic.license_class);
  }

  const covered: LicenseClass[] = [];
  for (const target of ALL_LICENSE_CLASSES) {
    const allowedHolders = CLASS_COVERED_BY[target];
    if (allowedHolders.some((holder) => heldSet.has(holder))) {
      covered.push(target);
    }
  }
  return covered;
}

export function evaluateMember(
  member: Member,
  lastInspection: Inspection | null,
  settings: RuleSettings,
  today: string = getTodayIsoDate(),
): MemberEvaluation {
  const banCurrentlyActive = isBanCurrentlyActive(member, today);
  const inspection = evaluateInspection(lastInspection, settings, today);
  const { stateName, rules } = resolveEffectiveStateRules(settings);

  const hasValidB = member.licenses.some((lic) => {
    if (!CLASS_COVERED_BY.B.includes(lic.license_class)) return false;
    if (lic.expires_at && isValidIsoDate(lic.expires_at) && diffDaysIso(today, lic.expires_at) < 0) {
      return false;
    }
    return true;
  });
  const bLicense = member.licenses.find((lic) => lic.license_class === 'B');

  const evaluatedLicenses = member.licenses.map((l) => {
    const isFw = l.license_class === 'FW_475' || l.license_class === 'FW_750';
    let effectiveLicense = l;

    if (
      isFw &&
      (!l.expires_at || !isValidIsoDate(l.expires_at)) &&
      rules.fw_renewal_months !== null &&
      rules.fw_renewal_months > 0 &&
      l.issued_at &&
      isValidIsoDate(l.issued_at)
    ) {
      effectiveLicense = {
        ...l,
        expires_at: addMonthsIso(l.issued_at, rules.fw_renewal_months),
      };
    }

    const base = evaluateSingleLicense(effectiveLicense, settings, today);
    if (!isFw) {
      return base;
    }

    let status: TrafficLight = base.status;
    const licReasons: string[] = [];
    if (base.status !== 'green') {
      licReasons.push(base.reason);
    }

    if (rules.fw_require_valid_b && !hasValidB) {
      status = 'red';
      licReasons.unshift(`Feuerwehrführerschein erfordert gültige Klasse B (${stateName})`);
    }

    if (
      (l.license_class === 'FW_475' && !rules.fw_475_enabled) ||
      (l.license_class === 'FW_750' && !rules.fw_750_enabled)
    ) {
      status = worstStatus(status, 'yellow');
      licReasons.push('Stufe in den aktuellen Landesregeln deaktiviert');
    }

    if (
      hasValidB &&
      rules.fw_min_b_years > 0 &&
      bLicense?.issued_at &&
      isValidIsoDate(bLicense.issued_at)
    ) {
      const minEligibleDate = addMonthsIso(bLicense.issued_at, rules.fw_min_b_years * 12);
      if (today < minEligibleDate) {
        status = worstStatus(status, 'yellow');
        licReasons.push(
          `Vorbesitz Klasse B unter ${rules.fw_min_b_years} Jahren (Landesregel prüfen)`,
        );
      }
    }

    return {
      ...l,
      status,
      daysUntilExpiry: base.daysUntilExpiry,
      reason: licReasons.length > 0 ? licReasons.join('; ') : base.reason,
    };
  });

  let cardStatus: TrafficLight = 'green';
  let cardDaysUntilExpiry: number | null = null;
  let cardReason: string | null = null;

  if (member.card_expires_at && isValidIsoDate(member.card_expires_at)) {
    cardDaysUntilExpiry = diffDaysIso(today, member.card_expires_at);
    if (cardDaysUntilExpiry < 0) {
      cardStatus = 'red';
      cardReason = `Führerscheinkarte seit ${formatDateDe(member.card_expires_at)} abgelaufen`;
    } else if (cardDaysUntilExpiry <= settings.license_warn_days) {
      cardStatus = 'yellow';
      cardReason =
        cardDaysUntilExpiry === 0
          ? 'Führerscheinkarte läuft heute ab'
          : `Führerscheinkarte läuft in ${cardDaysUntilExpiry} Tag(en) ab (${formatDateDe(member.card_expires_at)})`;
    }
  }

  const reasons: string[] = [];
  if (banCurrentlyActive) {
    reasons.push(
      member.ban_reason
        ? `Fahrverbot / Sperre aktiv: ${member.ban_reason}`
        : 'Fahrverbot / Sperre aktiv',
    );
  }
  if (cardReason) reasons.push(cardReason);
  for (const lic of evaluatedLicenses) {
    if (lic.status !== 'green') {
      reasons.push(lic.reason);
    }
  }
  if (inspection.status !== 'green') {
    reasons.push(inspection.reason);
  }

  let overallStatus: TrafficLight = 'green';
  if (
    banCurrentlyActive ||
    cardStatus === 'red' ||
    evaluatedLicenses.some((l) => l.status === 'red') ||
    inspection.status === 'red'
  ) {
    overallStatus = 'red';
  } else if (
    cardStatus === 'yellow' ||
    evaluatedLicenses.some((l) => l.status === 'yellow') ||
    inspection.status === 'yellow'
  ) {
    overallStatus = 'yellow';
  }

  const validHeldLicenses = evaluatedLicenses
    .filter((l) => l.status !== 'red')
    .map((l) => ({
      license_class: l.license_class,
      issued_at: l.issued_at,
      expires_at: null,
      key_numbers: l.key_numbers,
      notes: l.notes,
    }));

  return {
    overallStatus,
    banCurrentlyActive,
    reasons,
    inspection,
    cardStatus,
    cardDaysUntilExpiry,
    cardReason,
    licenses: evaluatedLicenses,
    validCoveredClasses: computeCoveredClasses(validHeldLicenses, today, true),
    anyCoveredClasses: computeCoveredClasses(member.licenses, today, false),
  };
}

function findBestCoveringLicense(
  memberLicenses: EvaluatedLicense[],
  requiredClasses: LicenseClass[],
  onlyValid: boolean,
): { license: EvaluatedLicense; directOrIncluded: 'direct' | 'included' } | null {
  const candidates: Array<{ license: EvaluatedLicense; directOrIncluded: 'direct' | 'included'; score: number }> = [];

  for (const req of requiredClasses) {
    const allowed = CLASS_COVERED_BY[req];
    for (const lic of memberLicenses) {
      if (onlyValid && lic.status === 'red') continue;
      if (!allowed.includes(lic.license_class)) continue;

      const directOrIncluded = lic.license_class === req ? 'direct' : 'included';
      let score = directOrIncluded === 'direct' ? 100 : 50;
      if (lic.status === 'green') score += 20;
      else if (lic.status === 'yellow') score += 10;
      candidates.push({ license: lic, directOrIncluded, score });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return {
    license: candidates[0].license,
    directOrIncluded: candidates[0].directOrIncluded,
  };
}

export function evaluateVehicleDrivers(
  vehicle: Vehicle,
  evaluatedMembers: Array<{ member: Member; evaluation: MemberEvaluation }>,
  settings?: RuleSettings,
): VehicleDriverEntry[] {
  const entries: VehicleDriverEntry[] = [];
  const required = vehicle.required_classes.length > 0 ? vehicle.required_classes : (['B'] as LicenseClass[]);
  const strictInspectionBlocking = settings
    ? resolveEffectiveStateRules(settings).rules.strict_inspection_blocking
    : false;

  for (const { member, evaluation } of evaluatedMembers) {
    if (member.status !== 'active') continue;

    // Only include members who possess at least one matching class (valid or expired)
    const anyMatch = findBestCoveringLicense(evaluation.licenses, required, false);
    if (!anyMatch) continue;

    const validMatch = findBestCoveringLicense(evaluation.licenses, required, true);
    const reasons: string[] = [];
    let status: TrafficLight = 'green';

    if (evaluation.banCurrentlyActive) {
      status = 'red';
      reasons.push(
        member.ban_reason
          ? `Fahrverbot / Sperre aktiv: ${member.ban_reason}`
          : 'Fahrverbot / Sperre aktiv',
      );
    }

    if (evaluation.cardStatus === 'red' && evaluation.cardReason) {
      status = 'red';
      reasons.push(evaluation.cardReason);
    }

    const inspectionBlocks =
      evaluation.inspection.status === 'red' ||
      (strictInspectionBlocking &&
        (evaluation.inspection.daysUntilDue === null || evaluation.inspection.daysUntilDue < 0));

    if (inspectionBlocks) {
      status = 'red';
      reasons.push(evaluation.inspection.reason);
    }

    if (!validMatch) {
      status = 'red';
      reasons.push(anyMatch.license.reason);
    }

    const activeMatch = validMatch ?? anyMatch;

    if (status !== 'red') {
      if (activeMatch.license.status === 'yellow') {
        status = worstStatus(status, 'yellow');
        reasons.push(activeMatch.license.reason);
      }
      if (evaluation.cardStatus === 'yellow' && evaluation.cardReason) {
        status = worstStatus(status, 'yellow');
        reasons.push(evaluation.cardReason);
      }
      if (evaluation.inspection.status === 'yellow') {
        status = worstStatus(status, 'yellow');
        reasons.push(evaluation.inspection.reason);
      }

      const hasKey78 =
        member.global_key_numbers.includes('78') ||
        activeMatch.license.key_numbers.includes('78');
      if (!vehicle.is_automatic && hasKey78) {
        status = worstStatus(status, 'yellow');
        reasons.push('Schlüsselzahl 78 (Automatik-Beschränkung) bei Schaltfahrzeug');
      }
    }

    if (reasons.length === 0) {
      reasons.push(
        activeMatch.directOrIncluded === 'direct'
          ? `Klasse ${LICENSE_CLASS_SHORT_LABELS[activeMatch.license.license_class]} gültig & Kontrolle aktuell`
          : `Über Klasse ${LICENSE_CLASS_SHORT_LABELS[activeMatch.license.license_class]} eingeschlossen & Kontrolle aktuell`,
      );
    }

    entries.push({
      memberId: member.id,
      firstName: member.first_name,
      lastName: member.last_name,
      unit: member.unit,
      personnelNumber: member.personnel_number,
      status,
      coveringClass: activeMatch.license.license_class,
      directOrIncluded: activeMatch.directOrIncluded,
      reasons,
      lastInspectedAt: evaluation.inspection.lastInspectedAt,
      nextInspectionDueAt: evaluation.inspection.nextDueAt,
    });
  }

  const order: Record<TrafficLight, number> = { green: 0, yellow: 1, red: 2 };
  entries.sort((a, b) => {
    const diff = order[a.status] - order[b.status];
    if (diff !== 0) return diff;
    const ln = a.lastName.localeCompare(b.lastName, 'de');
    return ln !== 0 ? ln : a.firstName.localeCompare(b.firstName, 'de');
  });

  return entries;
}
