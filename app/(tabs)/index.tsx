import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import {
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { BlurView } from 'expo-blur';

import { TAB_BAR_FLOAT_MARGIN_BOTTOM } from '@/constants/tabBar';
import { DEFAULT_NEWS_SEGMENT, NEWS_SEGMENT_ORDER, type NewsSegmentKey } from '@/constants/newsSegment';
import type { AppTheme } from '@/constants/theme';
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
import { AdPlaceholder } from '@/components/signal/AdPlaceholder';
import { NewsSourceFilterModal } from '@/components/signal/NewsSourceFilterModal';
import { NewsCard } from '@/components/signal/NewsCard';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SkeletonFeed } from '@/components/signal/SkeletonFeed';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { loadCacheFeaturePrefs } from '@/services/cacheFeaturePreferences';
import { hasFinnhub } from '@/services/env';
import {
  fetchMarketNews,
  mergeNewsById,
  type FinnhubNewsRaw,
} from '@/services/finnhub';
import { buildNewsCacheKey, peekNewsCache, storeNewsCache } from '@/services/newsCache';
import { filterKoreaRelatedNews } from '@/services/newsKoreaFilter';
import {
  loadKoreaNewsExtraKeywords,
  subscribeKoreaNewsExtraKeywordsChanged,
} from '@/services/newsKoreaKeywordsPreference';
import {
  loadNewsSegmentOrder,
  subscribeNewsSegmentOrderChanged,
} from '@/services/newsSegmentOrderPreference';
import { loadNewsSegment, saveNewsSegment } from '@/services/newsSegmentPreference';
import { loadSelectedSources, saveSelectedSources } from '@/services/newsSourceSelection';
import { useResetRefreshingOnTabBlur } from '@/hooks/useResetRefreshingOnTabBlur';
import { summarizeNewsWithClaude } from '@/services/anthropic';
import type { NewsItem } from '@/types/signal';
import type { MessageId } from '@/locales/messages';

const NEWS_SEGMENT_LABEL: Record<NewsSegmentKey, MessageId> = {
  global: 'feedSegmentGlobal',
  korea: 'feedSegmentKorea',
  crypto: 'feedSegmentCrypto',
};

function normalizeSource(raw: FinnhubNewsRaw): string {
  const s = raw.source?.trim();
  return s && s.length > 0 ? s : 'Unknown';
}

function sliceForDisplay(raw: FinnhubNewsRaw[], selected: string[]): FinnhubNewsRaw[] {
  const setSel = new Set(selected);
  let filtered = raw.filter((r) => setSel.has(normalizeSource(r)));
  if (filtered.length === 0) filtered = raw;
  return filtered.slice(0, 12);
}

export default function FeedScreen() {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [segment, setSegment] = useState<NewsSegmentKey>(DEFAULT_NEWS_SEGMENT);
  const [segmentOrder, setSegmentOrder] = useState<NewsSegmentKey[]>([...NEWS_SEGMENT_ORDER]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [rawPool, setRawPool] = useState<FinnhubNewsRaw[]>([]);
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  useEffect(() => {
    void loadNewsSegment().then((s) => setSegment(s));
  }, []);

  useEffect(() => {
    void loadNewsSegmentOrder().then((o) => setSegmentOrder(o));
  }, []);

  useEffect(() => {
    return subscribeNewsSegmentOrderChanged(() => {
      void loadNewsSegmentOrder().then((o) => setSegmentOrder(o));
    });
  }, []);

  const summarizeFromPool = useCallback(async (raw: FinnhubNewsRaw[], selected: string[]) => {
    const slice = sliceForDisplay(raw, selected);
    return summarizeNewsWithClaude(slice);
  }, []);

  const load = useCallback(async (opts?: { forceRefresh?: boolean }) => {
    setError(null);
    if (!hasFinnhub()) {
      setItems([]);
      setRawPool([]);
      setAvailableSources([]);
      setSelectedSources([]);
      setError(t('feedErrorToken'));
      return;
    }

    const cachePrefs = await loadCacheFeaturePrefs();
    const newsCacheEnabled = cachePrefs.newsEnabled;
    const cacheKey = await buildNewsCacheKey(segment);

    let raw: FinnhubNewsRaw[];
    const hit = newsCacheEnabled && !opts?.forceRefresh ? peekNewsCache(cacheKey) : null;
    if (hit) {
      raw = hit;
    } else {
      if (segment === 'global') {
        raw = await fetchMarketNews('general');
      } else if (segment === 'crypto') {
        raw = await fetchMarketNews('crypto');
      } else {
        const [g, fx, extraKw] = await Promise.all([
          fetchMarketNews('general'),
          fetchMarketNews('forex'),
          loadKoreaNewsExtraKeywords(),
        ]);
        raw = filterKoreaRelatedNews(mergeNewsById(g, fx), extraKw);
      }
      if (newsCacheEnabled) {
        storeNewsCache(cacheKey, raw);
      }
    }

    const sources = [...new Set(raw.map((r) => normalizeSource(r)))].sort((a, b) => a.localeCompare(b));
    setRawPool(raw);
    setAvailableSources(sources);
    const selected = await loadSelectedSources(sources);
    setSelectedSources(selected);
    const summarized = await summarizeFromPool(raw, selected);
    setItems(summarized);
  }, [segment, summarizeFromPool, t]);

  useEffect(() => {
    return subscribeKoreaNewsExtraKeywordsChanged(() => {
      if (segment === 'korea') void load();
    });
  }, [segment, load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('feedErrorLoad'));
          setItems([]);
          setRawPool([]);
          setAvailableSources([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, t]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load({ forceRefresh: true });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('feedErrorRefresh'));
    } finally {
      setRefreshing(false);
    }
  }, [load, t]);

  const applySelection = useCallback(
    async (next: string[]) => {
      try {
        await saveSelectedSources(next);
        setSelectedSources(next);
        const summarized = await summarizeFromPool(rawPool, next);
        setItems(summarized);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('feedErrorLoad'));
      }
    },
    [rawPool, summarizeFromPool, t],
  );

  const toggleSource = useCallback(
    async (source: string) => {
      if (!selectedSources.includes(source)) {
        const next = [...selectedSources, source];
        await applySelection(next);
        return;
      }
      if (selectedSources.length <= 1) {
        Alert.alert(t('alertTitleMinOne'), t('alertMinNewsSource'));
        return;
      }
      const next = selectedSources.filter((s) => s !== source);
      await applySelection(next);
    },
    [applySelection, selectedSources, t],
  );

  const selectAllSources = useCallback(async () => {
    const next = [...availableSources];
    await applySelection(next);
  }, [applySelection, availableSources]);

  const onPickSegment = useCallback((key: NewsSegmentKey) => {
    setSegment(key);
    void saveNewsSegment(key);
  }, []);

  const filterReady = availableSources.length > 0 && !error;

  const emptyMessage =
    !loading && items.length === 0 && !error
      ? segment === 'korea'
        ? t('feedEmptyKorea')
        : t('feedEmpty')
      : null;

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
        <Text style={styles.section}>{t('feedSectionTitle')}</Text>
        <Text style={styles.hint}>{t('feedHint')}</Text>

        <View style={styles.segment}>
          {segmentOrder.map((key) => (
            <Pressable
              key={key}
              onPress={() => onPickSegment(key)}
              style={[styles.segBtn, segment === key && styles.segBtnActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: segment === key }}>
              <Text style={[styles.segText, segment === key && styles.segTextActive]}>
                {t(NEWS_SEGMENT_LABEL[key])}
              </Text>
            </Pressable>
          ))}
        </View>

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <>
            <SkeletonFeed />
            <SkeletonFeed />
            <SkeletonFeed />
          </>
        ) : (
          items.map((item, index) => (
            <View key={item.id}>
              <NewsCard item={item} />
              {(index + 1) % 5 === 0 ? <AdPlaceholder /> : null}
            </View>
          ))
        )}

        {emptyMessage ? <Text style={styles.empty}>{emptyMessage}</Text> : null}

        {!loading ? (
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>{t('feedDisclaimer')}</Text>
          </View>
        ) : null}
      </ScrollView>

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
          accessibilityLabel={t('a11yNewsFilter')}>
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

      <NewsSourceFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        sources={availableSources}
        selected={selectedSources}
        onToggle={(source) => void toggleSource(source)}
        onSelectAll={() => void selectAllSources()}
        bottomInset={insets.bottom}
      />
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    scrollView: {
      flex: 1,
      minHeight: 0,
    },
    scroll: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 28,
    },
    section: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 4,
    },
    hint: {
      fontSize: 11,
      color: theme.textDim,
      marginBottom: 10,
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: SEGMENT_TAB_BACKGROUND,
      borderRadius: SEGMENT_TAB_OUTER_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: SEGMENT_TAB_PADDING,
      marginBottom: 12,
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
    errBox: {
      padding: 12,
      borderRadius: 10,
      backgroundColor: '#2A1515',
      borderWidth: 1,
      borderColor: '#553333',
      marginBottom: 12,
    },
    errText: {
      fontSize: 12,
      color: '#E0A0A0',
      lineHeight: 18,
    },
    empty: {
      fontSize: 13,
      color: theme.textMuted,
      marginTop: 8,
    },
    disclaimer: {
      marginTop: 8,
      padding: 12,
      borderRadius: 10,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    disclaimerText: {
      fontSize: 11,
      color: theme.textDim,
      lineHeight: 16,
    },
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
