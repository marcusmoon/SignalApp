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
  Text,
  TextInput,
  View,
} from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { makeQuotesStyles } from '@/components/quotes/quotesStyles';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { groupedFeedRowShell } from '@/components/signal/groupedFeedList';
import { FloatingGlassFab } from '@/components/signal/FloatingGlassFab';
import { MiniSparkline } from '@/components/signal/MiniSparkline';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { SCROLL_CONTENT_LOADING_STYLE, SCROLL_LOADING_BODY_STYLE } from '@/constants/scrollLoadingLayout';
import { tabBarBottomInset } from '@/constants/tabBar';
import { useQuoteChangeColors, useResetRefreshingOnTabBlur, useTabScreenLoadingRecovery } from '@/hooks';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  fetchSignalCoins,
  fetchSignalMarketList,
  fetchSignalMarketQuotes,
  fetchSignalStockSparklines,
  fetchSignalQuantSignals,
  type SignalApiMarketQuote,
  type SignalApiQuantSignal,
} from '@/integrations/signal-api';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { hasSignalApi } from '@/services/env';
import {
  formatKrw,
  formatPctSigned,
  formatQuoteDpPct,
  formatUsd,
  formatUsdChange,
  isKoreaStockQuote,
  isKoreaSymbol,
  mapSignalCoinToRow,
  mapSignalQuoteToRow,
  quantActionTone,
  quoteLookupKeys,
  sparklineSymbolForRow,
  withSoftTimeout,
  type QuoteRow,
} from '@/domain/quotes/rows';
import { POPULAR_SYMBOLS_ORDERED } from '@/domain/quotes/usSymbols';
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
const WATCH_MARKET_SOFT_TIMEOUT_MS = 5000;
const WATCH_QUANT_SOFT_TIMEOUT_MS = 2500;
const REFRESH_SPINNER_SOFT_TIMEOUT_MS = 1200;

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

type Row = QuoteRow;

async function withStockSparklines(rows: Row[]): Promise<Row[]> {
  const symbols = [...new Set(rows.map(sparklineSymbolForRow).filter((symbol) => symbol && symbol !== '—'))];
  if (symbols.length === 0) return rows;
  const items = await fetchSignalStockSparklines({ symbols, days: 30 });
  if (items.length === 0) return rows;
  const bySymbol = new Map(items.map((item) => [String(item.symbol || '').trim().toUpperCase(), item]));
  return rows.map((row) => {
    const item = bySymbol.get(sparklineSymbolForRow(row));
    if (!item || !Array.isArray(item.closes) || item.closes.length < 2) return row;
    return {
      ...row,
      sparkline: item.closes,
      sparklineChangePercent: item.changePercent ?? null,
    };
  });
}

export default function QuotesScreen() {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const quoteChange = useQuoteChangeColors();
  const styles = useMemo(
    () => makeQuotesStyles(theme, scaleFont, feedTypo, quoteChange.colors),
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
  const loadSeqRef = useRef(0);
  useTabScreenLoadingRecovery(rows, setLoading);
  const [draftTicker, setDraftTicker] = useState('');

  const hydrateSparklines = useCallback(async (cacheKey: string, baseRows: Row[], loadSeq: number) => {
    const nextRows = await withStockSparklines(baseRows);
    if (loadSeqRef.current !== loadSeq) return;
    if (nextRows === baseRows) return;
    setRows(nextRows);
    storeQuotes(cacheKey, nextRows);
  }, []);

  const load = useCallback(async (forceRefresh?: boolean) => {
    const loadSeq = ++loadSeqRef.current;
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
          if (!hit.rows.every((row) => Array.isArray(row.sparkline) && row.sparkline.length > 1)) {
            void hydrateSparklines(cacheKey, hit.rows, loadSeq);
          }
          return;
        }
      }
      // 국내(6자리) 종목은 정규장 시세가 없으면 코스피 퀀트 분석으로, 그 외(미국주식)는 실시간 시세로 채운다.
      const krSymbols = symbols.filter(isKoreaSymbol);
      const [quoteRows, quantRows] = await Promise.all([
        withSoftTimeout<SignalApiMarketQuote[]>(
          fetchSignalMarketQuotes({ symbols, limit: Math.max(symbols.length, 1) }).catch(() => []),
          WATCH_MARKET_SOFT_TIMEOUT_MS,
          [],
        ),
        krSymbols.length > 0
          ? withSoftTimeout<SignalApiQuantSignal[]>(
              fetchSignalQuantSignals({ symbols: krSymbols, limit: krSymbols.length }).catch(() => []),
              WATCH_QUANT_SOFT_TIMEOUT_MS,
              [],
            )
          : Promise.resolve([]),
      ]);
      const quoteBySymbol = new Map<string, Row>();
      for (const item of quoteRows) {
        const row = mapSignalQuoteToRow(item);
        for (const key of quoteLookupKeys(item, row)) quoteBySymbol.set(key, row);
      }
      const quantBySymbol = new Map(quantRows.map((q) => [String(q.symbol).trim().toUpperCase(), q]));
      const baseRows: Row[] = symbols.map((sym) => {
        const up = sym.trim().toUpperCase();
        const quote = quoteBySymbol.get(up);
        if (quote) return quote;
        const quant = quantBySymbol.get(up);
        if (quant) {
          return { symbol: quant.symbol || sym, name: quant.name ?? undefined, quote: null, quant };
        }
        return { symbol: sym, quote: null, error: 'NO_SERVER_QUOTE' };
      });
      setRows(baseRows);
      storeQuotes(cacheKey, baseRows);
      void hydrateSparklines(cacheKey, baseRows, loadSeq);
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
        if (!hit.rows.every((row) => Array.isArray(row.sparkline) && row.sparkline.length > 1)) {
          void hydrateSparklines(cacheKey, hit.rows, loadSeq);
        }
        return;
      }
    }

    const serverRows = await fetchSignalMarketQuotes({
      segment: segment === 'popular' ? 'popular' : 'mcap',
      limit: segment === 'popular' ? limits.popularMax : limits.mcapMax,
    });
    const baseRows = serverRows.map(mapSignalQuoteToRow);
    setRows(baseRows);
    storeQuotes(cacheKey, baseRows);
    void hydrateSparklines(cacheKey, baseRows, loadSeq);
  }, [hydrateSparklines, segment, t]);

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
    const refreshPromise = load(true);
    try {
      const finished = await withSoftTimeout(refreshPromise.then(() => true), REFRESH_SPINNER_SOFT_TIMEOUT_MS, false);
      if (!finished) {
        void refreshPromise.catch((e) => {
          if (rowsRef.current.length === 0) setError(formatSignalApiError(e, t, 'quotesErrorRefresh'));
        });
      }
    } catch (e) {
      if (rowsRef.current.length === 0) setError(formatSignalApiError(e, t, 'quotesErrorRefresh'));
    } finally {
      setRefreshing(false);
    }
  }, [load, t]);

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
      const sparkValues = Array.isArray(r.sparkline) ? r.sparkline.filter((value) => Number.isFinite(value)) : [];
      const sparkChange =
        typeof r.sparklineChangePercent === 'number' && Number.isFinite(r.sparklineChangePercent)
          ? r.sparklineChangePercent
          : quantReturn20d ?? r.quote?.changePercent ?? 0;
      const sparkColor = Number(sparkChange) >= 0 ? quoteChange.colors.up : quoteChange.colors.down;

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
              {sparkValues.length > 1 ? (
                <MiniSparkline values={sparkValues} color={sparkColor} mutedColor={theme.border} />
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
                  {t('quantChecklistScore')} {quant.score} · {t('quantConfidence')} {quant.confidence}
                </Text>
              </View>
              {quant.headline ? (
                <Text style={styles.quantHeadline} numberOfLines={2}>
                  {quant.perspective?.label ? `${quant.perspective.label} · ${quant.headline}` : quant.headline}
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
      quoteChange.colors.down,
      quoteChange.colors.up,
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
