import {
  createAppUser,
  disconnectAppUserIdentity,
  linkAppUserSocialIdentity,
  listAppUserIdentities,
  listAppUserTermAcceptances,
  loginAppUser,
  loginOrRegisterSocialUser,
  readAppSettings,
  refreshAppUserSession,
  revokeAppUserToken,
  setAppUserPassword,
  updateAppUserProfile,
  upsertAppUserDevice,
  verifyAppUserToken,
  withdrawAppUser,
} from '../../../db.mjs';
import { buildSocialAuthRuntime, publicSocialAuthCatalog } from '../../../auth/socialAuthConfig.mjs';
import { resolveSocialProfile } from '../../../auth/socialProfile.mjs';
import { isAppUserJwtConfigured } from '../../../auth/jwtAccess.mjs';
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
  const s = result.session;
  return {
    user: result.user,
    accessToken: s.accessToken,
    refreshToken: s.refreshToken,
    accessExpiresAt: s.accessExpiresAt,
    refreshExpiresAt: s.refreshExpiresAt,
    deviceId: s.deviceId,
    token: s.accessToken,
    expiresAt: s.accessExpiresAt,
  };
}

function authError(res, error) {
  const message = error instanceof Error ? error.message : String(error);
  const status =
    message === 'APP_USER_LOGIN_FAILED' || message === 'APP_USER_REFRESH_INVALID'
      ? 401
      : message === 'APP_USER_EMAIL_EXISTS'
        ? 409
        : message === 'APP_USER_JWT_NOT_CONFIGURED'
          ? 503
          : message.startsWith('APP_USER_')
            ? 400
            : 500;
  json(res, status, { error: message });
}

function socialAuthError(res, error) {
  const message = error instanceof Error ? error.message : String(error);
  const status =
    message === 'APP_USER_SOCIAL_INVALID_TOKEN' ||
    message === 'APP_USER_SOCIAL_KAKAO_UPSTREAM' ||
    message === 'APP_USER_SOCIAL_EMAIL_CONFLICT' ||
    message === 'APP_USER_SOCIAL_UNSUPPORTED' ||
    message === 'APP_USER_SOCIAL_INVALID_PROFILE'
      ? 400
      : message === 'APP_USER_SOCIAL_IDENTITY_TAKEN' || message === 'APP_USER_EMAIL_EXISTS'
        ? 409
        : message === 'APP_USER_SOCIAL_NOT_CONFIGURED' || message === 'APP_USER_JWT_NOT_CONFIGURED'
          ? 503
          : message.startsWith('APP_USER_')
            ? 400
            : 500;
  json(res, status, { error: message });
}

export async function handlePublicAuthRoutes({ req, res, pathname }) {
  if (req.method === 'GET' && pathname === '/v1/auth/jwt/config') {
    json(res, 200, {
      data: {
        configured: isAppUserJwtConfigured(),
      },
    });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/auth/social/providers') {
    try {
      const appSettings = await readAppSettings();
      json(res, 200, { data: publicSocialAuthCatalog(appSettings) });
    } catch (error) {
      json(res, 500, { error: 'INTERNAL_SERVER_ERROR' });
    }
    return true;
  }

  if (req.method === 'POST' && pathname === '/v1/auth/social/login') {
    try {
      const body = await readBody(req);
      const appSettings = await readAppSettings();
      const runtime = buildSocialAuthRuntime(appSettings);
      const provider = String(body.provider || '').toLowerCase();
      const profile = await resolveSocialProfile(provider, body, runtime);
      const result = await loginOrRegisterSocialUser({
        provider,
        profile,
        deviceId: body.deviceId,
        locale: body.locale,
        acceptedTerms: Array.isArray(body.acceptedTerms) ? body.acceptedTerms : [],
      });
      json(res, 200, { data: authPayload(result) });
    } catch (error) {
      socialAuthError(res, error);
    }
    return true;
  }

  if (req.method === 'POST' && pathname === '/v1/auth/social/link') {
    const session = await requireAppUser(req, res);
    if (!session) return true;
    try {
      const body = await readBody(req);
      const appSettings = await readAppSettings();
      const runtime = buildSocialAuthRuntime(appSettings);
      const provider = String(body.provider || '').toLowerCase();
      const profile = await resolveSocialProfile(provider, body, runtime);
      const result = await linkAppUserSocialIdentity(session.user.id, provider, profile);
      json(res, 200, { data: result });
    } catch (error) {
      socialAuthError(res, error);
    }
    return true;
  }

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

  if (req.method === 'POST' && pathname === '/v1/auth/refresh') {
    try {
      const body = await readBody(req);
      const result = await refreshAppUserSession(body);
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

  if (req.method === 'GET' && pathname === '/v1/auth/me/terms') {
    const session = await requireAppUser(req, res);
    if (!session) return true;
    const rows = await listAppUserTermAcceptances(session.user.id);
    json(res, 200, { data: rows });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/auth/me/identities') {
    const session = await requireAppUser(req, res);
    if (!session) return true;
    const rows = await listAppUserIdentities(session.user.id);
    json(res, 200, { data: rows });
    return true;
  }

  if (req.method === 'PATCH' && pathname === '/v1/auth/me/password') {
    const session = await requireAppUser(req, res);
    if (!session) return true;
    try {
      const body = await readBody(req);
      const user = await setAppUserPassword(session.user.id, body);
      json(res, 200, { data: { user } });
    } catch (error) {
      authError(res, error);
    }
    return true;
  }

  const identityMatch = pathname.match(/^\/v1\/auth\/me\/identities\/([^/]+)$/);
  if (req.method === 'DELETE' && identityMatch) {
    const session = await requireAppUser(req, res);
    if (!session) return true;
    try {
      const identity = await disconnectAppUserIdentity(session.user.id, decodeURIComponent(identityMatch[1]));
      json(res, 200, { data: identity });
    } catch (error) {
      authError(res, error);
    }
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

  if (req.method === 'DELETE' && pathname === '/v1/auth/me') {
    const session = await requireAppUser(req, res);
    if (!session) return true;
    try {
      const result = await withdrawAppUser(session.user.id);
      json(res, 200, { data: { ok: true, withdrawnAt: result.withdrawnAt } });
    } catch (error) {
      authError(res, error);
    }
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
