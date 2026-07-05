import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { HomeAiBadge } from '@/components/signal/HomeAiBadge';
import { HomeSectionAccentLine } from '@/components/signal/HomeSectionAccentLine';
import { HomeSectionHeader } from '@/components/signal/HomeSectionHeader';
import { SignalDateNavigator } from '@/components/signal/SignalDateNavigator';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import {
  HOME_DIGEST_CATEGORIES,
  HOME_SIGNAL_SESSIONS,
  homeDigestCategoryIcon,
  type HomeDigestCategory,
  type NewsIssuesCategory,
  type SignalSessionKey,
} from '@/constants/ipadHomeNav';
import type { AppTheme } from '@/constants/theme';
import { webScrollViewportStyle, webShellBackground } from '@/constants/webLayout';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { NEWS_SEGMENT_LABEL } from '@/domain/news/feedFilters';
import { formatQuoteDpPct, formatUsd, formatKrw, isKoreaStockQuote, mapSignalQuoteToRow, quoteLookupKeys, type QuoteRow } from '@/domain/quotes/rows';
import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useQuoteChangeColors } from '@/hooks';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchSignalDisclosureDigests } from '@/integrations/signal-api/disclosureDigests';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { fetchSignalCalendar, signalCalendarToCalendarEvent } from '@/integrations/signal-api';
import { fetchSignalMarketBriefings } from '@/integrations/signal-api/marketBriefings';
import { fetchSignalMarketQuotes } from '@/integrations/signal-api/market';
import { fetchSignalNewsDigests } from '@/integrations/signal-api/newsDigests';
import { fetchSignalTodayBriefing } from '@/integrations/signal-api/todayBriefings';
import type {
  SignalApiDisclosureDigestItem,
  SignalApiMarketBriefing,
  SignalApiMarketQuote,
  SignalApiNewsDigestItem,
  SignalApiTodayBriefing,
} from '@/integrations/signal-api/types';
import type { MessageId } from '@/locales/messages';
import { hasSignalApi } from '@/services/env';
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
  parseLocalYmd,
  toYmd,
  utcRangeForLocalYmd,
} from '@/utils/date';

const ISSUE_FETCH_LIMIT = 24;
const HOME_ISSUE_LIMIT = 6;
const BRIEFING_LIMIT = 30;
const HOME_SIGNAL_LIMIT = 4;
const DISCLOSURE_LIMIT = 3;
const HOME_CALENDAR_LIMIT = 6;
const HOME_CALENDAR_LOOKAHEAD_DAYS = 14;

type HomeFocusContentProps = {
  selectedYmd: string;
  todayYmd: string;
  onSelectedYmdChange: (ymd: string) => void;
  scrollContentPaddingBottom?: number;
  headerAccessory?: ReactNode;
  contentMaxWidth?: number;
  showIssueSummary?: boolean;
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

async function fetchTopIssues(date: string): Promise<IssueRow[]> {
  const range = utcRangeForLocalYmd(date);
  const results = await Promise.all(
    HOME_DIGEST_CATEGORIES.map(async (category) => {
      const page = await fetchSignalNewsDigests({
        category,
        ...range,
        limit: ISSUE_FETCH_LIMIT,
        batches: 20,
      }).catch(() => ({ items: [] as SignalApiNewsDigestItem[] }));
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

async function fetchTodayBriefingWithFallback(date: string, locale: string): Promise<SignalApiTodayBriefing | null> {
  const primary = await fetchSignalTodayBriefing({ date, locale }).catch(() => null);
  if (primary || locale === 'ko') return primary;
  return fetchSignalTodayBriefing({ date, locale: 'ko' }).catch(() => null);
}

function formatPrice(row: QuoteRow): string {
  const value = row.quote?.currentPrice;
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return isKoreaStockQuote(row) ? formatKrw(value) : formatUsd(value);
}

function marketLabel(market: string): string {
  const key = String(market || '').trim().toLowerCase();
  if (key === 'us') return 'US';
  if (key === 'kr') return 'KR';
  return key ? key.toUpperCase() : 'SIGNAL';
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
  contentMaxWidth,
  showIssueSummary = false,
}: HomeFocusContentProps) {
  const router = useRouter();
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const quoteChange = useQuoteChangeColors();
  const { t, locale } = useLocale();
  const ipadNav = useIpadSidebarNav();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const selectedIsToday = selectedYmd >= todayYmd;
  const selectedIsExactToday = selectedYmd === todayYmd;
  const loadedYmdRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchlistDisplayCount, setWatchlistDisplayCount] = useState(HOME_WATCHLIST_DISPLAY_DEFAULT);
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
    () => [...issues].sort((a, b) => issueSortTime(b).localeCompare(issueSortTime(a)) || b.item.count - a.item.count).slice(0, HOME_ISSUE_LIMIT),
    [issues],
  );

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

  const load = useCallback(async () => {
    if (!hasSignalApi()) {
      setIssues([]);
      setQuotes([]);
      setBriefings([]);
      setTodayBriefing(null);
      setDisclosures([]);
      setCalendarEvents([]);
      setError(t('errorSignalApiShort'));
      return;
    }
    setError(null);
    try {
      const watchlist = await loadWatchlistSymbols();
      const symbols = selectedYmd === todayYmd ? watchlist.slice(0, watchlistDisplayCount) : [];
      const [todayBriefing, nextIssues, quoteRows, briefings, disclosurePage, calendarRows] = await Promise.all([
        fetchTodayBriefingWithFallback(selectedYmd, locale),
        fetchTopIssues(selectedYmd),
        symbols.length > 0
          ? fetchSignalMarketQuotes({ symbols, limit: symbols.length }).catch(() => [] as SignalApiMarketQuote[])
          : Promise.resolve([] as SignalApiMarketQuote[]),
        fetchSignalMarketBriefings({ ...utcRangeForLocalYmd(selectedYmd), limit: BRIEFING_LIMIT }).catch(() => []),
        fetchSignalDisclosureDigests({ ...utcRangeForLocalYmd(selectedYmd), limit: DISCLOSURE_LIMIT, batches: 1 }).catch(
          () => ({ items: [] }),
        ),
        fetchSignalCalendar({
          from: shiftYmd(selectedYmd, -1),
          to: shiftYmd(selectedYmd, HOME_CALENDAR_LOOKAHEAD_DAYS),
          limit: 120,
        }).catch(() => []),
      ]);

      const quoteBySymbol = new Map<string, QuoteRow>();
      for (const item of quoteRows) {
        const row = mapSignalQuoteToRow(item);
        for (const key of quoteLookupKeys(item, row)) quoteBySymbol.set(key, row);
      }
      setTodayBriefing(todayBriefing);
      setIssues(nextIssues);
      setQuotes(
        symbols.map((symbol) => {
          const key = symbol.trim().toUpperCase();
          return quoteBySymbol.get(key) ?? { symbol, quote: null, error: 'NO_SERVER_QUOTE' };
        }),
      );
      setBriefings(
        uniqueVisibleBriefings([...briefings].sort((a, b) => sortBriefingTime(b).localeCompare(sortBriefingTime(a)))).slice(0, HOME_SIGNAL_LIMIT),
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
    } catch (e) {
      setError(formatSignalApiError(e, t, 'ipadHomeLoadError'));
    }
  }, [locale, selectedYmd, t, todayYmd, watchlistDisplayCount]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
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
  }, [load, selectedYmd]);

  useEffect(() => {
    if (selectedYmd > todayYmd) changeSelectedYmd(todayYmd);
  }, [changeSelectedYmd, selectedYmd, todayYmd]);

  useEffect(() => {
    let cancelled = false;
    const refreshCount = async () => {
      const next = await loadHomeWatchlistDisplayCount();
      if (!cancelled) setWatchlistDisplayCount(next);
    };
    void refreshCount();
    const unsubscribe = subscribeHomeWatchlistDisplayCountChanged(() => {
      void refreshCount();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const openIssue = useCallback(
    (row?: IssueRow) => {
      const params: Record<string, string> = {
        date: selectedYmd,
        category: row?.category ?? 'all',
      };
      if (row?.item.id) params.digestId = row.item.id;
      if (ipadNav.isAvailable) {
        ipadNav.showNewsIssues({
          category: params.category as NewsIssuesCategory,
          date: params.date,
          digestId: params.digestId ?? null,
        });
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
        ipadNav.showSignalTab(session, selectedYmd);
        router.navigate({
          pathname: '/(tabs)/signal',
          params,
        } as never);
        return;
      }
      router.navigate({
        pathname: '/(tabs)/signal',
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

  const openSymbolDetail = useCallback(
    (symbol: string) => {
      const trimmed = symbol.trim().toUpperCase();
      if (!trimmed || trimmed === '—') return;
      router.push(`/symbol/${encodeURIComponent(trimmed)}` as never);
    },
    [router],
  );

  const openDisclosureFlow = useCallback(
    (row?: SignalApiDisclosureDigestItem) => {
      const params: Record<string, string> = { date: selectedYmd };
      if (row?.id) params.digestId = row.id;
      if (ipadNav.isAvailable) {
        ipadNav.showDisclosureFlow(params);
        return;
      }
      router.push({
        pathname: '/disclosure-flow',
        params,
      } as Href);
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
    router.navigate('/calendar' as never);
  }, [router]);

  const openTodayBriefing = useCallback(() => {
    router.navigate({
      pathname: '/today-briefing',
      params: { date: selectedYmd },
    } as never);
  }, [router, selectedYmd]);

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
          <HomeSectionAccentLine section="todayBriefing" />
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
      <View style={[styles.heroCard, showIssueSummary && styles.heroCardSummary]}>
        <HomeSectionAccentLine section="issues" opacity={0.55} />
        <View style={styles.issueGroupList}>
          {rows.map((row, index) => (
            <Pressable
              key={row.item.id}
              onPress={() => openIssue(row)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.issueGroupItem,
                index < rows.length - 1 && styles.issueGroupItemBorder,
                pressed && styles.pressed,
              ]}>
              <View style={styles.issueRowTop}>
                <View style={styles.issueMetaInline}>
                  <View style={styles.issueCategoryMark}>
                    <FontAwesome name={homeDigestCategoryIcon(row.category)} size={11} color={theme.textMuted} />
                    <Text style={styles.issueCategoryText}>{t(NEWS_SEGMENT_LABEL[row.category])}</Text>
                  </View>
                  {[row.item.topics[0], row.item.symbols[0]].filter(Boolean).length > 0 ? (
                    <Text style={styles.issueInlineMetaText} numberOfLines={1}>
                      {[row.item.topics[0], row.item.symbols[0]].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.issueGroupMetaText} numberOfLines={1}>
                  {t('homeFocusSourceCount', { count: String(row.item.sources.length) })}
                </Text>
              </View>
              <Text style={styles.issueGroupTitle} numberOfLines={2}>
                {row.item.title}
              </Text>
              {showIssueSummary && row.item.summary ? (
                <Text style={styles.issueGroupSummary} numberOfLines={1}>
                  {row.item.summary}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>
    ),
    [openIssue, showIssueSummary, styles, t, theme.textMuted],
  );

  const renderSignalCard = useCallback(
    (rows: SignalApiMarketBriefing[]) => (
      <View style={[styles.heroCard, showIssueSummary && styles.heroCardSummary]}>
        <HomeSectionAccentLine section="signal" />
        <View style={styles.issueGroupList}>
          {rows.map((row, index) => {
            const session = HOME_SIGNAL_SESSIONS.find(
              (candidate) => candidate.market === row.market && candidate.session === row.session,
            );
            return (
              <Pressable
                key={row.id}
                onPress={() => openSignal(row)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.issueGroupItem,
                  index < rows.length - 1 && styles.issueGroupItemBorder,
                  pressed && styles.pressed,
                ]}>
                <View style={styles.issueRowTop}>
                  <View style={styles.signalPillRow}>
                    <Text style={styles.marketPill}>{marketLabel(row.market)}</Text>
                    <Text style={styles.sessionBadge}>
                      {session ? t(session.labelId as MessageId) : t('briefingSessionEmptyTitle')}
                    </Text>
                  </View>
                  {row.sourceRefs.length > 0 ? (
                    <Text style={styles.issueGroupMetaText} numberOfLines={1}>
                      {t('homeFocusSourceCount', { count: String(row.sourceRefs.length) })}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.signalText} numberOfLines={showIssueSummary ? 4 : 3}>
                  {briefingLeadText(row)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    ),
    [openSignal, showIssueSummary, styles, t],
  );

  const renderDisclosureCard = useCallback(
    (rows: SignalApiDisclosureDigestItem[]) => (
      <View style={[styles.heroCard, showIssueSummary && styles.heroCardSummary]}>
        <HomeSectionAccentLine section="disclosure" />
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
                  {t('homeFocusSourceCount', { count: String(row.sourceRefs.length || row.count) })}
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
          {rows.map((event, index) => (
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
            </Pressable>
          ))}
        </View>
      </View>
    ),
    [formatCalendarDateLabel, openCalendar, showIssueSummary, styles, t],
  );

  return (
    <WebWheelScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' } : null,
        { paddingBottom: scrollContentPaddingBottom },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
      {headerAccessory}
      <SignalDateNavigator
        label={selectedDateLabel}
        previousA11y={t('insightDatePrevious')}
        nextA11y={t('insightDateNext')}
        labelA11y={t('insightOpenCalendar')}
        todayLabel={t('insightCalendarToday')}
        onPrevious={() => changeSelectedYmd(shiftYmd(selectedYmd, -1))}
        onNext={() => changeSelectedYmd(shiftYmd(selectedYmd, 1))}
        onPressLabel={() => router.navigate('/calendar' as never)}
        onToday={() => changeSelectedYmd(todayYmd)}
        showToday={!selectedIsToday}
        nextDisabled={selectedIsToday}
      />

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
                  badge={<HomeAiBadge />}
                  onPress={openTodayBriefing}
                  accessibilityLabel={t('commonViewAll')}
                />
                {renderTodayBriefingCard(todayBriefing)}
              </View>
            ) : null}

            <View style={styles.heroBlock}>
              <HomeSectionHeader
                title={t('newsIssuesTitle')}
                onPress={() => openIssue()}
                accessibilityLabel={t('commonViewAll')}
              />
              {homeIssues.length > 0 ? (
                renderIssueCard(homeIssues)
              ) : (
                <View style={styles.emptyCard}>
                  <HomeSectionAccentLine section="issues" opacity={0.55} />
                  <Text style={styles.emptyText}>{t('ipadHomeIssuesEmpty')}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <HomeSectionHeader
              title={t('homeFocusSignalTitle')}
              badge={<HomeAiBadge />}
              onPress={briefings.length > 0 ? openSignal : undefined}
              accessibilityLabel={briefings.length > 0 ? t('commonViewAll') : undefined}
            />
            {briefings.length > 0 ? (
              renderSignalCard(briefings)
            ) : (
              <View style={styles.emptyCard}>
                <HomeSectionAccentLine section="signal" />
                <Text style={styles.emptyText}>
                  {t('homeFocusSignalEmpty')}
                </Text>
              </View>
            )}
          </View>

          {selectedIsExactToday ? (
            <View style={styles.section}>
                <HomeSectionHeader title={t('homeFocusWatchTitle')} onPress={openQuotes} accessibilityLabel={t('commonViewAll')} />
                <View style={styles.quoteGrid}>
                  {quotes.length === 0 ? (
                    <Text style={styles.emptyText}>{t('quotesEmptyWatch')}</Text>
                  ) : (
                    quotes.map((row, index) => {
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
                            <View style={styles.quoteNameCol}>
                              <Text style={styles.quoteSymbol} numberOfLines={1}>
                                {row.symbol}
                              </Text>
                              <Text style={styles.quoteName} numberOfLines={1}>
                                {row.name || row.quote?.name || '—'}
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
              title={t('disclosureFlowTitle')}
              onPress={() => openDisclosureFlow()}
              accessibilityLabel={t('commonViewAll')}
            />
            {disclosures.length > 0 ? (
              renderDisclosureCard(disclosures)
            ) : (
              <View style={styles.emptyCard}>
                <HomeSectionAccentLine section="disclosure" />
                <Text style={styles.emptyText}>{t('disclosureFlowEmpty')}</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <HomeSectionHeader
              title={t('ipadHomeCalendarTitle')}
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
  );
}

function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
) {
  return StyleSheet.create({
    scroll: {
      ...webScrollViewportStyle,
      backgroundColor: webShellBackground(theme.bg),
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 14,
      gap: 24,
    },
    errorBox: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.danger,
      backgroundColor: theme.dangerDim,
      padding: 12,
    },
    errorText: {
      fontSize: sf(13),
      lineHeight: sf(18),
      fontWeight: '800',
      color: theme.danger,
    },
    loadingBox: {
      minHeight: 260,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroStack: {
      gap: 16,
    },
    heroBlock: {
      gap: 8,
    },
    heroHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: 8,
    },
    heroKicker: {
      fontSize: sf(18),
      lineHeight: sf(24),
      fontWeight: '900',
      color: theme.text,
    },
    heroCard: {
      position: 'relative',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingLeft: 16,
      paddingRight: 12,
      paddingVertical: 10,
      gap: 6,
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
    issueRowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    issueMetaInline: {
      minWidth: 0,
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    issueCategoryMark: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      minWidth: 0,
      flexShrink: 1,
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 2,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
    },
    issueCategoryText: {
      color: theme.textMuted,
      fontSize: ft.ff(10),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
    },
    issueGroupList: {
      gap: 0,
    },
    issueGroupItem: {
      gap: 4,
      paddingVertical: ft.row(6),
      borderRadius: 10,
    },
    issueGroupItemBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    issueGroupTitle: {
      fontSize: ft.ff(14),
      lineHeight: sf(19),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    issueGroupSummary: {
      fontSize: ft.ff(12),
      lineHeight: sf(17),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
    },
    overviewMiniList: {
      gap: 2,
      marginTop: 2,
    },
    issueGroupMetaText: {
      fontSize: ft.ff(10),
      lineHeight: sf(14),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
    },
    issueInlineMetaText: {
      minWidth: 0,
      flexShrink: 1,
      fontSize: ft.ff(10),
      lineHeight: sf(14),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
    },
    section: {
      gap: 12,
    },
    quoteGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    quoteTile: {
      width: '48.5%',
      minHeight: 72,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.colorScheme === 'dark' ? theme.bgElevated : theme.card,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOpacity: 0.03,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },
    quoteTileContent: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 10,
      paddingVertical: 10,
      gap: 8,
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
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
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
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
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
    signalPillRow: {
      minWidth: 0,
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    marketPill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: theme.bgElevated,
      color: theme.textMuted,
      fontSize: ft.ff(11),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
    },
    sessionBadge: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: theme.greenDim,
      color: theme.green,
      fontSize: ft.ff(11),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
    },
    disclosurePillRow: {
      minWidth: 0,
      flexShrink: 1,
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    disclosureMarketPill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: theme.warningDim,
      color: theme.warning,
      fontSize: ft.ff(11),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
    },
    disclosureFormPill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: theme.bgElevated,
      color: theme.textMuted,
      fontSize: ft.ff(11),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
      maxWidth: 120,
    },
    calendarPillRow: {
      minWidth: 0,
      flexShrink: 1,
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    calendarDatePill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: theme.greenDim,
      color: theme.green,
      fontSize: ft.ff(11),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
    },
    calendarTypePill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: theme.bgElevated,
      color: theme.textMuted,
      fontSize: ft.ff(11),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
    },
    calendarMoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 4,
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
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 16,
      paddingLeft: 18,
    },
    emptyText: {
      fontSize: ft.ff(13),
      lineHeight: sf(19),
      fontWeight: ft.bodyWeight,
      color: theme.textDim,
    },
    dimmedText: {
      color: theme.textMuted,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
