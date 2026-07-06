import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useIsFocused, useFocusEffect } from "expo-router/react-navigation";
import { useRouter } from 'expo-router';
import {
  Alert,
  InteractionManager,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { MasterDetailLayout } from '@/components/layout/MasterDetailLayout';
import { WebWheelFlatList } from '@/components/layout/WebWheelFlatList';
import { WatchlistAddSheet } from '@/components/quotes/WatchlistAddSheet';
import { makeQuotesStyles } from '@/components/quotes/quotesStyles';
import { FloatingGlassFab } from '@/components/signal/FloatingGlassFab';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SymbolDetailPane } from '@/components/symbol/SymbolDetailPane';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { groupedFeedRowShell } from '@/components/signal/groupedFeedList';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import {
  fabStackBottom,
  tabScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import { useQuoteChangeColors, useResetRefreshingOnTabBlur, useScrollToTopOnChange, useTabPressCycleSegment, useTabScreenLoadingRecovery } from '@/hooks';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useSidebarSubTabs } from '@/contexts/SidebarSubTabsContext';
import {
  fetchSignalCoins,
  fetchSignalMarketList,
  fetchSignalMarketQuotes,
  type SignalApiMarketQuote,
} from '@/integrations/signal-api';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { hasSignalApi } from '@/services/env';
import {
  formatQuoteDpPct,
  formatUsd,
  formatUsdChange,
  isKoreaStockQuote,
  mapSignalCoinToRow,
  mapSignalQuoteToRow,
  quoteLookupKeys,
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
  isValidQuoteSymbol,
  loadWatchlistSymbols,
  resetWatchlistToDefaults,
  saveWatchlistSymbols,
} from '@/services/quoteWatchlist';
import { openYahooFinanceQuote } from '@/utils/yahooFinance';
import { openNaverFinanceStock } from '@/utils/naverFinance';
import type { MessageId } from '@/locales/messages';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

const QUOTE_CARD_TEXT_MAX_SCALE = 1.12;
const WATCH_MARKET_SOFT_TIMEOUT_MS = 5000;
const REFRESH_SPINNER_SOFT_TIMEOUT_MS = 1200;

const QUOTE_SEGMENT_LABEL: Record<QuoteSegmentKey, MessageId> = {
  watch: 'quotesSegmentWatch',
  popular: 'quotesSegmentPopular',
  mcap: 'quotesSegmentMcap',
  coin: 'quotesSegmentCoin',
};

type Row = QuoteRow;

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
  const { useTwoPane } = useResponsiveLayout();
  const { setSubTabs, clearSubTabs } = useSidebarSubTabs();
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [segment, setSegment] = useState<QuoteSegmentKey>('watch');
  const [segmentOrder, setSegmentOrder] = useState<QuoteSegmentKey[]>(DEFAULT_QUOTES_SEGMENT_ORDER);
  const { ref: listRef } = useScrollToTopOnChange([segment]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const rowsRef = useRef<Row[]>([]);
  rowsRef.current = rows;
  useTabScreenLoadingRecovery(rows, setLoading);
  const [draftTicker, setDraftTicker] = useState('');
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [addingWatch, setAddingWatch] = useState(false);

  // iPad 2-패널: 리스트가 로드되면 첫 번째 유효한 종목을 자동 선택
  useEffect(() => {
    if (!useTwoPane || segment === 'coin') return;
    if (rows.length === 0) return;
    setSelectedSymbol((prev) => {
      // 이미 현재 리스트에 있으면 유지
      if (prev && rows.some((r) => r.symbol?.trim().toUpperCase() === prev)) return prev;
      const first = rows.find((r) => {
        const sym = r.symbol?.trim();
        return sym && sym !== '—';
      });
      return first?.symbol?.trim().toUpperCase() ?? null;
    });
  }, [useTwoPane, rows, segment]);

  const load = useCallback(async (forceRefresh?: boolean) => {
    setError(null);
    const cacheMode = signalCacheMode(forceRefresh);
    const limits = await loadQuotesListLimits();

    if (!hasSignalApi()) {
      setRows([]);
      setError(t('errorSignalApiShort'));
      return;
    }

    if (segment === 'coin') {
      try {
        const list = (await fetchSignalCoins({ limit: limits.coinMax }, { cacheMode }))
          .slice(0, limits.coinMax)
          .map(mapSignalCoinToRow);
        setRows(list);
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
      const quoteRows = await withSoftTimeout<SignalApiMarketQuote[]>(
        fetchSignalMarketQuotes({ symbols, limit: Math.max(symbols.length, 1) }, { cacheMode }).catch(() => []),
        WATCH_MARKET_SOFT_TIMEOUT_MS,
        [],
      );
      const quoteBySymbol = new Map<string, Row>();
      for (const item of quoteRows) {
        const row = mapSignalQuoteToRow(item);
        for (const key of quoteLookupKeys(item, row)) quoteBySymbol.set(key, row);
      }
      const baseRows: Row[] = symbols.map((sym) => {
        const up = sym.trim().toUpperCase();
        const quote = quoteBySymbol.get(up);
        if (quote) return quote;
        return { symbol: sym, quote: null, error: 'NO_SERVER_QUOTE' };
      });
      setRows(baseRows);
      return;
    }

    let symbols: string[] = [];
    if (segment === 'popular') {
      try {
        const list = await fetchSignalMarketList('popular_symbols', { cacheMode });
        symbols = list.symbols.slice(0, limits.popularMax);
      } catch {
        symbols = [...POPULAR_SYMBOLS_ORDERED].slice(0, limits.popularMax);
      }
    }

    if (segment === 'popular' && symbols.length === 0) {
      setRows([]);
      return;
    }

    const serverRows = await fetchSignalMarketQuotes(
      {
        segment: segment === 'popular' ? 'popular' : 'mcap',
        limit: segment === 'popular' ? limits.popularMax : limits.mcapMax,
      },
      { cacheMode },
    );
    const baseRows = serverRows.map(mapSignalQuoteToRow);
    setRows(baseRows);
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

  const onRefreshBase = useCallback(async () => {
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

  const onRefresh = onRefreshBase;

  const onAddWatch = useCallback(async (): Promise<boolean> => {
    const raw = draftTicker.trim();
    if (!raw) return false;
    if (!isValidQuoteSymbol(raw)) {
      Alert.alert(t('alertTitleFormatError'), t('quotesAlertTickerFormatBody'));
      return false;
    }
    const sym = raw.toUpperCase().replace(/\s+/g, '');
    if (!hasSignalApi()) {
      setError(t('errorSignalApiShort'));
      return false;
    }
    try {
      const rows = await fetchSignalMarketQuotes(
        { symbols: [sym], limit: 1, refresh: true },
        { cacheMode: 'bypass' },
      );
      if (rows.length === 0 || rows.every((row) => row.currentPrice == null)) {
        Alert.alert(t('alertTitleUnknownTicker'), t('quotesTickerNotFoundBody'));
        return false;
      }
    } catch (e) {
      Alert.alert(
        t('alertTitleFormatError'),
        formatSignalApiError(e, t, 'quotesErrorLookup'),
      );
      return false;
    }
    const current = await loadWatchlistSymbols();
    if (current.includes(sym)) {
      Alert.alert(t('commonNotice'), t('quotesAlertDupWatchlist'));
      return false;
    }
    await saveWatchlistSymbols([...current, sym]);
    setDraftTicker('');
    await load();
    return true;
  }, [draftTicker, load, t]);

  const onAddWatchFromSheet = useCallback(async () => {
    if (addingWatch) return;
    setAddingWatch(true);
    try {
      const added = await onAddWatch();
      if (added) setAddSheetVisible(false);
    } finally {
      setAddingWatch(false);
    }
  }, [addingWatch, onAddWatch]);

  const openAddSheet = useCallback(() => {
    setAddSheetVisible(true);
  }, []);

  const closeAddSheet = useCallback(() => {
    if (addingWatch) return;
    setAddSheetVisible(false);
  }, [addingWatch]);

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
      if (useTwoPane) {
        setSelectedSymbol(trimmed);
      } else {
        router.push(`/symbol/${trimmed}`);
      }
    },
    [router, segment, useTwoPane],
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
            setDraftTicker('');
            setAddSheetVisible(false);
            await load();
          },
        },
      ],
    );
  }, [load, t]);

  const bottomPad = tabScreenScrollBottomPadding(tabBarHeight, insets.bottom);
  const fabBottom = fabStackBottom(tabBarHeight, insets.bottom);

  const onPickSegment = useCallback((key: QuoteSegmentKey) => {
    if (segment === key) return;
    setError(null);
    setSegment(key);
  }, [segment]);

  useTabPressCycleSegment(segment, segmentOrder, onPickSegment);

  useFocusEffect(
    useCallback(() => {
      if (!useTwoPane) return;
      setSubTabs(
        segmentOrder.map((key) => ({
          key,
          label: t(QUOTE_SEGMENT_LABEL[key]),
          active: segment === key,
          onPress: () => onPickSegment(key),
        })),
      );
      return () => clearSubTabs();
    }, [clearSubTabs, onPickSegment, segment, segmentOrder, setSubTabs, t, useTwoPane]),
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
      const useNaverLink = isKoreaStockQuote(r);
      const titleText = r.symbol;

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
                {r.quote ? (
                  <Text style={styles.symPrev} numberOfLines={1} maxFontSizeMultiplier={QUOTE_CARD_TEXT_MAX_SCALE}>
                    {segment === 'coin' ? t('quotesPrevRefCoin') : t('quotesPrevCloseStock')}{' '}
                    {formatUsd(Number(r.quote.previousClose))}
                  </Text>
                ) : null}
                {segment === 'coin' && r.name ? (
                  <Text style={styles.symSub} numberOfLines={1} maxFontSizeMultiplier={QUOTE_CARD_TEXT_MAX_SCALE}>
                    {r.name}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.priceCol}>
              <View style={styles.priceRow}>
                {r.quote ? (
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
              {r.quote ? (
                <Text
                  style={[styles.chg, quoteChange.isPositive(r.quote) ? styles.chgUp : styles.chgDn]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={QUOTE_CARD_TEXT_MAX_SCALE}>
                  {formatUsdChange(Number(r.quote.change ?? 0))} ({formatQuoteDpPct(r.quote.changePercent)})
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
      quoteChange.isPositive,
      rows.length,
      segment,
      styles,
      t,
      theme,
      theme.green,
      theme.textDim,
    ],
  );

  const quoteListPanel = (
    <View style={[styles.mainColumn, useTwoPane && styles.mainColumnWide]}>
      {!useTwoPane ? <View style={styles.topFixed}>
        <View style={styles.segment}>
          {segmentOrder.map((key) => (
            <Fragment key={key}>
              {key === 'coin' ? <View pointerEvents="none" style={styles.segmentDivider} /> : null}
              <Pressable
                onPress={() => onPickSegment(key)}
                style={[styles.segBtn, key === 'coin' && styles.segBtnCompact, segment === key && styles.segBtnActive]}
                accessibilityState={{ selected: segment === key }}>
                <Text style={[styles.segText, segment === key && styles.segTextActive]}>
                  {t(QUOTE_SEGMENT_LABEL[key])}
                </Text>
              </Pressable>
            </Fragment>
          ))}
        </View>
      </View> : null}

      {error ? (
        <View style={styles.errBox}>
          <Text style={styles.errText}>{error}</Text>
        </View>
      ) : null}
      {loading && rows.length === 0 ? (
        <View style={styles.loadingBox}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : (
      <WebWheelFlatList
        ref={listRef as never}
        data={rows}
        keyExtractor={(r) => `${r.symbol}-${r.name ?? ''}`}
        renderItem={renderQuoteItem}
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
          useTwoPane && styles.listContentWide,
          { paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={12}
        windowSize={8}
        maxToRenderPerBatch={16}
      />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={useTwoPane ? [] : ['top']}>
      {!useTwoPane ? <SignalHeader compact onBrandPress={() => void onRefresh()} /> : null}
      {isFocused ? <OtaUpdateBanner /> : null}

      <MasterDetailLayout
        useTwoPane={useTwoPane}
        masterPanel={quoteListPanel}
        detailPanel={
          useTwoPane && selectedSymbol ? (
            <View style={styles.detailPanePad}>
              <SymbolDetailPane ticker={selectedSymbol} bottomPad={24} />
            </View>
          ) : undefined
        }
      />

      {segment === 'watch' && isFocused ? (
        <FloatingGlassFab
          bottom={fabBottom}
          iconName="plus"
          accessibilityLabel={t('quotesFabAddA11y')}
          onPress={openAddSheet}
        />
      ) : null}

      <WatchlistAddSheet
        visible={addSheetVisible}
        value={draftTicker}
        onChangeText={setDraftTicker}
        onAdd={onAddWatchFromSheet}
        onReset={onResetWatchDefaults}
        onDismiss={closeAddSheet}
        bottomInset={insets.bottom}
        adding={addingWatch}
      />
    </SafeAreaView>
  );
}
