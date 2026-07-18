import { type Href, useRouter } from 'expo-router';
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
import { ChangeHeatmapGrid, type ChangeHeatmapCell } from '@/components/signal/ChangeHeatmapGrid';
import { HomeSectionHeader } from '@/components/signal/HomeSectionHeader';
import {
  digestSourceIconEntries,
} from '@/components/signal/SourceIconStack';
import { CommunitySourceMark } from '@/components/signal/CommunitySourceMark';
import { ChangeTintedText } from '@/components/signal/ChangeTintedText';
import { EntityLinkedTintedText } from '@/components/signal/EntityLinkedTintedText';
import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import { SymbolLogo } from '@/components/signal/SymbolLogo';
import { SignalDateNavigator } from '@/components/signal/SignalDateNavigator';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import {
  HOME_DIGEST_CATEGORIES,
  HOME_SIGNAL_SESSIONS,
  type HomeDigestCategory,
  type NewsIssuesCategory,
  type SignalSessionKey,
} from '@/constants/ipadHomeNav';
import { newsSegmentAccent } from '@/constants/segmentAccent';
import type { AppTheme } from '@/constants/theme';
import { webScrollViewportStyle, webShellBackground } from '@/constants/webLayout';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { DigestSourcesSheet } from '@/components/news/DigestSourcesSheet';
import { newsDigestSourceSheetRows } from '@/components/news/DigestPager';
import { EtfInsightSheet } from '@/components/signal/EtfInsightSheet';
import { MarketBriefingSheet } from '@/components/signal/MarketBriefingSheet';
import { TodayBriefingSheet } from '@/components/signal/TodayBriefingSheet';
import { NEWS_SEGMENT_LABEL } from '@/domain/news/feedFilters';
import { newsDigestCreatedIso } from '@/domain/digests/createdAt';
import {
  filterCalendarChipsForHome,
  homeCalendarChipLabel,
  homeCalendarChipRangeEnd,
} from '@/domain/home/calendarChipLabel';
import { etfHomeHeatmapCells } from '@/domain/home/etfHomeHeatmap';
import {
  homeHeroHeadline,
  selectHomeHeroBriefing,
} from '@/domain/home/selectHomeHeroBriefing';
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
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { fetchSignalCalendar, signalCalendarToCalendarEvent } from '@/integrations/signal-api';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { shouldShowEtfBriefingOnHome } from '@/domain/etfInsights/homeVisibility';
import { fetchSignalEtfInsightForDate } from '@/integrations/signal-api/etfInsights';
import { fetchSignalMarketBriefings } from '@/integrations/signal-api/marketBriefings';
import { fetchSignalMarketQuotes } from '@/integrations/signal-api/market';
import { fetchSignalNewsDigests } from '@/integrations/signal-api/newsDigests';
import { fetchSignalTodayBriefing } from '@/integrations/signal-api/todayBriefings';
import type {
  SignalApiEtfInsight,
  SignalApiMarketBriefing,
  SignalApiMarketQuote,
  SignalApiNewsDigestItem,
  SignalApiTodayBriefing,
} from '@/integrations/signal-api/types';
import type { AppLocale, MessageId } from '@/locales/messages';
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

/** 장중 브리핑 시트·히어로 카드용 한 줄 제목 */
function briefingHomeTitle(row: SignalApiMarketBriefing): string {
  const headline = String(row.headline || '').trim();
  if (headline) return headline;
  const summary = String(row.summary || '').trim();
  if (summary) return summary;
  return row.overview[0] || '';
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
  type HomeDigestSheetState = { kind: 'news'; row: IssueRow };
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
  const [homeDisplayPrefsReady, setHomeDisplayPrefsReady] = useState(false);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [briefings, setBriefings] = useState<SignalApiMarketBriefing[]>([]);
  const [todayBriefing, setTodayBriefing] = useState<SignalApiTodayBriefing | null>(null);
  const [etfInsight, setEtfInsight] = useState<SignalApiEtfInsight | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [digestSheet, setDigestSheet] = useState<HomeDigestSheetState | null>(null);
  const [briefingSheet, setBriefingSheet] = useState<SignalApiMarketBriefing | null>(null);
  const [todayBriefingSheet, setTodayBriefingSheet] = useState<SignalApiTodayBriefing | null>(null);
  const [etfInsightSheetOpen, setEtfInsightSheetOpen] = useState(false);

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
      setCalendarEvents([]);
      setError(t('errorSignalApiShort'));
      return;
    }
    const cacheMode = signalCacheMode(forceRefresh);
    setError(null);
    try {
      const watchlist = await loadWatchlistSymbols();
      const symbols = selectedYmd === todayYmd ? watchlist.slice(0, watchlistDisplayCount) : [];
      const isDateChange = loadedYmdRef.current !== selectedYmd;
      if (isDateChange) {
        setBriefings([]);
      }
      setCalendarEvents([]);

      const [nextTodayBriefing, nextIssues, quoteRows, briefingRows, nextEtfInsight] = await Promise.all([
        fetchTodayBriefingWithFallback(selectedYmd, locale, cacheMode),
        fetchTopIssues(selectedYmd, locale, cacheMode),
        symbols.length > 0
          ? fetchSignalMarketQuotes({ symbols, limit: symbols.length }, { cacheMode }).catch(
              () => [] as SignalApiMarketQuote[],
            )
          : Promise.resolve([] as SignalApiMarketQuote[]),
        fetchSignalMarketBriefings(
          { ...utcRangeForLocalYmd(selectedYmd), limit: BRIEFING_LIMIT, locale },
          { cacheMode },
        ).catch(() => [] as SignalApiMarketBriefing[]),
        fetchSignalEtfInsightForDate(selectedYmd, { cacheMode }).catch(() => null),
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
    const [newsFlow, watchlist, sectorFlow] = await Promise.all([
      loadHomeNewsFlowDisplayCount(),
      loadHomeWatchlistDisplayCount(),
      loadHomeSectorFlowDisplayCount(),
    ]);
    setNewsFlowDisplayCount(newsFlow);
    setWatchlistDisplayCount(watchlist);
    setSectorFlowDisplayCount(sectorFlow);
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
        params: { ...params, from: 'home' },
      } as Href);
    },
    [ipadNav, router, selectedYmd],
  );

  const openIssueSheet = useCallback((row: IssueRow) => {
    setDigestSheet({ kind: 'news', row });
  }, []);

  const openSignal = useCallback(
    (row?: SignalApiMarketBriefing) => {
      const session = signalSessionKeyForBriefing(row);
      if (ipadNav.isAvailable) {
        ipadNav.showMarketBriefing(session, selectedYmd, { drillFrom: 'home' });
        return;
      }
      router.push({
        pathname: '/market-briefing',
        params: { date: selectedYmd, from: 'home', ...(session ? { session } : null) },
      } as never);
    },
    [ipadNav, router, selectedYmd],
  );

  const openSignalSheet = useCallback((row: SignalApiMarketBriefing) => {
    setBriefingSheet(row);
  }, []);

  const closeBriefingSheet = useCallback(() => {
    setBriefingSheet(null);
  }, []);

  const briefingSheetTitle = useMemo(
    () => (briefingSheet ? briefingHomeTitle(briefingSheet) : ''),
    [briefingSheet],
  );

  const openEtfInsightsList = useCallback(() => {
    if (ipadNav.isAvailable) {
      ipadNav.showEtfInsights({ drillFrom: 'home' });
      return;
    }
    router.navigate('/etf-insights' as never);
  }, [ipadNav, router]);

  const openEtfInsightSheet = useCallback(() => {
    if (!etfInsight) return;
    setEtfInsightSheetOpen(true);
  }, [etfInsight]);

  const closeEtfInsightSheet = useCallback(() => {
    setEtfInsightSheetOpen(false);
  }, []);

  const openWatchlist = useCallback(() => {
    if (ipadNav.isAvailable) {
      ipadNav.showWatchlist({ drillFrom: 'home' });
      return;
    }
    router.push('/watchlist' as never);
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

  const closeDigestSheet = useCallback(() => {
    setDigestSheet(null);
  }, []);

  const digestSheetTitle = useMemo(() => {
    if (!digestSheet) return '';
    return digestSheet.row.item.title;
  }, [digestSheet]);

  const digestSheetSummary = useMemo(() => {
    if (!digestSheet) return undefined;
    const summary = digestSheet.row.item.summary?.trim();
    return summary || undefined;
  }, [digestSheet]);

  const digestSheetRows = useMemo(() => {
    if (!digestSheet) return [];
    return newsDigestSourceSheetRows(digestSheet.row.item, locale as AppLocale);
  }, [digestSheet, locale]);

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

  const openTodayBriefingSheet = useCallback((row: SignalApiTodayBriefing) => {
    setTodayBriefingSheet(row);
  }, []);

  const closeTodayBriefingSheet = useCallback(() => {
    setTodayBriefingSheet(null);
  }, []);

  const openHero = useCallback(() => {
    if (!homeHero) return;
    if (homeHero.kind === 'today') {
      openTodayBriefingSheet(homeHero.briefing);
      return;
    }
    openSignalSheet(homeHero.briefing);
  }, [homeHero, openSignalSheet, openTodayBriefingSheet]);

  const openHeroSection = useCallback(() => {
    if (!homeHero) return;
    if (homeHero.kind === 'today') {
      openTodayBriefing();
      return;
    }
    openSignal(homeHero.briefing);
  }, [homeHero, openSignal, openTodayBriefing]);

  const renderHeroCard = useCallback(() => {
    if (!homeHero) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{t('ipadHomeHeroEmpty')}</Text>
        </View>
      );
    }
    const headline = homeHeroHeadline(homeHero);
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
        {headline ? (
          <ChangeTintedText style={styles.issueGroupTitle}>{headline}</ChangeTintedText>
        ) : null}
      </Pressable>
    );
  }, [heroSectionTitle, homeHero, openHero, showIssueSummary, styles, t]);

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
          onPress={openEtfInsightSheet}
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
                <EntityLinkedTintedText
                  style={styles.issueGroupTitle}
                  numberOfLines={2}
                  entities={item.entities}>
                  {leadText}
                </EntityLinkedTintedText>
              ) : null}
              {previewText ? (
                <EntityLinkedTintedText
                  style={styles.signalText}
                  numberOfLines={2}
                  entities={item.entities}>
                  {previewText}
                </EntityLinkedTintedText>
              ) : null}
            </View>
          </View>
        </Pressable>
      );
    },
    [openEtfInsightSheet, showIssueSummary, styles, t],
  );

  const renderEtfSectionBody = useCallback(() => {
    if (!etfInsight) return null;
    if (etfHeatmapCells.length > 0) {
      return (
        <Pressable
          onPress={openEtfInsightSheet}
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
    openEtfInsightSheet,
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
            return (
              <HomeDigestFeedRow
                key={row.item.id}
                title={row.item.title}
                titleLines={2}
                timeLabel={formatFeedItemTimeLabel(newsDigestCreatedIso(row.item), locale)}
                trailText={trailText || null}
                summary={null}
                entities={row.item.entities}
                sourceEntries={sourceEntries}
                bordered={index < rows.length - 1}
                onPress={() => openIssueSheet(row)}
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
    [openIssueSheet, showIssueSummary, styles, locale, t, theme],
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
          <View style={styles.section}>
            <HomeSectionHeader
              title={heroSectionTitle}
              badge={<AiBadge />}
              onPress={homeHero ? openHeroSection : undefined}
              accessibilityLabel={homeHero ? t('commonViewAll') : undefined}
            />
            {renderHeroCard()}
          </View>

          <View style={styles.section}>
            <HomeSectionHeader
              title={t('newsIssuesTitle')}
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

          {homeCalendarChips.length > 0 ? (
            <View style={styles.section}>
              <HomeSectionHeader
                title={t('ipadHomeCalendarTitle')}
                onPress={openCalendar}
                accessibilityLabel={t('commonViewAll')}
              />
              {renderCalendarChips()}
            </View>
          ) : null}

          {selectedIsExactToday ? (
            <View style={styles.section}>
              <HomeSectionHeader
                title={t('homeFocusWatchTitle')}
                onPress={openWatchlist}
                accessibilityLabel={t('commonViewAll')}
              />
              <View style={styles.quoteGrid}>
                {quotes.length === 0 ? (
                  <Text style={styles.emptyText}>{t('quotesEmptyWatch')}</Text>
                ) : (
                  quotes.slice(0, watchlistDisplayCount).map((row, index) => {
                    const pct = row.quote?.changePercent;
                    const hasPct = typeof pct === 'number' && Number.isFinite(pct);
                    const up = hasPct && pct >= 0;
                    const hasQuote = Boolean(row.quote);
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
                  })
                )}
              </View>
            </View>
          ) : null}

          {etfInsight && shouldShowEtfBriefingOnHome(etfInsight.insightDate, selectedYmd) ? (
            <View style={styles.section}>
              <HomeSectionHeader
                title={t('homeEtfInsightTitle')}
                badge={<AiBadge />}
                onPress={openEtfInsightsList}
                accessibilityLabel={t('commonViewAll')}
              />
              {renderEtfSectionBody()}
            </View>
          ) : null}
        </>
      )}
        </WebWheelScrollView>
      </View>
      {datePickerSheet}
      <DigestSourcesSheet
        visible={digestSheet != null}
        kicker={t('newsIssuesTitle')}
        digestTitle={digestSheetTitle}
        digestSummary={digestSheetSummary}
        entities={digestSheet?.row.item.entities}
        rows={digestSheetRows}
        onClose={closeDigestSheet}
      />
      <MarketBriefingSheet
        visible={briefingSheet != null}
        briefing={briefingSheet}
        title={briefingSheetTitle}
        onClose={closeBriefingSheet}
      />
      <TodayBriefingSheet
        visible={todayBriefingSheet != null}
        briefing={todayBriefingSheet}
        onClose={closeTodayBriefingSheet}
      />
      <EtfInsightSheet
        visible={etfInsightSheetOpen && etfInsight != null}
        insight={etfInsight}
        onClose={closeEtfInsightSheet}
      />
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
