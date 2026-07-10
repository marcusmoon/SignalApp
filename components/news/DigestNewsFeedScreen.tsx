import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useFocusEffect, useIsFocused } from 'expo-router/react-navigation';
import { useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { makeNewsStyles } from '@/components/news/newsStyles';
import { NewsDigestIssueCard } from '@/components/news/NewsDigestIssueCard';
import {
  digestFromServer,
  filterRealtimeNewsRows,
  utcRangeLastHours,
} from '@/components/news/digestFeedModel';
import { NewsCard } from '@/components/signal/NewsCard';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { FeedNewContentChip } from '@/components/signal/FeedNewContentChip';
import { FloatingGlassFab } from '@/components/signal/FloatingGlassFab';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { DEFAULT_NEWS_SEGMENT, NEWS_SEGMENT_ORDER, parseNewsSegmentKey, type NewsSegmentKey } from '@/constants/newsSegment';
import { fabStackBottom, tabScreenScrollBottomPadding } from '@/constants/screenLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useRegisterWebHeaderRefresh } from '@/contexts/WebHeaderRefreshContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useSidebarSubTabs } from '@/contexts/SidebarSubTabsContext';
import { NEWS_SEGMENT_LABEL } from '@/domain/news';
import { useResetRefreshingOnTabBlur, useScrollToTopOnChange, useTabPressCycleSegment } from '@/hooks';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { fetchSignalNews, fetchSignalNewsDigests, signalNewsToNewsItem } from '@/integrations/signal-api';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiNewsDigestItem, SignalApiNewsItem } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import {
  loadNewsTitleDisplayMode,
  saveNewsTitleDisplayMode,
  type NewsTitleDisplayMode,
} from '@/services/newsTitleDisplayPreference';
import { loadNewsSegmentOrder } from '@/services/newsSegmentOrderPreference';
import { loadNewsSegment, saveNewsSegment } from '@/services/newsSegmentPreference';
import { firstRouteParam } from '@/utils/routeSearchParams';
import { useSafeSetRouteParams } from '@/utils/safeRouteParams';

const DIGEST_SEGMENTS = new Set<NewsSegmentKey>(['global', 'korea', 'crypto']);
const DIGEST_WINDOW_HOURS = 24;
const REALTIME_LIMIT = 25;
const PENDING_PREVIEW_LIMIT = 5;

type DigestFeedViewMode = 'digest' | 'live';

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
  const [viewMode, setViewMode] = useState<DigestFeedViewMode>('digest');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  const [error, setError] = useState<string | null>(null);
  const [digestRows, setDigestRows] = useState<SignalApiNewsDigestItem[]>([]);
  const [realtimeRows, setRealtimeRows] = useState<SignalApiNewsItem[]>([]);
  const [newsTitleDisplayMode, setNewsTitleDisplayMode] = useState<NewsTitleDisplayMode>('localized');
  const [newContentSegments, setNewContentSegments] = useState(() => new Set<NewsSegmentKey>());
  const latestSeenIdBySegmentRef = useRef<Partial<Record<NewsSegmentKey, string>>>({});
  const digestRowsRef = useRef(digestRows);
  const realtimeRowsRef = useRef(realtimeRows);
  digestRowsRef.current = digestRows;
  realtimeRowsRef.current = realtimeRows;

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

  const { ref: feedScrollRef } = useScrollToTopOnChange([segment, viewMode], {
    resyncDeps: [digestRows, realtimeRows],
  });
  const feedScrollResetKey = `${segment}:${viewMode}`;

  const digestSegmentOrder = useMemo(
    () => segmentOrder.filter((key) => DIGEST_SEGMENTS.has(key)),
    [segmentOrder],
  );

  const load = useCallback(
    async (forceRefresh?: boolean) => {
      setError(null);
      if (!hasSignalApi()) {
        setDigestRows([]);
        setRealtimeRows([]);
        setError(t('errorSignalApiShort'));
        return;
      }
      const cacheMode = signalCacheMode(forceRefresh);
      const range = utcRangeLastHours(DIGEST_WINDOW_HOURS);
      try {
        const [digestPage, newsPage] = await Promise.all([
          fetchSignalNewsDigests(
            { category: segment, from: range.from, to: range.to, limit: 40, batches: 20 },
            { cacheMode },
          ),
          fetchSignalNews(
            { locale, category: segment, limit: REALTIME_LIMIT, offset: 0 },
            { cacheMode },
          ),
        ]);
        const lookupRows = newsPage.items;
        setDigestRows(digestPage.items);
        setRealtimeRows(filterRealtimeNewsRows(newsPage.items, digestPage.items));
        syncSegmentLatestSeen(
          segment,
          digestPage.items[0]?.id ?? newsPage.items[0]?.id ?? null,
        );
        void lookupRows;
      } catch (e) {
        setError(formatSignalApiError(e, t, 'feedErrorLoad'));
        setDigestRows([]);
        setRealtimeRows([]);
      }
    },
    [locale, segment, syncSegmentLatestSeen, t],
  );

  useEffect(() => {
    if (!hasSignalApi() || !isFocused) return;
    const POLL_MS = 3 * 60 * 1000;

    const fetchLatestIdForSegment = async (seg: NewsSegmentKey): Promise<string | null> => {
      const page = await fetchSignalNews(
        { locale, category: seg, limit: 1, offset: 0 },
        { cacheMode: 'bypass' },
      );
      return page.items[0]?.id ?? null;
    };

    const poll = async () => {
      await Promise.all(
        digestSegmentOrder.map(async (seg) => {
          try {
            const latestId = await fetchLatestIdForSegment(seg);
            if (!latestId) return;
            const seen = latestSeenIdBySegmentRef.current[seg];
            if (!seen) return;
            if (latestId !== seen) markSegmentHasNewContent(seg);
          } catch {
            /* ignore polling errors */
          }
        }),
      );
    };
    const id = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(id);
  }, [digestSegmentOrder, isFocused, locale, markSegmentHasNewContent]);

  useEffect(() => {
    void loadNewsSegmentOrder().then(setSegmentOrder);
    void loadNewsTitleDisplayMode().then(setNewsTitleDisplayMode);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const showLoading =
          digestRowsRef.current.length === 0 && realtimeRowsRef.current.length === 0;
        if (showLoading) setLoading(true);
        try {
          await load(false);
        } catch (e) {
          if (!cancelled) {
            setError(formatSignalApiError(e, t, 'feedErrorLoad'));
            setDigestRows([]);
            setRealtimeRows([]);
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
  useRegisterWebHeaderRefresh(() => void onRefresh());

  const onPickSegment = useCallback(
    (key: NewsSegmentKey) => {
      if (!DIGEST_SEGMENTS.has(key)) return;
      if (segment === key) return;
      setLoading(true);
      setDigestRows([]);
      setRealtimeRows([]);
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
    () => digestRows.map((row) => digestFromServer(row, realtimeRows)),
    [digestRows, realtimeRows],
  );
  const realtimeItems = useMemo(
    () => realtimeRows.map((row) => signalNewsToNewsItem(row, locale)),
    [locale, realtimeRows],
  );
  const pendingPreviewItems = useMemo(
    () => realtimeItems.slice(0, PENDING_PREVIEW_LIMIT),
    [realtimeItems],
  );
  const pendingMoreCount = Math.max(0, realtimeItems.length - PENDING_PREVIEW_LIMIT);
  const newsTitleShowAlternate = newsTitleDisplayMode === 'alternate';
  const newsTitleAlternateIsTranslation = locale === 'en';
  const useNewsTitleFab = Platform.OS !== 'web' && !useTwoPane;
  const newsTitleListToggleA11y = newsTitleShowAlternate
    ? t('newsTitleListShowLocalized')
    : newsTitleAlternateIsTranslation
      ? t('newsTitleListShowTranslation')
      : t('newsTitleListShowOriginal');
  const newContentAvailable = newContentSegments.has(segment);
  const bottomPad = tabScreenScrollBottomPadding(tabBarHeight, insets.bottom);
  const fabBottom = fabStackBottom(tabBarHeight, insets.bottom);

  const renderRealtimeCards = (items: typeof realtimeItems) =>
    items.map((item) => (
      <NewsCard
        key={item.id}
        layout="grouped"
        item={item}
        compactMeta
        titleToggle={segment === 'global' || segment === 'crypto'}
        titleShowAlternate={useNewsTitleFab ? newsTitleShowAlternate : undefined}
      />
    ));

  const viewModePicker = (
    <View style={[styles.segment, !useTwoPane && styles.digestViewModeSegment]}>
      {(['digest', 'live'] as const).map((mode) => {
        const selected = viewMode === mode;
        const label =
          mode === 'digest' ? t('newsDigestViewModeDigest') : t('newsDigestViewModeLive');
        return (
          <Pressable
            key={mode}
            onPress={() => setViewMode(mode)}
            style={[styles.segBtn, selected && styles.segBtnActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={label}>
            <Text style={[styles.segText, selected && styles.segTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
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
            {viewModePicker}
          </View>
        ) : (
          <View style={[styles.topFixed, styles.listColumnDigestStrip]}>{viewModePicker}</View>
        )}

        {isFocused ? (
          <FeedNewContentChip
            visible={newContentAvailable}
            refreshing={refreshing}
            message={t('feedNewContentAvailable')}
            onPress={() => void onRefresh()}
          />
        ) : null}

        <WebWheelScrollView
          ref={feedScrollRef as never}
          scrollResetKey={feedScrollResetKey}
          style={styles.list}
          contentContainerStyle={[styles.listContent, { paddingBottom: bottomPad }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            loading && digestItems.length === 0 && realtimeItems.length === 0 ? undefined : (
              <ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            )
          }>
          <View style={styles.listHeader}>
            {viewMode === 'live' ? (
              <>
                <Text style={styles.digestFeedMeta}>{t('newsDigestFeedLiveMeta')}</Text>
                {error ? (
                  <View style={styles.errBox}>
                    <Text style={styles.errText}>{error}</Text>
                  </View>
                ) : null}
                {loading && realtimeItems.length === 0 ? (
                  <View style={styles.skeletonBlock}>
                    <SignalLoadingIndicator message={t('commonLoading')} />
                  </View>
                ) : null}
                {!loading && realtimeItems.length === 0 && !error ? (
                  <Text style={styles.empty}>{t('newsDigestFeedRealtimeEmpty')}</Text>
                ) : null}
                {renderRealtimeCards(realtimeItems)}
              </>
            ) : (
              <>
                {pendingPreviewItems.length > 0 ? (
                  <View style={styles.digestPendingBlock}>
                    <View style={styles.digestPendingHeaderRow}>
                      <Text style={styles.digestPendingHeader}>{t('newsDigestFeedPendingHeader')}</Text>
                      {pendingMoreCount > 0 ? (
                        <Pressable
                          onPress={() => setViewMode('live')}
                          style={styles.digestPendingMoreBtn}
                          accessibilityRole="button"
                          accessibilityLabel={t('newsDigestFeedPendingMore', {
                            count: String(pendingMoreCount),
                          })}>
                          <Text style={styles.digestPendingMoreText}>
                            {t('newsDigestFeedPendingMore', { count: String(pendingMoreCount) })}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                    {renderRealtimeCards(pendingPreviewItems)}
                  </View>
                ) : null}
                <Text style={styles.digestFeedMeta}>
                  {t('newsDigestFeedWindowMeta', { hours: String(DIGEST_WINDOW_HOURS) })}
                </Text>
                {error ? (
                  <View style={styles.errBox}>
                    <Text style={styles.errText}>{error}</Text>
                  </View>
                ) : null}
                {loading && digestItems.length === 0 ? (
                  <View style={styles.skeletonBlock}>
                    <SignalLoadingIndicator message={t('commonLoading')} />
                  </View>
                ) : null}
                {!loading && digestItems.length === 0 && !error ? (
                  <Text style={styles.empty}>{t('newsDigestFeedEmpty')}</Text>
                ) : null}
                {digestItems.map((item) => (
                  <NewsDigestIssueCard key={item.id} digest={item} />
                ))}
              </>
            )}
          </View>
        </WebWheelScrollView>
      </View>

      {useNewsTitleFab && isFocused && (segment === 'global' || segment === 'crypto') ? (
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
