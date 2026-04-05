import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { BlurView } from 'expo-blur';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConcallFiscalFilterModal } from '@/components/signal/ConcallFiscalFilterModal';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { TAB_BAR_FLOAT_MARGIN_BOTTOM } from '@/constants/tabBar';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { formatMessage } from '@/locales/messages';
import type { CalendarConcallScope } from '@/services/calendarConcallScopePreference';
import { loadCalendarConcallScope } from '@/services/calendarConcallScopePreference';
import {
  defaultConcallFiscal,
  loadConcallFiscalFilter,
  saveConcallFiscalFilter,
  type ConcallFiscalState,
} from '@/services/concallFiscalFilter';
import { loadCacheFeaturePrefs } from '@/services/cacheFeaturePreferences';
import { fetchConcallSummaries } from '@/services/concalls';
import { hasFinnhub } from '@/services/env';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import type { ConcallSummary } from '@/types/signal';

export default function CallsScreen() {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ConcallSummary[]>([]);
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
  const [calendarScope, setCalendarScope] = useState<CalendarConcallScope>('mega');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [fiscal, setFiscal] = useState<ConcallFiscalState>(defaultConcallFiscal());
  const fiscalRef = useRef(fiscal);
  fiscalRef.current = fiscal;

  const runFetch = useCallback(async (forceRefresh?: boolean) => {
    const f = fiscalRef.current;
    setError(null);
    if (!hasFinnhub()) {
      setItems([]);
      setError(t('feedErrorToken'));
      return;
    }
    const [{ concallEnabled }, watch, scope] = await Promise.all([
      loadCacheFeaturePrefs(),
      loadWatchlistSymbols(),
      loadCalendarConcallScope(),
    ]);
    setWatchlistSymbols(watch);
    setCalendarScope(scope);
    const list = await fetchConcallSummaries(3, {
      scope,
      watchlistSymbols: watch,
      fiscalYear: f.fiscalYear,
      fiscalQuarter: f.fiscalQuarter,
      forceRefresh: !!forceRefresh,
      cacheEnabled: concallEnabled,
    });
    setItems(list);
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loadedFiscal = await loadConcallFiscalFilter();
      if (cancelled) return;
      setFiscal(loadedFiscal);
      fiscalRef.current = loadedFiscal;
      setLoading(true);
      try {
        await runFetch();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '컨콜 요약을 불러오지 못했습니다.');
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runFetch]);

  useFocusEffect(
    useCallback(() => {
      void loadWatchlistSymbols().then(setWatchlistSymbols);
      void loadCalendarConcallScope().then(setCalendarScope);
    }, []),
  );

  const handleApplyQuery = useCallback(
    async (next: ConcallFiscalState) => {
      await saveConcallFiscalFilter(next);
      setFiscal(next);
      fiscalRef.current = next;
      setFilterModalVisible(false);
      setLoading(true);
      setError(null);
      try {
        await runFetch();
      } catch (e) {
        setError(e instanceof Error ? e.message : '컨콜 요약을 불러오지 못했습니다.');
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [runFetch],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await runFetch(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '새로고침 실패');
    } finally {
      setRefreshing(false);
    }
  }, [runFetch]);

  const filterReady = hasFinnhub();

  const querySummaryText = useMemo(() => {
    const qLabel = fiscal.fiscalQuarter === 0 ? t('callsFiscalAll') : `Q${fiscal.fiscalQuarter}`;
    const base = formatMessage(t('callsQuerySummary'), {
      year: fiscal.fiscalYear,
      quarter: qLabel,
    });
    const scopeSuffix =
      calendarScope === 'mega' ? t('callsQueryScopeSuffixMega') : t('callsQueryScopeSuffixWatch');
    return base + scopeSuffix;
  }, [fiscal.fiscalYear, fiscal.fiscalQuarter, calendarScope, t]);

  const emptyMessage = useMemo(() => {
    if (loading || error) return null;
    if (items.length > 0) return null;
    if (calendarScope === 'watch' && watchlistSymbols.length === 0) return t('callsEmptyWatchlistEmpty');
    if (calendarScope === 'watch') return t('callsEmptyWatchFilter');
    return t('callsEmptyGeneral');
  }, [loading, error, items.length, calendarScope, watchlistSymbols.length, t]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SignalHeader />
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={styles.callsBody}>
        <View style={styles.callsTop}>
          <Text style={styles.section}>{t('callsSectionTitle')}</Text>
          <Text style={styles.hint}>{t('callsHint')}</Text>
          {filterReady ? <Text style={styles.querySummary}>{querySummaryText}</Text> : null}

          {error ? (
            <View style={styles.errBox}>
              <Text style={styles.errText}>{error}</Text>
            </View>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loadingCenter}>
            <SignalLoadingIndicator message={t('commonLoading')} />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scroll,
              { paddingBottom: 28 + tabBarHeight + TAB_BAR_FLOAT_MARGIN_BOTTOM + insets.bottom },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />}>
            {items.map((c) => (
              <View key={c.id} style={styles.card}>
                <View style={styles.head}>
                  <Text style={styles.ticker}>{c.ticker}</Text>
                  <Text style={styles.q}>{c.quarter}</Text>
                </View>
                {c.bullets.map((b, i) => (
                  <Text key={i} style={styles.bullet}>
                    · {b}
                  </Text>
                ))}
                {c.guidance ? (
                  <View style={styles.block}>
                    <Text style={styles.label}>가이던스</Text>
                    <Text style={styles.body}>{c.guidance}</Text>
                  </View>
                ) : null}
                {c.risk ? (
                  <View style={styles.block}>
                    <Text style={styles.label}>리스크</Text>
                    <Text style={styles.body}>{c.risk}</Text>
                  </View>
                ) : null}
                <Text style={styles.ai}>
                  {c.source === 'claude' ? 'Claude AI 요약' : '폴백 / 안내'}
                </Text>
              </View>
            ))}

            {emptyMessage ? <Text style={styles.empty}>{emptyMessage}</Text> : null}
          </ScrollView>
        )}
      </View>

      {filterReady ? (
        <Pressable
          onPress={() => setFilterModalVisible(true)}
          style={({ pressed }) => [
            styles.filterFab,
            {
              bottom: tabBarHeight + TAB_BAR_FLOAT_MARGIN_BOTTOM + insets.bottom + 8,
            },
            pressed && styles.filterFabPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('a11yCallsFilter')}>
          {Platform.OS === 'web' ? (
            <View style={styles.filterFabBlurFallback} />
          ) : (
            <BlurView
              intensity={Platform.OS === 'ios' ? 100 : 85}
              tint="dark"
              experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View pointerEvents="none" style={styles.filterFabRing} />
          <FontAwesome name="filter" size={19} color={theme.green} />
        </Pressable>
      ) : null}

      <ConcallFiscalFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        appliedFiscal={fiscal}
        onApplyQuery={(f) => void handleApplyQuery(f)}
        bottomInset={insets.bottom}
      />
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    callsBody: { flex: 1 },
    callsTop: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 0,
      backgroundColor: theme.bg,
    },
    loadingCenter: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: { flex: 1 },
    scroll: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 28 },
    section: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 4 },
    hint: { fontSize: 11, color: theme.textDim, marginBottom: 8 },
    querySummary: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.textMuted,
      marginBottom: 12,
    },
    empty: { fontSize: 13, color: theme.textMuted, marginTop: 8 },
    errBox: {
      padding: 12,
      borderRadius: 10,
      backgroundColor: '#2A1515',
      borderWidth: 1,
      borderColor: '#553333',
      marginBottom: 12,
    },
    errText: { fontSize: 12, color: '#E0A0A0', lineHeight: 18 },
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 10,
    },
    head: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 10 },
    ticker: { fontSize: 18, fontWeight: '900', color: theme.green },
    q: { fontSize: 12, color: theme.textMuted, fontWeight: '600' },
    bullet: { fontSize: 13, color: theme.text, lineHeight: 20, marginBottom: 6 },
    block: {
      marginTop: 8,
      padding: 10,
      borderRadius: 8,
      backgroundColor: '#0E0E14',
      borderWidth: 1,
      borderColor: theme.border,
    },
    label: { fontSize: 10, fontWeight: '800', color: theme.accentBlue, marginBottom: 4 },
    body: { fontSize: 12, color: theme.textMuted, lineHeight: 18 },
    ai: { marginTop: 10, fontSize: 10, fontWeight: '700', color: theme.textDim },
    filterFab: {
      position: 'absolute',
      right: 16,
      width: 52,
      height: 52,
      borderRadius: 26,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 10,
    },
    filterFabBlurFallback: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(10,10,15,0.88)',
      borderRadius: 26,
    },
    filterFabRing: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 26,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    filterFabPressed: {
      opacity: 0.9,
    },
  });
}
