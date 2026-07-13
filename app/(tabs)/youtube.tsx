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
import { useLocalSearchParams } from 'expo-router';
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
import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH, wideContentFill } from '@/constants/responsiveLayout';
import {
  getSegmentTabBarStyles,
  SCREEN_LIST_CONTENT_PADDING_TOP,
} from '@/constants/segmentTabBar';
import { webFlexFill, webScrollViewportStyle, webShellBackground, WEB_FLATLIST_BATCH, WEB_FLATLIST_INITIAL, WEB_FLATLIST_WINDOW } from '@/constants/webLayout';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { getScreenFixedHeaderStyles } from '@/constants/screenFixedHeader';
import {
  tabScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { useResetRefreshingOnTabBlur, useScrollToTopOnChange, useTabScreenLoadingRecovery } from '@/hooks';
import { useLocale } from '@/contexts/LocaleContext';
import { useRegisterWebHeaderRefresh } from '@/contexts/WebHeaderRefreshContext';
import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { hasSignalApi } from '@/services/env';
import { loadSelectedChannels, saveSelectedChannels } from '@/services/youtubeChannelSelection';
import type { ChannelHandleMeta } from '@/domain/youtube/types';
import { fetchSignalYoutube, fetchSignalYoutubeChannels, signalYoutubeToYoutubeItem } from '@/integrations/signal-api';
import type { SignalApiYoutubeChannel, SignalYoutubeListMeta } from '@/integrations/signal-api/types';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { YoutubeItem } from '@/types/signal';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { firstRouteParam } from '@/utils/routeSearchParams';
import { useSafeSetRouteParams } from '@/utils/safeRouteParams';
import { shouldShowTabScrollFullScreenLoading } from '@/utils/tabScrollLoadingGate';
import { useWebFlatListLoadMore } from '@/hooks/useWebFlatListLoadMore';
import {
  msUntilNextPacificMidnight,
  quotaResetHoursMinutes,
  YOUTUBE_DATA_API_QUOTAS_CONSOLE_URL,
} from '@/utils/youtubeQuota';

type SortKey = 'popular' | 'latest';

const YOUTUBE_PAGE_SIZE = 30;

function parseYoutubeSortParam(raw: string | string[] | undefined): SortKey {
  return firstRouteParam(raw) === 'popular' ? 'popular' : 'latest';
}

/** 채널 배열이 동일하면 상태 갱신·load 재실행을 막기 위한 키 (탭 복귀 시 매번 새 배열 참조 방지) */
function normalizeHandlesKey(handles: string[]): string {
  return [...handles].map((h) => h.trim().toLowerCase()).sort().join('\0');
}

export default function YoutubeScreen() {
  const { t, locale } = useLocale();
  const { theme, scaleFont } = useSignalTheme();
  const setRouteParams = useSafeSetRouteParams();
  const { sort: sortParam } = useLocalSearchParams<{ sort?: string | string[] }>();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { useTwoPane } = useResponsiveLayout();
  const ipadNav = useIpadSidebarNav();
  const [sort, setSort] = useState<SortKey>(() => parseYoutubeSortParam(sortParam));
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

  const { ref: ytListRef } = useScrollToTopOnChange([effectiveSort, selectedHandles], {
    resyncDeps: [items],
  });
  const listScrollResetKey = useMemo(
    () => `${effectiveSort}:${normalizeHandlesKey(selectedHandles ?? [])}`,
    [effectiveSort, selectedHandles],
  );

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
      const isRefresh = opts?.forceRefresh === true;
      youtubeReplacingRef.current = true;
      if (!isRefresh) {
        setYoutubeMeta(null);
      }
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
          { cacheMode: signalCacheMode(opts?.forceRefresh) },
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
        { cacheMode: signalCacheMode() },
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

  const onRefreshBase = useCallback(async () => {
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

  const onRefresh = onRefreshBase;
  useRegisterWebHeaderRefresh(() => void onRefresh());

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
  }, [load, selectedHandles, effectiveSort]);

  useEffect(() => {
    if (!useTwoPane || !ipadNav.isAvailable) return;
    if (syncedYoutubeSortRef.current === ipadNav.youtubeSort) return;
    syncedYoutubeSortRef.current = ipadNav.youtubeSort;
    setSort(ipadNav.youtubeSort);
  }, [ipadNav.isAvailable, ipadNav.youtubeSort, useTwoPane]);

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

  const applyPopularFilter = useCallback(() => {
    if (sort === 'popular') return;
    setSort('popular');
    if (useTwoPane && ipadNav.isAvailable) ipadNav.showYoutubeTab('popular');
    setRouteParams({ sort: 'popular' });
  }, [ipadNav, setRouteParams, sort, useTwoPane]);

  const applyLatestSortFilter = useCallback(() => {
    if (sort === 'latest') return;
    setSort('latest');
    if (useTwoPane && ipadNav.isAvailable) ipadNav.showYoutubeTab('latest');
    setRouteParams({ sort: undefined });
  }, [ipadNav, setRouteParams, sort, useTwoPane]);

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

  const channelFilterLabel = useMemo(() => {
    if (!channelFilterActive || !selectedHandles || !curationHandles) {
      return t('youtubeFilterChannel');
    }
    return t('youtubeFilterChannelCount', {
      selected: selectedHandles.length,
      total: curationHandles.length,
    });
  }, [channelFilterActive, curationHandles, selectedHandles, t]);

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
      : loading && items.length === 0;

  const bottomPad = tabScreenScrollBottomPadding(tabBarHeight, insets.bottom);

  const channelRowStyles = useMemo(() => selectionFilterRowStyles(theme, scaleFont), [theme, scaleFont]);

  const youtubeListPanel = (
    <View style={[styles.mainColumn, useTwoPane && styles.mainColumnWide]}>
        <View style={[styles.topFixedStack, useTwoPane && styles.topFixedStackWide]}>
          {!useTwoPane ? (
            <View style={styles.topFixedSubmenu}>
              <View style={styles.segment}>
                <Pressable
                  onPress={applyLatestSortFilter}
                  style={[styles.segBtn, sort === 'latest' && styles.segBtnActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sort === 'latest' }}>
                  <Text style={[styles.segText, sort === 'latest' && styles.segTextActive]}>
                    {t('youtubeSortLatest')}
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
            </View>
          ) : null}
          <View style={[styles.topFixedChannelFilter, useTwoPane && styles.topFixedChannelFilterWide]}>
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
                accessibilityLabel={channelFilterLabel}
                accessibilityState={{ selected: channelFilterActive, disabled: !selectedHandles || !curationHandles }}>
                <FontAwesome name="filter" size={11} color={channelFilterActive ? theme.green : theme.textMuted} />
                <Text style={[styles.channelFilterText, channelFilterActive && styles.channelFilterTextActive]}>
                  {channelFilterLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

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
          <View style={styles.loadingBox}>
            <SignalLoadingIndicator message={t('commonLoading')} />
          </View>
        ) : (
        <WebWheelFlatList
          scrollResetKey={listScrollResetKey}
          ref={ytListRef as never}
          data={items}
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
          ListEmptyComponent={
            !error && items.length === 0 ? (
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
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={Platform.OS === 'web' ? WEB_FLATLIST_INITIAL : 6}
          windowSize={Platform.OS === 'web' ? WEB_FLATLIST_WINDOW : 7}
          maxToRenderPerBatch={Platform.OS === 'web' ? WEB_FLATLIST_BATCH : 10}
        />
        )}
      </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={useTwoPane ? [] : ['top']}>
      {!useTwoPane ? <SignalHeader compact onBrandPress={() => void onRefresh()} /> : null}
      {isFocused ? <OtaUpdateBanner /> : null}

      {youtubeListPanel}

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
  const fixedHeader = getScreenFixedHeaderStyles(theme);
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
    topFixedStack: fixedHeader.fixedStack,
    topFixedStackWide: fixedHeader.fixedStackWide,
    topFixedSubmenu: fixedHeader.submenuStrip,
    topFixedChannelFilter: fixedHeader.digestSlot,
    topFixedChannelFilterWide: fixedHeader.digestSlotWide,
    channelFilterRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    segment: segmentTab.segment,
    segBtn: segmentTab.segBtn,
    segBtnActive: segmentTab.segBtnActive,
    segText: segmentTab.segText,
    segTextActive: segmentTab.segTextActive,
    list: { ...webScrollViewportStyle },
    listContent: { paddingHorizontal: 16, paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP },
    channelFilterChip: {
      minHeight: 32,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 11,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      flexShrink: 0,
    },
    backToMoreWrap: {
      flexShrink: 0,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
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
      fontWeight: '700',
      color: theme.green,
    },
    footerLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
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
      fontWeight: '700',
      color: theme.bg,
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
      fontWeight: '600',
      color: theme.textDim,
    },
    channelFilterTextActive: {
      color: theme.green,
    },
    errBox: {
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 12,
      borderRadius: 8,
      backgroundColor: theme.dangerDim,
      borderWidth: 1,
      borderColor: '#FFD6DA',
    },
    errText: { fontSize: sf(12), color: theme.danger, lineHeight: sf(18) },
    loadingBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
    },
    errSub: {
      fontSize: sf(11),
      color: theme.textMuted,
      lineHeight: sf(16),
      marginTop: 8,
    },
    errLinkWrap: {
      alignSelf: 'flex-start',
      marginTop: 16,
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
