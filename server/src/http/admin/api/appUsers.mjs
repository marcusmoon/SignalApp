import {
  getAppUser,
  listAppUserIdentities,
  listAppUserDevices,
  listAppUserTermAcceptances,
  listAppUsers,
  queryNotifications,
  updateAppUserAdmin,
  updateAppUserDeviceAdmin,
  upsertNotification,
} from '../../../db.mjs';
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
    scheduledAt: item.scheduledAt || null,
    sentAt: item.sentAt || null,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function userIdFromPath(pathname, suffix = '') {
  const re = new RegExp(`^/admin/api/app-users/([^/]+)${suffix}$`);
  const match = pathname.match(re);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function handleAdminAppUsersRoutes({ req, res, url, pathname }) {
  if (req.method === 'GET' && pathname === '/admin/api/app-user-devices') {
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('pageSize') || '30', 10) || 30));
    const body = await listAppUserDevices({
      q: url.searchParams.get('q') || '',
      active: url.searchParams.get('active') || '',
      platform: url.searchParams.get('platform') || '',
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    const totalPages = Math.max(1, Math.ceil(body.total / body.limit));
    json(res, 200, {
      data: body.rows,
      page: Math.min(page, totalPages),
      pageSize: body.limit,
      total: body.total,
      totalPages,
      summary: {
        total: body.total,
        active: body.rows.filter((row) => row.active).length,
        inactive: body.rows.filter((row) => !row.active).length,
      },
    });
    return true;
  }

  const deviceMatch = pathname.match(/^\/admin\/api\/app-user-devices\/([^/]+)$/);
  if (req.method === 'PATCH' && deviceMatch) {
    const id = decodeURIComponent(deviceMatch[1]);
    const body = await readBody(req);
    const device = await updateAppUserDeviceAdmin(id, {
      active: typeof body.active === 'boolean' ? body.active : undefined,
    });
    json(res, 200, { data: device });
    return true;
  }

  if (req.method === 'GET' && pathname === '/admin/api/app-users') {
    const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('pageSize') || '30', 10) || 30));
    const body = await listAppUsers({
      q: url.searchParams.get('q') || '',
      active: url.searchParams.get('active') || '',
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    const totalPages = Math.max(1, Math.ceil(body.total / body.limit));
    json(res, 200, {
      data: body.rows,
      page: Math.min(page, totalPages),
      pageSize: body.limit,
      total: body.total,
      totalPages,
      summary: {
        total: body.total,
        active: body.rows.filter((row) => row.active).length,
        inactive: body.rows.filter((row) => !row.active).length,
        queuedNotifications: body.rows.reduce((sum, row) => sum + (Number(row.queuedNotificationCount) || 0), 0),
      },
    });
    return true;
  }

  const userId = userIdFromPath(pathname);
  if (req.method === 'GET' && userId) {
    const user = await getAppUser(userId);
    if (!user) {
      json(res, 404, { error: 'APP_USER_NOT_FOUND' });
      return true;
    }
    json(res, 200, { data: user });
    return true;
  }

  if (req.method === 'PATCH' && userId) {
    const body = await readBody(req);
    const user = await updateAppUserAdmin(userId, {
      active: typeof body.active === 'boolean' ? body.active : undefined,
      nickname: typeof body.nickname === 'string' ? body.nickname : undefined,
      profileImageUrl: typeof body.profileImageUrl === 'string' ? body.profileImageUrl : undefined,
    });
    json(res, 200, { data: user });
    return true;
  }

  const notificationsUserId = userIdFromPath(pathname, '/notifications');
  if (req.method === 'GET' && notificationsUserId) {
    const page = await queryNotifications({
      appUserId: notificationsUserId,
      page: url.searchParams.get('page') || '1',
      pageSize: url.searchParams.get('pageSize') || '20',
    });
    json(res, 200, {
      data: page.rows.map(compactNotification),
      page: page.page,
      pageSize: page.pageSize,
      total: page.total,
      totalPages: page.totalPages,
    });
    return true;
  }

  const termsUserId = userIdFromPath(pathname, '/terms');
  if (req.method === 'GET' && termsUserId) {
    json(res, 200, { data: await listAppUserTermAcceptances(termsUserId) });
    return true;
  }

  const identitiesUserId = userIdFromPath(pathname, '/identities');
  if (req.method === 'GET' && identitiesUserId) {
    json(res, 200, { data: await listAppUserIdentities(identitiesUserId) });
    return true;
  }

  if (req.method === 'POST' && notificationsUserId) {
    const user = await getAppUser(notificationsUserId);
    if (!user) {
      json(res, 404, { error: 'APP_USER_NOT_FOUND' });
      return true;
    }
    const body = await readBody(req);
    const next = createNotificationItem({
      ...body,
      appUserId: notificationsUserId,
      targetType: 'user',
      targetKey: notificationsUserId,
      sourceType: body.sourceType || 'admin',
      sourceId: body.sourceId || `admin:${Date.now()}`,
    });
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
