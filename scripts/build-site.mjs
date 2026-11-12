import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const skip = new Set(['dist', 'node_modules', '.git', '.vercel', 'quotations', 'api', 'scripts', 'lib']);

await rm(dist, { recursive: true, force: true });
await mkdir(dist);

for (const name of await readdir(root)) {
  if (skip.has(name) || name.startsWith('.env')) continue;
  await cp(join(root, name), join(dist, name), { recursive: true });
}

console.log('Built static site to dist/ (quotations stay off the public file host).');
