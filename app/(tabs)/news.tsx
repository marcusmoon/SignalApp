import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useFocusEffect, useIsFocused } from "expo-router/react-navigation";
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { tabBarBottomInset } from '@/constants/tabBar';
import { DEFAULT_NEWS_SEGMENT, NEWS_SEGMENT_ORDER, type NewsSegmentKey } from '@/constants/newsSegment';
import { AdPlaceholder } from '@/components/signal/AdPlaceholder';
import { NewsSourceFilterModal } from '@/components/signal/NewsSourceFilterModal';
import {
  SelectionFilterSheet,
  selectionFilterRowStyles,
} from '@/components/signal/SelectionFilterSheet';
import { FloatingGlassFab } from '@/components/signal/FloatingGlassFab';
import { groupedFeedRowEdges, groupedFeedRowShell } from '@/components/signal/groupedFeedList';
import { NewsCard } from '@/components/signal/NewsCard';
import { YoutubeCard } from '@/components/signal/YoutubeCard';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { DigestPager } from '@/components/news/DigestPager';
import { FeedUpdateBanner } from '@/components/signal/FeedUpdateBanner';
import { makeNewsStyles } from '@/components/news/newsStyles';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SkeletonFeed } from '@/components/signal/SkeletonFeed';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  buildSourcesFromCatalog,
  FEED_PAGE_CRYPTO,
  FEED_PAGE_GLOBAL,
  FEED_PAGE_KOREA,
  FEED_PAGE_VIDEO,
  FEED_PAGE_WATCH,
  filterNewsRows,
  filterWatchRows,
  NEWS_QUICK_FILTERS,
  NEWS_SEGMENT_LABEL,
  normalizeNullableSelection,
  SOURCE_PROBE_LIMIT,
  sourceFilterParam,
  uniqueSignalSources,
  WATCH_FILTERS,
  type NewsDigestItem,
  type NewsQuickFilterKind,
  type WatchFilterKind,
} from '@/domain/news';
import { hasSignalApi } from '@/services/env';
import {
  DEFAULT_NEWS_HASHTAG_DISPLAY_MAX,
  loadNewsHashtagDisplayMax,
  subscribeNewsHashtagDisplayMaxChanged,
} from '@/services/newsHashtagDisplayPreference';
import {
  loadNewsSegmentOrder,
  subscribeNewsSegmentOrderChanged,
} from '@/services/newsSegmentOrderPreference';
import { loadNewsSegment, saveNewsSegment } from '@/services/newsSegmentPreference';
import { loadSelectedSources, saveSelectedSources } from '@/services/newsSourceSelection';
import { markNewsFeedSeen } from '@/services/newsUnreadPreference';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import { useResetRefreshingOnTabBlur, useTabPressCycleSegment } from '@/hooks';
import { createScrollLoadMoreGate } from '@/utils/listScrollLoadMoreGate';
import {
  fetchSignalNews,
  fetchSignalNewsDigests,
  fetchSignalNewsSources,
  fetchSignalYoutube,
  signalNewsToNewsItem,
  signalYoutubeToYoutubeItem,
} from '@/integrations/signal-api';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiNewsDigestItem, SignalApiNewsItem, SignalApiYoutubeVideo } from '@/integrations/signal-api/types';
import type { NewsItem, YoutubeItem } from '@/types/signal';

type FeedRow =
  | { kind: 'news'; news: NewsItem }
  | { kind: 'video'; video: YoutubeItem }
  | { kind: 'ad'; key: string };
type FeedLoadResult = { itemIds: string[]; kind: 'news' | 'video'; insightIds: string[] };

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

export default function FeedScreen() {
  const router = useRouter();
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeNewsStyles(theme, scaleFont), [theme, scaleFont]);
  const filterRowStyles = useMemo(() => selectionFilterRowStyles(theme, scaleFont), [theme, scaleFont]);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [segment, setSegment] = useState<NewsSegmentKey>(DEFAULT_NEWS_SEGMENT);
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
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterDraftSources, setFilterDraftSources] = useState<string[]>([]);
  const [globalFilter, setGlobalFilter] = useState<NewsQuickFilterKind>('all');
  const [cryptoFilter, setCryptoFilter] = useState<NewsQuickFilterKind>('all');
  const [koreaFilter, setKoreaFilter] = useState<NewsQuickFilterKind>('all');
  const [cryptoSourceOptions, setCryptoSourceOptions] = useState<string[]>([]);
  const [koreaSourceOptions, setKoreaSourceOptions] = useState<string[]>([]);
  const [cryptoSelectedSources, setCryptoSelectedSources] = useState<string[] | null>(null);
  const [koreaSelectedSources, setKoreaSelectedSources] = useState<string[] | null>(null);
  const [cryptoDraftSources, setCryptoDraftSources] = useState<string[]>([]);
  const [koreaDraftSources, setKoreaDraftSources] = useState<string[]>([]);
  const [cryptoSourceModalVisible, setCryptoSourceModalVisible] = useState(false);
  const [koreaSourceModalVisible, setKoreaSourceModalVisible] = useState(false);
  const [watchFilter, setWatchFilter] = useState<WatchFilterKind>('all');
  const [watchSymbolOptions, setWatchSymbolOptions] = useState<string[]>([]);
  const [watchSelectedSymbols, setWatchSelectedSymbols] = useState<string[] | null>(null);
  const [watchDraftSymbols, setWatchDraftSymbols] = useState<string[]>([]);
  const [watchSymbolModalVisible, setWatchSymbolModalVisible] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [newContentAvailable, setNewContentAvailable] = useState(false);
  /** 출처 필터 UI용(카탈로그 비었을 때 샘플 + 첫 페이지 병합) */
  const [signalNewsPool, setSignalNewsPool] = useState<SignalApiNewsItem[]>([]);
  /** 백그라운드 폴링: 가장 최근에 본 뉴스 ID */
  const latestSeenIdRef = useRef<string | null>(null);

  /** 웹: 리스트 콘텐츠 높이 < 뷰포트면 onEndReached가 안 나와 다음 페이지를 못 불러오는 경우가 있음 */
  const feedListViewportH = useRef(0);
  const feedScrollLoadGateRef = useRef(createScrollLoadMoreGate());
  const itemsRef = useRef(items);
  const videoItemsRef = useRef(videoItems);
  const globalFilterRef = useRef(globalFilter);
  const cryptoFilterRef = useRef(cryptoFilter);
  const koreaFilterRef = useRef(koreaFilter);
  const cryptoSelectedSourcesRef = useRef(cryptoSelectedSources);
  const koreaSelectedSourcesRef = useRef(koreaSelectedSources);
  const watchFilterRef = useRef(watchFilter);
  const watchSelectedSymbolsRef = useRef(watchSelectedSymbols);
  itemsRef.current = items;
  videoItemsRef.current = videoItems;
  globalFilterRef.current = globalFilter;
  cryptoFilterRef.current = cryptoFilter;
  koreaFilterRef.current = koreaFilter;
  cryptoSelectedSourcesRef.current = cryptoSelectedSources;
  koreaSelectedSourcesRef.current = koreaSelectedSources;
  watchFilterRef.current = watchFilter;
  watchSelectedSymbolsRef.current = watchSelectedSymbols;

  useEffect(() => {
    if (!refreshNotice) return;
    const timeout = setTimeout(() => setRefreshNotice(null), 4500);
    return () => clearTimeout(timeout);
  }, [refreshNotice]);

  /** 백그라운드 폴링: 3분마다 최신 뉴스 ID 확인 → 새 항목 있으면 배너 표시 */
  useEffect(() => {
    if (!hasSignalApi()) return;
    const POLL_MS = 3 * 60 * 1000;
    const poll = async () => {
      try {
        const page = await fetchSignalNews({ locale, category: 'global', limit: 1, offset: 0 }, { cacheMode: 'bypass' });
        const latestId = page.items[0]?.id ?? null;
        if (!latestId) return;
        if (latestSeenIdRef.current === null) {
          // 초기화: 현재 화면에 있는 가장 최근 뉴스 ID를 기준으로 설정
          latestSeenIdRef.current = latestId;
          return;
        }
        if (latestId !== latestSeenIdRef.current) {
          setNewContentAvailable(true);
        }
      } catch {
        // 폴링 에러는 무시
      }
    };
    const id = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(id);
  }, [locale]);

  useEffect(() => {
    void loadNewsSegment().then((s) => setSegment(s));
  }, []);

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

  const load = useCallback(
    async (forceRefresh?: boolean): Promise<FeedLoadResult> => {
      setError(null);
      setHasMore(false);
      setLoadingMore(false);
      if (!hasSignalApi()) {
        setItems([]);
        setVideoItems([]);
        setServerRows([]);
        setServerDigestRows([]);
        setYoutubeRows([]);
        setSignalNewsPool([]);
        setAvailableSources([]);
        setSelectedSources([]);
        setCryptoSourceOptions([]);
        setCryptoSelectedSources(null);
        setError(t('errorSignalApiShort'));
        return { itemIds: [], kind: 'news', insightIds: [] };
      }

      const cacheMode = forceRefresh ? 'bypass' : 'use';

      if (segment === 'video') {
        setSignalNewsPool([]);
        setAvailableSources([]);
        setSelectedSources([]);
        setCryptoSourceOptions([]);
        setCryptoSelectedSources(null);
        setItems([]);
        setServerRows([]);
        setServerDigestRows([]);
        const { items: rows, meta } = await fetchSignalYoutube(
          {
            sort: 'latest',
            limit: FEED_PAGE_VIDEO,
            offset: 0,
          },
          { cacheMode },
        );
        setYoutubeRows(rows);
        setHasMore(meta.hasMore);
        const mapped = rows.map((item) => signalYoutubeToYoutubeItem(item, locale));
        setVideoItems(mapped);
        return { itemIds: mapped.map((item) => item.id), kind: 'video', insightIds: [] };
      }

      setVideoItems([]);
      setYoutubeRows([]);

      if (segment === 'watch') {
        setSignalNewsPool([]);
        setAvailableSources([]);
        setSelectedSources([]);
        setCryptoSourceOptions([]);
        setCryptoSelectedSources(null);
        const symbols = (await loadWatchlistSymbols()).slice(0, 40);
        setWatchSymbolOptions(symbols);
        const requestSymbols =
          watchFilterRef.current === 'symbols'
            ? normalizeNullableSelection(symbols, watchSelectedSymbolsRef.current)
            : symbols;
        if (symbols.length === 0 || requestSymbols.length === 0) {
          setServerRows([]);
          setServerDigestRows([]);
          setItems([]);
          setHasMore(false);
          return { itemIds: [], kind: 'news', insightIds: [] };
        }
        const { items: rows, meta } = await fetchSignalNews(
          {
            locale,
            symbols: requestSymbols.join(','),
            limit: FEED_PAGE_WATCH,
            offset: 0,
            tag: activeTag || undefined,
          },
          { cacheMode },
        );
        setServerRows(rows);
        setServerDigestRows([]);
        setHasMore(meta.hasMore);
        const mapped = rows.map((item) => signalNewsToNewsItem(item, locale));
        setItems(mapped);
        return { itemIds: mapped.map((item) => item.id), kind: 'news', insightIds: [] };
      }

      if (segment === 'crypto') {
        setSignalNewsPool([]);
        setAvailableSources([]);
        setSelectedSources([]);
        const [newsPage, digestPage] = await Promise.all([
          fetchSignalNews(
            {
              locale,
              category: 'crypto',
              flash: cryptoFilterRef.current === 'flash',
              sources:
                cryptoFilterRef.current === 'sources'
                  ? sourceFilterParam(cryptoSourceOptions, cryptoSelectedSourcesRef.current)
                  : undefined,
              limit: FEED_PAGE_CRYPTO,
              offset: 0,
              tag: activeTag || undefined,
            },
            { cacheMode },
          ),
          fetchSignalNewsDigests({ category: 'crypto', limit: 30, batches: 10 }).catch(() => null),
        ]);
        const { items: rows, meta } = newsPage;
        setServerRows(rows);
        setServerDigestRows(digestPage?.items || []);
        setHasMore(meta.hasMore);
        const sourceOptions = uniqueSignalSources(rows);
        setCryptoSourceOptions(sourceOptions);
        const selected = normalizeNullableSelection(sourceOptions, cryptoSelectedSourcesRef.current);
        if (cryptoSelectedSourcesRef.current !== null) setCryptoSelectedSources(selected);
        const mapped = rows.map((item) => signalNewsToNewsItem(item, locale));
        setItems(mapped);
        return { itemIds: mapped.map((item) => item.id), kind: 'news', insightIds: [] };
      }

      if (segment === 'korea') {
        setSignalNewsPool([]);
        setAvailableSources([]);
        setSelectedSources([]);
        const [newsPage, digestPage] = await Promise.all([
          fetchSignalNews(
            {
              locale,
              category: 'korea',
              flash: koreaFilterRef.current === 'flash',
              sources:
                koreaFilterRef.current === 'sources'
                  ? sourceFilterParam(koreaSourceOptions, koreaSelectedSourcesRef.current)
                  : undefined,
              limit: FEED_PAGE_KOREA,
              offset: 0,
              tag: activeTag || undefined,
            },
            { cacheMode },
          ),
          fetchSignalNewsDigests({ category: 'korea', limit: 30, batches: 10 }).catch(() => null),
        ]);
        const { items: rows, meta } = newsPage;
        setServerRows(rows);
        setServerDigestRows(digestPage?.items || []);
        setHasMore(meta.hasMore);
        const sourceOptions = uniqueSignalSources(rows);
        setKoreaSourceOptions(sourceOptions);
        const selected = normalizeNullableSelection(sourceOptions, koreaSelectedSourcesRef.current);
        if (koreaSelectedSourcesRef.current !== null) setKoreaSelectedSources(selected);
        const mapped = rows.map((item) => signalNewsToNewsItem(item, locale));
        setItems(mapped);
        return { itemIds: mapped.map((item) => item.id), kind: 'news', insightIds: [] };
      }

      const pageLimit = FEED_PAGE_GLOBAL;
      const [catalogRows, firstPageResult, digestPage] = await Promise.all([
        fetchSignalNewsSources({ category: 'global' }, { cacheMode })
          .then((cat) => cat.map((c) => ({ name: c.name, enabled: c.enabled, order: c.order })))
          .catch(() => [] as { name: string; enabled: boolean; order: number }[]),
        fetchSignalNews(
          {
            locale,
            category: 'global',
            flash: globalFilterRef.current === 'flash',
            sources:
              globalFilterRef.current === 'sources'
                ? sourceFilterParam(availableSources, selectedSources)
                : undefined,
            limit: pageLimit,
            offset: 0,
            tag: activeTag || undefined,
          },
          { cacheMode },
        ),
        fetchSignalNewsDigests({ category: 'global', limit: 30, batches: 10 }).catch(() => null),
      ]);

      const enabledCatalog = (catalogRows || [])
        .filter((c) => c && c.enabled)
        .slice()
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.name).localeCompare(String(b.name)))
        .map((c) => String(c.name || '').trim())
        .filter((s) => s.length > 0);

      let probe: SignalApiNewsItem[] = [];
      if (enabledCatalog.length === 0) {
        const p = await fetchSignalNews(
          {
            locale,
            category: 'global',
            limit: SOURCE_PROBE_LIMIT,
            offset: 0,
            tag: activeTag || undefined,
          },
          { cacheMode },
        );
        probe = p.items;
      }

      const { items: firstPage, meta } = firstPageResult;
      setServerRows(firstPage);
      setServerDigestRows(digestPage?.items || []);
      setHasMore(meta.hasMore);

      const mergedForSources = [...probe, ...firstPage];
      setSignalNewsPool(mergedForSources);
      const rawSources = uniqueSignalSources(mergedForSources);
      const sources =
        enabledCatalog.length > 0 ? enabledCatalog : buildSourcesFromCatalog({ rawSources, catalog: catalogRows });
      setAvailableSources(sources);
      const selected = await loadSelectedSources(sources);
      setSelectedSources(selected);
      let displayPage = firstPage;
      if (globalFilterRef.current === 'sources') {
        const sourcePage = await fetchSignalNews(
          {
            locale,
            category: 'global',
            sources: sourceFilterParam(sources, selected),
            limit: pageLimit,
            offset: 0,
            tag: activeTag || undefined,
          },
          { cacheMode },
        );
        displayPage = sourcePage.items;
        setServerRows(displayPage);
        setHasMore(sourcePage.meta.hasMore);
      }
      const mapped = displayPage.map((item) => signalNewsToNewsItem(item, locale));
      setItems(mapped);
      // 백그라운드 폴링 기준 ID 갱신
      if (displayPage[0]?.id) latestSeenIdRef.current = displayPage[0].id;
      return { itemIds: mapped.map((item) => item.id), kind: 'news', insightIds: [] };
    },
    [activeTag, locale, segment, t],
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading || !hasSignalApi()) return;
    if (segment !== 'watch' && segment !== 'crypto' && segment !== 'korea' && segment !== 'global' && segment !== 'video') return;

    setLoadingMore(true);
    setError(null);
    try {
      if (segment === 'video') {
        const page = await fetchSignalYoutube(
          {
            sort: 'latest',
            limit: FEED_PAGE_VIDEO,
            offset: youtubeRows.length,
          },
          { cacheMode: 'use' },
        );
        if (page.items.length === 0) {
          setHasMore(false);
          return;
        }
        const merged = [...youtubeRows, ...page.items];
        setYoutubeRows(merged);
        setVideoItems(merged.map((item) => signalYoutubeToYoutubeItem(item, locale)));
        setHasMore(page.meta.hasMore);
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
      const requestSymbols =
        segment === 'watch' && watchFilterRef.current === 'symbols'
          ? normalizeNullableSelection(symbols, watchSelectedSymbolsRef.current)
          : symbols;
      if (segment === 'watch' && (symbols.length === 0 || requestSymbols.length === 0)) {
        setHasMore(false);
        return;
      }
      const { items: nextRows, meta } = await fetchSignalNews(
        {
          locale,
          category,
          symbols: requestSymbols.length > 0 ? requestSymbols.join(',') : undefined,
          flash:
            (segment === 'global' && globalFilterRef.current === 'flash') ||
            (segment === 'crypto' && cryptoFilterRef.current === 'flash') ||
            (segment === 'korea' && koreaFilterRef.current === 'flash'),
          sources:
            segment === 'global' && globalFilterRef.current === 'sources'
              ? sourceFilterParam(availableSources, selectedSources)
              : segment === 'crypto' && cryptoFilterRef.current === 'sources'
                ? sourceFilterParam(cryptoSourceOptions, cryptoSelectedSourcesRef.current)
                : segment === 'korea' && koreaFilterRef.current === 'sources'
                  ? sourceFilterParam(koreaSourceOptions, koreaSelectedSourcesRef.current)
                  : undefined,
          limit: pageLimit,
          offset: serverRows.length,
          tag: activeTag || undefined,
        },
        { cacheMode: 'use' },
      );
      if (nextRows.length === 0) {
        setHasMore(false);
        return;
      }
      const merged = [...serverRows, ...nextRows];
      setServerRows(merged);
      setHasMore(meta.hasMore);
      let scoped = merged;
      if (segment === 'global') {
        scoped = filterNewsRows(merged, {
          kind: globalFilterRef.current,
          sourceOptions: availableSources,
          selectedSources,
        });
      }
      if (segment === 'crypto') {
        const sourceOptions = uniqueSignalSources(merged);
        setCryptoSourceOptions(sourceOptions);
        const selected = normalizeNullableSelection(sourceOptions, cryptoSelectedSourcesRef.current);
        if (cryptoSelectedSourcesRef.current !== null) setCryptoSelectedSources(selected);
        scoped = filterNewsRows(merged, {
          kind: cryptoFilterRef.current,
          sourceOptions,
          selectedSources: selected,
        });
      }
      if (segment === 'korea') {
        const sourceOptions = uniqueSignalSources(merged);
        setKoreaSourceOptions(sourceOptions);
        const selected = normalizeNullableSelection(sourceOptions, koreaSelectedSourcesRef.current);
        if (koreaSelectedSourcesRef.current !== null) setKoreaSelectedSources(selected);
        scoped = filterNewsRows(merged, {
          kind: koreaFilterRef.current,
          sourceOptions,
          selectedSources: selected,
        });
      }
      if (segment === 'watch') {
        const symbolOptions = watchSymbolOptions;
        scoped = filterWatchRows(merged, {
          kind: watchFilterRef.current,
          symbolOptions,
          selectedSymbols: watchSelectedSymbolsRef.current,
        });
      }
      setItems(scoped.map((item) => signalNewsToNewsItem(item, locale)));
    } catch (e) {
      setError(formatSignalApiError(e, t, 'feedErrorLoad'));
    } finally {
      setLoadingMore(false);
    }
  }, [
    activeTag,
    hasMore,
    loading,
    loadingMore,
    locale,
    segment,
    availableSources,
    selectedSources,
    serverRows,
    t,
    watchSymbolOptions,
    youtubeRows,
  ]);

  const onFeedScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      feedScrollLoadGateRef.current.onScrollNearEnd(e, {
        enabled:
          hasMore &&
          !loadingMore &&
          !loading &&
          hasSignalApi() &&
          (segment === 'watch' || segment === 'crypto' || segment === 'korea' || segment === 'global' || segment === 'video'),
        trigger: () => void loadMore(),
      });
    },
    [hasMore, loadingMore, loading, segment, loadMore],
  );

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
            setAvailableSources([]);
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
    const prevNewsIds = new Set(items.map((item) => item.id));
    const prevVideoIds = new Set(videoItems.map((item) => item.id));
    setRefreshing(true);
    setRefreshNotice(null);
    setNewContentAvailable(false);
    try {
      const result = await load(true);
      setError(null);
      const previousIds = result.kind === 'video' ? prevVideoIds : prevNewsIds;
      const newNewsCount = result.itemIds.filter((id) => !previousIds.has(id)).length;
      if (newNewsCount > 0 && result.kind === 'video') {
        setRefreshNotice(t('feedRefreshNoticeVideo', { count: String(newNewsCount) }));
      } else if (newNewsCount > 0) {
        setRefreshNotice(t('feedRefreshNoticeNews', { count: String(newNewsCount) }));
      }
    } catch (e) {
      setError(formatSignalApiError(e, t, 'feedErrorRefresh'));
    } finally {
      setRefreshing(false);
    }
  }, [items, load, t, videoItems]);

  const applySelection = useCallback(
    async (next: string[]) => {
      try {
        await saveSelectedSources(next);
        setSelectedSources(next);
        setGlobalFilter('sources');
        if (serverRows.length > 0 && segment === 'global') {
          setLoading(true);
          const page = await fetchSignalNews(
            {
              locale,
              category: 'global',
              sources: sourceFilterParam(availableSources, next),
              limit: FEED_PAGE_GLOBAL,
              offset: 0,
              tag: activeTag || undefined,
            },
            { cacheMode: 'bypass' },
          );
          setServerRows(page.items);
          setHasMore(page.meta.hasMore);
          setItems(page.items.map((item) => signalNewsToNewsItem(item, locale)));
        }
      } catch (e) {
        setError(formatSignalApiError(e, t, 'feedErrorLoad'));
      } finally {
        setLoading(false);
      }
    },
    [activeTag, availableSources, locale, segment, serverRows, t],
  );

  const sourcesEqual = useCallback((a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const setB = new Set(b);
    return a.every((s) => setB.has(s));
  }, []);

  const commitNewsFilter = useCallback(async () => {
    setFilterModalVisible(false);
    setGlobalFilter('sources');
    if (sourcesEqual(filterDraftSources, selectedSources)) {
      if (segment === 'global') {
        const scoped = filterNewsRows(serverRows, {
          kind: 'sources',
          sourceOptions: availableSources,
          selectedSources,
        });
        setItems(scoped.map((item) => signalNewsToNewsItem(item, locale)));
      }
      return;
    }
    await applySelection(filterDraftSources);
  }, [applySelection, availableSources, filterDraftSources, locale, segment, selectedSources, serverRows, sourcesEqual]);

  const toggleSource = useCallback((source: string) => {
    setFilterDraftSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source],
    );
  }, []);

  const selectAllSources = useCallback(() => {
    setFilterDraftSources([...availableSources]);
  }, [availableSources]);

  const clearAllSources = useCallback(() => {
    setFilterDraftSources([]);
  }, []);

  const applyNewsQuickFilter = useCallback(
    (kind: NewsQuickFilterKind) => {
      if (segment === 'global') {
        setGlobalFilter(kind);
        if (kind === 'sources') {
          setFilterDraftSources(selectedSources);
          setFilterModalVisible(true);
          return;
        }
        setLoading(true);
        setItems([]);
        setServerRows([]);
        setHasMore(false);
        void fetchSignalNews(
          {
            locale,
            category: 'global',
            flash: kind === 'flash',
            limit: FEED_PAGE_GLOBAL,
            offset: 0,
            tag: activeTag || undefined,
          },
          { cacheMode: 'bypass' },
        )
          .then((page) => {
            setServerRows(page.items);
            setHasMore(page.meta.hasMore);
            setItems(page.items.map((item) => signalNewsToNewsItem(item, locale)));
          })
          .catch((e) => setError(formatSignalApiError(e, t, 'feedErrorLoad')))
          .finally(() => setLoading(false));
        return;
      }

      if (segment === 'crypto') {
        setCryptoFilter(kind);
        const selected = normalizeNullableSelection(cryptoSourceOptions, cryptoSelectedSources);
        if (kind === 'sources') {
          setCryptoDraftSources(selected);
          setCryptoSourceModalVisible(true);
          return;
        }
        setLoading(true);
        setItems([]);
        setServerRows([]);
        setHasMore(false);
        void fetchSignalNews(
          {
            locale,
            category: 'crypto',
            flash: kind === 'flash',
            limit: FEED_PAGE_CRYPTO,
            offset: 0,
            tag: activeTag || undefined,
          },
          { cacheMode: 'bypass' },
        )
          .then((page) => {
            const sourceOptions = uniqueSignalSources(page.items);
            setCryptoSourceOptions(sourceOptions);
            setServerRows(page.items);
            setHasMore(page.meta.hasMore);
            setItems(page.items.map((item) => signalNewsToNewsItem(item, locale)));
          })
          .catch((e) => setError(formatSignalApiError(e, t, 'feedErrorLoad')))
          .finally(() => setLoading(false));
        return;
      }

      if (segment === 'korea') {
        setKoreaFilter(kind);
        const selected = normalizeNullableSelection(koreaSourceOptions, koreaSelectedSources);
        if (kind === 'sources') {
          setKoreaDraftSources(selected);
          setKoreaSourceModalVisible(true);
          return;
        }
        setLoading(true);
        setItems([]);
        setServerRows([]);
        setServerDigestRows([]);
        setHasMore(false);
        void fetchSignalNews(
          {
            locale,
            category: 'korea',
            flash: kind === 'flash',
            limit: FEED_PAGE_KOREA,
            offset: 0,
            tag: activeTag || undefined,
          },
          { cacheMode: 'bypass' },
        )
          .then((page) => {
            const sourceOptions = uniqueSignalSources(page.items);
            setKoreaSourceOptions(sourceOptions);
            setServerRows(page.items);
            setHasMore(page.meta.hasMore);
            setItems(page.items.map((item) => signalNewsToNewsItem(item, locale)));
          })
          .catch((e) => setError(formatSignalApiError(e, t, 'feedErrorLoad')))
          .finally(() => setLoading(false));
      }
    },
    [
      activeTag,
      availableSources,
      cryptoSelectedSources,
      cryptoSourceOptions,
      koreaSelectedSources,
      koreaSourceOptions,
      locale,
      segment,
      selectedSources,
      serverRows,
      t,
    ],
  );

  const commitCryptoSourceFilter = useCallback(() => {
    setCryptoSourceModalVisible(false);
    setCryptoSelectedSources(cryptoDraftSources);
    setCryptoFilter('sources');
    setLoading(true);
    setItems([]);
    setServerRows([]);
    setServerDigestRows([]);
    setHasMore(false);
    void fetchSignalNews(
      {
        locale,
        category: 'crypto',
        sources: sourceFilterParam(cryptoSourceOptions, cryptoDraftSources),
        limit: FEED_PAGE_CRYPTO,
        offset: 0,
        tag: activeTag || undefined,
      },
      { cacheMode: 'bypass' },
    )
      .then((page) => {
        setServerRows(page.items);
        setHasMore(page.meta.hasMore);
        setItems(page.items.map((item) => signalNewsToNewsItem(item, locale)));
      })
      .catch((e) => setError(formatSignalApiError(e, t, 'feedErrorLoad')))
      .finally(() => setLoading(false));
  }, [activeTag, cryptoDraftSources, cryptoSourceOptions, locale, t]);

  const toggleCryptoSource = useCallback((source: string) => {
    setCryptoDraftSources((prev) =>
      prev.includes(source) ? prev.filter((item) => item !== source) : [...prev, source],
    );
  }, []);

  const selectAllCryptoSources = useCallback(
    () => setCryptoDraftSources([...cryptoSourceOptions]),
    [cryptoSourceOptions],
  );
  const clearAllCryptoSources = useCallback(() => setCryptoDraftSources([]), []);

  const commitKoreaSourceFilter = useCallback(() => {
    setKoreaSourceModalVisible(false);
    setKoreaSelectedSources(koreaDraftSources);
    setKoreaFilter('sources');
    setLoading(true);
    setItems([]);
    setServerRows([]);
    setServerDigestRows([]);
    setHasMore(false);
    void fetchSignalNews(
      {
        locale,
        category: 'korea',
        sources: sourceFilterParam(koreaSourceOptions, koreaDraftSources),
        limit: FEED_PAGE_KOREA,
        offset: 0,
        tag: activeTag || undefined,
      },
      { cacheMode: 'bypass' },
    )
      .then((page) => {
        setServerRows(page.items);
        setHasMore(page.meta.hasMore);
        setItems(page.items.map((item) => signalNewsToNewsItem(item, locale)));
      })
      .catch((e) => setError(formatSignalApiError(e, t, 'feedErrorLoad')))
      .finally(() => setLoading(false));
  }, [activeTag, koreaDraftSources, koreaSourceOptions, locale, t]);

  const toggleKoreaSource = useCallback((source: string) => {
    setKoreaDraftSources((prev) =>
      prev.includes(source) ? prev.filter((item) => item !== source) : [...prev, source],
    );
  }, []);

  const selectAllKoreaSources = useCallback(
    () => setKoreaDraftSources([...koreaSourceOptions]),
    [koreaSourceOptions],
  );
  const clearAllKoreaSources = useCallback(() => setKoreaDraftSources([]), []);

  const reloadWatchFilterFromServer = useCallback(
    async (params?: {
      kind?: WatchFilterKind;
      selectedSymbols?: string[] | null;
    }) => {
      const symbols = watchSymbolOptions.length > 0 ? watchSymbolOptions : (await loadWatchlistSymbols()).slice(0, 40);
      const kind = params?.kind ?? watchFilterRef.current;
      const selectedSymbols =
        params && 'selectedSymbols' in params ? params.selectedSymbols ?? null : watchSelectedSymbolsRef.current;
      const requestSymbols = kind === 'symbols' ? normalizeNullableSelection(symbols, selectedSymbols) : symbols;
      if (requestSymbols.length === 0) {
        setServerRows([]);
        setServerDigestRows([]);
        setItems([]);
        setHasMore(false);
        return;
      }
      setLoading(true);
      setItems([]);
      setServerRows([]);
      setServerDigestRows([]);
      setHasMore(false);
      try {
        const page = await fetchSignalNews(
          {
            locale,
            symbols: requestSymbols.join(','),
            limit: FEED_PAGE_WATCH,
            offset: 0,
            tag: activeTag || undefined,
          },
          { cacheMode: 'bypass' },
        );
        setServerRows(page.items);
        setHasMore(page.meta.hasMore);
        setItems(page.items.map((item) => signalNewsToNewsItem(item, locale)));
      } catch (e) {
        setError(formatSignalApiError(e, t, 'feedErrorLoad'));
      } finally {
        setLoading(false);
      }
    },
    [activeTag, locale, t, watchSymbolOptions],
  );

  const onPickWatchFilter = useCallback(
    (kind: WatchFilterKind) => {
      setWatchFilter(kind);
      if (kind === 'symbols') {
        setWatchDraftSymbols(normalizeNullableSelection(watchSymbolOptions, watchSelectedSymbols));
        setWatchSymbolModalVisible(true);
        return;
      }
      void reloadWatchFilterFromServer({ kind });
    },
    [reloadWatchFilterFromServer, watchSelectedSymbols, watchSymbolOptions],
  );

  const commitWatchSymbolFilter = useCallback(() => {
    setWatchSymbolModalVisible(false);
    setWatchSelectedSymbols(watchDraftSymbols);
    setWatchFilter('symbols');
    void reloadWatchFilterFromServer({ kind: 'symbols', selectedSymbols: watchDraftSymbols });
  }, [reloadWatchFilterFromServer, watchDraftSymbols]);

  const toggleWatchSymbol = useCallback((symbol: string) => {
    setWatchDraftSymbols((prev) =>
      prev.includes(symbol) ? prev.filter((item) => item !== symbol) : [...prev, symbol],
    );
  }, []);

  const selectAllWatchSymbols = useCallback(() => setWatchDraftSymbols([...watchSymbolOptions]), [watchSymbolOptions]);
  const clearAllWatchSymbols = useCallback(() => setWatchDraftSymbols([]), []);

  const onPickSegment = useCallback((key: NewsSegmentKey) => {
    if (segment === key) return;
    setLoading(true);
    setItems([]);
    setVideoItems([]);
    setServerRows([]);
    setServerDigestRows([]);
    setYoutubeRows([]);
    setHasMore(false);
    setError(null);
    setRefreshNotice(null);
    if (key === 'video') setActiveTag(null);
    setSegment(key);
    void saveNewsSegment(key);
  }, [segment]);

  useTabPressCycleSegment(segment, segmentOrder, onPickSegment);

  const newsQuickFilter =
    segment === 'crypto' ? cryptoFilter : segment === 'korea' ? koreaFilter : globalFilter;
  const digestBatches = useMemo(() => {
    if (segment === 'video' || segment === 'watch') return [];
    if (serverDigestRows.length > 0) {
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
          return digestFromServer(top, serverRows);
        })
        .slice(0, 10);
    }
    return [];
  }, [segment, serverDigestRows, serverRows]);

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

  const bottomPad = 28 + tabBarHeight + tabBarBottomInset(insets.bottom);
  const fabStackBottom = tabBarHeight + tabBarBottomInset(insets.bottom) + 8;

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

        <DigestPager batches={digestBatches} />

        {segment === 'watch' ? (
          <View style={styles.watchFilterRow}>
            {WATCH_FILTERS.map((filter) => {
              const active = watchFilter === filter.key;
              return (
                <Pressable
                  key={filter.key}
                  onPress={() => onPickWatchFilter(filter.key)}
                  style={[styles.watchFilterChip, active && styles.watchFilterChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}>
                  <Text style={[styles.watchFilterText, active && styles.watchFilterTextActive]}>
                    {t(filter.labelId)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {segment === 'global' || segment === 'crypto' || segment === 'korea' ? (
          <View style={styles.watchFilterRow}>
            {NEWS_QUICK_FILTERS.map((filter) => {
              const active = newsQuickFilter === filter.key;
              return (
                <Pressable
                  key={filter.key}
                  onPress={() => applyNewsQuickFilter(filter.key)}
                  style={[styles.watchFilterChip, active && styles.watchFilterChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}>
                  <Text style={[styles.watchFilterText, active && styles.watchFilterTextActive]}>
                    {t(filter.labelId)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {loading ? (
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
      loading,
      applyNewsQuickFilter,
      newsQuickFilter,
      onPickWatchFilter,
      segment,
      styles,
      t,
      watchFilter,
      theme.textDim,
      theme.green,
      theme.greenBorder,
      digestBatches,
    ],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SignalHeader compact onBrandPress={() => void onRefresh()} />
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={styles.mainColumn}>
        <View style={styles.topFixed}>
          {newContentAvailable && !refreshing ? (
            <FeedUpdateBanner
              variant="prompt"
              message={t('feedNewContentAvailable')}
              onPress={() => void onRefresh()}
            />
          ) : null}
          {refreshNotice ? <FeedUpdateBanner variant="notice" message={refreshNotice} /> : null}
          <View style={styles.segment}>
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
          </View>
        </View>

        <FlatList
          data={loading ? [] : listData}
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
                  featured={index === 0}
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
            ) : null
          }
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.55}
          onScroll={onFeedScroll}
          scrollEventThrottle={350}
          onLayout={
            Platform.OS === 'web'
              ? (e) => {
                  feedListViewportH.current = e.nativeEvent.layout.height;
                }
              : undefined
          }
          onContentSizeChange={
            Platform.OS === 'web'
              ? (_, h) => {
                  if (!hasMore || loadingMore || loading) return;
                  const vh = feedListViewportH.current;
                  if (vh <= 0 || h <= 0) return;
                  if (h >= vh + 32) return;
                  void loadMore();
                }
              : undefined
          }
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            loading ? undefined : (
              <ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            )
          }
          removeClippedSubviews={Platform.OS === 'android'}
          initialNumToRender={Platform.OS === 'web' ? 28 : 8}
          windowSize={Platform.OS === 'web' ? 12 : 7}
          maxToRenderPerBatch={Platform.OS === 'web' ? 24 : 12}
        />
      </View>

      {hasSignalApi() ? (
        <FloatingGlassFab
          bottom={fabStackBottom}
          onPress={() => void onRefresh()}
          iconName="sync"
          accessibilityLabel={t('fabRefreshA11y')}
          disabled={refreshing || loading}
        />
      ) : null}

      <NewsSourceFilterModal
        visible={filterModalVisible}
        onDone={() => void commitNewsFilter()}
        sources={availableSources}
        selected={filterDraftSources}
        onToggle={toggleSource}
        onSelectAll={selectAllSources}
        onClearAll={clearAllSources}
        bottomInset={insets.bottom}
      />
      <SelectionFilterSheet
        visible={cryptoSourceModalVisible}
        title={t('feedNewsFilterTitle')}
        hint={t('feedNewsFilterSub')}
        onDone={commitCryptoSourceFilter}
        bottomInset={insets.bottom}
        toolbar={{
          sectionLabel: t('feedNewsFilterIncluded'),
          countLabel: t('filterSheetSelectedCount', {
            selected: cryptoDraftSources.length,
            total: cryptoSourceOptions.length,
          }),
          selectAllLabel: t('feedNewsFilterSelectAll'),
          clearAllLabel: t('feedNewsFilterClearAll'),
          onSelectAll: selectAllCryptoSources,
          onClearAll: clearAllCryptoSources,
        }}>
        {cryptoSourceOptions.map((source) => {
          const on = cryptoDraftSources.includes(source);
          return (
            <Pressable
              key={source}
              onPress={() => toggleCryptoSource(source)}
              style={[filterRowStyles.row, on && filterRowStyles.rowOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}>
              <FontAwesome
                name={on ? 'check-square' : 'square-o'}
                size={18}
                color={on ? theme.green : theme.textDim}
                style={filterRowStyles.checkIcon}
              />
              <Text style={[filterRowStyles.name, !on && filterRowStyles.nameOff]} numberOfLines={2}>
                {source}
              </Text>
            </Pressable>
          );
        })}
      </SelectionFilterSheet>
      <SelectionFilterSheet
        visible={koreaSourceModalVisible}
        title={t('feedNewsFilterTitle')}
        hint={t('feedNewsFilterSub')}
        onDone={commitKoreaSourceFilter}
        bottomInset={insets.bottom}
        toolbar={{
          sectionLabel: t('feedNewsFilterIncluded'),
          countLabel: t('filterSheetSelectedCount', {
            selected: koreaDraftSources.length,
            total: koreaSourceOptions.length,
          }),
          selectAllLabel: t('feedNewsFilterSelectAll'),
          clearAllLabel: t('feedNewsFilterClearAll'),
          onSelectAll: selectAllKoreaSources,
          onClearAll: clearAllKoreaSources,
        }}>
        {koreaSourceOptions.map((source) => {
          const on = koreaDraftSources.includes(source);
          return (
            <Pressable
              key={source}
              onPress={() => toggleKoreaSource(source)}
              style={[filterRowStyles.row, on && filterRowStyles.rowOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}>
              <FontAwesome
                name={on ? 'check-square' : 'square-o'}
                size={18}
                color={on ? theme.green : theme.textDim}
                style={filterRowStyles.checkIcon}
              />
              <Text style={[filterRowStyles.name, !on && filterRowStyles.nameOff]} numberOfLines={2}>
                {source}
              </Text>
            </Pressable>
          );
        })}
      </SelectionFilterSheet>
      <SelectionFilterSheet
        visible={watchSymbolModalVisible}
        title={t('feedWatchSymbolFilterTitle')}
        hint={t('feedWatchSymbolFilterHint')}
        onDone={commitWatchSymbolFilter}
        bottomInset={insets.bottom}
        toolbar={{
          sectionLabel: t('feedWatchSymbolFilterSection'),
          countLabel: t('filterSheetSelectedCount', {
            selected: watchDraftSymbols.length,
            total: watchSymbolOptions.length,
          }),
          selectAllLabel: t('feedNewsFilterSelectAll'),
          clearAllLabel: t('feedNewsFilterClearAll'),
          onSelectAll: selectAllWatchSymbols,
          onClearAll: clearAllWatchSymbols,
        }}>
        {watchSymbolOptions.map((symbol) => {
          const on = watchDraftSymbols.includes(symbol);
          return (
            <Pressable
              key={symbol}
              onPress={() => toggleWatchSymbol(symbol)}
              style={[filterRowStyles.row, on && filterRowStyles.rowOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}>
              <FontAwesome
                name={on ? 'check-square' : 'square-o'}
                size={18}
                color={on ? theme.green : theme.textDim}
                style={filterRowStyles.checkIcon}
              />
              <Text style={[filterRowStyles.name, !on && filterRowStyles.nameOff]} numberOfLines={2}>
                {symbol}
              </Text>
            </Pressable>
          );
        })}
      </SelectionFilterSheet>
    </SafeAreaView>
  );
}
