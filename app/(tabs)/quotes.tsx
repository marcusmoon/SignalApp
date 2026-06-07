import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
  Alert,
  FlatList,
  InteractionManager,
  Platform,
  Pressable,
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
import { groupedFeedRowShell } from '@/components/signal/groupedFeedList';
import { FloatingGlassFab } from '@/components/signal/FloatingGlassFab';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { SCROLL_CONTENT_LOADING_STYLE, SCROLL_LOADING_BODY_STYLE } from '@/constants/scrollLoadingLayout';
import { tabBarBottomInset } from '@/constants/tabBar';
import {
  SEGMENT_TAB_ACTIVE_TEXT,
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
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useQuoteChangeColors, useResetRefreshingOnTabBlur, useTabScreenLoadingRecovery } from '@/hooks';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  fetchSignalCoins,
  fetchSignalMarketList,
  fetchSignalMarketQuotes,
  fetchSignalQuantSignals,
  type SignalApiCoinMarket,
  type SignalApiMarketQuote,
} from '@/integrations/signal-api';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { hasSignalApi } from '@/services/env';
import { POPULAR_SYMBOLS_ORDERED } from '@/domain/quotes/usSymbols';
import { signalMarketQuoteHasValidPrice } from '@/utils/signalMarketQuote';
import { loadQuotesListLimits } from '@/services/quotesListLimitsPreference';
import {
  DEFAULT_QUOTES_SEGMENT_ORDER,
  loadQuotesSegmentOrder,
  type QuoteSegmentKey,
} from '@/services/quotesSegmentOrderPreference';
import {
  buildQuotesCacheKey,
  peekQuotes,
  storeQuotes,
  type QuoteCacheRow,
} from '@/services/cache/quotesCache';
import {
  isValidQuoteSymbol,
  loadWatchlistSymbols,
  resetWatchlistToDefaults,
  saveWatchlistSymbols,
} from '@/services/quoteWatchlist';
import { openYahooFinanceQuote } from '@/utils/yahooFinance';
import { openNaverFinanceStock } from '@/utils/naverFinance';
import type { MessageId } from '@/locales/messages';

const QUOTE_CARD_TEXT_MAX_SCALE = 1.12;

const QUOTE_SEGMENT_LABEL: Record<QuoteSegmentKey, MessageId> = {
  watch: 'quotesSegmentWatch',
  popular: 'quotesSegmentPopular',
  mcap: 'quotesSegmentMcap',
  coin: 'quotesSegmentCoin',
};

const QUANT_ACTION_LABEL: Record<string, MessageId> = {
  buy: 'quantActionBuy',
  accumulate: 'quantActionAccumulate',
  hold: 'quantActionHold',
  reduce: 'quantActionReduce',
  avoid: 'quantActionAvoid',
};

function isKoreaSymbol(symbol: string): boolean {
  return /^\d{6}$/.test(String(symbol || '').trim());
}

function quantActionTone(theme: AppTheme, action: string): string {
  if (action === 'buy') return theme.danger;
  if (action === 'accumulate') return theme.green;
  if (action === 'reduce') return theme.accentBlue;
  if (action === 'avoid') return theme.textDim;
  return theme.textMuted;
}

function formatPctSigned(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

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

function toFiniteDisplayNumber(value: unknown): number {
  if (value == null || value === '') return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function formatKrw(value: unknown): string {
  const n = toFiniteDisplayNumber(value);
  if (!Number.isFinite(n)) return '—';
  return `₩${Math.round(Math.abs(n)).toLocaleString('ko-KR')}`;
}

/** 일부 quote 응답에서 `dp` 누락 가능 — `toFixed` 직접 호출 금지 */
function formatQuoteDpPct(dp: unknown): string {
  if (!Number.isFinite(dp)) return '—';
  const p = dp as number;
  return `${p >= 0 ? '+' : ''}${p.toFixed(2)}%`;
}

function isKoreaStockQuote(row: Row): boolean {
  return Boolean(row.quote?.krxSymbol) || /^\d{6}$/.test(String(row.symbol || '').trim());
}

function mapCoinToSignalMarketQuote(item: SignalApiCoinMarket): SignalApiMarketQuote {
  const price = item.currentPrice;
  const c = typeof price === 'number' && Number.isFinite(price) ? price : Number.NaN;
  const d = item.change24h ?? 0;
  const dp = item.changePercent24h ?? 0;
  const pc = Number.isFinite(c) ? c - d : Number.NaN;
  return {
    id: item.id,
    provider: item.provider,
    providerItemId: item.providerItemId,
    segment: 'coin',
    symbol: item.symbol,
    name: item.name,
    currentPrice: Number.isFinite(c) ? c : null,
    change: d,
    changePercent: dp,
    high: null,
    low: null,
    open: null,
    previousClose: Number.isFinite(pc) ? pc : null,
    marketCapitalization: item.marketCap,
    quoteTime: null,
    fetchedAt: item.fetchedAt,
  };
}

function mapSignalQuoteToRow(item: SignalApiMarketQuote): Row {
  return {
    symbol: item.displaySymbol || item.symbol,
    name: item.name || undefined,
    quote: signalMarketQuoteHasValidPrice(item) ? item : null,
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
    quote: mapCoinToSignalMarketQuote(item),
  };
}

export default function QuotesScreen() {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const quoteChange = useQuoteChangeColors();
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo, quoteChange.colors),
    [theme, scaleFont, feedTypo, quoteChange.colors],
  );
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
  const [draftTicker, setDraftTicker] = useState('');

  const load = useCallback(async (forceRefresh?: boolean) => {
    setError(null);
    const limits = await loadQuotesListLimits();

    if (!hasSignalApi()) {
      setRows([]);
      setError(t('errorSignalApiShort'));
      return;
    }

    if (segment === 'coin') {
      const cacheKey = buildQuotesCacheKey('coin', [], limits.coinMax);
      if (!forceRefresh) {
        const hit = peekQuotes(cacheKey);
        if (hit) {
          setRows(hit.rows);
          return;
        }
      }
      try {
        const list = (await fetchSignalCoins({ limit: limits.coinMax })).slice(0, limits.coinMax).map(mapSignalCoinToRow);
        setRows(list);
        storeQuotes(cacheKey, list);
      } catch (e) {
        setRows([]);
        setError(formatSignalApiError(e, t, 'quotesErrorLoadCoin'));
      }
      return;
    }

    if (segment === 'watch') {
      const symbols = await loadWatchlistSymbols();
      if (symbols.length === 0) {
        setRows([]);
        return;
      }
      const cacheKey = buildQuotesCacheKey('watch', [...symbols].sort());
      if (!forceRefresh) {
        const hit = peekQuotes(cacheKey);
        if (hit) {
          setRows(hit.rows);
          return;
        }
      }
      // 국내(6자리) 종목은 정규장 시세가 없으면 코스피 퀀트 분석으로, 그 외(미국주식)는 실시간 시세로 채운다.
      const krSymbols = symbols.filter(isKoreaSymbol);
      const usSymbols = symbols.filter((s) => !isKoreaSymbol(s));
      const [usRows, quantRows] = await Promise.all([
        usSymbols.length > 0
          ? fetchSignalMarketQuotes({ symbols: usSymbols, limit: Math.max(usSymbols.length, 1), refresh: forceRefresh === true })
          : Promise.resolve([] as SignalApiMarketQuote[]),
        krSymbols.length > 0
          ? fetchSignalQuantSignals({ symbols: krSymbols, limit: krSymbols.length }).catch(() => [])
          : Promise.resolve([]),
      ]);
      const usBySymbol = new Map(usRows.map(mapSignalQuoteToRow).map((r) => [r.symbol.trim().toUpperCase(), r]));
      const quantBySymbol = new Map(quantRows.map((q) => [String(q.symbol).trim().toUpperCase(), q]));
      const nextRows: Row[] = symbols.map((sym) => {
        const up = sym.trim().toUpperCase();
        const quant = quantBySymbol.get(up);
        if (quant) {
          return { symbol: quant.symbol || sym, name: quant.name ?? undefined, quote: null, quant };
        }
        return usBySymbol.get(up) || { symbol: sym, quote: null, error: 'NO_SERVER_QUOTE' };
      });
      setRows(nextRows);
      storeQuotes(cacheKey, nextRows);
      return;
    }

    let symbols: string[] = [];
    if (segment === 'popular') {
      try {
        const list = await fetchSignalMarketList('popular_symbols');
        symbols = list.symbols.slice(0, limits.popularMax);
      } catch {
        symbols = [...POPULAR_SYMBOLS_ORDERED].slice(0, limits.popularMax);
      }
    }

    if (segment === 'popular' && symbols.length === 0) {
      setRows([]);
      return;
    }

    const cacheKey = buildQuotesCacheKey(
      segment === 'popular' ? 'popular' : 'mcap',
      [`n${segment === 'popular' ? limits.popularMax : limits.mcapMax}`],
    );
    if (!forceRefresh) {
      const hit = peekQuotes(cacheKey);
      if (hit) {
        setRows(hit.rows);
        return;
      }
    }

    const serverRows = await fetchSignalMarketQuotes({
      segment: segment === 'popular' ? 'popular' : 'mcap',
      limit: segment === 'popular' ? limits.popularMax : limits.mcapMax,
    });
    const nextRows = serverRows.map(mapSignalQuoteToRow);
    setRows(nextRows);
    storeQuotes(cacheKey, nextRows);
  }, [segment, t]);

  useFocusEffect(
    useCallback(() => {
      void loadQuotesSegmentOrder().then(setSegmentOrder);
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const kick = () => {
        if (cancelled) return;
        void (async () => {
          if (rowsRef.current.length === 0) setLoading(true);
          try {
            await load();
          } catch (e) {
            if (!cancelled) {
              setError(formatSignalApiError(e, t, 'quotesErrorLoadQuotes'));
              setRows([]);
            }
          } finally {
            if (!cancelled) setLoading(false);
          }
        })();
      };

      /** RN Web에서 InteractionManager 큐가 진행되지 않아 콜백이 영원히 대기하는 사례가 있어 웹은 바로 스케줄한다. */
      let cancelKick: () => void;
      if (Platform.OS === 'web') {
        const id = setTimeout(kick, 0);
        cancelKick = () => clearTimeout(id);
      } else {
        const task = InteractionManager.runAfterInteractions(kick);
        cancelKick = () => task.cancel();
      }

      return () => {
        cancelled = true;
        cancelKick();
      };
    }, [load, t]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } catch (e) {
      setError(formatSignalApiError(e, t, 'quotesErrorRefresh'));
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const onAddWatch = useCallback(async () => {
    const raw = draftTicker.trim();
    if (!raw) return;
    if (!isValidQuoteSymbol(raw)) {
      Alert.alert(t('alertTitleFormatError'), t('quotesAlertTickerFormatBody'));
      return;
    }
    const sym = raw.toUpperCase().replace(/\s+/g, '');
    if (!hasSignalApi()) {
      setError(t('errorSignalApiShort'));
      return;
    }
    try {
      const rows = await fetchSignalMarketQuotes({ symbols: [sym], limit: 1, refresh: true });
      if (rows.length === 0 || rows.every((row) => row.currentPrice == null)) {
        Alert.alert(t('alertTitleUnknownTicker'), t('quotesTickerNotFoundBody'));
        return;
      }
    } catch (e) {
      Alert.alert(
        t('alertTitleFormatError'),
        formatSignalApiError(e, t, 'quotesErrorLookup'),
      );
      return;
    }
    const current = await loadWatchlistSymbols();
    if (current.includes(sym)) {
      Alert.alert(t('commonNotice'), t('quotesAlertDupWatchlist'));
      return;
    }
    await saveWatchlistSymbols([...current, sym]);
    setDraftTicker('');
    await load();
  }, [draftTicker, load, t]);

  const onRemoveWatch = useCallback(
    async (symbol: string) => {
      const current = await loadWatchlistSymbols();
      await saveWatchlistSymbols(current.filter((s) => s !== symbol));
      await load();
    },
    [load],
  );

  const openFinanceQuote = useCallback(
    (r: Row) => {
      const sym = r.symbol?.trim();
      if (!sym || sym === '—') return;
      if (isKoreaStockQuote(r)) {
        void openNaverFinanceStock(r.quote?.krxSymbol || sym);
        return;
      }
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

  const bottomPad = 28 + tabBarHeight + tabBarBottomInset(insets.bottom);
  const fabStackBottom = tabBarHeight + tabBarBottomInset(insets.bottom) + 8;

  const quotesListHeader = useMemo(
    () => (
      <>
        {loading ? (
          <View style={SCROLL_LOADING_BODY_STYLE}>
            <SignalLoadingIndicator message={t('commonLoading')} />
          </View>
        ) : (
          <>
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
          </>
        )}
      </>
    ),
    [
      draftTicker,
      error,
      loading,
      onAddWatch,
      onResetWatchDefaults,
      segment,
      styles,
      t,
      theme.textDim,
    ],
  );

  const renderQuoteItem = useCallback(
    ({ item: r, index }: { item: Row; index: number }) => {
      const edges = {
        isFirst: index === 0,
        isLast: index === rows.length - 1,
      };
      const shellStyle = groupedFeedRowShell(theme, edges);
      const symTrim = r.symbol?.trim() ?? '';
      const yahooEnabled = symTrim.length > 0 && symTrim !== '—';
      const watchSwipe = segment === 'watch' && Platform.OS !== 'web';
      const watchRemoveIcon = segment === 'watch' && Platform.OS === 'web';
      const quant = r.quant ?? null;
      const useNaverLink = isKoreaStockQuote(r);
      const titleText = quant ? r.name || r.symbol : r.symbol;
      const quantReturn20d = quant?.indicators?.return20d ?? null;
      const quantActionLabel = quant ? t(QUANT_ACTION_LABEL[quant.action] ?? 'quantActionHold') : '';
      const quantActionColor = quant ? quantActionTone(theme, quant.action) : theme.textMuted;

      const cardInner = (
        <>
          <View style={styles.cardTop}>
            <View style={styles.symCol}>
              <View style={styles.symBlock}>
                <View style={styles.symRow}>
                  <Pressable onPress={() => openSymbolDetail(r.symbol)} hitSlop={6} style={styles.symPressable}>
                    <Text style={styles.sym} numberOfLines={1} maxFontSizeMultiplier={QUOTE_CARD_TEXT_MAX_SCALE}>
                      {titleText}
                    </Text>
                  </Pressable>
                  {yahooEnabled ? (
                    <Pressable
                      onPress={() => openFinanceQuote(r)}
                      style={({ pressed }) => [styles.yahooInline, pressed && styles.yahooInlinePressed]}
                      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                      accessibilityRole="link"
                      accessibilityLabel={
                        useNaverLink
                          ? t('quotesNaverFinanceA11y', { symbol: r.symbol })
                          : t('quotesYahooFinanceA11y', { symbol: r.symbol })
                      }>
                      <FontAwesome name="external-link" size={11} color={theme.green} />
                      <Text
                        style={styles.yahooInlineText}
                        numberOfLines={1}
                        maxFontSizeMultiplier={QUOTE_CARD_TEXT_MAX_SCALE}>
                        {useNaverLink ? t('quotesNaverShort') : t('quotesYahooShort')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
                {quant ? (
                  <View style={styles.quantMetaRow}>
                    <Text style={styles.symSub} numberOfLines={1} maxFontSizeMultiplier={QUOTE_CARD_TEXT_MAX_SCALE}>
                      {r.symbol}
                      {typeof quant.rank === 'number' && quant.rank > 0 ? ` · ${t('quantRankBadge', { rank: quant.rank })}` : ''}
                    </Text>
                  </View>
                ) : r.quote ? (
                  <Text style={styles.symPrev} numberOfLines={1} maxFontSizeMultiplier={QUOTE_CARD_TEXT_MAX_SCALE}>
                    {segment === 'coin' ? t('quotesPrevRefCoin') : t('quotesPrevCloseStock')}{' '}
                    {formatUsd(Number(r.quote.previousClose))}
                  </Text>
                ) : null}
                {!quant && segment === 'coin' && r.name ? (
                  <Text style={styles.symSub} numberOfLines={1} maxFontSizeMultiplier={QUOTE_CARD_TEXT_MAX_SCALE}>
                    {r.name}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.priceCol}>
              <View style={styles.priceRow}>
                {quant ? (
                  <Text style={styles.price} numberOfLines={1} maxFontSizeMultiplier={QUOTE_CARD_TEXT_MAX_SCALE}>
                    {formatKrw(quant.indicators?.lastClose)}
                  </Text>
                ) : r.quote ? (
                  <Text style={styles.price} numberOfLines={1} maxFontSizeMultiplier={QUOTE_CARD_TEXT_MAX_SCALE}>
                    {formatUsd(Number(r.quote.currentPrice))}
                  </Text>
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
              {quant ? (
                <Text
                  style={[styles.chg, Number(quantReturn20d ?? 0) >= 0 ? styles.chgUp : styles.chgDn]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={QUOTE_CARD_TEXT_MAX_SCALE}>
                  {t('quant20dReturn')} {formatPctSigned(quantReturn20d)}
                </Text>
              ) : r.quote ? (
                <Text
                  style={[styles.chg, quoteChange.isPositive(r.quote) ? styles.chgUp : styles.chgDn]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={QUOTE_CARD_TEXT_MAX_SCALE}>
                  {formatUsdChange(Number(r.quote.change ?? 0))} ({formatQuoteDpPct(r.quote.changePercent)})
                </Text>
              ) : null}
            </View>
          </View>
          {quant ? (
            <View style={styles.quantDetail}>
              <View style={styles.quantBadgeRow}>
                <Text
                  style={[styles.quantActionBadge, { color: quantActionColor, borderColor: quantActionColor }]}
                  numberOfLines={1}>
                  {quantActionLabel}
                </Text>
                <Text style={styles.quantScoreText} numberOfLines={1}>
                  {t('quantScore')} {quant.score} · {t('quantConfidence')} {quant.confidence}
                </Text>
              </View>
              {quant.headline ? (
                <Text style={styles.quantHeadline} numberOfLines={2}>
                  {quant.headline}
                </Text>
              ) : null}
            </View>
          ) : null}
          {!r.quote && !quant ? (
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
          <View style={shellStyle}>
            <ReanimatedSwipeable
              enabled={!loading}
              overshootRight={false}
              containerStyle={styles.swipeRowGrouped}
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
              <View style={styles.cardGrouped}>{cardInner}</View>
            </ReanimatedSwipeable>
          </View>
        );
      }

      return (
        <View style={shellStyle}>
          <View style={styles.cardGrouped}>{cardInner}</View>
        </View>
      );
    },
    [
      loading,
      onRemoveWatch,
      openSymbolDetail,
      openFinanceQuote,
      rows.length,
      segment,
      styles,
      t,
      theme,
      theme.green,
      theme.textDim,
    ],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SignalHeader compact onBrandPress={() => void onRefresh()} />
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={styles.mainColumn}>
        <View style={styles.topFixed}>
          <View style={styles.segment}>
            {segmentOrder.map((key) => (
              <Fragment key={key}>
                {key === 'coin' ? <View pointerEvents="none" style={styles.segmentDivider} /> : null}
                <Pressable
                  onPress={() => {
                    if (segment === key) return;
                    setLoading(true);
                    setRows([]);
                    setError(null);
                    setSegment(key);
                  }}
                  style={[styles.segBtn, key === 'coin' && styles.segBtnCompact, segment === key && styles.segBtnActive]}
                  accessibilityState={{ selected: segment === key }}>
                  <Text style={[styles.segText, segment === key && styles.segTextActive]}>
                    {t(QUOTE_SEGMENT_LABEL[key])}
                  </Text>
                </Pressable>
              </Fragment>
            ))}
          </View>
        </View>

        <FlatList
          data={loading ? [] : rows}
          keyExtractor={(r) => `${r.symbol}-${r.name ?? ''}`}
          renderItem={renderQuoteItem}
          ListHeaderComponent={quotesListHeader}
          ListEmptyComponent={
            !loading && !error && rows.length === 0 ? (
              <Text style={styles.empty}>
                {segment === 'watch' ? t('quotesEmptyWatch') : t('quotesEmptyGeneric')}
              </Text>
            ) : null
          }
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            loading ? SCROLL_CONTENT_LOADING_STYLE : null,
            { paddingBottom: bottomPad },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            loading ? undefined : (
              <ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            )
          }
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={12}
          windowSize={8}
          maxToRenderPerBatch={16}
        />
      </View>

      <FloatingGlassFab
        bottom={fabStackBottom}
        onPress={() => void onRefresh()}
        iconName="sync"
        accessibilityLabel={t('fabRefreshA11y')}
        disabled={refreshing || loading}
      />
    </SafeAreaView>
  );
}

function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
  changeColors: { up: string; down: string },
) {
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
    list: { flex: 1, minHeight: 0 },
    listContent: { paddingHorizontal: 16, paddingTop: 0 },
    segment: {
      flexDirection: 'row',
      backgroundColor: theme.bgElevated,
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
    segBtnCompact: {
      flex: 0.86,
    },
    segmentDivider: {
      width: 1,
      height: 18,
      alignSelf: 'center',
      marginHorizontal: 2,
      borderRadius: 999,
      backgroundColor: theme.border,
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
      backgroundColor: theme.card,
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
      backgroundColor: theme.bgElevated,
      justifyContent: 'center',
    },
    watchResetBtnText: { fontSize: sf(13), fontWeight: '700', color: theme.danger },
    errBox: {
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.dangerDim,
      borderWidth: 1,
      borderColor: '#FFD6DA',
      marginBottom: 12,
    },
    errText: { fontSize: sf(12), color: theme.danger, lineHeight: sf(18) },
    empty: { fontSize: sf(13), color: theme.textMuted, marginTop: 8 },
    cardGrouped: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderRadius: 0,
      paddingHorizontal: ft.pad(16),
      paddingVertical: ft.pad(12),
    },
    swipeRowGrouped: {
      marginBottom: 0,
      borderRadius: 0,
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
      gap: 10,
      marginBottom: 6,
    },
    priceCol: {
      flexShrink: 1,
      alignItems: 'flex-end',
      minWidth: 104,
      maxWidth: '48%',
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 8,
    },
    symCol: { flex: 1, minWidth: 0, flexShrink: 1 },
    symBlock: { alignSelf: 'flex-start', maxWidth: '100%' },
    symRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'nowrap',
    },
    symPressable: { flexShrink: 0, minWidth: 0 },
    sym: {
      fontSize: ft.ff(16),
      lineHeight: ft.ff(20),
      fontWeight: ft.titleWeight,
      color: theme.text,
      letterSpacing: 0.5,
    },
    symPrev: {
      fontSize: ft.ff(12),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
      marginTop: 4,
      lineHeight: ft.ff(17),
    },
    symSub: {
      fontSize: ft.ff(12),
      lineHeight: ft.ff(16),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
      marginTop: 4,
    },
    quantMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
      marginTop: 4,
    },
    quantDetail: {
      flexDirection: 'column',
      gap: 6,
      paddingTop: 9,
      marginTop: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    quantBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    quantActionBadge: {
      overflow: 'hidden',
      borderRadius: 7,
      borderWidth: 1.5,
      paddingHorizontal: 8,
      paddingVertical: 2,
      fontSize: ft.ff(12),
      lineHeight: ft.ff(16),
      fontWeight: ft.titleWeight,
    },
    quantScoreText: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: ft.ff(11),
      lineHeight: ft.ff(15),
      fontWeight: ft.emphasisWeight,
      color: theme.textMuted,
    },
    quantHeadline: {
      fontSize: ft.ff(12),
      lineHeight: ft.ff(17),
      fontWeight: ft.emphasisWeight,
      color: theme.textDim,
    },
    price: {
      maxWidth: '100%',
      fontSize: ft.ff(18),
      lineHeight: ft.ff(22),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    na: { fontSize: sf(16), color: theme.textDim },
    removeBtn: { padding: 2 },
    chg: {
      maxWidth: '100%',
      fontSize: ft.ff(13),
      lineHeight: ft.ff(17),
      fontWeight: ft.emphasisWeight,
      marginTop: 4,
      textAlign: 'right',
    },
    chgUp: { color: changeColors.up },
    chgDn: { color: changeColors.down },
    fail: { fontSize: sf(12), color: theme.danger },
    yahooInline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 1,
      minWidth: 0,
      marginLeft: 8,
      paddingVertical: 2,
    },
    yahooInlinePressed: { opacity: 0.75 },
    yahooInlineText: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: ft.ff(12),
      lineHeight: ft.ff(16),
      fontWeight: ft.emphasisWeight,
      color: theme.green,
    },
  });
}
