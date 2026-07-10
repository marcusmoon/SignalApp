import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useFocusEffect, useIsFocused } from 'expo-router/react-navigation';
import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { WebWheelFlatList } from '@/components/layout/WebWheelFlatList';
import { MasterDetailLayout } from '@/components/layout/MasterDetailLayout';
import { makeNewsStyles } from '@/components/news/newsStyles';
import { NewsDigestIssueCard } from '@/components/news/NewsDigestIssueCard';
import {
  digestFromServer,
  filterRealtimeNewsRows,
  mergeDigestRows,
  mergeNewsRows,
  utcRangeLastHours,
} from '@/components/news/digestFeedModel';
import { NewsCard } from '@/components/signal/NewsCard';
import { groupedFeedRowEdges, groupedFeedRowShell } from '@/components/signal/groupedFeedList';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { FeedNewContentChip } from '@/components/signal/FeedNewContentChip';
import { FloatingGlassFab } from '@/components/signal/FloatingGlassFab';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { DEFAULT_NEWS_SEGMENT, NEWS_SEGMENT_ORDER, parseNewsSegmentKey, type NewsSegmentKey } from '@/constants/newsSegment';
import { fabStackBottom, SCREEN_WIDE_SCROLL_BOTTOM_BASE, tabScreenScrollBottomPadding } from '@/constants/screenLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useRegisterWebHeaderRefresh } from '@/contexts/WebHeaderRefreshContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useSidebarSubTabs } from '@/contexts/SidebarSubTabsContext';
import { NEWS_SEGMENT_LABEL } from '@/domain/news';
import {
  useResetRefreshingOnTabBlur,
  useScrollToTopOnChange,
  useTabPressCycleSegment,
} from '@/hooks';
import { useWebFlatListLoadMore } from '@/hooks/useWebFlatListLoadMore';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { fetchSignalNews, fetchSignalNewsDigests, signalNewsToNewsItem } from '@/integrations/signal-api';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiNewsDigestItem, SignalApiNewsItem, SignalNewsListMeta } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import {
  DEFAULT_NEWS_HASHTAG_DISPLAY_MAX,
  loadNewsHashtagDisplayMax,
} from '@/services/newsHashtagDisplayPreference';
import {
  loadNewsTitleDisplayMode,
  saveNewsTitleDisplayMode,
  type NewsTitleDisplayMode,
} from '@/services/newsTitleDisplayPreference';
import { loadNewsSegmentOrder } from '@/services/newsSegmentOrderPreference';
import { saveNewsSegment } from '@/services/newsSegmentPreference';
import { createScrollLoadMoreGate } from '@/utils/listScrollLoadMoreGate';
import { firstRouteParam } from '@/utils/routeSearchParams';
import { useSafeSetRouteParams } from '@/utils/safeRouteParams';

const DIGEST_SEGMENTS = new Set<NewsSegmentKey>(['global', 'korea', 'crypto']);
const DIGEST_WINDOW_HOURS = 24;
const NEWS_INITIAL_LIMIT = 50;
const NEWS_PAGE_LIMIT = 20;
const DIGEST_INITIAL_LIMIT = 20;
const DIGEST_PAGE_LIMIT = 20;
const MAX_NEWS_SKIP_PAGES = 10;

type SegmentLatestSeen = { newsId?: string; digestId?: string };

type DigestFeedSectionProps = {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  isLast?: boolean;
  styles: ReturnType<typeof makeNewsStyles>;
  children: ReactNode;
};

function DigestFeedSection({
  title,
  hint,
  actionLabel,
  onAction,
  isLast,
  styles,
  children,
}: DigestFeedSectionProps) {
  return (
    <View style={[styles.digestFeedSection, isLast && styles.digestFeedSectionLast]}>
      <DigestPaneHeader
        title={title}
        hint={hint}
        actionLabel={actionLabel}
        onAction={onAction}
        styles={styles}
      />
      {children}
    </View>
  );
}

type DigestPaneHeaderProps = {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
  styles: ReturnType<typeof makeNewsStyles>;
  wide?: boolean;
};

function DigestPaneHeader({
  title,
  hint,
  actionLabel,
  onAction,
  styles,
  wide = false,
}: DigestPaneHeaderProps) {
  const headerRow = (
    <View style={styles.digestFeedSectionHeaderRow}>
      <View style={styles.digestFeedSectionHeaderText}>
        <Text style={styles.digestFeedSectionTitle}>{title}</Text>
        {hint ? <Text style={styles.digestFeedSectionHint}>{hint}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={styles.digestFeedSectionMoreBtn}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}>
          <Text style={styles.digestFeedSectionMoreText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  if (wide) {
    return <View style={styles.widePaneHeader}>{headerRow}</View>;
  }

  return <View style={styles.digestFeedSectionHeader}>{headerRow}</View>;
}

export function DigestNewsFeedScreen() {
  const routeParams = useLocalSearchParams<{ segment?: string }>();
  const setRouteParams = useSafeSetRouteParams();
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeNewsStyles(theme, scaleFont), [theme, scaleFont]);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { useTwoPane } = useResponsiveLayout();
  const { setSubTabs, clearSubTabs } = useSidebarSubTabs();

  const [segment, setSegment] = useState<NewsSegmentKey>(() => {
    const fromUrl = parseNewsSegmentKey(firstRouteParam(routeParams.segment));
    const initial = fromUrl ?? DEFAULT_NEWS_SEGMENT;
    return DIGEST_SEGMENTS.has(initial) ? initial : DEFAULT_NEWS_SEGMENT;
  });
  const [segmentOrder, setSegmentOrder] = useState<NewsSegmentKey[]>([...NEWS_SEGMENT_ORDER]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  const [error, setError] = useState<string | null>(null);
  const [digestRows, setDigestRows] = useState<SignalApiNewsDigestItem[]>([]);
  const [newsPoolRows, setNewsPoolRows] = useState<SignalApiNewsItem[]>([]);
  const [newsHasMore, setNewsHasMore] = useState(false);
  const [newsLoadingMore, setNewsLoadingMore] = useState(false);
  const loadMoreInFlightRef = useRef(false);
  const newsHasMoreRef = useRef(false);
  const newsMetaRef = useRef<SignalNewsListMeta | null>(null);
  const [digestHasMore, setDigestHasMore] = useState(false);
  const [digestLoadingMore, setDigestLoadingMore] = useState(false);
  const digestLoadingMoreRef = useRef(false);
  digestLoadingMoreRef.current = digestLoadingMore;
  const [maxHashtagDisplay, setMaxHashtagDisplay] = useState(DEFAULT_NEWS_HASHTAG_DISPLAY_MAX);
  const [newsTitleDisplayMode, setNewsTitleDisplayMode] = useState<NewsTitleDisplayMode>('localized');
  const [newContentSegments, setNewContentSegments] = useState(() => new Set<NewsSegmentKey>());
  const latestSeenBySegmentRef = useRef<Partial<Record<NewsSegmentKey, SegmentLatestSeen>>>({});
  const digestRowsRef = useRef(digestRows);
  const newsPoolRowsRef = useRef(newsPoolRows);
  digestRowsRef.current = digestRows;
  newsPoolRowsRef.current = newsPoolRows;
  newsHasMoreRef.current = newsHasMore;

  const fetchNewsPages = useCallback(
    async (
      startPool: SignalApiNewsItem[],
      startMeta: SignalNewsListMeta,
      digestSnapshot: SignalApiNewsDigestItem[],
      pageLimit: number,
      cacheMode: ReturnType<typeof signalCacheMode>,
    ): Promise<{ pool: SignalApiNewsItem[]; meta: SignalNewsListMeta }> => {
      let pool = startPool;
      let meta = startMeta;

      if (filterRealtimeNewsRows(pool, digestSnapshot).length > 0 || !meta.hasMore) {
        return { pool, meta };
      }

      let requestOffset = meta.nextOffset ?? pool.length;
      for (let page = 0; page < MAX_NEWS_SKIP_PAGES; page += 1) {
        const pageResult = await fetchSignalNews(
          { locale, category: segment, limit: pageLimit, offset: requestOffset },
          { cacheMode },
        );
        meta = pageResult.meta;
        if (pageResult.items.length === 0) {
          break;
        }

        const prevVisible = filterRealtimeNewsRows(pool, digestSnapshot).length;
        pool = mergeNewsRows(pool, pageResult.items);
        const nextVisible = filterRealtimeNewsRows(pool, digestSnapshot).length;
        const visibleAdded = nextVisible - prevVisible;

        if (visibleAdded > 0 || !meta.hasMore) {
          break;
        }

        if (meta.nextOffset == null || meta.nextOffset === requestOffset) {
          break;
        }
        requestOffset = meta.nextOffset;
      }

      return { pool, meta };
    },
    [locale, segment],
  );

  const markSegmentHasNewContent = useCallback((seg: NewsSegmentKey) => {
    setNewContentSegments((prev) => {
      if (prev.has(seg)) return prev;
      const next = new Set(prev);
      next.add(seg);
      return next;
    });
  }, []);

  const clearSegmentNewContent = useCallback((seg: NewsSegmentKey) => {
    setNewContentSegments((prev) => {
      if (!prev.has(seg)) return prev;
      const next = new Set(prev);
      next.delete(seg);
      return next;
    });
  }, []);

  const syncSegmentLatestSeen = useCallback(
    (seg: NewsSegmentKey, ids: { newsId?: string | null; digestId?: string | null }) => {
      const prev = latestSeenBySegmentRef.current[seg] ?? {};
      const next: SegmentLatestSeen = { ...prev };
      const newsId = ids.newsId?.trim();
      const digestId = ids.digestId?.trim();
      if (newsId) next.newsId = newsId;
      if (digestId) next.digestId = digestId;
      latestSeenBySegmentRef.current[seg] = next;
      clearSegmentNewContent(seg);
    },
    [clearSegmentNewContent],
  );

  const scrollTopDeps = [segment];
  const { ref: feedScrollRef, scrollToTop } = useScrollToTopOnChange(scrollTopDeps, {
    resyncDeps: [digestRows, newsPoolRows],
  });
  const digestScrollRef = useRef<ScrollView>(null);
  const feedScrollResetKey = useTwoPane ? `${segment}:wide:news` : `${segment}:news`;

  const digestSegmentOrder = useMemo(
    () => segmentOrder.filter((key) => DIGEST_SEGMENTS.has(key)),
    [segmentOrder],
  );

  const load = useCallback(
    async (forceRefresh?: boolean) => {
      setError(null);
      if (!hasSignalApi()) {
        setDigestRows([]);
        setNewsPoolRows([]);
        setNewsHasMore(false);
        setDigestHasMore(false);
        setError(t('errorSignalApiShort'));
        return;
      }
      const cacheMode = signalCacheMode(forceRefresh);
      const range = utcRangeLastHours(DIGEST_WINDOW_HOURS);
      try {
        const [digestPage, newsSeed] = await Promise.all([
          fetchSignalNewsDigests(
            {
              category: segment,
              from: range.from,
              to: range.to,
              limit: DIGEST_INITIAL_LIMIT,
              offset: 0,
              batches: 20,
            },
            { cacheMode },
          ),
          fetchSignalNews(
            { locale, category: segment, limit: NEWS_INITIAL_LIMIT, offset: 0 },
            { cacheMode },
          ),
        ]);
        const { pool: newsPool, meta: newsMeta } = await fetchNewsPages(
          newsSeed.items,
          newsSeed.meta,
          digestPage.items,
          NEWS_PAGE_LIMIT,
          cacheMode,
        );
        setDigestRows(digestPage.items);
        setNewsPoolRows(newsPool);
        newsMetaRef.current = newsMeta;
        setNewsHasMore(newsMeta.hasMore);
        newsHasMoreRef.current = newsMeta.hasMore;
        setDigestHasMore(digestPage.meta.hasMore);
        syncSegmentLatestSeen(segment, {
          newsId: newsPool[0]?.id ?? null,
          digestId: digestPage.items[0]?.id ?? null,
        });
      } catch (e) {
        setError(formatSignalApiError(e, t, 'feedErrorLoad'));
        setDigestRows([]);
        setNewsPoolRows([]);
        setNewsHasMore(false);
        newsHasMoreRef.current = false;
        newsMetaRef.current = null;
        setDigestHasMore(false);
      }
    },
    [fetchNewsPages, locale, segment, syncSegmentLatestSeen, t],
  );

  const loadMoreDigests = useCallback(async () => {
    if (!hasSignalApi() || digestLoadingMore || !digestHasMore) return;

    setDigestLoadingMore(true);
    try {
      const range = utcRangeLastHours(DIGEST_WINDOW_HOURS);
      const page = await fetchSignalNewsDigests(
        {
          category: segment,
          from: range.from,
          to: range.to,
          limit: DIGEST_PAGE_LIMIT,
          offset: digestRowsRef.current.length,
          batches: 20,
        },
        { cacheMode: signalCacheMode() },
      );
      setDigestRows((prev) => mergeDigestRows(prev, page.items));
      setDigestHasMore(page.meta.hasMore);
    } catch {
      /* ignore pagination errors */
    } finally {
      setDigestLoadingMore(false);
    }
  }, [digestHasMore, digestLoadingMore, segment]);

  const loadMoreNews = useCallback(async () => {
    if (!hasSignalApi() || loadMoreInFlightRef.current || !newsHasMoreRef.current) return;

    loadMoreInFlightRef.current = true;
    setNewsLoadingMore(true);
    try {
      const digestSnapshot = digestRowsRef.current;
      let pool = newsPoolRowsRef.current;
      let requestOffset = newsMetaRef.current?.nextOffset ?? pool.length;
      let lastMeta = newsMetaRef.current;

      for (let skipPages = 0; skipPages < MAX_NEWS_SKIP_PAGES; skipPages += 1) {
        const page = await fetchSignalNews(
          { locale, category: segment, limit: NEWS_PAGE_LIMIT, offset: requestOffset },
          { cacheMode: signalCacheMode() },
        );
        lastMeta = page.meta;
        if (page.items.length === 0) {
          newsHasMoreRef.current = false;
          setNewsHasMore(false);
          break;
        }

        const prevVisible = filterRealtimeNewsRows(pool, digestSnapshot).length;
        pool = mergeNewsRows(pool, page.items);
        const visibleAdded =
          filterRealtimeNewsRows(pool, digestSnapshot).length - prevVisible;

        if (visibleAdded > 0 || !page.meta.hasMore) {
          break;
        }

        if (page.meta.nextOffset == null || page.meta.nextOffset === requestOffset) {
          break;
        }
        requestOffset = page.meta.nextOffset;
      }

      if (lastMeta) {
        newsMetaRef.current = lastMeta;
        newsHasMoreRef.current = lastMeta.hasMore;
        setNewsHasMore(lastMeta.hasMore);
      }
      newsPoolRowsRef.current = pool;
      setNewsPoolRows(pool);
    } catch {
      /* ignore pagination errors */
    } finally {
      loadMoreInFlightRef.current = false;
      setNewsLoadingMore(false);
    }
  }, [locale, segment]);

  useEffect(() => {
    if (!hasSignalApi() || !isFocused) return;
    const POLL_MS = 3 * 60 * 1000;

    const fetchLatestIdsForSegment = async (
      seg: NewsSegmentKey,
    ): Promise<{ newsId: string | null; digestId: string | null }> => {
      const range = utcRangeLastHours(DIGEST_WINDOW_HOURS);
      const [newsPage, digestPage] = await Promise.all([
        fetchSignalNews({ locale, category: seg, limit: 1, offset: 0 }, { cacheMode: 'bypass' }),
        fetchSignalNewsDigests(
          { category: seg, from: range.from, to: range.to, limit: 1, batches: 1 },
          { cacheMode: 'bypass' },
        ),
      ]);
      return {
        newsId: newsPage.items[0]?.id ?? null,
        digestId: digestPage.items[0]?.id ?? null,
      };
    };

    const poll = async () => {
      await Promise.all(
        digestSegmentOrder.map(async (seg) => {
          try {
            const seen = latestSeenBySegmentRef.current[seg];
            if (!seen?.newsId && !seen?.digestId) return;
            const { newsId, digestId } = await fetchLatestIdsForSegment(seg);
            const newsChanged = Boolean(seen.newsId && newsId && newsId !== seen.newsId);
            const digestChanged = Boolean(seen.digestId && digestId && digestId !== seen.digestId);
            if (newsChanged || digestChanged) markSegmentHasNewContent(seg);
          } catch {
            /* ignore polling errors */
          }
        }),
      );
    };

    void poll();
    const id = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(id);
  }, [digestSegmentOrder, isFocused, locale, markSegmentHasNewContent]);

  useEffect(() => {
    void loadNewsSegmentOrder().then(setSegmentOrder);
    void loadNewsTitleDisplayMode().then(setNewsTitleDisplayMode);
    void loadNewsHashtagDisplayMax().then(setMaxHashtagDisplay);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const showLoading =
          digestRowsRef.current.length === 0 && newsPoolRowsRef.current.length === 0;
        if (showLoading) setLoading(true);
        try {
          await load(false);
        } catch (e) {
          if (!cancelled) {
            setError(formatSignalApiError(e, t, 'feedErrorLoad'));
            setDigestRows([]);
            setNewsPoolRows([]);
            setNewsHasMore(false);
            setDigestHasMore(false);
            newsHasMoreRef.current = false;
            newsMetaRef.current = null;
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [load, t]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    clearSegmentNewContent(segment);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [clearSegmentNewContent, load, segment]);

  const onNewContentChipPress = useCallback(async () => {
    await onRefresh();
    scrollToTop(false);
    digestScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [onRefresh, scrollToTop]);

  useRegisterWebHeaderRefresh(() => void onRefresh());

  const onPickSegment = useCallback(
    (key: NewsSegmentKey) => {
      if (!DIGEST_SEGMENTS.has(key)) return;
      if (segment === key) return;
      setLoading(true);
      setDigestRows([]);
      setNewsPoolRows([]);
      setNewsHasMore(false);
      setDigestHasMore(false);
      newsHasMoreRef.current = false;
      newsMetaRef.current = null;
      setError(null);
      setSegment(key);
      void saveNewsSegment(key);
      setRouteParams({ segment: key === DEFAULT_NEWS_SEGMENT ? undefined : key });
    },
    [segment, setRouteParams],
  );

  useTabPressCycleSegment(segment, digestSegmentOrder, onPickSegment);

  useFocusEffect(
    useCallback(() => {
      if (!useTwoPane) return;
      setSubTabs(
        digestSegmentOrder.map((key) => ({
          key,
          label: t(NEWS_SEGMENT_LABEL[key]),
          active: segment === key,
          onPress: () => onPickSegment(key),
        })),
      );
      return () => clearSubTabs();
    }, [clearSubTabs, digestSegmentOrder, onPickSegment, segment, setSubTabs, t, useTwoPane]),
  );

  const toggleNewsTitleDisplayMode = useCallback(() => {
    setNewsTitleDisplayMode((prev) => {
      const next: NewsTitleDisplayMode = prev === 'localized' ? 'alternate' : 'localized';
      void saveNewsTitleDisplayMode(next);
      return next;
    });
  }, []);

  const digestItems = useMemo(
    () => digestRows.map((row) => digestFromServer(row, newsPoolRows)),
    [digestRows, newsPoolRows],
  );
  const newsPoolItems = useMemo(
    () => filterRealtimeNewsRows(newsPoolRows, digestRows),
    [digestRows, newsPoolRows],
  );
  const newsItems = useMemo(
    () => newsPoolItems.map((row) => signalNewsToNewsItem(row, locale)),
    [locale, newsPoolItems],
  );
  const showNewsLoadMore = newsHasMore;

  const scrollLoadMoreGateRef = useRef(createScrollLoadMoreGate());
  const digestScrollLoadMoreGateRef = useRef(createScrollLoadMoreGate());
  const webNewsLoadMore = useWebFlatListLoadMore({
    hasMore: showNewsLoadMore,
    loadingMore: newsLoadingMore,
    loading,
    loadMore: loadMoreNews,
    enabled: Platform.OS === 'web' && isFocused,
    isBusyRef: loadMoreInFlightRef,
  });
  const webDigestLoadMore = useWebFlatListLoadMore({
    hasMore: digestHasMore,
    loadingMore: digestLoadingMore,
    loading,
    loadMore: loadMoreDigests,
    enabled: Platform.OS === 'web' && isFocused && useTwoPane,
    isBusyRef: digestLoadingMoreRef,
  });

  const onFeedScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!showNewsLoadMore || loadMoreInFlightRef.current || loading) return;
      if (Platform.OS === 'web') {
        webNewsLoadMore.onScroll(e);
        return;
      }
      scrollLoadMoreGateRef.current.onScrollNearEnd(e, {
        enabled: true,
        trigger: () => void loadMoreNews(),
      });
    },
    [loading, loadMoreNews, showNewsLoadMore, webNewsLoadMore],
  );

  const onDigestScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!useTwoPane || !digestHasMore || digestLoadingMore || loading) return;
      if (Platform.OS === 'web') {
        webDigestLoadMore.onScroll(e);
        return;
      }
      digestScrollLoadMoreGateRef.current.onScrollNearEnd(e, {
        enabled: true,
        trigger: () => void loadMoreDigests(),
      });
    },
    [digestHasMore, digestLoadingMore, loadMoreDigests, loading, useTwoPane, webDigestLoadMore],
  );

  const handleFeedEndReached = useCallback(() => {
    if (newsHasMoreRef.current) {
      void loadMoreNews();
      return;
    }
    if (!useTwoPane && digestHasMore) {
      void loadMoreDigests();
    }
  }, [digestHasMore, loadMoreDigests, loadMoreNews, useTwoPane]);

  const newsTitleShowAlternate = newsTitleDisplayMode === 'alternate';
  const newsTitleAlternateIsTranslation = locale === 'en';
  const useNewsTitleFab = Platform.OS !== 'web' && !useTwoPane;
  const titleToggle = segment === 'global' || segment === 'crypto';
  const newsTitleListToggleA11y = newsTitleShowAlternate
    ? t('newsTitleListShowLocalized')
    : newsTitleAlternateIsTranslation
      ? t('newsTitleListShowTranslation')
      : t('newsTitleListShowOriginal');
  const newContentAvailable = newContentSegments.has(segment);
  const bottomPad = useTwoPane
    ? SCREEN_WIDE_SCROLL_BOTTOM_BASE
    : tabScreenScrollBottomPadding(tabBarHeight, insets.bottom);
  const fabBottom = fabStackBottom(tabBarHeight, insets.bottom);

  const renderNewsRow = ({ item, index }: { item: (typeof newsItems)[number]; index: number }) => {
    const rowKinds = newsItems.map(() => ({ kind: 'news' as const }));
    const edges = groupedFeedRowEdges(rowKinds, index, 'news');
    return (
      <View style={edges ? groupedFeedRowShell(theme, edges) : undefined}>
        <NewsCard
          layout="grouped"
          item={item}
          compactMeta
          titleToggle={titleToggle}
          titleShowAlternate={useNewsTitleFab ? newsTitleShowAlternate : undefined}
          maxHashtagsToShow={maxHashtagDisplay}
        />
      </View>
    );
  };

  const renderNewsLoadMore = () => {
    if (!showNewsLoadMore && !newsLoadingMore) return null;
    if (newsLoadingMore) {
      return (
        <View style={styles.footerLoading}>
          <ActivityIndicator color={theme.green} />
          <Text style={styles.footerLoadingText}>{t('feedLoadingMore')}</Text>
        </View>
      );
    }
    return null;
  };

  const renderDigestLoadMore = () => {
    if (!digestHasMore && !digestLoadingMore) return null;
    if (digestLoadingMore) {
      return (
        <View style={styles.footerLoading}>
          <ActivityIndicator color={theme.green} />
          <Text style={styles.footerLoadingText}>{t('feedLoadingMore')}</Text>
        </View>
      );
    }
    return null;
  };

  const renderNewsError = () =>
    error ? (
      <View style={styles.errBox}>
        <Text style={styles.errText}>{error}</Text>
      </View>
    ) : null;

  const renderNewsLoading = () =>
    loading && newsItems.length === 0 ? (
      <View style={styles.skeletonBlock}>
        <SignalLoadingIndicator message={t('commonLoading')} />
      </View>
    ) : null;

  const renderNewsEmpty = () =>
    !loading && newsItems.length === 0 && !error ? (
      <Text style={styles.empty}>{t('newsDigestFeedRealtimeEmpty')}</Text>
    ) : null;

  const renderDigestError = () =>
    error ? (
      <View style={styles.errBox}>
        <Text style={styles.errText}>{error}</Text>
      </View>
    ) : null;

  const renderDigestLoading = () =>
    loading && digestItems.length === 0 ? (
      <View style={styles.skeletonBlock}>
        <SignalLoadingIndicator message={t('commonLoading')} />
      </View>
    ) : null;

  const renderDigestEmpty = () =>
    !loading && digestItems.length === 0 && !error ? (
      <Text style={styles.empty}>{t('newsDigestFeedEmpty')}</Text>
    ) : null;

  const renderDigestCards = () =>
    digestItems.map((item) => <NewsDigestIssueCard key={item.id} digest={item} />);

  const mobileListHeader = (
    <View style={styles.listHeader}>
      <Text style={styles.digestRealtimeHeader}>{t('newsDigestFeedNewsSectionTitle')}</Text>
      {renderNewsError()}
      {renderNewsLoading()}
      {renderNewsEmpty()}
    </View>
  );

  const mobileDigestFooter = (
    <View style={styles.listHeader}>
      {renderNewsLoadMore()}
      <DigestFeedSection title={t('newsDigestFeedDigestSectionTitle')} isLast styles={styles}>
        {renderDigestError()}
        {renderDigestLoading()}
        {renderDigestEmpty()}
        {renderDigestCards()}
        {renderDigestLoadMore()}
      </DigestFeedSection>
    </View>
  );

  const newsListRefreshControl =
    loading && digestItems.length === 0 && newsItems.length === 0 ? undefined : (
      <ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
    );

  const wideNewsPane = (
    <View style={styles.widePane}>
      {isFocused ? (
        <FeedNewContentChip
          visible={newContentAvailable}
          refreshing={refreshing}
          message={t('feedNewContentAvailable')}
          onPress={() => void onNewContentChipPress()}
        />
      ) : null}
      <DigestPaneHeader
        wide
        title={t('newsDigestFeedNewsSectionTitle')}
        styles={styles}
      />
      <WebWheelScrollView
        ref={feedScrollRef as never}
        scrollResetKey={feedScrollResetKey}
        style={styles.widePaneScroll}
        contentContainerStyle={[styles.widePaneListContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        onScroll={onFeedScroll}
        scrollEventThrottle={350}
        onLayout={webNewsLoadMore.onLayout}
        onContentSizeChange={webNewsLoadMore.onContentSizeChange}
        refreshControl={newsListRefreshControl}>
        {renderNewsError()}
        {renderNewsLoading()}
        {renderNewsEmpty()}
        {newsItems.map((item, index) => (
          <View key={item.id}>{renderNewsRow({ item, index })}</View>
        ))}
        {renderNewsLoadMore()}
      </WebWheelScrollView>
    </View>
  );

  const wideDigestPane = (
    <View style={styles.widePane}>
      <DigestPaneHeader
        wide
        title={t('newsDigestFeedDigestSectionTitle')}
        styles={styles}
      />
      <WebWheelScrollView
        ref={digestScrollRef as never}
        scrollResetKey={`${feedScrollResetKey}:digest`}
        style={styles.widePaneScroll}
        contentContainerStyle={[styles.widePaneListContent, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        onScroll={onDigestScroll}
        scrollEventThrottle={350}
        onLayout={webDigestLoadMore.onLayout}
        onContentSizeChange={webDigestLoadMore.onContentSizeChange}
        refreshControl={newsListRefreshControl}>
        {renderDigestError()}
        {renderDigestLoading()}
        {renderDigestEmpty()}
        {renderDigestCards()}
        {renderDigestLoadMore()}
      </WebWheelScrollView>
    </View>
  );

  const mobileFeedContent = (
    <WebWheelFlatList
      ref={feedScrollRef as never}
      scrollResetKey={feedScrollResetKey}
      data={loading && newsItems.length === 0 ? [] : newsItems}
      extraData={`${newsItems.length}:${newsTitleShowAlternate ? 'alt' : 'loc'}`}
      keyExtractor={(item) => item.id}
      renderItem={renderNewsRow}
      ListHeaderComponent={mobileListHeader}
      ListFooterComponent={mobileDigestFooter}
      onEndReached={() => void handleFeedEndReached()}
      onEndReachedThreshold={0.55}
      style={styles.list}
      contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
      onScroll={onFeedScroll}
      scrollEventThrottle={350}
      onLayout={webNewsLoadMore.onLayout}
      onContentSizeChange={webNewsLoadMore.onContentSizeChange}
      refreshControl={newsListRefreshControl}
      removeClippedSubviews={Platform.OS === 'android'}
    />
  );

  return (
    <SafeAreaView style={styles.safe} edges={useTwoPane ? [] : ['top']}>
      {!useTwoPane ? <SignalHeader compact onBrandPress={() => void onRefresh()} /> : null}
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={[styles.mainColumn, useTwoPane && styles.mainColumnWide]}>
        {!useTwoPane ? (
          <View style={styles.topFixed}>
            <View style={styles.segment}>
              {segmentOrder.map((key) => {
                if (!DIGEST_SEGMENTS.has(key)) return null;
                return (
                  <Fragment key={key}>
                    <Pressable
                      onPress={() => onPickSegment(key)}
                      style={[styles.segBtn, segment === key && styles.segBtnActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: segment === key }}>
                      <Text style={[styles.segText, segment === key && styles.segTextActive]}>
                        {t(NEWS_SEGMENT_LABEL[key])}
                      </Text>
                    </Pressable>
                  </Fragment>
                );
              })}
            </View>
          </View>
        ) : null}

        {isFocused && !useTwoPane ? (
          <FeedNewContentChip
            visible={newContentAvailable}
            refreshing={refreshing}
            message={t('feedNewContentAvailable')}
            onPress={() => void onNewContentChipPress()}
          />
        ) : null}

        <MasterDetailLayout
          useTwoPane={useTwoPane}
          style={useTwoPane ? styles.wideLayoutFill : undefined}
          masterWidthRatio={0.5}
          dividerColor={theme.border}
          masterPanel={useTwoPane ? wideNewsPane : mobileFeedContent}
          detailPanel={useTwoPane ? wideDigestPane : undefined}
        />
      </View>

      {useNewsTitleFab && isFocused && titleToggle ? (
        <FloatingGlassFab
          bottom={fabBottom}
          iconName={newsTitleAlternateIsTranslation ? 'language' : 'globe'}
          accessibilityLabel={newsTitleListToggleA11y}
          active={newsTitleShowAlternate}
          onPress={toggleNewsTitleDisplayMode}
        />
      ) : null}
    </SafeAreaView>
  );
}
