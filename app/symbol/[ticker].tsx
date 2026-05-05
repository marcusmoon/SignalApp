import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { InsightCard } from '@/components/signal/InsightCard';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchCompanyNewsForDisplay } from '@/services/companyNewsForSymbol';
import {
  earningsRowDate,
  earningsRowHour,
  earningsRowQuarter,
  earningsRowSymbol,
  earningsRowYear,
} from '@/domain/concalls/signalCalendarEarnings';
import { fetchSignalEarningsCalendarRangeMerged } from '@/integrations/signal-api/calendarRange';
import { fetchSignalInsights } from '@/integrations/signal-api/insights';
import { fetchSignalMarketQuotes } from '@/integrations/signal-api/market';
import { signalNewsToNewsItem } from '@/integrations/signal-api/news';
import { fetchSignalStockCandles, fetchSignalStockProfile } from '@/integrations/signal-api/stock';
import type {
  SignalApiCalendarEvent,
  SignalApiInsight,
  SignalApiMarketQuote,
  SignalApiNewsItem,
  SignalApiStockCandles,
  SignalApiStockProfile,
} from '@/integrations/signal-api/types';
import { signalMarketQuoteHasValidPrice } from '@/utils/signalMarketQuote';
import { buildSignalScore } from '@/domain/signals';
import { loadWatchlistSymbols, saveWatchlistSymbols } from '@/services/quoteWatchlist';
import type { NewsItem } from '@/types/signal';
import { hasSignalApi } from '@/services/env';
import { addDays, toYmd } from '@/utils/date';
import { signalReasonLabel } from '@/utils/signalDisplay';
import { openYahooFinanceQuote } from '@/utils/yahooFinance';

/** 실적 캘린더 과거 구간(일) — 지난 분기 행이 보이도록 넉넉히 */
const EARN_LOOKBACK_DAYS = 800;
const EARN_FORWARD_DAYS = 540;
const EARN_ROWS_MAX = 24;

type SparkPoint = {
  x: number;
  y: number;
};

function normalizeTicker(raw: string | string[] | undefined): string {
  const first = Array.isArray(raw) ? raw[0] : raw;
  return String(first ?? '')
    .trim()
    .toUpperCase();
}

function formatUsdBody(abs: number): string {
  if (!Number.isFinite(abs) || abs < 0) return '—';
  if (abs >= 1000) return abs.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (abs >= 1) return abs.toFixed(2);
  if (abs >= 0.0001) return abs.toFixed(6);
  return abs.toFixed(8);
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `$${formatUsdBody(Math.abs(n))}`;
}

function formatUsdChange(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '$0.00';
  const sign = n > 0 ? '+' : '-';
  return `${sign}$${formatUsdBody(Math.abs(n))}`;
}

function formatPct(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function formatMarketCapUsd(millions: number | undefined): string {
  if (typeof millions !== 'number' || !Number.isFinite(millions) || millions <= 0) return '—';
  const usd = millions * 1_000_000;
  if (usd >= 1_000_000_000_000) return `$${(usd / 1_000_000_000_000).toFixed(2)}T`;
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  return `$${(usd / 1_000_000).toFixed(0)}M`;
}

function fmtFinMetric(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.abs(n) >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : String(n);
}

function hasCalendarMetrics(row: SignalApiCalendarEvent): boolean {
  return [row.estimate, row.actual, row.previous].some((v) => typeof v === 'number' && Number.isFinite(v));
}

function normalizeCompanyName(name: string | undefined, ticker: string): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  if (trimmed.toUpperCase() === ticker.trim().toUpperCase()) return null;
  return trimmed;
}

function buildSparkPoints(closes: number[], width: number, height: number): SparkPoint[] {
  if (closes.length === 0 || width <= 0 || height <= 0) return [];
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const spread = Math.max(max - min, 1e-6);
  const stepX = closes.length > 1 ? width / (closes.length - 1) : width;
  return closes.map((close, index) => ({
    x: stepX * index,
    y: height - ((close - min) / spread) * height,
  }));
}

function Sparkline({
  closes,
  color,
}: {
  closes: number[];
  color: string;
}) {
  const [width, setWidth] = useState(0);
  const height = 68;
  const points = useMemo(() => buildSparkPoints(closes, width, height - 6), [closes, width]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.max(0, event.nativeEvent.layout.width - 2);
    setWidth((prev) => (Math.abs(prev - nextWidth) < 1 ? prev : nextWidth));
  }, []);

  return (
    <View onLayout={onLayout} style={stylesStatic.sparkWrap}>
      <View style={stylesStatic.sparkGrid} />
      {points.slice(0, -1).map((point, index) => {
        const next = points[index + 1];
        const dx = next.x - point.x;
        const dy = next.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        return (
          <View
            key={`seg-${index}`}
            style={[
              stylesStatic.sparkSeg,
              {
                left: point.x,
                top: point.y,
                width: Math.max(length, 2),
                backgroundColor: color,
                transform: [{ rotate: `${angle}deg` }],
              },
            ]}
          />
        );
      })}
      {points.length > 0 ? (
        <View
          style={[
            stylesStatic.sparkDot,
            {
              left: points[points.length - 1]!.x - 4,
              top: points[points.length - 1]!.y - 4,
              backgroundColor: color,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
    hero: {
      backgroundColor: theme.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      marginBottom: 14,
    },
    company: { fontSize: sf(26), fontWeight: '900', color: theme.text, marginBottom: 6 },
    companySkeleton: {
      width: '72%',
      height: 28,
      borderRadius: 8,
      backgroundColor: theme.bgElevated,
      marginBottom: 10,
    },
    chartWrap: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    chartMetaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    chartLabel: { fontSize: sf(11), fontWeight: '800', color: theme.textDim },
    chartValue: { fontSize: sf(12), fontWeight: '700', color: theme.textMuted },
    chartEmpty: { fontSize: sf(12), color: theme.textMuted, lineHeight: sf(18) },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap',
    },
    price: { fontSize: sf(28), fontWeight: '900', color: theme.text },
    priceMeta: { alignItems: 'flex-end', gap: 4 },
    priceSkeleton: {
      width: 120,
      height: 30,
      borderRadius: 8,
      backgroundColor: theme.bgElevated,
    },
    priceMetaSkeleton: {
      width: 64,
      height: 14,
      borderRadius: 6,
      backgroundColor: theme.bgElevated,
    },
    changeUp: { color: theme.green, fontSize: sf(13), fontWeight: '800' },
    changeDn: { color: '#E06D6D', fontSize: sf(13), fontWeight: '800' },
    heroMcap: {
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.textMuted,
      marginTop: 10,
      letterSpacing: 0.1,
    },
    section: { fontSize: sf(16), fontWeight: '800', color: theme.text, marginBottom: 10 },
    sectionCard: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 12,
    },
    signalOverviewHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    signalOverviewCopy: { flex: 1, minWidth: 0 },
    signalOverviewSub: { fontSize: sf(12), color: theme.textDim, fontWeight: '700', lineHeight: sf(18) },
    signalScoreBadge: {
      minWidth: 62,
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    signalScoreBadgeHot: {
      borderColor: theme.accentOrange + '88',
      backgroundColor: theme.accentOrange + '22',
    },
    signalScoreBadgeQuiet: {
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
    },
    signalScoreNum: { fontSize: sf(22), fontWeight: '900', color: theme.text, lineHeight: sf(26) },
    signalScoreNumHot: { color: theme.accentOrange },
    signalScoreNumQuiet: { color: theme.textMuted },
    signalScoreLabel: { fontSize: sf(9), fontWeight: '800', color: theme.textMuted },
    signalScoreLabelHot: { color: theme.accentOrange },
    signalStatGrid: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    signalStat: {
      flex: 1,
      minWidth: 0,
      borderRadius: 10,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 9,
    },
    signalStatLabel: { fontSize: sf(10), fontWeight: '800', color: theme.textMuted, marginBottom: 5 },
    signalStatValue: { fontSize: sf(12), fontWeight: '900', color: theme.text },
    signalReasonLine: { fontSize: sf(12), fontWeight: '700', color: theme.textDim, lineHeight: sf(18) },
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    actionBtnAlt: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      paddingVertical: 11,
      borderWidth: 1,
      backgroundColor: theme.bgElevated,
      borderColor: theme.border,
    },
    actionBtnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    actionBtnText: { fontSize: sf(13), fontWeight: '800', color: theme.green },
    actionBtnTextAlt: { color: theme.text },
    centeredLoadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    newsCard: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      padding: 12,
      marginBottom: 10,
    },
    newsMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    newsSource: { fontSize: sf(11), fontWeight: '800', color: theme.textDim },
    newsTime: { fontSize: sf(11), color: theme.textMuted },
    newsTitle: { fontSize: sf(14), lineHeight: sf(20), color: theme.text, fontWeight: '700', marginBottom: 4 },
    earningsSubheading: {
      fontSize: sf(11),
      fontWeight: '800',
      letterSpacing: 0.4,
      color: theme.textMuted,
      marginBottom: 10,
      marginTop: 4,
    },
    earningsRow: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginBottom: 10,
    },
    earningsRowUpcoming: {
      borderLeftWidth: 4,
      borderLeftColor: theme.green,
      backgroundColor: theme.greenDim,
      borderColor: theme.greenBorder,
    },
    earningsRowPast: {
      borderLeftWidth: 4,
      borderLeftColor: 'rgba(142,142,147,0.35)',
    },
    earningsRowInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    earningsLeft: { flex: 1, minWidth: 0 },
    earningsFyDate: { fontSize: sf(16), fontWeight: '900', color: theme.text, letterSpacing: -0.25, marginBottom: 8 },
    earningsHourBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 8,
    },
    earningsHourBadgeText: { fontSize: sf(11), fontWeight: '800', color: theme.textMuted },
    earningsMeta: { fontSize: sf(13), lineHeight: sf(20), color: theme.text, fontWeight: '600', opacity: 0.92 },
    earningsFoot: { fontSize: sf(11), color: theme.textDim, marginTop: 12, lineHeight: sf(16) },
    earningsRowPressed: { opacity: 0.88 },
    empty: { fontSize: sf(13), color: theme.textMuted },
    sourceFootnote: {
      fontSize: sf(11),
      lineHeight: sf(16),
      fontWeight: '500',
      color: theme.textMuted,
      marginTop: 12,
    },
    errorBox: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#553333',
      backgroundColor: '#2A1515',
      padding: 14,
    },
    errorText: { fontSize: sf(13), color: '#E0A0A0', lineHeight: sf(20) },
    loadingWrap: {
      paddingVertical: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}

type SymbolDetailStyles = ReturnType<typeof makeStyles>;

function SymbolEarningsRowPressable({
  row,
  variant,
  styles,
  theme,
  fiscalTitle,
  hourLabel,
  metricsText,
  onPress,
  a11yLabel,
}: {
  row: SignalApiCalendarEvent;
  variant: 'upcoming' | 'past';
  styles: SymbolDetailStyles;
  theme: AppTheme;
  fiscalTitle: string;
  hourLabel: string;
  metricsText: string | null;
  onPress: () => void;
  a11yLabel: string;
}) {
  const isUp = variant === 'upcoming';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.earningsRow,
        isUp ? styles.earningsRowUpcoming : styles.earningsRowPast,
        pressed && styles.earningsRowPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}>
      <View style={styles.earningsRowInner}>
        <View style={styles.earningsLeft}>
          <Text style={styles.earningsFyDate}>{fiscalTitle}</Text>
          <View style={styles.earningsHourBadge}>
            <Text style={styles.earningsHourBadgeText}>{hourLabel}</Text>
          </View>
          {metricsText ? <Text style={styles.earningsMeta}>{metricsText}</Text> : null}
        </View>
        <FontAwesome
          name="chevron-right"
          size={14}
          color={isUp ? theme.green : theme.textMuted}
          style={{ marginTop: 2 }}
        />
      </View>
    </Pressable>
  );
}

const stylesStatic = StyleSheet.create({
  sparkWrap: {
    height: 68,
    position: 'relative',
    overflow: 'hidden',
  },
  sparkGrid: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sparkSeg: {
    position: 'absolute',
    height: 2,
    borderRadius: 999,
    transformOrigin: 'left center',
  },
  sparkDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default function SymbolDetailScreen() {
  const { ticker: tickerParam } = useLocalSearchParams<{ ticker?: string | string[] }>();
  const ticker = useMemo(() => normalizeTicker(tickerParam), [tickerParam]);
  const router = useRouter();
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<SignalApiStockProfile | null>(null);
  const [quote, setQuote] = useState<SignalApiMarketQuote | null>(null);
  const [candles, setCandles] = useState<SignalApiStockCandles | null>(null);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [signalNews, setSignalNews] = useState<SignalApiNewsItem[]>([]);
  const [serverInsights, setServerInsights] = useState<SignalApiInsight[]>([]);
  const [earnings, setEarnings] = useState<SignalApiCalendarEvent[]>([]);
  const [watching, setWatching] = useState(false);

  const load = useCallback(async () => {
    if (!ticker) {
      setError(t('symbolDetailErrorLoad'));
      setServerInsights([]);
      setLoading(false);
      return;
    }

    if (!hasSignalApi()) {
      setError(t('errorSignalApiShort'));
      setProfile(null);
      setQuote(null);
      setCandles(null);
      setNewsItems([]);
      setSignalNews([]);
      setServerInsights([]);
      setEarnings([]);
      setLoading(false);
      return;
    }

    setError(null);
    const earnFrom = addDays(new Date(), -EARN_LOOKBACK_DAYS);
    const earnTo = addDays(new Date(), EARN_FORWARD_DAYS);

    try {
      const [watchlist, nextProfile, mqRows, nextCandles, companyNews, earningsRows, insightRows] = await Promise.all([
        loadWatchlistSymbols(),
        fetchSignalStockProfile(ticker),
        fetchSignalMarketQuotes({ symbols: [ticker], pageSize: 1 }).catch(() => []),
        fetchSignalStockCandles(ticker, 'D', addDays(new Date(), -30), new Date()).catch(() => null),
        fetchCompanyNewsForDisplay(ticker, locale).catch(() => [] as SignalApiNewsItem[]),
        fetchSignalEarningsCalendarRangeMerged(earnFrom, earnTo).catch(() => [] as SignalApiCalendarEvent[]),
        fetchSignalInsights({
          symbol: ticker,
          date: 'today',
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          limit: 1,
          offset: 0,
        })
          .then((result) => result.items)
          .catch(() => [] as SignalApiInsight[]),
      ]);

      const row0 = mqRows[0];
      const nextQuote = row0 && signalMarketQuoteHasValidPrice(row0) ? row0 : null;

      const relatedRaw = companyNews;
      setSignalNews(relatedRaw);
      const translatedNews = relatedRaw.map((a) => signalNewsToNewsItem(a, locale));

      const todayYmd = toYmd(new Date());
      const matchedAll = earningsRows
        .filter((row) => earningsRowSymbol(row) === ticker)
        .sort((a, b) => earningsRowDate(a).localeCompare(earningsRowDate(b)));
      const upcoming = matchedAll.filter((r) => earningsRowDate(r) >= todayYmd);
      const past = matchedAll
        .filter((r) => earningsRowDate(r) < todayYmd)
        .sort((a, b) => earningsRowDate(b).localeCompare(earningsRowDate(a)));
      const matchedEarnings = [...upcoming, ...past].slice(0, EARN_ROWS_MAX);

      setWatching(watchlist.includes(ticker));
      setProfile(nextProfile);
      setQuote(nextQuote);
      setCandles(nextCandles);
      setNewsItems(translatedNews);
      setServerInsights(insightRows);
      setEarnings(matchedEarnings);
    } catch (e) {
      setServerInsights([]);
      setError(e instanceof Error ? e.message : t('symbolDetailErrorLoad'));
    } finally {
      setLoading(false);
    }
  }, [locale, ticker, t]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const toggleWatch = useCallback(async () => {
    if (!ticker) return;
    const current = await loadWatchlistSymbols();
    const next = current.includes(ticker) ? current.filter((item) => item !== ticker) : [...current, ticker];
    await saveWatchlistSymbols(next);
    setWatching(next.includes(ticker));
  }, [ticker]);

  const chartCloses = useMemo(() => {
    const closes = candles?.c?.filter((value) => Number.isFinite(value)) ?? [];
    return closes.slice(-24);
  }, [candles]);

  const chartColor = quote?.change != null ? (quote.change >= 0 ? theme.green : '#E06D6D') : theme.green;

  const latestEarning = useMemo(() => {
    const today = toYmd(new Date());
    return earnings.find((r) => earningsRowDate(r) >= today) ?? null;
  }, [earnings]);

  const symbolVsSma20Pct = useMemo(() => {
    if (!quote || chartCloses.length < 20) return null;
    const last20 = chartCloses.slice(-20);
    const sma20 = last20.reduce((sum, close) => sum + close, 0) / last20.length;
    const last = Number(quote.currentPrice);
    if (!Number.isFinite(sma20) || sma20 === 0 || !Number.isFinite(last)) return null;
    return ((last - sma20) / sma20) * 100;
  }, [chartCloses, quote]);

  const symbolSignal = useMemo(
    () =>
      buildSignalScore({
        symbol: ticker,
        quote,
        news: signalNews,
        nextEarning: latestEarning,
        vsSmaPct: symbolVsSma20Pct,
        todayYmd: toYmd(new Date()),
      }),
    [latestEarning, signalNews, quote, symbolVsSma20Pct, ticker],
  );

  const chartRangeLabel = useMemo(() => {
    if (chartCloses.length < 2) return t('symbolDetailChartRange1M');
    return `${formatUsd(chartCloses[0]!)} → ${formatUsd(chartCloses[chartCloses.length - 1]!)}`;
  }, [chartCloses, t]);

  const displayCompanyName = useMemo(
    () => normalizeCompanyName(profile?.name, ticker) ?? t('symbolDetailCompanyUnknown'),
    [profile?.name, t, ticker],
  );

  const earningsSplit = useMemo(() => {
    const y = toYmd(new Date());
    const idx = earnings.findIndex((r) => earningsRowDate(r) < y);
    const upcomingEarnings = idx === -1 ? earnings : earnings.slice(0, idx);
    const pastEarnings = idx === -1 ? [] : earnings.slice(idx);
    return { upcomingEarnings, pastEarnings };
  }, [earnings]);

  const openEarningsSummary = useCallback(
    (row: SignalApiCalendarEvent) => {
      router.push({
        pathname: '/calls',
        params: {
          ticker,
          year: String(earningsRowYear(row)),
          quarter: String(earningsRowQuarter(row)),
          date: earningsRowDate(row),
          hour: earningsRowHour(row),
        },
      });
    },
    [router, ticker],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: ticker || t('screenSymbolDetail') }} />
      {loading ? (
        <View style={styles.centeredLoadingWrap}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : (
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.company}>{displayCompanyName}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {quote && typeof quote.currentPrice === 'number'
                ? formatUsd(quote.currentPrice)
                : t('symbolDetailPriceUnavailable')}
            </Text>
            <View style={styles.priceMeta}>
              {quote ? (
                <>
                  <Text style={(quote.change ?? 0) >= 0 ? styles.changeUp : styles.changeDn}>
                    {formatUsdChange(Number(quote.change ?? 0))}
                  </Text>
                  <Text style={(quote.changePercent ?? 0) >= 0 ? styles.changeUp : styles.changeDn}>
                    {formatPct(Number(quote.changePercent ?? 0))}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
          {formatMarketCapUsd(profile?.marketCapitalization) !== '—' ? (
            <Text style={styles.heroMcap}>
              {t('symbolDetailMarketCap')}: {formatMarketCapUsd(profile?.marketCapitalization)}
            </Text>
          ) : null}
          {chartCloses.length > 1 ? (
            <View style={styles.chartWrap}>
              <View style={styles.chartMetaRow}>
                <Text style={styles.chartLabel}>{t('symbolDetailChartRange1M')}</Text>
                <Text style={styles.chartValue}>{chartRangeLabel}</Text>
              </View>
              <Sparkline closes={chartCloses} color={chartColor} />
            </View>
          ) : (
            <View style={styles.chartWrap}>
              <View style={styles.chartMetaRow}>
                <Text style={styles.chartLabel}>{t('symbolDetailChartRange1M')}</Text>
              </View>
              <Text style={styles.chartEmpty}>{t('symbolDetailNoChart')}</Text>
            </View>
          )}
          <View style={styles.actionRow}>
            <Pressable onPress={() => void openYahooFinanceQuote(ticker, 'stock')} style={styles.actionBtn}>
              <View style={styles.actionBtnRow}>
                <FontAwesome name="line-chart" size={12} color={theme.green} />
                <Text style={styles.actionBtnText}>{t('symbolDetailYahooOpen')}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => void toggleWatch()} style={styles.actionBtnAlt}>
              <Text style={[styles.actionBtnText, styles.actionBtnTextAlt]}>
                {watching ? t('symbolDetailWatchRemove') : t('symbolDetailWatchAdd')}
              </Text>
            </Pressable>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <View style={styles.signalOverviewHead}>
            <View style={styles.signalOverviewCopy}>
              <Text style={styles.section}>{t('symbolDetailSignalOverview')}</Text>
              <Text style={styles.signalOverviewSub}>
                {symbolSignal.level === 'hot'
                  ? t('symbolDetailSignalLevelHot')
                  : symbolSignal.level === 'watch'
                    ? t('symbolDetailSignalLevelWatch')
                    : t('symbolDetailSignalLevelQuiet')}
              </Text>
            </View>
            <View
              style={[
                styles.signalScoreBadge,
                symbolSignal.level === 'hot' && styles.signalScoreBadgeHot,
                symbolSignal.level === 'quiet' && styles.signalScoreBadgeQuiet,
              ]}>
              <Text
                style={[
                  styles.signalScoreNum,
                  symbolSignal.level === 'hot' && styles.signalScoreNumHot,
                  symbolSignal.level === 'quiet' && styles.signalScoreNumQuiet,
                ]}>
                {symbolSignal.score}
              </Text>
              <Text
                style={[
                  styles.signalScoreLabel,
                  symbolSignal.level === 'hot' && styles.signalScoreLabelHot,
                ]}>
                {t('symbolDetailSignalScore')}
              </Text>
            </View>
          </View>
          <View style={styles.signalStatGrid}>
            <View style={styles.signalStat}>
              <Text style={styles.signalStatLabel}>{t('symbolDetailSignalNews')}</Text>
              <Text style={styles.signalStatValue}>{newsItems.length}</Text>
            </View>
            <View style={styles.signalStat}>
              <Text style={styles.signalStatLabel}>{t('symbolDetailSignalMove')}</Text>
              <Text style={styles.signalStatValue}>
                {quote ? formatPct(Number(quote.changePercent ?? 0)) : '—'}
              </Text>
            </View>
            <View style={styles.signalStat}>
              <Text style={styles.signalStatLabel}>{t('symbolDetailSignalNextEarning')}</Text>
              <Text style={styles.signalStatValue} numberOfLines={1}>
                {latestEarning ? earningsRowDate(latestEarning) : '—'}
              </Text>
            </View>
          </View>
          <Text style={styles.signalReasonLine}>
            {(symbolSignal.reasons.length > 0
              ? symbolSignal.reasons.slice(0, 3).map((r) => signalReasonLabel(r, t))
              : [t('signalReasonWatch')]
            ).join(' · ')}
          </Text>
        </View>

        {serverInsights.length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.section}>{t('symbolDetailSectionTodaySignal')}</Text>
            <InsightCard
              insight={serverInsights[0]!}
              theme={theme}
              scaleFont={scaleFont}
              compact
              embedded
              onOpenUrl={(url) => void WebBrowser.openBrowserAsync(url)}
              onOpenSymbol={(symbol) => router.push(`/symbol/${symbol}`)}
            />
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.section}>{t('symbolDetailSectionNews')}</Text>
          {newsItems.length > 0 ? (
            newsItems.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  void WebBrowser.openBrowserAsync(item.url);
                }}
                style={styles.newsCard}>
                <View style={styles.newsMeta}>
                  <Text style={styles.newsSource}>{item.source || '—'}</Text>
                  <Text style={styles.newsTime}>{item.timeLabel || '—'}</Text>
                </View>
                <Text style={styles.newsTitle}>{item.titleKo}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.empty}>{t('symbolDetailNoNews')}</Text>
          )}
          <Text style={styles.sourceFootnote}>{t('symbolDetailNewsSourceShort')}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.section}>{t('symbolDetailSectionEarningsConcall')}</Text>
          {earnings.length > 0 ? (
            <>
              {earningsSplit.upcomingEarnings.length > 0 ? (
                <>
                  <Text style={styles.earningsSubheading}>{t('symbolDetailEarningsSubUpcoming')}</Text>
                  {earningsSplit.upcomingEarnings.map((row) => {
                    const hourRaw = earningsRowHour(row);
                    const h = hourRaw.trim().toLowerCase();
                    const hourLabel =
                      h === 'bmo' ? t('briefingEarnHourBmo') : h === 'amc' ? t('briefingEarnHourAmc') : hourRaw || '—';
                    return (
                      <SymbolEarningsRowPressable
                        key={`up-${earningsRowSymbol(row)}-${earningsRowDate(row)}-${earningsRowQuarter(row)}-${earningsRowYear(row)}`}
                        row={row}
                        variant="upcoming"
                        styles={styles}
                        theme={theme}
                        fiscalTitle={t('symbolDetailEarningsFyQuarterDate', {
                          fy: String(earningsRowYear(row)),
                          q: String(earningsRowQuarter(row)),
                          date: earningsRowDate(row),
                        })}
                        hourLabel={hourLabel}
                        metricsText={
                          hasCalendarMetrics(row)
                            ? t('symbolDetailEarningsMetrics', {
                                epsEst: fmtFinMetric(row.estimate),
                                epsAct: fmtFinMetric(row.actual),
                                revEst: fmtFinMetric(null),
                                revAct: fmtFinMetric(null),
                              })
                            : null
                        }
                        onPress={() => openEarningsSummary(row)}
                        a11yLabel={t('symbolDetailEarningsOpenSummaryA11y', {
                          date: earningsRowDate(row),
                          fy: String(earningsRowYear(row)),
                          q: String(earningsRowQuarter(row)),
                        })}
                      />
                    );
                  })}
                </>
              ) : null}
              {earningsSplit.pastEarnings.length > 0 ? (
                <>
                  <Text
                    style={[
                      styles.earningsSubheading,
                      earningsSplit.upcomingEarnings.length > 0 && { marginTop: 18 },
                    ]}>
                    {t('symbolDetailEarningsSubPast')}
                  </Text>
                  {earningsSplit.pastEarnings.map((row) => {
                    const hourRaw = earningsRowHour(row);
                    const h = hourRaw.trim().toLowerCase();
                    const hourLabel =
                      h === 'bmo' ? t('briefingEarnHourBmo') : h === 'amc' ? t('briefingEarnHourAmc') : hourRaw || '—';
                    return (
                      <SymbolEarningsRowPressable
                        key={`past-${earningsRowSymbol(row)}-${earningsRowDate(row)}-${earningsRowQuarter(row)}-${earningsRowYear(row)}`}
                        row={row}
                        variant="past"
                        styles={styles}
                        theme={theme}
                        fiscalTitle={t('symbolDetailEarningsFyQuarterDate', {
                          fy: String(earningsRowYear(row)),
                          q: String(earningsRowQuarter(row)),
                          date: earningsRowDate(row),
                        })}
                        hourLabel={hourLabel}
                        metricsText={
                          hasCalendarMetrics(row)
                            ? t('symbolDetailEarningsMetrics', {
                                epsEst: fmtFinMetric(row.estimate),
                                epsAct: fmtFinMetric(row.actual),
                                revEst: fmtFinMetric(null),
                                revAct: fmtFinMetric(null),
                              })
                            : null
                        }
                        onPress={() => openEarningsSummary(row)}
                        a11yLabel={t('symbolDetailEarningsOpenSummaryA11y', {
                          date: earningsRowDate(row),
                          fy: String(earningsRowYear(row)),
                          q: String(earningsRowQuarter(row)),
                        })}
                      />
                    );
                  })}
                </>
              ) : null}
              <Text style={styles.earningsFoot}>{t('symbolDetailEarningsFootnote')}</Text>
            </>
          ) : (
            <Text style={styles.empty}>{t('symbolDetailNoEarnings')}</Text>
          )}
        </View>
      </ScrollView>
      )}
    </SafeAreaView>
  );
}
