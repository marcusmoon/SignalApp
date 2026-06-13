import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  InteractionManager,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { makeHomeStyles } from '@/components/home/homeStyles';
import {
  EvidenceCard,
  SectionHeader,
  SectionPlaceholder,
} from '@/components/home/HomeSectionPrimitives';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { tabBarBottomInset } from '@/constants/tabBar';
import { useQuoteChangeColors } from '@/hooks/useQuoteChangeColors';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { buildQuotesCacheKey, peekQuotes, storeQuotes } from '@/services/cache/quotesCache';
import { hasSignalApi } from '@/services/env';
import { loadMainEntry, mainEntryHref } from '@/services/mainEntryPreference';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import { openYahooFinanceQuote } from '@/utils/yahooFinance';
import { formatRelativeFromIso, toYmd } from '@/utils/date';
import {
  fetchSignalInsights,
  fetchSignalMarketQuotes,
  fetchSignalNews,
  fetchSignalQuantSignals,
  fetchSignalWatchSignals,
  signalNewsToNewsItem,
} from '@/integrations/signal-api';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type {
  SignalApiInsight,
  SignalApiMarketQuote,
  SignalApiNewsItem,
  SignalApiQuantSignal,
  SignalApiWatchSignal,
} from '@/integrations/signal-api/types';
import type { NewsItem } from '@/types/signal';
import {
  addUniqueEvidence,
  driverText,
  formatPct,
  formatUsd,
  formatUsdChange,
  homeHeadline,
  homeRelatedNewsFromIso,
  HOME_RELATED_NEWS_LIMIT,
  HOME_RELATED_NEWS_MAX_AGE_MS,
  HOME_RELATED_VIDEO_MAX_AGE_MS,
  isRecentIso,
  marketMood,
  moodMessageId,
  normalizeSymbolSet,
  quoteReasonCode,
  symbolNewsCount,
  symbolSignalCount,
  watchReasonLabelId,
} from '@/domain/home';

let initialEntryApplied = false;

type HomeState = {
  insights: SignalApiInsight[];
  watchQuotes: SignalApiMarketQuote[];
  rawNews: SignalApiNewsItem[];
  news: NewsItem[];
  watchSymbols: string[];
  watchSignals: SignalApiWatchSignal[];
  quantSignals: SignalApiQuantSignal[];
};

const EMPTY_STATE: HomeState = {
  insights: [],
  watchQuotes: [],
  rawNews: [],
  news: [],
  watchSymbols: [],
  watchSignals: [],
  quantSignals: [],
};

type HomeEvidenceRow = {
  key: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  kind: string;
  title: string;
  source: string;
  timeLabel?: string;
  url?: string;
  fallbackRoute: '/news' | '/youtube';
};

type HomeQuotePulseRow = {
  quote: SignalApiMarketQuote;
  newsCount: number;
  signalCount: number;
  watchSignal?: SignalApiWatchSignal;
};

async function loadHomeWatchQuotes(
  symbols: string[],
  forceRefresh: boolean,
): Promise<SignalApiMarketQuote[]> {
  if (symbols.length === 0) return [];
  const cacheKey = buildQuotesCacheKey('watch', [...symbols].sort());
  if (!forceRefresh) {
    const hit = peekQuotes(cacheKey);
    if (hit) {
      return hit.rows.map((row) => row.quote).filter((row): row is SignalApiMarketQuote => Boolean(row));
    }
  }
  const rows = await fetchSignalMarketQuotes({ symbols, limit: Math.max(symbols.length, 1) });
  storeQuotes(
    cacheKey,
    rows.map((row) => ({ symbol: String(row.symbol || ''), quote: row })),
  );
  return rows;
}

export default function HomeScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const quoteChange = useQuoteChangeColors();
  const styles = useMemo(() => makeHomeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const [state, setState] = useState<HomeState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => {
    if (initialEntryApplied) return;
    initialEntryApplied = true;
    const deferred = InteractionManager.runAfterInteractions(() => {
      void loadMainEntry().then((entry) => {
        const href = mainEntryHref(entry);
        if (href) router.replace(href);
      });
    });
    return () => deferred.cancel();
  }, [router]);

  const mood = useMemo(
    () => marketMood(state.insights, state.watchQuotes),
    [state.insights, state.watchQuotes],
  );

  const headline = useMemo(
    () =>
      homeHeadline({
        insights: state.insights,
        quotes: state.watchQuotes,
        fallback: t(moodMessageId(mood)),
        pulseHeadline: t('homePulseHeadline', {
          count: String(state.watchQuotes.length),
          movers: String(
            state.watchQuotes.filter((row) => Math.abs(Number(row.changePercent)) >= 1).length,
          ),
        }),
        pulseQuiet: t('homePulseQuiet'),
      }),
    [mood, state.insights, state.watchQuotes, t],
  );

  const load = useCallback(async (forceRefresh = false) => {
    const seq = requestSeq.current + 1;
    requestSeq.current = seq;
    setError(null);
    if (!hasSignalApi()) {
      setState(EMPTY_STATE);
      setError(t('errorSignalApiShort'));
      return;
    }

    const cacheMode = forceRefresh ? 'bypass' : 'use';
    const watchSymbols = (await loadWatchlistSymbols()).slice(0, 6);
    const [insightPage, watchSignalRows, quantRows, newsPage] = await Promise.all([
      fetchSignalInsights({
        date: 'today',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        limit: 3,
        offset: 0,
      }),
      fetchSignalWatchSignals({
        symbols: watchSymbols,
        limit: Math.max(watchSymbols.length, 1),
        date: toYmd(new Date()),
        from: homeRelatedNewsFromIso(),
      }).catch(() => [] as SignalApiWatchSignal[]),
      fetchSignalQuantSignals({ limit: 3 }).catch(() => [] as SignalApiQuantSignal[]),
      fetchSignalNews(
        {
          locale,
          category: 'global',
          symbols: watchSymbols.length > 0 ? watchSymbols.join(',') : undefined,
          limit: 16,
          offset: 0,
          from: homeRelatedNewsFromIso(),
        },
        { cacheMode },
      ).catch(() => ({ items: [] as SignalApiNewsItem[] })),
    ]);

    const quoteRowsFromSignals = watchSignalRows
      .map((row) => row.quote)
      .filter((row): row is SignalApiMarketQuote => Boolean(row));
    const fallbackQuoteRows = quoteRowsFromSignals.length >= watchSymbols.length
      ? []
      : await loadHomeWatchQuotes(watchSymbols, forceRefresh);
    const bySymbol = new Map([...fallbackQuoteRows, ...quoteRowsFromSignals].map((row) => [String(row.symbol || '').toUpperCase(), row]));
    const orderedQuotes = watchSymbols
      .map((symbol) => bySymbol.get(symbol.toUpperCase()))
      .filter((row): row is SignalApiMarketQuote => Boolean(row));

    const newsItems = newsPage.items;

    if (requestSeq.current !== seq) return;
    setState({
      insights: insightPage.items,
      watchQuotes: orderedQuotes,
      watchSymbols,
      rawNews: newsItems,
      news: newsItems.map((item) => signalNewsToNewsItem(item, locale)),
      watchSignals: watchSignalRows,
      quantSignals: quantRows,
    });
  }, [locale, t]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        await load(false);
      } catch (e) {
        if (!cancelled) {
          setState(EMPTY_STATE);
          setError(formatSignalApiError(e, t, 'feedErrorLoad'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, t]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } catch (e) {
      setError(formatSignalApiError(e, t, 'feedErrorRefresh'));
    } finally {
      setRefreshing(false);
    }
  }, [load, t]);

  const topInsights = state.insights.slice(0, 3);
  const topQuantSignals = state.quantSignals.slice(0, 3);
  const primaryInsight = topInsights[0] ?? null;
  const secondaryInsights = topInsights.slice(1, 3);
  const topQuoteRows: HomeQuotePulseRow[] = [...state.watchQuotes]
    .map((quote) => {
      const quoteSymbol = String(quote.symbol || '').toUpperCase();
      const watchSignal = state.watchSignals.find((row) => String(row.symbol || '').toUpperCase() === quoteSymbol);
      return {
        quote,
        newsCount: watchSignal?.counts?.news ?? symbolNewsCount(state.rawNews, quote.symbol),
        signalCount: watchSignal?.counts?.insights ?? symbolSignalCount(state.insights, quote.symbol),
        watchSignal,
      };
    })
    .sort((a, b) => {
      const score = Number(b.watchSignal?.score || 0) - Number(a.watchSignal?.score || 0);
      if (score !== 0) return score;
      const move = Math.abs(Number(b.quote.changePercent) || 0) - Math.abs(Number(a.quote.changePercent) || 0);
      if (move !== 0) return move;
      const signal = b.signalCount - a.signalCount;
      if (signal !== 0) return signal;
      return b.newsCount - a.newsCount;
    })
    .slice(0, 3);
  const visibleWatchCount = topQuoteRows.length;
  const evidenceRows = useMemo(() => {
    const max = HOME_RELATED_NEWS_LIMIT;
    const rows: HomeEvidenceRow[] = [];
    const seen = new Set<string>();
    const newsById = new Map(state.news.map((item) => [item.id, item]));
    const rawNewsById = new Map(state.rawNews.map((item) => [item.id, item]));
    const rawNewsByUrl = new Map(
      state.rawNews
        .filter((item) => item.sourceUrl)
        .map((item) => [item.sourceUrl as string, item]),
    );

    topInsights.flatMap((insight) => insight.sourceRefs || []).forEach((ref) => {
      const type = String(ref.type || '').toLowerCase();
      if (type === 'youtube') {
        if (!isRecentIso(ref.publishedAt, HOME_RELATED_VIDEO_MAX_AGE_MS)) return;
        addUniqueEvidence(
          rows,
          seen,
          {
            key: `source-youtube-${ref.id}`,
            icon: 'youtube-play',
            kind: t('tabYoutube'),
            title: ref.title || t('tabYoutube'),
            source: ref.sourceName || t('tabYoutube'),
            timeLabel: ref.publishedAt ? formatRelativeFromIso(ref.publishedAt, locale) : undefined,
            url: ref.url,
            fallbackRoute: '/youtube',
          },
          max,
        );
        return;
      }
      const raw = rawNewsById.get(ref.id) || (ref.url ? rawNewsByUrl.get(ref.url) : undefined);
      const news = newsById.get(ref.id) || (raw ? signalNewsToNewsItem(raw, locale) : undefined);
      const publishedAt = ref.publishedAt || raw?.publishedAt;
      if (!isRecentIso(publishedAt, HOME_RELATED_NEWS_MAX_AGE_MS)) return;
      addUniqueEvidence(
        rows,
        seen,
        {
          key: `source-news-${ref.id}`,
          icon: 'newspaper-o',
          kind: t('tabNews'),
          title: ref.title || news?.titleKo || t('tabNews'),
          source: ref.sourceName || news?.source || t('tabNews'),
          timeLabel: news?.timeLabel || (publishedAt ? formatRelativeFromIso(publishedAt, locale) : undefined),
          url: ref.url || news?.url,
          fallbackRoute: '/news',
        },
        max,
      );
    });

    const watchSet = normalizeSymbolSet(state.watchSymbols);
    state.rawNews.forEach((raw) => {
      if (rows.length >= max) return;
      if (!isRecentIso(raw.publishedAt, HOME_RELATED_NEWS_MAX_AGE_MS)) return;
      const symbols = Array.isArray(raw.symbols) ? raw.symbols : [];
      if (!symbols.some((symbol) => watchSet.has(symbol.trim().toUpperCase()))) return;
      const item = signalNewsToNewsItem(raw, locale);
      addUniqueEvidence(
        rows,
        seen,
        {
          key: `watch-news-${item.id}`,
          icon: 'newspaper-o',
          kind: t('tabNews'),
          title: item.titleKo,
          source: item.source || t('tabNews'),
          timeLabel: item.timeLabel,
          url: item.url,
          fallbackRoute: '/news',
        },
        max,
      );
    });

    state.news.forEach((item) => {
      addUniqueEvidence(
        rows,
        seen,
        {
          key: `fallback-news-${item.id}`,
          icon: 'newspaper-o',
          kind: t('tabNews'),
          title: item.titleKo,
          source: item.source || t('tabNews'),
          timeLabel: item.timeLabel,
          url: item.url,
          fallbackRoute: '/news',
        },
        max,
      );
    });

    return rows;
  }, [locale, state.news, state.rawNews, state.watchSymbols, t, topInsights]);
  const bottomPad = 28 + tabBarHeight + tabBarBottomInset(insets.bottom);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SignalHeader onBrandPress={() => void onRefresh()} />
      {isFocused ? <OtaUpdateBanner /> : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.focusCard}>
          <View style={styles.focusTopRow}>
            <View style={styles.focusKickerWrap}>
              <FontAwesome name="bolt" size={12} color={theme.green} />
              <Text style={styles.focusKicker}>{t('homeFocusKicker')}</Text>
            </View>
            {primaryInsight ? (
              <View style={styles.focusScoreBadge}>
                <Text style={styles.focusScoreText}>{Math.round(Number(primaryInsight.score) || 0)}</Text>
              </View>
            ) : null}
          </View>
          {primaryInsight?.symbols?.length ? (
            <Text style={styles.focusSymbols} numberOfLines={1}>
              {primaryInsight.symbols.slice(0, 3).join(' · ')}
            </Text>
          ) : null}
          <Text style={styles.focusTitle} numberOfLines={2}>
            {primaryInsight?.title || headline || t('homeFocusFallbackTitle')}
          </Text>
          {primaryInsight ? (
            <Text style={styles.focusBody} numberOfLines={3}>
              {driverText(primaryInsight)}
            </Text>
          ) : null}
          <View style={styles.focusActionRow}>
            <Pressable
              onPress={() => router.push('/briefing')}
              style={({ pressed }) => [styles.focusActionPrimary, pressed && styles.pressed]}
              accessibilityRole="button">
              <Text style={styles.focusActionPrimaryText}>{t('homeFocusOpenBriefing')}</Text>
              <FontAwesome name="chevron-right" size={12} color="#FFFFFF" />
            </Pressable>
            <Pressable
              onPress={() => router.push('/insights')}
              style={({ pressed }) => [styles.focusActionSecondary, pressed && styles.pressed]}
              accessibilityRole="button">
              <Text style={styles.focusActionSecondaryText}>{t('homeFocusOpenSignals')}</Text>
            </Pressable>
          </View>
          <View style={styles.overviewGrid}>
            <Pressable
              onPress={() => router.push('/insights')}
              style={({ pressed }) => [styles.overviewTile, pressed && styles.overviewTilePressed]}
              accessibilityRole="button">
              <View style={styles.overviewTileIcon}>
                <FontAwesome name="bolt" size={13} color={theme.green} />
              </View>
              <Text style={styles.overviewTileValue}>{topInsights.length}</Text>
              <Text style={styles.overviewTileLabel} numberOfLines={1}>{t('homeOverviewSignals')}</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/quotes')}
              style={({ pressed }) => [styles.overviewTile, pressed && styles.overviewTilePressed]}
              accessibilityRole="button">
              <View style={styles.overviewTileIcon}>
                <FontAwesome name="star" size={13} color={theme.green} />
              </View>
              <Text style={styles.overviewTileValue}>{visibleWatchCount}</Text>
              <Text style={styles.overviewTileLabel} numberOfLines={1}>{t('homeOverviewWatch')}</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/news')}
              style={({ pressed }) => [styles.overviewTile, pressed && styles.overviewTilePressed]}
              accessibilityRole="button">
              <View style={styles.overviewTileIcon}>
                <FontAwesome name="newspaper-o" size={13} color={theme.green} />
              </View>
              <Text style={styles.overviewTileValue}>{evidenceRows.length}</Text>
              <Text style={styles.overviewTileLabel} numberOfLines={1}>{t('homeOverviewRelated')}</Text>
            </Pressable>
          </View>
          {secondaryInsights.length > 0 ? (
            <>
              <Text style={styles.focusSubhead}>{t('homeNextSignals')}</Text>
              <View style={styles.focusMiniList}>
                {secondaryInsights.map((insight) => (
                  <Pressable
                    key={insight.id}
                    onPress={() => router.push('/insights')}
                    style={({ pressed }) => [styles.focusMiniRow, pressed && styles.pressed]}
                    accessibilityRole="button">
                    <Text style={styles.focusMiniTitle} numberOfLines={1}>{insight.title}</Text>
                    <Text style={styles.focusMiniScore}>{Math.round(Number(insight.score) || 0)}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <SectionHeader
          title={t('homeQuantSection')}
          icon="calculator"
          action={t('commonViewAll')}
          onPress={() => router.push('/quant')}
          theme={theme}
          scaleFont={scaleFont}
        />
        <View style={styles.quantList}>
          {topQuantSignals.length > 0 ? (
            topQuantSignals.map((item) => (
              <Pressable
                key={item.symbol}
                onPress={() => router.push('/quant')}
                style={({ pressed }) => [styles.quantRow, pressed && styles.pressed]}
                accessibilityRole="button">
                <View style={styles.quantLeft}>
                  <View style={styles.quantTitleRow}>
                    <Text style={styles.quantSymbol} numberOfLines={1}>
                      {item.displaySymbol || item.symbol}
                    </Text>
                    <Text style={styles.quantAction} numberOfLines={1}>
                      {item.perspective?.label || item.headline || t('screenQuant')}
                    </Text>
                  </View>
                  <Text style={styles.quantSummary} numberOfLines={2}>
                    {item.perspective?.positives?.[0] || item.interpretation || item.name || item.symbol}
                  </Text>
                </View>
                <View style={styles.quantScoreBox}>
                  <Text style={styles.quantScoreLabel}>{t('quantScore')}</Text>
                  <Text style={styles.quantScoreValue}>{Math.round(Number(item.score) || 0)}</Text>
                </View>
              </Pressable>
            ))
          ) : (
            <SectionPlaceholder
              loading={loading}
              emptyText={t('quantEmpty')}
              theme={theme}
              scaleFont={scaleFont}
            />
          )}
        </View>

        <SectionHeader
          title={t('homeWatchSection')}
          icon="star"
          action={t('commonViewAll')}
          onPress={() => router.push('/quotes')}
          theme={theme}
          scaleFont={scaleFont}
        />
        <View style={styles.quoteList}>
          {topQuoteRows.length > 0 ? (
            topQuoteRows.map(({ quote, newsCount, signalCount, watchSignal }) => {
              const reasonCodes = watchSignal?.reasonCodes?.length ? watchSignal.reasonCodes : [quoteReasonCode(quote)];
              const largeMove = Math.abs(Number(quote.changePercent) || 0) >= 3 || Number(watchSignal?.score || 0) >= 60;
              return (
                <Pressable
                  key={quote.symbol}
                  onPress={() => router.push(`/symbol/${quote.symbol}`)}
                  style={({ pressed }) => [styles.quoteRow, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`${quote.symbol} ${t('screenSymbolDetail')}`}>
                  <View style={styles.quoteLeft}>
                    <View style={styles.quoteSymbolRow}>
                      <Text style={styles.quoteSymbol}>{quote.symbol}</Text>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          void openYahooFinanceQuote(quote.symbol, 'stock');
                        }}
                        style={({ pressed }) => [styles.quoteYahoo, pressed && styles.quoteYahooPressed]}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        accessibilityRole="link"
                        accessibilityLabel={t('quotesYahooFinanceA11y', { symbol: quote.symbol })}>
                        <FontAwesome name="external-link" size={10} color={theme.green} />
                        <Text style={styles.quoteYahooText}>{t('quotesYahooShort')}</Text>
                      </Pressable>
                    </View>
                    <View style={styles.quoteReasonRow}>
                      {reasonCodes.slice(0, 2).map((code, index) => (
                        <View key={`${quote.symbol}-${code}`} style={[styles.quoteReasonChip, (largeMove && index === 0) && styles.quoteReasonChipHot]}>
                          <Text style={[styles.quoteReasonText, (largeMove && index === 0) && styles.quoteReasonTextHot]}>
                            {t(watchReasonLabelId(code))}
                          </Text>
                        </View>
                      ))}
                      {newsCount > 0 ? (
                        <View style={styles.quoteReasonChip}>
                          <Text style={styles.quoteReasonText}>
                            {t('homeWatchNewsCount', { count: String(newsCount) })}
                          </Text>
                        </View>
                      ) : null}
                      {signalCount > 0 ? (
                        <View style={styles.quoteReasonChip}>
                          <Text style={styles.quoteReasonText}>
                            {t('homePillSignals', { count: String(signalCount) })}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.quoteName} numberOfLines={1}>
                      {watchSignal?.summary || quote.name || `${t('quotesPrevCloseStock')} ${formatUsd(quote.previousClose)}`}
                    </Text>
                  </View>
                  <View style={styles.quoteRight}>
                    <Text style={styles.quotePrice}>{formatUsd(quote.currentPrice)}</Text>
                    <Text style={[styles.quoteChange, quoteChange.styleForQuote(quote)]}>
                      {formatUsdChange(quote.change)} ({formatPct(quote.changePercent)})
                    </Text>
                  </View>
                </Pressable>
              );
            })
          ) : (
            <SectionPlaceholder
              loading={loading}
              emptyText={t('homeEmptyWatchlist')}
              theme={theme}
              scaleFont={scaleFont}
            />
          )}
        </View>

        <SectionHeader
          title={t('homeRelatedSection')}
          icon="newspaper-o"
          action={t('commonViewAll')}
          onPress={() => router.push('/news')}
          theme={theme}
          scaleFont={scaleFont}
        />
        <View style={styles.evidenceList}>
          {evidenceRows.length > 0 ? (
            evidenceRows.map((item, index) => (
              <EvidenceCard
                key={item.key}
                icon={item.icon}
                kind={item.kind}
                title={item.title}
                source={item.source}
                timeLabel={item.timeLabel}
                grouped
                isLast={index === evidenceRows.length - 1}
                onPress={() => {
                  if (item.url) {
                    void WebBrowser.openBrowserAsync(item.url);
                  } else {
                    router.push(item.fallbackRoute);
                  }
                }}
                feedTypo={feedTypo}
                theme={theme}
                scaleFont={scaleFont}
              />
            ))
          ) : (
            <SectionPlaceholder
              loading={loading}
              emptyText={t('homeEvidenceFallback')}
              theme={theme}
              scaleFont={scaleFont}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
