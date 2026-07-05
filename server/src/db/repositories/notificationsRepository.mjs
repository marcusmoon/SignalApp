import { queryKysely, withKyselyTransaction } from '../kysely/client.mjs';
import { nowIso } from '../time.mjs';
import {
  cleanText,
  pageOptions,
  payloadFromRow,
  safeLimit,
} from './publicHelpers.mjs';

function jsonPayload(value) {
  return JSON.stringify(value ?? null);
}

function textOrNull(value) {
  const text = cleanText(value);
  return text ? text : null;
}

function isoOrNull(value) {
  const text = cleanText(value);
  return text ? text : null;
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

function publicNotification(row) {
  if (!row) return null;
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    ...payload,
    id: row.id,
    type: row.type || payload.type || '',
    channel: row.channel || payload.channel || 'push',
    status: row.status || payload.status || 'queued',
    priority: row.priority || payload.priority || 'normal',
    title: row.title || payload.title || '',
    appUserId: row.app_user_id || payload.appUserId || null,
    targetType: row.target_type || payload.targetType || 'all',
    targetKey: row.target_key || payload.targetKey || null,
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : payload.scheduledAt || null,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : payload.expiresAt || null,
    sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : payload.sentAt || null,
    sourceType: row.source_type || payload.sourceType || '',
    sourceId: row.source_id || payload.sourceId || '',
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : payload.updatedAt || null,
  };
}

export async function upsertNotificationRow(next) {
  if (!next?.id) throw new Error('INVALID_NOTIFICATION');
  const now = nowIso();
  const row = { ...next, updatedAt: now };
  const result = await queryKysely(
    `
      INSERT INTO notification_items (
        id, position, type, channel, status, priority, title, app_user_id, target_type,
        target_key, scheduled_at, expires_at, sent_at, source_type, source_id, payload, updated_at
      ) VALUES (
        $1, 0, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16
      )
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        channel = excluded.channel,
        status = CASE
          WHEN notification_items.status IN ('sending', 'sent', 'failed', 'cancelled', 'skipped') THEN notification_items.status
          ELSE excluded.status
        END,
        priority = excluded.priority,
        title = excluded.title,
        app_user_id = excluded.app_user_id,
        target_type = excluded.target_type,
        target_key = excluded.target_key,
        scheduled_at = excluded.scheduled_at,
        expires_at = excluded.expires_at,
        sent_at = CASE
          WHEN notification_items.status IN ('sending', 'sent', 'failed', 'cancelled', 'skipped') THEN notification_items.sent_at
          ELSE excluded.sent_at
        END,
        source_type = excluded.source_type,
        source_id = excluded.source_id,
        payload = CASE
          WHEN notification_items.status IN ('sending', 'sent', 'failed', 'cancelled', 'skipped')
            THEN excluded.payload
              || jsonb_build_object(
                'status', notification_items.status,
                'sentAt', notification_items.sent_at,
                'provider', notification_items.payload->>'provider',
                'providerMessageId', notification_items.payload->>'providerMessageId',
                'attempts', CASE
                  WHEN COALESCE(notification_items.payload->>'attempts', '') ~ '^[0-9]+$'
                    THEN (notification_items.payload->>'attempts')::int
                  ELSE 0
                END,
                'errorMessage', notification_items.payload->>'errorMessage'
              )
          ELSE excluded.payload
        END,
        updated_at = excluded.updated_at
      RETURNING *
    `,
    [
      row.id,
      textOrNull(row.type),
      textOrNull(row.channel || 'push'),
      textOrNull(row.status || 'queued'),
      textOrNull(row.priority || 'normal'),
      textOrNull(row.title),
      textOrNull(row.appUserId),
      textOrNull(row.targetType || 'all'),
      textOrNull(row.targetKey),
      isoOrNull(row.scheduledAt),
      isoOrNull(row.expiresAt),
      isoOrNull(row.sentAt),
      textOrNull(row.sourceType),
      textOrNull(row.sourceId),
      jsonPayload(row),
      now,
    ],
  );
  return publicNotification(result.rows[0]);
}

export async function queryNotificationRows(options = {}) {
  const page = Math.max(1, Number.parseInt(options.page || '1', 10) || 1);
  const pageSize = safeLimit(options.pageSize, 30, 100);
  const offset = (page - 1) * pageSize;
  const params = [];
  const where = [];
  if (options.appUserId) {
    params.push(cleanText(options.appUserId));
    where.push(`app_user_id = $${params.length}`);
  }
  if (options.status) {
    params.push(cleanText(options.status));
    where.push(`status = $${params.length}`);
  }
  params.push(pageSize + 1, offset);
  const result = await queryKysely(
    `
      SELECT payload
      FROM notification_items
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY COALESCE(scheduled_at, NULLIF(payload->>'createdAt', '')::timestamptz, updated_at) DESC NULLS LAST
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );
  const rows = result.rows.map(payloadFromRow).filter(Boolean).slice(0, pageSize);
  const hasMore = result.rows.length > pageSize;
  return {
    rows,
    page,
    pageSize,
    total: offset + rows.length + (hasMore ? 1 : 0),
    totalPages: hasMore ? page + 1 : page,
  };
}

export async function claimPushNotificationRows({ limit = 20, now = nowIso(), provider = 'mock' } = {}) {
  return withKyselyTransaction(async (client) => {
    const result = await client.query(
      `
        SELECT *
        FROM notification_items
        WHERE status = 'queued' AND channel = 'push'
          AND (scheduled_at IS NULL OR scheduled_at <= $1)
          AND (expires_at IS NULL OR expires_at > $1)
        ORDER BY COALESCE(scheduled_at, updated_at) ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      `,
      [now, safeLimit(limit, 20, 100)],
    );
    const claimed = [];
    for (const row of result.rows) {
      const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
      const next = { ...payload, status: 'sending', provider, attempts: Number(payload.attempts) || 0, updatedAt: now };
      const update = await client.query(
        'UPDATE notification_items SET status = $1, payload = $2::jsonb, updated_at = $3 WHERE id = $4 RETURNING *',
        ['sending', jsonPayload(next), now, row.id],
      );
      claimed.push(publicNotification(update.rows[0]));
    }
    return claimed;
  });
}

export async function resolvePushDeviceRows(notification) {
  const targetType = cleanText(notification?.targetType || 'all');
  const params = [];
  let where = 'd.active = true AND d.push_token IS NOT NULL AND d.push_token <> \'\'';
  if (targetType === 'user' && notification?.appUserId) {
    params.push(notification.appUserId);
    where += ` AND d.user_id = $${params.length}`;
  }
  const result = await queryKysely(`SELECT d.* FROM app_user_devices d JOIN app_users u ON u.id = d.user_id WHERE ${where} AND u.active = true`, params);
  return result.rows.map(publicDevice);
}

export async function updateNotificationSendStateRow(notificationId, patch = {}) {
  const existing = await queryKysely('SELECT * FROM notification_items WHERE id = $1', [cleanText(notificationId)]);
  const row = publicNotification(existing.rows[0]);
  if (!row) return null;
  const now = nowIso();
  const next = {
    ...row,
    ...patch,
    attempts: patch.attempts ?? row.attempts,
    updatedAt: now,
  };
  const result = await queryKysely(
    `
      UPDATE notification_items
      SET status = $1, sent_at = $2, payload = $3::jsonb, updated_at = $4
      WHERE id = $5
      RETURNING *
    `,
    [textOrNull(next.status), isoOrNull(next.sentAt), jsonPayload(next), now, row.id],
  );
  return publicNotification(result.rows[0]);
}
