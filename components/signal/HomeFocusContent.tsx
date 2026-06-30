import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { DisclosureDigestSection } from '@/components/disclosures/DisclosureDigestSection';
import { HorizontalCarouselShell } from '@/components/layout/HorizontalCarouselShell';
import { HomeAiBadge } from '@/components/signal/HomeAiBadge';
import { HomeSectionHeader } from '@/components/signal/HomeSectionHeader';
import { SignalDateNavigator } from '@/components/signal/SignalDateNavigator';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import {
  HOME_DIGEST_CATEGORIES,
  HOME_SIGNAL_SESSIONS,
  type HomeDigestCategory,
  type SignalSessionKey,
} from '@/constants/ipadHomeNav';
import type { AppTheme } from '@/constants/theme';
import { webScrollViewportStyle } from '@/constants/webLayout';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { NEWS_SEGMENT_LABEL } from '@/domain/news/feedFilters';
import { formatQuoteDpPct, formatUsd, formatKrw, isKoreaStockQuote, mapSignalQuoteToRow, quoteLookupKeys, type QuoteRow } from '@/domain/quotes/rows';
import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useQuoteChangeColors } from '@/hooks';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchSignalDisclosureDigests } from '@/integrations/signal-api/disclosureDigests';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { fetchSignalMarketBriefings } from '@/integrations/signal-api/marketBriefings';
import { fetchSignalMarketQuotes } from '@/integrations/signal-api/market';
import { fetchSignalNewsDigests } from '@/integrations/signal-api/newsDigests';
import type {
  SignalApiDisclosureDigestItem,
  SignalApiMarketBriefing,
  SignalApiMarketQuote,
  SignalApiNewsDigestItem,
} from '@/integrations/signal-api/types';
import type { MessageId } from '@/locales/messages';
import { hasSignalApi } from '@/services/env';
import {
  HOME_WATCHLIST_DISPLAY_DEFAULT,
  loadHomeWatchlistDisplayCount,
  subscribeHomeWatchlistDisplayCountChanged,
} from '@/services/homeWatchlistDisplayPreference';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import { addDays, formatLocalYmdLabel, parseLocalYmd, toYmd, utcRangeForLocalYmd } from '@/utils/date';

const ISSUE_FETCH_LIMIT = 80;
const ISSUE_PER_CATEGORY_LIMIT = 2;
const BRIEFING_LIMIT = 30;
const DISCLOSURE_LIMIT = 3;

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

type IssueGroup = {
  category: HomeDigestCategory;
  rows: IssueRow[];
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
        .slice(0, ISSUE_PER_CATEGORY_LIMIT)
        .map((item) => ({ category, item }));
    }),
  );
  return results.flat();
}

function formatPrice(row: QuoteRow): string {
  const value = row.quote?.currentPrice;
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return isKoreaStockQuote(row) ? formatKrw(value) : formatUsd(value);
}

function issueIconName(category: HomeDigestCategory): ComponentProps<typeof FontAwesome>['name'] {
  if (category === 'crypto') return 'bitcoin';
  if (category === 'korea') return 'flag';
  return 'globe';
}

function marketLabel(market: string): string {
  const key = String(market || '').trim().toLowerCase();
  if (key === 'us') return 'US';
  if (key === 'kr') return 'KR';
  return key ? key.toUpperCase() : 'SIGNAL';
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
  contentMaxWidth,
  showIssueSummary = false,
}: HomeFocusContentProps) {
  const router = useRouter();
  const { theme, scaleFont } = useSignalTheme();
  const quoteChange = useQuoteChangeColors();
  const { t, locale } = useLocale();
  const ipadNav = useIpadSidebarNav();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const selectedIsToday = selectedYmd >= todayYmd;
  const loadedYmdRef = useRef<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchlistDisplayCount, setWatchlistDisplayCount] = useState(HOME_WATCHLIST_DISPLAY_DEFAULT);
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [briefings, setBriefings] = useState<SignalApiMarketBriefing[]>([]);
  const [disclosures, setDisclosures] = useState<SignalApiDisclosureDigestItem[]>([]);
  const [activeIssueIndex, setActiveIssueIndex] = useState(0);
  const [activeBriefingIndex, setActiveBriefingIndex] = useState(0);
  const [issueCarouselWidth, setIssueCarouselWidth] = useState(0);
  const [briefingCarouselWidth, setBriefingCarouselWidth] = useState(0);
  const issueScrollRef = useRef<ScrollView | null>(null);
  const briefingScrollRef = useRef<ScrollView | null>(null);
  const issueGroups = useMemo<IssueGroup[]>(
    () =>
      HOME_DIGEST_CATEGORIES.map((category) => ({
        category,
        rows: issues.filter((row) => row.category === category).slice(0, ISSUE_PER_CATEGORY_LIMIT),
      })).filter((group) => group.rows.length > 0),
    [issues],
  );
  const loopIssueGroups = useMemo(
    () => (issueGroups.length > 1 ? [...issueGroups, issueGroups[0]] : issueGroups),
    [issueGroups],
  );
  const loopBriefings = useMemo(
    () => (briefings.length > 1 ? [...briefings, briefings[0]] : briefings),
    [briefings],
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
      setDisclosures([]);
      setError(t('errorSignalApiShort'));
      return;
    }
    setError(null);
    try {
      const watchlist = await loadWatchlistSymbols();
      const symbols = watchlist.slice(0, watchlistDisplayCount);
      const [nextIssues, quoteRows, briefings, disclosurePage] = await Promise.all([
        fetchTopIssues(selectedYmd),
        symbols.length > 0
          ? fetchSignalMarketQuotes({ symbols, limit: symbols.length }).catch(() => [] as SignalApiMarketQuote[])
          : Promise.resolve([] as SignalApiMarketQuote[]),
        fetchSignalMarketBriefings({ ...utcRangeForLocalYmd(selectedYmd), limit: BRIEFING_LIMIT }).catch(() => []),
        fetchSignalDisclosureDigests({ ...utcRangeForLocalYmd(selectedYmd), limit: DISCLOSURE_LIMIT, batches: 1 }).catch(
          () => ({ items: [] }),
        ),
      ]);

      const quoteBySymbol = new Map<string, QuoteRow>();
      for (const item of quoteRows) {
        const row = mapSignalQuoteToRow(item);
        for (const key of quoteLookupKeys(item, row)) quoteBySymbol.set(key, row);
      }
      setIssues(nextIssues);
      setQuotes(
        symbols.map((symbol) => {
          const key = symbol.trim().toUpperCase();
          return quoteBySymbol.get(key) ?? { symbol, quote: null, error: 'NO_SERVER_QUOTE' };
        }),
      );
      setBriefings(
        uniqueVisibleBriefings([...briefings].sort((a, b) => sortBriefingTime(b).localeCompare(sortBriefingTime(a)))).slice(0, 6),
      );
      setDisclosures(disclosurePage.items.slice(0, DISCLOSURE_LIMIT));
    } catch (e) {
      setError(formatSignalApiError(e, t, 'ipadHomeLoadError'));
    }
  }, [selectedYmd, t, watchlistDisplayCount]);

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

  useEffect(() => {
    if (activeIssueIndex > Math.max(0, issues.length - 1)) {
      setActiveIssueIndex(0);
    }
  }, [activeIssueIndex, issues.length]);

  useEffect(() => {
    if (activeBriefingIndex > Math.max(0, briefings.length - 1)) {
      setActiveBriefingIndex(0);
    }
  }, [activeBriefingIndex, briefings.length]);

  const openIssue = useCallback(
    (row?: IssueRow) => {
      const params = {
        category: row?.category ?? 'global',
        date: selectedYmd,
        digestId: row?.item.id,
      };
      if (ipadNav.isAvailable) {
        ipadNav.showNewsIssues(params);
        return;
      }
      router.navigate({
        pathname: '/news-issues',
        params,
      } as never);
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
    router.navigate('/(tabs)/quotes' as never);
  }, [router]);

  const openSymbolDetail = useCallback(
    (symbol: string) => {
      const trimmed = symbol.trim().toUpperCase();
      if (!trimmed || trimmed === '—') return;
      router.push(`/symbol/${encodeURIComponent(trimmed)}` as never);
    },
    [router],
  );

  const openDisclosures = useCallback(() => {
    router.navigate('/(tabs)/disclosures' as never);
  }, [router]);

  const resetIssueLoopToStart = useCallback(() => {
    const reset = () => issueScrollRef.current?.scrollTo({ x: 0, animated: false });
    reset();
    requestAnimationFrame(reset);
    setTimeout(reset, 50);
    setTimeout(reset, 150);
  }, []);

  const resetBriefingLoopToStart = useCallback(() => {
    const reset = () => briefingScrollRef.current?.scrollTo({ x: 0, animated: false });
    reset();
    requestAnimationFrame(reset);
    setTimeout(reset, 50);
    setTimeout(reset, 150);
  }, []);

  const onIssueScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const width = event.nativeEvent.layoutMeasurement.width;
    if (width <= 0) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    const rawIndex = Math.round(offsetX / width);
    if (issueGroups.length > 1 && rawIndex >= issueGroups.length) {
      resetIssueLoopToStart();
      setActiveIssueIndex(0);
      return;
    }
    setActiveIssueIndex(Math.max(0, Math.min(rawIndex, issueGroups.length - 1)));
  }, [issueGroups.length, resetIssueLoopToStart]);

  const onIssueScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const width = event.nativeEvent.layoutMeasurement.width;
    if (width <= 0 || issueGroups.length <= 1) return;
    const rawIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    const next =
      rawIndex >= issueGroups.length ? 0 : Math.max(0, Math.min(rawIndex, issueGroups.length - 1));
    setActiveIssueIndex((prev) => (prev === next ? prev : next));
  }, [issueGroups.length]);

  const onBriefingScrollEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const width = event.nativeEvent.layoutMeasurement.width;
    if (width <= 0) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    const rawIndex = Math.round(offsetX / width);
    if (briefings.length > 1 && rawIndex >= briefings.length) {
      resetBriefingLoopToStart();
      setActiveBriefingIndex(0);
      return;
    }
    setActiveBriefingIndex(Math.max(0, Math.min(rawIndex, briefings.length - 1)));
  }, [briefings.length, resetBriefingLoopToStart]);

  const onBriefingScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const width = event.nativeEvent.layoutMeasurement.width;
    if (width <= 0 || briefings.length <= 1) return;
    const rawIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    const next = rawIndex >= briefings.length ? 0 : Math.max(0, Math.min(rawIndex, briefings.length - 1));
    setActiveBriefingIndex((prev) => (prev === next ? prev : next));
  }, [briefings.length]);

  const renderIssueGroup = useCallback(
    (group: IssueGroup) => (
      <View style={[styles.heroCard, styles.heroCardGrouped, showIssueSummary && styles.heroCardSummary]}>
        <View style={styles.heroNoteLine} />
        <View style={styles.heroMetaRow}>
          <View style={styles.heroMetaLeft}>
            <Text style={styles.categoryPill}>{t(NEWS_SEGMENT_LABEL[group.category])}</Text>
          </View>
          <FontAwesome name={issueIconName(group.category)} size={13} color={theme.textDim} />
        </View>
        <View style={styles.issueGroupList}>
          {group.rows.map((row, index) => (
            <Pressable
              key={row.item.id}
              onPress={() => openIssue(row)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.issueGroupItem,
                index < group.rows.length - 1 && styles.issueGroupItemBorder,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.issueGroupTitle} numberOfLines={2}>
                {row.item.title}
              </Text>
              {showIssueSummary && row.item.summary ? (
                <Text style={styles.issueGroupSummary} numberOfLines={1}>
                  {row.item.summary}
                </Text>
              ) : null}
              <Text style={styles.issueGroupMetaText} numberOfLines={1}>
                {[
                  row.item.topics[0],
                  row.item.symbols[0],
                  t('homeFocusSourceCount', { count: String(row.item.sources.length) }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    ),
    [openIssue, showIssueSummary, styles, t, theme.textDim],
  );

  const renderBriefingCard = useCallback(
    (row: SignalApiMarketBriefing) => {
      const session = HOME_SIGNAL_SESSIONS.find(
        (candidate) => candidate.market === row.market && candidate.session === row.session,
      );
      return (
        <Pressable
          onPress={() => openSignal(row)}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.signalCard,
            styles.briefingCard,
            showIssueSummary && styles.briefingCardSummary,
            pressed && styles.pressed,
          ]}>
          <View style={styles.signalNoteLine} />
          <View style={styles.signalHead}>
            <View style={styles.signalPillRow}>
              <Text style={styles.marketPill}>{marketLabel(row.market)}</Text>
              <Text style={styles.sessionBadge}>
                {session ? t(session.labelId as MessageId) : t('briefingSessionEmptyTitle')}
              </Text>
            </View>
            {row.sourceRefs.length > 0 ? (
              <Text style={styles.signalMetaText}>
                {t('homeFocusSourceCount', { count: String(row.sourceRefs.length) })}
              </Text>
            ) : null}
          </View>
          <View style={styles.signalBody}>
            <Text style={styles.signalText} numberOfLines={showIssueSummary ? 4 : 3}>
              {briefingLeadText(row)}
            </Text>
          </View>
        </Pressable>
      );
    },
    [openSignal, showIssueSummary, styles, t],
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
      refreshControl={
        Platform.OS === 'web' ? undefined : <ThemedRefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />
      }>
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
          <View style={styles.heroBlock}>
            <View style={styles.heroHead}>
              <Text style={styles.heroKicker}>{t('homeFocusHeroKicker')}</Text>
              <HomeAiBadge />
            </View>
            {issueGroups.length > 0 ? (
              <View
                style={styles.issueCarouselWrap}
                onLayout={(event) => setIssueCarouselWidth(Math.round(event.nativeEvent.layout.width))}>
                <HorizontalCarouselShell
                  pageIndex={activeIssueIndex}
                  pageCount={issueGroups.length}
                  loop
                  footer={
                    issueGroups.length > 1 ? (
                      <View style={styles.issueDots}>
                        {issueGroups.map((group, index) => (
                          <View
                            key={`${group.category}-dot`}
                            style={[styles.issueDot, activeIssueIndex === index && styles.issueDotActive]}
                          />
                        ))}
                      </View>
                    ) : null
                  }>
                  {issueGroups.length === 1 ? (
                    renderIssueGroup(issueGroups[0])
                  ) : (
                    <ScrollView
                      ref={issueScrollRef}
                      horizontal
                      nestedScrollEnabled
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      decelerationRate="fast"
                      directionalLockEnabled
                      keyboardShouldPersistTaps="handled"
                      snapToInterval={issueCarouselWidth > 0 ? issueCarouselWidth : undefined}
                      onScroll={onIssueScroll}
                      scrollEventThrottle={16}
                      onMomentumScrollEnd={onIssueScrollEnd}
                      style={styles.issueCarousel}>
                      {loopIssueGroups.map((group, index) => (
                        <View
                          key={`${group.category}-${index}`}
                          style={[styles.heroSlide, issueCarouselWidth > 0 && { width: issueCarouselWidth }]}>
                          {renderIssueGroup(group)}
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </HorizontalCarouselShell>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t('ipadHomeIssuesEmpty')}</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <HomeSectionHeader
              title={t('homeFocusSignalTitle')}
              badge={<HomeAiBadge />}
              onPress={briefings.length > 0 ? openSignal : undefined}
              accessibilityLabel={briefings.length > 0 ? t('commonViewAll') : undefined}
            />
            {briefings.length > 0 ? (
              <View
                style={styles.briefingCarouselWrap}
                onLayout={(event) => setBriefingCarouselWidth(Math.round(event.nativeEvent.layout.width))}>
                <HorizontalCarouselShell
                  pageIndex={activeBriefingIndex}
                  pageCount={briefings.length}
                  loop
                  footer={
                    briefings.length > 1 ? (
                      <View style={styles.issueDots}>
                        {briefings.map((row, index) => (
                          <View
                            key={`${row.id}-dot`}
                            style={[styles.issueDot, activeBriefingIndex === index && styles.issueDotActive]}
                          />
                        ))}
                      </View>
                    ) : null
                  }>
                  {briefings.length === 1 ? (
                    renderBriefingCard(briefings[0])
                  ) : (
                    <ScrollView
                      ref={briefingScrollRef}
                      horizontal
                      nestedScrollEnabled
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      decelerationRate="fast"
                      directionalLockEnabled
                      keyboardShouldPersistTaps="handled"
                      snapToInterval={briefingCarouselWidth > 0 ? briefingCarouselWidth : undefined}
                      onScroll={onBriefingScroll}
                      scrollEventThrottle={16}
                      onMomentumScrollEnd={onBriefingScrollEnd}
                      style={styles.issueCarousel}>
                      {loopBriefings.map((row, index) => (
                        <View
                          key={`${row.id}-${index}`}
                          style={[styles.heroSlide, briefingCarouselWidth > 0 && { width: briefingCarouselWidth }]}>
                          {renderBriefingCard(row)}
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </HorizontalCarouselShell>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  {t('homeFocusSignalEmpty')}
                </Text>
              </View>
            )}
          </View>

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

          <View style={styles.section}>
            <HomeSectionHeader
              title={t('todayBriefingDisclosureDigestTitle')}
              onPress={openDisclosures}
              accessibilityLabel={t('commonViewAll')}
            />
            {disclosures.length > 0 ? (
              <DisclosureDigestSection items={disclosures} accentColor={theme.warning} />
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t('todayBriefingDisclosureDigestEmpty')}</Text>
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
) {
  return StyleSheet.create({
    scroll: {
      ...webScrollViewportStyle,
      backgroundColor: theme.bg,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 14,
      gap: 18,
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
    issueCarouselWrap: {
      gap: 8,
    },
    briefingCarouselWrap: {
      gap: 10,
    },
    issueCarousel: {
      width: '100%',
      overflow: 'hidden',
    },
    heroSlide: {
      paddingRight: 0,
    },
    heroCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.colorScheme === 'dark' ? '#111927' : '#FFFFFF',
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
    heroCardGrouped: {
      minHeight: 0,
    },
    heroNoteLine: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: theme.green,
    },
    heroMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    heroMetaLeft: {
      minWidth: 0,
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
    },
    categoryPill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 7,
      paddingVertical: 2,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      color: theme.green,
      fontSize: sf(10),
      lineHeight: sf(15),
      fontWeight: '800',
    },
    issueGroupList: {
      gap: 0,
    },
    issueGroupItem: {
      gap: 4,
      paddingVertical: 6,
      borderRadius: 10,
    },
    issueGroupItemBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    issueGroupTitle: {
      fontSize: sf(14),
      lineHeight: sf(19),
      fontWeight: '900',
      color: theme.text,
    },
    issueGroupSummary: {
      fontSize: sf(12),
      lineHeight: sf(17),
      fontWeight: '700',
      color: theme.textMuted,
    },
    issueGroupMetaText: {
      fontSize: sf(10),
      lineHeight: sf(14),
      fontWeight: '800',
      color: theme.textDim,
    },
    issueDots: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 5,
    },
    issueDot: {
      width: 5,
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.border,
    },
    issueDotActive: {
      width: 16,
      backgroundColor: theme.green,
    },
    section: {
      gap: 12,
    },
    quoteCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      overflow: 'hidden',
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
      backgroundColor: theme.colorScheme === 'dark' ? '#111722' : '#FBFCFE',
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
      fontSize: sf(14),
      lineHeight: sf(18),
      fontWeight: '900',
      color: theme.text,
    },
    quoteName: {
      marginTop: 2,
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: '700',
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
      fontSize: sf(13),
      lineHeight: sf(17),
      fontWeight: '900',
      color: theme.text,
    },
    changeText: {
      marginTop: 2,
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: '900',
    },
    signalCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.colorScheme === 'dark' ? '#111927' : '#FFFFFF',
      paddingLeft: 18,
      paddingRight: 13,
      paddingVertical: 11,
      gap: 6,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    },
    briefingCard: {
      height: 136,
    },
    briefingCardSummary: {
      height: 158,
    },
    signalNoteLine: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: theme.green,
    },
    signalHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '900',
    },
    sessionBadge: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 9,
      paddingVertical: 4,
      backgroundColor: theme.greenDim,
      color: theme.green,
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '900',
    },
    signalBody: {
      flex: 1,
      justifyContent: 'center',
    },
    signalText: {
      fontSize: sf(15),
      lineHeight: sf(21),
      fontWeight: '900',
      color: theme.text,
    },
    signalMetaText: {
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: '700',
      color: theme.textDim,
    },
    emptyCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 16,
    },
    emptyText: {
      fontSize: sf(13),
      lineHeight: sf(19),
      fontWeight: '700',
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
