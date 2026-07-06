import { nowIso } from '../db/time.mjs';

export const NOTIFICATION_TYPES = {
  appUpdate: 'app_update',
  serviceNotice: 'service_notice',
  earningsReminder: 'earnings_reminder',
  marketAlert: 'market_alert',
  marketBriefing: 'market_briefing',
  todayBriefing: 'today_briefing',
  newsDigest: 'news_digest',
  disclosureDigest: 'disclosure_digest',
};

const SEND_STATE_STATUSES = new Set(['sending', 'sent', 'failed', 'cancelled', 'skipped']);

const TERMINAL_PUSH_DELIVERY = new Set(['sending', 'sent', 'skipped', 'none']);

function cleanText(value) {
  return String(value || '').trim();
}

function normalizePriority(value) {
  const text = cleanText(value).toLowerCase();
  if (text === 'high' || text === 'urgent') return 'high';
  if (text === 'low') return 'low';
  return 'normal';
}

function normalizeChannel(value) {
  const text = cleanText(value).toLowerCase();
  if (text === 'in_app') return 'in_app';
  if (text === 'email') return 'email';
  return 'push';
}

function normalizeStatus(value) {
  const text = cleanText(value).toLowerCase();
  if (text === 'planned' || text === 'pending' || text === 'published') return text;
  if (SEND_STATE_STATUSES.has(text)) return text;
  return 'queued';
}

function normalizeTargetType(value) {
  const text = cleanText(value).toLowerCase();
  if (text === 'watchlist') return 'watchlist';
  if (text === 'symbol') return 'symbol';
  if (text === 'user') return 'user';
  if (text === 'segment') return 'segment';
  return 'all';
}

function safeSymbols(value) {
  return Array.isArray(value)
    ? value.map((symbol) => cleanText(symbol).toUpperCase()).filter(Boolean).slice(0, 12)
    : [];
}

function safeTopics(value) {
  return Array.isArray(value) ? value.map(cleanText).filter(Boolean).slice(0, 20) : [];
}

function sourceRefs(value) {
  return Array.isArray(value) ? value.filter((ref) => ref && typeof ref === 'object').slice(0, 20) : [];
}

function notificationIdFor({ type, sourceType, sourceId, targetType, targetKey, channel }) {
  const srcType = cleanText(sourceType) || cleanText(type) || 'manual';
  const srcId = cleanText(sourceId) || `${Date.now()}`;
  const target = cleanText(targetKey) ? `:${cleanText(targetType) || 'target'}:${cleanText(targetKey)}` : '';
  return `notification:${normalizeChannel(channel)}:${srcType}:${srcId}${target}`;
}

/** True when a push-channel row is waiting for the notification sender worker. */
export function isPendingPushDelivery(item) {
  if (!item || cleanText(item.channel).toLowerCase() !== 'push') return false;
  const payload = item.payload && typeof item.payload === 'object' ? item.payload : {};
  const pushDelivery = cleanText(payload.pushDelivery);
  if (TERMINAL_PUSH_DELIVERY.has(pushDelivery)) return false;
  const status = cleanText(item.status).toLowerCase();
  if (status === 'queued' && (!pushDelivery || pushDelivery === 'pending')) return true;
  if (status === 'published' && pushDelivery === 'pending') return true;
  return false;
}

export function createNotificationItem(input, generatedAt = nowIso()) {
  const type = cleanText(input?.type || NOTIFICATION_TYPES.serviceNotice);
  const title = cleanText(input?.title);
  const body = cleanText(input?.body);
  if (!type || !title || !body) return null;
  const channel = normalizeChannel(input?.channel);
  const targetType = normalizeTargetType(input?.targetType);
  const targetKey = cleanText(input?.targetKey);
  const appUserId = cleanText(input?.appUserId || input?.userId);
  const effectiveTargetKey = targetKey || appUserId;
  const sourceType = cleanText(input?.sourceType || type);
  const sourceId = cleanText(input?.sourceId || input?.id);
  const id = cleanText(input?.id) || notificationIdFor({ type, sourceType, sourceId, targetType, targetKey: effectiveTargetKey, channel });
  return {
    id,
    type,
    channel,
    status: normalizeStatus(input?.status),
    priority: normalizePriority(input?.priority),
    title,
    body,
    appUserId: appUserId || null,
    targetType,
    targetKey: effectiveTargetKey || null,
    sourceType,
    sourceId: sourceId || id,
    symbols: safeSymbols(input?.symbols),
    topics: safeTopics(input?.topics),
    reason: cleanText(input?.reason),
    deepLink: cleanText(input?.deepLink),
    sourceRefs: sourceRefs(input?.sourceRefs),
    scheduledAt: cleanText(input?.scheduledAt) || generatedAt,
    expiresAt: cleanText(input?.expiresAt) || null,
    createdAt: cleanText(input?.createdAt) || generatedAt,
    updatedAt: generatedAt,
    sentAt: cleanText(input?.sentAt) || null,
    provider: cleanText(input?.provider) || null,
    providerMessageId: cleanText(input?.providerMessageId) || null,
    attempts: Number.isFinite(Number(input?.attempts)) ? Math.max(0, Number(input.attempts)) : 0,
    errorMessage: cleanText(input?.errorMessage) || null,
    payload: input?.payload && typeof input.payload === 'object' ? input.payload : {},
  };
}
