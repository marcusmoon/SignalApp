import type { MessageId } from '@/locales/messages';
import type { StoredNotification } from '@/services/notificationHistory';

export type AlertsFilter = 'all' | 'high' | 'signal' | 'system';

export type AlertNotificationKind = 'signal' | 'system' | 'other';

export type AlertNotificationTypeKey =
  | 'today_briefing'
  | 'market_briefing'
  | 'news_digest'
  | 'market_alert'
  | 'earnings_reminder'
  | 'app_update'
  | 'service_notice'
  | 'account'
  | 'test'
  | 'other';

const ALERT_TYPE_MESSAGE_IDS: Record<AlertNotificationTypeKey, MessageId> = {
  today_briefing: 'alertsTypeTodayBriefing',
  market_briefing: 'alertsTypeMarketBriefing',
  news_digest: 'alertsTypeNewsDigest',
  market_alert: 'alertsTypeMarketAlert',
  earnings_reminder: 'alertsTypeEarnings',
  app_update: 'alertsTypeAppUpdate',
  service_notice: 'alertsTypeServiceNotice',
  account: 'alertsTypeAccount',
  test: 'alertsTypeTest',
  other: 'alertsTypeOther',
};

const SIGNAL_TYPES = new Set([
  'market_briefing',
  'today_briefing',
  'news_digest',
  'market_alert',
  'earnings_reminder',
]);

const SIGNAL_SOURCES = new Set(['market_briefing', 'today_briefing', 'news_digest']);

const SYSTEM_TYPES = new Set(['service_notice', 'app_update']);

const SYSTEM_SOURCES = new Set(['app_update', 'admin']);

export function resolveAlertNotificationKind(input: {
  type?: string;
  sourceType?: string;
  title?: string;
  body?: string;
}): AlertNotificationKind {
  const type = String(input.type || '').trim().toLowerCase();
  const source = String(input.sourceType || '').trim().toLowerCase();

  if (SIGNAL_TYPES.has(type) || SIGNAL_SOURCES.has(source)) return 'signal';
  if (
    SYSTEM_TYPES.has(type) ||
    SYSTEM_SOURCES.has(source) ||
    type.includes('account') ||
    source.includes('account')
  ) {
    return 'system';
  }

  const haystack = `${input.title || ''} ${input.body || ''}`.toLowerCase();
  if (/시그널|signal|insight|인사이트|브리핑|briefing|실적|earnings/.test(haystack)) return 'signal';
  if (/공지|notice|업데이트|update|ota|계정|로그인|login|password|비밀번호/.test(haystack)) return 'system';

  return 'other';
}

export function resolveAlertNotificationTypeKey(item: StoredNotification): AlertNotificationTypeKey {
  const type = String(item.type || '').trim().toLowerCase();
  const source = String(item.sourceType || '').trim().toLowerCase();

  if (type === 'today_briefing' || source === 'today_briefing') return 'today_briefing';
  if (type === 'market_briefing' || source === 'market_briefing') return 'market_briefing';
  if (type === 'news_digest' || source === 'news_digest') return 'news_digest';
  if (type === 'market_alert') return 'market_alert';
  if (type === 'earnings_reminder') return 'earnings_reminder';
  if (type === 'app_update' || source === 'app_update') return 'app_update';
  if (type === 'service_notice') return 'service_notice';
  if (source === 'app_user') return 'test';
  if (type.includes('account') || source.includes('account') || source === 'admin') return 'account';

  const kind = resolveAlertNotificationKind(item);
  if (kind === 'system') return 'service_notice';
  return 'other';
}

export function alertTypeMessageId(item: StoredNotification): MessageId {
  return ALERT_TYPE_MESSAGE_IDS[resolveAlertNotificationTypeKey(item)];
}

export function alertMatchesFilter(item: StoredNotification, filter: AlertsFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'high') return item.high;
  const kind = resolveAlertNotificationKind(item);
  if (filter === 'signal') return kind === 'signal';
  if (filter === 'system') return kind === 'system';
  return true;
}
