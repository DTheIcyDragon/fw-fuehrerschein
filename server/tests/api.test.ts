import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { addMonthsIso, getTodayIsoDate } from '../../shared/licenseRules.js';
import type {
  AppSettingsPublic,
  EvaluatedMember,
  EvaluatedVehicle,
  Inspection,
  NotificationLogEntry,
  PublicUser,
} from '../../shared/types.js';
import { createApp } from '../src/app.js';

class CookieClient {
  private cookies = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  private updateCookies(res: Response): void {
    const setCookies =
      typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : [];
    for (const raw of setCookies) {
      const firstPart = raw.split(';', 1)[0];
      const eqIdx = firstPart.indexOf('=');
      if (eqIdx === -1) continue;
      const name = firstPart.slice(0, eqIdx).trim();
      const value = firstPart.slice(eqIdx + 1).trim();
      if (!value) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }

  private cookieHeader(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  async request(
    method: string,
    urlPath: string,
    body?: unknown,
    contentType?: string,
  ): Promise<{ status: number; headers: Headers; buffer: Buffer }> {
    const headers: Record<string, string> = {};
    const cookie = this.cookieHeader();
    if (cookie) {
      headers.Cookie = cookie;
    }
    let rawBody: string | Uint8Array | undefined;
    if (body !== undefined) {
      if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
        headers['Content-Type'] = contentType ?? 'application/octet-stream';
        rawBody = new Uint8Array(body);
      } else {
        headers['Content-Type'] = contentType ?? 'application/json';
        rawBody = JSON.stringify(body);
      }
    }

    const res = await fetch(`${this.baseUrl}${urlPath}`, {
      method,
      headers,
      body: rawBody,
    });
    this.updateCookies(res);
    const buffer = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, buffer };
  }

  async json<T = unknown>(
    method: string,
    urlPath: string,
    body?: unknown,
  ): Promise<{ status: number; headers: Headers; data: T }> {
    const res = await this.request(method, urlPath, body);
    const text = res.buffer.toString('utf8');
    const data = text ? (JSON.parse(text) as T) : (undefined as T);
    return { status: res.status, headers: res.headers, data };
  }
}

async function startTestApp(): Promise<{
  baseUrl: string;
  dataDir: string;
  cleanup: () => Promise<void>;
}> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fw-app-test-'));
  const { app, close } = createApp({ dataDir, enableScheduler: false });

  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  const cleanup = async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  };

  return { baseUrl, dataDir, cleanup };
}

test('End-to-End API: Auth/Roles, Members/Licenses/Inspections/Vehicles, CSV, PDF, iCal, JMAP, Backup/Restore', async (t) => {
  const { baseUrl, cleanup } = await startTestApp();
  t.after(async () => {
    await cleanup();
  });

  const anonClient = new CookieClient(baseUrl);
  const adminClient = new CookieClient(baseUrl);
  const inspectorClient = new CookieClient(baseUrl);
  const viewerClient = new CookieClient(baseUrl);

  const today = getTodayIsoDate();
  const futureDate = addMonthsIso(today, 36);
  const pastDate = addMonthsIso(today, -6);

  // =========================================================================
  // 1. Setup, Auth & Rollen
  // =========================================================================
  let adminUser!: PublicUser;

  await t.test('1. Setup, Auth & Rollenberechtigungen', async () => {
    const health = await anonClient.json<{ status: string }>('GET', '/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.status, 'ok');

    const unauthMembers = await anonClient.json('GET', '/api/members');
    assert.equal(unauthMembers.status, 401);

    const statusBefore = await anonClient.json<{
      needsSetup: boolean;
      user: PublicUser | null;
      departmentName: string;
    }>('GET', '/api/auth/status');
    assert.equal(statusBefore.status, 200);
    assert.equal(statusBefore.data.needsSetup, true);
    assert.equal(statusBefore.data.user, null);

    const setupRes = await adminClient.json<{
      user: PublicUser;
      departmentName: string;
    }>('POST', '/api/auth/setup', {
      department_name: 'FF Musterstadt',
      inspection_interval_months: 6,
      username: 'admin',
      display_name: 'Kommandant Admin',
      email: 'admin@feuerwehr.local',
      password: 'admin-password',
    });
    assert.equal(setupRes.status, 201);
    assert.equal(setupRes.data.user.role, 'admin');
    assert.equal(setupRes.data.departmentName, 'FF Musterstadt');
    adminUser = setupRes.data.user;

    const statusAfter = await adminClient.json<{
      needsSetup: boolean;
      user: PublicUser | null;
    }>('GET', '/api/auth/status');
    assert.equal(statusAfter.status, 200);
    assert.equal(statusAfter.data.needsSetup, false);
    assert.equal(statusAfter.data.user?.username, 'admin');

    const secondSetup = await anonClient.json('POST', '/api/auth/setup', {
      username: 'hacker',
      password: 'password123',
    });
    assert.ok(secondSetup.status === 403 || secondSetup.status === 400);

    // Create inspector and viewer
    const createInspector = await adminClient.json<PublicUser>('POST', '/api/users', {
      username: 'pruefer',
      display_name: 'Gerätewart Prüfer',
      email: 'pruefer@feuerwehr.local',
      password: 'pruefer-password',
      role: 'inspector',
    });
    assert.equal(createInspector.status, 201);
    assert.equal(createInspector.data.role, 'inspector');

    const createViewer = await adminClient.json<PublicUser>('POST', '/api/users', {
      username: 'leser',
      display_name: 'Nur Lesen',
      email: 'leser@feuerwehr.local',
      password: 'leser-password',
      role: 'viewer',
    });
    assert.equal(createViewer.status, 201);
    assert.equal(createViewer.data.role, 'viewer');

    // Login as admin, inspector, viewer
    const adminLogin = await adminClient.json<{ user: PublicUser }>('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin-password',
    });
    assert.equal(adminLogin.status, 200);
    assert.equal(adminLogin.data.user.role, 'admin');

    const inspLogin = await inspectorClient.json<{ user: PublicUser }>('POST', '/api/auth/login', {
      username: 'pruefer',
      password: 'pruefer-password',
    });
    assert.equal(inspLogin.status, 200);
    assert.equal(inspLogin.data.user.role, 'inspector');

    const viewerLogin = await viewerClient.json<{ user: PublicUser }>('POST', '/api/auth/login', {
      username: 'leser',
      password: 'leser-password',
    });
    assert.equal(viewerLogin.status, 200);
    assert.equal(viewerLogin.data.user.role, 'viewer');

    // Last active admin must NOT be deleted, deactivated, or demoted
    const delLastAdmin = await adminClient.json('DELETE', `/api/users/${adminUser.id}`);
    assert.equal(delLastAdmin.status, 400);

    const deactivateLastAdmin = await adminClient.json('PUT', `/api/users/${adminUser.id}`, {
      active: false,
    });
    assert.equal(deactivateLastAdmin.status, 400);

    const demoteLastAdmin = await adminClient.json('PUT', `/api/users/${adminUser.id}`, {
      role: 'inspector',
    });
    assert.equal(demoteLastAdmin.status, 400);

    // viewer gets 403 on write endpoints
    assert.equal(
      (await viewerClient.json('POST', '/api/members', { first_name: 'A', last_name: 'B' })).status,
      403,
    );
    assert.equal(
      (await viewerClient.json('PUT', '/api/members/1', { first_name: 'A' })).status,
      403,
    );
    assert.equal((await viewerClient.json('DELETE', '/api/members/1')).status, 403);
    assert.equal(
      (await viewerClient.json('POST', '/api/inspections', { member_id: 1, result: 'ok' })).status,
      403,
    );
    assert.equal(
      (await viewerClient.json('POST', '/api/vehicles', { name: 'LF', required_classes: ['B'] })).status,
      403,
    );
    assert.equal((await viewerClient.json('PUT', '/api/settings', { department_name: 'X' })).status, 403);

    // inspector cannot access settings or create vehicles, nor delete members
    assert.equal((await inspectorClient.json('GET', '/api/settings')).status, 403);
    assert.equal((await inspectorClient.json('PUT', '/api/settings', { department_name: 'X' })).status, 403);
    assert.equal(
      (
        await inspectorClient.json('POST', '/api/vehicles', {
          name: 'TLF',
          required_classes: ['C1'],
        })
      ).status,
      403,
    );
  });

  // =========================================================================
  // 2. Kameraden, Führerscheine, Kontrollen & Fahrzeuge
  // =========================================================================
  let memberGreen!: EvaluatedMember;
  let memberYellow78!: EvaluatedMember;
  let memberRedExpired!: EvaluatedMember;
  let memberRedBan!: EvaluatedMember;
  let testVehicle!: EvaluatedVehicle;

  await t.test('2. Kameraden, Führerscheine, Kontrollen & Fahrzeug-3-Stufen-Ampel', async () => {
    // Inspector creates green candidate (starts yellow due to missing inspection)
    const createGreen = await inspectorClient.json<EvaluatedMember>('POST', '/api/members', {
      first_name: 'Anna',
      last_name: 'Gruen',
      personnel_number: '101',
      unit: 'Löschzug 1',
      email: 'anna@feuerwehr.local',
      status: 'active',
      license_number: 'B0101',
      card_issued_at: pastDate,
      card_expires_at: futureDate,
      global_key_numbers: [],
      licenses: [
        { license_class: 'B', issued_at: addMonthsIso(today, -36), expires_at: null, key_numbers: [] },
        { license_class: 'FW_750', issued_at: pastDate, expires_at: null, key_numbers: [] },
      ],
    });
    assert.equal(createGreen.status, 201);
    assert.equal(createGreen.data.evaluation.overallStatus, 'yellow');
    assert.equal(createGreen.data.evaluation.inspection.lastInspectedAt, null);

    // Inspector updates member (add phone & note)
    const updateGreen = await inspectorClient.json<EvaluatedMember>(
      'PUT',
      `/api/members/${createGreen.data.id}`,
      { phone: '0171-111111', notes: 'Aktualisiert durch Prüfer' },
    );
    assert.equal(updateGreen.status, 200);
    assert.equal(updateGreen.data.phone, '0171-111111');
    assert.equal(updateGreen.data.licenses.length, 2);

    // Record inspection -> status switches to green, protocol retrievable
    const inspRes = await inspectorClient.json<Inspection>('POST', '/api/inspections', {
      member_id: createGreen.data.id,
      inspected_at: today,
      result: 'ok',
      notes: 'Originalkarte vorgelegt',
    });
    assert.equal(inspRes.status, 201);
    assert.equal(inspRes.data.inspector_name, 'Gerätewart Prüfer');

    const getGreen = await viewerClient.json<EvaluatedMember>(
      'GET',
      `/api/members/${createGreen.data.id}`,
    );
    assert.equal(getGreen.status, 200);
    assert.equal(getGreen.data.evaluation.overallStatus, 'green');
    memberGreen = getGreen.data;

    const inspList = await viewerClient.json<Inspection[]>(
      'GET',
      `/api/inspections?memberId=${memberGreen.id}`,
    );
    assert.equal(inspList.status, 200);
    assert.equal(inspList.data.length, 1);
    assert.equal(inspList.data[0].notes, 'Originalkarte vorgelegt');

    // Member with key number 78 (automatic restriction) + valid C1
    const createYellow78 = await adminClient.json<EvaluatedMember>('POST', '/api/members', {
      first_name: 'Bernd',
      last_name: 'Gelb',
      personnel_number: '102',
      unit: 'Löschzug 1',
      email: 'bernd@feuerwehr.local',
      status: 'active',
      card_expires_at: futureDate,
      global_key_numbers: ['78'],
      licenses: [
        { license_class: 'B', issued_at: pastDate, expires_at: null, key_numbers: ['78'] },
        { license_class: 'C1', issued_at: pastDate, expires_at: futureDate, key_numbers: [] },
      ],
    });
    assert.equal(createYellow78.status, 201);
    await inspectorClient.json('POST', '/api/inspections', {
      member_id: createYellow78.data.id,
      inspected_at: today,
      result: 'ok',
    });
    memberYellow78 = (
      await adminClient.json<EvaluatedMember>('GET', `/api/members/${createYellow78.data.id}`)
    ).data;
    assert.equal(memberYellow78.evaluation.overallStatus, 'green');
    assert.ok(memberYellow78.global_key_numbers.includes('78'));

    // Member with expired C1 class
    const createRedExpired = await adminClient.json<EvaluatedMember>('POST', '/api/members', {
      first_name: 'Clara',
      last_name: 'Abgelaufen',
      personnel_number: '103',
      unit: 'Löschzug 1',
      status: 'active',
      card_expires_at: futureDate,
      licenses: [
        { license_class: 'B', issued_at: pastDate, expires_at: null, key_numbers: [] },
        { license_class: 'C1', issued_at: pastDate, expires_at: pastDate, key_numbers: [] },
      ],
    });
    assert.equal(createRedExpired.status, 201);
    await inspectorClient.json('POST', '/api/inspections', {
      member_id: createRedExpired.data.id,
      inspected_at: today,
      result: 'ok',
    });
    memberRedExpired = (
      await adminClient.json<EvaluatedMember>('GET', `/api/members/${createRedExpired.data.id}`)
    ).data;
    assert.equal(memberRedExpired.evaluation.overallStatus, 'red');

    // Member with valid FW_750 + active driving ban
    const createRedBan = await adminClient.json<EvaluatedMember>('POST', '/api/members', {
      first_name: 'Dieter',
      last_name: 'Fahrverbot',
      personnel_number: '104',
      unit: 'Löschzug 2',
      status: 'active',
      card_expires_at: futureDate,
      ban_active: true,
      ban_from: addMonthsIso(today, -1),
      ban_until: addMonthsIso(today, 1),
      ban_reason: '1 Monat Fahrverbot',
      licenses: [{ license_class: 'FW_750', issued_at: pastDate, expires_at: null, key_numbers: [] }],
    });
    assert.equal(createRedBan.status, 201);
    await inspectorClient.json('POST', '/api/inspections', {
      member_id: createRedBan.data.id,
      inspected_at: today,
      result: 'ok',
    });
    memberRedBan = (
      await adminClient.json<EvaluatedMember>('GET', `/api/members/${createRedBan.data.id}`)
    ).data;
    assert.equal(memberRedBan.evaluation.banCurrentlyActive, true);
    assert.equal(memberRedBan.evaluation.overallStatus, 'red');

    // Manual vehicle requiring ['C1', 'FW_750'] -> check 3-tier traffic light
    const createVehicle = await adminClient.json<EvaluatedVehicle>('POST', '/api/vehicles', {
      name: 'TSF-W',
      call_sign: 'Florian Muster 44',
      license_plate: 'MS-FW 44',
      unit: 'Löschzug 1',
      required_classes: ['C1', 'FW_750'],
      is_automatic: false,
    });
    assert.equal(createVehicle.status, 201);
    testVehicle = createVehicle.data;

    const byId = new Map(testVehicle.drivers.map((d) => [d.memberId, d]));
    assert.equal(byId.get(memberGreen.id)?.status, 'green');
    assert.equal(byId.get(memberYellow78.id)?.status, 'yellow');
    assert.ok(byId.get(memberYellow78.id)?.reasons.some((r) => r.includes('78')));
    assert.equal(byId.get(memberRedExpired.id)?.status, 'red');
    assert.equal(byId.get(memberRedBan.id)?.status, 'red');
  });

  // =========================================================================
  // 3. CSV Export & Import Roundtrip
  // =========================================================================
  await t.test('3. CSV Export & Import Roundtrip', async () => {
    const expRes = await viewerClient.request('GET', '/api/export/members.csv');
    assert.equal(expRes.status, 200);
    // Check UTF-8 BOM (EF BB BF)
    assert.equal(expRes.buffer[0], 0xef);
    assert.equal(expRes.buffer[1], 0xbb);
    assert.equal(expRes.buffer[2], 0xbf);
    const csvText = expRes.buffer.subarray(3).toString('utf8');
    assert.ok(csvText.includes(';'));
    assert.ok(csvText.includes('Anna;Gruen'));
    assert.ok(csvText.includes('FW_750'));

    const importCsv = [
      'Personalnummer;Vorname;Nachname;Einheit;Email;Status;Klassen',
      '205;Sabine;Importiert;Löschzug 2;sabine@feuerwehr.local;active;"B, C1:2029-05-01"',
    ].join('\r\n');

    const previewRes = await adminClient.json<{
      createCount: number;
      updateCount: number;
      errorCount: number;
      rows: Array<{ action: string; data: { first_name: string; licenses: Array<{ license_class: string; expires_at: string | null }> } }>;
    }>('POST', '/api/import/csv/preview', { csv: importCsv });
    assert.equal(previewRes.status, 200);
    assert.equal(previewRes.data.createCount, 1);
    assert.equal(previewRes.data.errorCount, 0);

    const commitRes = await adminClient.json<{
      created: number;
      updated: number;
      total: number;
    }>('POST', '/api/import/csv/commit', { csv: importCsv });
    assert.equal(commitRes.status, 200);
    assert.equal(commitRes.data.created, 1);

    const searchImported = await adminClient.json<EvaluatedMember[]>(
      'GET',
      '/api/members?search=Importiert',
    );
    assert.equal(searchImported.status, 200);
    assert.equal(searchImported.data.length, 1);
    const sabine = searchImported.data[0];
    assert.equal(sabine.first_name, 'Sabine');
    assert.ok(sabine.licenses.some((l) => l.license_class === 'B'));
    assert.ok(
      sabine.licenses.some(
        (l) => l.license_class === 'C1' && l.expires_at === '2029-05-01',
      ),
    );
  });

  // =========================================================================
  // 4. PDF-Berichte
  // =========================================================================
  await t.test('4. PDF-Berichte (inspections, vehicles, members)', async () => {
    for (const endpoint of [
      '/api/reports/inspections.pdf',
      '/api/reports/vehicles.pdf',
      '/api/reports/members.pdf',
    ]) {
      const res = await viewerClient.request('GET', endpoint);
      assert.equal(res.status, 200, `${endpoint} should return 200`);
      assert.ok(
        res.headers.get('content-type')?.includes('application/pdf'),
        `${endpoint} should have application/pdf content-type`,
      );
      assert.equal(
        res.buffer.subarray(0, 5).toString('ascii'),
        '%PDF-',
        `${endpoint} should start with %PDF-`,
      );
      assert.ok(res.buffer.length > 500, `${endpoint} should not be empty`);
    }
  });

  // =========================================================================
  // 5. iCal-Feed & Token-Rotation
  // =========================================================================
  await t.test('5. iCal-Feed & Token-Rotation', async () => {
    const authFeed = await viewerClient.request('GET', '/api/calendar.ics');
    assert.equal(authFeed.status, 200);
    assert.ok(authFeed.headers.get('content-type')?.includes('text/calendar'));
    const authIcs = authFeed.buffer.toString('utf8');
    assert.ok(authIcs.includes('BEGIN:VCALENDAR'));
    assert.ok(authIcs.includes('BEGIN:VEVENT'));
    assert.ok(authIcs.includes('END:VCALENDAR'));

    const settingsRes = await adminClient.json<AppSettingsPublic>('GET', '/api/settings');
    assert.equal(settingsRes.status, 200);
    const oldToken = settingsRes.data.ical_token;
    assert.ok(oldToken.length >= 16);

    const tokenFeed = await anonClient.request('GET', `/api/calendar/${oldToken}.ics`);
    assert.equal(tokenFeed.status, 200);
    const tokenIcs = tokenFeed.buffer.toString('utf8');
    assert.ok(tokenIcs.includes('BEGIN:VCALENDAR'));
    assert.ok(tokenIcs.includes('BEGIN:VEVENT'));

    const invalidFeed = await anonClient.request('GET', '/api/calendar/invalid-token-999.ics');
    assert.ok(invalidFeed.status === 403 || invalidFeed.status === 404);

    const rotateRes = await adminClient.json<{ ical_token: string }>(
      'POST',
      '/api/settings/ical-token/rotate',
    );
    assert.equal(rotateRes.status, 200);
    const newToken = rotateRes.data.ical_token;
    assert.ok(newToken && newToken !== oldToken);

    const oldAfterRotate = await anonClient.request('GET', `/api/calendar/${oldToken}.ics`);
    assert.ok(oldAfterRotate.status === 403 || oldAfterRotate.status === 404);

    const newAfterRotate = await anonClient.request('GET', `/api/calendar/${newToken}.ics`);
    assert.equal(newAfterRotate.status, 200);
    assert.ok(newAfterRotate.buffer.toString('utf8').includes('BEGIN:VCALENDAR'));
  });

  // =========================================================================
  // 6. JMAP-Mail-Integration (Mock-Server) & Secret-Maskierung
  // =========================================================================
  await t.test('6. JMAP-Mail-Integration (Mock-Server) & Settings-Maskierung', async () => {
    const recorded: {
      sessionAuthHeaders: string[];
      apiAuthHeaders: string[];
      calledMethods: string[];
      createdEmails: Array<Record<string, unknown>>;
      createdSubmissions: Array<Record<string, unknown>>;
    } = {
      sessionAuthHeaders: [],
      apiAuthHeaders: [],
      calledMethods: [],
      createdEmails: [],
      createdSubmissions: [],
    };

    const jmapMockServer = http.createServer((req, res) => {
      const auth = req.headers.authorization ?? '';
      if (req.method === 'GET' && req.url === '/.well-known/jmap') {
        recorded.sessionAuthHeaders.push(auth);
        const port = (jmapMockServer.address() as AddressInfo).port;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            apiUrl: `http://127.0.0.1:${port}/jmap/api`,
            primaryAccounts: {
              'urn:ietf:params:jmap:mail': 'acc-fw',
              'urn:ietf:params:jmap:submission': 'acc-fw',
            },
          }),
        );
        return;
      }

      if (req.method === 'POST' && req.url === '/jmap/api') {
        recorded.apiAuthHeaders.push(auth);
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
            methodCalls: Array<[string, Record<string, unknown>, string]>;
          };

          const methodResponses: Array<[string, Record<string, unknown>, string]> = [];
          for (const [methodName, args, callId] of payload.methodCalls) {
            recorded.calledMethods.push(methodName);
            if (methodName === 'Identity/get') {
              methodResponses.push([
                'Identity/get',
                {
                  accountId: args.accountId,
                  list: [
                    {
                      id: 'id-fw-1',
                      email: 'kommandant@feuerwehr.local',
                      name: 'FF Musterstadt',
                    },
                  ],
                },
                callId,
              ]);
            } else if (methodName === 'Mailbox/query') {
              const filter = (args.filter ?? {}) as { role?: string };
              const ids = filter.role === 'drafts' ? ['mb-drafts'] : filter.role === 'sent' ? ['mb-sent'] : [];
              methodResponses.push(['Mailbox/query', { accountId: args.accountId, ids }, callId]);
            } else if (methodName === 'Email/set') {
              const create = (args.create ?? {}) as Record<string, Record<string, unknown>>;
              if (create.draft1) recorded.createdEmails.push(create.draft1);
              methodResponses.push([
                'Email/set',
                { accountId: args.accountId, created: { draft1: { id: 'email-123' } } },
                callId,
              ]);
            } else if (methodName === 'EmailSubmission/set') {
              const create = (args.create ?? {}) as Record<string, Record<string, unknown>>;
              if (create.sub1) recorded.createdSubmissions.push(create.sub1);
              methodResponses.push([
                'EmailSubmission/set',
                { accountId: args.accountId, created: { sub1: { id: 'sub-123' } } },
                callId,
              ]);
            } else {
              methodResponses.push(['error', { type: 'unknownMethod' }, callId]);
            }
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ methodResponses }));
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    await new Promise<void>((resolve) => jmapMockServer.listen(0, '127.0.0.1', resolve));
    const mockPort = (jmapMockServer.address() as AddressInfo).port;
    const sessionUrl = `http://127.0.0.1:${mockPort}/.well-known/jmap`;

    try {
      const secretToken = 'super-secret-jmap-token-123';
      const saveRes = await adminClient.json<AppSettingsPublic>('PUT', '/api/settings', {
        mail_provider: 'jmap',
        jmap: {
          sessionUrl,
          authType: 'bearer',
          token: secretToken,
          fromEmail: 'kommandant@feuerwehr.local',
          fromName: 'FF Musterstadt',
        },
      });
      assert.equal(saveRes.status, 200);
      assert.equal(saveRes.data.jmap.hasToken, true);
      assert.ok(!JSON.stringify(saveRes.data).includes(secretToken));

      const getSettingsRes = await adminClient.request('GET', '/api/settings');
      assert.equal(getSettingsRes.status, 200);
      const settingsText = getSettingsRes.buffer.toString('utf8');
      assert.ok(!settingsText.includes(secretToken), 'Klartext-Token darf nicht exponiert werden');
      const publicSettings = JSON.parse(settingsText) as AppSettingsPublic;
      assert.equal(publicSettings.jmap.hasToken, true);

      // Test mail with JMAP override
      const overrideToken = 'override-jmap-token-456';
      const testMailRes = await adminClient.json<{ ok: boolean; message: string }>(
        'POST',
        '/api/notifications/test',
        {
          toEmail: 'empfaenger@feuerwehr.local',
          override: {
            provider: 'jmap',
            jmap: {
              sessionUrl,
              authType: 'bearer',
              username: '',
              token: overrideToken,
              password: '',
              fromEmail: 'kommandant@feuerwehr.local',
              fromName: 'FF Musterstadt',
              accountId: '',
            },
          },
        },
      );
      assert.equal(testMailRes.status, 200);
      assert.equal(testMailRes.data.ok, true);

      assert.ok(recorded.sessionAuthHeaders.includes(`Bearer ${overrideToken}`));
      assert.ok(recorded.apiAuthHeaders.includes(`Bearer ${overrideToken}`));
      assert.deepEqual(recorded.calledMethods, [
        'Identity/get',
        'Mailbox/query',
        'Mailbox/query',
        'Email/set',
        'EmailSubmission/set',
      ]);
      assert.equal(recorded.createdEmails.length, 1);
      const email = recorded.createdEmails[0];
      assert.ok(String(email.subject).includes('Test-E-Mail'));
      assert.deepEqual(email.to, [{ email: 'empfaenger@feuerwehr.local' }]);
      assert.equal(recorded.createdSubmissions.length, 1);
      assert.equal(recorded.createdSubmissions[0].identityId, 'id-fw-1');
      assert.equal(recorded.createdSubmissions[0].emailId, '#draft1');

      const logsRes = await adminClient.json<NotificationLogEntry[]>(
        'GET',
        '/api/notifications/logs',
      );
      assert.equal(logsRes.status, 200);
      assert.ok(
        logsRes.data.some(
          (l) => l.recipient === 'empfaenger@feuerwehr.local' && l.status === 'sent' && l.channel === 'jmap',
        ),
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        jmapMockServer.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });

  // =========================================================================
  // 7. SQLite-Backup & JSON-Backup/Restore
  // =========================================================================
  await t.test('7. SQLite-Backup & JSON-Backup/Restore', async () => {
    const sqliteRes = await adminClient.request('GET', '/api/admin/backup/sqlite');
    assert.equal(sqliteRes.status, 200);
    assert.equal(
      sqliteRes.buffer.subarray(0, 15).toString('ascii'),
      'SQLite format 3',
    );

    const jsonBackupRes = await adminClient.json<{
      version: number;
      members: Array<{ id: number }>;
      member_licenses: Array<unknown>;
      inspections: Array<unknown>;
      vehicles: Array<unknown>;
    }>('GET', '/api/admin/backup/json');
    assert.equal(jsonBackupRes.status, 200);
    assert.ok(jsonBackupRes.data.members.length >= 5);
    const backupPayload = jsonBackupRes.data;

    // Delete a member and verify it is gone
    const delRes = await adminClient.json('DELETE', `/api/members/${memberGreen.id}`);
    assert.equal(delRes.status, 200);
    const checkGone = await adminClient.json('GET', `/api/members/${memberGreen.id}`);
    assert.equal(checkGone.status, 404);

    // Restore from JSON backup
    const restoreRes = await adminClient.json<{
      ok: boolean;
      restored: { members: number };
    }>('POST', '/api/admin/restore/json', backupPayload);
    assert.equal(restoreRes.status, 200);
    assert.equal(restoreRes.data.ok, true);
    assert.equal(restoreRes.data.restored.members, backupPayload.members.length);

    // Verify deleted member and its licenses & inspection are restored
    const checkRestored = await adminClient.json<EvaluatedMember>(
      'GET',
      `/api/members/${memberGreen.id}`,
    );
    assert.equal(checkRestored.status, 200);
    assert.equal(checkRestored.data.first_name, 'Anna');
    assert.equal(checkRestored.data.evaluation.overallStatus, 'green');
    assert.ok(checkRestored.data.licenses.some((l) => l.license_class === 'FW_750'));
  });

  // =========================================================================
  // 8. SQLite-Restore (Binary Upload & Validation)
  // =========================================================================
  await t.test('8. SQLite-Restore (gültiges Backup & ungültige Datei)', async () => {
    const sqliteBackupRes = await adminClient.request('GET', '/api/admin/backup/sqlite');
    assert.equal(sqliteBackupRes.status, 200);
    const sqliteBuffer = sqliteBackupRes.buffer;
    assert.equal(sqliteBuffer.subarray(0, 15).toString('ascii'), 'SQLite format 3');

    // Invalid file must return HTTP 400
    const invalidRes = await adminClient.request(
      'POST',
      '/api/admin/restore/sqlite',
      Buffer.from('not a valid sqlite database file at all - definitely invalid header and too fake'),
      'application/octet-stream',
    );
    assert.equal(invalidRes.status, 400);

    // Delete member and modify vehicle, then restore via SQLite binary backup
    const delMemberRes = await adminClient.json('DELETE', `/api/members/${memberGreen.id}`);
    assert.equal(delMemberRes.status, 200);
    assert.equal((await adminClient.json('GET', `/api/members/${memberGreen.id}`)).status, 404);

    const delVehicleRes = await adminClient.json('DELETE', `/api/vehicles/${testVehicle.id}`);
    assert.equal(delVehicleRes.status, 200);
    assert.equal((await adminClient.json('GET', `/api/vehicles/${testVehicle.id}`)).status, 404);

    const restoreSqliteRes = await adminClient.request(
      'POST',
      '/api/admin/restore/sqlite',
      sqliteBuffer,
      'application/octet-stream',
    );
    assert.equal(restoreSqliteRes.status, 200);
    const restoreBody = JSON.parse(restoreSqliteRes.buffer.toString('utf8')) as {
      ok: boolean;
      restored: { members: number; member_licenses: number; inspections: number; vehicles: number };
    };
    assert.equal(restoreBody.ok, true);
    assert.ok(restoreBody.restored.members >= 5);
    assert.ok(restoreBody.restored.vehicles >= 1);

    // Verify member and vehicle are restored
    const restoredMember = await adminClient.json<EvaluatedMember>(
      'GET',
      `/api/members/${memberGreen.id}`,
    );
    assert.equal(restoredMember.status, 200);
    assert.equal(restoredMember.data.first_name, 'Anna');
    assert.equal(restoredMember.data.evaluation.overallStatus, 'green');

    const restoredVehicle = await adminClient.json<EvaluatedVehicle>(
      'GET',
      `/api/vehicles/${testVehicle.id}`,
    );
    assert.equal(restoredVehicle.status, 200);
    assert.equal(restoredVehicle.data.name, 'TSF-W');
  });

  // =========================================================================
  // 9. Bundesland & Sonderregeln (SH / BY, fw_require_valid_b, strict_inspection_blocking)
  // =========================================================================
  await t.test('9. Bundesland & Sonderregeln', async () => {
    const putRes = await adminClient.json<AppSettingsPublic>('PUT', '/api/settings', {
      federal_state: 'BY',
      state_rules: {
        strict_inspection_blocking: true,
        fw_require_valid_b: true,
      },
    });
    assert.equal(putRes.status, 200);
    assert.equal(putRes.data.federal_state, 'BY');
    assert.equal(putRes.data.state_rules.strict_inspection_blocking, true);
    assert.equal(putRes.data.state_rules.fw_require_valid_b, true);

    const authStatus = await adminClient.json<{
      needsSetup: boolean;
      federalState: string;
      stateRules: { strict_inspection_blocking: boolean; fw_require_valid_b: boolean };
    }>('GET', '/api/auth/status');
    assert.equal(authStatus.status, 200);
    assert.equal(authStatus.data.federalState, 'BY');
    assert.equal(authStatus.data.stateRules.strict_inspection_blocking, true);
    assert.equal(authStatus.data.stateRules.fw_require_valid_b, true);

    // Kamerad mit FW_750 ohne Klasse B -> red bei fw_require_valid_b: true
    const fwNoBRes = await adminClient.json<EvaluatedMember>('POST', '/api/members', {
      first_name: 'Emil',
      last_name: 'OhneB',
      unit: 'Löschzug 1',
      status: 'active',
      card_expires_at: futureDate,
      licenses: [
        { license_class: 'FW_750', issued_at: pastDate, expires_at: null, key_numbers: [] },
      ],
    });
    assert.equal(fwNoBRes.status, 201);
    await inspectorClient.json('POST', '/api/inspections', {
      member_id: fwNoBRes.data.id,
      inspected_at: today,
      result: 'ok',
    });
    const fwNoBEval = await adminClient.json<EvaluatedMember>(
      'GET',
      `/api/members/${fwNoBRes.data.id}`,
    );
    assert.equal(fwNoBEval.status, 200);
    assert.equal(fwNoBEval.data.evaluation.overallStatus, 'red');

    // Kamerad ohne Kontrolle -> red in Fahrzeugliste bei strict_inspection_blocking: true
    const noInspRes = await adminClient.json<EvaluatedMember>('POST', '/api/members', {
      first_name: 'Franz',
      last_name: 'KeineKontrolle',
      unit: 'Löschzug 1',
      status: 'active',
      card_expires_at: futureDate,
      licenses: [
        { license_class: 'B', issued_at: addMonthsIso(today, -36), expires_at: null, key_numbers: [] },
        { license_class: 'FW_750', issued_at: pastDate, expires_at: null, key_numbers: [] },
      ],
    });
    assert.equal(noInspRes.status, 201);

    const vehicleCheck = await adminClient.json<EvaluatedVehicle>(
      'GET',
      `/api/vehicles/${testVehicle.id}`,
    );
    assert.equal(vehicleCheck.status, 200);
    const driverMap = new Map(vehicleCheck.data.drivers.map((d) => [d.memberId, d]));
    assert.equal(driverMap.get(fwNoBRes.data.id)?.status, 'red');
    assert.equal(driverMap.get(noInspRes.data.id)?.status, 'red');
  });
});
