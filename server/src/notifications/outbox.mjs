import { nowIso } from '../db/time.mjs';

export const NOTIFICATION_TYPES = {
  insightSignal: 'insight_signal',
  appUpdate: 'app_update',
  serviceNotice: 'service_notice',
  earningsReminder: 'earnings_reminder',
  marketAlert: 'market_alert',
  marketBriefing: 'market_briefing',
  todayBriefing: 'today_briefing',
  newsDigest: 'news_digest',
};

const SEND_STATE_STATUSES = new Set(['sending', 'sent', 'failed', 'cancelled', 'skipped']);

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

export function notificationFromInsight(insight, generatedAt = nowIso()) {
  if (!insight?.pushCandidate) return null;
  const title = cleanText(insight.pushTitle || insight.title);
  const body = cleanText(insight.pushBody || insight.summary);
  if (!title || !body) return null;
  const insightId = cleanText(insight.id);
  if (!insightId) return null;
  return createNotificationItem({
    id: `notification:push:insight:${insightId}`,
    type: NOTIFICATION_TYPES.insightSignal,
    title,
    body,
    channel: 'push',
    status: 'queued',
    priority: insight.pushPriority || (insight.level === 'alert' ? 'high' : 'normal'),
    targetType: 'watchlist',
    sourceType: 'insight',
    sourceId: insightId,
    symbols: safeSymbols(insight.symbols),
    topics: safeTopics(insight.topics),
    reason: cleanText(insight.pushReason),
    deepLink: '/signal',
    sourceRefs: sourceRefs(insight.sourceRefs),
    scheduledAt: insight.generatedAt || generatedAt,
    expiresAt: insight.expiresAt || null,
    payload: {
      insightId,
      level: insight.level || null,
      score: Number.isFinite(Number(insight.score)) ? Number(insight.score) : null,
      generatedAt: insight.generatedAt || null,
    },
  }, generatedAt);
}

export function notificationFromAppUpdate(update, generatedAt = nowIso()) {
  const version = cleanText(update?.version || update?.runtimeVersion || update?.buildNumber || 'latest');
  return createNotificationItem({
    id: update?.id ? `notification:push:app_update:${cleanText(update.id)}` : `notification:push:app_update:${version}`,
    type: NOTIFICATION_TYPES.appUpdate,
    channel: update?.channel || 'push',
    status: update?.status || 'queued',
    priority: update?.priority || 'normal',
    title: update?.title || 'SIGNAL 업데이트',
    body: update?.body || '새 버전이 준비되었습니다.',
    targetType: update?.targetType || 'all',
    targetKey: update?.targetKey || null,
    sourceType: 'app_update',
    sourceId: update?.id || version,
    deepLink: update?.deepLink || '/settings',
    scheduledAt: update?.scheduledAt || generatedAt,
    expiresAt: update?.expiresAt || null,
    payload: {
      version,
      runtimeVersion: update?.runtimeVersion || null,
      buildNumber: update?.buildNumber || null,
      releaseNotes: update?.releaseNotes || '',
    },
  }, generatedAt);
}

export function notificationsFromInsights(insights, generatedAt = nowIso()) {
  return (Array.isArray(insights) ? insights : [])
    .map((insight) => notificationFromInsight(insight, generatedAt))
    .filter(Boolean);
}

export function upsertNotificationItem(items, next) {
  if (!next?.id) return items;
  const index = items.findIndex((item) => item.id === next.id);
  if (index < 0) {
    items.unshift(next);
    return items;
  }
  const previous = items[index];
  const preserveSendState = SEND_STATE_STATUSES.has(String(previous.status || 'queued'));
  items[index] = {
    ...previous,
    ...next,
    status: preserveSendState ? previous.status : next.status,
    sentAt: preserveSendState ? previous.sentAt : next.sentAt,
    provider: preserveSendState ? previous.provider : next.provider,
    providerMessageId: preserveSendState ? previous.providerMessageId : next.providerMessageId,
    attempts: preserveSendState ? previous.attempts : next.attempts,
    errorMessage: preserveSendState ? previous.errorMessage : next.errorMessage,
    createdAt: previous.createdAt || next.createdAt,
    updatedAt: next.updatedAt,
  };
  return items;
}
