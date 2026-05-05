import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { BlurView } from 'expo-blur';
import * as WebBrowser from 'expo-web-browser';

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
import { filterKoreaRelatedNews } from '@/domain/news';
import { hasSignalApi } from '@/services/env';
import {
  loadKoreaNewsExtraKeywords,
  subscribeKoreaNewsExtraKeywordsChanged,
} from '@/services/newsKoreaKeywordsPreference';
import {
  DEFAULT_NEWS_HASHTAG_DISPLAY_MAX,
  loadNewsHashtagDisplayMax,
  subscribeNewsHashtagDisplayMaxChanged,
} from '@/services/newsHashtagDisplayPreference';
import {
  loadNewsSegmentOrder,
  subscribeNewsSegmentOrderChanged,
} from '@/services/newsSegmentOrderPreference';
import { loadNewsSegment, saveNewsSegment } from '@/services/newsSegmentPreference';
import { loadSelectedSources, saveSelectedSources } from '@/services/newsSourceSelection';
import { useResetRefreshingOnTabBlur } from '@/hooks';
import { fetchSignalInsights, fetchSignalNews, fetchSignalNewsSources, signalNewsToNewsItem } from '@/integrations/signal-api';
import type { SignalApiInsight, SignalApiNewsItem } from '@/integrations/signal-api/types';
import type { NewsItem } from '@/types/signal';
import type { MessageId } from '@/locales/messages';

const FEED_PAGE_GLOBAL = 20;
const FEED_PAGE_KOREA = 40;
const FEED_PAGE_CRYPTO = 25;
const SOURCE_PROBE_LIMIT = 100;

const NEWS_SEGMENT_LABEL: Record<NewsSegmentKey, MessageId> = {
  global: 'feedSegmentGlobal',
  korea: 'feedSegmentKorea',
  crypto: 'feedSegmentCrypto',
};

type FeedRow = { kind: 'news'; news: NewsItem } | { kind: 'ad'; key: string };

function signalSourceLabel(item: SignalApiNewsItem): string {
  const s = String(item.sourceName || '').trim();
  return s.length > 0 ? s : 'Unknown';
}

function uniqueSignalSources(items: SignalApiNewsItem[]): string[] {
  return [...new Set(items.map(signalSourceLabel))].sort((a, b) => a.localeCompare(b));
}

function buildSourcesFromCatalog(params: {
  rawSources: string[];
  catalog: { name: string; enabled: boolean; order: number }[];
}): string[] {
  const { rawSources, catalog } = params;
  const enabledCatalog = (catalog || [])
    .filter((c) => c && c.enabled)
    .slice()
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.name).localeCompare(String(b.name)))
    .map((c) => String(c.name || '').trim())
    .filter((s) => s.length > 0);

  const set = new Set(enabledCatalog);
  const extras = rawSources.filter((s) => !set.has(s));
  const out = [...enabledCatalog, ...extras];
  return out.length > 0 ? out : rawSources;
}

function filterSignalBySelectedSources(items: SignalApiNewsItem[], selected: string[]): SignalApiNewsItem[] {
  const set = new Set(selected);
  return items.filter((i) => set.has(signalSourceLabel(i)));
}

async function filterSignalNewsForKorea(items: SignalApiNewsItem[]): Promise<SignalApiNewsItem[]> {
  const extraKw = await loadKoreaNewsExtraKeywords();
  return filterKoreaRelatedNews(items, extraKw);
}

export default function FeedScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
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
  const [serverRows, setServerRows] = useState<SignalApiNewsItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [maxHashtagDisplay, setMaxHashtagDisplay] = useState(DEFAULT_NEWS_HASHTAG_DISPLAY_MAX);
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [insights, setInsights] = useState<SignalApiInsight[]>([]);
  /** 출처 필터 UI용(카탈로그 비었을 때 샘플 + 첫 페이지 병합) */
  const [signalNewsPool, setSignalNewsPool] = useState<SignalApiNewsItem[]>([]);

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

  useEffect(() => {
    void loadNewsHashtagDisplayMax().then(setMaxHashtagDisplay);
    return subscribeNewsHashtagDisplayMaxChanged(() => {
      void loadNewsHashtagDisplayMax().then(setMaxHashtagDisplay);
    });
  }, []);

  const load = useCallback(
    async (forceRefresh?: boolean) => {
      setError(null);
      setHasMore(false);
      setLoadingMore(false);
      if (!hasSignalApi()) {
        setItems([]);
        setServerRows([]);
        setSignalNewsPool([]);
        setAvailableSources([]);
        setSelectedSources([]);
        setInsights([]);
        setError(t('errorSignalApiShort'));
        return;
      }

      const cacheMode = forceRefresh ? 'bypass' : 'use';

      let catalogRows: { name: string; enabled: boolean; order: number }[] = [];
      try {
        const rows = await fetchSignalInsights({ limit: 6 });
        setInsights(rows);
      } catch {
        setInsights([]);
      }

      try {
        const catKey = segment === 'crypto' ? 'crypto' : 'global';
        const cat = await fetchSignalNewsSources({ category: catKey }, { cacheMode });
        catalogRows = cat.map((c) => ({ name: c.name, enabled: c.enabled, order: c.order }));
      } catch {
        catalogRows = [];
      }

      if (segment === 'crypto') {
        setSignalNewsPool([]);
        setAvailableSources([]);
        setSelectedSources([]);
        const { items: rows, meta } = await fetchSignalNews(
          {
            locale,
            category: 'crypto',
            limit: FEED_PAGE_CRYPTO,
            offset: 0,
            tag: activeTag || undefined,
          },
          { cacheMode },
        );
        setServerRows(rows);
        setHasMore(meta.hasMore);
        setItems(rows.map((item) => signalNewsToNewsItem(item, locale)));
        return;
      }

      const enabledCatalog = (catalogRows || [])
        .filter((c) => c && c.enabled)
        .slice()
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.name).localeCompare(String(b.name)))
        .map((c) => String(c.name || '').trim())
        .filter((s) => s.length > 0);

      let probe: SignalApiNewsItem[] = [];
      if (enabledCatalog.length === 0) {
        const p = await fetchSignalNews(
          {
            locale,
            category: 'global',
            limit: SOURCE_PROBE_LIMIT,
            offset: 0,
            tag: activeTag || undefined,
          },
          { cacheMode },
        );
        probe = p.items;
      }

      const pageLimit = segment === 'korea' ? FEED_PAGE_KOREA : FEED_PAGE_GLOBAL;
      const { items: firstPage, meta } = await fetchSignalNews(
        {
          locale,
          category: 'global',
          limit: pageLimit,
          offset: 0,
          tag: activeTag || undefined,
        },
        { cacheMode },
      );
      setServerRows(firstPage);
      setHasMore(meta.hasMore);

      const mergedForSources = [...probe, ...firstPage];
      setSignalNewsPool(mergedForSources);
      const rawSources = uniqueSignalSources(mergedForSources);
      const sources =
        enabledCatalog.length > 0 ? enabledCatalog : buildSourcesFromCatalog({ rawSources, catalog: catalogRows });
      setAvailableSources(sources);
      const selected = await loadSelectedSources(sources);
      setSelectedSources(selected);
      let scoped = filterSignalBySelectedSources(firstPage, selected);
      if (segment === 'korea') {
        scoped = await filterSignalNewsForKorea(scoped);
      }
      setItems(scoped.map((item) => signalNewsToNewsItem(item, locale)));
    },
    [activeTag, locale, segment, t],
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading || !hasSignalApi()) return;
    if (segment !== 'crypto' && segment !== 'global' && segment !== 'korea') return;

    setLoadingMore(true);
    setError(null);
    try {
      const pageLimit =
        segment === 'korea' ? FEED_PAGE_KOREA : segment === 'crypto' ? FEED_PAGE_CRYPTO : FEED_PAGE_GLOBAL;
      const category = segment === 'crypto' ? 'crypto' : 'global';
      const { items: nextRows, meta } = await fetchSignalNews(
        {
          locale,
          category,
          limit: pageLimit,
          offset: serverRows.length,
          tag: activeTag || undefined,
        },
        { cacheMode: 'use' },
      );
      const merged = [...serverRows, ...nextRows];
      setServerRows(merged);
      setHasMore(meta.hasMore);
      let scoped = filterSignalBySelectedSources(merged, selectedSources);
      if (segment === 'korea') {
        scoped = await filterSignalNewsForKorea(scoped);
      }
      setItems(scoped.map((item) => signalNewsToNewsItem(item, locale)));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('feedErrorLoad'));
    } finally {
      setLoadingMore(false);
    }
  }, [
    activeTag,
    hasMore,
    loading,
    loadingMore,
    locale,
    segment,
    selectedSources,
    serverRows,
    t,
  ]);

  useEffect(() => {
    return subscribeKoreaNewsExtraKeywordsChanged(() => {
      if (segment === 'korea') void load(false);
    });
  }, [segment, load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('feedErrorLoad'));
          setItems([]);
          setServerRows([]);
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
      await load(true);
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
        if (serverRows.length > 0 && (segment === 'global' || segment === 'korea')) {
          let scoped = filterSignalBySelectedSources(serverRows, next);
          if (segment === 'korea') {
            scoped = await filterSignalNewsForKorea(scoped);
          }
          setItems(scoped.map((item) => signalNewsToNewsItem(item, locale)));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t('feedErrorLoad'));
      }
    },
    [locale, segment, serverRows, t],
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

  const listData: FeedRow[] = useMemo(() => {
    const out: FeedRow[] = [];
    items.forEach((news, i) => {
      out.push({ kind: 'news', news });
      if ((i + 1) % 5 === 0) {
        out.push({ kind: 'ad', key: `ad-${news.id}` });
      }
    });
    return out;
  }, [items]);

  const emptyMessage =
    !loading && items.length === 0 && !error
      ? segment === 'korea'
        ? t('feedEmptyKorea')
        : t('feedEmpty')
      : null;

  const bottomPad = 28 + tabBarHeight + TAB_BAR_FLOAT_MARGIN_BOTTOM + insets.bottom;

  const listHeaderEl = useMemo(
    () => (
      <View style={styles.listHeader}>
        {insights.length > 0 ? (
          <View style={styles.insightSection}>
            <View style={styles.insightSectionHead}>
              <Text style={styles.insightKicker}>{t('insightSectionKicker')}</Text>
              <Text style={styles.insightCount}>{t('insightSectionCount', { count: insights.length })}</Text>
            </View>
            {insights.slice(0, 3).map((insight) => {
              const primaryRef = insight.sourceRefs?.find((ref) => ref.url);
              return (
                <Pressable
                  key={insight.id}
                  onPress={() => {
                    if (primaryRef?.url) void WebBrowser.openBrowserAsync(primaryRef.url);
                  }}
                  disabled={!primaryRef?.url}
                  style={({ pressed }) => [styles.insightCard, pressed && Boolean(primaryRef?.url) && styles.insightCardPressed]}>
                  <View style={styles.insightCardHead}>
                    <Text style={styles.insightLevel}>{insight.level.toUpperCase()}</Text>
                    <Text style={styles.insightScore}>{insight.score}</Text>
                  </View>
                  <Text style={styles.insightTitle}>{insight.title}</Text>
                  <Text style={styles.insightSummary}>{insight.summary}</Text>
                  <View style={styles.insightMetaRow}>
                    {insight.symbols.slice(0, 3).map((symbol) => (
                      <Text key={`${insight.id}-${symbol}`} style={styles.insightSymbol}>
                        {symbol}
                      </Text>
                    ))}
                    {primaryRef?.sourceName ? (
                      <Text style={styles.insightRef} numberOfLines={1}>
                        {primaryRef.sourceName}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.section}>{t('feedSectionTitle')}</Text>

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

        {activeTag ? (
          <View style={styles.tagFilterRow}>
            <Text style={styles.tagFilterText} numberOfLines={1}>
              {t('feedTagFilterActive', { tag: activeTag })}
            </Text>
            <Pressable
              onPress={() => setActiveTag(null)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('feedTagFilterClear')}>
              <Text style={styles.tagFilterClear}>{t('feedTagFilterClear')}</Text>
            </Pressable>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.skeletonBlock}>
            <SkeletonFeed />
            <SkeletonFeed />
            <SkeletonFeed />
          </View>
        ) : null}
      </View>
    ),
    [activeTag, error, insights, loading, onPickSegment, segment, segmentOrder, styles, t],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SignalHeader />
      {isFocused ? <OtaUpdateBanner /> : null}
      <FlatList
        data={loading ? [] : listData}
        keyExtractor={(row) => (row.kind === 'ad' ? row.key : row.news.id)}
        renderItem={({ item }) =>
          item.kind === 'ad' ? (
            <AdPlaceholder />
          ) : (
            <NewsCard
              item={item.news}
              maxHashtagsToShow={maxHashtagDisplay}
              onTagPress={(label) => {
                const next = label.trim();
                if (next) setActiveTag(next);
              }}
            />
          )
        }
        ListHeaderComponent={listHeaderEl}
        ListEmptyComponent={
          emptyMessage ? (
            <Text style={[styles.empty, { paddingHorizontal: 16 }]}>{emptyMessage}</Text>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color={theme.green} />
              <Text style={styles.footerLoadingText}>{t('feedLoadingMore')}</Text>
            </View>
          ) : null
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.35}
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={8}
        windowSize={7}
        maxToRenderPerBatch={12}
      />

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

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    list: {
      flex: 1,
      minHeight: 0,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    listHeader: {
      paddingBottom: 4,
    },
    skeletonBlock: {
      marginTop: 4,
    },
    insightSection: {
      marginBottom: 14,
      gap: 8,
    },
    insightSectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    insightKicker: {
      color: theme.text,
      fontSize: sf(16),
      fontWeight: '900',
    },
    insightCount: {
      color: theme.textMuted,
      fontSize: sf(12),
      fontWeight: '800',
    },
    insightCard: {
      padding: 13,
      borderRadius: 12,
      borderWidth: 1,
      borderLeftWidth: 3,
      borderColor: theme.greenBorder,
      borderLeftColor: theme.green,
      backgroundColor: theme.card,
      gap: 7,
    },
    insightCardPressed: {
      opacity: 0.88,
    },
    insightCardHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    insightLevel: {
      color: theme.green,
      fontSize: sf(11),
      fontWeight: '900',
    },
    insightScore: {
      color: theme.textMuted,
      fontSize: sf(12),
      fontWeight: '900',
    },
    insightTitle: {
      color: theme.text,
      fontSize: sf(15),
      lineHeight: sf(20),
      fontWeight: '900',
    },
    insightSummary: {
      color: theme.textMuted,
      fontSize: sf(12),
      lineHeight: sf(18),
      fontWeight: '600',
    },
    insightMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    insightSymbol: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      overflow: 'hidden',
      color: theme.green,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      fontSize: sf(11),
      fontWeight: '900',
    },
    insightRef: {
      flex: 1,
      minWidth: 0,
      color: theme.textDim,
      fontSize: sf(11),
      fontWeight: '700',
    },
    tagFilterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    tagFilterText: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(12),
      fontWeight: '800',
      color: theme.text,
    },
    tagFilterClear: {
      fontSize: sf(12),
      fontWeight: '800',
      color: theme.green,
    },
    footerLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 16,
    },
    footerLoadingText: {
      fontSize: sf(12),
      color: theme.textMuted,
    },
    section: {
      fontSize: sf(16),
      fontWeight: '800',
      color: theme.text,
      marginBottom: 4,
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
      fontSize: sf(SEGMENT_TAB_FONT_SIZE),
      lineHeight: sf(SEGMENT_TAB_LINE_HEIGHT),
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
      fontSize: sf(12),
      color: '#E0A0A0',
      lineHeight: sf(18),
    },
    empty: {
      fontSize: sf(13),
      color: theme.textMuted,
      marginTop: 8,
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
