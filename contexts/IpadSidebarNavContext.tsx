import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { isSettingsTab, type SettingsTab } from '@/constants/settingsTabs';
import type { SignalSessionKey } from '@/constants/ipadHomeNav';
import type { DisclosureFlowMarket, NewsIssuesCategory } from '@/constants/ipadHomeNav';
import type { NewsSegmentKey } from '@/constants/newsSegment';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { resolveIpadContentPaneFromPathname } from '@/utils/ipadContentPaneFromPath';

export type YoutubeSortKey = 'latest' | 'popular';

export type IpadContentPane = 'home' | 'tabs' | 'account' | 'settings' | 'newsIssues' | 'disclosureFlow';
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
  showHome: () => void;
  showAccount: () => void;
  showTabs: () => void;
  showSettings: (tab?: SettingsTab) => void;
  showNewsIssues: (params: IpadNewsIssuesPaneParams) => void;
  showDisclosureFlow: (params: IpadDisclosureFlowPaneParams) => void;
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
  showHome: () => {},
  showAccount: () => {},
  showTabs: () => {},
  showSettings: () => {},
  showNewsIssues: () => {},
  showDisclosureFlow: () => {},
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

export function IpadSidebarNavProvider({ children }: { children: ReactNode }) {
  const { useTwoPane } = useResponsiveLayout();
  const router = useRouter();
  const pathname = usePathname();
  /** Root Layout 밖에서는 local params가 비다. 새로고침 복원은 global params를 쓴다. */
  const params = useGlobalSearchParams<{
    tab?: string | string[];
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
  const pendingNewsSegmentRef = useRef<NewsSegmentKey | null>(null);
  const pendingSignalSessionRef = useRef<SignalSessionKey | null>(null);
  const pendingSignalDateRef = useRef<string | null>(null);
  const youtubeSortRef = useRef(youtubeSort);
  youtubeSortRef.current = youtubeSort;

  /** URL이 바뀌면 pane·서브 상태를 맞춰 새로고침·공유 링크를 복원한다. */
  useEffect(() => {
    if (!useTwoPane) return;
    const pane = resolveIpadContentPaneFromPathname(pathname);
    setContentPane(pane);

    const tab = firstParam(params.tab);
    if (isSettingsTab(tab)) setSettingsTab(tab);

    if (pathname.includes('/youtube')) {
      const sort = parseYoutubeSortParam(firstParam(params.sort));
      // 명시된 값만 반영 — 쿼리 부재 시 latest로 덮어쓰지 않는다.
      if (sort) setYoutubeSort(sort);
    }

    if (pane === 'newsIssues') {
      const date = firstParam(params.date);
      if (date) {
        setNewsIssuesParams({
          category: parseNewsIssuesCategory(firstParam(params.category)),
          date,
          digestId: firstParam(params.digestId),
        });
      }
    }

    if (pane === 'disclosureFlow') {
      const date = firstParam(params.date);
      if (date) {
        setDisclosureFlowParams({
          date,
          market: parseDisclosureMarket(firstParam(params.market)),
          digestId: firstParam(params.digestId),
        });
      }
    }
  }, [pathname, params.tab, params.sort, params.category, params.date, params.digestId, params.market, useTwoPane]);

  const showHome = useCallback(() => {
    setContentPane('home');
    if (pathname.includes('/home')) return;
    router.navigate('/(tabs)/home' as never);
  }, [router, pathname]);

  const showAccount = useCallback(() => {
    setContentPane('account');
    if (pathname.startsWith('/account')) return;
    router.navigate({ pathname: '/account', params: { pane: 'hub' } } as never);
  }, [router, pathname]);

  const showTabs = useCallback(() => {
    setContentPane('tabs');
  }, []);

  const showSettings = useCallback(
    (tab: SettingsTab = 'display') => {
      setSettingsTab(tab);
      setContentPane('settings');
      if (pathname.startsWith('/settings')) {
        const currentTab = firstParam(params.tab);
        if (isSettingsTab(currentTab) && currentTab === tab) return;
        router.setParams({ tab, from: 'account' } as never);
        return;
      }
      router.navigate({ pathname: '/settings', params: { tab, from: 'account' } } as never);
    },
    [params.tab, pathname, router],
  );

  const showNewsIssues = useCallback(
    (next: IpadNewsIssuesPaneParams) => {
      setNewsIssuesParams(next);
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
    [router],
  );

  const showDisclosureFlow = useCallback(
    (next: IpadDisclosureFlowPaneParams) => {
      setDisclosureFlowParams(next);
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
    [router],
  );

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

  const value = useMemo(
    () => ({
      isAvailable: useTwoPane,
      contentPane,
      isHomePaneActive: contentPane === 'home' || contentPane === 'newsIssues' || contentPane === 'disclosureFlow',
      isAccountPaneActive: contentPane === 'account',
      isSettingsPaneActive: contentPane === 'settings',
      settingsTab,
      youtubeSort,
      newsIssuesParams,
      disclosureFlowParams,
      showHome,
      showAccount,
      showTabs,
      showSettings,
      showNewsIssues,
      showDisclosureFlow,
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
      settingsTab,
      youtubeSort,
      newsIssuesParams,
      disclosureFlowParams,
      showHome,
      showAccount,
      showSettings,
      showTabs,
      showNewsIssues,
      showDisclosureFlow,
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
