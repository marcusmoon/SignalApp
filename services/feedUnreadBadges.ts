import {
  loadAlertsUnreadCached,
  refreshAlertsUnreadFromServer,
} from '@/services/alertsUnreadPreference';
import {
  loadDisclosureUnreadCached,
  refreshDisclosureUnreadFromServer,
} from '@/services/disclosureUnreadPreference';
import { hasSignalApi } from '@/services/env';
import {
  loadNewsUnreadCached,
  refreshNewsUnreadFromServer,
} from '@/services/newsUnreadPreference';
import {
  loadSignalUnreadCached,
  refreshSignalUnreadFromServer,
} from '@/services/signalUnreadPreference';

export type FeedUnreadBadges = {
  news: boolean;
  signal: boolean;
  disclosure: boolean;
  alerts: boolean;
};

export type FeedUnreadSuppress = {
  news?: boolean;
  signal?: boolean;
  disclosure?: boolean;
  alerts?: boolean;
};

const EMPTY_BADGES: FeedUnreadBadges = {
  news: false,
  signal: false,
  disclosure: false,
  alerts: false,
};

async function resolveUnread(
  suppressed: boolean | undefined,
  refresh: () => Promise<boolean>,
  loadCached: () => Promise<boolean | null>,
): Promise<boolean> {
  if (suppressed) return false;
  try {
    return await refresh();
  } catch {
    const cached = await loadCached();
    return cached ?? false;
  }
}

/** AsyncStorage 캐시만 읽어 즉시 표시용 상태를 만든다. */
export async function hydrateFeedUnreadBadgesFromCache(
  suppress?: FeedUnreadSuppress,
): Promise<FeedUnreadBadges> {
  if (!hasSignalApi()) return EMPTY_BADGES;

  const [newsCached, signalCached, disclosureCached, alertsCached] = await Promise.all([
    suppress?.news ? Promise.resolve(null) : loadNewsUnreadCached(),
    suppress?.signal ? Promise.resolve(null) : loadSignalUnreadCached(),
    suppress?.disclosure ? Promise.resolve(null) : loadDisclosureUnreadCached(),
    suppress?.alerts ? Promise.resolve(null) : loadAlertsUnreadCached(),
  ]);

  return {
    news: newsCached === true,
    signal: signalCached === true,
    disclosure: disclosureCached === true,
    alerts: alertsCached === true,
  };
}

/** 뉴스·시그널·공시·알림함 미읽음을 한 번에 서버와 비교한다. */
export async function refreshAllFeedUnreadBadges(
  locale: string,
  options?: { suppress?: FeedUnreadSuppress; force?: boolean },
): Promise<FeedUnreadBadges> {
  if (!hasSignalApi()) return EMPTY_BADGES;

  const suppress = options?.suppress;
  const force = options?.force;

  const [news, signal, disclosure, alerts] = await Promise.all([
    resolveUnread(
      suppress?.news,
      () => refreshNewsUnreadFromServer(locale, { force }),
      loadNewsUnreadCached,
    ),
    resolveUnread(
      suppress?.signal,
      () => refreshSignalUnreadFromServer({ force }),
      loadSignalUnreadCached,
    ),
    resolveUnread(
      suppress?.disclosure,
      () => refreshDisclosureUnreadFromServer({ force }),
      loadDisclosureUnreadCached,
    ),
    resolveUnread(
      suppress?.alerts,
      () => refreshAlertsUnreadFromServer({ force }),
      loadAlertsUnreadCached,
    ),
  ]);

  return { news, signal, disclosure, alerts };
}

/** 백그라운드 fetch·앱 전환 시 — 탭 포커스 억제 없이 전부 갱신 */
export async function refreshFeedUnreadBadgesInBackground(locale: string): Promise<void> {
  await refreshAllFeedUnreadBadges(locale);
}
