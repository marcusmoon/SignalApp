import { queryNotifications, upsertNotification } from '../../../db.mjs';
import { createNotificationItem } from '../../../notifications/outbox.mjs';
import { json, readBody } from '../../shared.mjs';

function compactNotification(item) {
  return {
    id: item.id,
    type: item.type || '',
    channel: item.channel || 'push',
    status: item.status || 'queued',
    priority: item.priority || 'normal',
    title: item.title || '',
    body: item.body || '',
    appUserId: item.appUserId || null,
    targetType: item.targetType || 'all',
    targetKey: item.targetKey || null,
    sourceType: item.sourceType || '',
    sourceId: item.sourceId || '',
    deepLink: item.deepLink || '',
    provider: item.provider || '',
    providerMessageId: item.providerMessageId || '',
    attempts: Number(item.attempts) || 0,
    errorMessage: item.errorMessage || '',
    scheduledAt: item.scheduledAt || null,
    expiresAt: item.expiresAt || null,
    sentAt: item.sentAt || null,
    attempts: Number.isFinite(Number(item.attempts)) ? Number(item.attempts) : 0,
    errorMessage: item.errorMessage || null,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

export async function handleAdminNotificationsRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/admin/api/notifications') {
    const page = await queryNotifications({
      type: url.searchParams.get('type') || '',
      status: url.searchParams.get('status') || '',
      channel: url.searchParams.get('channel') || '',
      sourceType: url.searchParams.get('sourceType') || '',
      targetType: url.searchParams.get('targetType') || '',
      appUserId: url.searchParams.get('appUserId') || '',
      q: url.searchParams.get('q') || '',
      page: url.searchParams.get('page') || '1',
      pageSize: url.searchParams.get('pageSize') || '30',
    });
    const rows = page.rows.map(compactNotification);
    json(res, 200, {
      data: rows,
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
      summary: {
        queued: rows.filter((item) => item.status === 'queued').length,
        sent: rows.filter((item) => item.status === 'sent').length,
        failed: rows.filter((item) => item.status === 'failed').length,
      },
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/admin/api/notifications') {
    const body = await readBody(req);
    const next = createNotificationItem(body);
    if (!next) {
      json(res, 400, { error: 'INVALID_NOTIFICATION' });
      return true;
    }
    const saved = await upsertNotification(next);
    json(res, 201, { data: compactNotification(saved) });
    return true;
  }

  return false;
}
