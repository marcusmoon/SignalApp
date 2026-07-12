/**
 * 종목 상세 패널 (재사용 가능).
 * - app/symbol/[ticker].tsx 의 전체 화면 버전에서 추출
 * - iPad 2-패널 레이아웃(quotes)에서 우측 디테일로 재사용
 * - ticker prop 변경 시 자동으로 데이터 재조회
 */
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import { HomeSectionHeader } from '@/components/signal/HomeSectionHeader';
import { NewsCard } from '@/components/signal/NewsCard';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { SymbolLogo } from '@/components/signal/SymbolLogo';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { groupedFeedRowShell } from '@/components/signal/groupedFeedList';
import {
  COMFORT_GAP_LG,
  COMFORT_GAP_PAGE,
  COMFORT_GAP_SM,
  COMFORT_PADDING_ROW_V,
} from '@/constants/comfortDensity';
import { FEED_BADGE_PX } from '@/constants/feedTypography';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD, UI_RADIUS_CARD_LG } from '@/constants/uiCornerRadius';
import { useQuoteChangeColors } from '@/hooks/useQuoteChangeColors';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
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
import { loadWatchlistSymbols, saveWatchlistSymbols } from '@/services/quoteWatchlist';
import type { NewsItem } from '@/types/signal';
import { hasSignalApi } from '@/services/env';
import { addDays, formatFeedItemTimeLabel } from '@/utils/date';
import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';
import { buildSymbolExternalLinks } from '@/utils/symbolExternalLinks';

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

function disclosureProviderLabel(item: SignalApiDisclosure): string {
  if (item.provider === 'sec') return 'SEC';
  if (item.provider === 'dart') return 'DART';
  return String(item.provider || '—').toUpperCase();
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

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    root: { flex: 1 },
    centeredLoadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: COMFORT_GAP_PAGE,
    },
    heroCard: {
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 18,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    },
    heroHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    heroTitleCol: {
      flex: 1,
      minWidth: 0,
    },
    company: {
      fontSize: sf(17),
      fontWeight: '800',
      color: theme.text,
      marginBottom: 2,
    },
    companyMeta: { fontSize: sf(11), fontWeight: '600', color: theme.textMuted, marginBottom: 0 },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 20,
      flexWrap: 'wrap',
    },
    price: { fontSize: sf(28), fontWeight: '900', color: theme.text },
    priceMeta: { alignItems: 'flex-end', gap: 6 },
    changeMetric: { fontSize: sf(13), fontWeight: '800' },
    heroMcap: {
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.textMuted,
      marginTop: 16,
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
      gap: 16,
      marginBottom: 8,
    },
    chartLabel: { fontSize: sf(11), fontWeight: '800', color: theme.textDim },
    chartValue: { fontSize: sf(12), fontWeight: '700', color: theme.textMuted },
    chartEmpty: { fontSize: sf(12), color: theme.textMuted, lineHeight: sf(18) },
    heroActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
    },
    watchBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    watchBtnActive: {
      backgroundColor: theme.greenDim,
      borderColor: theme.greenBorder,
    },
    linkChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    linkChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    linkChipPressed: {
      opacity: 0.78,
      backgroundColor: theme.greenDim,
    },
    linkChipText: {
      fontSize: sf(11),
      lineHeight: sf(14),
      fontWeight: '700',
      color: theme.green,
    },
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
      fontWeight: '800',
      color: theme.danger,
    },
    section: {
      gap: COMFORT_GAP_LG,
    },
    feedCard: {
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 12,
      paddingVertical: COMFORT_PADDING_ROW_V,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    },
    feedCardCompact: {
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    issueGroupList: {
      gap: 0,
    },
    emptyCard: {
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 12,
    },
    emptyText: {
      fontSize: ft.ff(13),
      lineHeight: sf(19),
      fontWeight: ft.bodyWeight,
      color: theme.textDim,
    },
    disclosurePillRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: COMFORT_GAP_SM,
    },
    disclosureProviderPill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 1,
      backgroundColor: theme.warningDim,
      color: theme.warning,
      fontSize: ft.ff(FEED_BADGE_PX),
      lineHeight: sf(13),
      fontWeight: ft.emphasisWeight,
    },
    disclosureFormPill: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 6,
      paddingVertical: 1,
      backgroundColor: theme.bgElevated,
      color: theme.textMuted,
      fontSize: ft.ff(FEED_BADGE_PX),
      lineHeight: sf(13),
      fontWeight: ft.emphasisWeight,
      maxWidth: 120,
    },
  });
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

type Props = {
  ticker: string;
  /** 하단 여백 (기본 24) */
  bottomPad?: number;
  /** 네비게이션 헤더 등에 표시할 회사명 전달 */
  onDisplayNameResolved?: (name: string) => void;
};

export function SymbolDetailPane({ ticker, bottomPad = 24, onDisplayNameResolved }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const router = useRouter();
  const quoteChange = useQuoteChangeColors();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<SignalApiStockProfile | null>(null);
  const [quote, setQuote] = useState<SignalApiMarketQuote | null>(null);
  const [candles, setCandles] = useState<SignalApiStockCandles | null>(null);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [disclosures, setDisclosures] = useState<SignalApiDisclosure[]>([]);
  const [watching, setWatching] = useState(false);

  const isKorea = useMemo(() => isKoreaSymbol(ticker), [ticker]);
  const externalLinks = useMemo(
    () =>
      buildSymbolExternalLinks(ticker, {
        yahooSymbol: quote?.regularSession?.yahooSymbol,
      }),
    [quote?.regularSession?.yahooSymbol, ticker],
  );
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
      setNewsItems(companyNews.map((a) => signalNewsToNewsItem(a, locale)));
      setDisclosures(disclosureRows);
    } catch (e) {
      setError(formatSignalApiError(e, t, 'symbolDetailErrorLoad'));
    } finally {
      setLoading(false);
    }
  }, [locale, ticker, t]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setProfile(null);
    setQuote(null);
    setCandles(null);
    setNewsItems([]);
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

  useEffect(() => {
    if (loading || !onDisplayNameResolved) return;
    onDisplayNameResolved(displayCompanyName);
  }, [displayCompanyName, loading, onDisplayNameResolved]);

  const disclosureRows = disclosures.slice(0, 5);
  const openAllDisclosures = useCallback(() => {
    router.push(`/disclosures?symbol=${encodeURIComponent(ticker)}` as Href);
  }, [router, ticker]);

  return (
    <View style={styles.root}>
      {loading ? (
        <View style={styles.centeredLoadingWrap}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : (
        <WebWheelScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
          refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.heroHead}>
              <SymbolLogo symbol={ticker} size={40} />
              <View style={styles.heroTitleCol}>
                <Text style={styles.company}>{displayCompanyName}</Text>
                {isKorea && ticker ? (
                  <Text style={styles.companyMeta}>{ticker}</Text>
                ) : null}
              </View>
              <View style={styles.heroActions}>
                <Pressable
                  onPress={() => void toggleWatch()}
                  style={({ pressed }) => [
                    styles.watchBtn,
                    watching && styles.watchBtnActive,
                    pressed && { opacity: 0.8 },
                  ]}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={
                    watching ? t('symbolDetailWatchRemove') : t('symbolDetailWatchAdd')
                  }>
                  <FontAwesome
                    name={watching ? 'star' : 'star-o'}
                    size={14}
                    color={watching ? theme.green : theme.textMuted}
                  />
                </Pressable>
              </View>
            </View>
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
          </View>

          {externalLinks.length > 0 ? (
            <View style={styles.section}>
              <HomeSectionHeader title={t('symbolDetailLinksTitle')} showChevron={false} />
              <View style={styles.feedCard}>
                <View style={styles.linkChipRow}>
                  {externalLinks.map((link) => (
                    <Pressable
                      key={link.id}
                      onPress={() =>
                        void openConfiguredExternalLink({
                          webUrl: link.url,
                          appLaunchUrls: link.appLaunchUrls,
                          openInAppBrowser: link.openInAppBrowser,
                        })
                      }
                      style={({ pressed }) => [styles.linkChip, pressed && styles.linkChipPressed]}
                      accessibilityRole="link"
                      accessibilityLabel={t(link.labelKey)}>
                      <Text style={styles.linkChipText}>{t(link.labelKey)}</Text>
                      <FontAwesome name="external-link" size={9} color={theme.green} />
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <HomeSectionHeader title={t('tabNews')} showChevron={false} />
            {newsItems.length > 0 ? (
              newsItems.map((item, index) => {
                const edges = {
                  isFirst: index === 0,
                  isLast: index === newsItems.length - 1,
                };
                return (
                  <View key={item.id} style={groupedFeedRowShell(theme, edges)}>
                    <NewsCard
                      layout="grouped"
                      item={item}
                      compactMeta
                      maxHashtagsToShow={0}
                    />
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t('symbolDetailNoNews')}</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <HomeSectionHeader
              title={t('screenDisclosures')}
              onPress={disclosureRows.length > 0 ? openAllDisclosures : undefined}
              accessibilityLabel={t('symbolDetailDisclosuresAll')}
              showChevron={disclosureRows.length > 0}
            />
            {disclosureRows.length > 0 ? (
              <View style={[styles.feedCard, styles.feedCardCompact]}>
                <View style={styles.issueGroupList}>
                  {disclosureRows.map((item, index) => (
                    <HomeDigestFeedRow
                      key={item.id}
                      title={item.title}
                      titleLines={2}
                      summary={item.summary}
                      summaryLines={2}
                      timeLabel={formatFeedItemTimeLabel(item.filedAt, locale)}
                      badges={
                        <View style={styles.disclosurePillRow}>
                          <Text style={styles.disclosureProviderPill}>
                            {disclosureProviderLabel(item)}
                          </Text>
                          {item.formType ? (
                            <Text style={styles.disclosureFormPill} numberOfLines={1}>
                              {item.formType}
                            </Text>
                          ) : null}
                        </View>
                      }
                      bordered={index < disclosureRows.length - 1}
                      onPress={() =>
                        router.push(`/disclosures/${encodeURIComponent(item.id)}` as Href)
                      }
                    />
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t('symbolDetailNoDisclosures')}</Text>
              </View>
            )}
          </View>
        </WebWheelScrollView>
      )}
    </View>
  );
}
