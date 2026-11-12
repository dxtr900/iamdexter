import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const MAGIC = Buffer.from('DXQ1');
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const HEADER = 4 + 1 + SALT_LEN + IV_LEN + TAG_LEN;

export function normalizeUsername(value) {
  return String(value ?? '').normalize('NFC').trim();
}

export function normalizePassword(value) {
  return String(value ?? '').normalize('NFC').trim();
}

export function deriveKey(username, password, salt) {
  const material = `${normalizeUsername(username)}\n${normalizePassword(password)}`;
  return scryptSync(material, salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

export function sealDocument(plain, username, password) {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(username, password, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    sealed: Buffer.concat([MAGIC, Buffer.from([1]), salt, iv, tag, ciphertext]),
    key,
  };
}

export function openDocument(blob, username, password) {
  const parts = parseSeal(blob);
  if (!parts) return null;
  const key = deriveKey(username, password, parts.salt);
  const html = decrypt(parts, key);
  if (!html) return null;
  return { html, key };
}

export function openWithKey(blob, key) {
  const parts = parseSeal(blob);
  if (!parts || !Buffer.isBuffer(key) || key.length !== 32) return null;
  return decrypt(parts, key);
}

export function keyToToken(key) {
  return key.toString('base64url');
}

export function tokenToKey(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43,44}$/.test(token)) return null;
  const key = Buffer.from(token, 'base64url');
  return key.length === 32 ? key : null;
}

function parseSeal(blob) {
  if (!Buffer.isBuffer(blob) || blob.length <= HEADER) return null;
  if (!blob.subarray(0, 4).equals(MAGIC) || blob[4] !== 1) return null;
  return {
    salt: blob.subarray(5, 5 + SALT_LEN),
    iv: blob.subarray(21, 21 + IV_LEN),
    tag: blob.subarray(33, 33 + TAG_LEN),
    data: blob.subarray(HEADER),
  };
}

function decrypt(parts, key) {
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, parts.iv);
    decipher.setAuthTag(parts.tag);
    return Buffer.concat([decipher.update(parts.data), decipher.final()]);
  } catch {
    return null;
  }
}
