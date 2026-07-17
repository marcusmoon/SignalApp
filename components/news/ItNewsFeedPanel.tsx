import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useFocusEffect, useIsFocused } from 'expo-router/react-navigation';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeNewsStyles } from '@/components/news/newsStyles';
import { WebWheelFlatList } from '@/components/layout/WebWheelFlatList';
import { FeedNewContentChip } from '@/components/signal/FeedNewContentChip';
import { groupedFeedRowEdges, groupedFeedRowShell } from '@/components/signal/groupedFeedList';
import { NewsCard } from '@/components/signal/NewsCard';
import { SkeletonFeed } from '@/components/signal/SkeletonFeed';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import {
  SCREEN_LIST_CONTENT_PADDING_TOP,
  tabScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import {
  WEB_FLATLIST_BATCH,
  WEB_FLATLIST_INITIAL,
  WEB_FLATLIST_WINDOW,
} from '@/constants/webLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { usePhoneMoreStackChrome } from '@/contexts/PhoneMoreStackChromeContext';
import { useRegisterWebHeaderRefresh } from '@/contexts/WebHeaderRefreshContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { FEED_PAGE_GLOBAL, appendUniqueNewsRows, dedupeNewsFeedRows } from '@/domain/news';
import {
  useResetRefreshingOnTabBlur,
  useScrollToTopOnChange,
  useTabScreenLoadingRecovery,
} from '@/hooks';
import { useWebFlatListLoadMore } from '@/hooks/useWebFlatListLoadMore';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { fetchSignalNews, signalNewsToNewsItem } from '@/integrations/signal-api';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiNewsItem, SignalNewsListMeta } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import type { NewsItem } from '@/types/signal';

const IT_NEWS_CATEGORY = 'it';

type FeedRow = { kind: 'news'; news: NewsItem };

export type ItNewsFeedPanelHandle = {
  refresh: () => void;
};

type Props = {
  panelRef?: MutableRefObject<ItNewsFeedPanelHandle | null>;
};

/** IT/tech RSS feed — More hub + wide sidebar (above My info). */
export function ItNewsFeedPanel({ panelRef }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeNewsStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { useTwoPane } = useResponsiveLayout();
  const stackChrome = usePhoneMoreStackChrome();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [serverRows, setServerRows] = useState<SignalApiNewsItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [newContentAvailable, setNewContentAvailable] = useState(false);

  const hasMoreRef = useRef(hasMore);
  const loadingMoreRef = useRef(loadingMore);
  const loadingRef = useRef(loading);
  const serverRowsRef = useRef(serverRows);
  const itemsRef = useRef(items);
  const feedMetaRef = useRef<SignalNewsListMeta | null>(null);
  const loadMoreInFlightRef = useRef(false);
  const loadSeqRef = useRef(0);
  const latestSeenIdRef = useRef<string | null>(null);
  hasMoreRef.current = hasMore;
  loadingMoreRef.current = loadingMore;
  loadingRef.current = loading;
  serverRowsRef.current = serverRows;
  itemsRef.current = items;

  const { ref: listRef } = useScrollToTopOnChange([locale], { resyncDeps: [items] });
  const scrollResetKey = locale;

  const syncServerRows = useCallback((rows: SignalApiNewsItem[]) => {
    serverRowsRef.current = rows;
    setServerRows(rows);
  }, []);

  const load = useCallback(
    async (forceRefresh = false) => {
      if (!hasSignalApi()) {
        setItems([]);
        syncServerRows([]);
        feedMetaRef.current = null;
        setHasMore(false);
        setError(t('feedErrorToken'));
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { items: rows, meta } = await fetchSignalNews(
          {
            locale,
            category: IT_NEWS_CATEGORY,
            limit: FEED_PAGE_GLOBAL,
            offset: 0,
          },
          { cacheMode: signalCacheMode(forceRefresh) },
        );
        feedMetaRef.current = meta;
        syncServerRows(rows);
        const nextItems = dedupeNewsFeedRows(rows).map((item) => signalNewsToNewsItem(item, locale));
        setItems(nextItems);
        setHasMore(meta.hasMore);
        if (nextItems[0]?.id) latestSeenIdRef.current = nextItems[0].id;
        setNewContentAvailable(false);
      } catch (e) {
        setError(formatSignalApiError(e, t, 'feedErrorLoad'));
      } finally {
        setLoading(false);
      }
    },
    [locale, syncServerRows, t],
  );

  useTabScreenLoadingRecovery(items, setLoading);

  const loadMore = useCallback(async () => {
    if (!hasSignalApi() || loadMoreInFlightRef.current || !hasMoreRef.current) return;
    loadMoreInFlightRef.current = true;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      let requestOffset = feedMetaRef.current?.nextOffset ?? serverRowsRef.current.length;
      const { items: nextRows, meta } = await fetchSignalNews(
        {
          locale,
          category: IT_NEWS_CATEGORY,
          limit: FEED_PAGE_GLOBAL,
          offset: requestOffset,
        },
        { cacheMode: signalCacheMode() },
      );
      feedMetaRef.current = meta;
      if (nextRows.length === 0) {
        setHasMore(false);
        return;
      }
      const { merged, addedCount } = appendUniqueNewsRows(serverRowsRef.current, nextRows);
      syncServerRows(merged);
      if (addedCount > 0) {
        setItems(dedupeNewsFeedRows(merged).map((item) => signalNewsToNewsItem(item, locale)));
      }
      setHasMore(meta.hasMore);
    } catch (e) {
      setError(formatSignalApiError(e, t, 'feedErrorLoad'));
    } finally {
      loadMoreInFlightRef.current = false;
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [locale, syncServerRows, t]);

  const onRefreshBase = useCallback(async () => {
    setRefreshing(true);
    const seq = ++loadSeqRef.current;
    try {
      await load(true);
      if (seq !== loadSeqRef.current) return;
      setError(null);
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(formatSignalApiError(e, t, 'feedErrorRefresh'));
    } finally {
      if (seq === loadSeqRef.current) setRefreshing(false);
    }
  }, [load, t]);

  useRegisterWebHeaderRefresh(() => void onRefreshBase());

  useEffect(() => {
    if (!panelRef) return;
    panelRef.current = { refresh: () => void onRefreshBase() };
    return () => {
      panelRef.current = null;
    };
  }, [onRefreshBase, panelRef]);

  const webFeedLoadMore = useWebFlatListLoadMore({
    hasMore,
    loadingMore,
    loading,
    loadMore,
    enabled: Platform.OS === 'web' && isFocused,
    isBusyRef: loadMoreInFlightRef,
  });

  useFocusEffect(
    useCallback(() => {
      if (itemsRef.current.length === 0) void load(false);
    }, [load]),
  );

  useEffect(() => {
    if (!isFocused || !hasSignalApi()) return;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const { items: rows } = await fetchSignalNews(
            { locale, category: IT_NEWS_CATEGORY, limit: 1, offset: 0 },
            { cacheMode: 'bypass' },
          );
          const latestId = rows[0]?.id;
          if (!latestId || !latestSeenIdRef.current) return;
          if (latestId !== latestSeenIdRef.current) setNewContentAvailable(true);
        } catch {
          /* ignore poll errors */
        }
      })();
    }, 60_000);
    return () => clearInterval(timer);
  }, [isFocused, locale]);

  const feedRows = useMemo<FeedRow[]>(() => items.map((news) => ({ kind: 'news', news })), [items]);

  const listBottomPad = useMemo(() => {
    if (stackChrome) {
      return Math.max(insets.bottom, 16) + 24;
    }
    return tabScreenScrollBottomPadding(tabBarHeight, insets.bottom);
  }, [insets.bottom, stackChrome, tabBarHeight]);

  const onChipPress = useCallback(() => {
    setNewContentAvailable(false);
    void onRefreshBase();
  }, [onRefreshBase]);

  return (
    <View style={[styles.mainColumn, useTwoPane && styles.mainColumnWide]}>
      {newContentAvailable ? (
        <View style={styles.topFixed}>
          <FeedNewContentChip
            visible
            refreshing={refreshing}
            message={t('feedNewContentAvailable')}
            onPress={onChipPress}
          />
        </View>
      ) : null}
      {error ? (
        <View style={[styles.listHeader, styles.errBox]}>
          <Text style={styles.errText}>{error}</Text>
        </View>
      ) : null}
      {loading && items.length === 0 ? (
        <View style={styles.skeletonBlock}>
          <SkeletonFeed />
        </View>
      ) : (
        <WebWheelFlatList
          ref={listRef as never}
          scrollResetKey={scrollResetKey}
          data={feedRows}
          keyExtractor={(row) => row.news.id}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP, paddingBottom: listBottomPad },
          ]}
          refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={() => void onRefreshBase()} />}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.55}
          onScroll={webFeedLoadMore.onScroll}
          scrollEventThrottle={350}
          onContentSizeChange={webFeedLoadMore.onContentSizeChange}
          onLayout={webFeedLoadMore.onLayout}
          initialNumToRender={WEB_FLATLIST_INITIAL}
          maxToRenderPerBatch={WEB_FLATLIST_BATCH}
          windowSize={WEB_FLATLIST_WINDOW}
          ListEmptyComponent={
            !loading ? <Text style={[styles.empty, { paddingHorizontal: 16 }]}>{t('feedEmpty')}</Text> : null
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.listHeader}>
                <Text style={styles.empty}>{t('commonLoading')}</Text>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => {
            const edges = groupedFeedRowEdges(feedRows, index, 'news');
            return (
              <View style={edges ? groupedFeedRowShell(theme, edges) : undefined}>
                <NewsCard item={item.news} layout="grouped" titleToggle titleShowAlternate={false} />
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
