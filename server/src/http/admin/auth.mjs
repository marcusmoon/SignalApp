import crypto from 'node:crypto';
import { config } from '../../config.mjs';
import { json, readBody } from '../shared.mjs';

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join('='));
  }
  return out;
}

function signSession(value) {
  return crypto.createHmac('sha256', config.sessionSecret).update(value).digest('hex');
}

function sessionToken(adminId) {
  return `${adminId}.${signSession(adminId)}`;
}

export function getAdminId(req) {
  const token = parseCookies(req).signal_admin_session;
  if (!token) return null;
  const [adminId, sig] = token.split('.');
  if (!adminId || !sig) return null;
  return signSession(adminId) === sig ? adminId : null;
}

export function requireAdmin(req, res) {
  const adminId = getAdminId(req);
  if (!adminId) {
    json(res, 401, { error: 'UNAUTHORIZED' });
    return null;
  }
  return adminId;
}

/** Handles `/admin/api/session|login|logout`. Returns true if the route was handled. */
export async function handleAdminSessionRoutes({ req, res, pathname }) {
  if (req.method === 'GET' && pathname === '/admin/api/session') {
    json(res, 200, { adminId: getAdminId(req) });
    return true;
  }

  if (req.method === 'POST' && pathname === '/admin/api/login') {
    const body = await readBody(req);
    const loginId = String(body.loginId || '').trim();
    const password = String(body.password || '');
    const match = (config.adminUsers || []).find((u) => u.id === loginId && u.password === password);
    if (match) {
      res.setHeader(
        'set-cookie',
        `signal_admin_session=${encodeURIComponent(sessionToken(match.id))}; HttpOnly; SameSite=Lax; Path=/`,
      );
      json(res, 200, { ok: true, adminId: match.id });
    } else {
      json(res, 401, { error: 'INVALID_LOGIN' });
    }
    return true;
  }

  if (req.method === 'POST' && pathname === '/admin/api/logout') {
    res.setHeader('set-cookie', 'signal_admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    json(res, 200, { ok: true });
    return true;
  }

  return false;
}
