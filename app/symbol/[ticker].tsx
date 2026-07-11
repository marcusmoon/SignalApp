import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { stackScreenScrollBottomPadding } from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { useQuoteChangeColors } from '@/hooks/useQuoteChangeColors';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchCompanyNewsForDisplay } from '@/services/companyNewsForSymbol';
import { fetchSignalDisclosures } from '@/integrations/signal-api/disclosures';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { fetchSignalMarketQuotes } from '@/integrations/signal-api/market';
import { signalNewsToNewsItem } from '@/integrations/signal-api/news';
import { fetchSignalStockCandles, fetchSignalStockProfile } from '@/integrations/signal-api/stock';
import type {
  SignalApiDisclosure,
  SignalApiMarketQuote,
  SignalApiNewsItem,
  SignalApiStockCandles,
  SignalApiStockProfile,
} from '@/integrations/signal-api/types';
import { signalMarketQuoteHasValidPrice } from '@/utils/signalMarketQuote';
import { buildSignalScore } from '@/domain/signals';
import { loadWatchlistSymbols, saveWatchlistSymbols } from '@/services/quoteWatchlist';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import type { NewsItem } from '@/types/signal';
import { hasSignalApi } from '@/services/env';
import { addDays, formatLocalInstantDate } from '@/utils/date';
import { signalReasonLabel } from '@/utils/signalDisplay';
import { openNaverFinanceStock } from '@/utils/naverFinance';
import { openYahooFinanceQuote } from '@/utils/yahooFinance';

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

function isKoreaSymbol(symbol: string): boolean {
  return /^\d{6}$/.test(String(symbol || '').trim());
}

function formatKrw(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `₩${Math.round(value).toLocaleString('ko-KR')}`;
}

function formatKrwChange(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '₩0';
  const sign = value > 0 ? '+' : '-';
  return `${sign}₩${Math.round(Math.abs(value)).toLocaleString('ko-KR')}`;
}

function formatMarketPrice(value: number, isKorea: boolean): string {
  return isKorea ? formatKrw(value) : formatUsd(value);
}

function formatMarketChange(value: number, isKorea: boolean): string {
  return isKorea ? formatKrwChange(value) : formatUsdChange(value);
}

function formatMarketCapUsd(millions: number | undefined): string {
  if (typeof millions !== 'number' || !Number.isFinite(millions) || millions <= 0) return '—';
  const usd = millions * 1_000_000;
  if (usd >= 1_000_000_000_000) return `$${(usd / 1_000_000_000_000).toFixed(2)}T`;
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(1)}B`;
  return `$${(usd / 1_000_000).toFixed(0)}M`;
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

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
    hero: {
      backgroundColor: theme.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      marginBottom: 14,
    },
    company: { fontSize: sf(26), fontWeight: '900', color: theme.text, marginBottom: 6 },
    companyMeta: { fontSize: sf(12), fontWeight: '800', color: theme.textMuted, marginBottom: 14 },
    companySkeleton: {
      width: '72%',
      height: 28,
      borderRadius: 8,
      backgroundColor: theme.bgElevated,
      marginBottom: 14,
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
      gap: 16,
      marginBottom: 8,
    },
    chartLabel: { fontSize: sf(11), fontWeight: '800', color: theme.textDim },
    chartValue: { fontSize: sf(12), fontWeight: '700', color: theme.textMuted },
    chartEmpty: { fontSize: sf(12), color: theme.textMuted, lineHeight: sf(18) },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 20,
      flexWrap: 'wrap',
    },
    price: { fontSize: sf(28), fontWeight: '900', color: theme.text },
    priceMeta: { alignItems: 'flex-end', gap: 6 },
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
    changeMetric: { fontSize: sf(13), fontWeight: '800' },
    heroMcap: {
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.textMuted,
      marginTop: 16,
      letterSpacing: 0.1,
    },
    section: { fontSize: sf(16), fontWeight: '800', color: theme.text, marginBottom: 14 },
    sectionCard: {
      backgroundColor: theme.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 16,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 14,
    },
    sectionLink: { color: theme.green, fontSize: sf(12), fontWeight: '900' },
    signalOverviewHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 20,
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    signalOverviewCopy: { flex: 1, minWidth: 0 },
    signalOverviewSub: { fontSize: sf(12), color: theme.textDim, fontWeight: '700', lineHeight: sf(18) },
    signalScoreBadge: {
      minWidth: 62,
      alignItems: 'center',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      paddingVertical: 10,
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
    signalStatGrid: { flexDirection: 'row', gap: 16, marginBottom: 14 },
    signalStat: {
      flex: 1,
      minWidth: 0,
      borderRadius: 8,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 9,
    },
    signalStatLabel: { fontSize: sf(10), fontWeight: '800', color: theme.textMuted, marginBottom: 5 },
    signalStatValue: { fontSize: sf(12), fontWeight: '900', color: theme.text },
    signalReasonLine: { fontSize: sf(12), fontWeight: '700', color: theme.textDim, lineHeight: sf(18) },
    actionRow: { flexDirection: 'row', gap: 16, marginTop: 14 },
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    actionBtnAlt: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      paddingVertical: 11,
      borderWidth: 1,
      backgroundColor: theme.bgElevated,
      borderColor: theme.border,
    },
    actionBtnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    actionBtnText: { fontSize: sf(13), fontWeight: '800', color: theme.green },
    actionBtnTextAlt: { color: theme.text },
    centeredLoadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    disclosureCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      padding: 12,
      marginBottom: 14,
    },
    disclosureMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginBottom: 8,
    },
    disclosureBadge: {
      color: theme.green,
      backgroundColor: theme.greenDim,
      borderColor: theme.greenBorder,
      borderWidth: 1,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 7,
      fontSize: sf(10),
      fontWeight: '900',
      overflow: 'hidden',
    },
    disclosureType: {
      flex: 1,
      minWidth: 0,
      color: theme.textMuted,
      fontSize: sf(11),
      fontWeight: '600',
    },
    disclosureTime: { color: theme.textDim, fontSize: ft.ff(11), fontWeight: ft.metaWeight },
    disclosureTitle: {
      color: theme.text,
      fontSize: ft.ff(13),
      lineHeight: ft.ff(19),
      fontWeight: ft.titleWeight,
    },
    disclosureSummary: {
      marginTop: 6,
      color: theme.textMuted,
      fontSize: ft.ff(11),
      lineHeight: ft.ff(16),
      fontWeight: ft.bodyWeight,
    },
    newsCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      padding: 12,
      marginBottom: 14,
    },
    newsMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 16,
      marginBottom: 8,
    },
    newsSource: { fontSize: ft.ff(11), fontWeight: ft.emphasisWeight, color: theme.textDim },
    newsTime: { fontSize: ft.ff(11), fontWeight: ft.metaWeight, color: theme.textMuted },
    newsTitle: {
      fontSize: ft.ff(13),
      lineHeight: ft.ff(19),
      color: theme.text,
      fontWeight: ft.bodyWeight,
      marginBottom: 4,
    },
    empty: { fontSize: sf(13), color: theme.textMuted },
    sourceFootnote: {
      fontSize: sf(11),
      lineHeight: sf(16),
      fontWeight: '500',
      color: theme.textMuted,
      marginTop: 16,
    },
    errorBox: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#FFD6DA',
      backgroundColor: theme.dangerDim,
      padding: 14,
    },
    errorText: { fontSize: sf(13), color: theme.danger, lineHeight: sf(20) },
    loadingWrap: {
      paddingVertical: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
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
    backgroundColor: 'rgba(25,31,40,0.08)',
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
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const quoteChange = useQuoteChangeColors();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<SignalApiStockProfile | null>(null);
  const [quote, setQuote] = useState<SignalApiMarketQuote | null>(null);
  const [candles, setCandles] = useState<SignalApiStockCandles | null>(null);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [signalNews, setSignalNews] = useState<SignalApiNewsItem[]>([]);
  const [disclosures, setDisclosures] = useState<SignalApiDisclosure[]>([]);
  const [watching, setWatching] = useState(false);
  const isKorea = useMemo(() => isKoreaSymbol(ticker), [ticker]);
  const displayPrice =
    typeof quote?.currentPrice === 'number' && Number.isFinite(quote.currentPrice)
      ? quote.currentPrice
      : null;
  const displayChange = typeof quote?.change === 'number' && Number.isFinite(quote.change) ? quote.change : null;
  const displayChangePercent =
    typeof quote?.changePercent === 'number' && Number.isFinite(quote.changePercent) ? quote.changePercent : null;
  const displayQuoteForColor = {
    change: displayChange ?? 0,
    changePercent: displayChangePercent ?? 0,
  };

  const load = useCallback(async () => {
    if (!ticker) {
      setError(t('symbolDetailErrorLoad'));
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
      setDisclosures([]);
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const [watchlist, nextProfile, mqRows, nextCandles, companyNews, disclosureRows] = await Promise.all([
        loadWatchlistSymbols(),
        fetchSignalStockProfile(ticker),
        fetchSignalMarketQuotes({ symbols: [ticker], limit: 1 }).catch(() => []),
        fetchSignalStockCandles(ticker, 'D', addDays(new Date(), -30), new Date()).catch(() => null),
        fetchCompanyNewsForDisplay(ticker, locale).catch(() => [] as SignalApiNewsItem[]),
        fetchSignalDisclosures({ symbol: ticker, limit: 5 }).then((result) => result.items).catch(() => []),
      ]);

      const row0 = mqRows[0];
      const nextQuote = row0 && signalMarketQuoteHasValidPrice(row0) ? row0 : null;

      const relatedRaw = companyNews;
      setWatching(watchlist.includes(ticker));
      setProfile(nextProfile);
      setQuote(nextQuote);
      setCandles(nextCandles);
      setSignalNews(relatedRaw);
      const translatedNews = relatedRaw.map((a) => signalNewsToNewsItem(a, locale));
      setNewsItems(translatedNews);
      setDisclosures(disclosureRows);

    } catch (e) {
      setError(formatSignalApiError(e, t, 'symbolDetailErrorLoad'));
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

  const chartColor = displayChange != null ? (displayChange >= 0 ? theme.green : '#E06D6D') : theme.green;


  const symbolVsSma20Pct = useMemo(() => {
    if (displayPrice == null || chartCloses.length < 20) return null;
    const last20 = chartCloses.slice(-20);
    const sma20 = last20.reduce((sum, close) => sum + close, 0) / last20.length;
    const last = Number(displayPrice);
    if (!Number.isFinite(sma20) || sma20 === 0 || !Number.isFinite(last)) return null;
    return ((last - sma20) / sma20) * 100;
  }, [chartCloses, displayPrice]);

  const symbolSignal = useMemo(
    () =>
      buildSignalScore({
        symbol: ticker,
        quote,
        news: signalNews,
        vsSmaPct: symbolVsSma20Pct,
      }),
    [signalNews, quote, symbolVsSma20Pct, ticker],
  );

  const chartRangeLabel = useMemo(() => {
    if (chartCloses.length < 2) return t('symbolDetailChartRange1M');
    return `${formatMarketPrice(chartCloses[0]!, isKorea)} → ${formatMarketPrice(chartCloses[chartCloses.length - 1]!, isKorea)}`;
  }, [chartCloses, isKorea, t]);

  const companyName = useMemo(
    () =>
      normalizeCompanyName(profile?.name, ticker) ??
      normalizeCompanyName(quote?.name ?? undefined, ticker),
    [profile?.name, quote?.name, ticker],
  );
  const displayCompanyName = companyName ?? (isKorea ? ticker : t('symbolDetailCompanyUnknown'));


  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: companyName || ticker || t('screenSymbolDetail') }} />
      {loading ? (
        <View style={styles.centeredLoadingWrap}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : (
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: stackScreenScrollBottomPadding(insets.bottom) }]}
        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.company}>{displayCompanyName}</Text>
          {isKorea && ticker ? <Text style={styles.companyMeta}>{ticker}</Text> : null}
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {displayPrice != null ? formatMarketPrice(displayPrice, isKorea) : t('symbolDetailPriceUnavailable')}
            </Text>
            <View style={styles.priceMeta}>
              {displayChange != null || displayChangePercent != null ? (
                <>
                  <Text style={[styles.changeMetric, quoteChange.styleForQuote(displayQuoteForColor)]}>
                    {formatMarketChange(Number(displayChange ?? 0), isKorea)}
                  </Text>
                  <Text style={[styles.changeMetric, quoteChange.styleForQuote(displayQuoteForColor)]}>
                    {formatPct(Number(displayChangePercent ?? 0))}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
          {!isKorea && formatMarketCapUsd(profile?.marketCapitalization) !== '—' ? (
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
            <Pressable
              onPress={() => void (isKorea ? openNaverFinanceStock(ticker) : openYahooFinanceQuote(ticker, 'stock'))}
              style={styles.actionBtn}>
              <View style={styles.actionBtnRow}>
                <FontAwesome name="line-chart" size={12} color={theme.green} />
                <Text style={styles.actionBtnText}>{isKorea ? t('quotesNaverShort') : t('symbolDetailYahooOpen')}</Text>
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
              <Text style={[styles.signalStatValue, quote ? quoteChange.styleForQuote(quote) : null]}>
                {quote ? formatPct(Number(quote.changePercent ?? 0)) : '—'}
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

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.section}>{t('symbolDetailSectionDisclosures')}</Text>
            {disclosures.length > 0 ? (
              <Pressable onPress={() => router.push(`/disclosures?symbol=${encodeURIComponent(ticker)}` as Href)} hitSlop={10}>
                <Text style={styles.sectionLink}>{t('symbolDetailDisclosuresAll')}</Text>
              </Pressable>
            ) : null}
          </View>
          {disclosures.length > 0 ? (
            disclosures.slice(0, 5).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push(`/disclosures/${encodeURIComponent(item.id)}` as Href)}
                style={styles.disclosureCard}>
                <View style={styles.disclosureMeta}>
                  <Text style={styles.disclosureBadge}>{item.provider === 'sec' ? 'SEC' : item.provider === 'dart' ? 'DART' : '공시'}</Text>
                  {item.formType ? <Text style={styles.disclosureType} numberOfLines={1}>{item.formType}</Text> : null}
                  <Text style={styles.disclosureTime}>
                    {formatLocalInstantDate(item.filedAt, locale, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
                <Text style={styles.disclosureTitle} numberOfLines={2}>{item.title}</Text>
                {item.summary ? <Text style={styles.disclosureSummary} numberOfLines={2}>{item.summary}</Text> : null}
              </Pressable>
            ))
          ) : (
            <Text style={styles.empty}>{t('symbolDetailNoDisclosures')}</Text>
          )}
        </View>

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

      </ScrollView>
      )}
    </SafeAreaView>
  );
}
