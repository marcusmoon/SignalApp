import { queryPublicNotificationsForUser, upsertNotificationItem, verifyAppUserToken } from '../../../db.mjs';
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
    sourceType: item.sourceType || '',
    deepLink: item.deepLink || '',
    scheduledAt: item.scheduledAt || item.createdAt || null,
    createdAt: item.createdAt || null,
  };
}

export async function handlePublicNotificationRoutes({ req, res, url, pathname }) {
  if (req.method === 'POST' && pathname === '/v1/notifications/test') {
    const user = await requireAppUser(req, res);
    if (!user) return true;
    const now = new Date().toISOString();
    const item = await upsertNotificationItem({
      id: `push-test:${user.id}:${Date.now()}`,
      type: 'service_notice',
      channel: 'push',
      status: 'queued',
      priority: 'normal',
      title: 'SIGNAL push test',
      body: '푸시 알림 테스트입니다. 이 알림이 보이면 기기 등록과 outbox 흐름이 정상입니다.',
      appUserId: user.id,
      targetType: 'user',
      targetKey: user.id,
      sourceType: 'app_user',
      sourceId: user.id,
      scheduledAt: now,
      payload: {
        title: 'SIGNAL push test',
        body: '푸시 알림 테스트입니다. 이 알림이 보이면 기기 등록과 outbox 흐름이 정상입니다.',
        deepLink: '/alerts',
      },
      updatedAt: now,
    });
    json(res, 201, { data: publicNotification(item) });
    return true;
  }

  if (req.method !== 'GET' || pathname !== '/v1/notifications') return false;
  const user = await requireAppUser(req, res);
  if (!user) return true;
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '50', 10) || 50));
  const rows = (await queryPublicNotificationsForUser(user.id, { limit })).map(publicNotification);
  json(res, 200, { data: rows });
  return true;
}
