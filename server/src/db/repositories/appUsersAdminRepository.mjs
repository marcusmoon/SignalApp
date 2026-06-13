import { queryKysely } from '../kysely/client.mjs';
import { nowIso } from '../time.mjs';
import {
  cleanText,
  pageOptions,
} from './publicHelpers.mjs';

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    nickname: row.nickname,
    profileImageUrl: row.profile_image_url || '',
    authProvider: row.auth_provider || 'password',
    active: row.active === true,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function publicDevice(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    platform: row.platform || '',
    pushToken: row.push_token || '',
    deviceName: row.device_name || '',
    active: row.active === true,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function adminUserRow(row) {
  if (!row) return null;
  return {
    ...publicUser(row),
    activeSessionCount: Number(row.active_session_count) || 0,
    deviceCount: Number(row.device_count) || 0,
    latestSessionAt: row.latest_session_at ? new Date(row.latest_session_at).toISOString() : null,
    latestDeviceAt: row.latest_device_at ? new Date(row.latest_device_at).toISOString() : null,
    notificationCount: Number(row.notification_count) || 0,
    queuedNotificationCount: Number(row.queued_notification_count) || 0,
  };
}

export async function listAppUserRows(options = {}) {
  const { limit, offset } = pageOptions(options, 50);
  const q = `%${cleanText(options.q).toLowerCase()}%`;
  const active = cleanText(options.active);
  const params = [limit + 1, offset];
  const where = [];
  if (cleanText(options.q)) {
    params.push(q);
    where.push(`(lower(u.email) LIKE $${params.length} OR lower(u.nickname) LIKE $${params.length})`);
  }
  if (active === 'true' || active === 'false') {
    params.push(active === 'true');
    where.push(`u.active = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const result = await queryKysely(
    `
      SELECT
        u.*,
        (SELECT COUNT(*) FROM app_user_refresh_sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > NOW()) AS active_session_count,
        (SELECT COUNT(*) FROM app_user_devices d WHERE d.user_id = u.id) AS device_count,
        (SELECT MAX(s.created_at) FROM app_user_refresh_sessions s WHERE s.user_id = u.id) AS latest_session_at,
        (SELECT MAX(d.updated_at) FROM app_user_devices d WHERE d.user_id = u.id) AS latest_device_at,
        (SELECT COUNT(*) FROM notification_items n WHERE n.app_user_id = u.id) AS notification_count,
        (SELECT COUNT(*) FROM notification_items n WHERE n.app_user_id = u.id AND n.status = 'queued') AS queued_notification_count
      FROM app_users u
      ${whereSql}
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `,
    params,
  );
  const rows = result.rows.slice(0, limit).map(adminUserRow);
  return { rows, total: offset + rows.length + (result.rows.length > limit ? 1 : 0), limit, offset };
}

export async function listAppUserDeviceRows(options = {}) {
  const { limit, offset } = pageOptions(options, 50);
  const q = `%${cleanText(options.q).toLowerCase()}%`;
  const active = cleanText(options.active);
  const platform = cleanText(options.platform).toLowerCase();
  const params = [limit + 1, offset];
  const where = [];
  if (cleanText(options.q)) {
    params.push(q);
    where.push(`(lower(d.device_name) LIKE $${params.length} OR lower(d.push_token) LIKE $${params.length} OR lower(u.email) LIKE $${params.length})`);
  }
  if (active === 'true' || active === 'false') {
    params.push(active === 'true');
    where.push(`d.active = $${params.length}`);
  }
  if (platform) {
    params.push(platform);
    where.push(`lower(d.platform) = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const result = await queryKysely(
    `
      SELECT d.*, u.email, u.nickname
      FROM app_user_devices d
      JOIN app_users u ON u.id = d.user_id
      ${whereSql}
      ORDER BY d.updated_at DESC
      LIMIT $1 OFFSET $2
    `,
    params,
  );
  const rows = result.rows.slice(0, limit).map(publicDevice);
  return { rows, total: offset + rows.length + (result.rows.length > limit ? 1 : 0), limit, offset };
}

export async function updateAppUserAdminRow(userId, patch = {}) {
  const sets = [];
  const params = [];
  if (typeof patch.active === 'boolean') {
    params.push(patch.active);
    sets.push(`active = $${params.length}`);
  }
  if (typeof patch.nickname === 'string') {
    params.push(cleanText(patch.nickname));
    sets.push(`nickname = $${params.length}`);
  }
  if (typeof patch.profileImageUrl === 'string') {
    params.push(cleanText(patch.profileImageUrl));
    sets.push(`profile_image_url = $${params.length}`);
  }
  if (sets.length === 0) return null;
  params.push(nowIso());
  sets.push(`updated_at = $${params.length}`);
  params.push(cleanText(userId));
  const result = await queryKysely(`UPDATE app_users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
  if (!result.rows[0]) throw new Error('APP_USER_NOT_FOUND');
  return publicUser(result.rows[0]);
}

export async function updateAppUserDeviceAdminRow(deviceId, patch = {}) {
  const result = await queryKysely(
    'UPDATE app_user_devices SET active = COALESCE($1, active), updated_at = $2 WHERE id = $3 RETURNING *',
    [typeof patch.active === 'boolean' ? patch.active : null, nowIso(), cleanText(deviceId)],
  );
  if (!result.rows[0]) throw new Error('APP_USER_DEVICE_NOT_FOUND');
  return publicDevice(result.rows[0]);
}
