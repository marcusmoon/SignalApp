import { usePathname } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useLocale } from '@/contexts/LocaleContext';
import { subscribeAlertsUnreadChanged } from '@/services/alertsUnreadPreference';
import { subscribeDisclosureSeenChanged } from '@/services/disclosureUnreadPreference';
import {
  loadNewsUnreadCheckIntervalMinutes,
  newsUnreadCheckIntervalMs,
  subscribeNewsUnreadCheckIntervalChanged,
} from '@/services/newsUnreadCheckIntervalPreference';
import { subscribeNewsSeenChanged } from '@/services/newsUnreadPreference';
import { subscribeSignalSeenChanged } from '@/services/signalUnreadPreference';
import {
  hydrateFeedUnreadBadgesFromCache,
  refreshAllFeedUnreadBadges,
  type FeedUnreadBadges,
  type FeedUnreadSuppress,
} from '@/services/feedUnreadBadges';

type FeedUnreadBadgesContextValue = FeedUnreadBadges & {
  /** 탭 아이콘용 — 해당 화면 포커스 시 숨김 */
  newsTabBadge: boolean;
  signalTabBadge: boolean;
  disclosureTabBadge: boolean;
  moreTabBadge: boolean;
};

const EMPTY: FeedUnreadBadgesContextValue = {
  news: false,
  signal: false,
  disclosure: false,
  alerts: false,
  newsTabBadge: false,
  signalTabBadge: false,
  disclosureTabBadge: false,
  moreTabBadge: false,
};

const FeedUnreadBadgesContext = createContext<FeedUnreadBadgesContextValue>(EMPTY);

function isFocusedTab(pathname: string, tab: 'news' | 'signal' | 'disclosures'): boolean {
  const segment = pathname.split('/').filter(Boolean).at(-1);
  return segment === tab;
}

function buildSuppress(pathname: string): FeedUnreadSuppress {
  return {
    news: isFocusedTab(pathname, 'news'),
    signal: isFocusedTab(pathname, 'signal'),
    disclosure: isFocusedTab(pathname, 'disclosures'),
    alerts: pathname.includes('/alerts'),
  };
}

function toContextValue(badges: FeedUnreadBadges, suppress: FeedUnreadSuppress): FeedUnreadBadgesContextValue {
  return {
    ...badges,
    newsTabBadge: badges.news && !suppress.news,
    signalTabBadge: badges.signal && !suppress.signal,
    disclosureTabBadge: badges.disclosure && !suppress.disclosure,
    moreTabBadge: badges.disclosure && !suppress.disclosure,
  };
}

export function FeedUnreadBadgesProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  const pathname = usePathname();
  const suppress = useMemo(() => buildSuppress(pathname), [pathname]);
  const [badges, setBadges] = useState<FeedUnreadBadges>({
    news: false,
    signal: false,
    disclosure: false,
    alerts: false,
  });

  const applyCached = useCallback(async (patch: Partial<FeedUnreadBadges>) => {
    setBadges((prev) => ({ ...prev, ...patch }));
  }, []);

  const refreshFromServer = useCallback(async () => {
    const next = await refreshAllFeedUnreadBadges(locale, { suppress });
    setBadges(next);
  }, [locale, suppress]);

  useEffect(() => {
    let cancelled = false;

    void hydrateFeedUnreadBadgesFromCache(suppress).then((cached) => {
      if (!cancelled) setBadges(cached);
    });
    void refreshFromServer();

    return () => {
      cancelled = true;
    };
  }, [refreshFromServer, suppress.news, suppress.signal, suppress.disclosure, suppress.alerts]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const startPolling = async () => {
      const minutes = await loadNewsUnreadCheckIntervalMinutes();
      if (cancelled) return;
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => {
        void refreshFromServer();
      }, newsUnreadCheckIntervalMs(minutes));
    };

    void startPolling();

    const unsubscribeNews = subscribeNewsSeenChanged(() => {
      void hydrateFeedUnreadBadgesFromCache({ news: suppress.news }).then((cached) => {
        if (!cancelled) void applyCached({ news: cached.news });
      });
    });
    const unsubscribeSignal = subscribeSignalSeenChanged(() => {
      void hydrateFeedUnreadBadgesFromCache({ signal: suppress.signal }).then((cached) => {
        if (!cancelled) void applyCached({ signal: cached.signal });
      });
    });
    const unsubscribeDisclosure = subscribeDisclosureSeenChanged(() => {
      void hydrateFeedUnreadBadgesFromCache({ disclosure: suppress.disclosure }).then((cached) => {
        if (!cancelled) void applyCached({ disclosure: cached.disclosure });
      });
    });
    const unsubscribeAlerts = subscribeAlertsUnreadChanged(() => {
      void hydrateFeedUnreadBadgesFromCache({ alerts: suppress.alerts }).then((cached) => {
        if (!cancelled) void applyCached({ alerts: cached.alerts });
      });
    });
    const unsubscribeInterval = subscribeNewsUnreadCheckIntervalChanged(() => {
      void startPolling();
    });
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refreshFromServer();
    });

    return () => {
      cancelled = true;
      unsubscribeNews();
      unsubscribeSignal();
      unsubscribeDisclosure();
      unsubscribeAlerts();
      unsubscribeInterval();
      if (pollTimer) clearInterval(pollTimer);
      appStateSub.remove();
    };
  }, [applyCached, refreshFromServer, suppress.alerts, suppress.disclosure, suppress.news, suppress.signal]);

  const value = useMemo(() => toContextValue(badges, suppress), [badges, suppress]);

  return <FeedUnreadBadgesContext.Provider value={value}>{children}</FeedUnreadBadgesContext.Provider>;
}

export function useFeedUnreadBadges(): FeedUnreadBadgesContextValue {
  return useContext(FeedUnreadBadgesContext);
}
