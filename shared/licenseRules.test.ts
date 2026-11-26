import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPIRING_CLASSES,
  FEDERAL_STATE_LIST,
  FEDERAL_STATE_PRESETS,
  INCLUDED_BY_CLASS,
  KEY_NUMBER_CATALOG,
  LEGACY_LICENSE_PRESETS,
  addMonthsIso,
  computeCoveredClasses,
  evaluateInspection,
  evaluateMember,
  evaluateVehicleDrivers,
  getDefaultStateRules,
} from './licenseRules.js';
import type { FederalStateCode, Inspection, Member, RuleSettings, Vehicle } from './types.js';

const baseSettings: RuleSettings = {
  inspection_interval_months: 6,
  license_warn_days: 90,
  inspection_warn_days: 30,
};

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 1,
    first_name: 'Max',
    last_name: 'Mustermann',
    personnel_number: '101',
    birth_date: null,
    unit: 'Löschzug 1',
    email: 'max@example.org',
    phone: null,
    status: 'active',
    license_number: 'B12345',
    card_issued_at: '2020-01-01',
    card_expires_at: '2035-01-01',
    issuing_authority: 'Stadt Muster',
    global_key_numbers: [],
    ban_active: false,
    ban_from: null,
    ban_until: null,
    ban_reason: null,
    notes: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    licenses: [],
    ...overrides,
  };
}

function makeInspection(inspectedAt: string, result: 'ok' | 'issue' = 'ok'): Inspection {
  return {
    id: 1,
    member_id: 1,
    inspected_at: inspectedAt,
    inspector_user_id: 1,
    inspector_name: 'Kommandant',
    result,
    notes: null,
    cancelled_at: null,
    cancelled_by_name: null,
    cancel_reason: null,
    checked_eu_card: true,
    checked_fw_license: false,
    checked_restrictions: false,
    created_at: '2026-01-01T00:00:00Z',
  };
}

test('addMonthsIso handles month-end clamping properly', () => {
  assert.equal(addMonthsIso('2026-08-31', 6), '2027-02-28');
  assert.equal(addMonthsIso('2023-08-31', 6), '2024-02-29');
  assert.equal(addMonthsIso('2026-01-15', 6), '2026-07-15');
});

test('computeCoveredClasses ignores expired classes for inclusions', () => {
  const covered = computeCoveredClasses(
    [
      { license_class: 'B', issued_at: '2015-01-01', expires_at: null, key_numbers: [], notes: null },
      { license_class: 'C', issued_at: '2020-01-01', expires_at: '2026-01-01', key_numbers: [], notes: null },
    ],
    '2026-06-01',
    true,
  );
  assert.ok(covered.includes('B'));
  assert.ok(!covered.includes('C'));
  assert.ok(!covered.includes('C1'));
  assert.ok(!covered.includes('FW_750'));
});

test('FW_750 covers FW_475 and FW_750, C covers C1 and FW_750', () => {
  const fw750Covered = computeCoveredClasses(
    [{ license_class: 'FW_750', issued_at: '2024-01-01', expires_at: null, key_numbers: [], notes: null }],
    '2026-06-01',
    true,
  );
  assert.ok(fw750Covered.includes('FW_750'));
  assert.ok(fw750Covered.includes('FW_475'));
  assert.ok(!fw750Covered.includes('C1'));

  const cCovered = computeCoveredClasses(
    [{ license_class: 'C', issued_at: '2024-01-01', expires_at: '2030-01-01', key_numbers: [], notes: null }],
    '2026-06-01',
    true,
  );
  assert.ok(cCovered.includes('C1'));
  assert.ok(cCovered.includes('FW_750'));
  assert.ok(cCovered.includes('FW_475'));
});

test('evaluateInspection returns yellow when missing or overdue, red on issue', () => {
  const missing = evaluateInspection(null, baseSettings, '2026-06-01');
  assert.equal(missing.status, 'yellow');

  const ok = evaluateInspection(makeInspection('2026-04-01'), baseSettings, '2026-06-01');
  assert.equal(ok.status, 'green');
  assert.equal(ok.nextDueAt, '2026-10-01');

  const soon = evaluateInspection(makeInspection('2025-12-15'), baseSettings, '2026-06-01');
  assert.equal(soon.status, 'yellow');

  const overdue = evaluateInspection(makeInspection('2025-11-01'), baseSettings, '2026-06-01');
  assert.equal(overdue.status, 'yellow');

  const issue = evaluateInspection(makeInspection('2026-05-15', 'issue'), baseSettings, '2026-06-01');
  assert.equal(issue.status, 'red');
});

test('evaluateMember handles active ban date range and card expiration', () => {
  const futureBanMember = makeMember({
    ban_active: true,
    ban_from: '2026-07-01',
    ban_until: '2026-08-01',
    ban_reason: 'Fahrverbot Juli',
    licenses: [{ license_class: 'B', issued_at: '2020-01-01', expires_at: null, key_numbers: [], notes: null }],
  });
  const evBefore = evaluateMember(futureBanMember, makeInspection('2026-05-01'), baseSettings, '2026-06-01');
  assert.equal(evBefore.banCurrentlyActive, false);
  assert.equal(evBefore.overallStatus, 'green');

  const evDuring = evaluateMember(futureBanMember, makeInspection('2026-05-01'), baseSettings, '2026-07-15');
  assert.equal(evDuring.banCurrentlyActive, true);
  assert.equal(evDuring.overallStatus, 'red');

  const expiredCardMember = makeMember({
    card_expires_at: '2026-05-01',
    licenses: [{ license_class: 'B', issued_at: '2010-01-01', expires_at: null, key_numbers: [], notes: null }],
  });
  const evCardDefault = evaluateMember(expiredCardMember, makeInspection('2026-05-15'), baseSettings, '2026-06-01');
  assert.equal(evCardDefault.cardStatus, 'red');
  assert.equal(evCardDefault.overallStatus, 'yellow');

  const evCardBlocking = evaluateMember(
    expiredCardMember,
    makeInspection('2026-05-15'),
    { ...baseSettings, state_rules: { expired_card_blocks_driving: true } },
    '2026-06-01',
  );
  assert.equal(evCardBlocking.overallStatus, 'red');
});

test('evaluateVehicleDrivers applies 3-tier status including key 78 (red on manual) and OR-required classes', () => {
  const vehicle: Vehicle = {
    id: 1,
    name: 'TSF-W',
    call_sign: 'Florian Muster 44',
    license_plate: 'AB-FW 112',
    unit: 'Löschzug 1',
    required_classes: ['C1', 'FW_750'],
    is_automatic: false,
    requires_trailer: false,
    requires_briefing: false,
    notes: null,
    active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  const today = '2026-06-01';
  const mGreen = makeMember({
    id: 1,
    first_name: 'Anna',
    last_name: 'Alpha',
    licenses: [
      { license_class: 'B', issued_at: '2020-01-01', expires_at: null, key_numbers: [], notes: null },
      { license_class: 'FW_750', issued_at: '2023-01-01', expires_at: null, key_numbers: [], notes: null },
    ],
  });
  const mKey78 = makeMember({
    id: 2,
    first_name: 'Bernd',
    last_name: 'Beta',
    global_key_numbers: ['78'],
    licenses: [{ license_class: 'C1', issued_at: '2023-01-01', expires_at: '2028-01-01', key_numbers: [], notes: null }],
  });
  const mRedExpired = makeMember({
    id: 3,
    first_name: 'Clara',
    last_name: 'Gamma',
    licenses: [
      { license_class: 'B', issued_at: '2015-01-01', expires_at: null, key_numbers: [], notes: null },
      { license_class: 'C', issued_at: '2020-01-01', expires_at: '2026-01-01', key_numbers: [], notes: null },
    ],
  });
  const mExcluded = makeMember({
    id: 4,
    first_name: 'Dieter',
    last_name: 'Delta',
    licenses: [{ license_class: 'B', issued_at: '2015-01-01', expires_at: null, key_numbers: [], notes: null }],
  });

  const evaluated = [mGreen, mKey78, mRedExpired, mExcluded].map((m) => ({
    member: m,
    evaluation: evaluateMember(m, makeInspection('2026-05-01'), baseSettings, today),
  }));

  const drivers = evaluateVehicleDrivers(vehicle, evaluated);
  assert.equal(drivers.length, 3);
  assert.equal(drivers[0].firstName, 'Anna');
  assert.equal(drivers[0].status, 'green');
  const bernd = drivers.find((d) => d.firstName === 'Bernd')!;
  assert.equal(bernd.status, 'red');
  assert.ok(bernd.reasons.some((r) => r.includes('78')));
  const clara = drivers.find((d) => d.firstName === 'Clara')!;
  assert.equal(clara.status, 'red');

  const autoVehicle: Vehicle = { ...vehicle, is_automatic: true };
  const autoDrivers = evaluateVehicleDrivers(autoVehicle, evaluated);
  const berndAuto = autoDrivers.find((d) => d.firstName === 'Bernd')!;
  assert.equal(berndAuto.status, 'green');
});

test('INCLUDED_BY_CLASS and EXPIRING_CLASSES cover expected class hierarchies', () => {
  assert.deepEqual(INCLUDED_BY_CLASS.B, ['AM', 'L']);
  assert.deepEqual(INCLUDED_BY_CLASS.C1, ['B', 'AM', 'L']);
  assert.deepEqual(INCLUDED_BY_CLASS.CE, ['C', 'C1E', 'C1', 'BE', 'B', 'AM', 'L']);
  assert.deepEqual(INCLUDED_BY_CLASS.A, ['A2', 'A1', 'AM']);
  assert.deepEqual(INCLUDED_BY_CLASS.FW_750, ['FW_475']);

  assert.ok(EXPIRING_CLASSES.includes('C1'));
  assert.ok(EXPIRING_CLASSES.includes('CE'));
  assert.ok(EXPIRING_CLASSES.includes('DE'));
  assert.ok(!EXPIRING_CLASSES.includes('B'));
  assert.ok(!EXPIRING_CLASSES.includes('FW_750'));
  assert.ok(KEY_NUMBER_CATALOG.some((k) => k.code === '79'));
});

test('LEGACY_LICENSE_PRESETS provides complete firefighter presets', () => {
  const byId = new Map(LEGACY_LICENSE_PRESETS.map((p) => [p.id, p]));
  const ids = ['klasse_3', 'klasse_3_1980', 'klasse_2', 'klasse_1', 'klasse_1b', 'klasse_4', 'klasse_5'];
  for (const id of ids) {
    assert.ok(byId.has(id), `Preset ${id} missing`);
  }

  const kl3 = byId.get('klasse_3')!;
  assert.deepEqual(kl3.mappedClasses, ['B', 'BE', 'C1', 'C1E', 'AM', 'L']);
  assert.ok(kl3.optionalClasses?.some((o) => o.license_class === 'CE' && o.key_numbers.includes('79')));

  const kl3_1980 = byId.get('klasse_3_1980')!;
  assert.ok(kl3_1980.mappedClasses.includes('A1'));
  assert.ok(kl3_1980.optionalClasses?.some((o) => o.license_class === 'CE' && o.key_numbers.includes('79')));

  const kl2 = byId.get('klasse_2')!;
  assert.deepEqual(kl2.mappedClasses, ['C', 'CE', 'C1', 'C1E', 'B', 'BE', 'AM', 'L', 'T']);
});

test('FEDERAL_STATE_PRESETS and FEDERAL_STATE_LIST cover all 16 federal states with SH default', () => {
  const allCodes: FederalStateCode[] = [
    'SH', 'BW', 'BY', 'BE', 'BB', 'HB', 'HH', 'HE',
    'MV', 'NI', 'NW', 'RP', 'SL', 'SN', 'ST', 'TH',
  ];
  assert.equal(FEDERAL_STATE_LIST.length, 16);
  assert.equal(FEDERAL_STATE_LIST[0].code, 'SH');
  for (const code of allCodes) {
    const preset = FEDERAL_STATE_PRESETS[code];
    assert.ok(preset, `Missing preset for ${code}`);
    assert.ok(preset.regulationName.length > 0);
    assert.ok(preset.highlights.length > 0);
  }
  const shDefaults = getDefaultStateRules('SH');
  assert.equal(shDefaults.fw_475_enabled, true);
  assert.equal(shDefaults.fw_750_enabled, true);
  assert.equal(shDefaults.fw_require_valid_b, true);
  assert.equal(shDefaults.fw_min_b_years, 2);
});

test('evaluateMember enforces fw_require_valid_b, fw_min_b_years, fw_renewal_months, and disabled FW tiers', () => {
  const today = '2026-06-01';
  const insp = makeInspection('2026-05-01');

  // 1. Missing valid B makes FW_750 red when fw_require_valid_b is true
  const noBMember = makeMember({
    licenses: [{ license_class: 'FW_750', issued_at: '2024-01-01', expires_at: null, key_numbers: [], notes: null }],
  });
  const evNoB = evaluateMember(noBMember, insp, { ...baseSettings, federal_state: 'SH' }, today);
  assert.equal(evNoB.overallStatus, 'red');
  assert.equal(evNoB.licenses[0].status, 'red');
  assert.ok(evNoB.licenses[0].reason.includes('Klasse B'));
  assert.ok(!evNoB.validCoveredClasses.includes('FW_750'));
  assert.ok(!evNoB.validCoveredClasses.includes('FW_475'));

  // 2. Valid B held < fw_min_b_years triggers yellow warning
  const shortBMember = makeMember({
    licenses: [
      { license_class: 'B', issued_at: '2025-01-01', expires_at: null, key_numbers: [], notes: null },
      { license_class: 'FW_750', issued_at: '2025-06-01', expires_at: null, key_numbers: [], notes: null },
    ],
  });
  const evShortB = evaluateMember(shortBMember, insp, { ...baseSettings, federal_state: 'SH' }, today);
  assert.equal(evShortB.overallStatus, 'yellow');
  assert.ok(evShortB.reasons.some((r) => r.includes('Vorbesitz Klasse B unter 2 Jahren')));

  // 3. fw_renewal_months applies effective expiry to FW license without explicit expires_at
  const renewalMember = makeMember({
    licenses: [
      { license_class: 'B', issued_at: '2018-01-01', expires_at: null, key_numbers: [], notes: null },
      { license_class: 'FW_750', issued_at: '2020-01-01', expires_at: null, key_numbers: [], notes: null },
    ],
  });
  const evRenewalExpired = evaluateMember(
    renewalMember,
    insp,
    { ...baseSettings, state_rules: { fw_renewal_months: 60 } },
    today,
  );
  assert.equal(evRenewalExpired.overallStatus, 'red');
  assert.ok(!evRenewalExpired.validCoveredClasses.includes('FW_750'));

  // 4. Disabled FW tier triggers yellow warning
  const disabledTierEv = evaluateMember(
    makeMember({
      licenses: [
        { license_class: 'B', issued_at: '2018-01-01', expires_at: null, key_numbers: [], notes: null },
        { license_class: 'FW_475', issued_at: '2024-01-01', expires_at: null, key_numbers: [], notes: null },
      ],
    }),
    insp,
    { ...baseSettings, state_rules: { fw_475_enabled: false } },
    today,
  );
  assert.equal(disabledTierEv.overallStatus, 'yellow');
  assert.ok(disabledTierEv.reasons.some((r) => r.includes('deaktiviert')));
});

test('evaluateVehicleDrivers blocks missing/overdue inspections as red when strict_inspection_blocking is true', () => {
  const vehicle: Vehicle = {
    id: 1,
    name: 'HLF 10',
    call_sign: null,
    license_plate: null,
    unit: null,
    required_classes: ['B'],
    is_automatic: true,
    requires_trailer: false,
    requires_briefing: false,
    notes: null,
    active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };
  const today = '2026-06-01';
  const m = makeMember({
    id: 10,
    licenses: [{ license_class: 'B', issued_at: '2018-01-01', expires_at: null, key_numbers: [], notes: null }],
  });

  const strictSettings: RuleSettings = {
    ...baseSettings,
    state_rules: { strict_inspection_blocking: true },
  };

  const missingEval = evaluateMember(m, null, strictSettings, today);
  const overdueEval = evaluateMember(m, makeInspection('2025-10-01'), strictSettings, today);

  const normalDrivers = evaluateVehicleDrivers(vehicle, [{ member: m, evaluation: missingEval }], baseSettings);
  assert.equal(normalDrivers[0].status, 'yellow');

  const strictMissingDrivers = evaluateVehicleDrivers(vehicle, [{ member: m, evaluation: missingEval }], strictSettings);
  assert.equal(strictMissingDrivers[0].status, 'red');

  const strictOverdueDrivers = evaluateVehicleDrivers(vehicle, [{ member: m, evaluation: overdueEval }], strictSettings);
  assert.equal(strictOverdueDrivers[0].status, 'red');
});

test('CE with key number 79 covers C1/C1E/FW_750 but NOT C or unrestricted CE', () => {
  const ce79Covered = computeCoveredClasses(
    [{ license_class: 'CE', issued_at: '1995-01-01', expires_at: null, key_numbers: ['79'], notes: null }],
    '2026-06-01',
    true,
  );
  assert.ok(ce79Covered.includes('C1'));
  assert.ok(ce79Covered.includes('C1E'));
  assert.ok(ce79Covered.includes('FW_750'));
  assert.ok(!ce79Covered.includes('C'));
  assert.ok(!ce79Covered.includes('CE'));

  const heavyVehicle: Vehicle = {
    id: 99,
    name: 'HLF 20',
    call_sign: null,
    license_plate: null,
    unit: null,
    required_classes: ['C'],
    is_automatic: true,
    requires_trailer: false,
    requires_briefing: false,
    notes: null,
    active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };
  const ce79Member = makeMember({
    id: 20,
    licenses: [{ license_class: 'CE', issued_at: '1995-01-01', expires_at: null, key_numbers: ['79'], notes: null }],
  });
  const ev = evaluateMember(ce79Member, makeInspection('2026-05-01'), baseSettings, '2026-06-01');
  assert.equal(evaluateVehicleDrivers(heavyVehicle, [{ member: ce79Member, evaluation: ev }]).length, 0);

  const c1Vehicle: Vehicle = { ...heavyVehicle, required_classes: ['C1E'] };
  const c1Drivers = evaluateVehicleDrivers(c1Vehicle, [{ member: ce79Member, evaluation: ev }]);
  assert.equal(c1Drivers.length, 1);
  assert.equal(c1Drivers[0].status, 'green');
});

test('birth_date triggers 50-year warning and staggered exchange deadline hints', () => {
  const m50 = makeMember({
    birth_date: '1976-10-01',
    licenses: [
      { license_class: 'B', issued_at: '1995-01-01', expires_at: null, key_numbers: [], notes: null },
      { license_class: 'CE', issued_at: '1995-01-01', expires_at: null, key_numbers: ['79'], notes: null },
    ],
  });
  const ev50 = evaluateMember(m50, makeInspection('2026-05-01'), baseSettings, '2026-06-01');
  assert.equal(ev50.overallStatus, 'yellow');
  assert.ok(ev50.reasons.some((r) => r.includes('50. Lebensjahr')));

  const mOldCard = makeMember({
    birth_date: '1968-05-01',
    card_issued_at: '1990-01-01',
    card_expires_at: null,
    licenses: [{ license_class: 'B', issued_at: '1990-01-01', expires_at: null, key_numbers: [], notes: null }],
  });
  const evOldCard = evaluateMember(mOldCard, makeInspection('2026-05-01'), baseSettings, '2026-06-01');
  assert.equal(evOldCard.overallStatus, 'yellow');
  assert.ok(evOldCard.reasons.some((r) => r.includes('Umtauschfrist')));
});

test('fw_allow_trailers=false blocks FW drivers on trailer vehicles, and requires_briefing warns when unbriefed', () => {
  const trailerVehicle: Vehicle = {
    id: 50,
    name: 'GW-L2 mit Anhänger',
    call_sign: null,
    license_plate: null,
    unit: null,
    required_classes: ['C1', 'FW_750'],
    is_automatic: true,
    requires_trailer: true,
    requires_briefing: true,
    notes: null,
    active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };
  const fwMember = makeMember({
    id: 30,
    licenses: [
      { license_class: 'B', issued_at: '2015-01-01', expires_at: null, key_numbers: [], notes: null },
      { license_class: 'FW_750', issued_at: '2020-01-01', expires_at: null, key_numbers: [], notes: null },
    ],
  });
  const ev = evaluateMember(fwMember, makeInspection('2026-05-01'), baseSettings, '2026-06-01');

  const unbriefed = evaluateVehicleDrivers(trailerVehicle, [{ member: fwMember, evaluation: ev }], baseSettings, new Set());
  assert.equal(unbriefed[0].status, 'yellow');
  assert.equal(unbriefed[0].isBriefed, false);
  assert.ok(unbriefed[0].reasons.some((r) => r.includes('Einweisung fehlt')));

  const briefed = evaluateVehicleDrivers(trailerVehicle, [{ member: fwMember, evaluation: ev }], baseSettings, new Set([30]));
  assert.equal(briefed[0].status, 'green');
  assert.equal(briefed[0].isBriefed, true);

  const noTrailerSettings: RuleSettings = {
    ...baseSettings,
    state_rules: { fw_allow_trailers: false },
  };
  const blockedTrailer = evaluateVehicleDrivers(trailerVehicle, [{ member: fwMember, evaluation: ev }], noTrailerSettings, new Set([30]));
  assert.equal(blockedTrailer[0].status, 'red');
  assert.ok(blockedTrailer[0].reasons.some((r) => r.includes('Anhängerbetrieb')));
});
