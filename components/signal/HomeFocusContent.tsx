import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  COMFORT_GAP_LG,
  COMFORT_GAP_MD,
  COMFORT_GAP_PAGE,
  COMFORT_GAP_SM,
  COMFORT_PADDING_ROW_V,
} from '@/constants/comfortDensity';
import {
  FEED_BADGE_PX,
  FEED_BODY_PX,
  FEED_DIGEST_TITLE_PX,
  FEED_META_TIME_PX,
  FEED_META_TRAIL_PX,
  FEED_SUMMARY_PX,
} from '@/constants/feedTypography';
import { UI_RADIUS_CARD, UI_RADIUS_CARD_LG } from '@/constants/uiCornerRadius';
import {
  UI_FONT_WEIGHT_EMPHASIS,
  UI_FONT_WEIGHT_SECTION,
} from '@/constants/uiFontWeight';
import { AiBadge } from '@/components/signal/AiBadge';
import { HomeSectionHeader } from '@/components/signal/HomeSectionHeader';
import { communitySourceLabelId } from '@/components/community/CommunityPostCard';
import {
  briefingSourceIconEntries,
  digestSourceIconEntries,
  SourceIconStack,
} from '@/components/signal/SourceIconStack';
import { calendarProviderSourceEntries } from '@/domain/calendar/calendarProviderIcon';
import { CommunitySourceMark } from '@/components/signal/CommunitySourceMark';
import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import { cardListRowSeparatorStyle } from '@/components/signal/groupedFeedList';
import { SymbolLogo } from '@/components/signal/SymbolLogo';
import { COMMUNITY_SOURCES, communitySourceAccent } from '@/constants/communitySources';
import { SignalDateNavigator } from '@/components/signal/SignalDateNavigator';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import {
  HOME_DIGEST_CATEGORIES,
  HOME_SIGNAL_SESSIONS,
  type DisclosureFlowMarket,
  type HomeDigestCategory,
  type NewsIssuesCategory,
  type SignalSessionKey,
} from '@/constants/ipadHomeNav';
import { marketBriefingAccent, newsSegmentAccent } from '@/constants/segmentAccent';
import type { AppTheme } from '@/constants/theme';
import { webScrollViewportStyle, webShellBackground } from '@/constants/webLayout';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { NEWS_SEGMENT_LABEL } from '@/domain/news/feedFilters';
import { disclosureDigestCreatedIso, newsDigestCreatedIso } from '@/domain/digests/createdAt';
import { formatQuoteDpPct, formatUsd, formatKrw, isKoreaStockQuote, mapSignalQuoteToRow, quoteLookupKeys, type QuoteRow } from '@/domain/quotes/rows';
import { useIpadSidebarNavActions } from '@/contexts/IpadSidebarNavContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useRegisterWebHeaderRefresh } from '@/contexts/WebHeaderRefreshContext';
import { useQuoteChangeColors } from '@/hooks';
import { useResetRefreshingOnTabBlur } from '@/hooks/useResetRefreshingOnTabBlur';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useScrollToTopOnChange } from '@/hooks/useScrollToTopOnChange';
import { useSignalDatePickerSheet } from '@/hooks/useSignalDatePickerSheet';
import { getScreenFixedHeaderStyles } from '@/constants/screenFixedHeader';
import {
  SCREEN_LIST_CONTENT_PADDING_TOP,
} from '@/constants/screenLayout';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchSignalDisclosureDigests } from '@/integrations/signal-api/disclosureDigests';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { fetchSignalCalendar, signalCalendarToCalendarEvent } from '@/integrations/signal-api';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { fetchSignalMarketBriefings } from '@/integrations/signal-api/marketBriefings';
import { fetchSignalMarketQuotes } from '@/integrations/signal-api/market';
import { fetchSignalNewsDigests } from '@/integrations/signal-api/newsDigests';
import { fetchSignalTodayBriefing } from '@/integrations/signal-api/todayBriefings';
import { fetchSignalCommunity } from '@/integrations/signal-api/community';
import type {
  SignalApiCommunityPost,
  SignalApiDisclosureDigestItem,
  SignalApiMarketBriefing,
  SignalApiMarketQuote,
  SignalApiNewsDigestItem,
  SignalApiTodayBriefing,
} from '@/integrations/signal-api/types';
import type { MessageId } from '@/locales/messages';
import { hasSignalApi } from '@/services/env';
import {
  HOME_BOARD_DISPLAY_DEFAULT,
  loadHomeBoardDisplayCount,
  subscribeHomeBoardDisplayCountChanged,
} from '@/services/homeBoardDisplayPreference';
import {
  HOME_MARKET_BRIEFING_DISPLAY_DEFAULT,
  HOME_MARKET_BRIEFING_DISPLAY_MAX,
  loadHomeMarketBriefingDisplayCount,
  subscribeHomeMarketBriefingDisplayCountChanged,
} from '@/services/homeMarketBriefingDisplayPreference';
import {
  HOME_NEWS_FLOW_DISPLAY_DEFAULT,
  loadHomeNewsFlowDisplayCount,
  subscribeHomeNewsFlowDisplayCountChanged,
} from '@/services/homeNewsFlowDisplayPreference';
import {
  HOME_WATCHLIST_DISPLAY_DEFAULT,
  loadHomeWatchlistDisplayCount,
  subscribeHomeWatchlistDisplayCountChanged,
} from '@/services/homeWatchlistDisplayPreference';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import type { CalendarEvent } from '@/types/signal';
import {
  addDays,
  calendarEventDisplayYmd,
  calendarEventInLocalYmdRange,
  formatLocalYmdLabel,
  formatFeedItemTimeLabel,
  parseLocalYmd,
  toYmd,
  utcRangeForLocalYmd,
} from '@/utils/date';

const ISSUE_FETCH_LIMIT = 24;
const BRIEFING_LIMIT = 30;
const DISCLOSURE_LIMIT = 3;
const HOME_CALENDAR_LIMIT = 6;
const HOME_CALENDAR_LOOKAHEAD_DAYS = 14;

type HomeFocusContentProps = {
  selectedYmd: string;
  todayYmd: string;
  onSelectedYmdChange: (ymd: string) => void;
  scrollContentPaddingBottom?: number;
  headerAccessory?: ReactNode;
  showIssueSummary?: boolean;
  /** iPhone `SignalHeader` 브랜드 탭 → PTR 연결용 */
  onPullRefreshReady?: (refresh: () => void) => void;
};

type IssueRow = {
  category: HomeDigestCategory;
  item: SignalApiNewsDigestItem;
};

function shiftYmd(ymd: string, days: number): string {
  return toYmd(addDays(parseLocalYmd(ymd), days));
}

function issueSortTime(row: IssueRow): string {
  return String(row.item.generatedAt || row.item.sourceRefs[0]?.publishedAt || row.item.generatedDate || '');
}

function sortBriefingTime(row: SignalApiMarketBriefing): string {
  return String(row.publishedAt || row.updatedAt || row.createdAt || row.briefingDate || '');
}

function boardPostSortTime(post: SignalApiCommunityPost): string {
  return String(post.publishedAt || post.fetchedAt || post.updatedAt || '');
}

function sortBoardPostsByNewest(posts: SignalApiCommunityPost[]): SignalApiCommunityPost[] {
  return [...posts].sort((a, b) => boardPostSortTime(b).localeCompare(boardPostSortTime(a)));
}

function briefingLeadText(row: SignalApiMarketBriefing): string {
  const summary = String(row.summary || row.headline || '').trim();
  if (summary) return summary;
  return row.overview[0] || '';
}

/** 홈 미리보기 — 짧은 헤드라인 우선 (전문은 상세에서) */
function briefingHomeTitle(row: SignalApiMarketBriefing): string {
  const headline = String(row.headline || '').trim();
  if (headline) return headline;
  return briefingLeadText(row);
}

function briefingVisibleKey(row: SignalApiMarketBriefing): string {
  return [row.market, row.session, briefingLeadText(row)].map((part) => String(part || '').trim().toLowerCase()).join('|');
}

function uniqueVisibleBriefings(rows: SignalApiMarketBriefing[]): SignalApiMarketBriefing[] {
  const seen = new Set<string>();
  const unique: SignalApiMarketBriefing[] = [];
  for (const row of rows) {
    const key = briefingVisibleKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }
  return unique;
}

async function fetchTopIssues(
  date: string,
  locale: string,
  cacheMode: ReturnType<typeof signalCacheMode>,
): Promise<IssueRow[]> {
  const range = utcRangeForLocalYmd(date);
  const results = await Promise.all(
    HOME_DIGEST_CATEGORIES.map(async (category) => {
      const page = await fetchSignalNewsDigests(
        {
          category,
          ...range,
          limit: ISSUE_FETCH_LIMIT,
          batches: 3,
          locale,
        },
        { cacheMode },
      ).catch(() => ({ items: [] as SignalApiNewsDigestItem[] }));
      return [...page.items]
        .sort(
          (a, b) =>
            String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')) ||
            b.count - a.count,
        )
        .map((item) => ({ category, item }));
    }),
  );
  return results.flat().sort((a, b) => issueSortTime(b).localeCompare(issueSortTime(a)) || b.item.count - a.item.count);
}

async function fetchTodayBriefingWithFallback(
  date: string,
  locale: string,
  cacheMode: ReturnType<typeof signalCacheMode>,
): Promise<SignalApiTodayBriefing | null> {
  const primary = await fetchSignalTodayBriefing({ date, locale }, { cacheMode }).catch(() => null);
  if (primary || locale === 'ko') return primary;
  return fetchSignalTodayBriefing({ date, locale: 'ko' }, { cacheMode }).catch(() => null);
}

function formatPrice(row: QuoteRow): string {
  const value = row.quote?.currentPrice;
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return isKoreaStockQuote(row) ? formatKrw(value) : formatUsd(value);
}

function disclosureMarketLabel(market: string, locale: string): string {
  const key = String(market || '').trim().toLowerCase();
  if (key === 'kr') return locale === 'ko' ? '한국' : locale === 'ja' ? '韓国' : 'Korea';
  if (key === 'us') return locale === 'ko' ? '미국' : locale === 'ja' ? '米国' : 'US';
  return key ? key.toUpperCase() : 'SIGNAL';
}

function signalSessionKeyForBriefing(row?: SignalApiMarketBriefing): SignalSessionKey | undefined {
  if (!row) return undefined;
  return HOME_SIGNAL_SESSIONS.find(
    (session) => session.market === row.market && session.session === row.session,
  )?.key;
}

function sortCalendarEvents(rows: CalendarEvent[]): CalendarEvent[] {
  return [...rows].sort(
    (a, b) =>
      calendarEventDisplayYmd(a).localeCompare(calendarEventDisplayYmd(b)) ||
      String(a.time || '').localeCompare(String(b.time || '')) ||
      a.title.localeCompare(b.title),
  );
}

function filterHomeCalendarEvents(
  rows: CalendarEvent[],
  watchlist: string[],
  fromYmd: string,
  toYmd: string,
): CalendarEvent[] {
  const watch = new Set(watchlist.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
  return sortCalendarEvents(
    rows.filter((row) => {
      if (!calendarEventInLocalYmdRange(row, fromYmd, toYmd)) return false;
      if (row.type === 'fed' || row.type === 'fomc' || row.type === 'holiday') return true;
      if (row.type !== 'earnings') return false;
      const symbol = String(row.symbol || '').trim().toUpperCase();
      return !!symbol && watch.has(symbol);
    }),
  );
}

function calendarTypeLabelId(type: CalendarEvent['type']): MessageId {
  if (type === 'earnings') return 'calendarTagEarnings';
  if (type === 'fed') return 'calendarTagFed';
  if (type === 'fomc') return 'calendarTagFomc';
  if (type === 'holiday') return 'calendarTagHoliday';
  return 'calendarTagMacro';
}

export function HomeFocusContent({
  selectedYmd,
  todayYmd,
  onSelectedYmdChange,
  scrollContentPaddingBottom = 28,
  headerAccessory,
  showIssueSummary = false,
  onPullRefreshReady,
}: HomeFocusContentProps) {
  const router = useRouter();
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const quoteChange = useQuoteChangeColors();
  const { t, locale } = useLocale();
  const ipadNav = useIpadSidebarNavActions();
  const { useTwoPane } = useResponsiveLayout();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const selectedIsToday = selectedYmd >= todayYmd;
  const selectedIsExactToday = selectedYmd === todayYmd;
  const loadedYmdRef = useRef<string | null>(null);
  const loadGenerationRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  const [error, setError] = useState<string | null>(null);
  const [newsFlowDisplayCount, setNewsFlowDisplayCount] = useState(HOME_NEWS_FLOW_DISPLAY_DEFAULT);
  const [watchlistDisplayCount, setWatchlistDisplayCount] = useState(HOME_WATCHLIST_DISPLAY_DEFAULT);
  const [boardDisplayCount, setBoardDisplayCount] = useState(HOME_BOARD_DISPLAY_DEFAULT);
  const [marketBriefingDisplayCount, setMarketBriefingDisplayCount] = useState(
    HOME_MARKET_BRIEFING_DISPLAY_DEFAULT,
  );
  const [homeDisplayPrefsReady, setHomeDisplayPrefsReady] = useState(false);
  const [boardPosts, setBoardPosts] = useState<SignalApiCommunityPost[]>([]);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [briefings, setBriefings] = useState<SignalApiMarketBriefing[]>([]);
  const [todayBriefing, setTodayBriefing] = useState<SignalApiTodayBriefing | null>(null);
  const [disclosures, setDisclosures] = useState<SignalApiDisclosureDigestItem[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const visibleCalendarEvents = useMemo(
    () => calendarEvents.slice(0, HOME_CALENDAR_LIMIT),
    [calendarEvents],
  );
  const hiddenCalendarCount = Math.max(0, calendarEvents.length - visibleCalendarEvents.length);
  const homeIssues = useMemo(
    () =>
      [...issues]
        .sort((a, b) => issueSortTime(b).localeCompare(issueSortTime(a)) || b.item.count - a.item.count)
        .slice(0, newsFlowDisplayCount),
    [issues, newsFlowDisplayCount],
  );
  const homeBriefings = useMemo(
    () => briefings.slice(0, marketBriefingDisplayCount),
    [briefings, marketBriefingDisplayCount],
  );
  const { ref: scrollRef } = useScrollToTopOnChange([selectedYmd], {
    resyncDeps: [issues, briefings, todayBriefing, disclosures, calendarEvents, boardPosts, loading],
  });
  const scrollResetKey = selectedYmd;

  const selectedDateLabel = useMemo(
    () =>
      formatLocalYmdLabel(selectedYmd, locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      }),
    [locale, selectedYmd],
  );

  const changeSelectedYmd = useCallback(
    (ymd: string) => {
      onSelectedYmdChange(ymd > todayYmd ? todayYmd : ymd);
    },
    [onSelectedYmdChange, todayYmd],
  );

  const { openDatePicker, datePickerSheet } = useSignalDatePickerSheet({
    selectedYmd,
    todayYmd,
    onSelectYmd: changeSelectedYmd,
  });

  const load = useCallback(async (forceRefresh?: boolean) => {
    const generation = ++loadGenerationRef.current;
    if (!hasSignalApi()) {
      setIssues([]);
      setQuotes([]);
      setBriefings([]);
      setTodayBriefing(null);
      setDisclosures([]);
      setCalendarEvents([]);
      setBoardPosts([]);
      setError(t('errorSignalApiShort'));
      return;
    }
    const cacheMode = signalCacheMode(forceRefresh);
    setError(null);
    try {
      const watchlist = await loadWatchlistSymbols();
      const symbols = selectedYmd === todayYmd ? watchlist.slice(0, watchlistDisplayCount) : [];
      // Clear below-fold sections so prior-date data does not linger during wave 2.
      setBriefings([]);
      setDisclosures([]);
      setCalendarEvents([]);
      setBoardPosts([]);
      const fetchBoardPosts =
        selectedYmd === todayYmd
          ? Promise.all(
              COMMUNITY_SOURCES.map((source) =>
                fetchSignalCommunity({ source, limit: boardDisplayCount }, { cacheMode }).catch(
                  () => ({ items: [] as SignalApiCommunityPost[] }),
                ),
              ),
            ).then((pages) => ({
              items: sortBoardPostsByNewest(
                COMMUNITY_SOURCES.flatMap((_, index) => pages[index]?.items ?? []),
              ),
            }))
          : Promise.resolve({ items: [] as SignalApiCommunityPost[] });

      /** Wave 1 — above-the-fold: briefing, issues, watchlist quotes. */
      const [todayBriefing, nextIssues, quoteRows] = await Promise.all([
        fetchTodayBriefingWithFallback(selectedYmd, locale, cacheMode),
        fetchTopIssues(selectedYmd, locale, cacheMode),
        symbols.length > 0
          ? fetchSignalMarketQuotes({ symbols, limit: symbols.length }, { cacheMode }).catch(
              () => [] as SignalApiMarketQuote[],
            )
          : Promise.resolve([] as SignalApiMarketQuote[]),
      ]);

      const quoteBySymbol = new Map<string, QuoteRow>();
      for (const item of quoteRows) {
        const row = mapSignalQuoteToRow(item);
        for (const key of quoteLookupKeys(item, row)) quoteBySymbol.set(key, row);
      }
      if (generation !== loadGenerationRef.current) return;
      setTodayBriefing(todayBriefing);
      setIssues(nextIssues);
      setQuotes(
        symbols.map((symbol) => {
          const key = symbol.trim().toUpperCase();
          return quoteBySymbol.get(key) ?? { symbol, quote: null, error: 'NO_SERVER_QUOTE' };
        }),
      );

      /** Wave 2 — below-fold; runs after first paint (load returns after wave 1). */
      void (async () => {
        const [briefings, disclosurePage, calendarRows, boardPage] = await Promise.all([
          fetchSignalMarketBriefings(
            { ...utcRangeForLocalYmd(selectedYmd), limit: BRIEFING_LIMIT, locale },
            { cacheMode },
          ).catch(() => []),
          fetchSignalDisclosureDigests(
            { ...utcRangeForLocalYmd(selectedYmd), limit: DISCLOSURE_LIMIT, batches: 1, locale },
            { cacheMode },
          ).catch(() => ({ items: [] })),
          fetchSignalCalendar(
            {
              from: shiftYmd(selectedYmd, -1),
              to: shiftYmd(selectedYmd, HOME_CALENDAR_LOOKAHEAD_DAYS),
              limit: 120,
            },
            { cacheMode },
          ).catch(() => []),
          fetchBoardPosts,
        ]);

        if (generation !== loadGenerationRef.current) return;
        setBriefings(
          uniqueVisibleBriefings(
            [...briefings].sort((a, b) => sortBriefingTime(b).localeCompare(sortBriefingTime(a))),
          ).slice(0, HOME_MARKET_BRIEFING_DISPLAY_MAX),
        );
        setDisclosures(disclosurePage.items.slice(0, DISCLOSURE_LIMIT));
        setCalendarEvents(
          filterHomeCalendarEvents(
            calendarRows
              .map((row) => signalCalendarToCalendarEvent(row))
              .filter((row): row is CalendarEvent => row != null),
            watchlist,
            selectedYmd,
            shiftYmd(selectedYmd, HOME_CALENDAR_LOOKAHEAD_DAYS),
          ),
        );
        if (selectedYmd === todayYmd) {
          setBoardPosts(boardPage.items ?? []);
        } else {
          setBoardPosts([]);
        }
      })();
    } catch (e) {
      if (generation !== loadGenerationRef.current) return;
      setError(formatSignalApiError(e, t, 'ipadHomeLoadError'));
    }
  }, [locale, selectedYmd, t, todayYmd, watchlistDisplayCount, boardDisplayCount]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    onPullRefreshReady?.(() => void refresh());
  }, [onPullRefreshReady, refresh]);

  useRegisterWebHeaderRefresh(() => void refresh(), showIssueSummary ? 'mount' : 'focus');

  useEffect(() => {
    if (!homeDisplayPrefsReady) return;
    let cancelled = false;
    const needsInitialLoad = loadedYmdRef.current !== selectedYmd;
    if (needsInitialLoad) setLoading(true);
    void (async () => {
      try {
        await load();
        if (!cancelled) loadedYmdRef.current = selectedYmd;
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, selectedYmd, homeDisplayPrefsReady]);

  useEffect(() => {
    if (selectedYmd > todayYmd) changeSelectedYmd(todayYmd);
  }, [changeSelectedYmd, selectedYmd, todayYmd]);

  const reloadHomeDisplayPrefs = useCallback(async () => {
    const [newsFlow, watchlist, board, marketBriefing] = await Promise.all([
      loadHomeNewsFlowDisplayCount(),
      loadHomeWatchlistDisplayCount(),
      loadHomeBoardDisplayCount(),
      loadHomeMarketBriefingDisplayCount(),
    ]);
    setNewsFlowDisplayCount(newsFlow);
    setWatchlistDisplayCount(watchlist);
    setBoardDisplayCount(board);
    setMarketBriefingDisplayCount(marketBriefing);
    setHomeDisplayPrefsReady(true);
  }, []);

  useEffect(() => {
    void reloadHomeDisplayPrefs();
    const unsubscribers = [
      subscribeHomeNewsFlowDisplayCountChanged(() => {
        void reloadHomeDisplayPrefs();
      }),
      subscribeHomeWatchlistDisplayCountChanged(() => {
        void reloadHomeDisplayPrefs();
      }),
      subscribeHomeBoardDisplayCountChanged(() => {
        void reloadHomeDisplayPrefs();
      }),
      subscribeHomeMarketBriefingDisplayCountChanged(() => {
        void reloadHomeDisplayPrefs();
      }),
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [reloadHomeDisplayPrefs]);

  const openIssue = useCallback(
    (row?: IssueRow) => {
      const params: Record<string, string> = {
        date: selectedYmd,
        category: row?.category ?? 'all',
      };
      if (row?.item.id) params.digestId = row.item.id;
      if (ipadNav.isAvailable) {
        ipadNav.showNewsIssues(
          {
            category: params.category as NewsIssuesCategory,
            date: params.date,
            digestId: params.digestId ?? null,
          },
          { drillFrom: 'home' },
        );
        return;
      }
      router.push({
        pathname: '/news-issues',
        params,
      } as Href);
    },
    [ipadNav, router, selectedYmd],
  );

  const openSignal = useCallback(
    (row?: SignalApiMarketBriefing) => {
      const session = signalSessionKeyForBriefing(row);
      const params = { date: selectedYmd, ...(session ? { session } : null) };
      if (ipadNav.isAvailable) {
        ipadNav.showMarketBriefing(session, selectedYmd, { drillFrom: 'home' });
        return;
      }
      router.push({
        pathname: '/market-briefing',
        params,
      } as never);
    },
    [ipadNav, router, selectedYmd],
  );

  const openQuotes = useCallback(() => {
    if (ipadNav.isAvailable) {
      ipadNav.showTabs();
    }
    router.navigate('/(tabs)/quotes' as never);
  }, [ipadNav, router]);

  const openBoard = useCallback(() => {
    if (ipadNav.isAvailable) {
      ipadNav.showBoard({ drillFrom: 'home' });
      return;
    }
    router.push('/more-board' as never);
  }, [ipadNav, router]);

  const openSymbolDetail = useCallback(
    (symbol: string) => {
      const trimmed = symbol.trim().toUpperCase();
      if (!trimmed || trimmed === '—') return;
      if (ipadNav.isAvailable) {
        ipadNav.showSymbol(trimmed, { drillFrom: 'home' });
        return;
      }
      router.push(`/symbol/${encodeURIComponent(trimmed)}` as never);
    },
    [ipadNav, router],
  );

  const openDisclosureFlow = useCallback(
    (row?: SignalApiDisclosureDigestItem) => {
      const params: Record<string, string> = { date: selectedYmd };
      const rowMarket = String(row?.market || '').trim().toLowerCase();
      if (rowMarket === 'us' || rowMarket === 'kr') {
        params.market = rowMarket;
      }
      if (row?.id) params.digestId = row.id;
      if (ipadNav.isAvailable) {
        ipadNav.showDisclosureFlow(
          {
            date: params.date,
            market: (params.market as DisclosureFlowMarket | undefined) ?? 'all',
            digestId: params.digestId ?? null,
          },
          { drillFrom: 'home' },
        );
        return;
      }
      router.push({
        pathname: '/disclosure-flow',
        params,
      } as unknown as Href);
    },
    [ipadNav, router, selectedYmd],
  );

  const openDisclosureDetail = useCallback(
    (row: SignalApiDisclosureDigestItem) => {
      const primary = String(row.primaryDisclosureId || '').trim();
      const refId = row.sourceRefs.find((ref) => String(ref.id || '').trim())?.id;
      const id = primary || (refId ? String(refId).trim() : '');
      if (!id) {
        openDisclosureFlow(row);
        return;
      }
      router.push(`/disclosures/${encodeURIComponent(id)}` as Href);
    },
    [openDisclosureFlow, router],
  );

  const openCalendar = useCallback(() => {
    if (ipadNav.isAvailable) {
      ipadNav.showCalendar({ drillFrom: 'home' });
      return;
    }
    router.navigate('/calendar' as never);
  }, [ipadNav, router]);

  const openTodayBriefing = useCallback(() => {
    if (ipadNav.isAvailable) {
      ipadNav.showTodayBriefing(selectedYmd, { drillFrom: 'home' });
      return;
    }
    router.navigate({
      pathname: '/today-briefing',
      params: { date: selectedYmd },
    } as never);
  }, [ipadNav, router, selectedYmd]);

  const formatCalendarDateLabel = useCallback(
    (event: CalendarEvent) =>
      formatLocalYmdLabel(calendarEventDisplayYmd(event), locale, {
        month: 'short',
        day: 'numeric',
        weekday: 'short',
      }),
    [locale],
  );

  const renderTodayBriefingCard = useCallback(
    (item: SignalApiTodayBriefing) => {
      const leadText = item.headline?.trim() || item.summary?.trim() || '';
      const bodyText = item.summary?.trim() || '';
      const previewText = bodyText && bodyText !== leadText ? bodyText : '';
      return (
        <Pressable
          onPress={openTodayBriefing}
          accessibilityRole="button"
          accessibilityLabel={t('ipadHomeTitle')}
          style={({ pressed }) => [
            styles.heroCard,
            showIssueSummary && styles.heroCardSummary,
            pressed && styles.pressed,
          ]}>
          <View style={styles.issueGroupList}>
            <View style={styles.issueGroupItem}>
              {leadText ? (
                <Text style={styles.issueGroupTitle} numberOfLines={showIssueSummary ? 3 : 2}>
                  {leadText}
                </Text>
              ) : null}
              {previewText ? (
                <Text style={styles.signalText} numberOfLines={showIssueSummary ? 4 : 3}>
                  {previewText}
                </Text>
              ) : null}
              {item.keyPoints.length > 0 ? (
                <View style={styles.overviewMiniList}>
                  {item.keyPoints.slice(0, 2).map((point, index) => (
                    <Text key={`${item.id}-point-${index}`} style={styles.issueGroupSummary} numberOfLines={1}>
                      {point}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
      );
    },
    [openTodayBriefing, showIssueSummary, styles, t],
  );

  const renderIssueCard = useCallback(
    (rows: IssueRow[]) => (
      <View style={[styles.heroCard, styles.heroCardCompact, showIssueSummary && styles.heroCardSummary]}>
        <View style={styles.issueGroupList}>
          {rows.map((row, index) => {
            const sourceEntries = digestSourceIconEntries(row.item.sourceRefs, row.item.sources);
            const trailText = [row.item.topics[0], row.item.symbols[0]].filter(Boolean).join(' · ');
            return (
              <HomeDigestFeedRow
                key={row.item.id}
                title={row.item.title}
                titleLines={2}
                timeLabel={formatFeedItemTimeLabel(newsDigestCreatedIso(row.item), locale)}
                trailText={trailText || null}
                summary={showIssueSummary ? row.item.summary : null}
                sourceEntries={sourceEntries}
                bordered={index < rows.length - 1}
                onPress={() => openIssue(row)}
                footerLead={
                  <View
                    accessible
                    accessibilityRole="image"
                    accessibilityLabel={t(NEWS_SEGMENT_LABEL[row.category])}>
                    <CommunitySourceMark
                      accent={newsSegmentAccent(row.category, theme)}
                      size={18}
                      style={styles.boardSourceMark}
                    />
                  </View>
                }
              />
            );
          })}
        </View>
      </View>
    ),
    [openIssue, showIssueSummary, styles, locale, t, theme],
  );

  const renderSignalCard = useCallback(
    (rows: SignalApiMarketBriefing[]) => (
      <View style={[styles.heroCard, showIssueSummary && styles.heroCardSummary]}>
        <View style={styles.issueGroupList}>
          {rows.map((row, index) => {
            const session = HOME_SIGNAL_SESSIONS.find(
              (candidate) => candidate.market === row.market && candidate.session === row.session,
            );
            const sourceEntries = briefingSourceIconEntries(row.sourceRefs);
            const sessionLabel = session
              ? t(session.labelId as MessageId)
              : t('briefingSessionEmptyTitle');
            const marketA11y =
              String(row.market || '').trim().toLowerCase() === 'kr'
                ? disclosureMarketLabel('kr', locale)
                : disclosureMarketLabel('us', locale);
            return (
              <HomeDigestFeedRow
                key={row.id}
                variant="signal"
                title={briefingHomeTitle(row)}
                titleLines={2}
                timeLabel={formatFeedItemTimeLabel(sortBriefingTime(row), locale)}
                trailText={sessionLabel}
                sourceEntries={sourceEntries}
                bordered={index < rows.length - 1}
                onPress={() => openSignal(row)}
                footerLead={
                  <View accessible accessibilityRole="image" accessibilityLabel={marketA11y}>
                    <CommunitySourceMark
                      accent={marketBriefingAccent(row.market, theme)}
                      size={18}
                      style={styles.boardSourceMark}
                    />
                  </View>
                }
              />
            );
          })}
        </View>
      </View>
    ),
    [locale, openSignal, showIssueSummary, styles, t, theme],
  );

  const renderDisclosureCard = useCallback(
    (rows: SignalApiDisclosureDigestItem[]) => (
      <View style={[styles.heroCard, showIssueSummary && styles.heroCardSummary]}>
        <View style={styles.issueGroupList}>
          {rows.map((row, index) => (
            <Pressable
              key={row.id}
              onPress={() => openDisclosureDetail(row)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.issueGroupItem,
                index < rows.length - 1 && styles.issueGroupItemBorder,
                pressed && styles.pressed,
              ]}>
              <View style={styles.issueRowTop}>
                <View style={styles.disclosurePillRow}>
                  <Text style={styles.disclosureMarketPill}>{disclosureMarketLabel(row.market, locale)}</Text>
                  {row.forms[0] ? (
                    <Text style={styles.disclosureFormPill} numberOfLines={1}>
                      {row.forms[0]}
                    </Text>
                  ) : null}
                  {row.symbols.length > 0 ? (
                    <Text style={styles.issueInlineMetaText} numberOfLines={1}>
                      {row.symbols.slice(0, 3).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.issueGroupMetaText} numberOfLines={1}>
                  {formatFeedItemTimeLabel(disclosureDigestCreatedIso(row), locale)}
                </Text>
              </View>
              <Text style={styles.issueGroupTitle} numberOfLines={2}>
                {row.title}
              </Text>
              {showIssueSummary && row.summary ? (
                <Text style={styles.issueGroupSummary} numberOfLines={1}>
                  {row.summary}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>
    ),
    [locale, openDisclosureDetail, showIssueSummary, styles, t],
  );

  const renderCalendarCard = useCallback(
    (rows: CalendarEvent[]) => (
      <View style={[styles.heroCard, showIssueSummary && styles.heroCardSummary]}>
        <View style={styles.issueGroupList}>
          {rows.map((event, index) => {
            const sourceEntries = calendarProviderSourceEntries(event.provider);
            return (
            <Pressable
              key={event.id}
              onPress={openCalendar}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.issueGroupItem,
                index < rows.length - 1 && styles.issueGroupItemBorder,
                pressed && styles.pressed,
              ]}>
              <View style={styles.issueRowTop}>
                <View style={styles.calendarPillRow}>
                  <Text style={styles.calendarDatePill}>{formatCalendarDateLabel(event)}</Text>
                  <Text style={styles.calendarTypePill}>{t(calendarTypeLabelId(event.type))}</Text>
                  {event.symbol ? (
                    <Text style={styles.issueInlineMetaText} numberOfLines={1}>
                      {event.symbol}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.issueGroupMetaText} numberOfLines={1}>
                  {[event.time, event.country].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>
              <Text style={styles.issueGroupTitle} numberOfLines={2}>
                {event.title}
              </Text>
              {sourceEntries.length > 0 ? (
                <View style={styles.calendarSourceFooter}>
                  <SourceIconStack sources={sourceEntries} size={18} maxVisible={2} />
                </View>
              ) : null}
            </Pressable>
            );
          })}
        </View>
      </View>
    ),
    [formatCalendarDateLabel, openCalendar, showIssueSummary, styles, t],
  );

  const renderBoardCard = useCallback(
    () => (
      <View style={[styles.heroCard, styles.heroCardCompact]}>
        {boardPosts.length > 0 ? (
          <View style={styles.issueGroupList}>
            {boardPosts.map((post, index) => {
              const sourceLabel = t(communitySourceLabelId(post.source));
              const sourceAccent = communitySourceAccent(post.source, theme);
              return (
                <HomeDigestFeedRow
                  key={post.id}
                  title={post.title}
                  titleLines={2}
                  timeLabel={formatFeedItemTimeLabel(post.publishedAt, locale)}
                  summary={post.body?.trim() || null}
                  summaryLines={1}
                  footerLead={
                    <View style={styles.boardFooterLead}>
                      <CommunitySourceMark accent={sourceAccent} size={18} style={styles.boardSourceMark} />
                      <Text style={styles.boardSourceLabel} numberOfLines={1}>
                        {sourceLabel}
                      </Text>
                    </View>
                  }
                  bordered={index < boardPosts.length - 1}
                  onPress={() => {
                    if (ipadNav.isAvailable) {
                      ipadNav.showCommunityPost(post.id, { drillFrom: 'home' });
                      return;
                    }
                    router.push(`/community/${encodeURIComponent(post.id)}`);
                  }}
                />
              );
            })}
          </View>
        ) : (
          <Text style={styles.boardEmptyText}>{t('homeFocusBoardEmpty')}</Text>
        )}
      </View>
    ),
    [boardPosts, locale, router, styles, t, theme],
  );

  return (
    <>
    <View style={styles.root}>
      <View style={[styles.topFixed, useTwoPane && styles.topFixedWide]}>
        {headerAccessory}
        <SignalDateNavigator
          label={selectedDateLabel}
          previousA11y={t('insightDatePrevious')}
          nextA11y={t('insightDateNext')}
          labelA11y={t('insightOpenCalendar')}
          todayLabel={t('insightCalendarToday')}
          onPrevious={() => changeSelectedYmd(shiftYmd(selectedYmd, -1))}
          onNext={() => changeSelectedYmd(shiftYmd(selectedYmd, 1))}
          onPressLabel={openDatePicker}
          onToday={() => changeSelectedYmd(todayYmd)}
          showToday={!selectedIsToday}
          nextDisabled={selectedIsToday}
        />
      </View>

      <WebWheelScrollView
        ref={scrollRef as never}
        scrollResetKey={scrollResetKey}
        contentRevision={[issues, briefings, todayBriefing, disclosures, calendarEvents, boardPosts, loading]}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: scrollContentPaddingBottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <SignalLoadingIndicator message={t('commonLoading')} />
          </View>
        ) : (
          <>
          <View style={styles.heroStack}>
            {todayBriefing ? (
              <View style={styles.heroBlock}>
                <HomeSectionHeader
                  title={t('ipadHomeTitle')}
                  subtitle={t('ipadHomeTodayBriefingSubtitle')}
                  badge={<AiBadge />}
                  onPress={openTodayBriefing}
                  accessibilityLabel={t('commonViewAll')}
                />
                {renderTodayBriefingCard(todayBriefing)}
              </View>
            ) : null}

            <View style={[styles.heroBlock, styles.heroBlockCompact]}>
              <HomeSectionHeader
                title={t('newsIssuesTitle')}
                subtitle={t('ipadHomeIssuesSubtitle')}
                badge={<AiBadge />}
                onPress={() => openIssue()}
                accessibilityLabel={t('commonViewAll')}
              />
              {homeIssues.length > 0 ? (
                renderIssueCard(homeIssues)
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>{t('ipadHomeIssuesEmpty')}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={[styles.section, styles.heroBlockCompact]}>
            <HomeSectionHeader
              title={t('ipadHomeSignalTitle')}
              subtitle={t('ipadHomeSignalSubtitle')}
              badge={<AiBadge />}
              onPress={homeBriefings.length > 0 ? openSignal : undefined}
              accessibilityLabel={homeBriefings.length > 0 ? t('commonViewAll') : undefined}
            />
            {homeBriefings.length > 0 ? (
              renderSignalCard(homeBriefings)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  {t('homeFocusSignalEmpty')}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <HomeSectionHeader
              title={t('disclosureFlowTitle')}
              subtitle={t('disclosureFlowSubtitle')}
              badge={<AiBadge />}
              onPress={() => openDisclosureFlow()}
              accessibilityLabel={t('commonViewAll')}
            />
            {disclosures.length > 0 ? (
              renderDisclosureCard(disclosures)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t('disclosureFlowEmpty')}</Text>
              </View>
            )}
          </View>

          {selectedIsExactToday ? (
            <View style={styles.section}>
              <HomeSectionHeader
                title={t('screenBoard')}
                subtitle={t('homeFocusBoardSubtitle')}
                onPress={openBoard}
                accessibilityLabel={t('commonViewAll')}
              />
              {renderBoardCard()}
            </View>
          ) : null}

          {selectedIsExactToday ? (
            <View style={styles.section}>
                <HomeSectionHeader title={t('homeFocusWatchTitle')} onPress={openQuotes} accessibilityLabel={t('commonViewAll')} />
                <View style={styles.quoteGrid}>
                  {quotes.length === 0 ? (
                    <Text style={styles.emptyText}>{t('quotesEmptyWatch')}</Text>
                  ) : (
                    quotes.slice(0, watchlistDisplayCount).map((row, index) => {
                      const pct = row.quote?.changePercent;
                      const up = typeof pct === 'number' && pct >= 0;
                      return (
                        <Pressable
                          key={`${row.symbol}-${index}`}
                          onPress={() => openSymbolDetail(row.symbol)}
                          accessibilityRole="button"
                          accessibilityLabel={row.symbol}
                          style={({ pressed }) => [styles.quoteTile, pressed && styles.pressed]}>
                          <View style={styles.quoteTileContent}>
                            <View style={styles.quoteTileLead}>
                              <SymbolLogo symbol={row.symbol} size={22} />
                              <Text style={styles.quoteSymbol} numberOfLines={1}>
                                {row.symbol}
                              </Text>
                            </View>
                            <View style={styles.quoteTileFooter}>
                              <Text style={styles.priceText} numberOfLines={1}>
                                {formatPrice(row)}
                              </Text>
                              <Text style={[styles.changeText, { color: up ? quoteChange.colors.up : quoteChange.colors.down }]}>
                                {formatQuoteDpPct(pct)}
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </View>
          ) : null}

          <View style={styles.section}>
            <HomeSectionHeader
              title={t('ipadHomeCalendarTitle')}
              subtitle={t('ipadHomeCalendarSubtitle')}
              onPress={openCalendar}
              accessibilityLabel={t('commonViewAll')}
            />
            {visibleCalendarEvents.length > 0 ? (
              <>
                {renderCalendarCard(visibleCalendarEvents)}
                {hiddenCalendarCount > 0 ? (
                  <Pressable
                    onPress={openCalendar}
                    accessibilityRole="button"
                    accessibilityLabel={t('ipadHomeCalendarMore', { count: String(hiddenCalendarCount) })}
                    style={({ pressed }) => [styles.calendarMoreRow, pressed && styles.pressed]}>
                    <Text style={styles.calendarMoreText}>
                      {t('ipadHomeCalendarMore', { count: String(hiddenCalendarCount) })}
                    </Text>
                    <FontAwesome name="chevron-right" size={11} color={theme.textDim} />
                  </Pressable>
                ) : null}
              </>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t('ipadHomeCalendarEmpty')}</Text>
              </View>
            )}
          </View>
        </>
      )}
      </WebWheelScrollView>
    </View>
    {datePickerSheet}
    </>
  );
}

function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
) {
  const fixedHeader = getScreenFixedHeaderStyles(theme);
  return StyleSheet.create({
    root: {
      flex: 1,
      minHeight: 0,
    },
    topFixed: fixedHeader.strip,
    topFixedWide: fixedHeader.stripWide,
    scroll: {
      ...webScrollViewportStyle,
      flex: 1,
      minHeight: 0,
      backgroundColor: webShellBackground(theme.bg),
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP,
      gap: COMFORT_GAP_PAGE,
    },
    errorBox: {
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.danger,
      backgroundColor: theme.dangerDim,
      padding: 12,
    },
    errorText: {
      fontSize: sf(13),
      lineHeight: sf(18),
      fontWeight: UI_FONT_WEIGHT_EMPHASIS,
      color: theme.danger,
    },
    loadingBox: {
      minHeight: 260,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroStack: {
      gap: COMFORT_GAP_LG,
    },
    heroBlock: {
      gap: COMFORT_GAP_SM,
    },
    heroBlockCompact: {
      gap: COMFORT_GAP_SM,
    },
    heroHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: COMFORT_GAP_SM,
    },
    heroKicker: {
      fontSize: sf(18),
      lineHeight: sf(24),
      fontWeight: UI_FONT_WEIGHT_SECTION,
      color: theme.text,
    },
    heroCard: {
      position: 'relative',
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 12,
      paddingVertical: COMFORT_PADDING_ROW_V,
      gap: COMFORT_GAP_SM,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    },
    heroCardCompact: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 4,
    },
    heroCardSummary: {
      minHeight: 0,
    },
    issueRowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: COMFORT_GAP_SM,
    },
    issueGroupList: {
      gap: 0,
    },
    issueGroupItem: {
      gap: COMFORT_GAP_SM,
      paddingVertical: ft.row(6),
      borderRadius: UI_RADIUS_CARD,
    },
    issueGroupItemBorder: cardListRowSeparatorStyle(theme),
    issueGroupTitle: {
      fontSize: ft.ff(FEED_DIGEST_TITLE_PX),
      lineHeight: sf(20),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    calendarSourceFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 2,
    },
    issueGroupSummary: {
      fontSize: ft.ff(FEED_SUMMARY_PX),
      lineHeight: sf(15),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
      marginTop: 1,
    },
    overviewMiniList: {
      gap: 2,
      marginTop: 2,
    },
    issueGroupMetaText: {
      flexShrink: 0,
      fontSize: ft.ff(FEED_META_TIME_PX),
      lineHeight: sf(14),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    issueInlineMetaText: {
      minWidth: 0,
      flexShrink: 1,
      fontSize: ft.ff(FEED_META_TIME_PX),
      lineHeight: sf(14),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    section: {
      gap: COMFORT_GAP_LG,
    },
    quoteGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: COMFORT_GAP_MD,
    },
    quoteTile: {
      width: '48%',
      minHeight: 54,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.colorScheme === 'dark' ? theme.bgElevated : theme.card,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOpacity: 0.03,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
    boardEmptyText: {
      fontSize: ft.ff(FEED_SUMMARY_PX),
      lineHeight: sf(15),
      fontWeight: ft.bodyWeight,
      color: theme.textDim,
      marginTop: 4,
    },
    boardFooterLead: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    boardSourceMark: {
      borderWidth: 0,
      backgroundColor: 'transparent',
    },
    boardSourceLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.ff(FEED_META_TIME_PX),
      lineHeight: sf(14),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    quoteTileContent: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 7,
      gap: COMFORT_GAP_SM,
    },
    quoteTileLead: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    quoteTileFooter: {
      minWidth: 62,
      gap: 2,
      alignItems: 'flex-end',
    },
    quoteRow: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      gap: COMFORT_GAP_MD,
      paddingHorizontal: 14,
      paddingVertical: COMFORT_PADDING_ROW_V,
    },
    rowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    quoteNameCol: {
      flex: 1,
      minWidth: 0,
    },
    quoteSymbol: {
      fontSize: ft.ff(14),
      lineHeight: sf(18),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    quoteName: {
      marginTop: 2,
      fontSize: ft.ff(12),
      lineHeight: sf(16),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    priceBox: {
      minWidth: 88,
      borderRadius: UI_RADIUS_CARD,
      paddingHorizontal: 10,
      paddingVertical: 10,
      alignItems: 'flex-end',
    },
    priceText: {
      fontSize: ft.ff(13),
      lineHeight: sf(17),
      fontWeight: ft.emphasisWeight,
      color: theme.text,
    },
    changeText: {
      marginTop: 2,
      fontSize: ft.ff(12),
      lineHeight: sf(16),
      fontWeight: ft.emphasisWeight,
    },
    disclosurePillRow: {
      minWidth: 0,
      flexShrink: 1,
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: COMFORT_GAP_SM,
    },
    disclosureMarketPill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 1,
      backgroundColor: theme.warningDim,
      color: theme.warning,
      fontSize: ft.ff(FEED_BADGE_PX),
      lineHeight: sf(13),
      fontWeight: ft.emphasisWeight,
    },
    disclosureFormPill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 1,
      backgroundColor: theme.bgElevated,
      color: theme.textMuted,
      fontSize: ft.ff(FEED_BADGE_PX),
      lineHeight: sf(13),
      fontWeight: ft.emphasisWeight,
      maxWidth: 120,
    },
    calendarPillRow: {
      minWidth: 0,
      flexShrink: 1,
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: COMFORT_GAP_SM,
    },
    calendarDatePill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 1,
      backgroundColor: theme.greenDim,
      color: theme.green,
      fontSize: ft.ff(FEED_BADGE_PX),
      lineHeight: sf(13),
      fontWeight: ft.emphasisWeight,
    },
    calendarTypePill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 1,
      backgroundColor: theme.bgElevated,
      color: theme.textMuted,
      fontSize: ft.ff(FEED_BADGE_PX),
      lineHeight: sf(13),
      fontWeight: ft.emphasisWeight,
    },
    calendarMoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: COMFORT_GAP_SM,
      paddingTop: 2,
    },
    calendarMoreText: {
      fontSize: ft.ff(12),
      lineHeight: sf(16),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
    },
    signalText: {
      fontSize: ft.signalBodyFont(14),
      lineHeight: sf(21),
      fontWeight: ft.signalBodyWeight,
      color: theme.textMuted,
    },
    emptyCard: {
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 12,
    },
    emptyText: {
      fontSize: ft.ff(13),
      lineHeight: sf(19),
      fontWeight: ft.bodyWeight,
      color: theme.textDim,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
