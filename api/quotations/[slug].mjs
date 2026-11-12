import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keyToToken, openDocument, openWithKey, tokenToKey } from '../../lib/quotation-seal.mjs';

const SESSION_SECONDS = 60 * 60 * 24 * 30;

export async function GET(request) {
  try {
    return await handle(request);
  } catch (error) {
    console.error('quotation request failed', error);
    return htmlResponse(unavailablePage(), 500);
  }
}

export async function POST(request) {
  return GET(request);
}

async function handle(request) {
  const slug = slugFrom(request.url);
  if (!slug) return htmlResponse(missingPage(), 404);

  const url = new URL(request.url);
  const meta = await loadMeta(slug);
  const sealed = await readQuoteFile(slug, 'document.enc');
  if (!sealed) return htmlResponse(missingPage(), 404);

  if (url.searchParams.get('logout') === '1') {
    return htmlResponse(loginPage(meta, slug, { username: '' }), 200, {
      'Set-Cookie': sessionCookie(slug, '', request, 0),
    });
  }

  if (request.method === 'POST') {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 4096) return htmlResponse(loginPage(meta, slug, { error: 'Those details don’t match.' }), 413);
    const form = await request.formData();
    const username = String(form.get('username') || '').slice(0, 200);
    const password = String(form.get('password') || '').slice(0, 200);
    const opened = openDocument(sealed, username, password);
    if (!opened) {
      return htmlResponse(loginPage(meta, slug, { username, error: 'Those details don’t match.' }), 401);
    }
    const headers = new Headers(baseHeaders());
    headers.set('Location', `/quotations/${slug}`);
    headers.append('Set-Cookie', sessionCookie(slug, keyToToken(opened.key), request, SESSION_SECONDS));
    return new Response(null, { status: 303, headers });
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: baseHeaders() });
  }

  const key = tokenToKey(readCookie(request, cookieName(slug)));
  const html = key ? openWithKey(sealed, key) : null;
  if (!html) return htmlResponse(loginPage(meta, slug, { username: '' }), 200);
  return new Response(html, {
    status: 200,
    headers: {
      ...baseHeaders(),
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}

function slugFrom(rawUrl) {
  const parts = new URL(rawUrl).pathname.split('/').filter(Boolean);
  const index = parts.lastIndexOf('quotations');
  if (index === -1 || parts.length !== index + 2) return null;
  const slug = parts[index + 1];
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}

async function readQuoteFile(slug, name) {
  if (name !== 'document.enc' && name !== 'meta.json') return null;
  const paths = [
    join(process.cwd(), 'quotations', slug, name),
    fileURLToPath(new URL(`../../quotations/${slug}/${name}`, import.meta.url)),
  ];
  for (const path of paths) {
    try {
      return await readFile(path);
    } catch {
      // Try the next location. Vercel serves the file from the function bundle.
    }
  }
  return null;
}

async function loadMeta(slug) {
  const fallback = {
    client: slug.replace(/-/g, ' '),
    document: 'Private proposal',
  };
  const raw = await readQuoteFile(slug, 'meta.json');
  if (!raw) return fallback;
  try {
    const meta = JSON.parse(raw.toString('utf8'));
    return {
      client: String(meta.client || fallback.client).slice(0, 80),
      document: String(meta.document || fallback.document).slice(0, 80),
    };
  } catch (error) {
    console.error('quotation meta unreadable', slug, error);
    return fallback;
  }
}

function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return '';
}

function cookieName(slug) {
  return `iamdx_q_${slug.replace(/-/g, '_')}`;
}

function sessionCookie(slug, token, request, maxAge) {
  const parts = [
    `${cookieName(slug)}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    `Path=/quotations/${slug}`,
    `Max-Age=${maxAge}`,
  ];
  if (isHttps(request)) parts.push('Secure');
  return parts.join('; ');
}

function isHttps(request) {
  const forwarded = request.headers.get('x-forwarded-proto');
  if (forwarded) return forwarded.split(',')[0].trim() === 'https';
  return new URL(request.url).protocol === 'https:';
}

function baseHeaders() {
  return {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
  };
}

function htmlResponse(body, status, extra = {}) {
  const headers = { ...baseHeaders(), 'Content-Type': 'text/html; charset=utf-8', ...extra };
  return new Response(body, { status, headers });
}

function loginPage(meta, slug, { username = '', error = '' } = {}) {
  const focus = error ? 'password' : 'username';
  return shell({
    title: `${meta.client} — Private proposal`,
    body: `
      <p class="eyebrow">Private proposal</p>
      <h1>${esc(meta.client)}</h1>
      <p class="lede">${esc(meta.document)}. This page stays closed until the details Tristan sent you are entered.</p>
      <form method="post" action="/quotations/${esc(slug)}" autocomplete="on">
        <label for="username">Username</label>
        <input id="username" name="username" type="text" autocomplete="username" spellcheck="false" autocapitalize="none" required maxlength="200" value="${esc(username)}" ${focus === 'username' ? 'autofocus' : ''}>
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" required maxlength="200" ${focus === 'password' ? 'autofocus' : ''}>
        ${error ? `<p class="error" role="alert">${esc(error)}</p>` : ''}
        <button class="btn" type="submit">View proposal</button>
      </form>`,
  });
}

function missingPage() {
  return shell({
    title: 'Proposal not found',
    body: `
      <p class="eyebrow">Private proposal</p>
      <h1>Not found</h1>
      <p class="lede">This link doesn’t match a proposal.</p>`,
  });
}

function unavailablePage() {
  return shell({
    title: 'Proposal unavailable',
    body: `
      <p class="eyebrow">Private proposal</p>
      <h1>Unavailable</h1>
      <p class="lede">This proposal can’t be opened right now.</p>`,
  });
}

function shell({ title, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${esc(title)}</title>
  <link rel="icon" href="/uploads/favicon.svg" type="image/svg+xml">
  <style>
    @font-face { font-family: 'PX Display'; src: url('/uploads/fonts/px-display-medium.woff2') format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; }
    @font-face { font-family: 'Geist'; src: url('/uploads/fonts/geist-latin-400.woff2') format('woff2'); font-weight: 400; font-style: normal; font-display: swap; }
    @font-face { font-family: 'Geist'; src: url('/uploads/fonts/geist-latin-500.woff2') format('woff2'); font-weight: 500; font-style: normal; font-display: swap; }
    :root {
      --font-display: 'PX Display', 'Space Mono', ui-monospace, monospace;
      --font-body: 'Geist', 'Inter', system-ui, sans-serif;
      --bg: #FAFAFA; --surface: #FFFFFF; --surface-2: #F4F4F5;
      --border: #E4E4E7; --text: #18181B; --text-secondary: #71717A; --text-tertiary: #A1A1AA;
      --ink: #18181B; --ink-hover: #27272A; --inverse: #FAFAFA;
      --dot: rgba(0,0,0,.08); --danger: #B91C1C;
      --shadow: 0 1px 2px rgba(0,0,0,.04);
      color-scheme: light;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #09090B; --surface: #18181B; --surface-2: #27272A;
        --border: #27272A; --text: #FAFAFA; --text-secondary: #A1A1AA; --text-tertiary: #71717A;
        --ink: #FAFAFA; --ink-hover: #E4E4E7; --inverse: #18181B;
        --dot: rgba(255,255,255,.10); --danger: #FCA5A5;
        --shadow: none;
        color-scheme: dark;
      }
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      background: var(--bg);
      background-image: radial-gradient(circle, var(--dot) 1px, transparent 1px);
      background-size: 22px 22px;
      color: var(--text);
      font-family: var(--font-body);
      -webkit-font-smoothing: antialiased;
    }
    a { color: inherit; text-decoration: none; }
    .bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; max-width: 1040px; margin: 0 auto; padding: 22px 24px; }
    .home { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .home img { width: 44px; height: 44px; border-radius: 12px; object-fit: cover; background: #18181B; }
    .home span, .lock { font-family: var(--font-display); font-size: 15px; letter-spacing: 0.05em; text-transform: uppercase; }
    .lock { color: var(--text-secondary); }
    main { max-width: 1040px; margin: 0 auto; padding: 48px 24px 80px; }
    .eyebrow { display: inline-flex; align-items: center; height: 36px; margin: 0 0 22px; padding: 0 14px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); box-shadow: var(--shadow); font-family: var(--font-display); font-size: 13px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-secondary); }
    h1 { margin: 0; max-width: 740px; font-family: var(--font-display); font-weight: 400; font-size: clamp(48px, 8vw, 92px); line-height: 0.92; letter-spacing: -0.03em; text-transform: uppercase; }
    .lede { max-width: 460px; margin: 22px 0 32px; font-size: 18px; line-height: 1.5; color: var(--text-secondary); }
    form { display: grid; gap: 8px; max-width: 380px; }
    label { margin-top: 8px; font-size: 13px; font-weight: 500; color: var(--text-secondary); }
    input { width: 100%; height: 48px; margin: 0; padding: 0 14px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); color: var(--text); font: 16px/1.2 var(--font-body); }
    input:focus { outline: 2px solid var(--text); outline-offset: 2px; }
    .error { margin: 8px 0 0; font-size: 14px; line-height: 1.4; color: var(--danger); }
    .btn { justify-self: start; height: 46px; margin-top: 12px; padding: 0 20px; border: 1px solid var(--ink); border-radius: 14px; background: var(--ink); color: var(--inverse); font-family: var(--font-display); font-size: 15px; letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer; }
    .btn:hover { background: var(--ink-hover); border-color: var(--ink-hover); }
    .btn:focus-visible { outline: 2px solid var(--text); outline-offset: 3px; }
    @media (prefers-reduced-motion: reduce) { .btn { transition: none; } }
  </style>
</head>
<body>
  <header class="bar">
    <a class="home" href="/"><img src="/uploads/nav-avatar.webp" alt="" width="44" height="44"><span>Tristan Dexter</span></a>
    <span class="lock">Private</span>
  </header>
  <main>${body}</main>
</body>
</html>`;
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}
