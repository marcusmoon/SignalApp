import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';

import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { groupedFeedRowShell } from '@/components/signal/groupedFeedList';
import {
  SelectionFilterSheet,
  selectionFilterRowStyles,
} from '@/components/signal/SelectionFilterSheet';
import { YoutubeCard } from '@/components/signal/YoutubeCard';
import { FloatingGlassFab, FLOATING_GLASS_FAB_GAP, FLOATING_GLASS_FAB_SIZE } from '@/components/signal/FloatingGlassFab';
import { SCROLL_CONTENT_LOADING_STYLE, SCROLL_LOADING_BODY_STYLE } from '@/constants/scrollLoadingLayout';
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
import { tabBarBottomInset } from '@/constants/tabBar';
import type { AppTheme } from '@/constants/theme';
import { useResetRefreshingOnTabBlur, useTabScreenLoadingRecovery } from '@/hooks';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { hasSignalApi } from '@/services/env';
import { loadSelectedChannels, saveSelectedChannels } from '@/services/youtubeChannelSelection';
import type { ChannelHandleMeta } from '@/domain/youtube/types';
import { fetchSignalYoutube, fetchSignalYoutubeChannels, signalYoutubeToYoutubeItem } from '@/integrations/signal-api';
import type { SignalApiYoutubeChannel, SignalYoutubeListMeta } from '@/integrations/signal-api/types';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { YoutubeItem } from '@/types/signal';
import { shouldShowTabScrollFullScreenLoading } from '@/utils/tabScrollLoadingGate';
import { createScrollLoadMoreGate } from '@/utils/listScrollLoadMoreGate';
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
  const [sort, setSort] = useState<SortKey>('latest');
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
  const ytListViewportH = useRef(0);
  const ytScrollLoadGateRef = useRef(createScrollLoadMoreGate());
  /** `hadItems`인데도 `setLoading(true)`를 생략하는 경로(채널 토글 등)에서 loadMore와 겹치지 않게 함 */
  const youtubeReplacingRef = useRef(false);
  /** 필터 적용 시 `setSelectedHandles` 직후 useEffect load() 중복 방지 */
  const skipLoadOnSelectedHandlesRef = useRef(false);

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
      errorFallback?: 'youtubeErrorLoad' | 'youtubeErrorRefresh';
    }) => {
      setError(null);
      setIsQuotaError(false);
      if (selectedHandles === null) return;
      const handles = opts?.channelHandles ?? selectedHandles;

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
        const page = await fetchSignalYoutube(
          {
            offset: 0,
            limit: YOUTUBE_PAGE_SIZE,
            sort,
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
    [selectedHandles, curationHandles, locale, sort, t, applyLoadError],
  );

  const loadMore = useCallback(async () => {
    if (youtubeReplacingRef.current) return;
    if (!youtubeMeta?.hasMore || loadingMore || loading || !hasSignalApi()) return;
    const nextOff = youtubeMeta.nextOffset;
    if (nextOff == null) return;

    setLoadingMore(true);
    setError(null);
    try {
      const page = await fetchSignalYoutube(
        {
          offset: nextOff,
          limit: YOUTUBE_PAGE_SIZE,
          sort,
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
      setLoadingMore(false);
    }
  }, [youtubeMeta, loadingMore, loading, sort, selectedHandles, curationHandles, locale, applyLoadError]);

  const onYoutubeScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      ytScrollLoadGateRef.current.onScrollNearEnd(e, {
        enabled:
          Boolean(youtubeMeta?.hasMore) && !loadingMore && !loading && !youtubeReplacingRef.current && hasSignalApi(),
        trigger: () => void loadMore(),
      });
    },
    [youtubeMeta?.hasMore, loadingMore, loading, loadMore],
  );

  useEffect(() => {
    if (selectedHandles === null) return;
    if (skipLoadOnSelectedHandlesRef.current) {
      skipLoadOnSelectedHandlesRef.current = false;
      return;
    }
    void load();
  }, [load, selectedHandles]);

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

  const filterReady = Boolean(selectedHandles && curationHandles);
  const channelFilterActive = Boolean(
    selectedHandles &&
      curationHandles &&
      selectedHandles.length > 0 &&
      selectedHandles.length < curationHandles.length,
  );
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

  const bottomPad = 28 + tabBarHeight + tabBarBottomInset(insets.bottom);
  const fabStackBottom = tabBarHeight + tabBarBottomInset(insets.bottom) + 8;

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SignalHeader onBrandPress={() => void onRefresh()} />
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={styles.mainColumn}>
        <View style={styles.topFixed}>
          <View style={styles.segment}>
            <Pressable
              onPress={() => {
                if (sort === 'latest') return;
                setLoading(true);
                setItems([]);
                setYoutubeMeta(null);
                setSort('latest');
              }}
              style={[styles.segBtn, sort === 'latest' && styles.segBtnActive]}
              accessibilityState={{ selected: sort === 'latest' }}>
              <Text style={[styles.segText, sort === 'latest' && styles.segTextActive]}>
                {t('youtubeSortLatest')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (sort === 'popular') return;
                setLoading(true);
                setItems([]);
                setYoutubeMeta(null);
                setSort('popular');
              }}
              style={[styles.segBtn, sort === 'popular' && styles.segBtnActive]}
              accessibilityState={{ selected: sort === 'popular' }}>
              <Text style={[styles.segText, sort === 'popular' && styles.segTextActive]}>
                {t('youtubeSortPopular')}
              </Text>
            </Pressable>
          </View>
        </View>

        <FlatList
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
            ) : null
          }
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.55}
          onScroll={onYoutubeScroll}
          scrollEventThrottle={350}
          onLayout={
            Platform.OS === 'web'
              ? (e) => {
                  ytListViewportH.current = e.nativeEvent.layout.height;
                }
              : undefined
          }
          onContentSizeChange={
            Platform.OS === 'web'
              ? (_, h) => {
                  if (!youtubeMeta?.hasMore || loadingMore || loading || youtubeReplacingRef.current) return;
                  const vh = ytListViewportH.current;
                  if (vh <= 0 || h <= 0) return;
                  if (h >= vh + 32) return;
                  void loadMore();
                }
              : undefined
          }
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
          initialNumToRender={Platform.OS === 'web' ? 36 : 6}
          windowSize={Platform.OS === 'web' ? 12 : 7}
          maxToRenderPerBatch={Platform.OS === 'web' ? 30 : 10}
        />
      </View>

      {hasSignalApi() ? (
        <FloatingGlassFab
          bottom={
            fabStackBottom + (filterReady ? FLOATING_GLASS_FAB_SIZE + FLOATING_GLASS_FAB_GAP : 0)
          }
          onPress={() => void onRefresh()}
          iconName="sync"
          accessibilityLabel={t('fabRefreshA11y')}
          disabled={refreshing}
        />
      ) : null}

      {filterReady ? (
        <FloatingGlassFab
          bottom={fabStackBottom}
          onPress={openChannelFilter}
          iconName="filter"
          accessibilityLabel={t('a11yYoutubeFilter')}
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
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    mainColumn: { flex: 1, minHeight: 0 },
    topFixed: {
      flexShrink: 0,
      paddingHorizontal: 16,
      paddingTop: 8,
      backgroundColor: theme.bg,
    },
    list: { flex: 1, minHeight: 0 },
    listContent: { paddingHorizontal: 16, paddingTop: 0 },
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
      borderWidth: 1,
      borderColor: theme.border,
      padding: SEGMENT_TAB_PADDING,
      marginBottom: 14,
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
