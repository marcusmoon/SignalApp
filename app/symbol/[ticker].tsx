import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchCompanyNewsForDisplay } from '@/services/companyNewsForSymbol';
import {
  fetchEarningsCalendarRangeMerged,
  fetchProfile2,
  fetchQuote,
  fetchStockCandles,
  type FinnhubEarningsRow,
  type FinnhubNewsRaw,
  type FinnhubProfile2,
  type FinnhubQuote,
  type FinnhubStockCandles,
} from '@/services/finnhub';
import { loadWatchlistSymbols, saveWatchlistSymbols } from '@/services/quoteWatchlist';
import { translateNewsTitlesWithSelectedProvider } from '@/services/aiSummaries';
import type { NewsItem } from '@/types/signal';
import { addDays, toYmd } from '@/utils/date';
import { openYahooFinanceQuote } from '@/utils/yahooFinance';

/** Finnhub 실적 캘린더 과거 구간(일) — 지난 분기 행이 보이도록 넉넉히 */
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

function hasCalendarMetrics(row: FinnhubEarningsRow): boolean {
  return [row.epsEstimate, row.epsActual, row.revenueEstimate, row.revenueActual].some(
    (v) => typeof v === 'number' && Number.isFinite(v),
  );
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

function makeStyles(theme: AppTheme) {
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
    company: { fontSize: 26, fontWeight: '900', color: theme.text, marginBottom: 6 },
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
    chartLabel: { fontSize: 11, fontWeight: '800', color: theme.textDim },
    chartValue: { fontSize: 12, fontWeight: '700', color: theme.textMuted },
    chartEmpty: { fontSize: 12, color: theme.textMuted, lineHeight: 18 },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap',
    },
    price: { fontSize: 28, fontWeight: '900', color: theme.text },
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
    changeUp: { color: theme.green, fontSize: 13, fontWeight: '800' },
    changeDn: { color: '#E06D6D', fontSize: 13, fontWeight: '800' },
    heroMcap: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textMuted,
      marginTop: 10,
      letterSpacing: 0.1,
    },
    section: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 10 },
    sectionCard: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 12,
    },
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
    actionBtnText: { fontSize: 13, fontWeight: '800', color: theme.green },
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
    newsSource: { fontSize: 11, fontWeight: '800', color: theme.textDim },
    newsTime: { fontSize: 11, color: theme.textMuted },
    newsTitle: { fontSize: 14, lineHeight: 20, color: theme.text, fontWeight: '700', marginBottom: 4 },
    earningsSubheading: {
      fontSize: 11,
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
    earningsFyDate: { fontSize: 16, fontWeight: '900', color: theme.text, letterSpacing: -0.25, marginBottom: 8 },
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
    earningsHourBadgeText: { fontSize: 11, fontWeight: '800', color: theme.textMuted },
    earningsMeta: { fontSize: 13, lineHeight: 20, color: theme.text, fontWeight: '600', opacity: 0.92 },
    earningsFoot: { fontSize: 11, color: theme.textDim, marginTop: 12, lineHeight: 16 },
    earningsRowPressed: { opacity: 0.88 },
    empty: { fontSize: 13, color: theme.textMuted },
    sourceFootnote: {
      fontSize: 11,
      lineHeight: 16,
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
    errorText: { fontSize: 13, color: '#E0A0A0', lineHeight: 20 },
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
  hourLabel,
  metricsText,
  onPress,
  a11yLabel,
}: {
  row: FinnhubEarningsRow;
  variant: 'upcoming' | 'past';
  styles: SymbolDetailStyles;
  theme: AppTheme;
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
          <Text style={styles.earningsFyDate}>{`FY${row.year} Q${row.quarter} · ${row.date}`}</Text>
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
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<FinnhubProfile2 | null>(null);
  const [quote, setQuote] = useState<FinnhubQuote | null>(null);
  const [candles, setCandles] = useState<FinnhubStockCandles | null>(null);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [earnings, setEarnings] = useState<FinnhubEarningsRow[]>([]);
  const [watching, setWatching] = useState(false);

  const load = useCallback(async () => {
    if (!ticker) {
      setError(t('symbolDetailErrorLoad'));
      setLoading(false);
      return;
    }

    setError(null);
    const earnFrom = addDays(new Date(), -EARN_LOOKBACK_DAYS);
    const earnTo = addDays(new Date(), EARN_FORWARD_DAYS);

    try {
      const [watchlist, nextProfile, nextQuote, nextCandles, companyNews, earningsRows] = await Promise.all([
        loadWatchlistSymbols(),
        fetchProfile2(ticker),
        fetchQuote(ticker).catch(() => null),
        fetchStockCandles(ticker, 'D', addDays(new Date(), -30), new Date()).catch(() => null),
        fetchCompanyNewsForDisplay(ticker).catch(() => [] as FinnhubNewsRaw[]),
        fetchEarningsCalendarRangeMerged(earnFrom, earnTo).catch(() => [] as FinnhubEarningsRow[]),
      ]);

      const relatedRaw = companyNews;

      const translatedNews =
        relatedRaw.length > 0 ? await translateNewsTitlesWithSelectedProvider(relatedRaw) : [];

      const todayYmd = toYmd(new Date());
      const matchedAll = earningsRows
        .filter((row) => row.symbol?.trim().toUpperCase() === ticker)
        .sort((a, b) => a.date.localeCompare(b.date));
      const upcoming = matchedAll.filter((r) => r.date >= todayYmd);
      const past = matchedAll.filter((r) => r.date < todayYmd).sort((a, b) => b.date.localeCompare(a.date));
      const matchedEarnings = [...upcoming, ...past].slice(0, EARN_ROWS_MAX);

      setWatching(watchlist.includes(ticker));
      setProfile(nextProfile);
      setQuote(nextQuote);
      setCandles(nextCandles);
      setNewsItems(translatedNews);
      setEarnings(matchedEarnings);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('symbolDetailErrorLoad'));
    } finally {
      setLoading(false);
    }
  }, [ticker, t]);

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

  const chartColor = quote?.d != null ? (quote.d >= 0 ? theme.green : '#E06D6D') : theme.green;

  const chartRangeLabel = useMemo(() => {
    if (chartCloses.length < 2) return '1M';
    return `${formatUsd(chartCloses[0]!)} → ${formatUsd(chartCloses[chartCloses.length - 1]!)}`;
  }, [chartCloses]);

  const displayCompanyName = useMemo(
    () => normalizeCompanyName(profile?.name, ticker) ?? t('symbolDetailCompanyUnknown'),
    [profile?.name, t, ticker],
  );

  const earningsSplit = useMemo(() => {
    const y = toYmd(new Date());
    const idx = earnings.findIndex((r) => r.date < y);
    const upcomingEarnings = idx === -1 ? earnings : earnings.slice(0, idx);
    const pastEarnings = idx === -1 ? [] : earnings.slice(idx);
    return { upcomingEarnings, pastEarnings };
  }, [earnings]);

  const openEarningsSummary = useCallback(
    (row: FinnhubEarningsRow) => {
      router.push({
        pathname: '/calls',
        params: {
          ticker,
          year: String(row.year),
          quarter: String(row.quarter),
          date: row.date,
          hour: row.hour,
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
              {quote ? formatUsd(quote.c) : t('symbolDetailPriceUnavailable')}
            </Text>
            <View style={styles.priceMeta}>
              {quote ? (
                <>
                  <Text style={quote.d >= 0 ? styles.changeUp : styles.changeDn}>{formatUsdChange(quote.d)}</Text>
                  <Text style={quote.dp >= 0 ? styles.changeUp : styles.changeDn}>{formatPct(quote.dp)}</Text>
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
                <Text style={styles.chartLabel}>1M</Text>
                <Text style={styles.chartValue}>{chartRangeLabel}</Text>
              </View>
              <Sparkline closes={chartCloses} color={chartColor} />
            </View>
          ) : (
            <View style={styles.chartWrap}>
              <View style={styles.chartMetaRow}>
                <Text style={styles.chartLabel}>1M</Text>
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
                    const h = row.hour.trim().toLowerCase();
                    const hourLabel =
                      h === 'bmo' ? t('briefingEarnHourBmo') : h === 'amc' ? t('briefingEarnHourAmc') : row.hour || '—';
                    return (
                      <SymbolEarningsRowPressable
                        key={`up-${row.symbol}-${row.date}-${row.quarter}-${row.year}`}
                        row={row}
                        variant="upcoming"
                        styles={styles}
                        theme={theme}
                        hourLabel={hourLabel}
                        metricsText={
                          hasCalendarMetrics(row)
                            ? t('symbolDetailEarningsMetrics', {
                                epsEst: fmtFinMetric(row.epsEstimate),
                                epsAct: fmtFinMetric(row.epsActual),
                                revEst: fmtFinMetric(row.revenueEstimate),
                                revAct: fmtFinMetric(row.revenueActual),
                              })
                            : null
                        }
                        onPress={() => openEarningsSummary(row)}
                        a11yLabel={t('symbolDetailEarningsOpenSummaryA11y', {
                          date: row.date,
                          fy: String(row.year),
                          q: String(row.quarter),
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
                    const h = row.hour.trim().toLowerCase();
                    const hourLabel =
                      h === 'bmo' ? t('briefingEarnHourBmo') : h === 'amc' ? t('briefingEarnHourAmc') : row.hour || '—';
                    return (
                      <SymbolEarningsRowPressable
                        key={`past-${row.symbol}-${row.date}-${row.quarter}-${row.year}`}
                        row={row}
                        variant="past"
                        styles={styles}
                        theme={theme}
                        hourLabel={hourLabel}
                        metricsText={
                          hasCalendarMetrics(row)
                            ? t('symbolDetailEarningsMetrics', {
                                epsEst: fmtFinMetric(row.epsEstimate),
                                epsAct: fmtFinMetric(row.epsActual),
                                revEst: fmtFinMetric(row.revenueEstimate),
                                revAct: fmtFinMetric(row.revenueActual),
                              })
                            : null
                        }
                        onPress={() => openEarningsSummary(row)}
                        a11yLabel={t('symbolDetailEarningsOpenSummaryA11y', {
                          date: row.date,
                          fy: String(row.year),
                          q: String(row.quarter),
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
