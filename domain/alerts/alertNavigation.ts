import type { Href } from 'expo-router';

import type { NewsIssuesCategory, SignalSessionKey } from '@/constants/ipadHomeNav';
import type { StoredNotification } from '@/services/notificationHistory';
import { toYmd } from '@/utils/date';

export type AlertNavigationTarget = {
  pathname: string;
  params?: Record<string, string>;
};

const SIGNAL_TAB_KEYS = new Set<SignalSessionKey>([
  'us-overnight',
  'kr-morning',
  'kr-lunch',
  'kr-close',
]);

type AlertIpadNav = {
  isAvailable: boolean;
  showNewsIssues: (params: { category: NewsIssuesCategory; date: string; digestId?: string | null }) => void;
  showSignalTab: (session?: SignalSessionKey, date?: string) => void;
  showTodayBriefing: (date: string) => void;
};

function cleanText(value: unknown): string {
  return String(value ?? '').trim();
}

function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function utcYmdFromIso(iso: string): string | null {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function isSignalSessionKey(value: string): value is SignalSessionKey {
  return SIGNAL_TAB_KEYS.has(value as SignalSessionKey);
}

function normalizeSignalSessionParam(value: string): SignalSessionKey | null {
  const session = cleanText(value).toLowerCase();
  if (isSignalSessionKey(session)) return session;
  if (session === 'us-close') return 'us-overnight';
  return null;
}

function marketSessionTabKey(market?: string, session?: string): SignalSessionKey | null {
  const m = cleanText(market).toLowerCase();
  const s = cleanText(session).toLowerCase();
  if (m === 'us' && s === 'overnight') return 'us-overnight';
  if (m === 'kr' && s === 'morning') return 'kr-morning';
  if (m === 'kr' && s === 'lunch') return 'kr-lunch';
  if (m === 'kr' && (s === 'close' || s === 'evening')) return 'kr-close';
  if (m === 'us' && s === 'close') return 'us-overnight';
  return null;
}

function parseDeepLink(path: string): AlertNavigationTarget | null {
  const raw = cleanText(path);
  if (!raw || raw === '/alerts') return null;

  let pathname = raw;
  let search = '';
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      pathname = url.pathname;
      search = url.search;
    } catch {
      return null;
    }
  } else {
    const qIndex = raw.indexOf('?');
    if (qIndex >= 0) {
      pathname = raw.slice(0, qIndex);
      search = raw.slice(qIndex);
    }
  }

  if (pathname === '/alerts') return null;

  const params: Record<string, string> = {};
  if (search) {
    const query = search.startsWith('?') ? search.slice(1) : search;
    for (const [key, value] of new URLSearchParams(query)) {
      if (value) params[key] = value;
    }
  }

  return {
    pathname: pathname.startsWith('/') ? pathname : `/${pathname}`,
    params: Object.keys(params).length ? params : undefined,
  };
}

function notificationPayload(item: StoredNotification): Record<string, unknown> {
  return item.payload && typeof item.payload === 'object' ? item.payload : {};
}

function payloadDate(payload: Record<string, unknown>, receivedAt: string): string | null {
  for (const key of ['briefingDate', 'generatedDate', 'date']) {
    const value = cleanText(payload[key]).slice(0, 10);
    if (isYmd(value)) return value;
  }
  return utcYmdFromIso(receivedAt);
}

function enrichNewsIssuesTarget(
  target: AlertNavigationTarget,
  item: StoredNotification,
): AlertNavigationTarget {
  const payload = notificationPayload(item);
  const params = { ...(target.params || {}) };
  if (!isYmd(params.date || '')) {
    const date = payloadDate(payload, item.receivedAt);
    if (date) params.date = date;
  }
  if (!cleanText(params.category)) {
    params.category = cleanText(payload.category) || 'global';
  }
  if (!cleanText(params.digestId)) {
    const digestId = cleanText(payload.digestId) || cleanText(item.sourceId);
    if (digestId) params.digestId = digestId;
  }
  return { pathname: '/news-issues', params };
}

function enrichDisclosureFlowTarget(
  target: AlertNavigationTarget,
  item: StoredNotification,
): AlertNavigationTarget {
  const payload = notificationPayload(item);
  const params = { ...(target.params || {}) };
  if (!isYmd(params.date || '')) {
    const date = payloadDate(payload, item.receivedAt);
    if (date) params.date = date;
  }
  if (!cleanText(params.market)) {
    params.market = cleanText(payload.market) || 'us';
  }
  if (!cleanText(params.digestId)) {
    const digestId = cleanText(payload.digestId) || cleanText(item.sourceId);
    if (digestId) params.digestId = digestId;
  }
  return { pathname: '/disclosure-flow', params };
}

function enrichTodayBriefingTarget(
  target: AlertNavigationTarget,
  item: StoredNotification,
): AlertNavigationTarget {
  const payload = notificationPayload(item);
  const params = { ...(target.params || {}) };
  if (!isYmd(params.date || '')) {
    const date = payloadDate(payload, item.receivedAt);
    if (date) params.date = date;
  }
  return { pathname: '/today-briefing', params: Object.keys(params).length ? params : undefined };
}

function enrichSignalTarget(
  target: AlertNavigationTarget,
  item: StoredNotification,
): AlertNavigationTarget {
  const payload = notificationPayload(item);
  const params = { ...(target.params || {}) };
  if (!isYmd(params.date || '')) {
    const date = payloadDate(payload, item.receivedAt);
    if (date) params.date = date;
  }
  const fromParams = normalizeSignalSessionParam(params.session || '');
  if (fromParams) {
    params.session = fromParams;
  } else {
    delete params.session;
    const tabKey = marketSessionTabKey(cleanText(payload.market), cleanText(payload.session));
    if (tabKey) params.session = tabKey;
  }
  return { pathname: '/(tabs)/signal', params: Object.keys(params).length ? params : undefined };
}

function enrichTarget(item: StoredNotification, target: AlertNavigationTarget): AlertNavigationTarget {
  const pathname = target.pathname.replace(/\/$/, '') || target.pathname;
  if (pathname === '/home' || pathname === '/(tabs)' || pathname === '/(tabs)/index') {
    return enrichTodayBriefingTarget({ pathname: '/today-briefing' }, item);
  }
  if (pathname === '/news-issues') return enrichNewsIssuesTarget({ ...target, pathname }, item);
  if (pathname === '/disclosure-flow') return enrichDisclosureFlowTarget({ ...target, pathname }, item);
  if (pathname === '/today-briefing') return enrichTodayBriefingTarget({ ...target, pathname }, item);
  if (pathname === '/signal' || pathname === '/(tabs)/signal') return enrichSignalTarget(target, item);
  return target;
}

function fallbackTargetFromNotification(item: StoredNotification): AlertNavigationTarget | null {
  const type = cleanText(item.type).toLowerCase();
  const source = cleanText(item.sourceType).toLowerCase();

  if (type === 'today_briefing' || source === 'today_briefing') {
    return enrichTodayBriefingTarget({ pathname: '/today-briefing' }, item);
  }
  if (type === 'news_digest' || source === 'news_digest') {
    return enrichNewsIssuesTarget({ pathname: '/news-issues' }, item);
  }
  if (type === 'disclosure_digest' || source === 'disclosure_digest') {
    return enrichDisclosureFlowTarget({ pathname: '/disclosure-flow' }, item);
  }
  if (
    type === 'market_briefing' ||
    source === 'market_briefing' ||
    type === 'market_alert'
  ) {
    return enrichSignalTarget({ pathname: '/(tabs)/signal' }, item);
  }
  if (type === 'earnings_reminder') return { pathname: '/calendar' };
  if (type === 'app_update' || source === 'app_update') return { pathname: '/settings' };
  if (type.includes('account') || source.includes('account') || source === 'app_user') {
    return { pathname: '/account' };
  }

  return null;
}

/** Returns an in-app route target with date-aware params when available. */
export function resolveAlertNavigationTarget(item: StoredNotification): AlertNavigationTarget | null {
  const fromDeepLink = parseDeepLink(item.deepLink || '');
  if (fromDeepLink) return enrichTarget(item, fromDeepLink);
  return fallbackTargetFromNotification(item);
}

/** Returns an in-app route string to open, or null when the alert has no destination. */
export function resolveAlertHref(item: StoredNotification): string | null {
  const target = resolveAlertNavigationTarget(item);
  if (!target) return null;
  const qs = target.params ? new URLSearchParams(target.params).toString() : '';
  return qs ? `${target.pathname}?${qs}` : target.pathname;
}

/** 알림 카드 탭 — iPad 사이드바·탭 라우트 패턴과 동일하게 이동 */
export function navigateToAlert(
  router: { push: (href: Href) => void; navigate: (href: Href) => void },
  ipadNav: AlertIpadNav,
  item: StoredNotification,
): void {
  const target = resolveAlertNavigationTarget(item);
  if (!target) return;

  const params = target.params ?? {};

  if (target.pathname === '/news-issues') {
    const date = isYmd(params.date || '') ? params.date! : toYmd(new Date());
    const category = (cleanText(params.category) || 'global') as NewsIssuesCategory;
    const digestId = cleanText(params.digestId) || null;
    if (ipadNav.isAvailable) {
      ipadNav.showNewsIssues({ category, date, digestId });
      return;
    }
    router.push({
      pathname: '/news-issues',
      params: { category, date, ...(digestId ? { digestId } : {}) },
    } as Href);
    return;
  }

  if (target.pathname === '/(tabs)/signal') {
    const date = isYmd(params.date || '') ? params.date : undefined;
    const session = normalizeSignalSessionParam(params.session || '') ?? undefined;
    if (ipadNav.isAvailable) {
      ipadNav.showSignalTab(session, date);
      return;
    }
    router.navigate({
      pathname: '/(tabs)/signal',
      params: { ...(date ? { date } : {}), ...(session ? { session } : {}) },
    } as never);
    return;
  }

  if (target.pathname === '/today-briefing') {
    const date = isYmd(params.date || '') ? params.date! : toYmd(new Date());
    if (ipadNav.isAvailable) {
      ipadNav.showTodayBriefing(date);
      return;
    }
    router.push({
      pathname: '/today-briefing',
      params: { date },
    } as Href);
    return;
  }

  if (Object.keys(params).length > 0) {
    router.push({ pathname: target.pathname, params } as Href);
    return;
  }
  router.push(target.pathname as Href);
}
