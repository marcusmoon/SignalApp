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
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchTopCoinsByMarketCapUsd } from '@/services/cryptoMarkets';
import { hasFinnhub } from '@/services/env';
import {
  type FinnhubQuote,
  POPULAR_SYMBOLS_ORDERED,
  fetchQuotesForSymbols,
  getSymbolsSortedByMarketCap,
} from '@/services/finnhub';
import { isValidUsTicker, loadWatchlistSymbols, saveWatchlistSymbols } from '@/services/quoteWatchlist';
import { formatRelativeFromIso } from '@/utils/date';

const POLL_MS = 30_000;

type QuoteSegment = 'watch' | 'popular' | 'mcap' | 'coin';

type Row = {
  symbol: string;
  name?: string;
  quote: FinnhubQuote | null;
  error?: string;
};

function formatPrice(n: number) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toFixed(8);
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
  const [segment, setSegment] = useState<QuoteSegment>('watch');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [updatedLabel, setUpdatedLabel] = useState<string>('');
  const [draftTicker, setDraftTicker] = useState('');

  const load = useCallback(async () => {
    setError(null);

    if (segment === 'coin') {
      try {
        const coins = await fetchTopCoinsByMarketCapUsd(20);
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
      symbols = [...POPULAR_SYMBOLS_ORDERED];
    } else {
      symbols = await getSymbolsSortedByMarketCap();
    }

    if (symbols.length === 0) {
      setRows([]);
      setUpdatedLabel('');
      return;
    }

    const list = await fetchQuotesForSymbols(symbols);
    setRows(list);
    setUpdatedLabel(formatRelativeFromIso(new Date().toISOString()));
  }, [segment]);

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
      await load();
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 28 + tabBarHeight + TAB_BAR_FLOAT_MARGIN_BOTTOM + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />}>
        <Text style={styles.section}>실시간 시세</Text>
        <Text style={styles.hint}>
          {segment === 'coin'
            ? `CoinGecko · 약 ${POLL_MS / 1000}초마다 갱신 (탭에 있을 때) · ${segmentHint}`
            : `Finnhub · 약 ${POLL_MS / 1000}초마다 갱신 (탭에 있을 때) · ${segmentHint}`}
        </Text>

        <View style={styles.segment}>
          <Pressable
            onPress={() => setSegment('watch')}
            style={[styles.segBtn, segment === 'watch' && styles.segBtnActive]}
            accessibilityState={{ selected: segment === 'watch' }}>
            <Text style={[styles.segText, segment === 'watch' && styles.segTextActive]}>관심</Text>
          </Pressable>
          <Pressable
            onPress={() => setSegment('popular')}
            style={[styles.segBtn, segment === 'popular' && styles.segBtnActive]}
            accessibilityState={{ selected: segment === 'popular' }}>
            <Text style={[styles.segText, segment === 'popular' && styles.segTextActive]}>인기순</Text>
          </Pressable>
          <Pressable
            onPress={() => setSegment('mcap')}
            style={[styles.segBtn, segment === 'mcap' && styles.segBtnActive]}
            accessibilityState={{ selected: segment === 'mcap' }}>
            <Text style={[styles.segText, segment === 'mcap' && styles.segTextActive]}>시총순</Text>
          </Pressable>
          <Pressable
            onPress={() => setSegment('coin')}
            style={[styles.segBtn, segment === 'coin' && styles.segBtnActive]}
            accessibilityState={{ selected: segment === 'coin' }}>
            <Text style={[styles.segText, segment === 'coin' && styles.segTextActive]}>{t('quotesSegmentCoin')}</Text>
          </Pressable>
        </View>

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
                    <Text style={styles.price}>{formatPrice(r.quote.c)}</Text>
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
                    {r.quote.d >= 0 ? '+' : ''}
                    {formatPrice(r.quote.d)} ({r.quote.dp >= 0 ? '+' : ''}
                    {r.quote.dp.toFixed(2)}%)
                  </Text>
                  <Text style={styles.pc}>
                    {segment === 'coin' ? t('quotesPrevRefCoin') : '전일 종'} {formatPrice(r.quote.pc)}
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
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    scrollView: { flex: 1 },
    scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 },
    section: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 4 },
    hint: { fontSize: 11, color: theme.textDim, marginBottom: 10 },
    segment: {
      flexDirection: 'row',
      backgroundColor: '#12121A',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 4,
      marginBottom: 8,
      gap: 4,
    },
    segBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segBtnActive: {
      backgroundColor: theme.green,
    },
    segText: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.textDim,
    },
    segTextActive: {
      color: '#0A0A0F',
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
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 8,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    addBtnText: { fontSize: 13, fontWeight: '800', color: theme.green },
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
