import {
  countUserNotificationInboxUnread,
  deleteUserNotificationInbox,
  deliverUserNotificationInbox,
  markUserNotificationInboxReadState,
  queryPublicNotificationsForUser,
  queryUserNotificationInbox,
  upsertNotificationItem,
  verifyAppUserToken,
  USER_NOTIFICATION_INBOX_MAX,
} from '../../../db.mjs';
import { nowIso } from '../../../db/time.mjs';
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
  return user;
}

function publicNotification(item) {
  const payload = item?.payload && typeof item.payload === 'object' ? item.payload : {};
  return {
    id: item.id,
    type: item.type || '',
    channel: item.channel || 'push',
    status: item.status || 'queued',
    priority: item.priority || 'normal',
    title: item.title || '',
    body: item.body || payload.body || '',
    sourceType: item.sourceType || '',
    sourceId: item.sourceId || '',
    deepLink: item.deepLink || '',
    payload,
    scheduledAt: item.scheduledAt || item.createdAt || null,
    createdAt: item.createdAt || null,
    inboxId: item.inboxId || null,
    readAt: item.readAt || null,
    deliveredAt: item.deliveredAt || null,
  };
}

function publicInboxItem(item) {
  return {
    id: item.id,
    notificationId: item.notificationId,
    type: item.type || '',
    channel: item.channel || 'push',
    status: item.status || 'sent',
    priority: item.priority || 'normal',
    title: item.title || '',
    body: item.body || '',
    sourceType: item.sourceType || '',
    sourceId: item.sourceId || '',
    deepLink: item.deepLink || '',
    payload: item.payload || {},
    deliveredAt: item.deliveredAt || null,
    readAt: item.readAt || null,
    scheduledAt: item.scheduledAt || item.deliveredAt || null,
    createdAt: item.createdAt || item.deliveredAt || null,
  };
}

function inboxLimit(url) {
  return Math.min(
    USER_NOTIFICATION_INBOX_MAX,
    Math.max(1, Number.parseInt(url.searchParams.get('limit') || String(USER_NOTIFICATION_INBOX_MAX), 10) || USER_NOTIFICATION_INBOX_MAX),
  );
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

  if (req.method === 'GET' && pathname === '/v1/notifications/inbox/unread-count') {
    const user = await requireAppUser(req, res);
    if (!user) return true;
    const count = await countUserNotificationInboxUnread(user.id);
    json(res, 200, { data: { count } });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/notifications/inbox') {
    const user = await requireAppUser(req, res);
    if (!user) return true;
    const rows = (await queryUserNotificationInbox(user.id, { limit: inboxLimit(url) })).map(publicInboxItem);
    json(res, 200, { data: rows, maxItems: USER_NOTIFICATION_INBOX_MAX });
    return true;
  }

  if (req.method === 'PATCH' && pathname === '/v1/notifications/inbox/read') {
    const user = await requireAppUser(req, res);
    if (!user) return true;
    const body = (await readBody(req)) || {};
    const updated = await markUserNotificationInboxReadState(user.id, {
      all: body.all === true,
      ids: Array.isArray(body.ids) ? body.ids : [],
    });
    json(res, 200, { data: { updated } });
    return true;
  }

  if (req.method === 'DELETE' && pathname === '/v1/notifications/inbox') {
    const user = await requireAppUser(req, res);
    if (!user) return true;
    const body = (await readBody(req)) || {};
    const deleted = await deleteUserNotificationInbox(user.id, {
      all: body.all === true,
      ids: Array.isArray(body.ids) ? body.ids : [],
    });
    json(res, 200, { data: { deleted } });
    return true;
  }

  if (req.method === 'POST' && pathname === '/v1/notifications/inbox/deliver') {
    const user = await requireAppUser(req, res);
    if (!user) return true;
    const body = (await readBody(req)) || {};
    const notificationId = String(body.notificationId || '').trim();
    if (!notificationId) {
      json(res, 400, { error: 'NOTIFICATION_ID_REQUIRED' });
      return true;
    }
    const row = await deliverUserNotificationInbox(user.id, notificationId, nowIso());
    if (!row) {
      json(res, 404, { error: 'INBOX_DELIVERY_REJECTED' });
      return true;
    }
    json(res, 200, { data: { ok: true } });
    return true;
  }

  if (req.method === 'GET' && pathname === '/v1/notifications') {
    const user = await requireAppUser(req, res);
    if (!user) return true;
    const rows = (await queryPublicNotificationsForUser(user.id, { limit: inboxLimit(url) })).map(publicNotification);
    json(res, 200, { data: rows, maxItems: USER_NOTIFICATION_INBOX_MAX });
    return true;
  }

  return false;
}
