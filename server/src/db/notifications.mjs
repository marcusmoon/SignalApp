import { nowIso } from './time.mjs';

const SEND_STATE_STATUSES = new Set(['sending', 'sent', 'failed', 'cancelled', 'skipped']);

function parsePayload(payload) {
  if (payload == null || payload === '') return {};
  try {
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function payloadOf(value) {
  return JSON.stringify(value ?? null);
}

function textOrNull(value) {
  if (value == null) return null;
  const text = String(value);
  return text.length > 0 ? text : null;
}

function notificationFromRow(row) {
  if (!row) return null;
  const payload = parsePayload(row.payload);
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
    scheduledAt: row.scheduled_at || payload.scheduledAt || null,
    expiresAt: row.expires_at || payload.expiresAt || null,
    sentAt: row.sent_at || payload.sentAt || null,
    sourceType: row.source_type || payload.sourceType || '',
    sourceId: row.source_id || payload.sourceId || '',
    updatedAt: row.updated_at || payload.updatedAt || null,
  };
}

function notificationColumns(item) {
  return {
    type: textOrNull(item.type),
    channel: textOrNull(item.channel),
    status: textOrNull(item.status),
    priority: textOrNull(item.priority),
    title: textOrNull(item.title),
    app_user_id: textOrNull(item.appUserId),
    target_type: textOrNull(item.targetType),
    target_key: textOrNull(item.targetKey),
    scheduled_at: textOrNull(item.scheduledAt),
    expires_at: textOrNull(item.expiresAt),
    sent_at: textOrNull(item.sentAt),
    source_type: textOrNull(item.sourceType),
    source_id: textOrNull(item.sourceId),
  };
}

export function upsertNotificationItemInDb(db, next) {
  if (!next?.id) return null;
  const previousRow = db.prepare('SELECT * FROM notification_items WHERE id = ?').get(next.id);
  const previous = notificationFromRow(previousRow);
  const preserveSendState = SEND_STATE_STATUSES.has(String(previous?.status || 'queued'));
  const merged = previous
    ? {
        ...previous,
        ...next,
        status: preserveSendState ? previous.status : next.status,
        sentAt: preserveSendState ? previous.sentAt : next.sentAt,
        provider: preserveSendState ? previous.provider : next.provider,
        providerMessageId: preserveSendState ? previous.providerMessageId : next.providerMessageId,
        attempts: preserveSendState ? previous.attempts : next.attempts,
        errorMessage: preserveSendState ? previous.errorMessage : next.errorMessage,
        createdAt: previous.createdAt || next.createdAt,
        updatedAt: next.updatedAt || nowIso(),
      }
    : { ...next, createdAt: next.createdAt || nowIso(), updatedAt: next.updatedAt || nowIso() };
  const columns = notificationColumns(merged);
  const position = previousRow ? Number(previousRow.position) || 0 : 0;
  db.prepare(
    `
      INSERT INTO notification_items (
        id, position, type, channel, status, priority, title, app_user_id,
        target_type, target_key, scheduled_at, expires_at, sent_at, source_type,
        source_id, payload, updated_at
      )
      VALUES (
        @id, @position, @type, @channel, @status, @priority, @title, @app_user_id,
        @target_type, @target_key, @scheduled_at, @expires_at, @sent_at, @source_type,
        @source_id, @payload, @updated_at
      )
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        channel = excluded.channel,
        status = excluded.status,
        priority = excluded.priority,
        title = excluded.title,
        app_user_id = excluded.app_user_id,
        target_type = excluded.target_type,
        target_key = excluded.target_key,
        scheduled_at = excluded.scheduled_at,
        expires_at = excluded.expires_at,
        sent_at = excluded.sent_at,
        source_type = excluded.source_type,
        source_id = excluded.source_id,
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `,
  ).run({
    id: merged.id,
    position,
    ...columns,
    payload: payloadOf(merged),
    updated_at: merged.updatedAt || nowIso(),
  });
  return merged;
}

function appendFilter(where, params, key, value, column) {
  const text = String(value || '').trim();
  if (!text) return;
  where.push(`${column} = @${key}`);
  params[key] = text;
}

export function queryNotificationsInDb(db, options = {}) {
  const page = Math.max(1, Math.floor(Number(options.page)) || 1);
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(options.pageSize)) || 30));
  const where = [];
  const params = {};
  appendFilter(where, params, 'type', options.type, 'type');
  appendFilter(where, params, 'status', options.status, 'status');
  appendFilter(where, params, 'channel', options.channel, 'channel');
  appendFilter(where, params, 'sourceType', options.sourceType, 'source_type');
  appendFilter(where, params, 'targetType', options.targetType, 'target_type');
  const appUserId = String(options.appUserId || '').trim();
  if (appUserId) {
    where.push('(app_user_id = @appUserId OR (target_type = @targetUserType AND target_key = @appUserId))');
    params.appUserId = appUserId;
    params.targetUserType = 'user';
  }
  const q = String(options.q || '').trim().toLowerCase();
  if (q) {
    where.push(
      '(LOWER(id) LIKE @q OR LOWER(COALESCE(title, "")) LIKE @q OR LOWER(COALESCE(source_type, "")) LIKE @q OR LOWER(COALESCE(source_id, "")) LIKE @q OR LOWER(COALESCE(app_user_id, "")) LIKE @q OR LOWER(payload) LIKE @q)',
    );
    params.q = `%${q}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = Number(db.prepare(`SELECT COUNT(*) AS count FROM notification_items ${whereSql}`).get(params)?.count) || 0;
  const rows = db
    .prepare(
      `
        SELECT *
        FROM notification_items
        ${whereSql}
        ORDER BY COALESCE(scheduled_at, updated_at) DESC, updated_at DESC
        LIMIT @limit OFFSET @offset
      `,
    )
    .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize })
    .map(notificationFromRow)
    .filter(Boolean);
  return {
    rows,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function queryPublicNotificationsForUserInDb(db, userId, { limit = 50 } = {}) {
  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit)) || 50));
  const now = nowIso();
  return db
    .prepare(
      `
        SELECT *
        FROM notification_items
        WHERE
          (
            app_user_id = @userId
            OR target_type = 'all'
            OR (target_type = 'user' AND target_key = @userId)
          )
          AND COALESCE(status, 'queued') NOT IN ('cancelled', 'skipped')
          AND (expires_at IS NULL OR expires_at = '' OR expires_at > @now)
        ORDER BY COALESCE(scheduled_at, updated_at) DESC, updated_at DESC
        LIMIT @limit
      `,
    )
    .all({ userId, now, limit: safeLimit })
    .map(notificationFromRow)
    .filter(Boolean);
}
