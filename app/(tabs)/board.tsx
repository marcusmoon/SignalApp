import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useFocusEffect, useIsFocused } from 'expo-router/react-navigation';

import { CommunityPostCard, communitySourceLabelId } from '@/components/community/CommunityPostCard';
import { WebWheelFlatList } from '@/components/layout/WebWheelFlatList';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { FloatingGlassFab } from '@/components/signal/FloatingGlassFab';
import {
  COMMUNITY_SOURCE_ALL,
  COMMUNITY_SOURCE_ORDER,
  type CommunitySourceFilter,
} from '@/constants/communitySources';
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
  SCREEN_LIST_CONTENT_PADDING_TOP,
} from '@/constants/segmentTabBar';
import { APP_CONTENT_MAX_WIDTH, wideContentFill } from '@/constants/responsiveLayout';
import {
  fabStackBottom,
  SCREEN_FIXED_HEADER_PADDING_BOTTOM,
  SCREEN_FIXED_HEADER_PADDING_HORIZONTAL,
  SCREEN_FIXED_HEADER_PADDING_TOP,
  tabScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { webFlexFill, webScrollViewportStyle, webShellBackground, WEB_FLATLIST_BATCH, WEB_FLATLIST_INITIAL, WEB_FLATLIST_WINDOW } from '@/constants/webLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useSidebarSubTabs } from '@/contexts/SidebarSubTabsContext';
import { useResetRefreshingOnTabBlur } from '@/hooks';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { fetchSignalCommunity } from '@/integrations/signal-api/community';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiCommunityPost, SignalCommunityListMeta } from '@/integrations/signal-api/types';
import type { MessageId } from '@/locales/messages';
import { hasSignalApi } from '@/services/env';
import { useWebFlatListLoadMore } from '@/hooks/useWebFlatListLoadMore';

const PAGE_SIZE = 30;

const SOURCE_LABEL: Record<CommunitySourceFilter, MessageId> = {
  all: 'communitySourceAll',
  naver_likeusstock_free: 'communitySourceNaverLikeusstock',
  save_user_news: 'communitySourceSaveUserNews',
};

export default function BoardScreen() {
  const { t } = useLocale();
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isFocused = useIsFocused();
  const { useTwoPane } = useResponsiveLayout();
  const { setSubTabs, clearSubTabs } = useSidebarSubTabs();
  const [source, setSource] = useState<CommunitySourceFilter>(COMMUNITY_SOURCE_ALL);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SignalApiCommunityPost[]>([]);
  const [meta, setMeta] = useState<SignalCommunityListMeta | null>(null);
  const loadingMoreRef = useRef(false);
  const itemsRef = useRef<SignalApiCommunityPost[]>([]);
  itemsRef.current = items;

  const load = useCallback(
    async (opts?: { refresh?: boolean; loadMore?: boolean; sourceFilter?: CommunitySourceFilter }) => {
      const nextSource = opts?.sourceFilter ?? source;
      const loadMore = opts?.loadMore === true;
      if (!hasSignalApi()) {
        setItems([]);
        setMeta(null);
        setError(t('errorSignalApiShort'));
        return;
      }
      if (loadMore) {
        if (loadingMoreRef.current || !meta?.hasMore) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      } else if (!opts?.refresh && itemsRef.current.length === 0) {
        setLoading(true);
      }
      setError(null);
      try {
        const offset = loadMore ? meta?.nextOffset ?? itemsRef.current.length : 0;
        const page = await fetchSignalCommunity({
          source: nextSource,
          limit: PAGE_SIZE,
          offset,
        });
        setItems((prev) => (loadMore ? [...prev, ...page.items] : page.items));
        setMeta(page.meta);
      } catch (e) {
        if (!loadMore) {
          setItems([]);
          setMeta(null);
        }
        setError(formatSignalApiError(e, t, 'communityErrorLoad'));
      } finally {
        if (loadMore) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [meta?.hasMore, meta?.nextOffset, source, t],
  );

  useEffect(() => {
    void load({ sourceFilter: source });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load({ refresh: true });
  }, [load]);

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

  const changeSource = useCallback(
    (next: CommunitySourceFilter) => {
      if (next === source) return;
      setSource(next);
      setItems([]);
      setMeta(null);
      setLoading(true);
      void load({ sourceFilter: next });
    },
    [load, source],
  );

  useFocusEffect(
    useCallback(() => {
      if (!useTwoPane) return;
      setSubTabs(
        COMMUNITY_SOURCE_ORDER.map((key) => ({
          key,
          label: t(SOURCE_LABEL[key]),
          active: source === key,
          onPress: () => changeSource(key),
        })),
      );
      return () => clearSubTabs();
    }, [changeSource, clearSubTabs, setSubTabs, source, t, useTwoPane]),
  );

  const listBottomPad = tabScreenScrollBottomPadding(tabBarHeight, insets.bottom);
  const fabStackBottomOffset = fabStackBottom(tabBarHeight, insets.bottom);

  const renderItem = useCallback(
    ({ item }: { item: SignalApiCommunityPost }) => (
      <View style={styles.rowWrap}>
        <CommunityPostCard item={item} sourceLabelId={communitySourceLabelId(item.source)} />
      </View>
    ),
    [styles.rowWrap],
  );

  return (
    <SafeAreaView style={styles.safe} edges={useTwoPane ? [] : ['top']}>
      {!useTwoPane ? <SignalHeader compact onBrandPress={onRefresh} /> : null}
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={[styles.mainColumn, useTwoPane && styles.mainColumnWide]}>
        {!useTwoPane ? (
          <View style={styles.topFixed}>
            <View style={styles.segment}>
              {COMMUNITY_SOURCE_ORDER.map((key) => {
                const active = source === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => changeSource(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [styles.segBtn, active && styles.segBtnActive, pressed && styles.pressed]}>
                    <Text style={[styles.segText, active && styles.segTextActive]}>{t(SOURCE_LABEL[key])}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
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
            style={styles.list}
            contentContainerStyle={{ paddingBottom: listBottomPad, paddingHorizontal: 16, paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP }}
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
      {hasSignalApi() && !useTwoPane ? (
        <FloatingGlassFab
          bottom={fabStackBottomOffset}
          onPress={onRefresh}
          iconName="sync"
          accessibilityLabel={t('fabRefreshA11y')}
          disabled={refreshing}
        />
      ) : null}
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
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
      zIndex: 2,
      elevation: Platform.OS === 'android' ? 2 : 0,
      paddingHorizontal: SCREEN_FIXED_HEADER_PADDING_HORIZONTAL,
      paddingTop: SCREEN_FIXED_HEADER_PADDING_TOP,
      paddingBottom: SCREEN_FIXED_HEADER_PADDING_BOTTOM,
      backgroundColor: theme.bg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: theme.bgElevated,
      borderRadius: SEGMENT_TAB_OUTER_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: SEGMENT_TAB_PADDING,
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
    list: { ...webScrollViewportStyle },
    rowWrap: { marginBottom: 10 },
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
      borderRadius: 12,
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
