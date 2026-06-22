/**
 * 종목 상세 패널 (재사용 가능).
 * - app/symbol/[ticker].tsx 의 전체 화면 버전에서 추출
 * - iPad 2-패널 레이아웃(quotes)에서 우측 디테일로 재사용
 * - ticker prop 변경 시 자동으로 데이터 재조회
 */
import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
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
import type { NewsItem } from '@/types/signal';
import { hasSignalApi } from '@/services/env';
import { addDays, formatLocalInstantDate } from '@/utils/date';
import { signalReasonLabel } from '@/utils/signalDisplay';
import { openNaverFinanceStock } from '@/utils/naverFinance';
import { openYahooFinanceQuote } from '@/utils/yahooFinance';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type SparkPoint = { x: number; y: number };

// ─────────────────────────────────────────────
// Helpers (same as symbol/[ticker].tsx)
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// Sparkline
// ─────────────────────────────────────────────

function Sparkline({ closes, color }: { closes: number[]; color: string }) {
  const [width, setWidth] = useState(0);
  const height = 68;
  const points = useMemo(() => buildSparkPoints(closes, width, height - 6), [closes, width]);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = Math.max(0, event.nativeEvent.layout.width - 2);
    setWidth((prev) => (Math.abs(prev - nextWidth) < 1 ? prev : nextWidth));
  }, []);

  return (
    <View onLayout={onLayout} style={sparkStyles.sparkWrap}>
      <View style={sparkStyles.sparkGrid} />
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
              sparkStyles.sparkSeg,
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
    </View>
  );
}

const sparkStyles = StyleSheet.create({
  sparkWrap: { height: 68, position: 'relative', overflow: 'hidden' },
  sparkGrid: {
    ...StyleSheet.absoluteFill,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  sparkSeg: {
    position: 'absolute',
    height: 2,
    transformOrigin: '0% 50%',
  },
});

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    root: { flex: 1 },
    centeredLoadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { paddingHorizontal: 16, paddingTop: 12 },
    hero: {
      borderRadius: 16,
      backgroundColor: theme.bgElevated,
      padding: 18,
      marginBottom: 12,
    },
    company: {
      fontSize: sf(17),
      fontWeight: '800',
      color: theme.text,
      marginBottom: 2,
    },
    companyMeta: { fontSize: sf(11), fontWeight: '600', color: theme.textMuted, marginBottom: 6 },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap',
    },
    price: { fontSize: sf(28), fontWeight: '900', color: theme.text },
    priceMeta: { alignItems: 'flex-end', gap: 4 },
    changeMetric: { fontSize: sf(13), fontWeight: '800' },
    heroMcap: {
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.textMuted,
      marginTop: 10,
      letterSpacing: 0.1,
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
    actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
    actionBtn: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.greenBorder,
    },
    actionBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionBtnText: { fontSize: sf(12), fontWeight: '700', color: theme.green },
    actionBtnAlt: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    actionBtnTextAlt: { color: theme.textMuted },
    errorBox: {
      borderRadius: 12,
      backgroundColor: theme.bgElevated,
      padding: 14,
      marginBottom: 12,
    },
    errorText: { fontSize: sf(13), color: theme.textMuted, lineHeight: sf(20) },
    sectionCard: {
      borderRadius: 16,
      backgroundColor: theme.bgElevated,
      padding: 18,
      marginBottom: 12,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    section: { fontSize: sf(16), fontWeight: '800', color: theme.text, marginBottom: 0 },
    sectionLink: { fontSize: sf(13), fontWeight: '700', color: theme.green },
    signalOverviewHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    signalOverviewCopy: { flex: 1 },
    signalOverviewSub: { fontSize: sf(12), color: theme.textMuted, marginTop: 4 },
    signalScoreBadge: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      minWidth: 56,
    },
    signalScoreBadgeHot: { backgroundColor: '#3D1414' },
    signalScoreBadgeQuiet: { backgroundColor: theme.bgElevated },
    signalScoreNum: { fontSize: sf(22), fontWeight: '900', color: theme.green },
    signalScoreNumHot: { color: '#FF6B6B' },
    signalScoreNumQuiet: { color: theme.textMuted },
    signalScoreLabel: { fontSize: sf(10), fontWeight: '700', color: theme.green, marginTop: 1 },
    signalScoreLabelHot: { color: '#FF6B6B' },
    signalStatGrid: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 10,
    },
    signalStat: { flex: 1, alignItems: 'center' },
    signalStatLabel: { fontSize: sf(11), color: theme.textDim, fontWeight: '600', marginBottom: 3 },
    signalStatValue: { fontSize: sf(16), fontWeight: '800', color: theme.text },
    signalReasonLine: { fontSize: sf(11), color: theme.textMuted, lineHeight: sf(16) },
    disclosureCard: {
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    disclosureMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    disclosureBadge: {
      fontSize: sf(10),
      fontWeight: '800',
      color: theme.green,
      backgroundColor: theme.greenDim,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
    },
    disclosureType: { fontSize: sf(11), color: theme.textMuted, fontWeight: '600', flex: 1 },
    disclosureTime: { fontSize: sf(11), color: theme.textDim },
    disclosureTitle: { fontSize: sf(13), fontWeight: '700', color: theme.text, lineHeight: sf(19) },
    disclosureSummary: { fontSize: sf(11), color: theme.textMuted, lineHeight: sf(16), marginTop: 3 },
    newsCard: {
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    newsMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
    newsSource: { fontSize: sf(11), fontWeight: '700', color: theme.green },
    newsTime: { fontSize: sf(11), color: theme.textDim },
    newsTitle: { fontSize: sf(13), fontWeight: '600', color: theme.text, lineHeight: sf(19) },
    sourceFootnote: { fontSize: sf(10), color: theme.textDim, marginTop: 8, lineHeight: sf(15) },
    empty: { fontSize: sf(13), color: theme.textMuted, lineHeight: sf(20), paddingVertical: 6 },
  });
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

type Props = {
  ticker: string;
  /** 하단 여백 (기본 24) */
  bottomPad?: number;
};

export function SymbolDetailPane({ ticker, bottomPad = 24 }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const router = useRouter();
  const quoteChange = useQuoteChangeColors();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

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
  const displayChange =
    typeof quote?.change === 'number' && Number.isFinite(quote.change) ? quote.change : null;
  const displayChangePercent =
    typeof quote?.changePercent === 'number' && Number.isFinite(quote.changePercent)
      ? quote.changePercent
      : null;
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
      const [watchlist, nextProfile, mqRows, nextCandles, companyNews, disclosureRows] =
        await Promise.all([
          loadWatchlistSymbols(),
          fetchSignalStockProfile(ticker),
          fetchSignalMarketQuotes({ symbols: [ticker], limit: 1 }).catch(() => []),
          fetchSignalStockCandles(ticker, 'D', addDays(new Date(), -30), new Date()).catch(
            () => null,
          ),
          fetchCompanyNewsForDisplay(ticker, locale).catch(() => [] as SignalApiNewsItem[]),
          fetchSignalDisclosures({ symbol: ticker, limit: 5 })
            .then((result) => result.items)
            .catch(() => []),
        ]);

      const row0 = mqRows[0];
      const nextQuote = row0 && signalMarketQuoteHasValidPrice(row0) ? row0 : null;
      setWatching(watchlist.includes(ticker));
      setProfile(nextProfile);
      setQuote(nextQuote);
      setCandles(nextCandles);
      setSignalNews(companyNews);
      setNewsItems(companyNews.map((a) => signalNewsToNewsItem(a, locale)));
      setDisclosures(disclosureRows);
    } catch (e) {
      setError(formatSignalApiError(e, t, 'symbolDetailErrorLoad'));
    } finally {
      setLoading(false);
    }
  }, [locale, ticker, t]);

  // ticker가 바뀌면 즉시 재조회
  useEffect(() => {
    setLoading(true);
    setError(null);
    setProfile(null);
    setQuote(null);
    setCandles(null);
    setNewsItems([]);
    setSignalNews([]);
    setDisclosures([]);
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
    const next = current.includes(ticker)
      ? current.filter((item) => item !== ticker)
      : [...current, ticker];
    await saveWatchlistSymbols(next);
    setWatching(next.includes(ticker));
  }, [ticker]);

  const chartCloses = useMemo(() => {
    const closes = candles?.c?.filter((value) => Number.isFinite(value)) ?? [];
    return closes.slice(-24);
  }, [candles]);

  const chartColor =
    displayChange != null ? (displayChange >= 0 ? theme.green : '#E06D6D') : theme.green;

  const symbolVsSma20Pct = useMemo(() => {
    if (displayPrice == null || chartCloses.length < 20) return null;
    const last20 = chartCloses.slice(-20);
    const sma20 = last20.reduce((sum, close) => sum + close, 0) / last20.length;
    const last = Number(displayPrice);
    if (!Number.isFinite(sma20) || sma20 === 0 || !Number.isFinite(last)) return null;
    return ((last - sma20) / sma20) * 100;
  }, [chartCloses, displayPrice]);

  const symbolSignal = useMemo(
    () => buildSignalScore({ symbol: ticker, quote, news: signalNews, vsSmaPct: symbolVsSma20Pct }),
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
    <View style={styles.root}>
      {loading ? (
        <View style={styles.centeredLoadingWrap}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
          refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Text style={styles.company}>{displayCompanyName}</Text>
            {isKorea && ticker ? (
              <Text style={styles.companyMeta}>{ticker}</Text>
            ) : null}
            <View style={styles.priceRow}>
              <Text style={styles.price}>
                {displayPrice != null
                  ? formatMarketPrice(displayPrice, isKorea)
                  : t('symbolDetailPriceUnavailable')}
              </Text>
              <View style={styles.priceMeta}>
                {displayChange != null || displayChangePercent != null ? (
                  <>
                    <Text
                      style={[
                        styles.changeMetric,
                        quoteChange.styleForQuote(displayQuoteForColor),
                      ]}>
                      {formatMarketChange(Number(displayChange ?? 0), isKorea)}
                    </Text>
                    <Text
                      style={[
                        styles.changeMetric,
                        quoteChange.styleForQuote(displayQuoteForColor),
                      ]}>
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
                onPress={() =>
                  void (isKorea
                    ? openNaverFinanceStock(ticker)
                    : openYahooFinanceQuote(ticker, 'stock'))
                }
                style={styles.actionBtn}>
                <View style={styles.actionBtnRow}>
                  <FontAwesome name="line-chart" size={12} color={theme.green} />
                  <Text style={styles.actionBtnText}>
                    {isKorea ? t('quotesNaverShort') : t('symbolDetailYahooOpen')}
                  </Text>
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
                <Text
                  style={[
                    styles.signalStatValue,
                    quote ? quoteChange.styleForQuote(quote) : null,
                  ]}>
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
                <Pressable
                  onPress={() =>
                    router.push(
                      `/disclosures?symbol=${encodeURIComponent(ticker)}` as Href,
                    )
                  }
                  hitSlop={10}>
                  <Text style={styles.sectionLink}>{t('symbolDetailDisclosuresAll')}</Text>
                </Pressable>
              ) : null}
            </View>
            {disclosures.length > 0 ? (
              disclosures.slice(0, 5).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    router.push(`/disclosures/${encodeURIComponent(item.id)}` as Href)
                  }
                  style={styles.disclosureCard}>
                  <View style={styles.disclosureMeta}>
                    <Text style={styles.disclosureBadge}>
                      {item.provider === 'sec'
                        ? 'SEC'
                        : item.provider === 'dart'
                          ? 'DART'
                          : '공시'}
                    </Text>
                    {item.formType ? (
                      <Text style={styles.disclosureType} numberOfLines={1}>
                        {item.formType}
                      </Text>
                    ) : null}
                    <Text style={styles.disclosureTime}>
                      {formatLocalInstantDate(item.filedAt, locale, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  <Text style={styles.disclosureTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.summary ? (
                    <Text style={styles.disclosureSummary} numberOfLines={2}>
                      {item.summary}
                    </Text>
                  ) : null}
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
                  onPress={() => void WebBrowser.openBrowserAsync(item.url)}
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
    </View>
  );
}
