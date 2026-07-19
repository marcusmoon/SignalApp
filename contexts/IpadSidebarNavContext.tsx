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

export type IpadContentPane =
  | 'home'
  | 'tabs'
  | 'account'
  | 'settings'
  | 'newsIssues'
  | 'newsDigest'
  | 'disclosureFlow'
  | 'disclosureDigest'
  | 'todayBriefing'
  | 'marketBriefing'
  | 'etfInsights'
  | 'etfInsight'
  | 'calendar'
  | 'alerts'
  | 'termsHistory'
  | 'terms'
  | 'board'
  | 'community'
  | 'symbol'
  | 'watchlist';

export type IpadNewsIssuesPaneParams = {
  category: NewsIssuesCategory;
  date: string;
  digestId?: string | null;
  /** 홈 섹션 `>` 드릴 — 상단 날짜피커 숨김 */
  hideDateNavigator?: boolean;
};
export type IpadDisclosureFlowPaneParams = {
  date: string;
  market?: DisclosureFlowMarket;
  digestId?: string | null;
};
export type IpadMarketBriefingPaneParams = {
  session?: SignalSessionKey;
  date?: string;
  /** 홈·알림 드릴 — 상단 날짜피커 숨김 */
  hideDateNavigator?: boolean;
  /** 알림 단건 — 회차 세그먼트 숨김 (해당 세션만) */
  hideSessionSegments?: boolean;
};

export type WidePaneDrillFrom =
  | 'home'
  | 'account'
  | 'termsHistory'
  | 'tabs'
  | 'alerts'
  | 'board'
  | 'etfInsights'
  | 'newsIssues'
  | 'disclosureFlow';

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
  newsIssuesParams: IpadNewsIssuesPaneParams | null;
  newsDigestId: string | null;
  disclosureFlowParams: IpadDisclosureFlowPaneParams | null;
  disclosureDigestId: string | null;
  todayBriefingDate: string | null;
  marketBriefingParams: IpadMarketBriefingPaneParams | null;
  etfInsightId: string | null;
  etfInsightDate: string | null;
  communityPostId: string | null;
  symbolTicker: string | null;
  calendarFromAccount: boolean;
  alertsFromAccount: boolean;
  settingsFromAccount: boolean;
  termsType: 'service' | 'privacy';
  termsFromHistory: boolean;
};

type IpadSidebarNavActions = {
  isAvailable: boolean;
  showHome: () => void;
  showAccount: () => void;
  showTabs: () => void;
  showSettings: (tab?: SettingsTab, options?: { from?: 'account' } & WidePaneDrillOptions) => void;
  switchSettingsTab: (tab: SettingsTab) => void;
  showNewsIssues: (params: IpadNewsIssuesPaneParams, options?: WidePaneDrillOptions) => void;
  showNewsDigest: (id: string, options?: WidePaneDrillOptions) => void;
  showDisclosureFlow: (params: IpadDisclosureFlowPaneParams, options?: WidePaneDrillOptions) => void;
  showDisclosureDigest: (id: string, options?: WidePaneDrillOptions) => void;
  showTodayBriefing: (date: string, options?: WidePaneDrillOptions) => void;
  showMarketBriefing: (
    session?: SignalSessionKey,
    date?: string,
    options?: WidePaneDrillOptions,
  ) => void;
  showEtfInsights: (options?: WidePaneDrillOptions) => void;
  showEtfInsight: (id: string, options?: WidePaneDrillOptions & { date?: string }) => void;
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
  showWatchlist: (options?: WidePaneDrillOptions) => void;
  showYoutubeTab: () => void;
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
  newsIssuesParams: null,
  newsDigestId: null,
  disclosureFlowParams: null,
  disclosureDigestId: null,
  todayBriefingDate: null,
  marketBriefingParams: null,
  etfInsightId: null,
  etfInsightDate: null,
  communityPostId: null,
  symbolTicker: null,
  calendarFromAccount: false,
  alertsFromAccount: false,
  settingsFromAccount: false,
  termsType: 'service',
  termsFromHistory: false,
};

const defaultActions: IpadSidebarNavActions = {
  isAvailable: false,
  showHome: () => {},
  showAccount: () => {},
  showTabs: () => {},
  showSettings: () => {},
  switchSettingsTab: () => {},
  showNewsIssues: () => {},
  showNewsDigest: () => {},
  showDisclosureFlow: () => {},
  showDisclosureDigest: () => {},
  showTodayBriefing: () => {},
  showMarketBriefing: () => {},
  showEtfInsights: () => {},
  showEtfInsight: () => {},
  showCalendar: () => {},
  showAlerts: () => {},
  showTermsHistory: () => {},
  showTerms: () => {},
  showBoard: () => {},
  showCommunityPost: () => {},
  showSymbol: () => {},
  showWatchlist: () => {},
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

function parseSignalSessionParam(raw: string | undefined): SignalSessionKey | undefined {
  if (
    raw === 'us-overnight' ||
    raw === 'kr-morning' ||
    raw === 'kr-lunch' ||
    raw === 'kr-close'
  ) {
    return raw;
  }
  return undefined;
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
    session?: string | string[];
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
  const [newsIssuesParams, setNewsIssuesParams] = useState<IpadNewsIssuesPaneParams | null>(null);
  const [newsDigestId, setNewsDigestId] = useState<string | null>(null);
  const [disclosureFlowParams, setDisclosureFlowParams] = useState<IpadDisclosureFlowPaneParams | null>(null);
  const [disclosureDigestId, setDisclosureDigestId] = useState<string | null>(null);
  const [todayBriefingDate, setTodayBriefingDate] = useState<string | null>(null);
  const [etfInsightId, setEtfInsightId] = useState<string | null>(null);
  const [etfInsightDate, setEtfInsightDate] = useState<string | null>(null);
  const [marketBriefingParams, setMarketBriefingParams] = useState<IpadMarketBriefingPaneParams | null>(null);
  const [communityPostId, setCommunityPostId] = useState<string | null>(null);
  const [symbolTicker, setSymbolTicker] = useState<string | null>(null);
  const [calendarFromAccount, setCalendarFromAccount] = useState(false);
  const [alertsFromAccount, setAlertsFromAccount] = useState(false);
  const [settingsFromAccount, setSettingsFromAccount] = useState(false);
  const [termsType, setTermsType] = useState<'service' | 'privacy'>('service');
  const [termsFromHistory, setTermsFromHistory] = useState(false);
  const [wideBackStack, setWideBackStack] = useState<WidePaneDrillFrom[]>([]);
  const programmaticOverlayRef = useRef(false);
  const restoringWideBackRef = useRef(false);
  const wideBackStackRef = useRef(wideBackStack);
  wideBackStackRef.current = wideBackStack;
  const contentPaneRef = useRef(contentPane);
  contentPaneRef.current = contentPane;
  const pendingNewsSegmentRef = useRef<NewsSegmentKey | null>(null);
  const pendingSignalSessionRef = useRef<SignalSessionKey | null>(null);
  const pendingSignalDateRef = useRef<string | null>(null);

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
            hideDateNavigator: p.from === 'home',
          });
        }
        return;
      }

      if (kind === 'news-digest') {
        setNewsDigestId(firstParam(p.id) || firstParam(p.digestId) || null);
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

      if (kind === 'disclosure-digest') {
        setDisclosureDigestId(firstParam(p.id) || firstParam(p.digestId) || null);
        return;
      }

      if (kind === 'today-briefing') {
        setTodayBriefingDate(parseDateParam(p.date) ?? null);
        return;
      }

      if (kind === 'market-briefing') {
        const fromHome = p.from === 'home';
        const fromAlerts = p.from === 'alerts';
        setMarketBriefingParams({
          session: parseSignalSessionParam(p.session),
          date: parseDateParam(p.date),
          hideDateNavigator: fromHome || fromAlerts,
          hideSessionSegments: fromAlerts,
        });
        return;
      }

      if (kind === 'etf-insights') {
        setEtfInsightId(null);
        setEtfInsightDate(null);
        return;
      }

      if (kind === 'etf-insight') {
        setEtfInsightId(firstParam(p.id) || null);
        setEtfInsightDate(parseDateParam(p.date) ?? null);
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
        setSettingsFromAccount(p.from === 'account');
        return;
      }

      if (kind === 'account') {
        setCalendarFromAccount(false);
        setAlertsFromAccount(false);
        setSettingsFromAccount(false);
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
        // Leaving overlay for a main tab — keep contentPane=tabs until pathname catches up.
        // Otherwise a stale /home?overlay=… sync snaps the pane back and Home looks dead.
        if (programmaticOverlayRef.current && contentPaneRef.current === 'tabs') {
          return;
        }
        if (!programmaticOverlayRef.current) {
          // Same overlay + param-only sync (category/session/date submenu) must keep drill back.
          // Only clear when navigating to a different overlay root without drillFrom.
          const nextPane = overlayKindToContentPane(overlay);
          if (contentPaneRef.current !== nextPane) {
            clearWideBackStack();
          }
        }
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

    if (pane === 'newsDigest') {
      setNewsDigestId(firstParam(params.id) || firstParam(params.digestId) || null);
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

    if (pane === 'disclosureDigest') {
      setDisclosureDigestId(firstParam(params.id) || firstParam(params.digestId) || null);
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
    params.session,
    params.tab,
    params.ticker,
    pathname,
    useTwoPane,
  ]);

  const showHome = useCallback(() => {
    clearWideBackStack();
    const onHomeRoot =
      contentPaneRef.current === 'home' &&
      isWideHomePath(pathname) &&
      !firstParam(params.overlay);
    if (onHomeRoot) return;

    programmaticOverlayRef.current = true;
    setContentPane('home');
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
    // Leaving a home overlay for a sidebar tab — block stale overlay URL from re-applying.
    if (useTwoPane && isWideHomePath(pathname) && firstParam(params.overlay)) {
      programmaticOverlayRef.current = true;
    }
    setContentPane('tabs');
  }, [clearWideBackStack, params.overlay, pathname, useTwoPane]);

  const showSettings = useCallback(
    (tab: SettingsTab = 'display', options?: { from?: 'account' } & WidePaneDrillOptions) => {
      const fromAccount = options?.from === 'account' || options?.drillFrom === 'account';
      setSettingsTab(tab);
      setSettingsFromAccount(fromAccount);
      if (useTwoPane) {
        beginWideOverlay(
          'settings',
          fromAccount ? { tab, from: 'account' } : { tab },
          options?.drillFrom,
        );
        return;
      }
      setContentPane('settings');
      router.navigate({
        pathname: '/settings',
        params: fromAccount ? { tab, from: 'account' } : { tab },
      } as never);
    },
    [beginWideOverlay, router, useTwoPane],
  );

  const settingsFromAccountRef = useRef(settingsFromAccount);
  settingsFromAccountRef.current = settingsFromAccount;

  const switchSettingsTab = useCallback(
    (tab: SettingsTab) => {
      setSettingsTab(tab);
      if (!useTwoPane || contentPaneRef.current !== 'settings') return;
      const fromAccount = settingsFromAccountRef.current;
      programmaticOverlayRef.current = true;
      router.navigate({
        pathname: WIDE_HOME_ROUTE,
        params: {
          ...WIDE_OVERLAY_CLEAR_PARAMS,
          overlay: 'settings',
          tab,
          ...(fromAccount ? { from: 'account' } : {}),
        },
      } as never);
    },
    [router, useTwoPane],
  );

  const showNewsIssues = useCallback(
    (next: IpadNewsIssuesPaneParams, options?: WidePaneDrillOptions) => {
      const fromHome = options?.drillFrom === 'home' || next.hideDateNavigator === true;
      const paneParams: IpadNewsIssuesPaneParams = {
        ...next,
        hideDateNavigator: fromHome,
      };
      setNewsIssuesParams(paneParams);
      if (useTwoPane) {
        beginWideOverlay(
          'news-issues',
          {
            category: paneParams.category,
            date: paneParams.date,
            ...(paneParams.digestId ? { digestId: paneParams.digestId } : {}),
            ...(fromHome ? { from: 'home' } : {}),
          },
          options?.drillFrom,
        );
        return;
      }
      setContentPane('newsIssues');
      router.navigate({
        pathname: '/news-issues',
        params: {
          category: paneParams.category,
          date: paneParams.date,
          ...(paneParams.digestId ? { digestId: paneParams.digestId } : null),
          ...(fromHome ? { from: 'home' } : null),
        },
      } as never);
    },
    [beginWideOverlay, router, useTwoPane],
  );

  const showNewsDigest = useCallback(
    (id: string, options?: WidePaneDrillOptions) => {
      const cleanId = String(id || '').trim();
      if (!cleanId) return;
      setNewsDigestId(cleanId);
      if (useTwoPane) {
        beginWideOverlay('news-digest', { id: cleanId }, options?.drillFrom);
        return;
      }
      router.push({
        pathname: '/news-digest',
        params: { id: cleanId },
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

  const showDisclosureDigest = useCallback(
    (id: string, options?: WidePaneDrillOptions) => {
      const cleanId = String(id || '').trim();
      if (!cleanId) return;
      setDisclosureDigestId(cleanId);
      if (useTwoPane) {
        beginWideOverlay('disclosure-digest', { id: cleanId }, options?.drillFrom);
        return;
      }
      router.push({
        pathname: '/disclosure-digest',
        params: { id: cleanId },
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

  const showEtfInsights = useCallback(
    (options?: WidePaneDrillOptions) => {
      if (useTwoPane) {
        beginWideOverlay('etf-insights', {}, options?.drillFrom);
        return;
      }
      router.navigate('/etf-insights' as never);
    },
    [beginWideOverlay, router, useTwoPane],
  );

  const showEtfInsight = useCallback(
    (id: string, options?: WidePaneDrillOptions & { date?: string }) => {
      const cleanId = String(id || '').trim();
      if (!cleanId) return;
      setEtfInsightId(cleanId);
      setEtfInsightDate(options?.date ?? null);
      if (useTwoPane) {
        beginWideOverlay(
          'etf-insight',
          {
            id: cleanId,
            ...(options?.date ? { date: options.date } : null),
          },
          options?.drillFrom,
        );
        return;
      }
      router.push({
        pathname: '/etf-insight',
        params: {
          id: cleanId,
          ...(options?.date ? { date: options.date } : null),
        },
      } as never);
    },
    [beginWideOverlay, router, useTwoPane],
  );

  const showMarketBriefing = useCallback(
    (session?: SignalSessionKey, date?: string, options?: WidePaneDrillOptions) => {
      const fromHome = options?.drillFrom === 'home';
      const fromAlerts = options?.drillFrom === 'alerts';
      const fromParam = fromHome ? 'home' : fromAlerts ? 'alerts' : undefined;
      if (session) pendingSignalSessionRef.current = session;
      if (date) pendingSignalDateRef.current = date;
      setMarketBriefingParams({
        ...(session ? { session } : null),
        ...(date ? { date } : null),
        hideDateNavigator: fromHome || fromAlerts,
        hideSessionSegments: fromAlerts,
      });
      if (useTwoPane) {
        beginWideOverlay(
          'market-briefing',
          {
            ...(session ? { session } : null),
            ...(date ? { date } : null),
            ...(fromParam ? { from: fromParam } : null),
          },
          options?.drillFrom,
        );
        return;
      }
      router.push({
        pathname: '/market-briefing',
        params: {
          ...(session ? { session } : null),
          ...(date ? { date } : null),
          ...(fromParam ? { from: fromParam } : null),
        },
      } as never);
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

  const showWatchlist = useCallback(
    (options?: WidePaneDrillOptions) => {
      if (useTwoPane) {
        beginWideOverlay('watchlist', {}, options?.drillFrom);
        return;
      }
      router.push('/watchlist' as never);
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
      } else if (target === 'etfInsights') {
        applyOverlayKind('etf-insights', {});
        router.navigate({
          pathname: WIDE_HOME_ROUTE,
          params: { ...WIDE_OVERLAY_CLEAR_PARAMS, overlay: 'etf-insights' },
        } as never);
      } else if (target === 'newsIssues') {
        const p = newsIssuesParams;
        const date = p?.date;
        if (date) {
          const fromHome = p.hideDateNavigator === true;
          applyOverlayKind('news-issues', {
            category: p.category,
            date,
            ...(fromHome ? { from: 'home' } : {}),
          });
          router.navigate({
            pathname: WIDE_HOME_ROUTE,
            params: {
              ...WIDE_OVERLAY_CLEAR_PARAMS,
              overlay: 'news-issues',
              category: p.category === 'all' ? undefined : p.category,
              date,
              ...(fromHome ? { from: 'home' } : {}),
            },
          } as never);
        } else {
          setContentPane('tabs');
        }
      } else if (target === 'disclosureFlow') {
        const p = disclosureFlowParams;
        const date = p?.date;
        if (date) {
          applyOverlayKind('disclosure-flow', {
            date,
            ...(p.market && p.market !== 'all' ? { market: p.market } : {}),
          });
          router.navigate({
            pathname: WIDE_HOME_ROUTE,
            params: {
              ...WIDE_OVERLAY_CLEAR_PARAMS,
              overlay: 'disclosure-flow',
              date,
              ...(p.market && p.market !== 'all' ? { market: p.market } : {}),
            },
          } as never);
        } else {
          setContentPane('tabs');
        }
      } else {
        setContentPane('tabs');
      }
    } finally {
      restoringWideBackRef.current = false;
    }
  }, [alertsFromAccount, applyOverlayKind, disclosureFlowParams, newsIssuesParams, router]);

  const showYoutubeTab = useCallback(() => {
    clearWideBackStack();
    const onYoutube = pathname.includes('/youtube');
    if (useTwoPane && isWideHomePath(pathname) && firstParam(params.overlay)) {
      programmaticOverlayRef.current = true;
    }
    setContentPane('tabs');
    if (onYoutube) return;
    router.navigate('/(tabs)/youtube' as never);
  }, [clearWideBackStack, params.overlay, pathname, router, useTwoPane]);

  const showNewsTab = useCallback(
    (segment?: NewsSegmentKey) => {
      clearWideBackStack();
      if (segment) pendingNewsSegmentRef.current = segment;
      if (useTwoPane && isWideHomePath(pathname) && firstParam(params.overlay)) {
        programmaticOverlayRef.current = true;
      }
      setContentPane('tabs');
      router.navigate({
        pathname: '/(tabs)/news',
        params: segment ? { segment } : { segment: 'global' },
      } as never);
    },
    [clearWideBackStack, params.overlay, pathname, router, useTwoPane],
  );

  const showSignalTab = useCallback(
    (session?: SignalSessionKey, date?: string) => {
      clearWideBackStack();
      if (session) pendingSignalSessionRef.current = session;
      if (date) pendingSignalDateRef.current = date;
      if (useTwoPane && isWideHomePath(pathname) && firstParam(params.overlay)) {
        programmaticOverlayRef.current = true;
      }
      setContentPane('tabs');
      router.navigate({
        pathname: '/(tabs)/signal',
        params: {
          ...(session ? { session } : null),
          ...(date ? { date } : null),
        },
      } as never);
    },
    [clearWideBackStack, params.overlay, pathname, router, useTwoPane],
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
    contentPane === 'newsDigest' ||
    contentPane === 'disclosureFlow' ||
    contentPane === 'disclosureDigest' ||
    contentPane === 'todayBriefing' ||
    contentPane === 'marketBriefing' ||
    contentPane === 'watchlist' ||
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
      newsIssuesParams,
      newsDigestId,
      disclosureFlowParams,
      disclosureDigestId,
      todayBriefingDate,
      marketBriefingParams,
      etfInsightId,
      etfInsightDate,
      communityPostId,
      symbolTicker,
      calendarFromAccount,
      alertsFromAccount,
      settingsFromAccount,
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
      newsIssuesParams,
      newsDigestId,
      disclosureFlowParams,
      disclosureDigestId,
      todayBriefingDate,
      marketBriefingParams,
      etfInsightId,
      etfInsightDate,
      communityPostId,
      symbolTicker,
      calendarFromAccount,
      alertsFromAccount,
      settingsFromAccount,
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
      switchSettingsTab,
      showNewsIssues,
      showNewsDigest,
      showDisclosureFlow,
      showDisclosureDigest,
      showTodayBriefing,
      showMarketBriefing,
      showEtfInsights,
      showEtfInsight,
      showCalendar,
      showAlerts,
      showTermsHistory,
      showTerms,
      showBoard,
      showCommunityPost,
      showSymbol,
      showWatchlist,
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
      switchSettingsTab,
      showTabs,
      showNewsIssues,
      showNewsDigest,
      showDisclosureFlow,
      showDisclosureDigest,
      showTodayBriefing,
      showMarketBriefing,
      showEtfInsights,
      showEtfInsight,
      showCalendar,
      showAlerts,
      showTermsHistory,
      showTerms,
      showBoard,
      showCommunityPost,
      showSymbol,
      showWatchlist,
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
