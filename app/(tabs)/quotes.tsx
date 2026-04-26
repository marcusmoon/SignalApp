import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  Alert,
  InteractionManager,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { SCROLL_CONTENT_LOADING_STYLE, SCROLL_LOADING_BODY_STYLE } from '@/constants/scrollLoadingLayout';
import { TAB_BAR_FLOAT_MARGIN_BOTTOM } from '@/constants/tabBar';
import {
  SEGMENT_TAB_ACTIVE_TEXT,
  SEGMENT_TAB_BACKGROUND,
  SEGMENT_TAB_BTN_PADDING_V,
  SEGMENT_TAB_BTN_RADIUS,
  SEGMENT_TAB_FONT_SIZE,
  SEGMENT_TAB_FONT_WEIGHT,
  SEGMENT_TAB_GAP,
  SEGMENT_TAB_LINE_HEIGHT,
  SEGMENT_TAB_OUTER_RADIUS,
  SEGMENT_TAB_PADDING,
} from '@/constants/segmentTabBar';
import type { AppTheme } from '@/constants/theme';
import { useResetRefreshingOnTabBlur, useTabScreenLoadingRecovery } from '@/hooks';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { loadCacheFeaturePrefs } from '@/services/cacheFeaturePreferences';
import { fetchTopCoinsByMarketCapUsd } from '@/integrations/coingecko';
import {
  fetchSignalCoins,
  fetchSignalMarketList,
  fetchSignalMarketQuotes,
  type SignalApiCoinMarket,
  type SignalApiMarketQuote,
} from '@/integrations/signal-api';
import { hasFinnhub, useSignalApiBackend } from '@/services/env';
import {
  type FinnhubQuote,
  POPULAR_SYMBOLS_ORDERED,
  fetchProfile2,
  fetchQuote,
  fetchQuotesForSymbols,
  finnhubQuoteHasValidPrice,
  getSymbolsSortedByMarketCap,
} from '@/integrations/finnhub';
import { loadQuotesListLimits } from '@/services/quotesListLimitsPreference';
import {
  DEFAULT_QUOTES_SEGMENT_ORDER,
  loadQuotesSegmentOrder,
  type QuoteSegmentKey,
} from '@/services/quotesSegmentOrderPreference';
import {
  buildQuotesCacheKey,
  peekMcapSymbolsOrder,
  peekQuotes,
  QUOTES_CACHE_TTL_MS,
  QUOTES_POLL_INTERVAL_MS,
  storeMcapSymbolsOrder,
  storeQuotes,
  type QuoteCacheRow,
} from '@/integrations/finnhub/quotesCache';
import {
  isValidUsTicker,
  loadWatchlistSymbols,
  resetWatchlistToDefaults,
  saveWatchlistSymbols,
} from '@/services/quoteWatchlist';
import { openYahooFinanceQuote } from '@/utils/yahooFinance';
import type { MessageId } from '@/locales/messages';

const POLL_MS = QUOTES_POLL_INTERVAL_MS;

const QUOTE_SEGMENT_LABEL: Record<QuoteSegmentKey, MessageId> = {
  watch: 'quotesSegmentWatch',
  popular: 'quotesSegmentPopular',
  mcap: 'quotesSegmentMcap',
  coin: 'quotesSegmentCoin',
};

type Row = QuoteCacheRow;

/** USD 금액 본문 (부호 없음, 0 이상) */
function formatUsdBody(abs: number): string {
  if (!Number.isFinite(abs) || abs < 0) return '—';
  if (abs >= 1000) return abs.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (abs >= 1) return abs.toFixed(2);
  if (abs >= 0.0001) return abs.toFixed(6);
  return abs.toFixed(8);
}

/** 절대 가격·참고가 (예: $123.45) */
function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `$${formatUsdBody(Math.abs(n))}`;
}

/** 전일 대비 등 부호 있는 달러 변동 (예: +$1.23, -$0.45) */
function formatUsdChange(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '$0.00';
  const sign = n > 0 ? '+' : '-';
  return `${sign}$${formatUsdBody(Math.abs(n))}`;
}

/** Finnhub 일부 응답에서 `dp` 누락 가능 — `toFixed` 직접 호출 금지 */
function formatQuoteDpPct(dp: unknown): string {
  if (!Number.isFinite(dp)) return '—';
  const p = dp as number;
  return `${p >= 0 ? '+' : ''}${p.toFixed(2)}%`;
}

function quoteRowChangeUp(q: { d?: unknown; dp?: unknown }): boolean {
  const d = Number(q.d);
  if (Number.isFinite(d)) return d >= 0;
  const dp = Number(q.dp);
  if (Number.isFinite(dp)) return dp >= 0;
  return true;
}

function mapCoinToFinnhubQuote(price: number, change24h: number, pct24h: number): FinnhubQuote {
  return {
    c: price,
    d: change24h,
    dp: pct24h,
    pc: price - change24h,
    h: 0,
    l: 0,
    o: 0,
    t: 0,
  };
}

function mapSignalQuoteToRow(item: SignalApiMarketQuote): Row {
  const quoteTimeMs = item.quoteTime ? new Date(item.quoteTime).getTime() : NaN;
  return {
    symbol: item.symbol,
    name: item.name || undefined,
    quote:
      typeof item.currentPrice === 'number'
        ? {
            c: item.currentPrice,
            d: item.change ?? 0,
            dp: item.changePercent ?? 0,
            h: item.high ?? 0,
            l: item.low ?? 0,
            o: item.open ?? 0,
            pc: item.previousClose ?? item.currentPrice,
            t: Number.isFinite(quoteTimeMs) ? Math.floor(quoteTimeMs / 1000) : 0,
          }
        : null,
  };
}

function mapSignalCoinToRow(item: SignalApiCoinMarket): Row {
  const price = item.currentPrice;
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    return { symbol: item.symbol || '—', name: item.name, quote: null };
  }
  return {
    symbol: item.symbol,
    name: item.name,
    quote: mapCoinToFinnhubQuote(price, item.change24h ?? 0, item.changePercent24h ?? 0),
  };
}

function applyQuoteOrder(rows: Row[], symbols: readonly string[]): Row[] {
  const bySymbol = new Map(rows.map((row) => [row.symbol.trim().toUpperCase(), row]));
  return symbols.map((symbol) => bySymbol.get(symbol.trim().toUpperCase()) || {
    symbol,
    quote: null,
    error: 'NO_SERVER_QUOTE',
  });
}

export default function QuotesScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [segment, setSegment] = useState<QuoteSegmentKey>('watch');
  const [segmentOrder, setSegmentOrder] = useState<QuoteSegmentKey[]>(DEFAULT_QUOTES_SEGMENT_ORDER);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const rowsRef = useRef<Row[]>([]);
  rowsRef.current = rows;
  useTabScreenLoadingRecovery(rows, setLoading);
  /** 다음 자동 갱신(캐시 만료 또는 폴링) 예상 시각(ms) */
  const [nextRefreshAtMs, setNextRefreshAtMs] = useState<number | null>(null);
  /** 남은 초 표시가 줄어들게 함 */
  const [countdownTick, setCountdownTick] = useState(0);
  const [draftTicker, setDraftTicker] = useState('');
  const shouldUseSignalApi = useSignalApiBackend();

  useEffect(() => {
    if (nextRefreshAtMs == null) return;
    const id = setInterval(() => setCountdownTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [nextRefreshAtMs]);

  const nextRefreshLine = useMemo(() => {
    if (nextRefreshAtMs == null) return '';
    const seconds = Math.max(0, Math.ceil((nextRefreshAtMs - Date.now()) / 1000));
    try {
      return t('quotesNextRefresh', { seconds: String(seconds) });
    } catch {
      return '';
    }
  }, [nextRefreshAtMs, countdownTick, t]);

  const ttlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadRef = useRef<(forceRefresh?: boolean) => Promise<void>>(async () => {});

  const clearTtlTimer = useCallback(() => {
    if (ttlTimerRef.current) {
      clearTimeout(ttlTimerRef.current);
      ttlTimerRef.current = null;
    }
  }, []);

  /** 캐시 TTL 만료 시점에 시세만 네트워크로 다시 받기 */
  const scheduleRefreshAtCacheExpiry = useCallback((expiresAtMs: number) => {
    clearTtlTimer();
    const delay = Math.max(0, expiresAtMs - Date.now());
    ttlTimerRef.current = setTimeout(() => {
      ttlTimerRef.current = null;
      void loadRef.current(true);
    }, delay);
  }, [clearTtlTimer]);

  const load = useCallback(async (forceRefresh?: boolean) => {
    clearTtlTimer();
    setError(null);
    const { quotesEnabled } = await loadCacheFeaturePrefs();
    const limits = await loadQuotesListLimits();

    if (segment === 'coin') {
      const cacheKey = buildQuotesCacheKey('coin', [], limits.coinMax);
      if (!shouldUseSignalApi && quotesEnabled && !forceRefresh) {
        const hit = peekQuotes(cacheKey);
        if (hit) {
          setRows(hit.rows);
          setNextRefreshAtMs(hit.expiresAtMs);
          scheduleRefreshAtCacheExpiry(hit.expiresAtMs);
          return;
        }
      }
      if (shouldUseSignalApi) {
        const list = (await fetchSignalCoins({ pageSize: limits.coinMax })).slice(0, limits.coinMax).map(mapSignalCoinToRow);
        setRows(list);
        setNextRefreshAtMs(Date.now() + POLL_MS);
        return;
      }
      try {
        const coins = await fetchTopCoinsByMarketCapUsd(limits.coinMax);
        const list: Row[] = coins.map((c) => {
          const sym = String(c.symbol ?? '')
            .trim()
            .toUpperCase();
          const price =
            typeof c.current_price === 'number' && Number.isFinite(c.current_price) ? c.current_price : null;
          if (price == null) {
            return { symbol: sym || '—', name: c.name, quote: null, error: t('quotesErrorNoPrice') };
          }
          const d24 = typeof c.price_change_24h === 'number' ? c.price_change_24h : 0;
          const dp24 = typeof c.price_change_percentage_24h === 'number' ? c.price_change_percentage_24h : 0;
          return {
            symbol: sym,
            name: c.name,
            quote: mapCoinToFinnhubQuote(price, d24, dp24),
          };
        });
        setRows(list);
        if (quotesEnabled) {
          const nextAt = Date.now() + QUOTES_CACHE_TTL_MS;
          storeQuotes(cacheKey, list);
          setNextRefreshAtMs(nextAt);
          scheduleRefreshAtCacheExpiry(nextAt);
        } else {
          setNextRefreshAtMs(Date.now() + POLL_MS);
        }
      } catch (e) {
        setRows([]);
        setNextRefreshAtMs(null);
        setError(e instanceof Error ? e.message : t('quotesErrorLoadCoin'));
      }
      return;
    }

    if (!shouldUseSignalApi && !hasFinnhub()) {
      setRows([]);
      setNextRefreshAtMs(null);
      setError(t('feedErrorToken'));
      return;
    }

    let symbols: string[] = [];
    if (segment === 'watch') {
      symbols = await loadWatchlistSymbols();
    } else if (segment === 'popular') {
      if (shouldUseSignalApi) {
        try {
          const list = await fetchSignalMarketList('popular_symbols');
          symbols = list.symbols.slice(0, limits.popularMax);
        } catch {
          symbols = [...POPULAR_SYMBOLS_ORDERED].slice(0, limits.popularMax);
        }
      } else {
        symbols = [...POPULAR_SYMBOLS_ORDERED].slice(0, limits.popularMax);
      }
    } else {
      // Market-cap segment:
      // - signal-api backend: server already produces mcap quotes; don't call Finnhub directly.
      // - direct backend: keep existing local ordering (profile2 market cap).
      if (!shouldUseSignalApi) {
        const cachedOrder = !forceRefresh ? peekMcapSymbolsOrder(limits.mcapMax) : null;
        if (cachedOrder && cachedOrder.length > 0) {
          symbols = cachedOrder;
        } else {
          symbols = await getSymbolsSortedByMarketCap(undefined, limits.mcapMax);
          if (symbols.length > 0) {
            storeMcapSymbolsOrder(limits.mcapMax, symbols);
          }
        }
      }
    }

    // Only segments that fetch by symbol list require symbols.
    if ((segment === 'watch' || segment === 'popular') && symbols.length === 0) {
      setRows([]);
      setNextRefreshAtMs(null);
      return;
    }

    if (shouldUseSignalApi) {
      const serverRows =
        segment === 'watch'
          ? await fetchSignalMarketQuotes({ symbols, pageSize: Math.max(symbols.length, 1) })
          : await fetchSignalMarketQuotes({
              segment: segment === 'popular' ? 'popular' : 'mcap',
              pageSize: segment === 'popular' ? limits.popularMax : limits.mcapMax,
            });
      const mapped = serverRows.map(mapSignalQuoteToRow);
      setRows(segment === 'watch' ? applyQuoteOrder(mapped, symbols) : mapped);
      setNextRefreshAtMs(Date.now() + POLL_MS);
      return;
    }

    const symbolsSorted =
      segment === 'watch'
        ? [...symbols].map((s) => s.trim().toUpperCase()).sort()
        : segment === 'popular'
          ? [...symbols]
          : [...symbols];

    const cacheKey = buildQuotesCacheKey(segment, symbolsSorted);
    if (quotesEnabled && !forceRefresh) {
      const hit = peekQuotes(cacheKey);
      if (hit) {
        setRows(hit.rows);
        setNextRefreshAtMs(hit.expiresAtMs);
        scheduleRefreshAtCacheExpiry(hit.expiresAtMs);
        return;
      }
    }

    const list = await fetchQuotesForSymbols(symbols);

    if (segment === 'watch') {
      const symbolsNorm = symbols.map((s) => s.trim().toUpperCase());
      const pruned = symbolsNorm.filter((s) => {
        const r = list.find((x) => x.symbol === s);
        return r != null && r.error !== 'UNKNOWN_SYMBOL';
      });
      if (pruned.length !== symbolsNorm.length) {
        await saveWatchlistSymbols(pruned);
      }
      const displayList = pruned
        .map((sym) => list.find((r) => r.symbol === sym))
        .filter((x): x is Row => x != null);
      const cacheKeyWatch = buildQuotesCacheKey(segment, [...pruned].sort());
      setRows(displayList);
      if (quotesEnabled) {
        const nextAt = Date.now() + QUOTES_CACHE_TTL_MS;
        storeQuotes(cacheKeyWatch, displayList);
        setNextRefreshAtMs(nextAt);
        scheduleRefreshAtCacheExpiry(nextAt);
      } else {
        setNextRefreshAtMs(Date.now() + POLL_MS);
      }
      return;
    }

    setRows(list);
    if (quotesEnabled) {
      const nextAt = Date.now() + QUOTES_CACHE_TTL_MS;
      storeQuotes(cacheKey, list);
      setNextRefreshAtMs(nextAt);
      scheduleRefreshAtCacheExpiry(nextAt);
    } else {
      setNextRefreshAtMs(Date.now() + POLL_MS);
    }
  }, [segment, scheduleRefreshAtCacheExpiry, shouldUseSignalApi, t]);

  loadRef.current = load;

  useFocusEffect(
    useCallback(() => {
      void loadQuotesSegmentOrder().then(setSegmentOrder);
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let interval: ReturnType<typeof setInterval> | undefined;
      const task = InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;
        void (async () => {
          if (rowsRef.current.length === 0) setLoading(true);
          try {
            await load();
          } catch (e) {
            if (!cancelled) {
              setError(e instanceof Error ? e.message : t('quotesErrorLoadQuotes'));
              setRows([]);
            }
          } finally {
            if (!cancelled) setLoading(false);
          }
        })();

        interval = setInterval(() => {
          void load();
        }, POLL_MS);
      });

      return () => {
        cancelled = true;
        task.cancel();
        if (interval) clearInterval(interval);
        clearTtlTimer();
      };
    }, [load, clearTtlTimer]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('quotesErrorRefresh'));
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const onAddWatch = useCallback(async () => {
    const raw = draftTicker.trim();
    if (!raw) return;
    if (!isValidUsTicker(raw)) {
      Alert.alert(t('alertTitleFormatError'), t('quotesAlertTickerFormatBody'));
      return;
    }
    const sym = raw.toUpperCase().replace(/\s+/g, '');
    if (shouldUseSignalApi) {
      try {
        const rows = await fetchSignalMarketQuotes({ symbols: [sym], pageSize: 1 });
        if (rows.length === 0 || rows.every((row) => row.currentPrice == null)) {
          Alert.alert(t('alertTitleUnknownTicker'), t('quotesTickerNotFoundBody'));
          return;
        }
      } catch (e) {
        Alert.alert(
          t('alertTitleFormatError'),
          e instanceof Error ? e.message : t('quotesErrorLookup'),
        );
        return;
      }
    } else {
      if (!hasFinnhub()) {
        setError(t('feedErrorToken'));
        return;
      }
      try {
        const [profile, q] = await Promise.all([fetchProfile2(sym), fetchQuote(sym)]);
        if (!profile) {
          Alert.alert(t('alertTitleUnknownTicker'), t('quotesTickerNotFoundBody'));
          return;
        }
        if (!finnhubQuoteHasValidPrice(q)) {
          Alert.alert(t('alertTitleUnknownTicker'), t('quotesTickerNotFoundBody'));
          return;
        }
      } catch (e) {
        Alert.alert(
          t('alertTitleFormatError'),
          e instanceof Error ? e.message : t('quotesErrorLookup'),
        );
        return;
      }
    }
    const current = await loadWatchlistSymbols();
    if (current.includes(sym)) {
      Alert.alert(t('commonNotice'), t('quotesAlertDupWatchlist'));
      return;
    }
    await saveWatchlistSymbols([...current, sym]);
    setDraftTicker('');
    await load();
  }, [draftTicker, load, shouldUseSignalApi, t]);

  const onRemoveWatch = useCallback(
    async (symbol: string) => {
      const current = await loadWatchlistSymbols();
      await saveWatchlistSymbols(current.filter((s) => s !== symbol));
      await load();
    },
    [load],
  );

  const openYahooFinance = useCallback(
    (r: Row) => {
      const sym = r.symbol?.trim();
      if (!sym || sym === '—') return;
      void openYahooFinanceQuote(sym, segment === 'coin' ? 'coin' : 'stock');
    },
    [segment],
  );

  const openSymbolDetail = useCallback(
    (symbol: string) => {
      const trimmed = symbol.trim().toUpperCase();
      if (!trimmed || trimmed === '—' || segment === 'coin') return;
      router.push(`/symbol/${trimmed}`);
    },
    [router, segment],
  );

  const onResetWatchDefaults = useCallback(() => {
    Alert.alert(
      t('alertResetWatchTitle'),
      t('alertResetWatchBody'),
      [
        { text: t('commonCancel'), style: 'cancel' },
        {
          text: t('alertReset'),
          style: 'destructive',
          onPress: async () => {
            await resetWatchlistToDefaults();
            await load();
          },
        },
      ],
    );
  }, [load, t]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SignalHeader />
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={styles.mainColumn}>
        <View style={styles.topFixed}>
          <Text style={styles.section}>{t('quotesScreenTitle')}</Text>

          <View style={styles.segment}>
            {segmentOrder.map((key) => (
              <Pressable
                key={key}
                onPress={() => {
                  if (segment === key) return;
                  setLoading(true);
                  setRows([]);
                  setNextRefreshAtMs(null);
                  setError(null);
                  setSegment(key);
                }}
                style={[styles.segBtn, segment === key && styles.segBtnActive]}
                accessibilityState={{ selected: segment === key }}>
                <Text style={[styles.segText, segment === key && styles.segTextActive]}>
                  {t(QUOTE_SEGMENT_LABEL[key])}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          removeClippedSubviews={false}
          contentContainerStyle={[
            styles.scrollContent,
            loading ? SCROLL_CONTENT_LOADING_STYLE : null,
            { paddingBottom: 28 + tabBarHeight + TAB_BAR_FLOAT_MARGIN_BOTTOM + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            loading ? undefined : (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />
            )
          }>
          {loading ? (
            <View style={SCROLL_LOADING_BODY_STYLE}>
              <SignalLoadingIndicator message={t('commonLoading')} />
            </View>
          ) : (
            <>
            {nextRefreshLine ? <Text style={styles.updated}>{nextRefreshLine}</Text> : null}

            {error ? (
              <View style={styles.errBox}>
                <Text style={styles.errText}>{error}</Text>
              </View>
            ) : null}

            {segment === 'watch' ? (
              <View style={styles.addRow}>
                <TextInput
                  value={draftTicker}
                  onChangeText={setDraftTicker}
                  placeholder={t('quotesPlaceholderTicker')}
                  placeholderTextColor={theme.textDim}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={styles.addInput}
                  onSubmitEditing={() => void onAddWatch()}
                  returnKeyType="done"
                />
                <Pressable onPress={() => void onAddWatch()} style={styles.addBtn} accessibilityRole="button">
                  <Text style={styles.addBtnText}>{t('quotesAddButton')}</Text>
                </Pressable>
                <Pressable
                  onPress={onResetWatchDefaults}
                  style={styles.watchResetBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('settingsQuotesReset')}>
                  <Text style={styles.watchResetBtnText} numberOfLines={1}>
                    {t('settingsQuotesReset')}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {rows.map((r) => {
              const symTrim = r.symbol?.trim() ?? '';
              const yahooEnabled = symTrim.length > 0 && symTrim !== '—';
              const watchSwipe = segment === 'watch' && Platform.OS !== 'web';
              const watchRemoveIcon = segment === 'watch' && Platform.OS === 'web';

              const rowKey = `${r.symbol}-${r.name ?? ''}`;
              const cardInner = (
                <>
                  <View style={styles.cardTop}>
                    <View style={styles.symCol}>
                      <View style={styles.symBlock}>
                        <View style={styles.symRow}>
                          <Pressable onPress={() => openSymbolDetail(r.symbol)} hitSlop={6}>
                            <Text style={styles.sym}>{r.symbol}</Text>
                          </Pressable>
                          {yahooEnabled ? (
                            <Pressable
                              onPress={() => openYahooFinance(r)}
                              style={({ pressed }) => [styles.yahooInline, pressed && styles.yahooInlinePressed]}
                              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                              accessibilityRole="link"
                              accessibilityLabel={t('quotesYahooFinanceA11y', { symbol: r.symbol })}>
                              <FontAwesome name="external-link" size={11} color={theme.green} />
                              <Text style={styles.yahooInlineText}>{t('quotesYahooShort')}</Text>
                            </Pressable>
                          ) : null}
                        </View>
                        {r.quote ? (
                          <Text style={styles.symPrev}>
                            {segment === 'coin' ? t('quotesPrevRefCoin') : t('quotesPrevCloseStock')}{' '}
                            {formatUsd(r.quote.pc)}
                          </Text>
                        ) : null}
                        {segment === 'coin' && r.name ? (
                          <Text style={styles.symSub} numberOfLines={1}>
                            {r.name}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.priceCol}>
                      <View style={styles.priceRow}>
                        {r.quote ? (
                          <Text style={styles.price}>{formatUsd(r.quote.c)}</Text>
                        ) : (
                          <Text style={styles.na}>—</Text>
                        )}
                        {watchRemoveIcon ? (
                          <Pressable
                            onPress={() => void onRemoveWatch(r.symbol)}
                            style={styles.removeBtn}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={`${r.symbol} ${t('quotesWatchSwipeRemove')}`}>
                            <FontAwesome name="times-circle" size={18} color={theme.textDim} />
                          </Pressable>
                        ) : null}
                      </View>
                      {r.quote ? (
                        <Text style={[styles.chg, quoteRowChangeUp(r.quote) ? styles.chgUp : styles.chgDn]}>
                          {formatUsdChange(r.quote.d)} ({formatQuoteDpPct(r.quote.dp)})
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  {!r.quote ? (
                    <Text style={styles.fail}>
                      {r.error === 'UNKNOWN_SYMBOL'
                        ? t('quotesErrorNoPrice')
                        : r.error === 'QUOTE_FETCH_FAILED'
                          ? t('quotesErrorLookup')
                          : (r.error ?? t('quotesDataUnavailable'))}
                    </Text>
                  ) : null}
                </>
              );

              if (watchSwipe) {
                return (
                  <ReanimatedSwipeable
                    key={rowKey}
                    enabled={!loading}
                    overshootRight={false}
                    containerStyle={styles.swipeRow}
                    renderRightActions={() => (
                      <View style={styles.swipeRight}>
                        <RectButton
                          style={styles.swipeDeleteBtn}
                          onPress={() => void onRemoveWatch(r.symbol)}
                          accessibilityRole="button"
                          accessibilityLabel={`${r.symbol} ${t('quotesWatchSwipeRemove')}`}>
                          <Text style={styles.swipeDeleteText}>{t('quotesWatchSwipeRemove')}</Text>
                        </RectButton>
                      </View>
                    )}>
                    <View style={styles.card}>{cardInner}</View>
                  </ReanimatedSwipeable>
                );
              }

              return (
                <View key={rowKey} style={[styles.card, styles.cardGap]}>
                  {cardInner}
                </View>
              );
            })}

            {rows.length === 0 && !error ? (
              <Text style={styles.empty}>
                {segment === 'watch' ? t('quotesEmptyWatch') : t('quotesEmptyGeneric')}
              </Text>
            ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    mainColumn: { flex: 1, minHeight: 0 },
    topFixed: {
      flexShrink: 0,
      zIndex: 2,
      elevation: Platform.OS === 'android' ? 2 : 0,
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 10,
      backgroundColor: theme.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    scrollView: { flex: 1, minHeight: 0 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 28 },
    section: { fontSize: sf(16), fontWeight: '800', color: theme.text, marginBottom: 4 },
    segment: {
      flexDirection: 'row',
      backgroundColor: SEGMENT_TAB_BACKGROUND,
      borderRadius: SEGMENT_TAB_OUTER_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: SEGMENT_TAB_PADDING,
      marginBottom: 8,
      gap: SEGMENT_TAB_GAP,
    },
    segBtn: {
      flex: 1,
      paddingVertical: SEGMENT_TAB_BTN_PADDING_V,
      borderRadius: SEGMENT_TAB_BTN_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segBtnActive: {
      backgroundColor: theme.green,
    },
    segText: {
      fontSize: sf(SEGMENT_TAB_FONT_SIZE),
      lineHeight: sf(SEGMENT_TAB_LINE_HEIGHT),
      fontWeight: SEGMENT_TAB_FONT_WEIGHT,
      color: theme.textDim,
    },
    segTextActive: {
      color: SEGMENT_TAB_ACTIVE_TEXT,
    },
    updated: { fontSize: sf(11), fontWeight: '600', color: theme.textMuted, marginBottom: 10 },
    addRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
      alignItems: 'center',
    },
    addInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: sf(14),
      color: theme.text,
      backgroundColor: '#12121A',
    },
    addBtn: {
      flexShrink: 0,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 8,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    addBtnText: { fontSize: sf(13), fontWeight: '800', color: theme.green },
    watchResetBtn: {
      flexShrink: 0,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: '#14141C',
      justifyContent: 'center',
    },
    watchResetBtnText: { fontSize: sf(13), fontWeight: '700', color: '#E0A0A0' },
    errBox: {
      padding: 12,
      borderRadius: 10,
      backgroundColor: '#2A1515',
      borderWidth: 1,
      borderColor: '#553333',
      marginBottom: 12,
    },
    errText: { fontSize: sf(12), color: '#E0A0A0', lineHeight: sf(18) },
    empty: { fontSize: sf(13), color: theme.textMuted, marginTop: 8 },
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
    },
    cardGap: { marginBottom: 10 },
    swipeRow: {
      marginBottom: 10,
      borderRadius: 12,
      overflow: 'hidden',
    },
    swipeRight: {
      width: 80,
      height: '100%',
    },
    swipeDeleteBtn: {
      flex: 1,
      backgroundColor: '#7A2E2E',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 8,
    },
    swipeDeleteText: {
      color: '#FFFFFF',
      fontSize: sf(15),
      fontWeight: '800',
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 6,
    },
    priceCol: { flexShrink: 0, alignItems: 'flex-end' },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 8,
    },
    symCol: { flex: 1, minWidth: 0 },
    symBlock: { alignSelf: 'flex-start', maxWidth: '100%' },
    symRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
    },
    sym: { fontSize: sf(16), fontWeight: '900', color: theme.text, letterSpacing: 0.5 },
    symPrev: {
      fontSize: sf(12),
      fontWeight: '500',
      color: theme.textMuted,
      marginTop: 4,
      lineHeight: sf(17),
    },
    symSub: { fontSize: sf(12), fontWeight: '700', color: theme.textMuted, marginTop: 4 },
    price: { fontSize: sf(18), fontWeight: '800', color: theme.text },
    na: { fontSize: sf(16), color: theme.textDim },
    removeBtn: { padding: 2 },
    chg: { fontSize: sf(13), fontWeight: '700', marginTop: 4, textAlign: 'right' },
    chgUp: { color: theme.green },
    chgDn: { color: '#E08080' },
    fail: { fontSize: sf(12), color: '#E0A0A0' },
    yahooInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 2,
    },
    yahooInlinePressed: { opacity: 0.75 },
    yahooInlineText: { fontSize: sf(12), fontWeight: '700', color: theme.green },
  });
}
