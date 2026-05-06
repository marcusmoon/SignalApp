import { queryPublicNotificationsForUser, verifyAppUserToken } from '../../../db.mjs';
import { json } from '../../shared.mjs';

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
  return user;
}

function publicNotification(item) {
  return {
    id: item.id,
    type: item.type || '',
    channel: item.channel || 'push',
    status: item.status || 'queued',
    priority: item.priority || 'normal',
    title: item.title || '',
    body: item.body || '',
    deepLink: item.deepLink || '',
    scheduledAt: item.scheduledAt || item.createdAt || null,
    createdAt: item.createdAt || null,
  };
}

export async function handlePublicNotificationRoutes({ req, res, url, pathname }) {
  if (req.method !== 'GET' || pathname !== '/v1/notifications') return false;
  const user = await requireAppUser(req, res);
  if (!user) return true;
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50));
  const rows = (await queryPublicNotificationsForUser(user.id, { limit })).map(publicNotification);
  json(res, 200, { data: rows });
  return true;
}
