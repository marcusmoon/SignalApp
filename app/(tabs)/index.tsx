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
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { tabBarBottomInset } from '@/constants/tabBar';
import type { AppTheme } from '@/constants/theme';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useQuoteChangeColors } from '@/hooks/useQuoteChangeColors';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { buildQuotesCacheKey, peekQuotes, storeQuotes } from '@/services/cache/quotesCache';
import { hasSignalApi } from '@/services/env';
import { loadMainEntry, mainEntryHref } from '@/services/mainEntryPreference';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import { openYahooFinanceQuote } from '@/utils/yahooFinance';
import { formatRelativeFromIso } from '@/utils/date';
import {
  fetchSignalInsights,
  fetchSignalMarketQuotes,
  fetchSignalNews,
  signalNewsToNewsItem,
} from '@/integrations/signal-api';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type {
  SignalApiInsight,
  SignalApiMarketQuote,
  SignalApiNewsItem,
} from '@/integrations/signal-api/types';
import type { NewsItem } from '@/types/signal';
import type { MessageId } from '@/locales/messages';

let initialEntryApplied = false;

type HomeState = {
  insights: SignalApiInsight[];
  watchQuotes: SignalApiMarketQuote[];
  rawNews: SignalApiNewsItem[];
  news: NewsItem[];
  watchSymbols: string[];
};

const EMPTY_STATE: HomeState = {
  insights: [],
  watchQuotes: [],
  rawNews: [],
  news: [],
  watchSymbols: [],
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
};

const HOME_RELATED_NEWS_LIMIT = 5;
const HOME_RELATED_NEWS_MAX_AGE_MS = 72 * 60 * 60 * 1000;
const HOME_RELATED_VIDEO_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function homeRelatedNewsFromIso(): string {
  const fromMs = Date.now() - HOME_RELATED_NEWS_MAX_AGE_MS;
  const hourMs = 60 * 60 * 1000;
  return new Date(Math.floor(fromMs / hourMs) * hourMs).toISOString();
}

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

function isoMs(iso?: string | null): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isRecentIso(iso: string | null | undefined, maxAgeMs: number): boolean {
  const ms = isoMs(iso);
  if (ms == null) return false;
  const age = Date.now() - ms;
  return age >= 0 && age <= maxAgeMs;
}

function formatUsdBody(abs: number): string {
  if (!Number.isFinite(abs) || abs < 0) return '—';
  if (abs >= 1000) return abs.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (abs >= 1) return abs.toFixed(2);
  if (abs >= 0.0001) return abs.toFixed(6);
  return abs.toFixed(8);
}

function formatUsd(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return `$${formatUsdBody(Math.abs(n))}`;
}

function formatPct(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function formatUsdChange(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  if (n === 0) return '$0.00';
  const sign = n > 0 ? '+' : '-';
  return `${sign}$${formatUsdBody(Math.abs(n))}`;
}

function driverText(insight: SignalApiInsight): string {
  return (
    insight.whyNow ||
    insight.reasoning?.[0] ||
    insight.signalDrivers?.[0] ||
    insight.summary ||
    insight.title
  );
}

function marketMood(insights: SignalApiInsight[], quotes: SignalApiMarketQuote[]): 'quiet' | 'watch' | 'active' {
  if (insights.some((item) => item.level === 'alert' || item.pushPriority === 'high')) return 'active';
  const maxMove = Math.max(
    0,
    ...quotes.map((quote) => Math.abs(Number(quote.changePercent))).filter((n) => Number.isFinite(n)),
  );
  if (maxMove >= 3 || insights.length >= 2) return 'watch';
  return 'quiet';
}

function moodMessageId(mood: ReturnType<typeof marketMood>): MessageId {
  if (mood === 'active') return 'homeMoodActive';
  if (mood === 'watch') return 'homeMoodWatch';
  return 'homeMoodQuiet';
}

function homeHeadline(params: {
  insights: SignalApiInsight[];
  quotes: SignalApiMarketQuote[];
  fallback: string;
  pulseHeadline: string;
  pulseQuiet: string;
}): string {
  const quotes = params.quotes.filter((row) => typeof row.changePercent === 'number' && Number.isFinite(row.changePercent));
  const moverCount = quotes.filter((row) => Math.abs(Number(row.changePercent)) >= 1).length;
  if (quotes.length > 0) return moverCount > 0 ? params.pulseHeadline : params.pulseQuiet;
  const insight = params.insights[0];
  if (insight?.title) return insight.title;
  return params.fallback;
}

function normalizeSymbolSet(symbols: string[]): Set<string> {
  return new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
}

function addUniqueEvidence(
  rows: HomeEvidenceRow[],
  seen: Set<string>,
  row: HomeEvidenceRow,
  max: number,
): void {
  if (rows.length >= max) return;
  const key = row.url?.trim() || row.key;
  if (seen.has(key)) return;
  seen.add(key);
  rows.push(row);
}

function symbolNewsCount(rawNews: SignalApiNewsItem[], symbol: string): number {
  const target = symbol.trim().toUpperCase();
  if (!target) return 0;
  return rawNews.filter((item) => {
    const symbols = Array.isArray(item.symbols) ? item.symbols : [];
    return symbols.some((s) => s.trim().toUpperCase() === target);
  }).length;
}

function symbolSignalCount(insights: SignalApiInsight[], symbol: string): number {
  const target = symbol.trim().toUpperCase();
  if (!target) return 0;
  return insights.filter((item) => {
    const symbols = Array.isArray(item.symbols) ? item.symbols : [];
    return symbols.some((s) => s.trim().toUpperCase() === target);
  }).length;
}

function quoteMoveLabelId(quote: SignalApiMarketQuote): MessageId {
  const pct = Number(quote.changePercent);
  if (!Number.isFinite(pct) || Math.abs(pct) < 0.2) return 'homeWatchMoveFlat';
  if (Math.abs(pct) >= 3) return 'homeWatchMoveLarge';
  return pct > 0 ? 'homeWatchMoveUp' : 'homeWatchMoveDown';
}

export default function HomeScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const quoteChange = useQuoteChangeColors();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
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
    const [insightPage, quoteRows, newsPage] = await Promise.all([
      fetchSignalInsights({
        date: 'today',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        limit: 3,
        offset: 0,
      }),
      loadHomeWatchQuotes(watchSymbols, forceRefresh),
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

    const bySymbol = new Map(quoteRows.map((row) => [String(row.symbol || '').toUpperCase(), row]));
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
  const primaryInsight = topInsights[0] ?? null;
  const secondaryInsights = topInsights.slice(1, 3);
  const topQuoteRows: HomeQuotePulseRow[] = [...state.watchQuotes]
    .map((quote) => ({
      quote,
      newsCount: symbolNewsCount(state.rawNews, quote.symbol),
      signalCount: symbolSignalCount(state.insights, quote.symbol),
    }))
    .sort((a, b) => {
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
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{t('homeEyebrow')}</Text>
          <Text style={styles.heroTitle}>{headline}</Text>
          <View style={styles.pillRow}>
            <StatusPill
              icon="bolt"
              label={t('homePillSignals', { count: String(topInsights.length) })}
              theme={theme}
              scaleFont={scaleFont}
            />
            <StatusPill
              icon="star"
              label={t('homePillWatchlist', { count: String(visibleWatchCount) })}
              theme={theme}
              scaleFont={scaleFont}
            />
            <StatusPill
              icon="newspaper-o"
              label={t('homePillEvidence', { count: String(evidenceRows.length) })}
              theme={theme}
              scaleFont={scaleFont}
            />
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

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
            topQuoteRows.map(({ quote, newsCount, signalCount }) => {
              const moveLabel = t(quoteMoveLabelId(quote));
              const largeMove = Math.abs(Number(quote.changePercent) || 0) >= 3;
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
                      <View style={[styles.quoteReasonChip, largeMove && styles.quoteReasonChipHot]}>
                        <Text style={[styles.quoteReasonText, largeMove && styles.quoteReasonTextHot]}>
                          {moveLabel}
                        </Text>
                      </View>
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
                      {quote.name || `${t('quotesPrevCloseStock')} ${formatUsd(quote.previousClose)}`}
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
          title={t('homeTodaySection')}
          icon="bolt"
          action={t('commonViewAll')}
          onPress={() => router.push('/insights')}
          theme={theme}
          scaleFont={scaleFont}
        />
        <View style={styles.signalList}>
          {primaryInsight ? (
            <>
              <Pressable
                key={primaryInsight.id}
                onPress={() => router.push('/insights')}
                style={({ pressed }) => [styles.primarySignalCard, pressed && styles.pressed]}
                accessibilityRole="button">
                <View style={styles.decisionHead}>
                  <View style={styles.decisionTextCol}>
                    <View style={styles.decisionMetaRow}>
                      {primaryInsight.symbols?.length ? (
                        <Text style={styles.symbolLine} numberOfLines={1}>
                          {primaryInsight.symbols.slice(0, 3).join(' · ')}
                        </Text>
                      ) : null}
                      <Text style={styles.decisionLevel} numberOfLines={1}>
                        {String(primaryInsight.level || '').toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.decisionTitle} numberOfLines={1}>
                      {primaryInsight.title}
                    </Text>
                    <Text style={styles.decisionBody} numberOfLines={3}>
                      {driverText(primaryInsight)}
                    </Text>
                  </View>
                  <View style={styles.scoreBadge}>
                    <Text style={styles.scoreText}>{Math.round(Number(primaryInsight.score) || 0)}</Text>
                  </View>
                </View>
              </Pressable>
              {secondaryInsights.map((insight) => (
                <Pressable
                  key={insight.id}
                  onPress={() => router.push('/insights')}
                  style={({ pressed }) => [styles.signalRow, pressed && styles.pressed]}
                  accessibilityRole="button">
                  <View style={styles.decisionHead}>
                    <View style={styles.decisionTextCol}>
                      <View style={styles.decisionMetaRow}>
                        {insight.symbols?.length ? (
                          <Text style={styles.symbolLine} numberOfLines={1}>
                            {insight.symbols.slice(0, 3).join(' · ')}
                          </Text>
                        ) : null}
                        <Text style={styles.decisionLevel} numberOfLines={1}>
                          {String(insight.level || '').toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.secondaryDecisionTitle} numberOfLines={1}>
                        {insight.title}
                      </Text>
                    </View>
                    <View style={styles.secondaryScoreBadge}>
                      <Text style={styles.secondaryScoreText}>{Math.round(Number(insight.score) || 0)}</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </>
          ) : (
            <SectionPlaceholder
              loading={loading}
              emptyText={t('homeEmptySignals')}
              theme={theme}
              scaleFont={scaleFont}
            />
          )}
        </View>

        <Pressable
          onPress={() => router.push('/briefing')}
          style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
          accessibilityRole="button">
          <View style={styles.primaryActionIcon}>
            <FontAwesome name="briefcase" size={15} color="#FFFFFF" />
          </View>
          <Text style={styles.primaryActionText}>{t('homeBriefingAction')}</Text>
          <FontAwesome name="chevron-right" size={13} color="#FFFFFF" />
        </Pressable>

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
            evidenceRows.map((item) => (
              <EvidenceCard
                key={item.key}
                icon={item.icon}
                kind={item.kind}
                title={item.title}
                source={item.source}
                timeLabel={item.timeLabel}
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

function StatusPill({
  icon,
  label,
  theme,
  scaleFont,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  theme: AppTheme;
  scaleFont: (n: number) => number;
}) {
  const { feedTypo } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  return (
    <View style={styles.statusPill}>
      <FontAwesome name={icon} size={12} color={theme.green} />
      <Text style={styles.statusPillText}>{label}</Text>
    </View>
  );
}

function SectionHeader({
  title,
  icon,
  action,
  onPress,
  theme,
  scaleFont,
}: {
  title: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  action: string;
  onPress: () => void;
  theme: AppTheme;
  scaleFont: (n: number) => number;
}) {
  const { feedTypo } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionTitleWrap}>
        <View style={styles.sectionIcon}>
          <FontAwesome name={icon} size={12} color={theme.green} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
        <View style={styles.sectionActionWrap}>
          <Text style={styles.sectionAction}>{action}</Text>
          <FontAwesome name="chevron-right" size={11} color={theme.green} />
        </View>
      </Pressable>
    </View>
  );
}

function SectionPlaceholder({
  loading,
  emptyText,
  theme,
  scaleFont,
}: {
  loading: boolean;
  emptyText: string;
  theme: AppTheme;
  scaleFont: (n: number) => number;
}) {
  const { t } = useLocale();
  const { feedTypo } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  if (loading) {
    return (
      <View style={styles.inlineLoading}>
        <View style={styles.inlineLoadingDot} />
        <Text style={styles.inlineLoadingText}>{t('commonLoading')}</Text>
      </View>
    );
  }
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{emptyText}</Text>
    </View>
  );
}

function EvidenceCard({
  icon,
  kind,
  title,
  source,
  timeLabel,
  onPress,
  feedTypo,
  theme,
  scaleFont,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  kind: string;
  title: string;
  source: string;
  timeLabel?: string;
  onPress: () => void;
  feedTypo: FeedContentTypography;
  theme: AppTheme;
  scaleFont: (n: number) => number;
}) {
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const iconSize = feedTypo.weight === 'bold' ? 17 : 16;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.evidenceCard, pressed && styles.pressed]}
      accessibilityRole="button">
      <View style={styles.evidenceIcon}>
        <FontAwesome name={icon} size={iconSize} color={theme.green} />
      </View>
      <View style={styles.evidenceText}>
        <View style={styles.evidenceMetaRow}>
          <Text style={styles.evidenceKind} numberOfLines={1}>
            {kind}
          </Text>
          <Text style={styles.evidenceSource} numberOfLines={1}>
            {source}
          </Text>
          {timeLabel ? (
            <Text style={styles.evidenceTime} numberOfLines={1}>
              {timeLabel}
            </Text>
          ) : null}
        </View>
        <Text style={styles.evidenceTitle} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <FontAwesome name="chevron-right" size={12} color={theme.textDim} />
    </Pressable>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: 20,
      paddingTop: 18,
      gap: 18,
    },
    hero: {
      gap: 14,
      paddingVertical: 8,
    },
    eyebrow: {
      fontSize: sf(13),
      lineHeight: sf(19.5),
      fontWeight: '800',
      color: theme.green,
    },
    heroTitle: {
      fontSize: sf(26),
      lineHeight: sf(35),
      fontWeight: '900',
      color: theme.text,
      letterSpacing: 0,
    },
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    statusPill: {
      minHeight: 34,
      paddingHorizontal: 11,
      borderRadius: 999,
      backgroundColor: theme.bgElevated,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    statusPillText: {
      fontSize: sf(12),
      lineHeight: sf(18),
      fontWeight: '800',
      color: theme.textMuted,
    },
    errorBox: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.danger,
      backgroundColor: theme.dangerDim,
      padding: 14,
    },
    errorText: {
      fontSize: sf(13),
      lineHeight: sf(19.5),
      color: theme.danger,
      fontWeight: '800',
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 2,
    },
    sectionTitleWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionIcon: {
      width: 24,
      height: 24,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    sectionTitle: {
      flex: 1,
      fontSize: sf(19),
      lineHeight: sf(28),
      fontWeight: '900',
      color: theme.text,
    },
    sectionAction: {
      fontSize: sf(12),
      lineHeight: sf(17),
      fontWeight: '900',
      color: theme.green,
    },
    sectionActionWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 30,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: theme.bgElevated,
    },
    signalList: {
      borderRadius: 22,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    primarySignalCard: {
      minHeight: ft.signalRow(118),
      paddingHorizontal: ft.pad(16),
      paddingVertical: ft.pad(16),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.greenDim,
    },
    signalRow: {
      minHeight: ft.signalRow(68),
      paddingHorizontal: ft.pad(16),
      paddingVertical: ft.pad(12),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    decisionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ft.pad(12),
    },
    decisionTextCol: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    decisionMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    },
    decisionLevel: {
      flexShrink: 0,
      fontSize: ft.signalBodyFont(10),
      lineHeight: ft.signalBodyFont(14),
      fontWeight: ft.signalMetaWeight,
      color: theme.textDim,
    },
    decisionTitle: {
      fontSize: ft.signalTitleFont(15),
      lineHeight: ft.signalTitleFont(22),
      fontWeight: ft.signalTitleWeight,
      color: theme.text,
    },
    secondaryDecisionTitle: {
      fontSize: ft.signalTitleFont(14),
      lineHeight: ft.signalTitleFont(20),
      fontWeight: ft.signalTitleWeight,
      color: theme.text,
    },
    scoreBadge: {
      minWidth: ft.weight === 'bold' ? 42 : 38,
      height: ft.weight === 'bold' ? 34 : 30,
      borderRadius: ft.weight === 'bold' ? 17 : 15,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: ft.pad(8),
    },
    scoreText: {
      fontSize: ft.signalTitleFont(12),
      fontWeight: ft.signalTitleWeight,
      color: theme.green,
    },
    secondaryScoreBadge: {
      minWidth: 34,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: ft.pad(7),
    },
    secondaryScoreText: {
      fontSize: ft.signalBodyFont(11),
      fontWeight: ft.signalTitleWeight,
      color: theme.textMuted,
    },
    decisionBody: {
      fontSize: ft.signalBodyFont(12),
      lineHeight: ft.signalBodyFont(18),
      color: theme.textMuted,
      fontWeight: ft.signalBodyWeight,
    },
    symbolLine: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: ft.signalBodyFont(11),
      lineHeight: ft.signalBodyFont(15),
      fontWeight: ft.signalMetaWeight,
      color: theme.green,
    },
    quoteList: {
      borderRadius: 22,
      overflow: 'hidden',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    quoteRow: {
      minHeight: ft.row(72),
      paddingHorizontal: ft.pad(16),
      paddingVertical: ft.pad(13),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    quoteLeft: { flex: 1, minWidth: 0 },
    quoteRight: { alignItems: 'flex-end', flexShrink: 0 },
    quoteSymbolRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    },
    quoteSymbol: {
      fontSize: ft.ff(16),
      lineHeight: ft.ff(24),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    quoteName: {
      fontSize: ft.ff(12),
      lineHeight: ft.ff(18),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
    },
    quoteReasonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 7,
      marginBottom: 3,
    },
    quoteReasonChip: {
      minHeight: 22,
      paddingHorizontal: 8,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
    },
    quoteReasonChipHot: {
      backgroundColor: theme.greenDim,
      borderColor: theme.greenBorder,
    },
    quoteReasonText: {
      fontSize: ft.ff(10),
      lineHeight: ft.ff(14),
      fontWeight: ft.emphasisWeight,
      color: theme.textMuted,
    },
    quoteReasonTextHot: {
      color: theme.green,
    },
    quoteCompany: {
      fontSize: ft.ff(12),
      lineHeight: ft.ff(17),
      fontWeight: ft.bodyWeight,
      color: theme.textDim,
      marginTop: 2,
    },
    quoteYahoo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      flexShrink: 1,
      minWidth: 0,
      paddingVertical: 2,
    },
    quoteYahooPressed: { opacity: 0.75 },
    quoteYahooText: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: ft.ff(11),
      lineHeight: ft.ff(15),
      fontWeight: ft.emphasisWeight,
      color: theme.green,
    },
    quotePrice: {
      fontSize: ft.ff(16),
      lineHeight: ft.ff(24),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    quoteChange: {
      fontSize: ft.ff(12),
      lineHeight: ft.ff(18),
      fontWeight: ft.emphasisWeight,
    },
    evidenceList: {
      borderRadius: 22,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    evidenceCard: {
      minHeight: ft.row(82),
      paddingHorizontal: ft.pad(16),
      paddingVertical: ft.pad(13),
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    evidenceIcon: {
      width: ft.weight === 'bold' ? 36 : 34,
      height: ft.weight === 'bold' ? 36 : 34,
      borderRadius: ft.weight === 'bold' ? 18 : 17,
      backgroundColor: theme.greenDim,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    evidenceText: {
      flex: 1,
      minWidth: 0,
      gap: 5,
    },
    evidenceMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      minWidth: 0,
    },
    evidenceKind: {
      flexShrink: 0,
      fontSize: ft.ff(11),
      lineHeight: ft.ff(16),
      fontWeight: ft.emphasisWeight,
      color: theme.green,
    },
    evidenceSource: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.ff(11),
      lineHeight: ft.ff(16),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
    },
    evidenceTime: {
      flexShrink: 0,
      fontSize: ft.ff(11),
      lineHeight: ft.ff(16),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
    },
    evidenceTitle: {
      fontSize: ft.ff(14),
      lineHeight: ft.ff(20),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    primaryAction: {
      minHeight: 52,
      borderRadius: 16,
      backgroundColor: theme.green,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      marginTop: 2,
    },
    primaryActionIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    primaryActionText: {
      fontSize: sf(15),
      lineHeight: sf(22.5),
      fontWeight: '900',
      color: '#FFFFFF',
    },
    emptyCard: {
      borderRadius: 20,
      backgroundColor: theme.bgElevated,
      padding: 18,
      minHeight: 72,
      justifyContent: 'center',
    },
    inlineLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 10,
      paddingHorizontal: 4,
    },
    inlineLoadingDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.green,
    },
    inlineLoadingText: {
      fontSize: sf(12),
      lineHeight: sf(18),
      fontWeight: '700',
      color: theme.textMuted,
    },
    emptyText: {
      fontSize: sf(13),
      lineHeight: sf(19.5),
      fontWeight: '800',
      color: theme.textMuted,
    },
    pressed: { opacity: 0.82 },
  });
}
