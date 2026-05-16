import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { TAB_BAR_FLOAT_MARGIN_BOTTOM } from '@/constants/tabBar';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { hasSignalApi } from '@/services/env';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import {
  fetchSignalInsights,
  fetchSignalMarketQuotes,
  fetchSignalNews,
  fetchSignalYoutube,
  signalNewsToNewsItem,
  signalYoutubeToYoutubeItem,
} from '@/integrations/signal-api';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type {
  SignalApiInsight,
  SignalApiMarketQuote,
  SignalApiNewsItem,
  SignalApiYoutubeVideo,
} from '@/integrations/signal-api/types';
import type { NewsItem, YoutubeItem } from '@/types/signal';
import type { MessageId } from '@/locales/messages';

type HomeState = {
  insights: SignalApiInsight[];
  watchQuotes: SignalApiMarketQuote[];
  news: NewsItem[];
  videos: YoutubeItem[];
  watchSymbols: string[];
};

const EMPTY_STATE: HomeState = {
  insights: [],
  watchQuotes: [],
  news: [],
  videos: [],
  watchSymbols: [],
};

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

export default function HomeScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const [state, setState] = useState<HomeState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mood = useMemo(
    () => marketMood(state.insights, state.watchQuotes),
    [state.insights, state.watchQuotes],
  );

  const load = useCallback(async (forceRefresh = false) => {
    setError(null);
    if (!hasSignalApi()) {
      setState(EMPTY_STATE);
      setError(t('errorSignalApiShort'));
      return;
    }

    const cacheMode = forceRefresh ? 'bypass' : 'use';
    const watchSymbols = (await loadWatchlistSymbols()).slice(0, 6);
    const [insightPage, quoteRows, newsPage, youtubePage] = await Promise.all([
      fetchSignalInsights({
        date: 'today',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        limit: 3,
        offset: 0,
      }),
      watchSymbols.length > 0
        ? fetchSignalMarketQuotes({ symbols: watchSymbols, limit: Math.max(watchSymbols.length, 1) })
        : Promise.resolve([] as SignalApiMarketQuote[]),
      fetchSignalNews({ locale, category: 'global', limit: 4, offset: 0 }, { cacheMode }),
      fetchSignalYoutube({ sort: 'popular', limit: 2, offset: 0 }, { cacheMode }),
    ]);

    const bySymbol = new Map(quoteRows.map((row) => [String(row.symbol || '').toUpperCase(), row]));
    const orderedQuotes = watchSymbols
      .map((symbol) => bySymbol.get(symbol.toUpperCase()))
      .filter((row): row is SignalApiMarketQuote => Boolean(row));

    setState({
      insights: insightPage.items,
      watchQuotes: orderedQuotes,
      news: newsPage.items.map((item: SignalApiNewsItem) => signalNewsToNewsItem(item, locale)),
      videos: youtubePage.items.map((item: SignalApiYoutubeVideo) => signalYoutubeToYoutubeItem(item, locale)),
      watchSymbols,
    });
  }, [locale, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
  const topQuotes = state.watchQuotes.slice(0, 3);
  const bottomPad = 28 + tabBarHeight + TAB_BAR_FLOAT_MARGIN_BOTTOM + insets.bottom;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SignalHeader />
      {isFocused ? <OtaUpdateBanner /> : null}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{t('homeEyebrow')}</Text>
          <Text style={styles.heroTitle}>{t(moodMessageId(mood))}</Text>
          <View style={styles.pillRow}>
            <StatusPill
              icon="bolt"
              label={t('homePillSignals', { count: String(state.insights.length) })}
              theme={theme}
              scaleFont={scaleFont}
            />
            <StatusPill
              icon="star"
              label={t('homePillWatchlist', { count: String(state.watchSymbols.length) })}
              theme={theme}
              scaleFont={scaleFont}
            />
            <StatusPill
              icon="newspaper-o"
              label={t('homePillEvidence', { count: String(state.news.length + state.videos.length) })}
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

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.green} />
            <Text style={styles.loadingText}>{t('commonLoading')}</Text>
          </View>
        ) : (
          <>
            <SectionHeader
              title={t('homeTodaySection')}
              action={t('homeSeeAll')}
              onPress={() => router.push('/insights')}
              theme={theme}
              scaleFont={scaleFont}
            />
            <View style={styles.stack}>
              {topInsights.length > 0 ? (
                topInsights.map((insight) => (
                  <Pressable
                    key={insight.id}
                    onPress={() => router.push('/insights')}
                    style={({ pressed }) => [styles.decisionCard, pressed && styles.pressed]}
                    accessibilityRole="button">
                    <View style={styles.decisionHead}>
                      <Text style={styles.decisionTitle} numberOfLines={2}>
                        {insight.title}
                      </Text>
                      <View style={styles.scoreBadge}>
                        <Text style={styles.scoreText}>{Math.round(Number(insight.score) || 0)}</Text>
                      </View>
                    </View>
                    <Text style={styles.decisionBody} numberOfLines={3}>
                      {driverText(insight)}
                    </Text>
                    {insight.symbols?.length ? (
                      <Text style={styles.symbolLine} numberOfLines={1}>
                        {insight.symbols.slice(0, 4).join(' · ')}
                      </Text>
                    ) : null}
                  </Pressable>
                ))
              ) : (
                <EmptyCard text={t('homeEmptySignals')} theme={theme} scaleFont={scaleFont} />
              )}
            </View>

            <SectionHeader
              title={t('homeWatchSection')}
              action={t('homeOpenQuotes')}
              onPress={() => router.push('/quotes')}
              theme={theme}
              scaleFont={scaleFont}
            />
            <View style={styles.quoteList}>
              {topQuotes.length > 0 ? (
                topQuotes.map((quote) => (
                  <Pressable
                    key={quote.symbol}
                    onPress={() => router.push(`/symbol/${quote.symbol}`)}
                    style={({ pressed }) => [styles.quoteRow, pressed && styles.pressed]}
                    accessibilityRole="button">
                    <View style={styles.quoteLeft}>
                      <Text style={styles.quoteSymbol}>{quote.symbol}</Text>
                      <Text style={styles.quoteName} numberOfLines={1}>
                        {quote.name || t('homeWatchReason')}
                      </Text>
                    </View>
                    <View style={styles.quoteRight}>
                      <Text style={styles.quotePrice}>{formatUsd(quote.currentPrice)}</Text>
                      <Text
                        style={[
                          styles.quoteChange,
                          Number(quote.changePercent) >= 0 ? styles.up : styles.down,
                        ]}>
                        {formatPct(quote.changePercent)}
                      </Text>
                    </View>
                  </Pressable>
                ))
              ) : (
                <EmptyCard text={t('homeEmptyWatchlist')} theme={theme} scaleFont={scaleFont} />
              )}
            </View>

            <SectionHeader
              title={t('homeEvidenceSection')}
              action={t('homeOpenNews')}
              onPress={() => router.push('/news')}
              theme={theme}
              scaleFont={scaleFont}
            />
            <View style={styles.evidenceGrid}>
              <EvidenceCard
                icon="newspaper-o"
                title={state.news[0]?.titleKo || t('homeEvidenceNewsFallback')}
                meta={state.news[0]?.source || t('tabNews')}
                onPress={() => router.push('/news')}
                theme={theme}
                scaleFont={scaleFont}
              />
              <EvidenceCard
                icon="youtube-play"
                title={state.videos[0]?.title || t('homeEvidenceYoutubeFallback')}
                meta={state.videos[0]?.channel || t('tabYoutube')}
                onPress={() => router.push('/youtube')}
                theme={theme}
                scaleFont={scaleFont}
              />
            </View>

            <Pressable
              onPress={() => router.push('/briefing')}
              style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
              accessibilityRole="button">
              <Text style={styles.primaryActionText}>{t('homeBriefingAction')}</Text>
              <FontAwesome name="chevron-right" size={13} color="#FFFFFF" />
            </Pressable>
          </>
        )}
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
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  return (
    <View style={styles.statusPill}>
      <FontAwesome name={icon} size={12} color={theme.green} />
      <Text style={styles.statusPillText}>{label}</Text>
    </View>
  );
}

function SectionHeader({
  title,
  action,
  onPress,
  theme,
  scaleFont,
}: {
  title: string;
  action: string;
  onPress: () => void;
  theme: AppTheme;
  scaleFont: (n: number) => number;
}) {
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
        <Text style={styles.sectionAction}>{action}</Text>
      </Pressable>
    </View>
  );
}

function EmptyCard({ text, theme, scaleFont }: { text: string; theme: AppTheme; scaleFont: (n: number) => number }) {
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function EvidenceCard({
  icon,
  title,
  meta,
  onPress,
  theme,
  scaleFont,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  title: string;
  meta: string;
  onPress: () => void;
  theme: AppTheme;
  scaleFont: (n: number) => number;
}) {
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.evidenceCard, pressed && styles.pressed]}
      accessibilityRole="button">
      <View style={styles.evidenceIcon}>
        <FontAwesome name={icon} size={16} color={theme.green} />
      </View>
      <Text style={styles.evidenceTitle} numberOfLines={3}>
        {title}
      </Text>
      <Text style={styles.evidenceMeta} numberOfLines={1}>
        {meta}
      </Text>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
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
    loadingBox: {
      minHeight: 240,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
    },
    loadingText: {
      fontSize: sf(13),
      color: theme.textMuted,
      fontWeight: '700',
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 2,
    },
    sectionTitle: {
      flex: 1,
      fontSize: sf(19),
      lineHeight: sf(28),
      fontWeight: '900',
      color: theme.text,
    },
    sectionAction: {
      fontSize: sf(13),
      lineHeight: sf(19.5),
      fontWeight: '900',
      color: theme.green,
    },
    stack: { gap: 10 },
    decisionCard: {
      borderRadius: 22,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 18,
      gap: 12,
    },
    decisionHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    decisionTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(18),
      lineHeight: sf(27),
      fontWeight: '900',
      color: theme.text,
    },
    scoreBadge: {
      minWidth: 42,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.green,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    scoreText: {
      fontSize: sf(13),
      fontWeight: '900',
      color: '#FFFFFF',
    },
    decisionBody: {
      fontSize: sf(14),
      lineHeight: sf(21),
      color: theme.textMuted,
      fontWeight: '700',
    },
    symbolLine: {
      fontSize: sf(12),
      lineHeight: sf(18),
      fontWeight: '900',
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
      minHeight: 72,
      paddingHorizontal: 16,
      paddingVertical: 13,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    quoteLeft: { flex: 1, minWidth: 0 },
    quoteRight: { alignItems: 'flex-end', flexShrink: 0 },
    quoteSymbol: {
      fontSize: sf(16),
      lineHeight: sf(24),
      fontWeight: '900',
      color: theme.text,
    },
    quoteName: {
      fontSize: sf(12),
      lineHeight: sf(18),
      fontWeight: '700',
      color: theme.textMuted,
    },
    quotePrice: {
      fontSize: sf(16),
      lineHeight: sf(24),
      fontWeight: '900',
      color: theme.text,
    },
    quoteChange: {
      fontSize: sf(12),
      lineHeight: sf(18),
      fontWeight: '900',
    },
    up: { color: theme.green },
    down: { color: theme.danger },
    evidenceGrid: {
      flexDirection: 'row',
      gap: 10,
    },
    evidenceCard: {
      flex: 1,
      minHeight: 150,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 16,
      gap: 10,
    },
    evidenceIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.greenDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    evidenceTitle: {
      flex: 1,
      fontSize: sf(13),
      lineHeight: sf(19.5),
      fontWeight: '900',
      color: theme.text,
    },
    evidenceMeta: {
      fontSize: sf(11),
      lineHeight: sf(16.5),
      fontWeight: '800',
      color: theme.textDim,
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
    emptyText: {
      fontSize: sf(13),
      lineHeight: sf(19.5),
      fontWeight: '800',
      color: theme.textMuted,
    },
    pressed: { opacity: 0.82 },
  });
}
