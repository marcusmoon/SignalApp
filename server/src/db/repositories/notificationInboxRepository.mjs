import { queryKysely } from '../kysely/client.mjs';
import { nowIso } from '../time.mjs';
import { buildNotificationCategoryClause } from '../../notifications/notificationCategory.mjs';
import { cleanText, safeLimit } from './publicHelpers.mjs';

export const USER_NOTIFICATION_INBOX_MAX = 50;

/** Inbox lazy-link: 알림함은 푸시 발송 완료를 기다리지 않는다. 예약 시각이 지난 queued 포함. */
const INBOX_LAZY_LINK_STATUSES = ['sent', 'skipped', 'queued'];

function inboxRowId(userId, notificationId) {
  return `${cleanText(userId)}:${cleanText(notificationId)}`;
}

function publicInboxRow(row) {
  if (!row) return null;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    id: row.inbox_id,
    notificationId: row.notification_id,
    type: row.type || payload.type || '',
    channel: row.channel || payload.channel || 'push',
    status: row.status || payload.status || 'sent',
    priority: row.priority || payload.priority || 'normal',
    title: row.title || payload.title || '',
    body: row.body || payload.body || '',
    sourceType: row.source_type || payload.sourceType || '',
    sourceId: row.source_id || payload.sourceId || '',
    deepLink: payload.deepLink || '',
    payload,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : payload.scheduledAt || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

export async function isActiveRegisteredAppUser(userId) {
  const id = cleanText(userId);
  if (!id) return false;
  const result = await queryKysely('SELECT id FROM app_users WHERE id = $1 AND active = true', [id]);
  return result.rows.length > 0;
}

async function trimUserInboxToMax(userId, max = USER_NOTIFICATION_INBOX_MAX) {
  const id = cleanText(userId);
  if (!id) return;
  await queryKysely(
    `
      DELETE FROM user_notification_inbox
      WHERE id IN (
        SELECT id
        FROM user_notification_inbox
        WHERE user_id = $1
        ORDER BY delivered_at DESC, id DESC
        OFFSET $2
      )
    `,
    [id, max],
  );
}

export async function upsertUserNotificationInboxRow(userId, notificationId, options = {}) {
  const uid = cleanText(userId);
  const nid = cleanText(notificationId);
  if (!uid || !nid) return null;
  if (!(await isActiveRegisteredAppUser(uid))) return null;

  const now = options.deliveredAt || nowIso();
  const id = inboxRowId(uid, nid);
  const result = await queryKysely(
    `
      INSERT INTO user_notification_inbox (
        id, user_id, notification_id, delivered_at, read_at, deleted_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, NULL, NULL, $5, $5)
      ON CONFLICT (user_id, notification_id) DO UPDATE SET
        delivered_at = CASE
          WHEN user_notification_inbox.delivered_at IS NULL OR excluded.delivered_at > user_notification_inbox.delivered_at
            THEN excluded.delivered_at
          ELSE user_notification_inbox.delivered_at
        END,
        updated_at = excluded.updated_at
      RETURNING *
    `,
    [id, uid, nid, now, now],
  ).catch(() => ({ rows: [] }));
  await trimUserInboxToMax(uid);
  return result.rows[0] || null;
}

export async function syncLazyInboxLinksForUser(userId) {
  const uid = cleanText(userId);
  if (!uid || !(await isActiveRegisteredAppUser(uid))) return 0;

  const countResult = await queryKysely(
    'SELECT COUNT(*)::int AS count FROM user_notification_inbox WHERE user_id = $1',
    [uid],
  );
  const currentCount = Number(countResult.rows[0]?.count) || 0;
  const remaining = USER_NOTIFICATION_INBOX_MAX - currentCount;
  if (remaining <= 0) {
    await trimUserInboxToMax(uid);
    return 0;
  }

  const candidates = await queryKysely(
    `
      SELECT n.id, COALESCE(n.sent_at, n.scheduled_at, n.updated_at) AS delivered_at
      FROM notification_items n
      WHERE (
        n.app_user_id = $1
        OR (n.target_type = 'all' AND n.app_user_id IS NULL)
      )
      AND (n.expires_at IS NULL OR n.expires_at > NOW())
      AND (n.scheduled_at IS NULL OR n.scheduled_at <= NOW())
      AND n.status = ANY($3::text[])
      AND NOT EXISTS (
        SELECT 1
        FROM user_notification_inbox i
        WHERE i.user_id = $1 AND i.notification_id = n.id
      )
      ORDER BY COALESCE(n.sent_at, n.scheduled_at, n.updated_at) DESC NULLS LAST, n.id DESC
      LIMIT $2
    `,
    [uid, remaining, INBOX_LAZY_LINK_STATUSES],
  );

  let inserted = 0;
  for (const row of candidates.rows) {
    const deliveredAt = row.delivered_at ? new Date(row.delivered_at).toISOString() : nowIso();
    const saved = await upsertUserNotificationInboxRow(uid, row.id, { deliveredAt });
    if (saved) inserted += 1;
  }
  return inserted;
}

function inboxListQueryParts(userId, options = {}) {
  const params = [userId];
  const categoryClause = buildNotificationCategoryClause(options.filter, 'n', params);
  return {
    params,
    where: `
      i.user_id = $1
      AND i.deleted_at IS NULL
      AND (n.expires_at IS NULL OR n.expires_at > NOW())
      ${categoryClause}
    `,
  };
}

export async function queryUserNotificationInboxRows(userId, options = {}) {
  const uid = cleanText(userId);
  if (!uid || !(await isActiveRegisteredAppUser(uid))) return [];

  await syncLazyInboxLinksForUser(uid);

  const limit = Math.min(USER_NOTIFICATION_INBOX_MAX, safeLimit(options.limit, USER_NOTIFICATION_INBOX_MAX, USER_NOTIFICATION_INBOX_MAX));
  const { params, where } = inboxListQueryParts(uid, options);
  params.push(limit);
  const result = await queryKysely(
    `
      SELECT
        i.id AS inbox_id,
        i.notification_id,
        i.delivered_at,
        i.read_at,
        i.deleted_at,
        i.created_at,
        n.type,
        n.channel,
        n.status,
        n.priority,
        n.title,
        n.source_type,
        n.source_id,
        n.scheduled_at,
        n.payload
      FROM user_notification_inbox i
      JOIN notification_items n ON n.id = i.notification_id
      WHERE ${where}
      ORDER BY i.delivered_at DESC, i.id DESC
      LIMIT $${params.length}
    `,
    params,
  );
  return result.rows.map(publicInboxRow).filter(Boolean);
}

export async function queryUserNotificationInboxPage(userId, options = {}) {
  const uid = cleanText(userId);
  if (!uid || !(await isActiveRegisteredAppUser(uid))) {
    return { rows: [], page: 1, pageSize: 20, total: 0, totalPages: 1 };
  }

  await syncLazyInboxLinksForUser(uid);

  const page = Math.max(1, Number.parseInt(options.page || '1', 10) || 1);
  const pageSize = safeLimit(options.pageSize, 20, 50);
  const offset = (page - 1) * pageSize;
  const { params, where } = inboxListQueryParts(uid, options);
  params.push(pageSize + 1, offset);
  const result = await queryKysely(
    `
      SELECT
        i.id AS inbox_id,
        i.notification_id,
        i.delivered_at,
        i.read_at,
        i.deleted_at,
        i.created_at,
        n.type,
        n.channel,
        n.status,
        n.priority,
        n.title,
        n.source_type,
        n.source_id,
        n.scheduled_at,
        n.payload
      FROM user_notification_inbox i
      JOIN notification_items n ON n.id = i.notification_id
      WHERE ${where}
      ORDER BY i.delivered_at DESC, i.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  const rows = result.rows.map(publicInboxRow).filter(Boolean).slice(0, pageSize);
  const hasMore = result.rows.length > pageSize;
  return {
    rows,
    page,
    pageSize,
    total: offset + rows.length + (hasMore ? 1 : 0),
    totalPages: hasMore ? page + 1 : page,
  };
}

export async function countUnreadUserNotificationInbox(userId) {
  const uid = cleanText(userId);
  if (!uid || !(await isActiveRegisteredAppUser(uid))) return 0;

  await syncLazyInboxLinksForUser(uid);

  const result = await queryKysely(
    `
      SELECT COUNT(*)::int AS count
      FROM user_notification_inbox i
      JOIN notification_items n ON n.id = i.notification_id
      WHERE i.user_id = $1
        AND i.deleted_at IS NULL
        AND i.read_at IS NULL
        AND (n.expires_at IS NULL OR n.expires_at > NOW())
    `,
    [uid],
  );
  return Number(result.rows[0]?.count) || 0;
}

export async function markUserNotificationInboxRead(userId, options = {}) {
  const uid = cleanText(userId);
  if (!uid || !(await isActiveRegisteredAppUser(uid))) return 0;

  const now = nowIso();
  if (options.all) {
    const result = await queryKysely(
      `
        UPDATE user_notification_inbox
        SET read_at = COALESCE(read_at, $2::timestamptz), updated_at = $2::timestamptz
        WHERE user_id = $1 AND deleted_at IS NULL AND read_at IS NULL
      `,
      [uid, now],
    );
    return result.rowCount || 0;
  }

  const ids = Array.isArray(options.ids) ? options.ids.map(cleanText).filter(Boolean) : [];
  if (!ids.length) return 0;
  const result = await queryKysely(
    `
      UPDATE user_notification_inbox
      SET read_at = COALESCE(read_at, $2::timestamptz), updated_at = $2::timestamptz
      WHERE user_id = $1 AND deleted_at IS NULL AND id = ANY($3::text[])
    `,
    [uid, now, ids],
  );
  return result.rowCount || 0;
}

export async function deleteUserNotificationInboxItems(userId, options = {}) {
  const uid = cleanText(userId);
  if (!uid || !(await isActiveRegisteredAppUser(uid))) return 0;

  const now = nowIso();
  if (options.all) {
    const result = await queryKysely(
      `
        UPDATE user_notification_inbox
        SET deleted_at = COALESCE(deleted_at, $2::timestamptz), updated_at = $2::timestamptz
        WHERE user_id = $1 AND deleted_at IS NULL
      `,
      [uid, now],
    );
    return result.rowCount || 0;
  }

  const ids = Array.isArray(options.ids) ? options.ids.map(cleanText).filter(Boolean) : [];
  if (!ids.length) return 0;
  const result = await queryKysely(
    `
      UPDATE user_notification_inbox
      SET deleted_at = COALESCE(deleted_at, $2::timestamptz), updated_at = $2::timestamptz
      WHERE user_id = $1 AND deleted_at IS NULL AND id = ANY($3::text[])
    `,
    [uid, now, ids],
  );
  return result.rowCount || 0;
}

export async function recordInboxDeliveriesForUsers(userIds, notificationId, deliveredAt = nowIso()) {
  const nid = cleanText(notificationId);
  if (!nid) return 0;
  const unique = [...new Set((userIds || []).map(cleanText).filter(Boolean))];
  let count = 0;
  for (const userId of unique) {
    const row = await upsertUserNotificationInboxRow(userId, nid, { deliveredAt });
    if (row) count += 1;
  }
  return count;
}
