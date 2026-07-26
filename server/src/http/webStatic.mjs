import fs from 'node:fs/promises';
import path from 'node:path';

import { config } from '../config.mjs';
import { json } from './shared.mjs';

const WEB_ROOT = path.join(config.rootDir, 'src', 'public', 'web');
const WEB_PREFIX = '/web';
const WEB_ROOT_ASSET_PREFIXES = ['/_expo/', '/assets/'];
const WEB_ROOT_APP_PATHS = new Set([
  '/',
  '/account',
  '/alerts',
  '/board',
  '/calendar',
  '/disclosures',
  '/home',
  '/more',
  '/news',
  '/news-issues',
  '/oauth',
  '/quotes',
  '/settings',
  '/signal',
  '/terms',
  '/terms-history',
  '/today-briefing',
  '/etf-insights',
  '/screener',
  '/etf-insight',
  '/youtube',
]);
const WEB_ROOT_APP_PREFIXES = ['/disclosures/', '/symbol/'];

const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.map', 'application/json; charset=utf-8'],
]);

function isPathSafe(relativePath) {
  const normalized = path.normalize(relativePath);
  return normalized && !normalized.startsWith('..') && !path.isAbsolute(normalized);
}

async function fileExists(file) {
  try {
    const stat = await fs.stat(file);
    return stat.isFile();
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function serveFile(res, file) {
  const ext = path.extname(file).toLowerCase();
  const body = await fs.readFile(file);
  const immutable = file.includes(`${path.sep}_expo${path.sep}`) || /\.[0-9a-f]{8,}\./i.test(path.basename(file));
  res.writeHead(200, {
    'content-type': CONTENT_TYPES.get(ext) || 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  res.end(body);
}

async function resolveWebFile(relativePath) {
  const rel = relativePath.replace(/^\/+/, '') || 'index.html';
  if (!isPathSafe(rel)) return null;

  const direct = path.join(WEB_ROOT, rel);
  if (await fileExists(direct)) return direct;

  if (!path.extname(rel)) {
    const html = path.join(WEB_ROOT, `${rel}.html`);
    if (await fileExists(html)) return html;

    const index = path.join(WEB_ROOT, rel, 'index.html');
    if (await fileExists(index)) return index;
  }

  const fallback = path.join(WEB_ROOT, 'index.html');
  if (await fileExists(fallback)) return fallback;
  return null;
}

async function serveMissingWebBundle(res) {
  json(res, 503, {
    error: 'WEB_BUNDLE_NOT_BUILT',
    message: 'Run `npm run web:export` before deploying the web client.',
  });
}

function isWebRootAppRoute(pathname) {
  return WEB_ROOT_APP_PATHS.has(pathname) || WEB_ROOT_APP_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function redirectToWebRoute({ res, url, pathname }) {
  const targetPath = pathname === '/' ? WEB_PREFIX : `${WEB_PREFIX}${pathname}`;
  res.writeHead(302, {
    location: `${targetPath}${url?.search || ''}`,
    'cache-control': 'no-cache',
  });
  res.end();
}

async function serveWebAsset(res, pathname) {
  const file = await resolveWebFile(pathname.slice(1));
  if (!file) {
    json(res, 404, { error: 'WEB_ASSET_NOT_FOUND' });
  } else {
    await serveFile(res, file);
  }
}

/** Handles Expo web static export under `/web` and its root-based exported assets/routes. */
export async function handleWebStaticRoutes({ req, res, url, pathname }) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  if (pathname === WEB_PREFIX) {
    const file = await resolveWebFile('index.html');
    if (!file) await serveMissingWebBundle(res);
    else await serveFile(res, file);
    return true;
  }

  if (pathname.startsWith(`${WEB_PREFIX}/`)) {
    const file = await resolveWebFile(pathname.slice(`${WEB_PREFIX}/`.length));
    if (!file) await serveMissingWebBundle(res);
    else await serveFile(res, file);
    return true;
  }

  if (WEB_ROOT_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    await serveWebAsset(res, pathname);
    return true;
  }

  if (isWebRootAppRoute(pathname)) {
    redirectToWebRoute({ res, url, pathname });
    return true;
  }

  if (pathname === '/favicon.ico') {
    const file = await resolveWebFile('favicon.ico');
    if (file) {
      await serveFile(res, file);
      return true;
    }
  }

  return false;
}
