import type { StoredNotification } from '@/services/notificationHistory';

export type AlertsFilter = 'all' | 'high' | 'signal' | 'notice' | 'account';

export type AlertNotificationKind = 'signal' | 'notice' | 'account' | 'other';

const SIGNAL_TYPES = new Set([
  'insight_signal',
  'market_briefing',
  'market_alert',
  'earnings_reminder',
]);

const NOTICE_TYPES = new Set(['service_notice', 'app_update']);

const SIGNAL_SOURCES = new Set(['insight', 'market_briefing']);

const NOTICE_SOURCES = new Set(['app_update', 'app_user']);

export function resolveAlertNotificationKind(input: {
  type?: string;
  sourceType?: string;
  title?: string;
  body?: string;
}): AlertNotificationKind {
  const type = String(input.type || '').trim().toLowerCase();
  const source = String(input.sourceType || '').trim().toLowerCase();

  if (SIGNAL_TYPES.has(type) || SIGNAL_SOURCES.has(source)) return 'signal';
  if (NOTICE_TYPES.has(type) || NOTICE_SOURCES.has(source)) return 'notice';
  if (type.includes('account') || source.includes('account')) return 'account';

  const haystack = `${input.title || ''} ${input.body || ''}`.toLowerCase();
  if (/계정|로그인|login|password|비밀번호|email change|이메일 변경/.test(haystack)) return 'account';
  if (/시그널|signal|insight|인사이트|브리핑|briefing|실적/.test(haystack)) return 'signal';
  if (/공지|notice|업데이트|update|ota/.test(haystack)) return 'notice';

  return 'other';
}

export function alertMatchesFilter(item: StoredNotification, filter: AlertsFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'high') return item.high;
  const kind = resolveAlertNotificationKind(item);
  if (filter === 'signal') return kind === 'signal';
  if (filter === 'notice') return kind === 'notice';
  if (filter === 'account') return kind === 'account';
  return true;
}
