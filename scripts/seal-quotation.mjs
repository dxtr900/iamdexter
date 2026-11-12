import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { sealDocument } from '../lib/quotation-seal.mjs';

const root = resolve(import.meta.dirname, '..');
const slug = process.argv[2];
const args = parseArgs(process.argv.slice(3));

if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('Usage: node scripts/seal-quotation.mjs <slug> [--from file.html] [--username name] [--password secret]');
  process.exit(1);
}

const dir = join(root, 'quotations', slug);
const sourcePath = join(dir, 'source.html');
const sealedPath = join(dir, 'document.enc');
const accessPath = join(dir, 'ACCESS.txt');

await mkdir(dir, { recursive: true });

if (args.from) {
  await writeFile(sourcePath, await readFile(resolve(args.from)));
}

let html;
try {
  html = await readFile(sourcePath);
} catch {
  console.error(`Missing ${sourcePath}. Pass --from path/to/quotation.html`);
  process.exit(1);
}

if (!/^(\uFEFF)?\s*(<!doctype|<html)/i.test(html.toString('utf8').slice(0, 200))) {
  console.error('Source does not look like an HTML document.');
  process.exit(1);
}

const existing = await readAccess(accessPath);
const username = args.username || existing.username || slug.split('-')[0];
const password = args.password || existing.password || generatePassword();

if (!username || !password) {
  console.error('Username and password are required.');
  process.exit(1);
}

const { sealed } = sealDocument(html, username, password);
await writeFile(sealedPath, sealed);
await writeFile(accessPath, `username=${username}\npassword=${password}\n`, { mode: 0o600 });
await chmod(accessPath, 0o600);

console.log(`Sealed quotations/${slug}/document.enc`);
console.log(`username=${username}`);
console.log(`password=${password}`);

function parseArgs(list) {
  const out = {};
  for (let i = 0; i < list.length; i += 1) {
    const key = list[i];
    if (key === '--from') out.from = list[++i];
    else if (key === '--username') out.username = list[++i];
    else if (key === '--password') out.password = list[++i];
  }
  return out;
}

async function readAccess(path) {
  try {
    const text = await readFile(path, 'utf8');
    const values = {};
    for (const line of text.split('\n')) {
      const index = line.indexOf('=');
      if (index > 0) values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    }
    return values;
  } catch {
    return {};
  }
}

function generatePassword() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const chars = [...randomBytes(16)].map((byte) => alphabet[byte % alphabet.length]);
  return [0, 4, 8, 12].map((index) => chars.slice(index, index + 4).join('')).join('-');
}
