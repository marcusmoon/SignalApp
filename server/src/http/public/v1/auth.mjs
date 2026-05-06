import {
  createAppUser,
  loginAppUser,
  revokeAppUserToken,
  updateAppUserProfile,
  upsertAppUserDevice,
  verifyAppUserToken,
} from '../../../db.mjs';
import { json, readBody } from '../../shared.mjs';

function bearerToken(req) {
  const header = String(req.headers.authorization || '');
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : '';
}

async function requireAppUser(req, res) {
  const token = bearerToken(req);
  if (!token) {
    json(res, 401, { error: 'APP_USER_AUTH_REQUIRED' });
    return null;
  }
  const user = await verifyAppUserToken(token);
  if (!user) {
    json(res, 401, { error: 'APP_USER_AUTH_INVALID' });
    return null;
  }
  return { user, token };
}

function authPayload(result) {
  return {
    user: result.user,
    token: result.session.token,
    expiresAt: result.session.expiresAt,
  };
}

function authError(res, error) {
  const message = error instanceof Error ? error.message : String(error);
  const status =
    message === 'APP_USER_LOGIN_FAILED'
      ? 401
      : message === 'APP_USER_EMAIL_EXISTS'
        ? 409
        : message.startsWith('APP_USER_')
          ? 400
          : 500;
  json(res, status, { error: message });
}

export async function handlePublicAuthRoutes({ req, res, pathname }) {
  if (req.method === 'POST' && pathname === '/v1/auth/register') {
    try {
      const body = await readBody(req);
      const result = await createAppUser(body);
      json(res, 201, { data: authPayload(result) });
    } catch (error) {
      authError(res, error);
    }
    return true;
  }

  if (req.method === 'POST' && pathname === '/v1/auth/login') {
    try {
      const body = await readBody(req);
      const result = await loginAppUser(body);
      json(res, 200, { data: authPayload(result) });
    } catch (error) {
      authError(res, error);
    }
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/auth/me') {
    const session = await requireAppUser(req, res);
    if (!session) return true;
    json(res, 200, { data: { user: session.user } });
    return true;
  }

  if (req.method === 'PATCH' && pathname === '/v1/auth/me') {
    const session = await requireAppUser(req, res);
    if (!session) return true;
    try {
      const body = await readBody(req);
      const user = await updateAppUserProfile(session.user.id, body);
      json(res, 200, { data: { user } });
    } catch (error) {
      authError(res, error);
    }
    return true;
  }

  if (req.method === 'POST' && pathname === '/v1/auth/logout') {
    const session = await requireAppUser(req, res);
    if (!session) return true;
    await revokeAppUserToken(session.token);
    json(res, 200, { data: { ok: true } });
    return true;
  }

  if (req.method === 'POST' && pathname === '/v1/auth/devices') {
    const session = await requireAppUser(req, res);
    if (!session) return true;
    try {
      const body = await readBody(req);
      const device = await upsertAppUserDevice(session.user.id, body);
      json(res, 200, { data: device });
    } catch (error) {
      authError(res, error);
    }
    return true;
  }

  return false;
}
