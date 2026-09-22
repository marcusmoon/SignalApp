import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
  COMFORT_GAP_XS,
  COMFORT_PADDING_ROW_V,
} from '@/constants/comfortDensity';
import {
  HOME_CARD_PAD_H,
  HOME_ETF_TITLE_LINE_PX,
  HOME_ETF_TITLE_PX,
  HOME_QUOTE_CHANGE_PX,
  HOME_QUOTE_LOGO,
  HOME_QUOTE_NAME_PX,
  HOME_QUOTE_PRICE_PX,
  HOME_QUOTE_TILE_MIN_HEIGHT,
} from '@/constants/homeScan';
import { UI_RADIUS_CARD, UI_RADIUS_CARD_LG } from '@/constants/uiCornerRadius';
import { APP_CONTENT_SIDE_PADDING } from '@/constants/responsiveLayout';
import { UI_FONT_WEIGHT_EMPHASIS } from '@/constants/uiFontWeight';
import { ChangeHeatmapGrid, type ChangeHeatmapCell } from '@/components/signal/ChangeHeatmapGrid';
import { HomeSectionHeader } from '@/components/signal/HomeSectionHeader';
import { HomeSectionLeadIcon } from '@/components/signal/HomeSectionLeadIcon';
import { HomeShortcutsStrip } from '@/components/signal/HomeShortcutsStrip';
import { ChangeTintedText } from '@/components/signal/ChangeTintedText';
import { HomeNewsFeed } from '@/components/signal/HomeNewsFeed';
import { HomeTrendHeroCard } from '@/components/signal/HomeTrendHeroCard';
import { HomeCalendarAgenda } from '@/components/signal/HomeCalendarAgenda';
import { SectionCapRule } from '@/components/signal/SectionCapRule';
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
import type { AppTheme } from '@/constants/theme';
import { webScrollViewportStyle, webShellBackground } from '@/constants/webLayout';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { NEWS_SEGMENT_LABEL } from '@/domain/news/feedFilters';
import { selectHomeNews } from '@/domain/home/newsReading';
import { settleHomeSection } from '@/domain/home/sectionLoading';
import {
  homeCalendarAgendaIsEmpty,
  homeCalendarChipRangeEnd,
  splitHomeCalendarAgenda,
} from '@/domain/home/calendarChipLabel';
import {
  filterHomeCalendarEvents,
} from '@/domain/home/homeCalendarEvents';
import { briefingsForYmd } from '@/domain/home/briefingDate';
import { etfHomeHeatmapCells } from '@/domain/home/etfHomeHeatmap';
import { etfHomeLeadText } from '@/domain/home/etfHomeLead';
import {
  aggregateHomeKeywords,
  HOME_KEYWORD_LIMIT,
  homeKeywordSymbolsMissingNames,
  resolveHomeKeywordsAsOfIso,
  type HomeKeywordChip,
} from '@/domain/home/aggregateHomeKeywords';
import {
  buildHomeKeywordSymbolProfiles,
  homeKeywordIsSymbolChip,
  homeKeywordSymbolKey,
  isUsableCompanyName,
} from '@/domain/home/homeKeywordDisplay';
import { companyNameForSymbolUi } from '@/domain/symbols/symbolIdentity';
import { pickSymbolMetaLogoUrl, pickSymbolMetaName } from '@/domain/symbols/symbolMetaDisplay';
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
import { buildHomeQuoteBatchSymbols } from '@/domain/home/homeQuoteBatch';
import {
  HOME_INDEX_DEFS,
  HOME_INDEX_SYMBOLS,
  formatHomeIndexLevel,
  homeIndexDefForSymbol,
  isHomeIndexSymbol,
} from '@/domain/home/homeIndices';
import {
  HOME_FX_DEFS,
  HOME_FX_SYMBOLS,
  formatHomeFxRate,
  homeFxDefForSymbol,
  homeFxDefsForLayout,
  homeFxFlagImageUrl,
  isHomeFxSymbol,
} from '@/domain/home/homeFx';
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
import {
  isCoinQuote,
  isWatchlistQuoteClosed,
  resolveWatchlistHomeAsOf,
  type WatchlistHomeAsOf,
  type WatchlistHomeAsOfRow,
} from '@/domain/quotes/watchlistHomeAsOf';
import type { AppLocale, MessageId } from '@/locales/messages';
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
import { marketBriefingSessionLabelId } from '@/domain/briefings/sessionLabel';
import { shouldShowEtfBriefingOnHome } from '@/domain/etfInsights/homeVisibility';
import { fetchSignalEtfInsightForDate } from '@/integrations/signal-api/etfInsights';
import { fetchSignalMarketBriefings } from '@/integrations/signal-api/marketBriefings';
import { fetchSignalCoins, fetchSignalMarketQuotes } from '@/integrations/signal-api/market';
import { fetchSignalStockProfile } from '@/integrations/signal-api/stock';
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
import { loadWatchlistSymbols, subscribeWatchlistSymbolsChanged } from '@/services/quoteWatchlist';
import type { CalendarEvent } from '@/types/signal';
import {
  addDays,
  formatLocalYmdLabel,
  formatFeedItemTimeLabel,
  parseLocalYmd,
  toYmd,
  utcRangeForLocalYmd,
} from '@/utils/date';

const ISSUE_FETCH_LIMIT = 12;
const BRIEFING_LIMIT = 30;
const HOME_CALENDAR_LOOKAHEAD_DAYS = 14;
const HOME_COIN_FETCH_LIMIT = Math.max(HOME_ANCHOR_COIN_FETCH_POOL, 8);

type HomeQuotesLayerAsOfView = {
  label: string | null;
  showsClose: boolean;
};

/** Resolve + format layer as-of once (label + whether header Close suppresses tile Close). */
function homeQuotesLayerAsOfView(
  rows: readonly WatchlistHomeAsOfRow[],
  locale: AppLocale,
  t: (id: MessageId, vars?: Record<string, string | number>) => string,
): HomeQuotesLayerAsOfView {
  const resolved: WatchlistHomeAsOf | null = resolveWatchlistHomeAsOf(rows);
  if (!resolved) return { label: null, showsClose: false };
  if (resolved.mode === 'relative') {
    const label = formatFeedItemTimeLabel(resolved.iso, locale);
    return {
      label: label && label !== '—' ? label : null,
      showsClose: false,
    };
  }
  return { label: t('quotesAsOfClose'), showsClose: true };
}

type HomeFocusContentProps = {
  selectedYmd: string;
  todayYmd: string;
  onSelectedYmdChange: (ymd: string) => void;
  scrollContentPaddingBottom?: number;
  headerAccessory?: ReactNode;
  showIssueSummary?: boolean;
  /** iPhone `SignalHeader` 브랜드 탭 · refresh FAB → PTR 연결용 */
  onPullRefreshReady?: (refresh: () => void) => void;
  /** PTR/FAB 진행 상태 (FAB disabled 등) */
  onRefreshingChange?: (refreshing: boolean) => void;
};

type IssueRow = {
  category: HomeDigestCategory;
  item: SignalApiNewsDigestItem;
};

function shiftYmd(ymd: string, days: number): string {
  return toYmd(addDays(parseLocalYmd(ymd), days));
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

async function fetchTodayBriefingWithFallback(
  date: string,
  locale: string,
  cacheMode: ReturnType<typeof signalCacheMode>,
): Promise<SignalApiTodayBriefing | null> {
  const primary = await fetchSignalTodayBriefing({ date, locale }, { cacheMode });
  if (primary || locale === 'ko') return primary;
  return fetchSignalTodayBriefing({ date, locale: 'ko' }, { cacheMode });
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

export function HomeFocusContent({
  selectedYmd,
  todayYmd,
  onSelectedYmdChange,
  scrollContentPaddingBottom = 28,
  headerAccessory,
  showIssueSummary = false,
  onPullRefreshReady,
  onRefreshingChange,
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
  const loadedScopeRef = useRef<string | null>(null);
  const loadGenerationRef = useRef(0);
  const refreshInFlightRef = useRef(false);

  const [loading, setLoading] = useState(true);
  /** Any in-flight refresh (FAB disable / a11y). */
  const [refreshing, setRefreshing] = useState(false);
  /** Only true for pull gesture — drives RefreshControl inset/spinner. */
  const [ptrRefreshing, setPtrRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  useResetRefreshingOnTabBlur(setPtrRefreshing);
  const [error, setError] = useState<string | null>(null);
  const [pendingSections, setPendingSections] = useState<string[]>([]);
  const [failedSections, setFailedSections] = useState<string[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistRevision, setWatchlistRevision] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [newsFlowDisplayCount, setNewsFlowDisplayCount] = useState(HOME_NEWS_FLOW_DISPLAY_DEFAULT);
  const [watchlistDisplayCount, setWatchlistDisplayCount] = useState(HOME_WATCHLIST_DISPLAY_DEFAULT);
  const [sectorFlowDisplayCount, setSectorFlowDisplayCount] = useState(HOME_SECTOR_FLOW_DISPLAY_DEFAULT);
  const [homeShortcuts, setHomeShortcuts] = useState<HomeShortcut[]>(
    HOME_SHORTCUTS_DEFAULT.map((row) => ({ ...row })),
  );
  const [homeDisplayPrefsReady, setHomeDisplayPrefsReady] = useState(false);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [indexQuotes, setIndexQuotes] = useState<QuoteRow[]>([]);
  const [fxQuotes, setFxQuotes] = useState<QuoteRow[]>([]);
  const [keywordQuoteNames, setKeywordQuoteNames] = useState<Map<string, string>>(new Map());
  const keywordNameAttemptedRef = useRef<Set<string>>(new Set());
  const [anchorCoins, setAnchorCoins] = useState<QuoteRow[]>([]);
  const [briefings, setBriefings] = useState<SignalApiMarketBriefing[]>([]);
  const [todayBriefing, setTodayBriefing] = useState<SignalApiTodayBriefing | null>(null);
  const [etfInsight, setEtfInsight] = useState<SignalApiEtfInsight | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const homeHero = useMemo(
    () => selectHomeHeroBriefing({ selectedYmd, todayYmd, todayBriefing, briefings }),
    [selectedYmd, todayYmd, todayBriefing, briefings],
  );

  const homeCalendarAgenda = useMemo(
    () => splitHomeCalendarAgenda(calendarEvents, selectedYmd, todayYmd),
    [calendarEvents, selectedYmd, todayYmd],
  );
  const showHomeCalendar = !homeCalendarAgendaIsEmpty(homeCalendarAgenda);

  const homeIssues = useMemo(
    () => selectHomeNews(issues, [], 'all', newsFlowDisplayCount),
    [issues, newsFlowDisplayCount],
  );

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
        limit: HOME_KEYWORD_LIMIT,
      }),
    [briefings, homeIssues, selectedYmd, todayBriefing],
  );

  /** Newest contributing briefing/digest timestamp — approximate scan freshness. */
  const homeKeywordsAsOfLabel = useMemo(() => {
    const dayBriefings = briefingsForYmd(briefings, selectedYmd);
    const iso = resolveHomeKeywordsAsOfIso({
      todayKeywords: todayBriefing?.keywords,
      todayGeneratedAt: todayBriefing?.generatedAt || todayBriefing?.publishedAt || null,
      marketRows: dayBriefings.map((b) => ({
        keywords: b.keywords,
        at: b.publishedAt || b.updatedAt || b.createdAt || null,
      })),
      digestRows: homeIssues.map((row) => ({
        keywords: row.item.keywords,
        topics: row.item.topics,
        at: row.item.generatedAt || row.item.sourceRefs[0]?.publishedAt || null,
      })),
    });
    if (!iso) return null;
    const label = formatFeedItemTimeLabel(iso, locale);
    return label && label !== '—' ? label : null;
  }, [briefings, homeIssues, locale, selectedYmd, todayBriefing]);

  const homeKeywordSymbolProfiles = useMemo(() => {
    const companies = briefingsForYmd(briefings, selectedYmd).flatMap((b) => b.companies ?? []);
    return buildHomeKeywordSymbolProfiles({
      companies,
      quotes: [
        ...quotes.map((row) => ({
          symbol: row.symbol,
          name: pickSymbolMetaName(row) ?? row.quote?.name ?? null,
          imageUrl: pickSymbolMetaLogoUrl(row),
          symbolMeta: row.symbolMeta ?? null,
        })),
        ...[...keywordQuoteNames.entries()].map(([symbol, name]) => ({ symbol, name })),
      ],
    });
  }, [briefings, keywordQuoteNames, quotes, selectedYmd]);

  useEffect(() => {
    if (!hasSignalApi()) {
      setKeywordQuoteNames(new Map());
      keywordNameAttemptedRef.current = new Set();
      return;
    }
    const symbols = homeKeywordSymbolsMissingNames(homeKeywords).filter((symbol) => {
      if (keywordNameAttemptedRef.current.has(symbol)) return false;
      return !homeKeywordSymbolProfiles.get(symbol)?.name;
    });
    if (symbols.length === 0) return;

    for (const symbol of symbols) keywordNameAttemptedRef.current.add(symbol);

    let cancelled = false;
    void (async () => {
      const next = new Map<string, string>();
      const quoteByKey = new Map<string, SignalApiMarketQuote>();
      try {
        const rows = await fetchSignalMarketQuotes(
          { symbols, limit: symbols.length },
          { cacheMode: signalCacheMode() },
        );
        for (const row of rows) {
          const key = String(row.symbol || '').trim().toUpperCase();
          if (key) quoteByKey.set(key, row);
          const display = String(row.symbolMeta?.displaySymbol || row.displaySymbol || '')
            .trim()
            .toUpperCase();
          if (display) quoteByKey.set(display, row);
        }
      } catch {
        // fall through to profile hydration for missing names
      }

      const stillMissing: string[] = [];
      for (const symbol of symbols) {
        const row = quoteByKey.get(symbol.trim().toUpperCase());
        const metaName = String(pickSymbolMetaName(row) || '').trim();
        if (isUsableCompanyName(metaName, symbol)) {
          next.set(homeKeywordSymbolKey(symbol), metaName);
          continue;
        }
        stillMissing.push(symbol);
      }

      await Promise.all(
        stillMissing.map(async (symbol) => {
          try {
            const profile = await fetchSignalStockProfile(symbol);
            const name = String(profile?.name || '').trim();
            if (isUsableCompanyName(name, symbol)) {
              next.set(homeKeywordSymbolKey(symbol), name);
            }
          } catch {
            // keep ticker label
          }
        }),
      );

      if (cancelled || next.size === 0) return;
      setKeywordQuoteNames((prev) => {
        const merged = new Map(prev);
        for (const [k, v] of next) {
          if (!merged.has(k)) merged.set(k, v);
        }
        return merged;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [homeKeywordSymbolProfiles, homeKeywords]);

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

  const homeWatchRows = useMemo(
    () => quotes.slice(0, watchlistDisplayCount),
    [quotes, watchlistDisplayCount],
  );

  /** compact 2 · wide(PC) 3 — crypto_symbols 순 풀에서 워치리스트 중복을 건너뛰고 채움 */
  const homeAnchorCoinRows = useMemo(
    () =>
      filterHomeAnchorCoinsNotInWatchlist(
        anchorCoins,
        homeWatchRows.map((row) => row.symbol),
      ).slice(0, homeAnchorCoinCount(useTwoPane)),
    [anchorCoins, homeWatchRows, useTwoPane],
  );

  /** Compact 2 · wide/PC 3 (위안). */
  const homeFxRows = useMemo(() => {
    const allow = new Set(homeFxDefsForLayout(useTwoPane).map((def) => def.symbol.toUpperCase()));
    return fxQuotes.filter((row) => allow.has(row.symbol.trim().toUpperCase()));
  }, [fxQuotes, useTwoPane]);

  /** 레이어 as-of — 전부 종가일 때만 Close; 혼재 시 상대시간 + 타일별 Close. */
  const indexLayerAsOfView = useMemo(
    () => homeQuotesLayerAsOfView(indexQuotes, locale, t),
    [indexQuotes, locale, t],
  );
  const watchLayerAsOfView = useMemo(
    () => homeQuotesLayerAsOfView(homeWatchRows, locale, t),
    [homeWatchRows, locale, t],
  );
  const coinLayerAsOfView = useMemo(
    () => homeQuotesLayerAsOfView(homeAnchorCoinRows, locale, t),
    [homeAnchorCoinRows, locale, t],
  );
  const fxLayerAsOfView = useMemo(
    () => homeQuotesLayerAsOfView(homeFxRows, locale, t),
    [homeFxRows, locale, t],
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
  const heroHeadline = homeHero ? homeHeroHeadline(homeHero) : '';
  const heroSummary = homeHero?.briefing.summary?.trim() || '';
  const showTrendHeroSection =
    homeKeywords.length > 0 || Boolean(String(heroHeadline || '').trim());
  const trendHeroSectionTitle =
    homeHero && heroHeadline ? heroSectionTitle : t('homeKeywordsTitle');
  const trendHeroSectionBadge =
    homeHero && heroHeadline ? (
      <HomeSectionLeadIcon name="reader-outline" />
    ) : (
      <HomeSectionLeadIcon name="trending-up-outline" />
    );
  const heroTime = homeHero?.briefing.publishedAt || homeHero?.briefing.createdAt;
  const trendHeroSectionMeta = heroTime ? formatFeedItemTimeLabel(heroTime, locale) : homeKeywordsAsOfLabel;
  const trendHeroSessionDividerLabel = useMemo(() => {
    if (!homeHero || !heroHeadline) return null;
    if (homeHero.kind === 'today') return t('ipadHomeTitle');
    if (homeHero.kind === 'market') {
      const labelId = marketBriefingSessionLabelId(homeHero.briefing);
      return labelId ? t(labelId) : null;
    }
    return null;
  }, [homeHero, heroHeadline, t]);

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
    const isCurrent = () => generation === loadGenerationRef.current;
    const scope = `${selectedYmd}|${locale}`;
    if (loadedScopeRef.current !== scope) {
      loadedScopeRef.current = scope;
      setIssues([]);
      setQuotes([]);
      setIndexQuotes([]);
      setFxQuotes([]);
      setAnchorCoins([]);
      setBriefings([]);
      setTodayBriefing(null);
      setEtfInsight(null);
      setCalendarEvents([]);
      setKeywordQuoteNames(new Map());
      keywordNameAttemptedRef.current = new Set();
    }
    setFailedSections([]);
    if (!hasSignalApi()) {
      setIssues([]);
      setQuotes([]);
      setIndexQuotes([]);
      setFxQuotes([]);
      setAnchorCoins([]);
      setBriefings([]);
      setTodayBriefing(null);
      setCalendarEvents([]);
      setError(t('errorSignalApiShort'));
      setPendingSections([]);
      setLoading(false);
      return;
    }
    const cacheMode = signalCacheMode(forceRefresh);
    setError(null);
    try {
      const watchlist = await loadWatchlistSymbols();
      if (!isCurrent()) return;
      setWatchlist(watchlist);
      const isToday = selectedYmd === todayYmd;
      const symbols = isToday ? watchlist.slice(0, watchlistDisplayCount) : [];
      const allSymbols = isToday
        ? buildHomeQuoteBatchSymbols(symbols, HOME_INDEX_SYMBOLS, HOME_FX_SYMBOLS)
        : [];
      const calendarRangeEnd =
        selectedYmd === todayYmd
          ? homeCalendarChipRangeEnd(selectedYmd, HOME_CALENDAR_LOOKAHEAD_DAYS)
          : selectedYmd;

      const keys = ['today', 'market', 'quotes', 'coins', 'calendar', 'etf', ...HOME_DIGEST_CATEGORIES];
      setPendingSections(keys);
      setLoading(false);
      // Commit each result independently. A failed refresh never erases a successful section.
      const receive = <T,>(key: string, request: Promise<T>, commit: (data: T) => void) => settleHomeSection(request, {
        isCurrent,
        commit,
        fail: () => setFailedSections((previous) => [...previous, key]),
        finish: () => setPendingSections((previous) => previous.filter((item) => item !== key)),
      });
      await Promise.all([
        receive('today', fetchTodayBriefingWithFallback(selectedYmd, locale, cacheMode), setTodayBriefing),
        ...HOME_DIGEST_CATEGORIES.map((category) => receive(category,
          fetchSignalNewsDigests({ category, ...utcRangeForLocalYmd(selectedYmd), limit: ISSUE_FETCH_LIMIT, batches: 1, locale }, { cacheMode }),
          (page) => setIssues((previous) => [...previous.filter((row) => row.category !== category), ...page.items.map((item) => ({ category, item }))]),
        )),
        receive('market', fetchSignalMarketBriefings({ date: selectedYmd, limit: BRIEFING_LIMIT, locale }, { cacheMode }),
          (rows) => setBriefings(uniqueVisibleBriefings([...rows].sort((a, b) => sortBriefingTime(b).localeCompare(sortBriefingTime(a)))))),
        receive('quotes', allSymbols.length > 0
          ? fetchSignalMarketQuotes({ symbols: allSymbols, limit: allSymbols.length }, { cacheMode })
          : Promise.resolve([] as SignalApiMarketQuote[]), (rows) => {
          const bySymbol = new Map<string, QuoteRow>();
          for (const item of rows) {
            const row = mapSignalQuoteToRow(item);
            for (const key of quoteLookupKeys(item, row)) bySymbol.set(key, row);
          }
          const resolve = (symbol: string): QuoteRow => bySymbol.get(symbol.trim().toUpperCase()) ?? { symbol, quote: null, error: 'NO_SERVER_QUOTE' };
          setQuotes(symbols.map(resolve));
          setIndexQuotes(isToday ? HOME_INDEX_DEFS.map((def) => resolve(def.symbol)) : []);
          setFxQuotes(isToday ? HOME_FX_DEFS.map((def) => resolve(def.symbol)) : []);
        }),
        receive('etf', fetchSignalEtfInsightForDate(selectedYmd, { cacheMode }), setEtfInsight),
        receive('coins', isToday ? fetchSignalCoins({ limit: HOME_COIN_FETCH_LIMIT }, { cacheMode }) : Promise.resolve([]),
          (rows) => setAnchorCoins(pickHomeAnchorCoinsFromList(rows, HOME_ANCHOR_COIN_FETCH_POOL).map(mapSignalCoinToRow))),
        receive('calendar', fetchSignalCalendar({ from: shiftYmd(selectedYmd, -1), to: calendarRangeEnd, limit: 120 }, { cacheMode }),
          (rows) => setCalendarEvents(filterHomeCalendarEvents(rows.map(signalCalendarToCalendarEvent).filter((row): row is CalendarEvent => row != null), watchlist, selectedYmd, calendarRangeEnd))),
      ]);
    } catch (e) {
      if (generation !== loadGenerationRef.current) return;
      setError(formatSignalApiError(e, t, 'ipadHomeLoadError'));
    }
  }, [locale, selectedYmd, t, todayYmd, watchlistDisplayCount, watchlistRevision]);

  /**
   * `ptr`: show native RefreshControl (pull gesture).
   * `silent`: FAB/header — keep scroll; do not toggle PTR inset (avoids mid-list jump).
   */
  const refresh = useCallback(async (mode: 'ptr' | 'silent' = 'silent') => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    setRefreshing(true);
    if (mode === 'ptr') setPtrRefreshing(true);
    try {
      await load(true);
    } finally {
      refreshInFlightRef.current = false;
      setRefreshing(false);
      setPtrRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    onPullRefreshReady?.(() => void refresh('silent'));
  }, [onPullRefreshReady, refresh]);

  useEffect(() => {
    onRefreshingChange?.(refreshing);
  }, [onRefreshingChange, refreshing]);

  useRegisterWebHeaderRefresh(() => void refresh('silent'), showIssueSummary ? 'mount' : 'focus');

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
      loadGenerationRef.current += 1;
    };
  }, [load, selectedYmd, homeDisplayPrefsReady]);

  useEffect(() => subscribeWatchlistSymbolsChanged(() => setWatchlistRevision((value) => value + 1)), []);

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

  /** Stocks → in-app detail. Indices/FX/coins → Yahoo. */
  const openHomeQuote = useCallback(
    (row: QuoteRow, opts?: { coin?: boolean; index?: boolean; fx?: boolean }) => {
      const trimmed = row.symbol.trim().toUpperCase();
      if (!trimmed || trimmed === '—') return;
      if (opts?.index || isHomeIndexSymbol(trimmed) || opts?.fx || isHomeFxSymbol(trimmed)) {
        void openYahooFinanceQuote(trimmed, 'stock', {
          yahooSymbol: row.quote?.regularSession?.yahooSymbol || trimmed,
        });
        return;
      }
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
    (
      row: QuoteRow,
      key: string,
      opts?: { coin?: boolean; index?: boolean; fx?: boolean; layerShowsClose?: boolean },
    ) => {
      const pct = row.quote?.changePercent;
      const hasPct = typeof pct === 'number' && Number.isFinite(pct);
      const up = hasPct && pct >= 0;
      const hasQuote = Boolean(row.quote);
      const indexDef = opts?.index ? homeIndexDefForSymbol(row.symbol) : null;
      const fxDef = opts?.fx ? homeFxDefForSymbol(row.symbol) : null;
          const label = indexDef
        ? t(indexDef.labelId)
        : fxDef
          ? t(fxDef.labelId)
          : (() => {
              const ticker = row.symbol;
              const company = companyNameForSymbolUi(pickSymbolMetaName(row), ticker);
              return company || ticker;
            })();
      const logoSymbol = indexDef?.logoSymbol || fxDef?.logoSymbol || row.symbol;
      const logoImageUrl = fxDef
        ? homeFxFlagImageUrl(fxDef)
        : pickSymbolMetaLogoUrl(row);
      const priceLabel = indexDef
        ? formatHomeIndexLevel(row.quote?.currentPrice)
        : fxDef
          ? formatHomeFxRate(row.quote?.currentPrice, fxDef)
          : formatPrice(row);
      // Layer Close covers the whole strip — only mixed sessions need per-tile Close.
      const showClose =
        !opts?.coin &&
        !opts?.layerShowsClose &&
        hasQuote &&
        isWatchlistQuoteClosed(row.quote);
      const closeLabel = t('quotesAsOfClose');
      const a11y = showClose ? `${label}, ${closeLabel}` : label;
      return (
        <Pressable
          key={key}
          onPress={() => openHomeQuote(row, opts)}
          accessibilityRole="button"
          accessibilityLabel={a11y}
          style={({ pressed }) => [styles.quoteTile, pressed && styles.pressed]}>
          <View style={styles.quoteTileContent}>
            <View style={styles.quoteTileLead}>
              <SymbolLogo symbol={logoSymbol} imageUrl={logoImageUrl} size={HOME_QUOTE_LOGO} />
              <View style={styles.quoteTileTitleCol}>
                <Text style={styles.quoteSymbol} numberOfLines={1}>
                  {label}
                </Text>
                {showClose ? (
                  <Text style={styles.quoteCloseMeta} numberOfLines={1}>
                    {closeLabel}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.quoteTileFooter}>
              {hasQuote ? (
                <>
                  <Text style={styles.priceText} numberOfLines={1}>
                    {priceLabel}
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

  /** `● 지수 —— 종가` — 홈 시세 레이어 cap rule */
  const renderQuoteLayerRule = useCallback(
    (title: string, asOf: string | null) => (
      <SectionCapRule
        label={title}
        meta={asOf}
        accessibilityRole="header"
      />
    ),
    [],
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
      if (homeKeywordIsSymbolChip(chip)) {
        openSymbolDetail(homeKeywordSymbolKey(chip.label) || chip.label);
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

  const renderTrendHeroSection = useCallback(() => {
    if (!showTrendHeroSection) return null;
    return (
      <HomeTrendHeroCard
        keywords={homeKeywords}
        symbolProfiles={homeKeywordSymbolProfiles}
        onPressKeyword={openHomeKeyword}
        heroHeadline={heroHeadline || null}
        heroSummary={heroSummary}
        sessionDividerLabel={trendHeroSessionDividerLabel}
        onPressHero={openHero}
        heroAccessibilityLabel={trendHeroSectionTitle}
        compact={showIssueSummary}
      />
    );
  }, [
    heroHeadline,
    heroSummary,
    homeKeywordSymbolProfiles,
    homeKeywords,
    openHero,
    openHomeKeyword,
    showIssueSummary,
    showTrendHeroSection,
    trendHeroSectionTitle,
    trendHeroSessionDividerLabel,
  ]);

  const renderCalendarAgenda = useCallback(
    () => (
      <HomeCalendarAgenda
        agenda={homeCalendarAgenda}
        selectedYmd={selectedYmd}
        onPress={openCalendar}
      />
    ),
    [homeCalendarAgenda, openCalendar, selectedYmd],
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
      const leadText = etfHomeLeadText(etfInsight);
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
          {leadText ? (
            <ChangeTintedText style={styles.issueGroupTitle} numberOfLines={2}>
              {leadText}
            </ChangeTintedText>
          ) : null}
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

  const hasReadingAside = showHomeCalendar || homeShortcuts.length > 0;
  const showColumns = useTwoPane && contentWidth >= 960 && hasReadingAside;
  const failedLabels = [...new Set(failedSections.map((key) =>
    HOME_DIGEST_CATEGORIES.includes(key as HomeDigestCategory) ? t(NEWS_SEGMENT_LABEL[key as HomeDigestCategory])
      : key === 'calendar' ? t('ipadHomeCalendarTitle')
      : key === 'quotes' || key === 'coins' ? t('homeFocusWatchTitle')
      : key === 'etf' ? t('homeEtfInsightTitle') : t('ipadHomeSignalTitle'),
  ))].join(' · ');
  const placeholder = <View style={styles.sectionPlaceholder} accessibilityLabel={t('commonLoading')} accessibilityState={{ busy: true }}>
    <View style={styles.placeholderLine} /><View style={[styles.placeholderLine, { width: '68%' }]} />
  </View>;

  return (
    <>
      <View style={styles.root} onLayout={(event) => setContentWidth(event.nativeEvent.layout.width)}>
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
        refreshControl={
          <ThemedRefreshControl refreshing={ptrRefreshing} onRefresh={() => void refresh('ptr')} />
        }>
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {failedSections.length > 0 ? <View style={styles.loadNotice} accessibilityRole="alert">
          <Ionicons name="cloud-offline-outline" size={20} color={theme.textMuted} />
          <Text style={styles.loadNoticeText}>{t('homePartialLoadError', { sections: failedLabels })}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('commonRetry')} disabled={refreshing}
            onPress={() => void refresh()} style={styles.retryButton}>
            <Ionicons name="refresh-outline" size={20} color={theme.green} />
          </Pressable>
        </View> : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <SignalLoadingIndicator message={t('commonLoading')} />
          </View>
        ) : (
          <>
          {showTrendHeroSection ? (
            <View style={styles.section}>
              <HomeSectionHeader
                title={trendHeroSectionTitle}
                badge={trendHeroSectionBadge}
                meta={trendHeroSectionMeta}
              />
              {renderTrendHeroSection()}
            </View>
          ) : pendingSections.includes('today') || pendingSections.includes('market') ? placeholder : null}

          <View style={[styles.readingLayout, showColumns && styles.readingColumns]}>
          <View style={[styles.readingMain, showColumns && styles.readingMainWide]}>
            <HomeNewsFeed rows={issues} limit={newsFlowDisplayCount} selectedYmd={selectedYmd} refreshing={refreshing}
              pending={pendingSections.some((key) => HOME_DIGEST_CATEGORIES.includes(key as HomeDigestCategory))}
              failed={failedSections.some((key) => HOME_DIGEST_CATEGORIES.includes(key as HomeDigestCategory))}
              onOpen={openIssueDetail} />
          </View>
          {hasReadingAside ? <View style={[styles.readingAside, showColumns && styles.readingAsideWide]}>
          {showHomeCalendar ? (
            <View style={styles.section}>
              <HomeSectionHeader
                title={t('ipadHomeCalendarTitle')}
                badge={<HomeSectionLeadIcon name="calendar-outline" />}
              />
              {renderCalendarAgenda()}
            </View>
          ) : null}

          {homeShortcuts.length > 0 ? (
            <View style={styles.section}>
              <HomeSectionHeader
                title={t('homeShortcutsTitle')}
                badge={<HomeSectionLeadIcon name="apps-outline" />}
              />
              <HomeShortcutsStrip shortcuts={homeShortcuts} selectedYmd={selectedYmd} />
            </View>
          ) : null}
          </View> : null}
          </View>

          {selectedIsExactToday ? (
            <View style={styles.section}>
              <HomeSectionHeader
                title={t('homeFocusWatchTitle')}
                badge={<HomeSectionLeadIcon name="stats-chart-outline" />}
              />
              <View style={styles.quoteStack}>
                {indexQuotes.length === 0 &&
                homeWatchRows.length === 0 &&
                homeAnchorCoinRows.length === 0 &&
                homeFxRows.length === 0 ? (
                  pendingSections.includes('quotes') ? placeholder : <Text style={styles.emptyText}>{t(failedSections.includes('quotes') ? 'homeNewsUnavailable' : 'quotesEmptyWatch')}</Text>
                ) : (
                  <>
                    {indexQuotes.length > 0 ? (
                      <View style={styles.quoteLayer}>
                        {renderQuoteLayerRule(t('homeQuotesLayerIndices'), indexLayerAsOfView.label)}
                        <View style={styles.quoteGrid}>
                          {indexQuotes.map((row, index) =>
                            renderHomeQuoteTile(row, `index-${index}`, {
                              index: true,
                              layerShowsClose: indexLayerAsOfView.showsClose,
                            }),
                          )}
                        </View>
                      </View>
                    ) : null}
                    {homeWatchRows.length > 0 ? (
                      <View style={styles.quoteLayer}>
                        {renderQuoteLayerRule(t('homeQuotesLayerWatch'), watchLayerAsOfView.label)}
                        <View style={styles.quoteGrid}>
                          {homeWatchRows.map((row, index) =>
                            renderHomeQuoteTile(row, `watch-${index}`, {
                              layerShowsClose: watchLayerAsOfView.showsClose,
                            }),
                          )}
                        </View>
                      </View>
                    ) : null}
                    {homeAnchorCoinRows.length > 0 ? (
                      <View style={styles.quoteLayer}>
                        {renderQuoteLayerRule(t('homeQuotesLayerCoin'), coinLayerAsOfView.label)}
                        <View style={styles.quoteGrid}>
                          {homeAnchorCoinRows.map((row, index) =>
                            renderHomeQuoteTile(row, `anchor-${index}`, { coin: true }),
                          )}
                        </View>
                      </View>
                    ) : null}
                    {homeFxRows.length > 0 ? (
                      <View style={styles.quoteLayer}>
                        {renderQuoteLayerRule(t('homeQuotesLayerFx'), fxLayerAsOfView.label)}
                        <View style={styles.quoteGrid}>
                          {homeFxRows.map((row, index) =>
                            renderHomeQuoteTile(row, `fx-${index}`, {
                              fx: true,
                              layerShowsClose: fxLayerAsOfView.showsClose,
                            }),
                          )}
                        </View>
                      </View>
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
                badge={<HomeSectionLeadIcon name="grid-outline" />}
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
    readingLayout: { gap: 28, minWidth: 0 },
    readingColumns: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
    readingMain: { minWidth: 0 },
    readingMainWide: { flex: 1 },
    readingAside: { gap: 24, minWidth: 0 },
    readingAsideWide: { width: '32%', maxWidth: 390 },
    loadNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.border },
    loadNoticeText: { flex: 1, color: theme.textMuted, fontSize: ft.ff(13), lineHeight: ft.ff(19) },
    retryButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    sectionPlaceholder: { minHeight: 84, paddingVertical: 16, gap: 14 },
    placeholderLine: { height: 14, width: '90%', borderRadius: 4, backgroundColor: theme.bgElevated },
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
      paddingHorizontal: HOME_CARD_PAD_H,
      paddingVertical: COMFORT_PADDING_ROW_V,
      gap: COMFORT_GAP_SM,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
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
      fontSize: ft.ff(HOME_ETF_TITLE_PX),
      lineHeight: sf(HOME_ETF_TITLE_LINE_PX),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    section: {
      gap: COMFORT_GAP_SM,
    },
    quoteStack: {
      gap: COMFORT_GAP_LG,
    },
    quoteLayer: {
      gap: COMFORT_GAP_SM,
    },
    quoteGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      /** 좌·우 끝은 레이어 라인과 맞추고, 타일만 살짝 넓혀 중간 gap을 줄인다. */
      justifyContent: 'space-between',
      rowGap: COMFORT_GAP_XS,
    },
    quoteTile: {
      /** 폰 2열 · 와이드 3열 — 합이 거의 100%라 우측이 레이어 as-of 칩과 정렬됨 */
      width: useTwoPane ? '32.6%' : '49%',
      minHeight: HOME_QUOTE_TILE_MIN_HEIGHT,
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
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: COMFORT_GAP_SM,
    },
    quoteTileLead: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    quoteTileTitleCol: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    quoteTileFooter: {
      minWidth: 70,
      gap: 2,
      alignItems: 'flex-end',
    },
    quoteSymbol: {
      fontSize: ft.ff(HOME_QUOTE_NAME_PX),
      lineHeight: sf(18),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    quoteCloseMeta: {
      fontSize: ft.ff(11),
      lineHeight: sf(14),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    priceText: {
      fontSize: ft.ff(HOME_QUOTE_PRICE_PX),
      lineHeight: sf(19),
      fontWeight: ft.emphasisWeight,
      color: theme.text,
      fontVariant: ['tabular-nums'],
    },
    changeText: {
      marginTop: 1,
      fontSize: ft.ff(HOME_QUOTE_CHANGE_PX),
      lineHeight: sf(20),
      fontWeight: ft.emphasisWeight,
      fontVariant: ['tabular-nums'],
    },
    quotePendingText: {
      fontSize: ft.ff(12),
      lineHeight: sf(16),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    signalText: {
      fontSize: ft.signalBodyFont(14),
      lineHeight: sf(21),
      fontWeight: ft.signalBodyWeight,
      color: theme.textMuted,
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
