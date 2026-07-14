import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { isSettingsTab, type SettingsTab } from '@/constants/settingsTabs';
import type { SignalSessionKey } from '@/constants/ipadHomeNav';
import type { DisclosureFlowMarket, NewsIssuesCategory } from '@/constants/ipadHomeNav';
import type { NewsSegmentKey } from '@/constants/newsSegment';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { resolveIpadContentPaneFromPathname } from '@/utils/ipadContentPaneFromPath';
import {
  isWideHomePath,
  isWideOverlayKind,
  legacyPathnameToOverlayKind,
  overlayKindToContentPane,
  overlayParamsFromRecord,
  WIDE_HOME_ROUTE,
  type WideOverlayKind,
} from '@/utils/wideOverlayRoute';

export type YoutubeSortKey = 'latest' | 'popular';

export type IpadContentPane =
  | 'home'
  | 'tabs'
  | 'account'
  | 'settings'
  | 'newsIssues'
  | 'disclosureFlow'
  | 'todayBriefing'
  | 'calendar'
  | 'alerts'
  | 'termsHistory';

export type IpadNewsIssuesPaneParams = {
  category: NewsIssuesCategory;
  date: string;
  digestId?: string | null;
};
export type IpadDisclosureFlowPaneParams = {
  date: string;
  market?: DisclosureFlowMarket;
  digestId?: string | null;
};

type IpadSidebarNavContextValue = {
  isAvailable: boolean;
  contentPane: IpadContentPane;
  isHomePaneActive: boolean;
  isAccountPaneActive: boolean;
  isSettingsPaneActive: boolean;
  settingsTab: SettingsTab;
  youtubeSort: YoutubeSortKey;
  newsIssuesParams: IpadNewsIssuesPaneParams | null;
  disclosureFlowParams: IpadDisclosureFlowPaneParams | null;
  todayBriefingDate: string | null;
  calendarFromAccount: boolean;
  alertsFromAccount: boolean;
  showHome: () => void;
  showAccount: () => void;
  showTabs: () => void;
  showSettings: (tab?: SettingsTab) => void;
  showNewsIssues: (params: IpadNewsIssuesPaneParams) => void;
  showDisclosureFlow: (params: IpadDisclosureFlowPaneParams) => void;
  showTodayBriefing: (date: string) => void;
  showCalendar: (options?: { from?: 'account' }) => void;
  showAlerts: (options?: { from?: 'account' }) => void;
  showTermsHistory: () => void;
  showYoutubeTab: (sort?: YoutubeSortKey) => void;
  showNewsTab: (segment?: NewsSegmentKey) => void;
  showSignalTab: (session?: SignalSessionKey, date?: string) => void;
  takePendingNewsSegment: () => NewsSegmentKey | null;
  takePendingSignalSession: () => SignalSessionKey | null;
  takePendingSignalDate: () => string | null;
};

const IpadSidebarNavContext = createContext<IpadSidebarNavContextValue>({
  isAvailable: false,
  contentPane: 'tabs',
  isHomePaneActive: false,
  isAccountPaneActive: false,
  isSettingsPaneActive: false,
  settingsTab: 'display',
  youtubeSort: 'latest',
  newsIssuesParams: null,
  disclosureFlowParams: null,
  todayBriefingDate: null,
  calendarFromAccount: false,
  alertsFromAccount: false,
  showHome: () => {},
  showAccount: () => {},
  showTabs: () => {},
  showSettings: () => {},
  showNewsIssues: () => {},
  showDisclosureFlow: () => {},
  showTodayBriefing: () => {},
  showCalendar: () => {},
  showAlerts: () => {},
  showTermsHistory: () => {},
  showYoutubeTab: () => {},
  showNewsTab: () => {},
  showSignalTab: () => {},
  takePendingNewsSegment: () => null,
  takePendingSignalSession: () => null,
  takePendingSignalDate: () => null,
});

function firstParam(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const text = String(raw || '').trim();
  return text || undefined;
}

function parseYoutubeSortParam(raw: string | undefined): YoutubeSortKey | null {
  if (raw === 'popular' || raw === 'latest') return raw;
  return null;
}

function parseNewsIssuesCategory(raw: string | undefined): NewsIssuesCategory {
  if (raw === 'us') return 'global';
  if (raw === 'kr') return 'korea';
  if (raw === 'global' || raw === 'korea' || raw === 'crypto' || raw === 'all') return raw;
  return 'all';
}

function parseDisclosureMarket(raw: string | undefined): DisclosureFlowMarket | undefined {
  if (raw === 'us' || raw === 'kr') return raw;
  return undefined;
}

function parseDateParam(raw: string | undefined): string | undefined {
  const text = String(raw || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

export function IpadSidebarNavProvider({ children }: { children: ReactNode }) {
  const { useTwoPane } = useResponsiveLayout();
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{
    overlay?: string | string[];
    pane?: string | string[];
    tab?: string | string[];
    from?: string | string[];
    sort?: string | string[];
    category?: string | string[];
    date?: string | string[];
    digestId?: string | string[];
    market?: string | string[];
  }>();
  const [contentPane, setContentPane] = useState<IpadContentPane>(() =>
    resolveIpadContentPaneFromPathname(pathname),
  );
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(() => {
    const tab = firstParam(params.tab);
    return isSettingsTab(tab) ? tab : 'display';
  });
  const [youtubeSort, setYoutubeSort] = useState<YoutubeSortKey>(() => {
    return parseYoutubeSortParam(firstParam(params.sort)) ?? 'latest';
  });
  const [newsIssuesParams, setNewsIssuesParams] = useState<IpadNewsIssuesPaneParams | null>(null);
  const [disclosureFlowParams, setDisclosureFlowParams] = useState<IpadDisclosureFlowPaneParams | null>(null);
  const [todayBriefingDate, setTodayBriefingDate] = useState<string | null>(null);
  const [calendarFromAccount, setCalendarFromAccount] = useState(false);
  const [alertsFromAccount, setAlertsFromAccount] = useState(false);
  const pendingNewsSegmentRef = useRef<NewsSegmentKey | null>(null);
  const pendingSignalSessionRef = useRef<SignalSessionKey | null>(null);
  const pendingSignalDateRef = useRef<string | null>(null);
  const youtubeSortRef = useRef(youtubeSort);
  youtubeSortRef.current = youtubeSort;

  const applyOverlayKind = useCallback(
    (kind: WideOverlayKind, rawParams: Record<string, string | string[] | undefined>) => {
      const p = overlayParamsFromRecord(rawParams);
      const pane = overlayKindToContentPane(kind);
      setContentPane(pane);

      if (kind === 'news-issues') {
        const date = parseDateParam(p.date);
        if (date) {
          setNewsIssuesParams({
            category: parseNewsIssuesCategory(p.category),
            date,
            digestId: p.digestId ?? null,
          });
        }
        return;
      }

      if (kind === 'disclosure-flow') {
        const date = parseDateParam(p.date);
        if (date) {
          setDisclosureFlowParams({
            date,
            market: parseDisclosureMarket(p.market),
            digestId: p.digestId ?? null,
          });
        }
        return;
      }

      if (kind === 'today-briefing') {
        setTodayBriefingDate(parseDateParam(p.date) ?? null);
        return;
      }

      if (kind === 'calendar') {
        setCalendarFromAccount(p.from === 'account');
        return;
      }

      if (kind === 'alerts') {
        setAlertsFromAccount(p.from === 'account');
        return;
      }

      if (kind === 'settings') {
        const tab = firstParam(p.tab);
        if (isSettingsTab(tab)) setSettingsTab(tab);
        return;
      }

      if (kind === 'account') {
        setCalendarFromAccount(false);
        setAlertsFromAccount(false);
      }
    },
    [],
  );

  const navigateWideOverlay = useCallback(
    (kind: WideOverlayKind, overlayParams: Record<string, string | undefined>) => {
      applyOverlayKind(kind, overlayParams);
      router.navigate({
        pathname: WIDE_HOME_ROUTE,
        params: { overlay: kind, ...overlayParams },
      } as never);
    },
    [applyOverlayKind, router],
  );

  useEffect(() => {
    if (!useTwoPane) return;

    const legacyOverlay = legacyPathnameToOverlayKind(pathname);
    if (legacyOverlay && !isWideHomePath(pathname)) {
      applyOverlayKind(legacyOverlay, params);
      return;
    }

    if (isWideHomePath(pathname)) {
      const overlay = firstParam(params.overlay);
      if (isWideOverlayKind(overlay)) {
        applyOverlayKind(overlay, params);
        return;
      }
      setContentPane('home');
      return;
    }

    const pane = resolveIpadContentPaneFromPathname(pathname);
    setContentPane(pane);

    const tab = firstParam(params.tab);
    if (isSettingsTab(tab)) setSettingsTab(tab);

    if (pathname.includes('/youtube')) {
      const sort = parseYoutubeSortParam(firstParam(params.sort));
      if (sort) setYoutubeSort(sort);
    }

    if (pane === 'newsIssues') {
      const date = parseDateParam(firstParam(params.date));
      if (date) {
        setNewsIssuesParams({
          category: parseNewsIssuesCategory(firstParam(params.category)),
          date,
          digestId: firstParam(params.digestId) ?? null,
        });
      }
    }

    if (pane === 'disclosureFlow') {
      const date = parseDateParam(firstParam(params.date));
      if (date) {
        setDisclosureFlowParams({
          date,
          market: parseDisclosureMarket(firstParam(params.market)),
          digestId: firstParam(params.digestId) ?? null,
        });
      }
    }
  }, [
    applyOverlayKind,
    params.category,
    params.date,
    params.digestId,
    params.from,
    params.market,
    params.overlay,
    params.pane,
    params.tab,
    params.sort,
    pathname,
    useTwoPane,
  ]);

  const showHome = useCallback(() => {
    setContentPane('home');
    if (isWideHomePath(pathname) && !firstParam(params.overlay)) return;
    if (useTwoPane) {
      router.navigate(WIDE_HOME_ROUTE as never);
      return;
    }
    if (pathname.includes('/home')) return;
    router.navigate(WIDE_HOME_ROUTE as never);
  }, [params.overlay, pathname, router, useTwoPane]);

  const showAccount = useCallback(() => {
    if (useTwoPane) {
      navigateWideOverlay('account', { pane: 'hub' });
      return;
    }
    setContentPane('account');
    if (pathname.startsWith('/account')) return;
    router.navigate({ pathname: '/account', params: { pane: 'hub' } } as never);
  }, [navigateWideOverlay, pathname, router, useTwoPane]);

  const showTabs = useCallback(() => {
    setContentPane('tabs');
  }, []);

  const showSettings = useCallback(
    (tab: SettingsTab = 'display') => {
      setSettingsTab(tab);
      if (useTwoPane) {
        navigateWideOverlay('settings', { tab, from: 'account' });
        return;
      }
      setContentPane('settings');
      router.navigate({ pathname: '/settings', params: { tab, from: 'account' } } as never);
    },
    [navigateWideOverlay, router, useTwoPane],
  );

  const showNewsIssues = useCallback(
    (next: IpadNewsIssuesPaneParams) => {
      setNewsIssuesParams(next);
      if (useTwoPane) {
        navigateWideOverlay('news-issues', {
          category: next.category,
          date: next.date,
          ...(next.digestId ? { digestId: next.digestId } : {}),
        });
        return;
      }
      setContentPane('newsIssues');
      router.navigate({
        pathname: '/news-issues',
        params: {
          category: next.category,
          date: next.date,
          ...(next.digestId ? { digestId: next.digestId } : null),
        },
      } as never);
    },
    [navigateWideOverlay, router, useTwoPane],
  );

  const showDisclosureFlow = useCallback(
    (next: IpadDisclosureFlowPaneParams) => {
      setDisclosureFlowParams(next);
      if (useTwoPane) {
        navigateWideOverlay('disclosure-flow', {
          date: next.date,
          ...(next.market ? { market: next.market } : {}),
          ...(next.digestId ? { digestId: next.digestId } : {}),
        });
        return;
      }
      setContentPane('disclosureFlow');
      router.navigate({
        pathname: '/disclosure-flow',
        params: {
          date: next.date,
          ...(next.market ? { market: next.market } : null),
          ...(next.digestId ? { digestId: next.digestId } : null),
        },
      } as never);
    },
    [navigateWideOverlay, router, useTwoPane],
  );

  const showTodayBriefing = useCallback(
    (date: string) => {
      setTodayBriefingDate(date);
      if (useTwoPane) {
        navigateWideOverlay('today-briefing', { date });
        return;
      }
      router.navigate({ pathname: '/today-briefing', params: { date } } as never);
    },
    [navigateWideOverlay, router, useTwoPane],
  );

  const showCalendar = useCallback(
    (options?: { from?: 'account' }) => {
      const fromAccount = options?.from === 'account';
      setCalendarFromAccount(fromAccount);
      if (useTwoPane) {
        navigateWideOverlay('calendar', fromAccount ? { from: 'account' } : {});
        return;
      }
      router.navigate({
        pathname: '/calendar',
        params: fromAccount ? { from: 'account' } : {},
      } as never);
    },
    [navigateWideOverlay, router, useTwoPane],
  );

  const showAlerts = useCallback(
    (options?: { from?: 'account' }) => {
      const fromAccount = options?.from === 'account';
      setAlertsFromAccount(fromAccount);
      if (useTwoPane) {
        navigateWideOverlay('alerts', fromAccount ? { from: 'account' } : {});
        return;
      }
      router.navigate({
        pathname: '/alerts',
        params: fromAccount ? { from: 'account' } : {},
      } as never);
    },
    [navigateWideOverlay, router, useTwoPane],
  );

  const showTermsHistory = useCallback(() => {
    if (useTwoPane) {
      navigateWideOverlay('terms-history', { from: 'account' });
      return;
    }
    router.navigate('/terms-history' as never);
  }, [navigateWideOverlay, router, useTwoPane]);

  const showYoutubeTab = useCallback(
    (sort?: YoutubeSortKey) => {
      const next = sort ?? youtubeSortRef.current;
      const onYoutube = pathname.includes('/youtube');
      if (onYoutube && next === youtubeSortRef.current) {
        setContentPane('tabs');
        return;
      }
      setYoutubeSort(next);
      setContentPane('tabs');
      if (onYoutube) {
        router.setParams({ sort: next });
        return;
      }
      router.navigate({
        pathname: '/(tabs)/youtube',
        params: { sort: next },
      } as never);
    },
    [router, pathname],
  );

  const showNewsTab = useCallback(
    (segment?: NewsSegmentKey) => {
      if (segment) pendingNewsSegmentRef.current = segment;
      setContentPane('tabs');
      router.navigate({
        pathname: '/(tabs)/news',
        params: segment && segment !== 'video' ? { segment } : { segment: 'global' },
      } as never);
    },
    [router],
  );

  const showSignalTab = useCallback(
    (session?: SignalSessionKey, date?: string) => {
      if (session) pendingSignalSessionRef.current = session;
      if (date) pendingSignalDateRef.current = date;
      setContentPane('tabs');
      router.navigate({
        pathname: '/(tabs)/signal',
        params: {
          ...(session ? { session } : null),
          ...(date ? { date } : null),
        },
      } as never);
    },
    [router],
  );

  const takePendingNewsSegment = useCallback(() => {
    const segment = pendingNewsSegmentRef.current;
    pendingNewsSegmentRef.current = null;
    return segment;
  }, []);

  const takePendingSignalSession = useCallback(() => {
    const session = pendingSignalSessionRef.current;
    pendingSignalSessionRef.current = null;
    return session;
  }, []);

  const takePendingSignalDate = useCallback(() => {
    const date = pendingSignalDateRef.current;
    pendingSignalDateRef.current = null;
    return date;
  }, []);

  const isHomePaneActive =
    contentPane === 'home' ||
    contentPane === 'newsIssues' ||
    contentPane === 'disclosureFlow' ||
    contentPane === 'todayBriefing' ||
    (contentPane === 'calendar' && !calendarFromAccount);

  const isAccountPaneActive =
    contentPane === 'account' ||
    contentPane === 'settings' ||
    contentPane === 'alerts' ||
    contentPane === 'termsHistory' ||
    (contentPane === 'calendar' && calendarFromAccount);

  const value = useMemo(
    () => ({
      isAvailable: useTwoPane,
      contentPane,
      isHomePaneActive,
      isAccountPaneActive,
      isSettingsPaneActive: contentPane === 'settings',
      settingsTab,
      youtubeSort,
      newsIssuesParams,
      disclosureFlowParams,
      todayBriefingDate,
      calendarFromAccount,
      alertsFromAccount,
      showHome,
      showAccount,
      showTabs,
      showSettings,
      showNewsIssues,
      showDisclosureFlow,
      showTodayBriefing,
      showCalendar,
      showAlerts,
      showTermsHistory,
      showYoutubeTab,
      showNewsTab,
      showSignalTab,
      takePendingNewsSegment,
      takePendingSignalSession,
      takePendingSignalDate,
    }),
    [
      useTwoPane,
      contentPane,
      isHomePaneActive,
      isAccountPaneActive,
      settingsTab,
      youtubeSort,
      newsIssuesParams,
      disclosureFlowParams,
      todayBriefingDate,
      calendarFromAccount,
      alertsFromAccount,
      showHome,
      showAccount,
      showSettings,
      showTabs,
      showNewsIssues,
      showDisclosureFlow,
      showTodayBriefing,
      showCalendar,
      showAlerts,
      showTermsHistory,
      showYoutubeTab,
      showNewsTab,
      showSignalTab,
      takePendingNewsSegment,
      takePendingSignalSession,
      takePendingSignalDate,
    ],
  );

  return <IpadSidebarNavContext.Provider value={value}>{children}</IpadSidebarNavContext.Provider>;
}

export function useIpadSidebarNav() {
  return useContext(IpadSidebarNavContext);
}
