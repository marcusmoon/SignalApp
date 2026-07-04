import type { StoredNotification } from '@/services/notificationHistory';

function normalizeDeepLink(path: string): string | null {
  const raw = String(path || '').trim();
  if (!raw || raw === '/alerts') return null;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const next = `${url.pathname}${url.search}`;
      return next === '/alerts' ? null : next;
    } catch {
      return null;
    }
  }
  const next = raw.startsWith('/') ? raw : `/${raw}`;
  return next === '/alerts' ? null : next;
}

function fallbackHrefFromNotification(item: StoredNotification): string | null {
  const type = String(item.type || '').trim().toLowerCase();
  const source = String(item.sourceType || '').trim().toLowerCase();

  if (type === 'today_briefing' || source === 'today_briefing') return '/today-briefing';
  if (type === 'news_digest' || source === 'news_digest') return '/news-issues';
  if (
    type === 'market_briefing' ||
    source === 'market_briefing' ||
    type === 'insight_signal' ||
    source === 'insight' ||
    type === 'market_alert'
  ) {
    return '/signal';
  }
  if (type === 'earnings_reminder') return '/calendar';
  if (type === 'app_update' || source === 'app_update') return '/settings';
  if (type.includes('account') || source.includes('account') || source === 'app_user') return '/account';

  return null;
}

/** Returns an in-app route to open, or null when the alert has no destination. */
export function resolveAlertHref(item: StoredNotification): string | null {
  const fromDeepLink = normalizeDeepLink(item.deepLink || '');
  if (fromDeepLink) return fromDeepLink;
  return fallbackHrefFromNotification(item);
}
