import nodemailer from 'nodemailer';
import type { RawMailConfig } from './settings.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

interface JmapSession {
  apiUrl?: string;
  primaryAccounts?: Record<string, string>;
}

type JmapInvocation = [string, Record<string, unknown>, string];

interface JmapResponse {
  methodResponses?: JmapInvocation[];
}

function parseRecipients(to: string): Array<{ email: string }> {
  return to
    .split(/[,;]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((email) => ({ email }));
}

async function sendViaSmtp(config: RawMailConfig, message: MailMessage): Promise<void> {
  const { smtp } = config;
  if (!smtp.host.trim()) {
    throw new Error('SMTP-Host ist nicht konfiguriert.');
  }
  const fromEmail = smtp.fromEmail.trim() || smtp.username.trim();
  if (!fromEmail) {
    throw new Error('SMTP-Absenderadresse (fromEmail) ist nicht konfiguriert.');
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host.trim(),
    port: smtp.port > 0 ? smtp.port : smtp.secure ? 465 : 587,
    secure: Boolean(smtp.secure),
    auth: smtp.username.trim()
      ? {
          user: smtp.username.trim(),
          pass: smtp.password,
        }
      : undefined,
    tls: {
      rejectUnauthorized: smtp.rejectUnauthorized !== false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  const from = smtp.fromName.trim()
    ? { name: smtp.fromName.trim(), address: fromEmail }
    : fromEmail;

  await transporter.sendMail({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

function buildJmapAuthHeader(config: RawMailConfig['jmap']): string {
  if (config.authType === 'basic') {
    const raw = `${config.username}:${config.password}`;
    return `Basic ${Buffer.from(raw, 'utf8').toString('base64')}`;
  }
  if (!config.token.trim()) {
    throw new Error('JMAP Bearer-Token ist nicht konfiguriert.');
  }
  return `Bearer ${config.token.trim()}`;
}

function findMethodResponse(
  responses: JmapInvocation[],
  callId: string,
): { name: string; args: Record<string, unknown> } {
  const match = responses.find((inv) => inv[2] === callId);
  if (!match) {
    throw new Error(`JMAP-Antwort enthält keinen Eintrag für Call-ID "${callId}".`);
  }
  const [name, args] = match;
  if (name === 'error') {
    const type = typeof args.type === 'string' ? args.type : 'unknownError';
    const desc = typeof args.description === 'string' ? args.description : '';
    throw new Error(`JMAP-Methodenfehler (${callId}): ${type}${desc ? ` - ${desc}` : ''}`);
  }
  return { name, args };
}

async function postJmap(
  apiUrl: string,
  authHeader: string,
  using: string[],
  methodCalls: JmapInvocation[],
): Promise<JmapInvocation[]> {
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ using, methodCalls }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    throw new Error(`JMAP-API-Anfrage fehlgeschlagen (HTTP ${res.status}): ${bodyText || res.statusText}`);
  }

  const data = (await res.json()) as JmapResponse;
  if (!Array.isArray(data.methodResponses)) {
    throw new Error('Ungültige JMAP-API-Antwort (methodResponses fehlt).');
  }
  return data.methodResponses;
}

async function sendViaJmap(config: RawMailConfig, message: MailMessage): Promise<void> {
  const { jmap } = config;
  if (!jmap.sessionUrl.trim()) {
    throw new Error('JMAP-Session-URL ist nicht konfiguriert.');
  }

  const authHeader = buildJmapAuthHeader(jmap);

  const sessionRes = await fetch(jmap.sessionUrl.trim(), {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!sessionRes.ok) {
    const bodyText = await sessionRes.text().catch(() => '');
    throw new Error(
      `JMAP-Session konnte nicht geladen werden (HTTP ${sessionRes.status}): ${bodyText || sessionRes.statusText}`,
    );
  }

  const session = (await sessionRes.json()) as JmapSession;
  const apiUrl = session.apiUrl?.trim();
  if (!apiUrl) {
    throw new Error('JMAP-Session enthält keine apiUrl.');
  }

  const primaryMailAccount = session.primaryAccounts?.['urn:ietf:params:jmap:mail'];
  const primarySubAccount = session.primaryAccounts?.['urn:ietf:params:jmap:submission'];
  const configuredAccountId = jmap.accountId.trim();

  const mailAccountId = configuredAccountId || primaryMailAccount || primarySubAccount;
  const submissionAccountId = configuredAccountId || primarySubAccount || primaryMailAccount;

  if (!mailAccountId || !submissionAccountId) {
    throw new Error('JMAP-Session enthält keine primaryAccounts für mail/submission.');
  }

  const using = [
    'urn:ietf:params:jmap:core',
    'urn:ietf:params:jmap:mail',
    'urn:ietf:params:jmap:submission',
  ];

  // Step 2: Query Identity and Drafts/Sent mailboxes
  const step2Responses = await postJmap(apiUrl, authHeader, using, [
    ['Identity/get', { accountId: submissionAccountId }, 'id0'],
    ['Mailbox/query', { accountId: mailAccountId, filter: { role: 'drafts' } }, 'mbDrafts'],
    ['Mailbox/query', { accountId: mailAccountId, filter: { role: 'sent' } }, 'mbSent'],
  ]);

  const identityResp = findMethodResponse(step2Responses, 'id0');
  const draftsResp = findMethodResponse(step2Responses, 'mbDrafts');
  const sentResp = findMethodResponse(step2Responses, 'mbSent');

  const identities = Array.isArray(identityResp.args.list)
    ? (identityResp.args.list as Array<{ id?: string; email?: string; name?: string }>)
    : [];

  if (identities.length === 0) {
    throw new Error('JMAP: Keine Versand-Identität (Identity) im Konto gefunden.');
  }

  const preferredEmail = jmap.fromEmail.trim().toLowerCase();
  const matchedIdentity =
    (preferredEmail
      ? identities.find((id) => typeof id.email === 'string' && id.email.toLowerCase() === preferredEmail)
      : undefined) ?? identities[0];

  if (!matchedIdentity?.id) {
    throw new Error('JMAP: Gültige Identity-ID fehlt.');
  }

  const draftsIds = Array.isArray(draftsResp.args.ids) ? (draftsResp.args.ids as string[]) : [];
  const sentIds = Array.isArray(sentResp.args.ids) ? (sentResp.args.ids as string[]) : [];
  const draftsId = draftsIds[0];
  const sentId = sentIds[0];

  if (!draftsId) {
    throw new Error('JMAP: Kein Entwürfe-Postfach (role="drafts") gefunden.');
  }

  const fromEmail = jmap.fromEmail.trim() || matchedIdentity.email || '';
  if (!fromEmail) {
    throw new Error('JMAP: Keine Absender-E-Mail-Adresse verfügbar.');
  }
  const fromName = jmap.fromName.trim() || matchedIdentity.name || '';

  const recipients = parseRecipients(message.to);
  if (recipients.length === 0) {
    throw new Error('Keine gültige Empfänger-E-Mail-Adresse angegeben.');
  }

  const bodyValues: Record<string, { value: string; charset: string }> = {
    textBody: { value: message.text, charset: 'utf-8' },
  };
  if (message.html) {
    bodyValues.htmlBody = { value: message.html, charset: 'utf-8' };
  }

  const emailDraft: Record<string, unknown> = {
    from: [{ ...(fromName ? { name: fromName } : {}), email: fromEmail }],
    to: recipients,
    subject: message.subject,
    mailboxIds: { [draftsId]: true },
    keywords: { $draft: true },
    bodyValues,
    textBody: [{ partId: 'textBody', type: 'text/plain' }],
  };
  if (message.html) {
    emailDraft.htmlBody = [{ partId: 'htmlBody', type: 'text/html' }];
  }

  const onSuccessPatch: Record<string, unknown> = {
    'keywords/$draft': null,
  };
  if (sentId) {
    onSuccessPatch[`mailboxIds/${draftsId}`] = null;
    onSuccessPatch[`mailboxIds/${sentId}`] = true;
  }

  // Step 3: Create Email draft and submit in single JMAP batch
  const step3Responses = await postJmap(apiUrl, authHeader, using, [
    [
      'Email/set',
      {
        accountId: mailAccountId,
        create: { draft1: emailDraft },
      },
      'emailSet',
    ],
    [
      'EmailSubmission/set',
      {
        accountId: submissionAccountId,
        create: {
          sub1: {
            identityId: matchedIdentity.id,
            emailId: '#draft1',
          },
        },
        onSuccessUpdateEmail: {
          '#sub1': onSuccessPatch,
        },
      },
      'subSet',
    ],
  ]);

  const emailSetResp = findMethodResponse(step3Responses, 'emailSet');
  const emailNotCreated = emailSetResp.args.notCreated as Record<string, { type?: string; description?: string }> | undefined;
  if (emailNotCreated?.draft1) {
    const err = emailNotCreated.draft1;
    throw new Error(
      `JMAP Email/set fehlgeschlagen: ${err.type ?? 'error'}${err.description ? ` - ${err.description}` : ''}`,
    );
  }

  const subSetResp = findMethodResponse(step3Responses, 'subSet');
  const subNotCreated = subSetResp.args.notCreated as Record<string, { type?: string; description?: string }> | undefined;
  if (subNotCreated?.sub1) {
    const err = subNotCreated.sub1;
    throw new Error(
      `JMAP EmailSubmission/set fehlgeschlagen: ${err.type ?? 'error'}${err.description ? ` - ${err.description}` : ''}`,
    );
  }
}

export async function sendMail(config: RawMailConfig, message: MailMessage): Promise<void> {
  if (config.provider === 'none') {
    throw new Error('Es ist kein E-Mail-Versandprovider konfiguriert.');
  }
  if (config.provider === 'smtp') {
    await sendViaSmtp(config, message);
    return;
  }
  if (config.provider === 'jmap') {
    await sendViaJmap(config, message);
    return;
  }
  throw new Error(`Unbekannter E-Mail-Provider: ${String(config.provider)}`);
}
