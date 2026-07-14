import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from 'expo-router/react-navigation';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useSafeSetRouteParams } from '@/utils/safeRouteParams';

import { CommunityPostCard, communitySourceLabelId, isCommunitySourceKey } from '@/components/community/CommunityPostCard';
import { WebWheelFlatList } from '@/components/layout/WebWheelFlatList';
import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { PhoneDrillHeader } from '@/components/layout/PhoneDrillHeader';
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
import { useIpadSidebarNavActions } from '@/contexts/IpadSidebarNavContext';
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
import {
  clearPhoneMoreEntry,
  usePhoneEnteredFromMore,
} from '@/services/phoneMoreEntry';
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
  /** Tab bar height — 0 when embedded outside Tabs. */
  tabBarHeight?: number;
  /** When false, still load (embedded pane is always "active"). */
  active?: boolean;
};

export function BoardContent({
  embedded = false,
  onBack,
  tabBarHeight = 0,
  active = true,
}: BoardContentProps) {
  const { t } = useLocale();
  const router = useRouter();
  const setRouteParams = useSafeSetRouteParams();
  const routeParams = useLocalSearchParams<{ source?: string | string[] }>();
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const insets = useSafeAreaInsets();
  const { useTwoPane } = useResponsiveLayout();
  const fromMore = !useTwoPane && !embedded && usePhoneEnteredFromMore('board');
  const goBackToMore = useCallback(() => {
    clearPhoneMoreEntry();
    router.navigate('/(tabs)/more' as never);
  }, [router]);
  const ipadNav = useIpadSidebarNavActions();
  const { setSubTabs, setActiveSubTabKey, clearSubTabs } = useOwnedSidebarSubTabs('board');
  const [source, setSource] = useState<CommunitySourceFilter>(
    () => parseCommunitySourceParam(routeParams.source) ?? COMMUNITY_SOURCE_ALL,
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
        if (useTwoPane && !embedded) setActiveSubTabKey(next);
        return;
      }
      sourceRef.current = next;
      setSource(next);
      if (useTwoPane && !embedded) setActiveSubTabKey(next);
      setError(null);
      setItems([]);
      setMeta(null);
      setLoading(true);
      if (!options?.fromRoute && !embedded) {
        setRouteParams({ source: next });
      }
      void loadRef.current({ sourceFilter: next });
    },
    [embedded, setActiveSubTabKey, setRouteParams, useTwoPane],
  );

  useEffect(() => {
    if (embedded) return;
    const paramSource = parseCommunitySourceParam(routeParams.source) ?? COMMUNITY_SOURCE_ALL;
    changeSource(paramSource, { fromRoute: true });
  }, [changeSource, embedded, routeParams.source]);

  const registerBoardSubTabs = useCallback(() => {
    if (!useTwoPane || embedded) return;
    setActiveSubTabKey(source);
    setSubTabs(
      COMMUNITY_SOURCE_ORDER.map((key) => ({
        key,
        label: t(SOURCE_LABEL[key]),
        href: '/(tabs)/board',
        params: { source: key },
        onPress: () => changeSource(key),
      })),
    );
  }, [changeSource, embedded, setActiveSubTabKey, setSubTabs, source, t, useTwoPane]);

  useEffect(() => {
    if (!useTwoPane || !active || embedded) return;
    registerBoardSubTabs();
  }, [active, embedded, registerBoardSubTabs, useTwoPane]);

  useEffect(() => {
    if (!useTwoPane || embedded) return;
    if (!active) return;
    registerBoardSubTabs();
    return () => clearSubTabs();
  }, [active, clearSubTabs, embedded, registerBoardSubTabs, useTwoPane]);

  const listBottomPad = embedded
    ? SCREEN_WIDE_SCROLL_BOTTOM_BASE + insets.bottom
    : tabScreenScrollBottomPadding(tabBarHeight, insets.bottom);

  const openPost = useCallback(
    (id: string) => {
      if (ipadNav.isAvailable) {
        ipadNav.showCommunityPost(id, { drillFrom: embedded ? 'board' : 'tabs' });
        return;
      }
    },
    [embedded, ipadNav],
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

  const showPhoneChrome = !useTwoPane && !embedded && !fromMore;
  const showPhoneSegments = !useTwoPane && !embedded;
  const showEmbeddedSegments = embedded;

  return (
    <SafeAreaView style={styles.safe} edges={useTwoPane || embedded ? [] : ['top']}>
      {showPhoneChrome ? <SignalHeader compact onBrandPress={() => void onRefresh()} /> : null}
      {fromMore ? <PhoneDrillHeader title={t('screenBoard')} onBack={goBackToMore} /> : null}
      {active ? <OtaUpdateBanner /> : null}
      <View style={[styles.mainColumn, (useTwoPane || embedded) && styles.mainColumnWide]}>
        {onBack ? <WideSubpaneHeader title={t('screenBoard')} onBack={onBack} /> : null}
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
