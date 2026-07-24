import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useFocusEffect, useIsFocused } from "expo-router/react-navigation";
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  fabStackBottom,
  SCREEN_CHIP_LIST_CONTENT_PADDING_TOP,
  SCREEN_DIGEST_LIST_CONTENT_PADDING_TOP,
  SCREEN_LIST_CONTENT_PADDING_TOP,
  SCREEN_NEWS_TITLE_FAB_ABOVE_TAB_OFFSET,
  tabScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import {
  WEB_FLATLIST_BATCH,
  WEB_FLATLIST_INITIAL,
  WEB_FLATLIST_WINDOW,
} from '@/constants/webLayout';
import { DEFAULT_NEWS_SEGMENT, NEWS_SEGMENT_ORDER, parseNewsSegmentKey, type NewsSegmentKey } from '@/constants/newsSegment';
import { newsSegmentToIssuesCategory } from '@/constants/ipadHomeNav';
import { AdPlaceholder } from '@/components/signal/AdPlaceholder';
import { groupedFeedRowEdges, groupedFeedRowShell } from '@/components/signal/groupedFeedList';
import { DigestPager } from '@/components/news/DigestPager';
import { NewsCard } from '@/components/signal/NewsCard';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { WebWheelFlatList } from '@/components/layout/WebWheelFlatList';
import { FeedNewContentChip } from '@/components/signal/FeedNewContentChip';
import { FloatingGlassFab } from '@/components/signal/FloatingGlassFab';
import { makeNewsStyles } from '@/components/news/newsStyles';
import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { homeShortcutCompoundLabel } from '@/domain/home/shortcutDisplay';
import type { MessageId } from '@/locales/messages';

const HOME_TILE_NEWS: Record<NewsSegmentKey, MessageId> = {
  global: 'homeTileNewsGlobal',
  korea: 'homeTileNewsKorea',
  crypto: 'homeTileNewsCrypto',
  it: 'homeTileNewsIt',
  video: 'homeTileNewsVideo',
};
import { SkeletonFeed } from '@/components/signal/SkeletonFeed';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import {
  YoutubeFeedPanel,
  type YoutubeFeedPanelHandle,
} from '@/components/youtube/YoutubeFeedPanel';
import { useLocale } from '@/contexts/LocaleContext';
import { useRegisterWebHeaderRefresh } from '@/contexts/WebHeaderRefreshContext';
import { useIpadSidebarNavActions } from '@/contexts/IpadSidebarNavContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useOwnedSidebarSubTabs } from '@/contexts/SidebarSubTabsContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  appendUniqueNewsRows,
  dedupeNewsFeedRows,
  FEED_PAGE_CRYPTO,
  FEED_PAGE_GLOBAL,
  FEED_PAGE_IT,
  FEED_PAGE_KOREA,
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
import { useAdsEnabled } from '@/services/adsRuntimeConfig';
import { firstRouteParam } from '@/utils/routeSearchParams';
import { useSafeSetRouteParams } from '@/utils/safeRouteParams';
import { markNewsFeedSeen } from '@/services/newsUnreadPreference';
import {
  useFeedUnreadCheckIntervalMs,
  useResetRefreshingOnTabBlur,
  useScrollToTopOnChange,
  useTabPressCycleSegment,
  useTabScreenLoadingRecovery,
} from '@/hooks';
import { useWebFlatListLoadMore } from '@/hooks/useWebFlatListLoadMore';
import {
  fetchSignalNews,
  fetchSignalNewsDigests,
  fetchSignalYoutube,
  signalNewsToNewsItem,
} from '@/integrations/signal-api';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { toYmd } from '@/utils/date';
import type { SignalApiNewsDigestItem, SignalApiNewsItem, SignalNewsListMeta } from '@/integrations/signal-api/types';
import type { NewsItem } from '@/types/signal';

type FeedRow =
  | { kind: 'news'; news: NewsItem }
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

export type LegacyNewsFeedScreenProps = {
  embedded?: boolean;
  onBack?: () => void;
  /** 홈 숏컷 등 — 세그먼트 고정 */
  lockedSegment?: NewsSegmentKey | null;
  /** Root Stack 헤더가 크롬을 담당 */
  stackChrome?: boolean;
};

export function LegacyNewsFeedScreen({
  embedded = false,
  onBack,
  lockedSegment = null,
  stackChrome = false,
}: LegacyNewsFeedScreenProps = {}) {
  const router = useRouter();
  const setRouteParams = useSafeSetRouteParams();
  const routeParams = useLocalSearchParams<{ segment?: string }>();
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeNewsStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const feedUnreadCheckMs = useFeedUnreadCheckIntervalMs();
  const { useTwoPane } = useResponsiveLayout();
  const adsEnabled = useAdsEnabled();
  const ipadNav = useIpadSidebarNavActions();
  const { setSubTabs, setActiveSubTabKey, clearSubTabs } = useOwnedSidebarSubTabs('news');
  const drillLocked = Boolean(lockedSegment);
  const hidePhoneChrome = embedded || stackChrome || Boolean(onBack);
  const [segment, setSegment] = useState<NewsSegmentKey>(() => {
    if (lockedSegment) return lockedSegment;
    const fromUrl = parseNewsSegmentKey(firstRouteParam(routeParams.segment));
    return fromUrl ?? DEFAULT_NEWS_SEGMENT;
  });
  const [segmentOrder, setSegmentOrder] = useState<NewsSegmentKey[]>([...NEWS_SEGMENT_ORDER]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [serverRows, setServerRows] = useState<SignalApiNewsItem[]>([]);
  const [serverDigestRows, setServerDigestRows] = useState<SignalApiNewsDigestItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const youtubePanelRef = useRef<YoutubeFeedPanelHandle>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [maxHashtagDisplay, setMaxHashtagDisplay] = useState(DEFAULT_NEWS_HASHTAG_DISPLAY_MAX);
  const [newsTitleDisplayMode, setNewsTitleDisplayMode] = useState<NewsTitleDisplayMode>('localized');
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
  const itemsRef = useRef(items);
  const feedFilterKeyRef = useRef(`${segment}|${activeTag ?? ''}|${locale}`);
  const feedReloadNonceRef = useRef(0);
  serverRowsRef.current = serverRows;
  itemsRef.current = items;
  const feedMetaRef = useRef<SignalNewsListMeta | null>(null);
  const loadMoreInFlightRef = useRef(false);
  const loadSeqRef = useRef(0);
  const [feedReloadNonce, setFeedReloadNonce] = useState(0);
  const segmentRef = useRef(segment);
  segmentRef.current = segment;

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

  const { ref: feedListRef, scrollToTop: scrollFeedToTop } = useScrollToTopOnChange([segment, activeTag], {
    resyncDeps: [items],
  });
  const goToFeedList = useCallback(() => {
    const date = toYmd(new Date());
    const category = newsSegmentToIssuesCategory(segment);
    if (ipadNav.isAvailable) {
      ipadNav.showNewsIssues({ category, date, digestId: null }, { drillFrom: 'tabs' });
      return;
    }
    router.push({
      pathname: '/news-issues',
      params: { category, date },
    } as Href);
  }, [ipadNav, router, segment]);
  const feedScrollResetKey = useMemo(() => [segment, activeTag].join('|'), [segment, activeTag]);

  useEffect(() => {
    if (!hasSignalApi()) return;
    if (!isFocused) return;
    const pollSegments: NewsSegmentKey[] = ['global', 'korea', 'crypto', 'it', 'video'];

    const fetchLatestIdForSegment = async (seg: NewsSegmentKey): Promise<string | null> => {
      if (seg === 'video') {
        const page = await fetchSignalYoutube({ sort: 'latest', limit: 1, offset: 0 }, { cacheMode: 'bypass' });
        return page.items[0]?.id ?? null;
      }
      const page = await fetchSignalNews({ locale, category: seg, limit: 1, offset: 0 }, { cacheMode: 'bypass' });
      return page.items[0]?.id ?? null;
    };

    const poll = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
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
    const id = setInterval(() => void poll(), feedUnreadCheckMs);
    return () => clearInterval(id);
  }, [feedUnreadCheckMs, isFocused, locale, markSegmentHasNewContent]);

  const segmentHydratedRef = useRef(false);

  useEffect(() => {
    const fromUrl = parseNewsSegmentKey(firstRouteParam(routeParams.segment));
    if (fromUrl) {
      segmentHydratedRef.current = true;
      return;
    }
    if (useTwoPane) return;
    if (segmentHydratedRef.current) return;
    void loadNewsSegment().then((s) => {
      segmentHydratedRef.current = true;
      setSegment(s);
    });
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
    async (forceRefresh?: boolean, keepRows?: boolean): Promise<FeedLoadResult> => {
      setError(null);
      const isRefresh = forceRefresh === true || keepRows === true;
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
        setServerRows([]);
        setServerDigestRows([]);
        setError(t('errorSignalApiShort'));
        return { itemIds: [], kind: 'news' };
      }

      const cacheMode = signalCacheMode(forceRefresh === true);

      /** YouTube 세그먼트는 `YoutubeFeedPanel`이 목록·새로고침을 담당한다. */
      if (segment === 'video') {
        setItems([]);
        setServerRows([]);
        setServerDigestRows([]);
        setHasMore(false);
        feedMetaRef.current = null;
        hasMoreRef.current = false;
        setLoading(false);
        return { itemIds: [], kind: 'video' };
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
          fetchSignalNewsDigests({ category: 'crypto', limit: 30, batches: 10, locale }, { cacheMode }).catch(() => null),
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
          fetchSignalNewsDigests({ category: 'korea', limit: 30, batches: 10, locale }, { cacheMode }).catch(() => null),
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

      /** IT: 기존 ItNewsFeedPanel과 동일하게 category=it, digest 없음 */
      if (segment === 'it') {
        const { items: rows, meta } = await fetchSignalNews(
          {
            locale,
            category: 'it',
            limit: FEED_PAGE_IT,
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
        syncSegmentLatestSeen('it', dedupedRows[0]?.id);
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
        fetchSignalNewsDigests({ category: 'global', limit: 30, batches: 10, locale }, { cacheMode }).catch(() => null),
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
    if (segment !== 'it' && segment !== 'crypto' && segment !== 'korea' && segment !== 'global' && segment !== 'video') {
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
        return;
      }

      const pageLimit =
        segment === 'it'
          ? FEED_PAGE_IT
          : segment === 'crypto'
            ? FEED_PAGE_CRYPTO
            : segment === 'korea'
              ? FEED_PAGE_KOREA
              : FEED_PAGE_GLOBAL;
      const category = segment === 'it' ? 'it' : segment === 'crypto' ? 'crypto' : segment === 'korea' ? 'korea' : 'global';

      let requestOffset = feedMetaRef.current?.nextOffset ?? serverRowsRef.current.length;
      let totalAdded = 0;
      let lastMeta: SignalNewsListMeta | null = feedMetaRef.current;
      for (let skipPages = 0; skipPages < MAX_SKIP_PAGES; skipPages += 1) {
        const { items: nextRows, meta } = await fetchSignalNews(
          {
            locale,
            category,
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
  }, [activeTag, locale, segment, syncServerRows, t]);

  const onRefreshBase = useCallback(async () => {
    setRefreshing(true);
    clearSegmentNewContent(segment);
    const seq = ++loadSeqRef.current;
    try {
      await load(true);
      if (seq !== loadSeqRef.current) return;
      setError(null);
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(formatSignalApiError(e, t, 'feedErrorRefresh'));
    } finally {
      if (seq === loadSeqRef.current) {
        setRefreshing(false);
      }
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

  /** 포커스·세그먼트·태그 변경 시 로드. 동일 필터 재진입은 기존 rows 유지 + soft refresh. */
  useEffect(() => {
    if (!isFocused) return;

    let cancelled = false;
    const seq = ++loadSeqRef.current;
    const filterKey = `${segment}|${activeTag ?? ''}|${locale}`;
    const filterChanged = feedFilterKeyRef.current !== filterKey;
    feedFilterKeyRef.current = filterKey;
    const reloadBumped = feedReloadNonceRef.current !== feedReloadNonce;
    feedReloadNonceRef.current = feedReloadNonce;
    const hasExisting =
      !filterChanged && !reloadBumped && segment !== 'video' && itemsRef.current.length > 0;

    setLoading(segment === 'video' ? false : !hasExisting);
    if (!hasExisting) {
      setItems([]);
      setServerRows([]);
      setServerDigestRows([]);
      setHasMore(false);
      setError(null);
    } else {
      setError(null);
    }

    void (async () => {
      try {
        await load(false, hasExisting);
      } catch (e) {
        if (cancelled || seq !== loadSeqRef.current) return;
        setError(formatSignalApiError(e, t, 'feedErrorLoad'));
        if (!hasExisting) {
          setItems([]);
          setServerRows([]);
        }
      } finally {
        if (cancelled || seq !== loadSeqRef.current) return;
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTag, feedReloadNonce, isFocused, load, locale, segment, t]);

  useTabScreenLoadingRecovery(items, setLoading);

  const onPickSegment = useCallback((key: NewsSegmentKey, options?: { force?: boolean }) => {
    if (!options?.force && segment === key) {
      if (useTwoPane) setActiveSubTabKey(key);
      return;
    }
    if (options?.force && segment === key) {
      setFeedReloadNonce((n) => n + 1);
      if (useTwoPane) setActiveSubTabKey(key);
      return;
    }
    if (key === 'video') setActiveTag(null);
    setSegment(key);
    if (useTwoPane) setActiveSubTabKey(key);
    void saveNewsSegment(key);
    setRouteParams({ segment: key });
  }, [segment, setActiveSubTabKey, setRouteParams, useTwoPane]);

  const onPickSegmentRef = useRef(onPickSegment);
  onPickSegmentRef.current = onPickSegment;

  /** URL → state. focus-effect에 두면 setParams 경합으로 클릭이 되돌아간다. */
  useEffect(() => {
    const fromUrl = parseNewsSegmentKey(firstRouteParam(routeParams.segment));
    if (!fromUrl) return;
    segmentHydratedRef.current = true;
    if (fromUrl !== segmentRef.current) {
      onPickSegmentRef.current(fromUrl);
    }
  }, [routeParams.segment]);

  useTabPressCycleSegment(segment, segmentOrder, onPickSegment);

  const registerNewsSubTabs = useCallback(() => {
    if (!useTwoPane) return;
    setSubTabs(
      segmentOrder.map((key) => ({
        key,
        label: t(NEWS_SEGMENT_LABEL[key]),
        href: '/(tabs)/news',
        params: { segment: key },
        onPress: () => onPickSegment(key),
      })),
      segment,
    );
  }, [onPickSegment, segment, segmentOrder, setSubTabs, t, useTwoPane]);

  useEffect(() => {
    if (lockedSegment) setSegment(lockedSegment);
  }, [lockedSegment]);

  // 세그먼트 변경 시 목록·선택만 갱신 — focus cleanup에 register를 넣지 않는다.
  useEffect(() => {
    if (!useTwoPane || !isFocused || drillLocked) return;
    registerNewsSubTabs();
  }, [drillLocked, isFocused, registerNewsSubTabs, useTwoPane]);

  // iPad: 홈·사이드바 pending / 저장 세그먼트 (URL과 충돌하지 않을 때만)
  useFocusEffect(
    useCallback(() => {
      if (!useTwoPane || !ipadNav.isAvailable || drillLocked) return;

      const pending = ipadNav.takePendingNewsSegment();
      if (pending) {
        segmentHydratedRef.current = true;
        if (pending !== segmentRef.current) {
          onPickSegmentRef.current(pending, { force: true });
        }
        return;
      }

      if (!segmentHydratedRef.current) {
        const paramSegment = parseNewsSegmentKey(firstRouteParam(routeParams.segment));
        if (paramSegment) {
          segmentHydratedRef.current = true;
          return;
        }
        segmentHydratedRef.current = true;
        void loadNewsSegment().then((s) => {
          if (s) onPickSegmentRef.current(s);
        });
      }
    }, [drillLocked, ipadNav, routeParams.segment, useTwoPane]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!useTwoPane || drillLocked) return;
      return () => clearSubTabs();
    }, [clearSubTabs, drillLocked, useTwoPane]),
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
    if (segment === 'video' || segment === 'it') return [];
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
    if (segment === 'video') return [];
    const out: FeedRow[] = [];
    items.forEach((news, i) => {
      out.push({ kind: 'news', news });
      if (adsEnabled && (i + 1) % 5 === 0) {
        out.push({ kind: 'ad', key: `ad-${news.id}` });
      }
    });
    return out;
  }, [adsEnabled, items, segment]);

  const emptyMessage =
    !loading && listData.length === 0 && !error
      ? segment === 'it'
        ? t('feedEmptyIt')
        : t('feedEmpty')
      : null;

  const bottomPad = tabScreenScrollBottomPadding(tabBarHeight, insets.bottom);
  const newsTitleFabBottom = useTwoPane
    ? fabStackBottom(0, insets.bottom, SCREEN_NEWS_TITLE_FAB_ABOVE_TAB_OFFSET)
    : fabStackBottom(tabBarHeight, insets.bottom, SCREEN_NEWS_TITLE_FAB_ABOVE_TAB_OFFSET);
  const useNewsTitleFab = showNewsTitleListToggle;
  const useNewsTitleListMode = showNewsTitleListToggle;
  const showDigest = segment !== 'video' && segment !== 'it';
  const newContentAvailable = newContentSegments.has(segment);

  const listHeaderEl = useMemo(() => {
    const hasContent =
      Boolean(activeTag) || Boolean(error) || (loading && listData.length === 0);
    if (!hasContent) return null;
    return (
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

        {loading && listData.length === 0 ? (
          <View style={styles.skeletonBlock}>
            <SkeletonFeed />
            <SkeletonFeed />
            <SkeletonFeed />
          </View>
        ) : null}
      </View>
    );
  }, [activeTag, error, listData.length, loading, styles, t],
  );

  return (
    <SafeAreaView style={styles.safe} edges={useTwoPane || hidePhoneChrome ? [] : ['top']}>
      {!useTwoPane && !hidePhoneChrome ? (
        <SignalHeader
          compact
          onBrandPress={() => {
            if (segment === 'video') youtubePanelRef.current?.refresh();
            else void onRefresh();
          }}
        />
      ) : null}
      {onBack ? (
        <WideSubpaneHeader
          title={
            drillLocked
              ? homeShortcutCompoundLabel(t('tabNews'), t(HOME_TILE_NEWS[segment]))
              : t(NEWS_SEGMENT_LABEL[segment])
          }
          onBack={onBack}
        />
      ) : null}
      {isFocused && !hidePhoneChrome ? <OtaUpdateBanner /> : null}
      <View style={[styles.mainColumn, (useTwoPane || embedded) && styles.mainColumnWide]}>
        {!useTwoPane && !drillLocked && !hidePhoneChrome ? (
          <View style={styles.topFixedStack}>
            <View style={styles.topFixedSubmenu}>
              <View style={styles.segment}>
                {segmentOrder.map((key) => (
                  <Pressable
                    key={key}
                    onPress={() => onPickSegment(key)}
                    style={[styles.segBtn, key === 'video' && styles.segBtnVideo, segment === key && styles.segBtnActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: segment === key }}>
                    <Text
                      style={[styles.segText, segment === key && styles.segTextActive]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}>
                      {t(NEWS_SEGMENT_LABEL[key])}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {showDigest ? (
              <View style={styles.topFixedDigest}>
                <DigestPager
                  batches={digestBatches}
                  onRefresh={() => void onRefresh()}
                  refreshing={refreshing}
                  onGoToList={goToFeedList}
                  goToListA11y={t('feedDigestTailGoToNewsFlowA11y')}
                />
              </View>
            ) : null}
          </View>
        ) : null}
        {!useTwoPane && drillLocked && showDigest ? (
          <View style={styles.topFixedStack}>
            <View style={styles.topFixedDigest}>
              <DigestPager
                batches={digestBatches}
                onRefresh={() => void onRefresh()}
                refreshing={refreshing}
                onGoToList={goToFeedList}
                goToListA11y={t('feedDigestTailGoToNewsFlowA11y')}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.listColumn}>
          {showDigest && useTwoPane ? (
            <View style={[styles.topFixedStack, styles.topFixedStackWide, styles.listColumnDigestStrip]}>
              <View style={[styles.topFixedDigest, styles.topFixedDigestWide]}>
                <DigestPager
                  batches={digestBatches}
                  columns={2}
                  onRefresh={() => void onRefresh()}
                  refreshing={refreshing}
                  onGoToList={goToFeedList}
                  goToListA11y={t('feedDigestTailGoToNewsFlowA11y')}
                />
              </View>
            </View>
          ) : null}
          {segment === 'video' ? (
            <YoutubeFeedPanel
              ref={youtubePanelRef}
              embedded
              contentBottomPadding={bottomPad}
              registerWebHeaderRefresh={false}
            />
          ) : (
            <>
              {isFocused ? (
                <FeedNewContentChip
                  visible={newContentAvailable}
                  refreshing={refreshing}
                  message={t('feedNewContentAvailable')}
                  onPress={() => {
                    scrollFeedToTop(true);
                    void onRefresh();
                  }}
                />
              ) : null}
              <WebWheelFlatList
                scrollResetKey={feedScrollResetKey}
                ref={feedListRef as never}
                data={loading && listData.length === 0 ? [] : listData}
                extraData={`${listData.length}:${newsTitleShowAlternate ? 'alt' : 'loc'}`}
                keyExtractor={(row) => (row.kind === 'ad' ? row.key : row.news.id)}
                renderItem={({ item, index }) => {
                  if (item.kind === 'ad') {
                    return (
                      <View style={styles.adBetweenGroups}>
                        <AdPlaceholder />
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
                        titleShowAlternate={useNewsTitleListMode ? newsTitleShowAlternate : undefined}
                        maxHashtagsToShow={maxHashtagDisplay}
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
                contentContainerStyle={[
                  styles.listContent,
                  {
                    paddingTop: newContentAvailable
                      ? SCREEN_CHIP_LIST_CONTENT_PADDING_TOP
                      : showDigest
                        ? SCREEN_DIGEST_LIST_CONTENT_PADDING_TOP
                        : SCREEN_LIST_CONTENT_PADDING_TOP,
                    paddingBottom: bottomPad,
                  },
                ]}
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
            </>
          )}
        </View>
      </View>

      {useNewsTitleFab && isFocused ? (
        <FloatingGlassFab
          bottom={newsTitleFabBottom}
          iconName={newsTitleAlternateIsTranslation ? 'language' : 'globe'}
          accessibilityLabel={newsTitleListToggleA11y}
          active={newsTitleShowAlternate}
          onPress={toggleNewsTitleDisplayMode}
        />
      ) : null}
    </SafeAreaView>
  );
}
