import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  COMFORT_GAP_MD,
  COMFORT_GAP_PAGE,
  COMFORT_GAP_SM,
  COMFORT_PADDING_ROW_V,
} from '@/constants/comfortDensity';
import {
  FEED_BADGE_PX,
  FEED_DIGEST_TITLE_PX,
} from '@/constants/feedTypography';
import { UI_RADIUS_CARD, UI_RADIUS_CARD_LG } from '@/constants/uiCornerRadius';
import { APP_CONTENT_SIDE_PADDING } from '@/constants/responsiveLayout';
import { UI_FONT_WEIGHT_EMPHASIS } from '@/constants/uiFontWeight';
import { AiBadge } from '@/components/signal/AiBadge';
import { BriefingSessionTag } from '@/components/signal/BriefingSessionTag';
import { ChangeHeatmapGrid, type ChangeHeatmapCell } from '@/components/signal/ChangeHeatmapGrid';
import { HomeSectionHeader } from '@/components/signal/HomeSectionHeader';
import { HomeShortcutsStrip } from '@/components/signal/HomeShortcutsStrip';
import {
  digestSourceIconEntries,
} from '@/components/signal/SourceIconStack';
import { CommunitySourceMark } from '@/components/signal/CommunitySourceMark';
import { ChangeTintedText } from '@/components/signal/ChangeTintedText';
import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import { SymbolLogo } from '@/components/signal/SymbolLogo';
import { SignalDateNavigator } from '@/components/signal/SignalDateNavigator';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import {
  HOME_SHORTCUTS_DEFAULT,
  type HomeShortcut,
} from '@/constants/homeShortcuts';
import {
  HOME_DIGEST_CATEGORIES,
  HOME_SIGNAL_SESSIONS,
  type HomeDigestCategory,
  type SignalSessionKey,
} from '@/constants/ipadHomeNav';
import { newsSegmentAccent } from '@/constants/segmentAccent';
import type { AppTheme } from '@/constants/theme';
import { webScrollViewportStyle, webShellBackground } from '@/constants/webLayout';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { NEWS_SEGMENT_LABEL } from '@/domain/news/feedFilters';
import { newsDigestCreatedIso } from '@/domain/digests/createdAt';
import { isHomeNewsFlowNew } from '@/domain/digests/freshness';
import {
  filterCalendarChipsForHome,
  homeCalendarChipLabel,
  homeCalendarChipRangeEnd,
} from '@/domain/home/calendarChipLabel';
import { briefingsForYmd } from '@/domain/home/briefingDate';
import { etfHomeHeatmapCells } from '@/domain/home/etfHomeHeatmap';
import { aggregateHomeKeywords, type HomeKeywordChip } from '@/domain/home/aggregateHomeKeywords';
import {
  homeHeroHeadline,
  selectHomeHeroBriefing,
} from '@/domain/home/selectHomeHeroBriefing';
import {
  HOME_ANCHOR_COIN_FETCH_POOL,
  filterHomeAnchorCoinsNotInWatchlist,
  homeAnchorCoinCount,
  pickHomeAnchorCoinsFromList,
} from '@/domain/home/homeAnchorCoins';
import {
  formatQuoteDpPct,
  formatUsd,
  formatKrw,
  isKoreaStockQuote,
  mapSignalCoinToRow,
  mapSignalQuoteToRow,
  quoteLookupKeys,
  type QuoteRow,
} from '@/domain/quotes/rows';
import { isCoinQuote, resolveWatchlistHomeAsOf } from '@/domain/quotes/watchlistHomeAsOf';
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
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { fetchSignalCalendar, signalCalendarToCalendarEvent } from '@/integrations/signal-api';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { etfInsightDetailIso } from '@/domain/briefings/detailTime';
import { shouldShowEtfBriefingOnHome } from '@/domain/etfInsights/homeVisibility';
import { fetchSignalEtfInsightForDate } from '@/integrations/signal-api/etfInsights';
import { fetchSignalMarketBriefings } from '@/integrations/signal-api/marketBriefings';
import { fetchSignalCoins, fetchSignalMarketQuotes } from '@/integrations/signal-api/market';
import { fetchSignalNewsDigests } from '@/integrations/signal-api/newsDigests';
import { fetchSignalTodayBriefing } from '@/integrations/signal-api/todayBriefings';
import { openYahooFinanceQuote } from '@/utils/yahooFinance';
import type {
  SignalApiEtfInsight,
  SignalApiMarketBriefing,
  SignalApiMarketQuote,
  SignalApiNewsDigestItem,
  SignalApiTodayBriefing,
} from '@/integrations/signal-api/types';
import type { MessageId } from '@/locales/messages';
import { hasSignalApi } from '@/services/env';
import {
  HOME_NEWS_FLOW_DISPLAY_DEFAULT,
  loadHomeNewsFlowDisplayCount,
  subscribeHomeNewsFlowDisplayCountChanged,
} from '@/services/homeNewsFlowDisplayPreference';
import {
  HOME_SECTOR_FLOW_DISPLAY_DEFAULT,
  loadHomeSectorFlowDisplayCount,
  subscribeHomeSectorFlowDisplayCountChanged,
} from '@/services/homeSectorFlowDisplayPreference';
import {
  HOME_WATCHLIST_DISPLAY_DEFAULT,
  loadHomeWatchlistDisplayCount,
  subscribeHomeWatchlistDisplayCountChanged,
} from '@/services/homeWatchlistDisplayPreference';
import {
  loadHomeShortcuts,
  subscribeHomeShortcutsChanged,
} from '@/services/homeShortcutsPreference';
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
const HOME_CALENDAR_CHIP_LIMIT = 5;
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

function briefingLeadText(row: SignalApiMarketBriefing): string {
  const summary = String(row.summary || row.headline || '').trim();
  if (summary) return summary;
  return row.overview[0] || '';
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
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo, useTwoPane),
    [theme, scaleFont, feedTypo, useTwoPane],
  );
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
  const [sectorFlowDisplayCount, setSectorFlowDisplayCount] = useState(HOME_SECTOR_FLOW_DISPLAY_DEFAULT);
  const [homeShortcuts, setHomeShortcuts] = useState<HomeShortcut[]>(
    HOME_SHORTCUTS_DEFAULT.map((row) => ({ ...row })),
  );
  const [homeDisplayPrefsReady, setHomeDisplayPrefsReady] = useState(false);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [anchorCoins, setAnchorCoins] = useState<QuoteRow[]>([]);
  const [briefings, setBriefings] = useState<SignalApiMarketBriefing[]>([]);
  const [todayBriefing, setTodayBriefing] = useState<SignalApiTodayBriefing | null>(null);
  const [etfInsight, setEtfInsight] = useState<SignalApiEtfInsight | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const homeHero = useMemo(
    () => selectHomeHeroBriefing({ selectedYmd, todayYmd, todayBriefing, briefings }),
    [selectedYmd, todayYmd, todayBriefing, briefings],
  );

  const homeCalendarChips = useMemo(
    () =>
      filterCalendarChipsForHome(
        calendarEvents,
        selectedYmd,
        todayYmd,
        HOME_CALENDAR_CHIP_LIMIT,
      ),
    [calendarEvents, selectedYmd, todayYmd],
  );

  const homeIssues = useMemo(
    () =>
      [...issues]
        .sort((a, b) => issueSortTime(b).localeCompare(issueSortTime(a)) || b.item.count - a.item.count)
        .slice(0, newsFlowDisplayCount),
    [issues, newsFlowDisplayCount],
  );

  const homeNewsFlowNew = useMemo(() => {
    const newest = homeIssues[0];
    if (!newest) return false;
    return isHomeNewsFlowNew(newsDigestCreatedIso(newest.item));
  }, [homeIssues]);

  const homeKeywords = useMemo(
    () =>
      aggregateHomeKeywords({
        todayKeywords: todayBriefing?.keywords,
        marketKeywordLists: briefingsForYmd(briefings, selectedYmd).map((b) => b.keywords),
        digestRows: homeIssues.map((row) => ({
          id: row.item.id,
          keywords: row.item.keywords,
          topics: row.item.topics,
        })),
        limit: 7,
      }),
    [briefings, homeIssues, selectedYmd, todayBriefing],
  );

  const etfHeatmapCells = useMemo((): ChangeHeatmapCell[] => {
    if (!etfInsight) return [];
    return etfHomeHeatmapCells(etfInsight, sectorFlowDisplayCount).map((cell) => ({
      key: cell.key,
      title: cell.title,
      subtitle: cell.subtitle,
      changePercent: cell.changePercent,
      displayPercent: cell.changePercent,
    }));
  }, [etfInsight, sectorFlowDisplayCount]);

  const etfSectionMeta = useMemo(() => {
    if (!etfInsight) return null;
    const label = formatFeedItemTimeLabel(etfInsightDetailIso(etfInsight), locale);
    return label && label !== '—' ? label : null;
  }, [etfInsight, locale]);

  /**
   * 관심 종목 as-of: 주식은 주말·마감 후 종가 라벨, 코인만이면 상대시간.
   * 하단 BTC·ETH 앵커는 메타에 넣지 않는다 (주말 종가 라벨과 충돌 방지).
   */
  const watchlistSectionMeta = useMemo(() => {
    const resolved = resolveWatchlistHomeAsOf(quotes.slice(0, watchlistDisplayCount));
    if (!resolved) return null;
    if (resolved.mode === 'relative') {
      const label = formatFeedItemTimeLabel(resolved.iso, locale);
      return label && label !== '—' ? label : null;
    }
    if (resolved.mode === 'today_close') return t('quotesAsOfTodayClose');
    const asOfDate = new Date(`${resolved.ymd}T12:00:00`);
    const now = new Date();
    const ageDays = Math.floor(
      Math.abs(now.getTime() - asOfDate.getTime()) / (24 * 60 * 60 * 1000),
    );
    const when =
      ageDays <= 6
        ? formatLocalYmdLabel(resolved.ymd, locale, { weekday: 'short' })
        : formatLocalYmdLabel(resolved.ymd, locale, { month: 'short', day: 'numeric' });
    return t('quotesAsOfNamedClose', { when });
  }, [locale, quotes, t, watchlistDisplayCount]);

  const homeWatchRows = useMemo(
    () => quotes.slice(0, watchlistDisplayCount),
    [quotes, watchlistDisplayCount],
  );

  /** compact 2 · wide(PC) 3 — 시총순 풀에서 워치리스트 중복을 건너뛰고 채움 */
  const homeAnchorCoinRows = useMemo(
    () =>
      filterHomeAnchorCoinsNotInWatchlist(
        anchorCoins,
        homeWatchRows.map((row) => row.symbol),
      ).slice(0, homeAnchorCoinCount(useTwoPane)),
    [anchorCoins, homeWatchRows, useTwoPane],
  );

  const { ref: scrollRef } = useScrollToTopOnChange([selectedYmd], {
    resyncDeps: [issues, briefings, todayBriefing, etfInsight, calendarEvents, loading],
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

  const heroSectionTitle = homeHero
    ? homeHero.kind === 'today'
      ? t('ipadHomeTitle')
      : t('ipadHomeSignalTitle')
    : t('ipadHomeTitle');
  const heroSessionTag =
    homeHero?.kind === 'market' ? <BriefingSessionTag briefing={homeHero.briefing} /> : null;

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
      setAnchorCoins([]);
      setBriefings([]);
      setTodayBriefing(null);
      setCalendarEvents([]);
      setError(t('errorSignalApiShort'));
      return;
    }
    const cacheMode = signalCacheMode(forceRefresh);
    setError(null);
    try {
      const watchlist = await loadWatchlistSymbols();
      const isToday = selectedYmd === todayYmd;
      const symbols = isToday ? watchlist.slice(0, watchlistDisplayCount) : [];
      const isDateChange = loadedYmdRef.current !== selectedYmd;
      if (isDateChange) {
        setBriefings([]);
      }
      setCalendarEvents([]);

      const [nextTodayBriefing, nextIssues, quoteRows, briefingRows, nextEtfInsight, coinRows] =
        await Promise.all([
        fetchTodayBriefingWithFallback(selectedYmd, locale, cacheMode),
        fetchTopIssues(selectedYmd, locale, cacheMode),
        symbols.length > 0
          ? fetchSignalMarketQuotes({ symbols, limit: symbols.length }, { cacheMode }).catch(
              () => [] as SignalApiMarketQuote[],
            )
          : Promise.resolve([] as SignalApiMarketQuote[]),
        fetchSignalMarketBriefings(
          { date: selectedYmd, limit: BRIEFING_LIMIT, locale },
          { cacheMode },
        ).catch(() => [] as SignalApiMarketBriefing[]),
        fetchSignalEtfInsightForDate(selectedYmd, { cacheMode }).catch(() => null),
        isToday
          ? fetchSignalCoins({ limit: 40 }, { cacheMode }).catch(() => [])
          : Promise.resolve([]),
      ]);

      const quoteBySymbol = new Map<string, QuoteRow>();
      for (const item of quoteRows) {
        const row = mapSignalQuoteToRow(item);
        for (const key of quoteLookupKeys(item, row)) quoteBySymbol.set(key, row);
      }
      if (generation !== loadGenerationRef.current) return;
      setTodayBriefing(nextTodayBriefing);
      setIssues(nextIssues);
      setQuotes(
        symbols.map((symbol) => {
          const key = symbol.trim().toUpperCase();
          return quoteBySymbol.get(key) ?? { symbol, quote: null, error: 'NO_SERVER_QUOTE' };
        }),
      );
      // 시총순 여유분만 보관 — 화면 폭·워치리스트 중복은 렌더 시 다시 고른다
      setAnchorCoins(
        pickHomeAnchorCoinsFromList(coinRows, HOME_ANCHOR_COIN_FETCH_POOL).map(mapSignalCoinToRow),
      );
      setBriefings(
        uniqueVisibleBriefings(
          [...briefingRows].sort((a, b) => sortBriefingTime(b).localeCompare(sortBriefingTime(a))),
        ),
      );
      setEtfInsight(nextEtfInsight);

      void (async () => {
        const calendarRangeEnd = selectedYmd === todayYmd
          ? homeCalendarChipRangeEnd(selectedYmd, HOME_CALENDAR_LOOKAHEAD_DAYS)
          : selectedYmd;
        const calendarRows = await fetchSignalCalendar(
          {
            from: shiftYmd(selectedYmd, -1),
            to: calendarRangeEnd,
            limit: 120,
          },
          { cacheMode },
        ).catch(() => []);

        if (generation !== loadGenerationRef.current) return;
        setCalendarEvents(
          filterHomeCalendarEvents(
            calendarRows
              .map((row) => signalCalendarToCalendarEvent(row))
              .filter((row): row is CalendarEvent => row != null),
            watchlist,
            selectedYmd,
            calendarRangeEnd,
          ),
        );
      })();
    } catch (e) {
      if (generation !== loadGenerationRef.current) return;
      setError(formatSignalApiError(e, t, 'ipadHomeLoadError'));
    }
  }, [locale, selectedYmd, t, todayYmd, watchlistDisplayCount]);

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
    const [newsFlow, watchlist, sectorFlow, shortcuts] = await Promise.all([
      loadHomeNewsFlowDisplayCount(),
      loadHomeWatchlistDisplayCount(),
      loadHomeSectorFlowDisplayCount(),
      loadHomeShortcuts(),
    ]);
    setNewsFlowDisplayCount(newsFlow);
    setWatchlistDisplayCount(watchlist);
    setSectorFlowDisplayCount(sectorFlow);
    setHomeShortcuts(shortcuts);
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
      subscribeHomeSectorFlowDisplayCountChanged(() => {
        void reloadHomeDisplayPrefs();
      }),
      subscribeHomeShortcutsChanged(() => {
        void reloadHomeDisplayPrefs();
      }),
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [reloadHomeDisplayPrefs]);

  const openIssueDetail = useCallback(
    (row: IssueRow) => {
      const id = String(row.item.id || '').trim();
      if (!id) return;
      if (ipadNav.isAvailable) {
        ipadNav.showNewsDigest(id, { drillFrom: 'home' });
        return;
      }
      router.push({ pathname: '/news-digest', params: { id } } as never);
    },
    [ipadNav, router],
  );

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

  /** Stocks → in-app detail. Coins have no detail pane → Yahoo (Quotes tab coin pattern). */
  const openHomeQuote = useCallback(
    (row: QuoteRow, opts?: { coin?: boolean }) => {
      const trimmed = row.symbol.trim().toUpperCase();
      if (!trimmed || trimmed === '—') return;
      if (opts?.coin || isCoinQuote(row.quote)) {
        void openYahooFinanceQuote(trimmed, 'coin', {
          yahooSymbol: row.quote?.regularSession?.yahooSymbol,
        });
        return;
      }
      openSymbolDetail(trimmed);
    },
    [openSymbolDetail],
  );

  const renderHomeQuoteTile = useCallback(
    (row: QuoteRow, key: string, opts?: { coin?: boolean }) => {
      const pct = row.quote?.changePercent;
      const hasPct = typeof pct === 'number' && Number.isFinite(pct);
      const up = hasPct && pct >= 0;
      const hasQuote = Boolean(row.quote);
      return (
        <Pressable
          key={key}
          onPress={() => openHomeQuote(row, opts)}
          accessibilityRole="button"
          accessibilityLabel={row.symbol}
          style={({ pressed }) => [styles.quoteTile, pressed && styles.pressed]}>
          <View style={styles.quoteTileContent}>
            <View style={styles.quoteTileLead}>
              <SymbolLogo symbol={row.symbol} imageUrl={row.imageUrl} size={22} />
              <Text style={styles.quoteSymbol} numberOfLines={1}>
                {row.symbol}
              </Text>
            </View>
            <View style={styles.quoteTileFooter}>
              {hasQuote ? (
                <>
                  <Text style={styles.priceText} numberOfLines={1}>
                    {formatPrice(row)}
                  </Text>
                  <Text
                    style={[
                      styles.changeText,
                      { color: up ? quoteChange.colors.up : quoteChange.colors.down },
                    ]}>
                    {formatQuoteDpPct(pct)}
                  </Text>
                </>
              ) : (
                <Text style={styles.quotePendingText} numberOfLines={2}>
                  {t('quotesPending')}
                </Text>
              )}
            </View>
          </View>
        </Pressable>
      );
    },
    [openHomeQuote, quoteChange.colors.down, quoteChange.colors.up, styles, t],
  );

  const openCalendar = useCallback(() => {
    if (ipadNav.isAvailable) {
      ipadNav.showCalendar({ drillFrom: 'home' });
      return;
    }
    router.navigate('/calendar' as never);
  }, [ipadNav, router]);

  const openHomeKeyword = useCallback(
    (chip: HomeKeywordChip) => {
      if (chip.kind === 'symbol') {
        openSymbolDetail(chip.label);
        return;
      }
      if (chip.digestId) {
        if (ipadNav.isAvailable) {
          ipadNav.showNewsDigest(chip.digestId, { drillFrom: 'home' });
          return;
        }
        router.push({ pathname: '/news-digest', params: { id: chip.digestId } } as never);
        return;
      }
      if (ipadNav.isAvailable) {
        ipadNav.showNewsIssues({ category: 'global', date: selectedYmd }, { drillFrom: 'home' });
        return;
      }
      router.push({
        pathname: '/news-issues',
        params: { category: 'global', date: selectedYmd, from: 'home' },
      } as never);
    },
    [ipadNav, openSymbolDetail, router, selectedYmd],
  );

  const renderKeywordChips = useCallback(
    () => (
      <View style={styles.keywordCard}>
        <View style={styles.keywordCardHeader}>
          <AiBadge />
          <Text style={styles.keywordCardTitle}>{t('homeKeywordsTitle')}</Text>
        </View>
        <View style={styles.keywordChipRow}>
          {homeKeywords.map((chip) => {
            const isSymbol = chip.kind === 'symbol';
            return (
              <Pressable
                key={`${chip.kind}:${chip.label}`}
                onPress={() => openHomeKeyword(chip)}
                accessibilityRole="button"
                accessibilityLabel={chip.label}
                style={({ pressed }) => [
                  styles.keywordChip,
                  isSymbol ? styles.keywordChipSymbol : null,
                  pressed && styles.pressed,
                ]}>
                <Text
                  style={[styles.keywordChipText, isSymbol ? styles.keywordChipTextSymbol : null]}
                  numberOfLines={1}>
                  {chip.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    ),
    [homeKeywords, openHomeKeyword, styles, t],
  );

  /** 히어로·섹터 흐름·뉴스 — 단건 상세 화면 */
  const openHero = useCallback(() => {
    if (!homeHero) return;
    if (homeHero.kind === 'today') {
      const date =
        String(homeHero.briefing.briefingDate || '').slice(0, 10) || selectedYmd;
      if (ipadNav.isAvailable) {
        ipadNav.showTodayBriefing(date, { drillFrom: 'home' });
        return;
      }
      router.push({ pathname: '/today-briefing', params: { date } } as never);
      return;
    }
    const session = signalSessionKeyForBriefing(homeHero.briefing);
    if (ipadNav.isAvailable) {
      ipadNav.showMarketBriefing(session, selectedYmd, { drillFrom: 'home' });
      return;
    }
    router.push({
      pathname: '/market-briefing',
      params: {
        date: selectedYmd,
        from: 'home',
        ...(session ? { session } : null),
      },
    } as never);
  }, [homeHero, ipadNav, router, selectedYmd]);

  const openEtfInsightDetail = useCallback(() => {
    if (!etfInsight?.id) return;
    if (ipadNav.isAvailable) {
      ipadNav.showEtfInsight(etfInsight.id, {
        drillFrom: 'home',
        ...(etfInsight.insightDate ? { date: etfInsight.insightDate } : null),
      });
      return;
    }
    router.push({
      pathname: '/etf-insight',
      params: {
        id: etfInsight.id,
        ...(etfInsight.insightDate ? { date: etfInsight.insightDate } : null),
      },
    } as never);
  }, [etfInsight, ipadNav, router]);

  const renderHeroCard = useCallback(() => {
    if (!homeHero) return null;
    const headline = homeHeroHeadline(homeHero);
    if (!headline) return null;
    return (
      <Pressable
        onPress={openHero}
        accessibilityRole="button"
        accessibilityLabel={heroSectionTitle}
        style={({ pressed }) => [
          styles.heroCard,
          showIssueSummary && styles.heroCardSummary,
          pressed && styles.pressed,
        ]}>
        <ChangeTintedText style={styles.issueGroupTitle}>{headline}</ChangeTintedText>
      </Pressable>
    );
  }, [heroSectionTitle, homeHero, openHero, showIssueSummary, styles]);

  const renderCalendarChips = useCallback(
    () => (
      <View style={styles.calendarChipRow}>
        {homeCalendarChips.map((event) => (
          <Pressable
            key={event.id}
            onPress={openCalendar}
            accessibilityRole="button"
            accessibilityLabel={homeCalendarChipLabel(
              event,
              selectedYmd,
              t(calendarTypeLabelId(event.type)),
            )}
            style={({ pressed }) => [styles.calendarChip, pressed && styles.pressed]}>
            <Text style={styles.calendarChipText} numberOfLines={1}>
              {homeCalendarChipLabel(
                event,
                selectedYmd,
                t(calendarTypeLabelId(event.type)),
              )}
            </Text>
          </Pressable>
        ))}
      </View>
    ),
    [homeCalendarChips, openCalendar, selectedYmd, styles, t],
  );

  const renderEtfInsightCard = useCallback(
    (item: SignalApiEtfInsight) => {
      const leadText = item.title?.trim() || item.summary?.trim() || '';
      const bodyText = item.summary?.trim() || '';
      const previewText = bodyText && bodyText !== leadText ? bodyText : '';
      return (
        <Pressable
          onPress={openEtfInsightDetail}
          accessibilityRole="button"
          accessibilityLabel={t('homeEtfInsightTitle')}
          style={({ pressed }) => [
            styles.heroCard,
            showIssueSummary && styles.heroCardSummary,
            pressed && styles.pressed,
          ]}>
          <View style={styles.issueGroupList}>
            <View style={styles.issueGroupItem}>
              {leadText ? (
                <ChangeTintedText style={styles.issueGroupTitle} numberOfLines={2}>
                  {leadText}
                </ChangeTintedText>
              ) : null}
              {previewText ? (
                <ChangeTintedText style={styles.signalText} numberOfLines={2}>
                  {previewText}
                </ChangeTintedText>
              ) : null}
            </View>
          </View>
        </Pressable>
      );
    },
    [openEtfInsightDetail, showIssueSummary, styles, t],
  );

  const renderEtfSectionBody = useCallback(() => {
    if (!etfInsight) return null;
    if (etfHeatmapCells.length > 0) {
      return (
        <Pressable
          onPress={openEtfInsightDetail}
          accessibilityRole="button"
          accessibilityLabel={t('homeEtfInsightTitle')}
          style={({ pressed }) => [
            styles.heroCard,
            showIssueSummary && styles.heroCardSummary,
            pressed && styles.pressed,
          ]}>
          <ChangeHeatmapGrid
            cells={etfHeatmapCells}
            theme={theme}
            scaleFont={scaleFont}
            changeColorConvention={quoteChange.convention ?? 'korea'}
          />
        </Pressable>
      );
    }
    return renderEtfInsightCard(etfInsight);
  }, [
    etfHeatmapCells,
    etfInsight,
    openEtfInsightDetail,
    quoteChange.convention,
    renderEtfInsightCard,
    scaleFont,
    showIssueSummary,
    styles,
    t,
    theme,
  ]);

  const renderIssueCard = useCallback(
    (rows: IssueRow[]) => (
      <View style={[styles.heroCard, styles.heroCardCompact, showIssueSummary && styles.heroCardSummary]}>
        <View style={styles.issueGroupList}>
          {rows.map((row, index) => {
            const sourceEntries = digestSourceIconEntries(row.item.sourceRefs, row.item.sources);
            const trailText = [row.item.topics[0], row.item.symbols[0]].filter(Boolean).join(' · ');
            const createdIso = newsDigestCreatedIso(row.item);
            return (
              <HomeDigestFeedRow
                key={row.item.id}
                title={row.item.title}
                titleLines={2}
                timeLabel={formatFeedItemTimeLabel(createdIso, locale)}
                trailText={trailText || null}
                summary={null}
                sourceEntries={sourceEntries}
                bordered={index < rows.length - 1}
                onPress={() => openIssueDetail(row)}
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
    [openIssueDetail, showIssueSummary, styles, locale, t, theme],
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
        contentRevision={[issues, briefings, todayBriefing, etfInsight, calendarEvents, loading]}
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
          {homeKeywords.length > 0 ? renderKeywordChips() : null}

          {homeHero && homeHeroHeadline(homeHero) ? (
            <View style={styles.section}>
              <HomeSectionHeader
                title={heroSectionTitle}
                badge={<AiBadge />}
                trailingBadge={heroSessionTag}
              />
              {renderHeroCard()}
            </View>
          ) : null}

          <View style={styles.section}>
            <HomeSectionHeader
              title={t('newsIssuesTitle')}
              badge={<AiBadge />}
              meta={homeNewsFlowNew ? t('homeNewsFlowNewMeta') : null}
            />
            {homeIssues.length > 0 ? (
              renderIssueCard(homeIssues)
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t('ipadHomeIssuesEmpty')}</Text>
              </View>
            )}
          </View>

          {homeCalendarChips.length > 0 ? (
            <View style={styles.section}>
              <HomeSectionHeader title={t('ipadHomeCalendarTitle')} />
              {renderCalendarChips()}
            </View>
          ) : null}

          {homeShortcuts.length > 0 ? (
            <View style={styles.section}>
              <HomeSectionHeader title={t('homeShortcutsTitle')} />
              <HomeShortcutsStrip shortcuts={homeShortcuts} selectedYmd={selectedYmd} />
            </View>
          ) : null}

          {selectedIsExactToday ? (
            <View style={styles.section}>
              <HomeSectionHeader title={t('homeFocusWatchTitle')} meta={watchlistSectionMeta} />
              <View style={styles.quoteStack}>
                {homeWatchRows.length === 0 && homeAnchorCoinRows.length === 0 ? (
                  <Text style={styles.emptyText}>{t('quotesEmptyWatch')}</Text>
                ) : (
                  <>
                    {homeWatchRows.length > 0 ? (
                      <View style={styles.quoteGrid}>
                        {homeWatchRows.map((row, index) =>
                          renderHomeQuoteTile(row, `watch-${index}`),
                        )}
                      </View>
                    ) : null}
                    {homeAnchorCoinRows.length > 0 ? (
                      <>
                        {homeWatchRows.length > 0 ? (
                          <View style={styles.quoteAnchorDivider} />
                        ) : null}
                        <View style={styles.quoteGrid}>
                          {homeAnchorCoinRows.map((row, index) =>
                            renderHomeQuoteTile(row, `anchor-${index}`, { coin: true }),
                          )}
                        </View>
                      </>
                    ) : null}
                  </>
                )}
              </View>
            </View>
          ) : null}

          {etfInsight && shouldShowEtfBriefingOnHome(etfInsight.insightDate, selectedYmd) ? (
            <View style={styles.section}>
              <HomeSectionHeader
                title={t('homeEtfInsightTitle')}
                badge={<AiBadge />}
                meta={etfSectionMeta}
              />
              {renderEtfSectionBody()}
            </View>
          ) : null}
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
  useTwoPane: boolean,
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
      paddingHorizontal: APP_CONTENT_SIDE_PADDING,
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
    issueGroupList: {
      gap: 0,
    },
    issueGroupItem: {
      gap: COMFORT_GAP_SM,
      paddingVertical: ft.row(6),
      borderRadius: UI_RADIUS_CARD,
    },
    issueGroupTitle: {
      fontSize: ft.ff(FEED_DIGEST_TITLE_PX),
      lineHeight: sf(20),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    section: {
      gap: COMFORT_GAP_SM,
    },
    quoteStack: {
      gap: COMFORT_GAP_MD,
    },
    quoteAnchorDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
    },
    quoteGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: COMFORT_GAP_MD,
    },
    quoteTile: {
      /** 폰 2열 · 와이드(웹/iPad) 3열 */
      width: useTwoPane ? '32%' : '48%',
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
    boardSourceMark: {
      borderWidth: 0,
      backgroundColor: 'transparent',
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
    quoteSymbol: {
      fontSize: ft.ff(14),
      lineHeight: sf(18),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    priceText: {
      fontSize: ft.ff(12),
      lineHeight: sf(16),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    changeText: {
      marginTop: 2,
      fontSize: ft.ff(16),
      lineHeight: sf(20),
      fontWeight: ft.emphasisWeight,
    },
    quotePendingText: {
      fontSize: ft.ff(12),
      lineHeight: sf(16),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    calendarChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: COMFORT_GAP_SM,
    },
    calendarChip: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      maxWidth: '100%',
    },
    calendarChipText: {
      fontSize: ft.ff(FEED_BADGE_PX),
      lineHeight: sf(16),
      fontWeight: ft.emphasisWeight,
      color: theme.text,
    },
    keywordCard: {
      borderRadius: UI_RADIUS_CARD,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 10,
      paddingTop: 8,
      paddingBottom: 8,
      gap: 6,
    },
    keywordCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
    },
    keywordCardTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.ff(FEED_BADGE_PX),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
      color: theme.textMuted,
    },
    keywordChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    keywordChip: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      maxWidth: '100%',
    },
    keywordChipSymbol: {
      backgroundColor: theme.greenDim,
      borderColor: theme.greenBorder,
    },
    keywordChipText: {
      fontSize: ft.ff(FEED_BADGE_PX),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
      color: theme.text,
    },
    keywordChipTextSymbol: {
      color: theme.green,
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
