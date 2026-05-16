import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { TAB_BAR_FLOAT_MARGIN_BOTTOM } from '@/constants/tabBar';
import { DEFAULT_NEWS_SEGMENT, NEWS_SEGMENT_ORDER, type NewsSegmentKey } from '@/constants/newsSegment';
import type { AppTheme } from '@/constants/theme';
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
import { AdPlaceholder } from '@/components/signal/AdPlaceholder';
import { NewsSourceFilterModal } from '@/components/signal/NewsSourceFilterModal';
import { FloatingGlassFab, FLOATING_GLASS_FAB_GAP, FLOATING_GLASS_FAB_SIZE } from '@/components/signal/FloatingGlassFab';
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
import { createScrollLoadMoreGate } from '@/utils/listScrollLoadMoreGate';
import { fetchSignalNews, fetchSignalNewsSources, signalNewsToNewsItem } from '@/integrations/signal-api';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiNewsItem } from '@/integrations/signal-api/types';
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
type FeedLoadResult = { newsIds: string[]; insightIds: string[] };

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
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  /** 출처 필터 UI용(카탈로그 비었을 때 샘플 + 첫 페이지 병합) */
  const [signalNewsPool, setSignalNewsPool] = useState<SignalApiNewsItem[]>([]);

  /** 웹: 리스트 콘텐츠 높이 < 뷰포트면 onEndReached가 안 나와 다음 페이지를 못 불러오는 경우가 있음 */
  const feedListViewportH = useRef(0);
  const feedScrollLoadGateRef = useRef(createScrollLoadMoreGate());

  useEffect(() => {
    if (!refreshNotice) return;
    const timeout = setTimeout(() => setRefreshNotice(null), 4500);
    return () => clearTimeout(timeout);
  }, [refreshNotice]);

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
    async (forceRefresh?: boolean): Promise<FeedLoadResult> => {
      setError(null);
      setHasMore(false);
      setLoadingMore(false);
      if (!hasSignalApi()) {
        setItems([]);
        setServerRows([]);
        setSignalNewsPool([]);
        setAvailableSources([]);
        setSelectedSources([]);
        setError(t('errorSignalApiShort'));
        return { newsIds: [], insightIds: [] };
      }

      const cacheMode = forceRefresh ? 'bypass' : 'use';

      let catalogRows: { name: string; enabled: boolean; order: number }[] = [];
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
        const mapped = rows.map((item) => signalNewsToNewsItem(item, locale));
        setItems(mapped);
        return { newsIds: mapped.map((item) => item.id), insightIds: [] };
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
      const mapped = scoped.map((item) => signalNewsToNewsItem(item, locale));
      setItems(mapped);
      return { newsIds: mapped.map((item) => item.id), insightIds: [] };
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
      if (nextRows.length === 0) {
        setHasMore(false);
        return;
      }
      const merged = [...serverRows, ...nextRows];
      setServerRows(merged);
      setHasMore(meta.hasMore);
      let scoped = filterSignalBySelectedSources(merged, selectedSources);
      if (segment === 'korea') {
        scoped = await filterSignalNewsForKorea(scoped);
      }
      setItems(scoped.map((item) => signalNewsToNewsItem(item, locale)));
    } catch (e) {
      setError(formatSignalApiError(e, t, 'feedErrorLoad'));
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

  const onFeedScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      feedScrollLoadGateRef.current.onScrollNearEnd(e, {
        enabled:
          hasMore &&
          !loadingMore &&
          !loading &&
          hasSignalApi() &&
          (segment === 'crypto' || segment === 'global' || segment === 'korea'),
        trigger: () => void loadMore(),
      });
    },
    [hasMore, loadingMore, loading, segment, loadMore],
  );

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
          setError(formatSignalApiError(e, t, 'feedErrorLoad'));
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
    const prevNewsIds = new Set(items.map((item) => item.id));
    setRefreshing(true);
    setRefreshNotice(null);
    try {
      const result = await load(true);
      setError(null);
      const newNewsCount = result.newsIds.filter((id) => !prevNewsIds.has(id)).length;
      if (newNewsCount > 0) {
        setRefreshNotice(t('feedRefreshNoticeNews', { count: String(newNewsCount) }));
      }
    } catch (e) {
      setError(formatSignalApiError(e, t, 'feedErrorRefresh'));
    } finally {
      setRefreshing(false);
    }
  }, [items, load, t]);

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
        setError(formatSignalApiError(e, t, 'feedErrorLoad'));
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
    if (segment === key) return;
    setLoading(true);
    setItems([]);
    setServerRows([]);
    setHasMore(false);
    setError(null);
    setRefreshNotice(null);
    setSegment(key);
    void saveNewsSegment(key);
  }, [segment]);

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
  const fabStackBottom = tabBarHeight + TAB_BAR_FLOAT_MARGIN_BOTTOM + insets.bottom + 8;

  const listHeaderEl = useMemo(
    () => (
      <View style={styles.listHeader}>
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
    [
      activeTag,
      error,
      loading,
      styles,
      t,
    ],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SignalHeader />
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={styles.mainColumn}>
        <View style={styles.topFixed}>
          {refreshNotice ? (
            <View style={styles.refreshNotice}>
              <FontAwesome name="check-circle" size={13} color={theme.green} />
              <Text style={styles.refreshNoticeText} numberOfLines={2}>
                {refreshNotice}
              </Text>
            </View>
          ) : null}
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
        </View>

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
          onEndReachedThreshold={0.55}
          onScroll={onFeedScroll}
          scrollEventThrottle={350}
          onLayout={
            Platform.OS === 'web'
              ? (e) => {
                  feedListViewportH.current = e.nativeEvent.layout.height;
                }
              : undefined
          }
          onContentSizeChange={
            Platform.OS === 'web'
              ? (_, h) => {
                  if (!hasMore || loadingMore || loading) return;
                  const vh = feedListViewportH.current;
                  if (vh <= 0 || h <= 0) return;
                  if (h >= vh + 32) return;
                  void loadMore();
                }
              : undefined
          }
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            loading ? undefined : (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />
            )
          }
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={Platform.OS === 'web' ? 28 : 8}
          windowSize={Platform.OS === 'web' ? 12 : 7}
          maxToRenderPerBatch={Platform.OS === 'web' ? 24 : 12}
        />
      </View>

      {hasSignalApi() ? (
        <FloatingGlassFab
          bottom={
            fabStackBottom + (filterReady ? FLOATING_GLASS_FAB_SIZE + FLOATING_GLASS_FAB_GAP : 0)
          }
          onPress={() => void onRefresh()}
          iconName="refresh"
          accessibilityLabel={t('fabRefreshA11y')}
          disabled={refreshing || loading}
        />
      ) : null}

      {filterReady ? (
        <FloatingGlassFab
          bottom={fabStackBottom}
          onPress={() => setFilterModalVisible(true)}
          iconName="filter"
          accessibilityLabel={t('a11yNewsFilter')}
        />
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
    mainColumn: {
      flex: 1,
      minHeight: 0,
    },
    topFixed: {
      flexShrink: 0,
      zIndex: 2,
      elevation: Platform.OS === 'android' ? 2 : 0,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 12,
      backgroundColor: theme.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
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
    refreshNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      marginBottom: 8,
      paddingVertical: 9,
      paddingHorizontal: 11,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor:
        theme.green.startsWith('#') && theme.green.length === 7 ? `${theme.green}12` : theme.greenDim,
    },
    refreshNoticeText: {
      flex: 1,
      minWidth: 0,
      color: theme.green,
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: '800',
    },
    skeletonBlock: {
      marginTop: 4,
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
    segment: {
      flexDirection: 'row',
      backgroundColor: theme.bgElevated,
      borderRadius: SEGMENT_TAB_OUTER_RADIUS,
      padding: SEGMENT_TAB_PADDING,
      marginBottom: 0,
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
      borderRadius: 14,
      backgroundColor: theme.dangerDim,
      borderWidth: 1,
      borderColor: '#FFD6DA',
      marginBottom: 12,
    },
    errText: {
      fontSize: sf(12),
      color: theme.danger,
      lineHeight: sf(18),
    },
    empty: {
      fontSize: sf(13),
      color: theme.textMuted,
      marginTop: 8,
    },
  });
}
