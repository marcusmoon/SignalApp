import { queryKysely } from '../kysely/client.mjs';
import { nowIso } from '../time.mjs';
import { buildNotificationCategoryClause } from '../../notifications/notificationCategory.mjs';
import { cleanText, safeLimit } from './publicHelpers.mjs';

export const USER_NOTIFICATION_INBOX_MAX = 50;

/** Inbox lazy-link: published = 알림함 기본 노출. pushDelivery는 푸시 파이프라인 전용. */
const INBOX_LAZY_LINK_STATUSES = ['published', 'sent', 'skipped', 'queued'];

function notificationDeliveredAtExpr(alias = 'n') {
  return `COALESCE(${alias}.updated_at, ${alias}.sent_at, ${alias}.scheduled_at)`;
}

function notificationAudienceClause(alias = 'n', userParam = '$1') {
  return `(
    ${alias}.app_user_id = ${userParam}
    OR (COALESCE(${alias}.target_type, 'all') = 'all' AND ${alias}.app_user_id IS NULL)
  )`;
}

function notificationEligibilityClause(alias = 'n', userParam = '$1') {
  return `
    ${notificationAudienceClause(alias, userParam)}
    AND (${alias}.expires_at IS NULL OR ${alias}.expires_at > NOW())
    AND (${alias}.scheduled_at IS NULL OR ${alias}.scheduled_at <= NOW())
    AND ${alias}.status = ANY($2::text[])
  `;
}

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
  const user = await getActiveAppUser(userId);
  return Boolean(user);
}

async function getActiveAppUser(userId) {
  const id = cleanText(userId);
  if (!id) return null;
  const result = await queryKysely(
    'SELECT id, created_at FROM app_users WHERE id = $1 AND active = true',
    [id],
  );
  return result.rows[0] || null;
}

/** Keep newest `max` active inbox rows; hard-delete older active rows. */
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
        read_at = CASE
          WHEN user_notification_inbox.delivered_at IS NULL OR excluded.delivered_at > user_notification_inbox.delivered_at
            THEN NULL
          ELSE user_notification_inbox.read_at
        END,
        updated_at = excluded.updated_at
      RETURNING *
    `,
    [id, uid, nid, now, now],
  ).catch(() => ({ rows: [] }));
  return result.rows[0] || null;
}

export async function syncLazyInboxLinksForUser(userId) {
  const user = await getActiveAppUser(userId);
  if (!user) return 0;
  const uid = user.id;
  const userCreatedAt = user.created_at;

  const eligibility = notificationEligibilityClause('n', '$1');
  let touched = 0;

  const resurfaced = await queryKysely(
    `
      UPDATE user_notification_inbox i
      SET
        delivered_at = src.delivered_at,
        read_at = NULL,
        updated_at = NOW()
      FROM (
        SELECT
          n.id,
          ${notificationDeliveredAtExpr('n')} AS delivered_at
        FROM notification_items n
        WHERE ${eligibility}
          AND ${notificationDeliveredAtExpr('n')} >= $3::timestamptz
      ) src
      WHERE i.user_id = $1
        AND i.notification_id = src.id
        AND src.delivered_at > i.delivered_at
        AND NOT EXISTS (
          SELECT 1
          FROM user_notification_dismissals d
          WHERE d.user_id = $1 AND d.notification_id = src.id
        )
    `,
    [uid, INBOX_LAZY_LINK_STATUSES, userCreatedAt],
  );
  touched += resurfaced.rowCount || 0;

  const candidates = await queryKysely(
    `
      SELECT n.id, ${notificationDeliveredAtExpr('n')} AS delivered_at
      FROM notification_items n
      WHERE ${eligibility}
        AND ${notificationDeliveredAtExpr('n')} >= $3::timestamptz
        AND NOT EXISTS (
          SELECT 1
          FROM user_notification_inbox i
          WHERE i.user_id = $1 AND i.notification_id = n.id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM user_notification_dismissals d
          WHERE d.user_id = $1 AND d.notification_id = n.id
        )
      ORDER BY ${notificationDeliveredAtExpr('n')} DESC NULLS LAST, n.id DESC
      LIMIT $4
    `,
    [uid, INBOX_LAZY_LINK_STATUSES, userCreatedAt, USER_NOTIFICATION_INBOX_MAX],
  );

  for (const row of candidates.rows) {
    const deliveredAt = row.delivered_at ? new Date(row.delivered_at).toISOString() : nowIso();
    const saved = await upsertUserNotificationInboxRow(uid, row.id, { deliveredAt });
    if (saved) touched += 1;
  }

  await trimUserInboxToMax(uid);
  return touched;
}

function inboxListQueryParts(userId, options = {}) {
  const params = [userId];
  const categoryClause = buildNotificationCategoryClause(options.filter, 'n', params);
  return {
    params,
    where: `
      i.user_id = $1
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
        WHERE user_id = $1 AND read_at IS NULL
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
      WHERE user_id = $1 AND id = ANY($3::text[])
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
    await queryKysely(
      `
        INSERT INTO user_notification_dismissals (user_id, notification_id, dismissed_at)
        SELECT user_id, notification_id, $2::timestamptz
        FROM user_notification_inbox
        WHERE user_id = $1
        ON CONFLICT (user_id, notification_id) DO NOTHING
      `,
      [uid, now],
    );
    const result = await queryKysely(
      'DELETE FROM user_notification_inbox WHERE user_id = $1',
      [uid],
    );
    return result.rowCount || 0;
  }

  const ids = Array.isArray(options.ids) ? options.ids.map(cleanText).filter(Boolean) : [];
  if (!ids.length) return 0;
  await queryKysely(
    `
      INSERT INTO user_notification_dismissals (user_id, notification_id, dismissed_at)
      SELECT user_id, notification_id, $2::timestamptz
      FROM user_notification_inbox
      WHERE user_id = $1 AND id = ANY($3::text[])
      ON CONFLICT (user_id, notification_id) DO NOTHING
    `,
    [uid, now, ids],
  );
  const result = await queryKysely(
    'DELETE FROM user_notification_inbox WHERE user_id = $1 AND id = ANY($2::text[])',
    [uid, ids],
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
  for (const userId of unique) {
    await trimUserInboxToMax(userId);
  }
  return count;
}
