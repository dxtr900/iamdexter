import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { GET, POST } from '../api/quotations/[slug].mjs';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
    if (url.pathname === '/quotations' || url.pathname.startsWith('/quotations/')) {
      await serveQuotation(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Preview failed');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Quotation preview at http://127.0.0.1:${port}/quotations/aloha-padel`);
});

async function serveQuotation(req, res, url) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
    else if (value != null) headers.set(key, value);
  }
  const request = new Request(url, {
    method: req.method,
    headers,
    body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
  });
  const response = req.method === 'POST' ? await POST(request) : await GET(request);
  const out = Buffer.from(await response.arrayBuffer());
  const responseHeaders = Object.fromEntries(response.headers);
  delete responseHeaders['set-cookie'];
  const cookies = response.headers.getSetCookie?.() || [];
  if (cookies.length) responseHeaders['set-cookie'] = cookies;
  res.writeHead(response.status, responseHeaders);
  res.end(out);
}

async function serveStatic(req, res, url) {
  const path = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
  const file = resolve(root, `.${path}`);
  if (!file.startsWith(root) || isPrivate(file)) {
    res.writeHead(404).end('Not found');
    return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) {
      res.writeHead(404).end('Not found');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404).end('Not found');
  }
}

function isPrivate(file) {
  const rel = file.slice(root.length);
  return rel.includes(`${join('/', 'quotations')}`)
    || rel.includes('/.env')
    || rel.includes('/.git')
    || rel.endsWith('/ACCESS.txt')
    || rel.endsWith('/source.html');
}
