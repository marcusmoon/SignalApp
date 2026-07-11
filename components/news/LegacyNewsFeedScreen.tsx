import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useFocusEffect, useIsFocused } from "expo-router/react-navigation";
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import {
  fabStackBottom,
  tabScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import {
  WEB_FLATLIST_BATCH,
  WEB_FLATLIST_INITIAL,
  WEB_FLATLIST_WINDOW,
} from '@/constants/webLayout';
import { DEFAULT_NEWS_SEGMENT, NEWS_SEGMENT_ORDER, parseNewsSegmentKey, type NewsSegmentKey } from '@/constants/newsSegment';
import { AdPlaceholder } from '@/components/signal/AdPlaceholder';
import { groupedFeedRowEdges, groupedFeedRowShell } from '@/components/signal/groupedFeedList';
import { NewsCard } from '@/components/signal/NewsCard';
import { YoutubeCard } from '@/components/signal/YoutubeCard';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { DigestPager } from '@/components/news/DigestPager';
import { WebWheelFlatList } from '@/components/layout/WebWheelFlatList';
import { FeedNewContentChip } from '@/components/signal/FeedNewContentChip';
import { FloatingGlassFab } from '@/components/signal/FloatingGlassFab';
import { makeNewsStyles } from '@/components/news/newsStyles';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SkeletonFeed } from '@/components/signal/SkeletonFeed';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { useLocale } from '@/contexts/LocaleContext';
import { useRegisterWebHeaderRefresh } from '@/contexts/WebHeaderRefreshContext';
import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useSidebarSubTabs } from '@/contexts/SidebarSubTabsContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  appendUniqueNewsRows,
  dedupeNewsFeedRows,
  FEED_PAGE_CRYPTO,
  FEED_PAGE_GLOBAL,
  FEED_PAGE_KOREA,
  FEED_PAGE_VIDEO,
  FEED_PAGE_WATCH,
  NEWS_SEGMENT_LABEL,
  type NewsDigestItem,
} from '@/domain/news';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { hasSignalApi } from '@/services/env';
import {
  DEFAULT_NEWS_HASHTAG_DISPLAY_MAX,
  loadNewsHashtagDisplayMax,
  subscribeNewsHashtagDisplayMaxChanged,
} from '@/services/newsHashtagDisplayPreference';
import {
  loadNewsTitleDisplayMode,
  saveNewsTitleDisplayMode,
  type NewsTitleDisplayMode,
} from '@/services/newsTitleDisplayPreference';
import {
  loadNewsSegmentOrder,
  subscribeNewsSegmentOrderChanged,
} from '@/services/newsSegmentOrderPreference';
import { loadNewsSegment, saveNewsSegment } from '@/services/newsSegmentPreference';
import { firstRouteParam } from '@/utils/routeSearchParams';
import { useSafeSetRouteParams } from '@/utils/safeRouteParams';
import { markNewsFeedSeen } from '@/services/newsUnreadPreference';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import { useResetRefreshingOnTabBlur, useScrollToTopOnChange, useTabPressCycleSegment } from '@/hooks';
import { useWebFlatListLoadMore } from '@/hooks/useWebFlatListLoadMore';
import {
  fetchSignalNews,
  fetchSignalNewsDigests,
  fetchSignalYoutube,
  signalNewsToNewsItem,
  signalYoutubeToYoutubeItem,
} from '@/integrations/signal-api';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiNewsDigestItem, SignalApiNewsItem, SignalApiYoutubeVideo, SignalNewsListMeta } from '@/integrations/signal-api/types';
import type { NewsItem, YoutubeItem } from '@/types/signal';

type FeedRow =
  | { kind: 'news'; news: NewsItem }
  | { kind: 'video'; video: YoutubeItem }
  | { kind: 'ad'; key: string };
type FeedLoadResult = { itemIds: string[]; kind: 'news' | 'video' };

function digestSourceUrl(item: SignalApiNewsDigestItem): string {
  return item.sourceRefs.find((ref) => ref.url)?.url || '';
}

function digestPrimaryNews(item: SignalApiNewsDigestItem, rows: SignalApiNewsItem[]): SignalApiNewsItem {
  const matched = rows.find((row) => row.id === item.primaryNewsId);
  if (matched) return matched;
  const sourceRef = item.sourceRefs[0];
  const now = item.generatedAt || new Date().toISOString();
  return {
    id: item.primaryNewsId || item.id,
    category: item.category || 'global',
    title: item.title,
    summary: item.summary,
    originalTitle: item.title,
    originalSummary: item.summary,
    sourceName: sourceRef?.sourceName || item.sources[0] || '',
    sourceUrl: sourceRef?.url || digestSourceUrl(item),
    imageUrl: null,
    symbols: item.symbols,
    hashtags: item.topics.map((label, order) => ({ label, order, source: 'auto' })),
    provider: 'signal',
    publishedAt: sourceRef?.publishedAt || item.generatedAt,
    fetchedAt: now,
  };
}

function digestFromServer(item: SignalApiNewsDigestItem, rows: SignalApiNewsItem[]): NewsDigestItem {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    topics: item.topics,
    symbols: item.symbols,
    sources: item.sources,
    count: item.count,
    score: 0,
    aiGenerated: item.aiGenerated === true,
    generatedAt: item.generatedAt,
    sourceRefs: item.sourceRefs,
    primary: digestPrimaryNews(item, rows),
  };
}

export function LegacyNewsFeedScreen() {
  const router = useRouter();
  const setRouteParams = useSafeSetRouteParams();
  const routeParams = useLocalSearchParams<{ segment?: string }>();
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeNewsStyles(theme, scaleFont), [theme, scaleFont]);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { useTwoPane } = useResponsiveLayout();
  const ipadNav = useIpadSidebarNav();
  const { setSubTabs, clearSubTabs } = useSidebarSubTabs();
  const [segment, setSegment] = useState<NewsSegmentKey>(() => {
    const fromUrl = parseNewsSegmentKey(firstRouteParam(routeParams.segment));
    return fromUrl ?? DEFAULT_NEWS_SEGMENT;
  });
  const [segmentOrder, setSegmentOrder] = useState<NewsSegmentKey[]>([...NEWS_SEGMENT_ORDER]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [videoItems, setVideoItems] = useState<YoutubeItem[]>([]);
  const [serverRows, setServerRows] = useState<SignalApiNewsItem[]>([]);
  const [serverDigestRows, setServerDigestRows] = useState<SignalApiNewsDigestItem[]>([]);
  const [youtubeRows, setYoutubeRows] = useState<SignalApiYoutubeVideo[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [maxHashtagDisplay, setMaxHashtagDisplay] = useState(DEFAULT_NEWS_HASHTAG_DISPLAY_MAX);
  const [newsTitleDisplayMode, setNewsTitleDisplayMode] = useState<NewsTitleDisplayMode>('localized');
  const [watchSymbolOptions, setWatchSymbolOptions] = useState<string[]>([]);
  const [newContentSegments, setNewContentSegments] = useState(() => new Set<NewsSegmentKey>());
  /** 백그라운드 폴링: 세그먼트별 가장 최근에 본 항목 ID */
  const latestSeenIdBySegmentRef = useRef<Partial<Record<NewsSegmentKey, string>>>({});

  /** 웹: 리스트 콘텐츠 높이 < 뷰포트면 onEndReached가 안 나와 다음 페이지를 못 불러오는 경우가 있음 */
  const hasMoreRef = useRef(hasMore);
  const loadingMoreRef = useRef(loadingMore);
  const loadingRef = useRef(loading);
  hasMoreRef.current = hasMore;
  loadingMoreRef.current = loadingMore;
  loadingRef.current = loading;
  const serverRowsRef = useRef(serverRows);
  const digestLookupRowsRef = useRef<SignalApiNewsItem[]>([]);
  const youtubeRowsRef = useRef(youtubeRows);
  serverRowsRef.current = serverRows;
  youtubeRowsRef.current = youtubeRows;
  const feedMetaRef = useRef<SignalNewsListMeta | null>(null);
  const loadMoreInFlightRef = useRef(false);
  const itemsRef = useRef(items);
  const videoItemsRef = useRef(videoItems);
  itemsRef.current = items;
  videoItemsRef.current = videoItems;

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
    (seg: NewsSegmentKey, latestId: string | null | undefined) => {
      const id = latestId?.trim();
      if (!id) return;
      latestSeenIdBySegmentRef.current[seg] = id;
      clearSegmentNewContent(seg);
    },
    [clearSegmentNewContent],
  );

  const { ref: feedListRef } = useScrollToTopOnChange([segment, activeTag], {
    resyncDeps: [items, videoItems],
  });
  const feedScrollResetKey = useMemo(() => [segment, activeTag].join('|'), [segment, activeTag]);

  useEffect(() => {
    if (!hasSignalApi()) return;
    const POLL_MS = 3 * 60 * 1000;
    const pollSegments: NewsSegmentKey[] = ['global', 'korea', 'crypto', 'watch', 'video'];

    const fetchLatestIdForSegment = async (seg: NewsSegmentKey): Promise<string | null> => {
      if (seg === 'video') {
        const page = await fetchSignalYoutube({ sort: 'latest', limit: 1, offset: 0 }, { cacheMode: 'bypass' });
        return page.items[0]?.id ?? null;
      }
      if (seg === 'watch') {
        const symbols = (await loadWatchlistSymbols()).slice(0, 40);
        if (symbols.length === 0) return null;
        const page = await fetchSignalNews(
          { locale, symbols: symbols.join(','), limit: 1, offset: 0 },
          { cacheMode: 'bypass' },
        );
        return page.items[0]?.id ?? null;
      }
      const page = await fetchSignalNews({ locale, category: seg, limit: 1, offset: 0 }, { cacheMode: 'bypass' });
      return page.items[0]?.id ?? null;
    };

    const poll = async () => {
      await Promise.all(
        pollSegments.map(async (seg) => {
          try {
            const latestId = await fetchLatestIdForSegment(seg);
            if (!latestId) return;
            const seen = latestSeenIdBySegmentRef.current[seg];
            if (!seen) return;
            if (latestId !== seen) markSegmentHasNewContent(seg);
          } catch {
            // 폴링 에러는 무시
          }
        }),
      );
    };
    const id = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(id);
  }, [locale, markSegmentHasNewContent]);

  const segmentHydratedRef = useRef(false);

  useEffect(() => {
    const fromUrl = parseNewsSegmentKey(firstRouteParam(routeParams.segment));
    if (fromUrl) {
      segmentHydratedRef.current = true;
      return;
    }
    if (useTwoPane) return;
    void loadNewsSegment().then((s) => setSegment(s));
  }, [routeParams.segment, useTwoPane]);

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

  useEffect(() => {
    void loadNewsTitleDisplayMode().then(setNewsTitleDisplayMode);
  }, []);

  const toggleNewsTitleDisplayMode = useCallback(() => {
    setNewsTitleDisplayMode((prev) => {
      const next: NewsTitleDisplayMode = prev === 'localized' ? 'alternate' : 'localized';
      void saveNewsTitleDisplayMode(next);
      return next;
    });
  }, []);

  const syncServerRows = useCallback((rows: SignalApiNewsItem[]) => {
    const deduped = dedupeNewsFeedRows(rows);
    serverRowsRef.current = deduped;
    setServerRows(deduped);
    return deduped;
  }, []);

  const commitDigestLookupRows = useCallback((rows: SignalApiNewsItem[]) => {
    digestLookupRowsRef.current = dedupeNewsFeedRows(rows);
  }, []);

  const load = useCallback(
    async (forceRefresh?: boolean): Promise<FeedLoadResult> => {
      setError(null);
      const isRefresh = forceRefresh === true;
      if (!isRefresh) {
        setHasMore(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
        loadMoreInFlightRef.current = false;
        hasMoreRef.current = false;
        feedMetaRef.current = null;
      } else {
        loadMoreInFlightRef.current = true;
      }

      try {
      if (!hasSignalApi()) {
        setItems([]);
        setVideoItems([]);
        setServerRows([]);
        setServerDigestRows([]);
        setYoutubeRows([]);
        setError(t('errorSignalApiShort'));
        return { itemIds: [], kind: 'news' };
      }

      const cacheMode = signalCacheMode(forceRefresh);

      if (segment === 'video') {
        if (!isRefresh) {
          setItems([]);
          setServerRows([]);
          setServerDigestRows([]);
        }
        const { items: rows, meta } = await fetchSignalYoutube(
          {
            sort: 'latest',
            limit: FEED_PAGE_VIDEO,
            offset: 0,
          },
          { cacheMode },
        );
        setYoutubeRows(rows);
        feedMetaRef.current = meta;
        hasMoreRef.current = meta.hasMore;
        setHasMore(meta.hasMore);
        const mapped = rows.map((item) => signalYoutubeToYoutubeItem(item, locale));
        setVideoItems(mapped);
        syncSegmentLatestSeen('video', rows[0]?.id);
        return { itemIds: mapped.map((item) => item.id), kind: 'video' };
      }

      if (!isRefresh) {
        setVideoItems([]);
        setYoutubeRows([]);
      }

      if (segment === 'watch') {
        const symbols = (await loadWatchlistSymbols()).slice(0, 40);
        setWatchSymbolOptions(symbols);
        if (symbols.length === 0) {
          setServerRows([]);
          setServerDigestRows([]);
          setItems([]);
          setHasMore(false);
          clearSegmentNewContent('watch');
          delete latestSeenIdBySegmentRef.current.watch;
          return { itemIds: [], kind: 'news' };
        }
        const { items: rows, meta } = await fetchSignalNews(
          {
            locale,
            symbols: symbols.join(','),
            limit: FEED_PAGE_WATCH,
            offset: 0,
            tag: activeTag || undefined,
          },
          { cacheMode },
        );
        const dedupedRows = syncServerRows(rows);
        commitDigestLookupRows(dedupedRows);
        setServerDigestRows([]);
        feedMetaRef.current = meta;
        hasMoreRef.current = meta.hasMore;
        setHasMore(meta.hasMore);
        const mapped = dedupedRows.map((item) => signalNewsToNewsItem(item, locale));
        setItems(mapped);
        syncSegmentLatestSeen('watch', dedupedRows[0]?.id);
        return { itemIds: mapped.map((item) => item.id), kind: 'news' };
      }

      if (segment === 'crypto') {
        const [newsPage, digestPage] = await Promise.all([
          fetchSignalNews(
            {
              locale,
              category: 'crypto',
              limit: FEED_PAGE_CRYPTO,
              offset: 0,
              tag: activeTag || undefined,
            },
            { cacheMode },
          ),
          fetchSignalNewsDigests({ category: 'crypto', limit: 30, batches: 10 }, { cacheMode }).catch(() => null),
        ]);
        const { items: rows, meta } = newsPage;
        const dedupedRows = syncServerRows(rows);
        commitDigestLookupRows(dedupedRows);
        setServerDigestRows(digestPage?.items || []);
        feedMetaRef.current = meta;
        hasMoreRef.current = meta.hasMore;
        setHasMore(meta.hasMore);
        const mapped = dedupedRows.map((item) => signalNewsToNewsItem(item, locale));
        setItems(mapped);
        syncSegmentLatestSeen('crypto', dedupedRows[0]?.id);
        return { itemIds: mapped.map((item) => item.id), kind: 'news' };
      }

      if (segment === 'korea') {
        const [newsPage, digestPage] = await Promise.all([
          fetchSignalNews(
            {
              locale,
              category: 'korea',
              limit: FEED_PAGE_KOREA,
              offset: 0,
              tag: activeTag || undefined,
            },
            { cacheMode },
          ),
          fetchSignalNewsDigests({ category: 'korea', limit: 30, batches: 10 }, { cacheMode }).catch(() => null),
        ]);
        const { items: rows, meta } = newsPage;
        const dedupedRows = syncServerRows(rows);
        commitDigestLookupRows(dedupedRows);
        setServerDigestRows(digestPage?.items || []);
        feedMetaRef.current = meta;
        hasMoreRef.current = meta.hasMore;
        setHasMore(meta.hasMore);
        const mapped = dedupedRows.map((item) => signalNewsToNewsItem(item, locale));
        setItems(mapped);
        syncSegmentLatestSeen('korea', dedupedRows[0]?.id);
        return { itemIds: mapped.map((item) => item.id), kind: 'news' };
      }

      const [newsPage, digestPage] = await Promise.all([
        fetchSignalNews(
          {
            locale,
            category: 'global',
            limit: FEED_PAGE_GLOBAL,
            offset: 0,
            tag: activeTag || undefined,
          },
          { cacheMode },
        ),
        fetchSignalNewsDigests({ category: 'global', limit: 30, batches: 10 }, { cacheMode }).catch(() => null),
      ]);
      const { items: rows, meta } = newsPage;
      const dedupedRows = syncServerRows(rows);
      commitDigestLookupRows(dedupedRows);
      setServerDigestRows(digestPage?.items || []);
      feedMetaRef.current = meta;
      hasMoreRef.current = meta.hasMore;
      setHasMore(meta.hasMore);
      const mapped = dedupedRows.map((item) => signalNewsToNewsItem(item, locale));
      setItems(mapped);
      syncSegmentLatestSeen('global', dedupedRows[0]?.id);
      return { itemIds: mapped.map((item) => item.id), kind: 'news' };
      } finally {
        if (isRefresh) loadMoreInFlightRef.current = false;
      }
    },
    [activeTag, clearSegmentNewContent, commitDigestLookupRows, locale, segment, syncSegmentLatestSeen, syncServerRows, t],
  );

  const loadMore = useCallback(async () => {
    if (loadMoreInFlightRef.current || !hasMoreRef.current || loadingMoreRef.current || loadingRef.current || !hasSignalApi()) {
      return;
    }
    if (segment !== 'watch' && segment !== 'crypto' && segment !== 'korea' && segment !== 'global' && segment !== 'video') {
      return;
    }

    loadMoreInFlightRef.current = true;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    setError(null);

    const commitPaginationMeta = (lastMeta: SignalNewsListMeta | null) => {
      if (!lastMeta) {
        hasMoreRef.current = false;
        setHasMore(false);
        return;
      }
      hasMoreRef.current = lastMeta.hasMore;
      setHasMore(lastMeta.hasMore);
    };

    const MAX_SKIP_PAGES = 10;

    try {
      if (segment === 'video') {
        let requestOffset = feedMetaRef.current?.nextOffset ?? youtubeRowsRef.current.length;
        let totalAdded = 0;
        let lastMeta: SignalNewsListMeta | null = feedMetaRef.current;
        for (let skipPages = 0; skipPages < MAX_SKIP_PAGES; skipPages += 1) {
          const page = await fetchSignalYoutube(
            {
              sort: 'latest',
              limit: FEED_PAGE_VIDEO,
              offset: requestOffset,
            },
            { cacheMode: signalCacheMode() },
          );
          feedMetaRef.current = page.meta;
          lastMeta = page.meta;
          if (page.items.length === 0) {
            hasMoreRef.current = false;
            break;
          }
          const prev = youtubeRowsRef.current;
          const seen = new Set(prev.map((row) => row.id));
          const added: SignalApiYoutubeVideo[] = [];
          for (const row of page.items) {
            if (!seen.has(row.id)) {
              seen.add(row.id);
              added.push(row);
            }
          }
          totalAdded += added.length;
          const merged = [...prev, ...added];
          youtubeRowsRef.current = merged;
          setYoutubeRows(merged);
          setVideoItems(merged.map((item) => signalYoutubeToYoutubeItem(item, locale)));
          if (added.length > 0 || !page.meta.hasMore) {
            break;
          }
          if (page.meta.nextOffset == null || page.meta.nextOffset === requestOffset) {
            break;
          }
          requestOffset = page.meta.nextOffset;
        }
        commitPaginationMeta(lastMeta);
        return;
      }

      const pageLimit =
        segment === 'watch'
          ? FEED_PAGE_WATCH
          : segment === 'crypto'
            ? FEED_PAGE_CRYPTO
            : segment === 'korea'
              ? FEED_PAGE_KOREA
              : FEED_PAGE_GLOBAL;
      const category = segment === 'crypto' ? 'crypto' : segment === 'korea' ? 'korea' : 'global';
      const symbols = segment === 'watch' ? (await loadWatchlistSymbols()).slice(0, 40) : [];
      if (segment === 'watch' && symbols.length === 0) {
        hasMoreRef.current = false;
        setHasMore(false);
        return;
      }

      let requestOffset = feedMetaRef.current?.nextOffset ?? serverRowsRef.current.length;
      let totalAdded = 0;
      let lastMeta: SignalNewsListMeta | null = feedMetaRef.current;
      for (let skipPages = 0; skipPages < MAX_SKIP_PAGES; skipPages += 1) {
        const { items: nextRows, meta } = await fetchSignalNews(
          {
            locale,
            category,
            symbols: symbols.length > 0 ? symbols.join(',') : undefined,
            limit: pageLimit,
            offset: requestOffset,
            tag: activeTag || undefined,
          },
          { cacheMode: signalCacheMode() },
        );
        feedMetaRef.current = meta;
        lastMeta = meta;
        if (nextRows.length === 0) {
          hasMoreRef.current = false;
          break;
        }

        const { merged, addedCount } = appendUniqueNewsRows(serverRowsRef.current, nextRows);
        totalAdded += addedCount;
        syncServerRows(merged);

        if (addedCount > 0) {
          setItems(dedupeNewsFeedRows(merged).map((item) => signalNewsToNewsItem(item, locale)));
        }

        if (addedCount > 0 || !meta.hasMore) {
          break;
        }

        if (meta.nextOffset == null || meta.nextOffset === requestOffset) {
          break;
        }

        requestOffset = meta.nextOffset;
      }
      commitPaginationMeta(lastMeta);
    } catch (e) {
      setError(formatSignalApiError(e, t, 'feedErrorLoad'));
    } finally {
      loadMoreInFlightRef.current = false;
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [activeTag, locale, segment, syncServerRows, t, watchSymbolOptions]);

  const onRefreshBase = useCallback(async () => {
    setRefreshing(true);
    clearSegmentNewContent(segment);
    try {
      await load(true);
      setError(null);
    } catch (e) {
      setError(formatSignalApiError(e, t, 'feedErrorRefresh'));
    } finally {
      setRefreshing(false);
    }
  }, [clearSegmentNewContent, load, segment, t]);

  const onRefresh = onRefreshBase;
  useRegisterWebHeaderRefresh(() => void onRefresh());

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
      if (!hasSignalApi()) return;
      void markNewsFeedSeen(locale);
    }, [locale]),
  );

  /** 앱 시작 시 마운트만으로 fetch 하지 않음 — 뉴스 탭 포커스·세그먼트 변경 시에만 */
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const showLoading = itemsRef.current.length === 0 && videoItemsRef.current.length === 0;
        if (showLoading) setLoading(true);
        try {
          await load(false);
        } catch (e) {
          if (!cancelled) {
            setError(formatSignalApiError(e, t, 'feedErrorLoad'));
            setItems([]);
            setServerRows([]);
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

  const onPickSegment = useCallback((key: NewsSegmentKey, options?: { force?: boolean }) => {
    if (!options?.force && segment === key) return;
    setLoading(true);
    setItems([]);
    setVideoItems([]);
    setServerRows([]);
    setServerDigestRows([]);
    setYoutubeRows([]);
    setHasMore(false);
    setError(null);
    if (key === 'video') setActiveTag(null);
    setSegment(key);
    void saveNewsSegment(key);
    setRouteParams({ segment: key === DEFAULT_NEWS_SEGMENT ? undefined : key });
  }, [segment, setRouteParams]);

  useTabPressCycleSegment(segment, segmentOrder, onPickSegment);

  const ipadSegmentOrder = useMemo(
    () => segmentOrder.filter((key) => key !== 'video'),
    [segmentOrder],
  );

  useEffect(() => {
    if (!useTwoPane || segment !== 'video') return;
    const next = ipadSegmentOrder[0] || DEFAULT_NEWS_SEGMENT;
    onPickSegment(next);
  }, [ipadSegmentOrder, onPickSegment, segment, useTwoPane]);

  // iPad: 홈·사이드바에서 넘어온 세그먼트를 저장값보다 우선 적용
  useFocusEffect(
    useCallback(() => {
      if (!useTwoPane || !ipadNav.isAvailable) return;

      const paramSegment = parseNewsSegmentKey(
        Array.isArray(routeParams.segment) ? routeParams.segment[0] : routeParams.segment,
      );
      const pending = ipadNav.takePendingNewsSegment();
      const target = pending || paramSegment;

      if (target && target !== 'video') {
        segmentHydratedRef.current = true;
        onPickSegment(target, { force: true });
        return;
      }

      if (!segmentHydratedRef.current) {
        segmentHydratedRef.current = true;
        void loadNewsSegment().then((s) => setSegment(s));
      }
    }, [ipadNav, onPickSegment, routeParams.segment, useTwoPane]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!useTwoPane) return;
      setSubTabs(
        ipadSegmentOrder.map((key) => ({
          key,
          label: t(NEWS_SEGMENT_LABEL[key]),
          active: segment === key,
          onPress: () => onPickSegment(key),
        })),
      );
      return () => clearSubTabs();
    }, [useTwoPane, segment, ipadSegmentOrder, t, onPickSegment, setSubTabs, clearSubTabs]),
  );

  const newsTitleShowAlternate = newsTitleDisplayMode === 'alternate';
  const newsTitleAlternateIsTranslation = locale === 'en';
  const showNewsTitleListToggle = segment === 'global' || segment === 'crypto';
  const newsTitleListToggleA11y = newsTitleShowAlternate
    ? t('newsTitleListShowLocalized')
    : newsTitleAlternateIsTranslation
      ? t('newsTitleListShowTranslation')
      : t('newsTitleListShowOriginal');
  const digestBatches = useMemo(() => {
    if (segment === 'video' || segment === 'watch') return [];
    if (serverDigestRows.length > 0) {
      const lookupRows = digestLookupRowsRef.current;
      const byTs = new Map<string, SignalApiNewsDigestItem[]>();
      for (const item of serverDigestRows) {
        const key = item.generatedAt || 'unknown';
        const list = byTs.get(key) || [];
        list.push(item);
        byTs.set(key, list);
      }
      const sortedKeys = [...byTs.keys()].sort().reverse();
      return sortedKeys
        .map((key) => {
          const items = byTs.get(key)!;
          const top = items.reduce((a, b) => (b.count > a.count ? b : a));
          return digestFromServer(top, lookupRows);
        })
        .slice(0, 10);
    }
    return [];
  }, [segment, serverDigestRows]);

  const listData: FeedRow[] = useMemo(() => {
    const out: FeedRow[] = [];
    if (segment === 'video') {
      videoItems.forEach((video) => out.push({ kind: 'video', video }));
      return out;
    }
    items.forEach((news, i) => {
      out.push({ kind: 'news', news });
      if ((i + 1) % 5 === 0) {
        out.push({ kind: 'ad', key: `ad-${news.id}` });
      }
    });
    return out;
  }, [items, segment, videoItems]);

  const emptyMessage =
    !loading && listData.length === 0 && !error
      ? segment === 'video'
        ? t('feedEmptyVideo')
        : segment === 'watch'
        ? t('feedEmptyWatch')
        : t('feedEmpty')
      : null;

  const bottomPad = tabScreenScrollBottomPadding(tabBarHeight, insets.bottom);
  const fabBottom = fabStackBottom(tabBarHeight, insets.bottom);
  const useNewsTitleFab = showNewsTitleListToggle && Platform.OS !== 'web' && !useTwoPane;
  const showDigest = segment !== 'video' && segment !== 'watch';
  const newContentAvailable =
    newContentSegments.has(segment) && !(segment === 'watch' && watchSymbolOptions.length === 0);

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

        {segment === 'video' ? (
          <Pressable
            onPress={() => router.push('/youtube')}
            style={({ pressed }) => [styles.videoOpenAll, pressed && styles.videoOpenAllPressed]}
            accessibilityRole="button"
            accessibilityLabel={t('feedVideoOpenAll')}>
            <View style={styles.videoOpenAllIcon}>
              <FontAwesome name="youtube-play" size={15} color={theme.green} />
            </View>
            <Text style={styles.videoOpenAllTitle}>{t('feedVideoOpenAll')}</Text>
            <FontAwesome name="chevron-right" size={12} color={theme.textDim} />
          </Pressable>
        ) : null}

        {loading && listData.length === 0 ? (
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
      listData.length,
      loading,
      segment,
      styles,
      t,
      theme.textDim,
      theme.green,
      router,
    ],
  );

  return (
    <SafeAreaView style={styles.safe} edges={useTwoPane ? [] : ['top']}>
      {!useTwoPane ? <SignalHeader compact onBrandPress={() => void onRefresh()} /> : null}
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={[styles.mainColumn, useTwoPane && styles.mainColumnWide]}>
        {!useTwoPane ? (
          <View style={[styles.topFixed, useTwoPane && styles.topFixedWide]}>
          {!useTwoPane ? <View style={styles.segment}>
            {segmentOrder.map((key) => (
              <Fragment key={key}>
                {key === 'video' ? <View pointerEvents="none" style={styles.segmentDivider} /> : null}
                <Pressable
                  onPress={() => onPickSegment(key)}
                  style={[styles.segBtn, key === 'video' && styles.segBtnVideo, segment === key && styles.segBtnActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: segment === key }}>
                  <Text style={[styles.segText, segment === key && styles.segTextActive]}>
                    {t(NEWS_SEGMENT_LABEL[key])}
                  </Text>
                </Pressable>
              </Fragment>
            ))}
          </View> : null}
          {showDigest && !useTwoPane ? (
            <DigestPager
              batches={digestBatches}
              onRefresh={() => void onRefresh()}
              refreshing={refreshing}
            />
          ) : null}
          </View>
        ) : null}

        <View style={styles.listColumn}>
          {showDigest && useTwoPane ? (
            <View style={[styles.topFixed, styles.topFixedWide, styles.listColumnDigestStrip]}>
              <DigestPager
                batches={digestBatches}
                columns={2}
                onRefresh={() => void onRefresh()}
                refreshing={refreshing}
              />
            </View>
          ) : null}
          {isFocused ? (
            <FeedNewContentChip
              visible={newContentAvailable}
              refreshing={refreshing}
              message={t('feedNewContentAvailable')}
              onPress={() => void onRefresh()}
            />
          ) : null}
          <WebWheelFlatList
          scrollResetKey={feedScrollResetKey}
          ref={feedListRef as never}
          data={loading && listData.length === 0 ? [] : listData}
          extraData={`${listData.length}:${newsTitleShowAlternate ? 'alt' : 'loc'}`}
          keyExtractor={(row) =>
            row.kind === 'ad' ? row.key : row.kind === 'video' ? row.video.id : row.news.id
          }
          renderItem={({ item, index }) => {
            if (item.kind === 'ad') {
              return (
                <View style={styles.adBetweenGroups}>
                  <AdPlaceholder />
                </View>
              );
            }
            if (item.kind === 'video') {
              const edges = groupedFeedRowEdges(listData, index, 'video');
              return (
                <View style={edges ? groupedFeedRowShell(theme, edges) : undefined}>
                  <YoutubeCard layout="grouped" item={item.video} />
                </View>
              );
            }
            const edges = groupedFeedRowEdges(listData, index, 'news');
            return (
              <View style={edges ? groupedFeedRowShell(theme, edges) : undefined}>
                <NewsCard
                  layout="grouped"
                  item={item.news}
                  compactMeta
                  titleToggle={segment === 'global' || segment === 'crypto'}
                  titleShowAlternate={
                    useNewsTitleFab ? newsTitleShowAlternate : undefined
                  }
                  maxHashtagsToShow={segment === 'watch' ? 0 : maxHashtagDisplay}
                  onTagPress={(label) => {
                    const next = label.trim();
                    if (next) setActiveTag(next);
                  }}
                />
              </View>
            );
          }}
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
            ) : Platform.OS === 'web' && hasMore ? (
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
          refreshControl={
            loading && listData.length === 0 ? undefined : (
              <ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            )
          }
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={Platform.OS === 'web' ? WEB_FLATLIST_INITIAL : 8}
          windowSize={Platform.OS === 'web' ? WEB_FLATLIST_WINDOW : 7}
          maxToRenderPerBatch={Platform.OS === 'web' ? WEB_FLATLIST_BATCH : 12}
          />
        </View>
      </View>

      {useNewsTitleFab && isFocused ? (
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
