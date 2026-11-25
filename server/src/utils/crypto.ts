import fs from 'node:fs';
import path from 'node:path';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

export interface SecretBox {
  encrypt(plain: string): string;
  decrypt(cipher: string): string;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, hashHex] = parts;
  if (!salt || !hashHex) {
    return false;
  }
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, 64);
  if (expected.length !== actual.length) {
    return false;
  }
  return timingSafeEqual(expected, actual);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

function loadOrCreateSecretKey(dataDir: string): Buffer {
  const envSecret = process.env.APP_SECRET?.trim();
  if (envSecret) {
    return createHash('sha256').update(envSecret, 'utf8').digest();
  }

  fs.mkdirSync(dataDir, { recursive: true });
  const secretFile = path.join(dataDir, '.app-secret');
  let rawSecret: string;
  if (fs.existsSync(secretFile)) {
    rawSecret = fs.readFileSync(secretFile, 'utf8').trim();
  } else {
    rawSecret = randomBytes(32).toString('hex');
    fs.writeFileSync(secretFile, rawSecret, { encoding: 'utf8', mode: 0o600 });
  }
  return createHash('sha256').update(rawSecret, 'utf8').digest();
}

export function createSecretBox(dataDir: string): SecretBox {
  const key = loadOrCreateSecretKey(dataDir);

  return {
    encrypt(plain: string): string {
      if (!plain) return '';
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
    },

    decrypt(cipherText: string): string {
      if (!cipherText) return '';
      if (!cipherText.startsWith('enc:v1:')) {
        return cipherText;
      }
      const parts = cipherText.split(':');
      if (parts.length !== 5) {
        throw new Error('Ungültiges SecretBox-Format');
      }
      const iv = Buffer.from(parts[2], 'hex');
      const tag = Buffer.from(parts[3], 'hex');
      const data = Buffer.from(parts[4], 'hex');
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
      return decrypted.toString('utf8');
    },
  };
}
