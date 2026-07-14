import { useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { isSettingsTab, type SettingsTab } from '@/constants/settingsTabs';
import type { SignalSessionKey } from '@/constants/ipadHomeNav';
import type { DisclosureFlowMarket, NewsIssuesCategory } from '@/constants/ipadHomeNav';
import type { NewsSegmentKey } from '@/constants/newsSegment';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { resolveIpadContentPaneFromPathname } from '@/utils/ipadContentPaneFromPath';
import {
  communityIdFromPathname,
  isWideHomePath,
  isWideOverlayKind,
  legacyPathnameToOverlayKind,
  overlayKindToContentPane,
  overlayParamsFromRecord,
  symbolTickerFromPathname,
  WIDE_HOME_ROUTE,
  WIDE_OVERLAY_CLEAR_PARAMS,
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
  | 'termsHistory'
  | 'terms'
  | 'board'
  | 'community'
  | 'symbol';

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

export type WidePaneDrillFrom = 'home' | 'account' | 'termsHistory' | 'tabs' | 'alerts' | 'board';

export type WidePaneDrillOptions = {
  /** In-memory drill origin — never put this in the shareable URL. */
  drillFrom?: WidePaneDrillFrom;
};

type IpadSidebarNavState = {
  isAvailable: boolean;
  contentPane: IpadContentPane;
  isHomePaneActive: boolean;
  isAccountPaneActive: boolean;
  isSettingsPaneActive: boolean;
  /** True when the right pane was opened via in-pane drill-in (show WideSubpaneHeader). */
  widePaneCanGoBack: boolean;
  settingsTab: SettingsTab;
  youtubeSort: YoutubeSortKey;
  newsIssuesParams: IpadNewsIssuesPaneParams | null;
  disclosureFlowParams: IpadDisclosureFlowPaneParams | null;
  todayBriefingDate: string | null;
  communityPostId: string | null;
  symbolTicker: string | null;
  calendarFromAccount: boolean;
  alertsFromAccount: boolean;
  termsType: 'service' | 'privacy';
  termsFromHistory: boolean;
};

type IpadSidebarNavActions = {
  isAvailable: boolean;
  showHome: () => void;
  showAccount: () => void;
  showTabs: () => void;
  showSettings: (tab?: SettingsTab, options?: WidePaneDrillOptions) => void;
  showNewsIssues: (params: IpadNewsIssuesPaneParams, options?: WidePaneDrillOptions) => void;
  showDisclosureFlow: (params: IpadDisclosureFlowPaneParams, options?: WidePaneDrillOptions) => void;
  showTodayBriefing: (date: string, options?: WidePaneDrillOptions) => void;
  showCalendar: (options?: { from?: 'account' } & WidePaneDrillOptions) => void;
  showAlerts: (options?: { from?: 'account' } & WidePaneDrillOptions) => void;
  showTermsHistory: (options?: WidePaneDrillOptions) => void;
  showTerms: (
    type?: 'service' | 'privacy',
    options?: { from?: 'account' | 'terms-history' } & WidePaneDrillOptions,
  ) => void;
  showBoard: (options?: WidePaneDrillOptions & { source?: string }) => void;
  showCommunityPost: (id: string, options?: WidePaneDrillOptions) => void;
  showSymbol: (ticker: string, options?: WidePaneDrillOptions) => void;
  showYoutubeTab: (sort?: YoutubeSortKey) => void;
  showNewsTab: (segment?: NewsSegmentKey) => void;
  showSignalTab: (session?: SignalSessionKey, date?: string) => void;
  goBackWidePane: () => void;
  markWideRootEntry: () => void;
  takePendingNewsSegment: () => NewsSegmentKey | null;
  takePendingSignalSession: () => SignalSessionKey | null;
  takePendingSignalDate: () => string | null;
};

export type IpadSidebarNavContextValue = IpadSidebarNavState & IpadSidebarNavActions;

const defaultState: IpadSidebarNavState = {
  isAvailable: false,
  contentPane: 'tabs',
  isHomePaneActive: false,
  isAccountPaneActive: false,
  isSettingsPaneActive: false,
  widePaneCanGoBack: false,
  settingsTab: 'display',
  youtubeSort: 'latest',
  newsIssuesParams: null,
  disclosureFlowParams: null,
  todayBriefingDate: null,
  communityPostId: null,
  symbolTicker: null,
  calendarFromAccount: false,
  alertsFromAccount: false,
  termsType: 'service',
  termsFromHistory: false,
};

const defaultActions: IpadSidebarNavActions = {
  isAvailable: false,
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
  showTerms: () => {},
  showBoard: () => {},
  showCommunityPost: () => {},
  showSymbol: () => {},
  showYoutubeTab: () => {},
  showNewsTab: () => {},
  showSignalTab: () => {},
  goBackWidePane: () => {},
  markWideRootEntry: () => {},
  takePendingNewsSegment: () => null,
  takePendingSignalSession: () => null,
  takePendingSignalDate: () => null,
};

const IpadSidebarNavStateContext = createContext<IpadSidebarNavState>(defaultState);
const IpadSidebarNavActionsContext = createContext<IpadSidebarNavActions>(defaultActions);

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
    id?: string | string[];
    ticker?: string | string[];
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
  const [communityPostId, setCommunityPostId] = useState<string | null>(null);
  const [symbolTicker, setSymbolTicker] = useState<string | null>(null);
  const [calendarFromAccount, setCalendarFromAccount] = useState(false);
  const [alertsFromAccount, setAlertsFromAccount] = useState(false);
  const [termsType, setTermsType] = useState<'service' | 'privacy'>('service');
  const [termsFromHistory, setTermsFromHistory] = useState(false);
  const [wideBackStack, setWideBackStack] = useState<WidePaneDrillFrom[]>([]);
  const programmaticOverlayRef = useRef(false);
  const restoringWideBackRef = useRef(false);
  const wideBackStackRef = useRef(wideBackStack);
  wideBackStackRef.current = wideBackStack;
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
        return;
      }

      if (kind === 'terms') {
        setTermsType(p.type === 'privacy' ? 'privacy' : 'service');
        setTermsFromHistory(p.from === 'terms-history');
        return;
      }

      if (kind === 'board') {
        return;
      }

      if (kind === 'community') {
        setCommunityPostId(p.id ?? null);
        return;
      }

      if (kind === 'symbol') {
        setSymbolTicker(p.ticker ? p.ticker.toUpperCase() : null);
      }
    },
    [],
  );

  const clearWideBackStack = useCallback(() => {
    setWideBackStack([]);
  }, []);

  const markWideRootEntry = useCallback(() => {
    setWideBackStack([]);
  }, []);

  const pushWideDrillFrom = useCallback((from: WidePaneDrillFrom) => {
    setWideBackStack((prev) => [...prev, from]);
  }, []);

  const navigateWideOverlay = useCallback(
    (kind: WideOverlayKind, overlayParams: Record<string, string | undefined>) => {
      programmaticOverlayRef.current = true;
      applyOverlayKind(kind, overlayParams);
      const nextParams: Record<string, string | undefined> = {
        ...WIDE_OVERLAY_CLEAR_PARAMS,
        overlay: kind,
        ...overlayParams,
      };
      router.navigate({
        pathname: WIDE_HOME_ROUTE,
        params: nextParams,
      } as never);
    },
    [applyOverlayKind, router],
  );

  const beginWideOverlay = useCallback(
    (
      kind: WideOverlayKind,
      overlayParams: Record<string, string | undefined>,
      drillFrom?: WidePaneDrillFrom,
    ) => {
      if (drillFrom) {
        pushWideDrillFrom(drillFrom);
      } else if (!restoringWideBackRef.current) {
        clearWideBackStack();
      }
      navigateWideOverlay(kind, overlayParams);
    },
    [clearWideBackStack, navigateWideOverlay, pushWideDrillFrom],
  );

  useEffect(() => {
    if (!useTwoPane) return;

    const legacyOverlay = legacyPathnameToOverlayKind(pathname);
    if (legacyOverlay && !isWideHomePath(pathname)) {
      if (!programmaticOverlayRef.current) clearWideBackStack();
      programmaticOverlayRef.current = false;
      if (legacyOverlay === 'community') {
        const id = communityIdFromPathname(pathname) ?? firstParam(params.id);
        applyOverlayKind(legacyOverlay, { ...params, ...(id ? { id } : {}) });
      } else if (legacyOverlay === 'symbol') {
        const ticker = symbolTickerFromPathname(pathname) ?? firstParam(params.ticker);
        applyOverlayKind(legacyOverlay, { ...params, ...(ticker ? { ticker } : {}) });
      } else {
        applyOverlayKind(legacyOverlay, params);
      }
      return;
    }

    if (isWideHomePath(pathname)) {
      const overlay = firstParam(params.overlay);
      if (isWideOverlayKind(overlay)) {
        if (!programmaticOverlayRef.current) clearWideBackStack();
        programmaticOverlayRef.current = false;
        applyOverlayKind(overlay, params);
        return;
      }
      if (!programmaticOverlayRef.current) clearWideBackStack();
      programmaticOverlayRef.current = false;
      setContentPane('home');
      return;
    }

    if (!programmaticOverlayRef.current) clearWideBackStack();
    programmaticOverlayRef.current = false;

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
    clearWideBackStack,
    params.category,
    params.date,
    params.digestId,
    params.from,
    params.id,
    params.market,
    params.overlay,
    params.pane,
    params.tab,
    params.ticker,
    params.sort,
    pathname,
    useTwoPane,
  ]);

  const showHome = useCallback(() => {
    clearWideBackStack();
    programmaticOverlayRef.current = true;
    setContentPane('home');
    if (isWideHomePath(pathname) && !firstParam(params.overlay)) return;
    if (useTwoPane) {
      router.navigate({
        pathname: WIDE_HOME_ROUTE,
        params: { ...WIDE_OVERLAY_CLEAR_PARAMS },
      } as never);
      return;
    }
    if (pathname.includes('/home')) return;
    router.navigate(WIDE_HOME_ROUTE as never);
  }, [clearWideBackStack, params.overlay, pathname, router, useTwoPane]);

  const showAccount = useCallback(() => {
    if (!restoringWideBackRef.current) clearWideBackStack();
    if (useTwoPane) {
      beginWideOverlay('account', { pane: 'hub' });
      return;
    }
    setContentPane('account');
    if (pathname.startsWith('/account')) return;
    router.navigate({ pathname: '/account', params: { pane: 'hub' } } as never);
  }, [beginWideOverlay, clearWideBackStack, pathname, router, useTwoPane]);

  const showTabs = useCallback(() => {
    if (!restoringWideBackRef.current) clearWideBackStack();
    setContentPane('tabs');
  }, [clearWideBackStack]);

  const showSettings = useCallback(
    (tab: SettingsTab = 'display', options?: WidePaneDrillOptions) => {
      setSettingsTab(tab);
      if (useTwoPane) {
        beginWideOverlay('settings', { tab, from: 'account' }, options?.drillFrom);
        return;
      }
      setContentPane('settings');
      router.navigate({ pathname: '/settings', params: { tab, from: 'account' } } as never);
    },
    [beginWideOverlay, router, useTwoPane],
  );

  const showNewsIssues = useCallback(
    (next: IpadNewsIssuesPaneParams, options?: WidePaneDrillOptions) => {
      setNewsIssuesParams(next);
      if (useTwoPane) {
        beginWideOverlay(
          'news-issues',
          {
            category: next.category,
            date: next.date,
            ...(next.digestId ? { digestId: next.digestId } : {}),
          },
          options?.drillFrom,
        );
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
    [beginWideOverlay, router, useTwoPane],
  );

  const showDisclosureFlow = useCallback(
    (next: IpadDisclosureFlowPaneParams, options?: WidePaneDrillOptions) => {
      setDisclosureFlowParams(next);
      if (useTwoPane) {
        beginWideOverlay(
          'disclosure-flow',
          {
            date: next.date,
            ...(next.market ? { market: next.market } : {}),
            ...(next.digestId ? { digestId: next.digestId } : {}),
          },
          options?.drillFrom,
        );
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
    [beginWideOverlay, router, useTwoPane],
  );

  const showTodayBriefing = useCallback(
    (date: string, options?: WidePaneDrillOptions) => {
      setTodayBriefingDate(date);
      if (useTwoPane) {
        beginWideOverlay('today-briefing', { date }, options?.drillFrom);
        return;
      }
      router.navigate({ pathname: '/today-briefing', params: { date } } as never);
    },
    [beginWideOverlay, router, useTwoPane],
  );

  const showCalendar = useCallback(
    (options?: { from?: 'account' } & WidePaneDrillOptions) => {
      const fromAccount = options?.from === 'account' || options?.drillFrom === 'account';
      setCalendarFromAccount(fromAccount);
      if (useTwoPane) {
        beginWideOverlay('calendar', fromAccount ? { from: 'account' } : {}, options?.drillFrom);
        return;
      }
      router.navigate({
        pathname: '/calendar',
        params: fromAccount ? { from: 'account' } : {},
      } as never);
    },
    [beginWideOverlay, router, useTwoPane],
  );

  const showAlerts = useCallback(
    (options?: { from?: 'account' } & WidePaneDrillOptions) => {
      const fromAccount = options?.from === 'account' || options?.drillFrom === 'account';
      setAlertsFromAccount(fromAccount);
      if (useTwoPane) {
        beginWideOverlay('alerts', fromAccount ? { from: 'account' } : {}, options?.drillFrom);
        return;
      }
      router.navigate({
        pathname: '/alerts',
        params: fromAccount ? { from: 'account' } : {},
      } as never);
    },
    [beginWideOverlay, router, useTwoPane],
  );

  const showTermsHistory = useCallback(
    (options?: WidePaneDrillOptions) => {
      if (useTwoPane) {
        beginWideOverlay('terms-history', { from: 'account' }, options?.drillFrom);
        return;
      }
      router.navigate('/terms-history' as never);
    },
    [beginWideOverlay, router, useTwoPane],
  );

  const showTerms = useCallback(
    (
      type: 'service' | 'privacy' = 'service',
      options?: { from?: 'account' | 'terms-history' } & WidePaneDrillOptions,
    ) => {
      const from = options?.from ?? (options?.drillFrom === 'termsHistory' ? 'terms-history' : 'account');
      setTermsType(type);
      setTermsFromHistory(from === 'terms-history');
      if (useTwoPane) {
        beginWideOverlay('terms', { type, from }, options?.drillFrom);
        return;
      }
      router.navigate({ pathname: '/terms', params: { type } } as never);
    },
    [beginWideOverlay, router, useTwoPane],
  );

  const showBoard = useCallback(
    (options?: WidePaneDrillOptions & { source?: string }) => {
      if (useTwoPane) {
        beginWideOverlay(
          'board',
          options?.source ? { source: options.source } : {},
          options?.drillFrom,
        );
        return;
      }
      router.navigate({
        pathname: '/(tabs)/board',
        params: options?.source ? { source: options.source } : {},
      } as never);
    },
    [beginWideOverlay, router, useTwoPane],
  );

  const showCommunityPost = useCallback(
    (id: string, options?: WidePaneDrillOptions) => {
      const postId = String(id || '').trim();
      if (!postId) return;
      setCommunityPostId(postId);
      if (useTwoPane) {
        beginWideOverlay('community', { id: postId }, options?.drillFrom);
        return;
      }
      router.push(`/community/${encodeURIComponent(postId)}` as never);
    },
    [beginWideOverlay, router, useTwoPane],
  );

  const showSymbol = useCallback(
    (ticker: string, options?: WidePaneDrillOptions) => {
      const next = String(ticker || '')
        .trim()
        .toUpperCase();
      if (!next || next === '—') return;
      setSymbolTicker(next);
      if (useTwoPane) {
        beginWideOverlay('symbol', { ticker: next }, options?.drillFrom);
        return;
      }
      router.push(`/symbol/${encodeURIComponent(next)}` as never);
    },
    [beginWideOverlay, router, useTwoPane],
  );

  const goBackWidePane = useCallback(() => {
    const stack = wideBackStackRef.current;
    if (stack.length === 0) return;
    const target = stack[stack.length - 1];
    setWideBackStack(stack.slice(0, -1));
    restoringWideBackRef.current = true;
    programmaticOverlayRef.current = true;
    try {
      if (target === 'home') {
        setContentPane('home');
        router.navigate({
          pathname: WIDE_HOME_ROUTE,
          params: { ...WIDE_OVERLAY_CLEAR_PARAMS },
        } as never);
      } else if (target === 'account') {
        applyOverlayKind('account', { pane: 'hub' });
        router.navigate({
          pathname: WIDE_HOME_ROUTE,
          params: { ...WIDE_OVERLAY_CLEAR_PARAMS, overlay: 'account', pane: 'hub' },
        } as never);
      } else if (target === 'termsHistory') {
        applyOverlayKind('terms-history', { from: 'account' });
        router.navigate({
          pathname: WIDE_HOME_ROUTE,
          params: { ...WIDE_OVERLAY_CLEAR_PARAMS, overlay: 'terms-history', from: 'account' },
        } as never);
      } else if (target === 'alerts') {
        applyOverlayKind('alerts', alertsFromAccount ? { from: 'account' } : {});
        router.navigate({
          pathname: WIDE_HOME_ROUTE,
          params: {
            ...WIDE_OVERLAY_CLEAR_PARAMS,
            overlay: 'alerts',
            ...(alertsFromAccount ? { from: 'account' } : {}),
          },
        } as never);
      } else if (target === 'board') {
        applyOverlayKind('board', {});
        router.navigate({
          pathname: WIDE_HOME_ROUTE,
          params: { ...WIDE_OVERLAY_CLEAR_PARAMS, overlay: 'board' },
        } as never);
      } else {
        setContentPane('tabs');
      }
    } finally {
      restoringWideBackRef.current = false;
    }
  }, [alertsFromAccount, applyOverlayKind, router]);

  const showYoutubeTab = useCallback(
    (sort?: YoutubeSortKey) => {
      clearWideBackStack();
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
    [clearWideBackStack, router, pathname],
  );

  const showNewsTab = useCallback(
    (segment?: NewsSegmentKey) => {
      clearWideBackStack();
      if (segment) pendingNewsSegmentRef.current = segment;
      setContentPane('tabs');
      router.navigate({
        pathname: '/(tabs)/news',
        params: segment && segment !== 'video' ? { segment } : { segment: 'global' },
      } as never);
    },
    [clearWideBackStack, router],
  );

  const showSignalTab = useCallback(
    (session?: SignalSessionKey, date?: string) => {
      clearWideBackStack();
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
    [clearWideBackStack, router],
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
    contentPane === 'board' ||
    contentPane === 'community' ||
    contentPane === 'symbol' ||
    (contentPane === 'calendar' && !calendarFromAccount) ||
    (contentPane === 'alerts' && !alertsFromAccount);

  const isAccountPaneActive =
    contentPane === 'account' ||
    contentPane === 'settings' ||
    contentPane === 'termsHistory' ||
    contentPane === 'terms' ||
    (contentPane === 'alerts' && alertsFromAccount) ||
    (contentPane === 'calendar' && calendarFromAccount);

  const stateValue = useMemo(
    (): IpadSidebarNavState => ({
      isAvailable: useTwoPane,
      contentPane,
      isHomePaneActive,
      isAccountPaneActive,
      isSettingsPaneActive: contentPane === 'settings',
      widePaneCanGoBack: wideBackStack.length > 0,
      settingsTab,
      youtubeSort,
      newsIssuesParams,
      disclosureFlowParams,
      todayBriefingDate,
      communityPostId,
      symbolTicker,
      calendarFromAccount,
      alertsFromAccount,
      termsType,
      termsFromHistory,
    }),
    [
      useTwoPane,
      contentPane,
      isHomePaneActive,
      isAccountPaneActive,
      wideBackStack.length,
      settingsTab,
      youtubeSort,
      newsIssuesParams,
      disclosureFlowParams,
      todayBriefingDate,
      communityPostId,
      symbolTicker,
      calendarFromAccount,
      alertsFromAccount,
      termsType,
      termsFromHistory,
    ],
  );

  const actionsValue = useMemo(
    (): IpadSidebarNavActions => ({
      isAvailable: useTwoPane,
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
      showTerms,
      showBoard,
      showCommunityPost,
      showSymbol,
      showYoutubeTab,
      showNewsTab,
      showSignalTab,
      goBackWidePane,
      markWideRootEntry,
      takePendingNewsSegment,
      takePendingSignalSession,
      takePendingSignalDate,
    }),
    [
      useTwoPane,
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
      showTerms,
      showBoard,
      showCommunityPost,
      showSymbol,
      showYoutubeTab,
      showNewsTab,
      showSignalTab,
      goBackWidePane,
      markWideRootEntry,
      takePendingNewsSegment,
      takePendingSignalSession,
      takePendingSignalDate,
    ],
  );

  return (
    <IpadSidebarNavActionsContext.Provider value={actionsValue}>
      <IpadSidebarNavStateContext.Provider value={stateValue}>{children}</IpadSidebarNavStateContext.Provider>
    </IpadSidebarNavActionsContext.Provider>
  );
}

/** Pane/UI state — re-renders when overlays/tabs change. */
export function useIpadSidebarNavState() {
  return useContext(IpadSidebarNavStateContext);
}

/** Stable navigation actions — safe to call without pane-driven re-renders. */
export function useIpadSidebarNavActions() {
  return useContext(IpadSidebarNavActionsContext);
}

/** Combined hook for callers that need both state and actions. */
export function useIpadSidebarNav(): IpadSidebarNavContextValue {
  const state = useIpadSidebarNavState();
  const actions = useIpadSidebarNavActions();
  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}
