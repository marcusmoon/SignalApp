import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router/react-navigation';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useSafeSetRouteParams } from '@/utils/safeRouteParams';

import { CommunityPostCard, communitySourceLabelId, isCommunitySourceKey } from '@/components/community/CommunityPostCard';
import { WebWheelFlatList } from '@/components/layout/WebWheelFlatList';
import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import {
  COMMUNITY_SOURCE_ALL,
  COMMUNITY_SOURCE_ORDER,
  type CommunitySourceFilter,
} from '@/constants/communitySources';
import {
  getSegmentTabBarStyles,
  SCREEN_LIST_CONTENT_PADDING_TOP,
} from '@/constants/segmentTabBar';
import { APP_CONTENT_MAX_WIDTH, wideContentFill } from '@/constants/responsiveLayout';
import { getScreenFixedHeaderStyles } from '@/constants/screenFixedHeader';
import {
  SCREEN_EMBEDDED_WIDE_PADDING_TOP,
  SCREEN_WIDE_SCROLL_BOTTOM_BASE,
  stackScreenScrollBottomPadding,
  tabScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import {
  webFlexFill,
  webScrollViewportStyle,
  webShellBackground,
  WEB_FLATLIST_BATCH,
  WEB_FLATLIST_INITIAL,
  WEB_FLATLIST_WINDOW,
  isWeb,
} from '@/constants/webLayout';
import { useIpadSidebarNavActions, useIpadSidebarNavState } from '@/contexts/IpadSidebarNavContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useRegisterWebHeaderRefresh } from '@/contexts/WebHeaderRefreshContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useOwnedSidebarSubTabs } from '@/contexts/SidebarSubTabsContext';
import { useResetRefreshingOnTabBlur, useScrollToTopOnChange } from '@/hooks';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { fetchSignalCommunity } from '@/integrations/signal-api/community';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiCommunityPost, SignalCommunityListMeta } from '@/integrations/signal-api/types';
import type { MessageId } from '@/locales/messages';
import { hasSignalApi } from '@/services/env';
import { useWebFlatListLoadMore } from '@/hooks/useWebFlatListLoadMore';

const PAGE_SIZE = 30;

function parseCommunitySourceParam(raw: string | string[] | undefined): CommunitySourceFilter | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  if (value === COMMUNITY_SOURCE_ALL) return COMMUNITY_SOURCE_ALL;
  return isCommunitySourceKey(value) ? value : null;
}

const SOURCE_LABEL: Record<CommunitySourceFilter, MessageId> = {
  all: 'communitySourceAll',
  naver_likeusstock_free: 'communitySourceNaverLikeusstock',
  save_user_news: 'communitySourceSaveUserNews',
};

export type BoardContentProps = {
  embedded?: boolean;
  onBack?: () => void;
  /** Tab bar height — 0 when embedded / stack outside Tabs. */
  tabBarHeight?: number;
  /** When false, still load (embedded pane is always "active"). */
  active?: boolean;
  /** Root Stack under More — native header owns chrome; no SignalHeader. */
  stackChrome?: boolean;
  /** 홈 숏컷 등 — 임베디드/스택에서 초기 소스 */
  initialSource?: CommunitySourceFilter | null;
  /**
   * 홈 숏컷 드릴 — 소스 고정. 폰 세그먼트·임베디드 세그먼트·사이드바 서브탭 숨김.
   * all이면 제목은 상위(게시판), 그 외는 채널명.
   */
  lockedSource?: CommunitySourceFilter | null;
};

function boardLockedTitle(
  source: CommunitySourceFilter,
  t: (id: MessageId) => string,
): string {
  if (source === COMMUNITY_SOURCE_ALL) return t('screenBoard');
  return t(SOURCE_LABEL[source]);
}

export function BoardContent({
  embedded = false,
  onBack,
  tabBarHeight = 0,
  active = true,
  stackChrome = false,
  initialSource = null,
  lockedSource = null,
}: BoardContentProps) {
  const { t } = useLocale();
  const router = useRouter();
  const setRouteParams = useSafeSetRouteParams();
  const routeParams = useLocalSearchParams<{ source?: string | string[] }>();
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const insets = useSafeAreaInsets();
  const { useTwoPane } = useResponsiveLayout();
  const ipadNav = useIpadSidebarNavActions();
  const { contentPane } = useIpadSidebarNavState();
  const { setSubTabs, setActiveSubTabKey, clearSubTabs } = useOwnedSidebarSubTabs('board');
  const [source, setSource] = useState<CommunitySourceFilter>(
    () =>
      initialSource ??
      parseCommunitySourceParam(routeParams.source) ??
      COMMUNITY_SOURCE_ALL,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SignalApiCommunityPost[]>([]);
  const { ref: listRef } = useScrollToTopOnChange([source], { resyncDeps: [items] });
  const listScrollResetKey = source;
  const [meta, setMeta] = useState<SignalCommunityListMeta | null>(null);
  const loadingMoreRef = useRef(false);
  const itemsRef = useRef<SignalApiCommunityPost[]>([]);
  const sourceRef = useRef(source);
  const loadSeqRef = useRef(0);
  itemsRef.current = items;
  sourceRef.current = source;

  const load = useCallback(
    async (opts?: { refresh?: boolean; loadMore?: boolean; sourceFilter?: CommunitySourceFilter }) => {
      const nextSource = opts?.sourceFilter ?? sourceRef.current;
      const loadMore = opts?.loadMore === true;
      const seq = ++loadSeqRef.current;
      if (!hasSignalApi()) {
        if (seq !== loadSeqRef.current) return;
        setItems([]);
        setMeta(null);
        setError(t('errorSignalApiShort'));
        return;
      }
      if (loadMore) {
        if (loadingMoreRef.current || !meta?.hasMore) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else if (itemsRef.current.length === 0) {
        setLoading(true);
      }
      setError(null);
      try {
        const offset = loadMore ? meta?.nextOffset ?? itemsRef.current.length : 0;
        const page = await fetchSignalCommunity(
          {
            source: nextSource,
            limit: PAGE_SIZE,
            offset,
          },
          { cacheMode: signalCacheMode(opts?.refresh) },
        );
        if (seq !== loadSeqRef.current) return;
        setItems((prev) => (loadMore ? [...prev, ...page.items] : page.items));
        setMeta(page.meta);
      } catch (e) {
        if (seq !== loadSeqRef.current) return;
        if (!loadMore) {
          setItems([]);
          setMeta(null);
        }
        setError(formatSignalApiError(e, t, 'communityErrorLoad'));
      } finally {
        if (loadMore) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else if (seq === loadSeqRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [meta?.hasMore, meta?.nextOffset, t],
  );

  useEffect(() => {
    if (!active) return;
    void load({ sourceFilter: source });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const onRefreshBase = useCallback(async () => {
    setRefreshing(true);
    await load({ refresh: true });
  }, [load]);

  const onRefresh = onRefreshBase;
  useRegisterWebHeaderRefresh(() => void onRefresh());

  const onEndReached = useCallback(() => {
    void load({ loadMore: true });
  }, [load]);

  const { onLayout, onContentSizeChange, onScroll } = useWebFlatListLoadMore({
    hasMore: meta?.hasMore === true,
    loadingMore,
    loading,
    loadMore: onEndReached,
    isBusyRef: loadingMoreRef,
  });

  const loadRef = useRef(load);
  loadRef.current = load;

  const changeSource = useCallback(
    (next: CommunitySourceFilter, options?: { fromRoute?: boolean }) => {
      if (next === sourceRef.current) {
        if (useTwoPane) setActiveSubTabKey(next);
        return;
      }
      sourceRef.current = next;
      setSource(next);
      if (useTwoPane) setActiveSubTabKey(next);
      // Keep wide nav boardSource in sync so post→back restores the channel.
      if (embedded && ipadNav.isAvailable) {
        ipadNav.setBoardSourceFilter(next);
      }
      setError(null);
      setItems([]);
      setMeta(null);
      setLoading(true);
      // Wide overlay board keeps source in memory; tab board syncs the URL.
      if (!options?.fromRoute && !embedded) {
        setRouteParams({ source: next });
      }
      void loadRef.current({ sourceFilter: next });
    },
    [embedded, ipadNav, setActiveSubTabKey, setRouteParams, useTwoPane],
  );

  useEffect(() => {
    if (embedded) return;
    const paramSource = parseCommunitySourceParam(routeParams.source) ?? COMMUNITY_SOURCE_ALL;
    changeSource(paramSource, { fromRoute: true });
  }, [changeSource, embedded, routeParams.source]);

  useEffect(() => {
    if (!embedded || !initialSource) return;
    changeSource(initialSource, { fromRoute: true });
  }, [changeSource, embedded, initialSource]);

  const registerBoardSubTabs = useCallback(() => {
    if (!useTwoPane || lockedSource) return;
    setSubTabs(
      COMMUNITY_SOURCE_ORDER.map((key) => ({
        key,
        label: t(SOURCE_LABEL[key]),
        href: embedded ? undefined : '/(tabs)/board',
        params: embedded ? undefined : { source: key },
        onPress: () => {
          changeSource(key);
          // Post detail keeps the board list mounted; channel tap returns to the list.
          if (embedded && contentPane === 'community' && ipadNav.isAvailable) {
            ipadNav.goBackWidePane();
          }
        },
      })),
      source,
    );
  }, [
    changeSource,
    contentPane,
    embedded,
    ipadNav,
    lockedSource,
    setSubTabs,
    source,
    t,
    useTwoPane,
  ]);

  // 포커스/락 생명주기만 clear — register 콜백을 deps에 넣지 않는다.
  useEffect(() => {
    if (!useTwoPane) return;
    if (!active || lockedSource) {
      clearSubTabs();
      return;
    }
    return () => clearSubTabs();
  }, [active, clearSubTabs, lockedSource, useTwoPane]);

  // 소스 변경 시 목록·선택만 갱신 (clear 없음).
  useEffect(() => {
    if (!useTwoPane || !active || lockedSource) return;
    registerBoardSubTabs();
  }, [active, lockedSource, registerBoardSubTabs, useTwoPane]);

  useEffect(() => {
    if (!lockedSource) return;
    changeSource(lockedSource, { fromRoute: true });
  }, [changeSource, lockedSource]);

  const listBottomPad = embedded
    ? SCREEN_WIDE_SCROLL_BOTTOM_BASE + insets.bottom
    : stackChrome
      ? stackScreenScrollBottomPadding(insets.bottom)
      : tabScreenScrollBottomPadding(tabBarHeight, insets.bottom);

  const openPost = useCallback(
    (id: string) => {
      if (ipadNav.isAvailable) {
        // Wide board is an overlay root; always drill back to the board list.
        ipadNav.showCommunityPost(id, { drillFrom: 'board' });
        return;
      }
    },
    [ipadNav],
  );

  const renderItem = useCallback(
    ({ item }: { item: SignalApiCommunityPost }) => (
      <View style={styles.rowWrap}>
        <CommunityPostCard
          item={item}
          sourceLabelId={communitySourceLabelId(item.source)}
          onPress={
            ipadNav.isAvailable
              ? () => openPost(item.id)
              : undefined
          }
        />
      </View>
    ),
    [ipadNav.isAvailable, openPost, styles.rowWrap],
  );

  const showPhoneChrome = !useTwoPane && !embedded && !stackChrome;
  const showPhoneSegments = !useTwoPane && !embedded && !lockedSource;
  /** Wide uses sidebar source chips; in-pane segments only for non-wide embedded. */
  const showEmbeddedSegments = embedded && !useTwoPane && !lockedSource;
  const subpaneTitle = lockedSource
    ? boardLockedTitle(lockedSource, t)
    : t('screenBoard');

  return (
    <SafeAreaView style={styles.safe} edges={useTwoPane || embedded || stackChrome ? [] : ['top']}>
      {showPhoneChrome ? <SignalHeader compact onBrandPress={() => void onRefresh()} /> : null}
      {active ? <OtaUpdateBanner /> : null}
      <View style={[styles.mainColumn, (useTwoPane || embedded) && styles.mainColumnWide]}>
        {onBack ? <WideSubpaneHeader title={subpaneTitle} onBack={onBack} /> : null}
        {showPhoneSegments || showEmbeddedSegments ? (
          <View style={[styles.topFixed, embedded && styles.topFixedEmbedded]}>
            <View style={styles.segment}>
              {COMMUNITY_SOURCE_ORDER.map((key) => {
                const selected = source === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => changeSource(key)}
                    hitSlop={Platform.OS === 'web' ? undefined : { top: 6, bottom: 6, left: 2, right: 2 }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.segBtn,
                      selected && styles.segBtnActive,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={[styles.segText, selected && styles.segTextActive]}>
                      {t(SOURCE_LABEL[key])}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        <View style={styles.listColumn}>
          {error ? (
            <View style={styles.errBox}>
              <Text style={styles.errText}>{error}</Text>
            </View>
          ) : null}
          {loading && items.length === 0 ? (
            <View style={styles.loadingBox}>
              <SignalLoadingIndicator message={t('commonLoading')} />
            </View>
          ) : (
            <WebWheelFlatList
              scrollResetKey={listScrollResetKey}
              ref={listRef as never}
              style={styles.list}
              contentContainerStyle={{
                paddingBottom: listBottomPad,
                paddingHorizontal: 16,
                paddingTop: embedded ? 8 : SCREEN_LIST_CONTENT_PADDING_TOP,
              }}
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              onEndReached={onEndReached}
              onEndReachedThreshold={0.35}
              onLayout={onLayout}
              onContentSizeChange={onContentSizeChange}
              onScroll={onScroll}
              scrollEventThrottle={16}
              initialNumToRender={WEB_FLATLIST_INITIAL}
              maxToRenderPerBatch={WEB_FLATLIST_BATCH}
              windowSize={WEB_FLATLIST_WINDOW}
              ListEmptyComponent={
                !loading ? (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>{t('communityEmpty')}</Text>
                  </View>
                ) : null
              }
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.footerLoading}>
                    <SignalLoadingIndicator message={t('commonLoading')} />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </View>
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
    listColumn: {
      ...webFlexFill,
      minHeight: 0,
      zIndex: 0,
      ...(isWeb ? { overflow: 'hidden' as const } : null),
    },
    topFixed: {
      ...fixedHeader.strip,
      zIndex: 3,
    },
    topFixedEmbedded: {
      marginTop: SCREEN_EMBEDDED_WIDE_PADDING_TOP > 0 ? 0 : 0,
      marginBottom: 4,
    },
    segment: segmentTab.segment,
    segBtn: segmentTab.segBtn,
    segBtnActive: segmentTab.segBtnActive,
    segText: segmentTab.segText,
    segTextActive: segmentTab.segTextActive,
    list: { ...webScrollViewportStyle },
    rowWrap: { marginBottom: 14 },
    loadingBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
    },
    footerLoading: {
      paddingVertical: 18,
      alignItems: 'center',
    },
    emptyBox: {
      paddingVertical: 48,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: sf(14),
      lineHeight: sf(20),
      fontWeight: '600',
      color: theme.textMuted,
      textAlign: 'center',
    },
    errBox: {
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.danger,
      backgroundColor: theme.dangerDim,
    },
    errText: {
      fontSize: sf(13),
      lineHeight: sf(18),
      fontWeight: '700',
      color: theme.danger,
    },
    pressed: { opacity: 0.78 },
  });
}
