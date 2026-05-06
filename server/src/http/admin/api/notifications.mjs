import { readDb, updateDb } from '../../../db.mjs';
import { createNotificationItem, upsertNotificationItem } from '../../../notifications/outbox.mjs';
import { json, paginate, readBody } from '../../shared.mjs';

function filterNotifications(items, url) {
  const type = url.searchParams.get('type')?.trim();
  const status = url.searchParams.get('status')?.trim();
  const channel = url.searchParams.get('channel')?.trim();
  const sourceType = url.searchParams.get('sourceType')?.trim();
  const targetType = url.searchParams.get('targetType')?.trim();
  const q = url.searchParams.get('q')?.trim().toLowerCase();
  let rows = [...items];
  if (type) rows = rows.filter((item) => item.type === type);
  if (status) rows = rows.filter((item) => item.status === status);
  if (channel) rows = rows.filter((item) => item.channel === channel);
  if (sourceType) rows = rows.filter((item) => item.sourceType === sourceType);
  if (targetType) rows = rows.filter((item) => item.targetType === targetType);
  if (q) {
    rows = rows.filter((item) =>
      [
        item.id,
        item.type,
        item.status,
        item.title,
        item.body,
        item.sourceType,
        item.sourceId,
        item.targetType,
        item.targetKey,
        item.errorMessage,
      ].some((value) => String(value || '').toLowerCase().includes(q)),
    );
  }
  return rows.sort(
    (a, b) =>
      String(b.scheduledAt || b.createdAt || '').localeCompare(String(a.scheduledAt || a.createdAt || '')) ||
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
  );
}

function compactNotification(item) {
  return {
    id: item.id,
    type: item.type || '',
    channel: item.channel || 'push',
    status: item.status || 'queued',
    priority: item.priority || 'normal',
    title: item.title || '',
    body: item.body || '',
    targetType: item.targetType || 'all',
    targetKey: item.targetKey || null,
    sourceType: item.sourceType || '',
    sourceId: item.sourceId || '',
    deepLink: item.deepLink || '',
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
    const db = await readDb();
    const rows = filterNotifications(db.notificationItems, url).map(compactNotification);
    const page = paginate(rows, url, 30, 100);
    json(res, 200, {
      data: page.rows,
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
    const saved = await updateDb((db) => {
      upsertNotificationItem(db.notificationItems, next);
      return db.notificationItems.find((item) => item.id === next.id);
    });
    json(res, 201, { data: compactNotification(saved) });
    return true;
  }

  return false;
}
