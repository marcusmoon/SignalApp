import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useFocusEffect, useIsFocused } from "expo-router/react-navigation";
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { WebWheelFlatList } from '@/components/layout/WebWheelFlatList';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { groupedFeedRowShell } from '@/components/signal/groupedFeedList';
import {
  SelectionFilterSheet,
  selectionFilterRowStyles,
} from '@/components/signal/SelectionFilterSheet';
import { YoutubeCard } from '@/components/signal/YoutubeCard';
import { FloatingGlassFab } from '@/components/signal/FloatingGlassFab';
import { SCROLL_CONTENT_LOADING_STYLE, SCROLL_LOADING_BODY_STYLE } from '@/constants/scrollLoadingLayout';
import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH, wideContentFill } from '@/constants/responsiveLayout';
import {
  getSegmentTabBarStyles,
  SCREEN_LIST_CONTENT_PADDING_TOP,
  SCREEN_WIDE_CONTENT_PADDING_TOP,
} from '@/constants/segmentTabBar';
import { webFlexFill, webScrollViewportStyle, webShellBackground, WEB_FLATLIST_BATCH, WEB_FLATLIST_INITIAL, WEB_FLATLIST_WINDOW } from '@/constants/webLayout';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  fabStackBottom,
  SCREEN_FIXED_HEADER_PADDING_BOTTOM,
  SCREEN_FIXED_HEADER_PADDING_HORIZONTAL,
  SCREEN_FIXED_HEADER_PADDING_TOP,
  tabScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { useResetRefreshingOnTabBlur, useTabScreenLoadingRecovery } from '@/hooks';
import { useLocale } from '@/contexts/LocaleContext';
import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { hasSignalApi } from '@/services/env';
import { loadSelectedChannels, saveSelectedChannels } from '@/services/youtubeChannelSelection';
import type { ChannelHandleMeta } from '@/domain/youtube/types';
import { fetchSignalYoutube, fetchSignalYoutubeChannels, signalYoutubeToYoutubeItem } from '@/integrations/signal-api';
import type { SignalApiYoutubeChannel, SignalYoutubeListMeta } from '@/integrations/signal-api/types';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { YoutubeItem } from '@/types/signal';
import { shouldShowTabScrollFullScreenLoading } from '@/utils/tabScrollLoadingGate';
import { useWebFlatListLoadMore } from '@/hooks/useWebFlatListLoadMore';
import {
  msUntilNextPacificMidnight,
  quotaResetHoursMinutes,
  YOUTUBE_DATA_API_QUOTAS_CONSOLE_URL,
} from '@/utils/youtubeQuota';

type SortKey = 'popular' | 'latest';

const YOUTUBE_PAGE_SIZE = 30;

/** 채널 배열이 동일하면 상태 갱신·load 재실행을 막기 위한 키 (탭 복귀 시 매번 새 배열 참조 방지) */
function normalizeHandlesKey(handles: string[]): string {
  return [...handles].map((h) => h.trim().toLowerCase()).sort().join('\0');
}

export default function YoutubeScreen() {
  const { t, locale } = useLocale();
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { useTwoPane } = useResponsiveLayout();
  const ipadNav = useIpadSidebarNav();
  const [sort, setSort] = useState<SortKey>('latest');
  const effectiveSort = useTwoPane && ipadNav.isAvailable ? ipadNav.youtubeSort : sort;
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [quotaResetMs, setQuotaResetMs] = useState(() => msUntilNextPacificMidnight());
  const [items, setItems] = useState<YoutubeItem[]>([]);
  const [youtubeMeta, setYoutubeMeta] = useState<SignalYoutubeListMeta | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [channelMeta, setChannelMeta] = useState<ChannelHandleMeta[]>([]);
  const [curationHandles, setCurationHandles] = useState<string[] | null>(null);
  const [selectedHandles, setSelectedHandles] = useState<string[] | null>(null);
  const [channelModalVisible, setChannelModalVisible] = useState(false);
  const [filterDraftHandles, setFilterDraftHandles] = useState<string[] | null>(null);
  /** load() 안에서 이미 화면에 목록이 있는지 — 캐시 재적중 시 전체 로딩 스킵 */
  const itemsRef = useRef<YoutubeItem[]>([]);
  itemsRef.current = items;
  const youtubeMetaRef = useRef(youtubeMeta);
  youtubeMetaRef.current = youtubeMeta;
  const loadingMoreRef = useRef(loadingMore);
  const loadingRef = useRef(loading);
  loadingMoreRef.current = loadingMore;
  loadingRef.current = loading;
  /** `hadItems`인데도 `setLoading(true)`를 생략하는 경로(채널 토글 등)에서 loadMore와 겹치지 않게 함 */
  const youtubeReplacingRef = useRef(false);
  /** 필터 적용 시 `setSelectedHandles` 직후 useEffect load() 중복 방지 */
  const skipLoadOnSelectedHandlesRef = useRef(false);
  const syncedYoutubeSortRef = useRef(ipadNav.youtubeSort);

  useTabScreenLoadingRecovery(items, setLoading);

  const loadChannelCatalog = useCallback(async (cacheMode: 'use' | 'bypass' = 'use') => {
    let rows: SignalApiYoutubeChannel[] = [];
    try {
      rows = hasSignalApi() ? await fetchSignalYoutubeChannels({ cacheMode }) : [];
    } catch (e) {
      setError(formatSignalApiError(e, t, 'youtubeErrorLoad'));
      rows = [];
    }
    const handles = rows.map((row) => row.handle).filter(Boolean);
    const saved = await loadSelectedChannels(handles);
    const meta: ChannelHandleMeta[] = rows.map((row) => ({
      handle: row.handle,
      title: row.title || `@${row.handle}`,
    }));
    setCurationHandles((prev) => {
      if (prev !== null && normalizeHandlesKey(prev) === normalizeHandlesKey(handles)) return prev;
      return handles;
    });
    setChannelMeta(meta);
    setSelectedHandles((prev) => {
      if (prev !== null && normalizeHandlesKey(prev) === normalizeHandlesKey(saved)) return prev;
      return saved;
    });
    return { handles, selected: saved };
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void loadChannelCatalog('use');
    }, [loadChannelCatalog]),
  );

  const applyLoadError = useCallback(
    (e: unknown, fallbackId: 'youtubeErrorLoad' | 'youtubeErrorRefresh') => {
      setIsQuotaError(false);
      setError(formatSignalApiError(e, t, fallbackId));
    },
    [t],
  );

  useEffect(() => {
    if (!isQuotaError) return;
    const tick = () => setQuotaResetMs(msUntilNextPacificMidnight());
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [isQuotaError]);

  const load = useCallback(
    async (opts?: {
      forceRefresh?: boolean;
      channelHandles?: string[];
      availableHandles?: string[];
      sort?: SortKey;
      errorFallback?: 'youtubeErrorLoad' | 'youtubeErrorRefresh';
    }) => {
      setError(null);
      setIsQuotaError(false);
      const handles = opts?.channelHandles ?? selectedHandles;
      if (handles === null) return;

      const errKey = opts?.errorFallback ?? 'youtubeErrorLoad';

      if (!hasSignalApi()) {
        setItems([]);
        setYoutubeMeta(null);
        setError(t('errorSignalApiShort'));
        setLoading(false);
        return;
      }
      if (handles.length === 0) {
        setItems([]);
        setYoutubeMeta(null);
        setError(t('youtubeErrorSelectChannel'));
        setLoading(false);
        return;
      }

      const hadItems = itemsRef.current.length > 0;
      if (!hadItems) {
        setLoading(true);
      }
      youtubeReplacingRef.current = true;
      setYoutubeMeta(null);
      try {
        const availableHandles = opts?.availableHandles ?? curationHandles;
        const requestedSort = opts?.sort ?? effectiveSort;
        const page = await fetchSignalYoutube(
          {
            offset: 0,
            limit: YOUTUBE_PAGE_SIZE,
            sort: requestedSort,
            channelHandles: availableHandles && handles.length === availableHandles.length ? undefined : handles,
          },
          { cacheMode: opts?.forceRefresh ? 'bypass' : 'use' },
        );
        setYoutubeMeta(page.meta);
        setItems(page.items.map((item) => signalYoutubeToYoutubeItem(item, locale)));
      } catch (e) {
        applyLoadError(e, errKey);
        setItems([]);
        setYoutubeMeta(null);
      } finally {
        setLoading(false);
        youtubeReplacingRef.current = false;
      }
    },
    [selectedHandles, curationHandles, locale, effectiveSort, t, applyLoadError],
  );

  const loadMore = useCallback(async () => {
    if (youtubeReplacingRef.current) return;
    const meta = youtubeMetaRef.current;
    if (!meta?.hasMore || loadingMoreRef.current || loadingRef.current || !hasSignalApi()) return;
    const nextOff = meta.nextOffset;
    if (nextOff == null) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await fetchSignalYoutube(
        {
          offset: nextOff,
          limit: YOUTUBE_PAGE_SIZE,
          sort: effectiveSort,
          channelHandles:
            selectedHandles && curationHandles && selectedHandles.length !== curationHandles.length
              ? selectedHandles
              : undefined,
        },
        { cacheMode: 'use' },
      );
      if (page.items.length === 0) {
        setYoutubeMeta((m) => (m ? { ...m, hasMore: false, nextOffset: null } : null));
        return;
      }
      const prev = itemsRef.current;
      const seen = new Set(prev.map((i) => i.id));
      const out = [...prev];
      for (const row of page.items) {
        const it = signalYoutubeToYoutubeItem(row, locale);
        if (!seen.has(it.id)) {
          seen.add(it.id);
          out.push(it);
        }
      }
      if (out.length === prev.length && page.items.length > 0) {
        setYoutubeMeta((m) => (m ? { ...m, hasMore: false, nextOffset: null } : null));
      } else {
        setYoutubeMeta(page.meta);
        setItems(out);
      }
    } catch (e) {
      applyLoadError(e, 'youtubeErrorLoad');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [effectiveSort, selectedHandles, curationHandles, locale, applyLoadError]);

  const ytListRef = useRef<FlatList<YoutubeItem>>(null);
  const webFeedLoadMore = useWebFlatListLoadMore({
    hasMore: Boolean(youtubeMeta?.hasMore),
    loadingMore,
    loading,
    loadMore,
    enabled: Platform.OS === 'web' && isFocused,
  });

  useEffect(() => {
    if (selectedHandles === null) return;
    if (skipLoadOnSelectedHandlesRef.current) {
      skipLoadOnSelectedHandlesRef.current = false;
      return;
    }
    void load();
  }, [load, selectedHandles]);

  useEffect(() => {
    if (!useTwoPane || !ipadNav.isAvailable) return;
    if (syncedYoutubeSortRef.current === ipadNav.youtubeSort) return;
    syncedYoutubeSortRef.current = ipadNav.youtubeSort;
    setSort(ipadNav.youtubeSort);
    setLoading(true);
    setItems([]);
    setYoutubeMeta(null);
  }, [ipadNav.isAvailable, ipadNav.youtubeSort, useTwoPane]);

  const onRefresh = useCallback(async () => {
    if (selectedHandles === null) return;
    setRefreshing(true);
    try {
      const catalog = await loadChannelCatalog('bypass');
      await load({
        forceRefresh: true,
        channelHandles: catalog.selected,
        availableHandles: catalog.handles,
        errorFallback: 'youtubeErrorRefresh',
      });
    } finally {
      setRefreshing(false);
    }
  }, [load, loadChannelCatalog, selectedHandles]);

  const handlesEqual = useCallback((a: string[] | null, b: string[] | null) => {
    if (a === null || b === null) return a === b;
    if (a.length !== b.length) return false;
    const setB = new Set(b);
    return a.every((h) => setB.has(h));
  }, []);

  const openChannelFilter = useCallback(() => {
    setFilterDraftHandles(selectedHandles ? [...selectedHandles] : []);
    setChannelModalVisible(true);
  }, [selectedHandles]);

  const applyAllFilter = useCallback(async () => {
    const handles = curationHandles ?? selectedHandles ?? [];
    setSort('latest');
    if (handles.length > 0) {
      skipLoadOnSelectedHandlesRef.current = true;
      setSelectedHandles(handles);
      await saveSelectedChannels(handles);
      await load({
        forceRefresh: true,
        channelHandles: handles,
        availableHandles: curationHandles ?? handles,
        sort: 'latest',
      });
      return;
    }
    setLoading(true);
    setItems([]);
    setYoutubeMeta(null);
  }, [curationHandles, load, selectedHandles]);

  const applyPopularFilter = useCallback(() => {
    if (sort === 'popular') return;
    setLoading(true);
    setItems([]);
    setYoutubeMeta(null);
    setSort('popular');
  }, [sort]);

  const applyLatestSortFilter = useCallback(() => {
    if (sort === 'latest') return;
    setLoading(true);
    setItems([]);
    setYoutubeMeta(null);
    setSort('latest');
  }, [sort]);

  const commitChannelFilter = useCallback(async () => {
    setChannelModalVisible(false);
    if (!filterDraftHandles || handlesEqual(filterDraftHandles, selectedHandles)) return;
    skipLoadOnSelectedHandlesRef.current = true;
    setSelectedHandles(filterDraftHandles);
    await saveSelectedChannels(filterDraftHandles);
    await load({
      forceRefresh: true,
      channelHandles: filterDraftHandles,
      availableHandles: curationHandles ?? undefined,
    });
  }, [filterDraftHandles, handlesEqual, load, selectedHandles, curationHandles]);

  const channelFilterActive = Boolean(
    selectedHandles &&
      curationHandles &&
      selectedHandles.length > 0 &&
      selectedHandles.length < curationHandles.length,
  );

  const toggleChannel = useCallback((handle: string) => {
    setFilterDraftHandles((prev) => {
      if (!prev) return prev;
      return prev.includes(handle) ? prev.filter((h) => h !== handle) : [...prev, handle];
    });
  }, []);

  const selectAllChannels = useCallback(() => {
    if (!curationHandles?.length) return;
    setFilterDraftHandles([...curationHandles]);
  }, [curationHandles]);

  const clearAllChannels = useCallback(() => {
    setFilterDraftHandles([]);
  }, []);

  const titleForHandle = (handle: string) =>
    channelMeta.find((c) => c.handle === handle)?.title ?? `@${handle}`;

  const quotaResetHintLine = useMemo(() => {
    const { hours, minutes } = quotaResetHoursMinutes(quotaResetMs);
    if (hours === 0 && minutes === 0) return t('youtubeErrorQuotaResetImminent');
    return t('youtubeErrorQuotaResetHint', { hours, minutes });
  }, [quotaResetMs, t]);

  const emptyFeedMessage = useMemo(() => {
    if (selectedHandles?.length === 0) return t('youtubeErrorSelectChannel');
    if (channelFilterActive) return t('youtubeEmptyChannelFilter');
    return t('youtubeEmptyFeed');
  }, [channelFilterActive, selectedHandles, t]);
  /**
   * 채널 부트스트랩 전: 목록이 있으면 가리지 않음(탭 복귀·경합).
   * 채널 준비 후: 캐시 없이 최신↔인기 전환·강제 새로고침 등으로 `loading`이면 스크롤 영역에 로딩(이미 카드가 있어도 표시).
   */
  const showScrollLoading =
    selectedHandles === null
      ? shouldShowTabScrollFullScreenLoading({
          itemsLength: items.length,
          loading,
          awaitingBootstrap: true,
        })
      : loading;

  const bottomPad = tabScreenScrollBottomPadding(tabBarHeight, insets.bottom);
  const fabStackBottomOffset = fabStackBottom(tabBarHeight, insets.bottom);

  const youtubeListHeader = useMemo(
    () => (
      <>
        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
            {isQuotaError ? (
              <>
                <Text style={styles.errSub}>{quotaResetHintLine}</Text>
                <Pressable
                  onPress={() => void Linking.openURL(YOUTUBE_DATA_API_QUOTAS_CONSOLE_URL)}
                  style={({ pressed }) => [styles.errLinkWrap, pressed && { opacity: 0.85 }]}
                  accessibilityRole="link"
                  accessibilityLabel={t('youtubeErrorQuotaConsoleLink')}>
                  <Text style={styles.errLink}>{t('youtubeErrorQuotaConsoleLink')}</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}
        {showScrollLoading ? (
          <View style={SCROLL_LOADING_BODY_STYLE}>
            <SignalLoadingIndicator message={t('commonLoading')} />
          </View>
        ) : null}
      </>
    ),
    [error, isQuotaError, quotaResetHintLine, showScrollLoading, styles, t],
  );

  const channelRowStyles = useMemo(() => selectionFilterRowStyles(theme, scaleFont), [theme, scaleFont]);

  const youtubeListPanel = (
    <View style={[styles.mainColumn, useTwoPane && styles.mainColumnWide]}>
        {useTwoPane ? (
          <View style={styles.ipadFilterWrap}>
            <Pressable
              onPress={openChannelFilter}
              disabled={!selectedHandles || !curationHandles}
              style={({ pressed }) => [
                styles.ipadFilterBtn,
                channelFilterActive && styles.ipadFilterBtnActive,
                (!selectedHandles || !curationHandles) && styles.channelFilterChipDisabled,
                pressed && { opacity: 0.78 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: channelFilterActive, disabled: !selectedHandles || !curationHandles }}>
              <FontAwesome name="filter" size={12} color={channelFilterActive ? theme.green : theme.textMuted} />
              <Text style={[styles.ipadFilterText, channelFilterActive && styles.ipadFilterTextActive]}>
                {t('youtubeFilterChannel')}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {!useTwoPane ? <View style={styles.topFixed}>
          <View style={styles.segment}>
            <Pressable
              onPress={() => void applyAllFilter()}
              style={[
                styles.segBtn,
                sort === 'latest' && !channelFilterActive && styles.segBtnActive,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: sort === 'latest' && !channelFilterActive }}>
              <Text
                style={[
                  styles.segText,
                  sort === 'latest' && !channelFilterActive && styles.segTextActive,
                ]}>
                {t('feedWatchFilterAll')}
              </Text>
            </Pressable>
            <Pressable
              onPress={applyPopularFilter}
              style={[styles.segBtn, sort === 'popular' && styles.segBtnActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: sort === 'popular' }}>
              <Text style={[styles.segText, sort === 'popular' && styles.segTextActive]}>
                {t('youtubeSortPopular')}
              </Text>
            </Pressable>
          </View>
          <View style={styles.channelFilterRow}>
            <Pressable
              onPress={openChannelFilter}
              disabled={!selectedHandles || !curationHandles}
              style={[
                styles.channelFilterChip,
                !selectedHandles || !curationHandles ? styles.channelFilterChipDisabled : null,
                channelFilterActive && styles.channelFilterChipActive,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: channelFilterActive, disabled: !selectedHandles || !curationHandles }}>
              <FontAwesome name="filter" size={11} color={channelFilterActive ? theme.green : theme.textMuted} />
              <Text style={[styles.channelFilterText, channelFilterActive && styles.channelFilterTextActive]}>
                {t('youtubeFilterChannel')}
              </Text>
            </Pressable>
          </View>
        </View> : null}

        <WebWheelFlatList
          ref={ytListRef}
          data={showScrollLoading ? [] : items}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <View
              style={groupedFeedRowShell(theme, {
                isFirst: index === 0,
                isLast: index === items.length - 1,
              })}>
              <YoutubeCard layout="grouped" item={item} />
            </View>
          )}
          ListHeaderComponent={youtubeListHeader}
          ListEmptyComponent={
            !error && !showScrollLoading && items.length === 0 ? (
              <Text style={styles.empty}>{emptyFeedMessage}</Text>
            ) : null
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={theme.green} />
                <Text style={styles.footerLoadingText}>{t('feedLoadingMore')}</Text>
              </View>
            ) : Platform.OS === 'web' && youtubeMeta?.hasMore ? (
              <View style={styles.footerLoading}>
                <Pressable
                  onPress={() => void loadMore()}
                  style={styles.footerLoadMoreButton}
                  accessibilityRole="button">
                  <Text style={styles.footerLoadMoreText}>{t('feedDigestExpand')}</Text>
                </Pressable>
              </View>
            ) : null
          }
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.55}
          onScroll={webFeedLoadMore.onScroll}
          scrollEventThrottle={350}
          onLayout={webFeedLoadMore.onLayout}
          onContentSizeChange={webFeedLoadMore.onContentSizeChange}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            showScrollLoading ? SCROLL_CONTENT_LOADING_STYLE : null,
            { paddingBottom: bottomPad },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            showScrollLoading ? undefined : (
              <ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            )
          }
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={Platform.OS === 'web' ? WEB_FLATLIST_INITIAL : 6}
          windowSize={Platform.OS === 'web' ? WEB_FLATLIST_WINDOW : 7}
          maxToRenderPerBatch={Platform.OS === 'web' ? WEB_FLATLIST_BATCH : 10}
        />
      </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={useTwoPane ? [] : ['top']}>
      {!useTwoPane ? <SignalHeader compact onBrandPress={() => void onRefresh()} /> : null}
      {isFocused ? <OtaUpdateBanner /> : null}

      {youtubeListPanel}

      {hasSignalApi() && !useTwoPane ? (
        <FloatingGlassFab
          bottom={fabStackBottomOffset}
          onPress={() => void onRefresh()}
          iconName="sync"
          accessibilityLabel={t('fabRefreshA11y')}
          disabled={refreshing}
        />
      ) : null}

      <SelectionFilterSheet
        visible={channelModalVisible}
        title={t('youtubeModalTitle')}
        hint={t('youtubeFooterSub')}
        onDone={() => void commitChannelFilter()}
        bottomInset={insets.bottom}
        toolbar={{
          sectionLabel: t('youtubeFooterIncluded'),
          countLabel: t('filterSheetSelectedCount', {
            selected: filterDraftHandles?.length ?? 0,
            total: curationHandles?.length ?? 0,
          }),
          selectAllLabel: t('youtubeFooterSelectAll'),
          clearAllLabel: t('youtubeFooterClearAll'),
          onSelectAll: selectAllChannels,
          onClearAll: clearAllChannels,
        }}>
        {filterDraftHandles &&
          curationHandles &&
          curationHandles.map((handle) => {
            const on = filterDraftHandles.includes(handle);
            return (
              <Pressable
                key={handle}
                onPress={() => toggleChannel(handle)}
                style={[channelRowStyles.row, on && channelRowStyles.rowOn]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}>
                <FontAwesome
                  name={on ? 'check-square' : 'square-o'}
                  size={18}
                  color={on ? theme.green : theme.textDim}
                  style={channelRowStyles.checkIcon}
                />
                <Text style={[channelRowStyles.name, !on && channelRowStyles.nameOff]} numberOfLines={2}>
                  {titleForHandle(handle)}
                </Text>
              </Pressable>
            );
          })}
      </SelectionFilterSheet>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  const segmentTab = getSegmentTabBarStyles(theme, sf);
  return StyleSheet.create({
    safe: { ...webFlexFill, backgroundColor: webShellBackground(theme.bg) },
    mainColumn: {
      ...webFlexFill,
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
    mainColumnWide: {
      ...wideContentFill,
    },
    topFixed: {
      flexShrink: 0,
      paddingHorizontal: SCREEN_FIXED_HEADER_PADDING_HORIZONTAL,
      paddingTop: SCREEN_FIXED_HEADER_PADDING_TOP,
      paddingBottom: SCREEN_FIXED_HEADER_PADDING_BOTTOM,
      backgroundColor: theme.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    list: { ...webScrollViewportStyle },
    listContent: { paddingHorizontal: 16, paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP },
    ipadFilterWrap: {
      flexShrink: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP,
      paddingBottom: 4,
    },
    ipadFilterBtn: {
      alignSelf: 'flex-start',
      minHeight: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 11,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    ipadFilterBtnActive: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    ipadFilterText: {
      fontSize: sf(12),
      fontWeight: '900',
      color: theme.textMuted,
    },
    ipadFilterTextActive: {
      color: theme.green,
    },
    backToMoreWrap: {
      flexShrink: 0,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 4,
    },
    backToMoreBtn: {
      alignSelf: 'flex-start',
      minHeight: 34,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    backToMoreBtnPressed: { opacity: 0.72 },
    backToMoreText: {
      fontSize: sf(12),
      fontWeight: '900',
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
    footerLoadMoreButton: {
      minHeight: 38,
      paddingHorizontal: 18,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.green,
    },
    footerLoadMoreText: {
      fontSize: sf(13),
      fontWeight: '900',
      color: theme.bg,
    },
    segment: segmentTab.segment,
    segBtn: segmentTab.segBtn,
    segBtnActive: segmentTab.segBtnActive,
    segText: segmentTab.segText,
    segTextActive: segmentTab.segTextActive,
    channelFilterRow: {
      flexDirection: 'row',
      marginTop: 8,
    },
    channelFilterChip: {
      minHeight: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 11,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
    },
    channelFilterChipActive: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    channelFilterChipDisabled: {
      opacity: 0.45,
    },
    channelFilterText: {
      fontSize: sf(12),
      lineHeight: sf(17),
      fontWeight: '800',
      color: theme.textDim,
    },
    channelFilterTextActive: {
      color: theme.green,
    },
    errBox: {
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.dangerDim,
      borderWidth: 1,
      borderColor: '#FFD6DA',
      marginBottom: 12,
    },
    errText: { fontSize: sf(12), color: theme.danger, lineHeight: sf(18) },
    errSub: {
      fontSize: sf(11),
      color: theme.textMuted,
      lineHeight: sf(16),
      marginTop: 8,
    },
    errLinkWrap: {
      alignSelf: 'flex-start',
      marginTop: 10,
    },
    errLink: {
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.green,
      textDecorationLine: 'underline',
    },
    empty: { fontSize: sf(13), color: theme.textMuted, marginTop: 8 },
  });
}
