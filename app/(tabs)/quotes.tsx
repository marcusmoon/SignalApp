import { useCallback, useMemo, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalHeader } from '@/components/signal/SignalHeader';
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
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { loadCacheFeaturePrefs } from '@/services/cacheFeaturePreferences';
import { fetchTopCoinsByMarketCapUsd } from '@/services/cryptoMarkets';
import { hasFinnhub } from '@/services/env';
import {
  type FinnhubQuote,
  POPULAR_SYMBOLS_ORDERED,
  fetchQuotesForSymbols,
  getSymbolsSortedByMarketCap,
} from '@/services/finnhub';
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
  QUOTES_POLL_INTERVAL_MS,
  storeMcapSymbolsOrder,
  storeQuotes,
  type QuoteCacheRow,
} from '@/services/quotesCache';
import {
  isValidUsTicker,
  loadWatchlistSymbols,
  resetWatchlistToDefaults,
  saveWatchlistSymbols,
} from '@/services/quoteWatchlist';
import { formatRelativeFromIso } from '@/utils/date';
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

export default function QuotesScreen() {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [segment, setSegment] = useState<QuoteSegmentKey>('watch');
  const [segmentOrder, setSegmentOrder] = useState<QuoteSegmentKey[]>(DEFAULT_QUOTES_SEGMENT_ORDER);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [updatedLabel, setUpdatedLabel] = useState<string>('');
  const [draftTicker, setDraftTicker] = useState('');

  const load = useCallback(async (forceRefresh?: boolean) => {
    setError(null);
    const { quotesEnabled } = await loadCacheFeaturePrefs();
    const limits = await loadQuotesListLimits();

    if (segment === 'coin') {
      const cacheKey = buildQuotesCacheKey('coin', [], limits.coinMax);
      if (quotesEnabled && !forceRefresh) {
        const hit = peekQuotes(cacheKey);
        if (hit) {
          setRows(hit);
          setUpdatedLabel(formatRelativeFromIso(new Date().toISOString()));
          return;
        }
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
            return { symbol: sym || '—', name: c.name, quote: null, error: '가격 없음' };
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
        setUpdatedLabel(formatRelativeFromIso(new Date().toISOString()));
        if (quotesEnabled) storeQuotes(cacheKey, list);
      } catch (e) {
        setRows([]);
        setUpdatedLabel('');
        setError(e instanceof Error ? e.message : '코인 시세를 불러오지 못했습니다.');
      }
      return;
    }

    if (!hasFinnhub()) {
      setRows([]);
      setUpdatedLabel('');
      setError('EXPO_PUBLIC_FINNHUB_TOKEN 이 필요합니다.');
      return;
    }

    let symbols: string[] = [];
    if (segment === 'watch') {
      symbols = await loadWatchlistSymbols();
    } else if (segment === 'popular') {
      symbols = [...POPULAR_SYMBOLS_ORDERED].slice(0, limits.popularMax);
    } else {
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

    if (symbols.length === 0) {
      setRows([]);
      setUpdatedLabel('');
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
        setRows(hit);
        setUpdatedLabel(formatRelativeFromIso(new Date().toISOString()));
        return;
      }
    }

    const list = await fetchQuotesForSymbols(symbols);
    setRows(list);
    setUpdatedLabel(formatRelativeFromIso(new Date().toISOString()));
    if (quotesEnabled) storeQuotes(cacheKey, list);
  }, [segment]);

  useFocusEffect(
    useCallback(() => {
      void loadQuotesSegmentOrder().then(setSegmentOrder);
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let interval: ReturnType<typeof setInterval> | undefined;

      (async () => {
        setLoading(true);
        try {
          await load();
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : '시세를 불러오지 못했습니다.');
            setRows([]);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      interval = setInterval(() => {
        void load();
      }, POLL_MS);

      return () => {
        cancelled = true;
        if (interval) clearInterval(interval);
      };
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '새로고침 실패');
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const onAddWatch = useCallback(async () => {
    const raw = draftTicker.trim();
    if (!raw) return;
    if (!isValidUsTicker(raw)) {
      Alert.alert('형식 오류', '영문·숫자·.(점)·-(하이픈) 조합 티커만 입력해 주세요.');
      return;
    }
    const sym = raw.toUpperCase().replace(/\s+/g, '');
    const current = await loadWatchlistSymbols();
    if (current.includes(sym)) {
      Alert.alert('알림', '이미 관심 목록에 있습니다.');
      return;
    }
    await saveWatchlistSymbols([...current, sym]);
    setDraftTicker('');
    await load();
  }, [draftTicker, load]);

  const onRemoveWatch = useCallback(
    async (symbol: string) => {
      const current = await loadWatchlistSymbols();
      await saveWatchlistSymbols(current.filter((s) => s !== symbol));
      await load();
    },
    [load],
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

  const segmentHint =
    segment === 'watch'
      ? '저장된 티커 · 아래에서 추가/삭제'
      : segment === 'popular'
        ? '거래·관심이 많은 순(고정 큐레이션)'
        : segment === 'mcap'
          ? 'Finnhub 시가총액 기준 상위 종목'
          : t('quotesHintCoin');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SignalHeader />
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={styles.mainColumn}>
        <View style={styles.topFixed}>
          <Text style={styles.section}>실시간 시세</Text>
          <Text style={styles.hint}>
            {segment === 'coin'
              ? `CoinGecko · 약 ${POLL_MS / 1000}초마다 갱신 (탭에 있을 때) · ${segmentHint}`
              : `Finnhub · 약 ${POLL_MS / 1000}초마다 갱신 (탭에 있을 때) · ${segmentHint}`}
          </Text>

          <View style={styles.segment}>
            {segmentOrder.map((key) => (
              <Pressable
                key={key}
                onPress={() => setSegment(key)}
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
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 28 + tabBarHeight + TAB_BAR_FLOAT_MARGIN_BOTTOM + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />}>
        {updatedLabel ? <Text style={styles.updated}>마지막 갱신 · {updatedLabel}</Text> : null}

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
              placeholder="티커 (예: AAPL)"
              placeholderTextColor={theme.textDim}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.addInput}
              onSubmitEditing={() => void onAddWatch()}
              returnKeyType="done"
            />
            <Pressable onPress={() => void onAddWatch()} style={styles.addBtn} accessibilityRole="button">
              <Text style={styles.addBtnText}>추가</Text>
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

        {loading && rows.length === 0 ? <Text style={styles.loading}>불러오는 중…</Text> : null}

        {!loading &&
          rows.map((r) => (
            <View key={`${r.symbol}-${r.name ?? ''}`} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.symCol}>
                  <Text style={styles.sym}>{r.symbol}</Text>
                  {segment === 'coin' && r.name ? (
                    <Text style={styles.symSub} numberOfLines={1}>
                      {r.name}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.cardTopRight}>
                  {r.quote ? (
                    <Text style={styles.price}>{formatUsd(r.quote.c)}</Text>
                  ) : (
                    <Text style={styles.na}>—</Text>
                  )}
                  {segment === 'watch' ? (
                    <Pressable
                      onPress={() => void onRemoveWatch(r.symbol)}
                      style={styles.removeBtn}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`${r.symbol} 관심 해제`}>
                      <FontAwesome name="times-circle" size={18} color={theme.textDim} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
              {r.quote ? (
                <View style={styles.cardMid}>
                  <Text style={[styles.chg, r.quote.d >= 0 ? styles.chgUp : styles.chgDn]}>
                    {formatUsdChange(r.quote.d)} ({r.quote.dp >= 0 ? '+' : ''}
                    {r.quote.dp.toFixed(2)}%)
                  </Text>
                  <Text style={styles.pc}>
                    {segment === 'coin' ? t('quotesPrevRefCoin') : '전일 종'} {formatUsd(r.quote.pc)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.fail}>{r.error ?? '데이터 없음'}</Text>
              )}
            </View>
          ))}

        {!loading && rows.length === 0 && !error ? (
          <Text style={styles.empty}>
            {segment === 'watch'
              ? '관심 종목이 없습니다. 티커를 추가해 주세요.'
              : '표시할 시세가 없습니다.'}
          </Text>
        ) : null}

        <View style={styles.note}>
          <Text style={styles.noteText}>
            {segment === 'coin'
              ? t('quotesFooterCoin')
              : '인기순은 앱에서 지정한 순서입니다. 시총순은 Finnhub 프로필의 시가총액(백만 USD)으로 정렬합니다. 장 마감 후에는 마지막 거래가 기준일 수 있습니다.'}
          </Text>
        </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    mainColumn: { flex: 1 },
    topFixed: {
      flexShrink: 0,
      paddingHorizontal: 16,
      paddingTop: 8,
      backgroundColor: theme.bg,
    },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 28 },
    section: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 4 },
    hint: { fontSize: 11, color: theme.textDim, marginBottom: 10 },
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
      fontSize: SEGMENT_TAB_FONT_SIZE,
      lineHeight: SEGMENT_TAB_LINE_HEIGHT,
      fontWeight: SEGMENT_TAB_FONT_WEIGHT,
      color: theme.textDim,
    },
    segTextActive: {
      color: SEGMENT_TAB_ACTIVE_TEXT,
    },
    updated: { fontSize: 10, color: theme.textMuted, marginBottom: 10 },
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
      fontSize: 14,
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
    addBtnText: { fontSize: 13, fontWeight: '800', color: theme.green },
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
    watchResetBtnText: { fontSize: 13, fontWeight: '700', color: '#E0A0A0' },
    loading: { fontSize: 13, color: theme.textMuted, marginBottom: 12 },
    errBox: {
      padding: 12,
      borderRadius: 10,
      backgroundColor: '#2A1515',
      borderWidth: 1,
      borderColor: '#553333',
      marginBottom: 12,
    },
    errText: { fontSize: 12, color: '#E0A0A0', lineHeight: 18 },
    empty: { fontSize: 13, color: theme.textMuted, marginTop: 8 },
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 10,
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    symCol: { flex: 1, minWidth: 0 },
    sym: { fontSize: 16, fontWeight: '900', color: theme.text, letterSpacing: 0.5 },
    symSub: { fontSize: 11, fontWeight: '600', color: theme.textMuted, marginTop: 2 },
    price: { fontSize: 18, fontWeight: '800', color: theme.text },
    na: { fontSize: 16, color: theme.textDim },
    removeBtn: { padding: 2 },
    cardMid: { gap: 4 },
    chg: { fontSize: 13, fontWeight: '700' },
    chgUp: { color: theme.green },
    chgDn: { color: '#E08080' },
    pc: { fontSize: 11, color: theme.textMuted },
    fail: { fontSize: 12, color: '#E0A0A0' },
    note: {
      marginTop: 6,
      padding: 12,
      borderRadius: 10,
      backgroundColor: '#12121A',
      borderWidth: 1,
      borderColor: theme.border,
    },
    noteText: { fontSize: 11, color: theme.textDim, lineHeight: 16 },
  });
}
