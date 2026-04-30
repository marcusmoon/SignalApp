import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config.mjs';
import { json, text } from '../shared.mjs';

async function serveAdmin(res) {
  const file = path.join(config.rootDir, 'src', 'public', 'admin.html');
  const body = await fs.readFile(file, 'utf8');
  text(res, 200, body, 'text/html; charset=utf-8');
}

async function serveAdminStatic(res, pathname) {
  const rel = String(pathname || '').replace(/^\/admin\//, '');
  const normalized = path.normalize(rel);
  // Prevent path traversal and enforce that it stays within /admin.
  if (!normalized || normalized.startsWith('..') || path.isAbsolute(normalized)) {
    json(res, 404, { error: 'NOT_FOUND' });
    return;
  }
  const file = path.join(config.rootDir, 'src', 'public', 'admin', normalized);
  const ext = path.extname(file);
  if (ext !== '.js' && ext !== '.css') {
    json(res, 404, { error: 'NOT_FOUND' });
    return;
  }
  const body = await fs.readFile(file);
  const contentType = ext === '.css' ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8';
  res.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' });
  res.end(body);
}

async function serveAsset(res, relativePath, contentType) {
  const candidates = [
    path.join(config.rootDir, 'src', 'public', relativePath),
    path.join(config.rootDir, relativePath),
    path.join(config.rootDir, '..', relativePath),
  ];
  let body = null;
  for (const file of candidates) {
    try {
      body = await fs.readFile(file);
      break;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  if (!body) {
    json(res, 404, { error: 'ASSET_NOT_FOUND' });
    return;
  }
  res.writeHead(200, { 'content-type': contentType, 'cache-control': 'public, max-age=3600' });
  res.end(body);
}

/** Handles `GET /admin`, `GET /admin/*.js|css`, public assets. Returns true if handled. */
export async function handleAdminStaticRoutes({ req, res, pathname }) {
  if (req.method === 'GET' && pathname === '/admin') {
    await serveAdmin(res);
    return true;
  }

  if (req.method === 'GET' && /^\/admin\/.+\.(?:js|css)$/.test(pathname) && !pathname.includes('..')) {
    await serveAdminStatic(res, pathname);
    return true;
  }

  if (req.method === 'GET' && pathname === '/assets/images/developer-avatar.png') {
    await serveAsset(res, 'assets/images/developer-avatar.png', 'image/png');
    return true;
  }

  return false;
}
