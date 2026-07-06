import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedUpdateBanner } from '@/components/signal/FeedUpdateBanner';
import { FloatingGlassFab } from '@/components/signal/FloatingGlassFab';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { DisclosureDigestSection } from '@/components/disclosures/DisclosureDigestSection';
import { WebWheelFlatList } from '@/components/layout/WebWheelFlatList';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH, wideContentFill } from '@/constants/responsiveLayout';
import { webFlexFill, webScrollViewportStyle, webShellBackground } from '@/constants/webLayout';
import {
  fabStackBottom,
  SCREEN_FIXED_HEADER_PADDING_BOTTOM,
  SCREEN_FIXED_HEADER_PADDING_HORIZONTAL,
  SCREEN_FIXED_HEADER_PADDING_TOP,
  tabScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import {
  getSegmentTabBarStyles,
  SCREEN_LIST_CONTENT_PADDING_TOP,
  SCREEN_LIST_HEADER_PADDING_BOTTOM,
  SCREEN_LIST_HEADER_PADDING_TOP,
  SCREEN_WIDE_CONTENT_PADDING_TOP,
} from '@/constants/segmentTabBar';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useSidebarSubTabs } from '@/contexts/SidebarSubTabsContext';
import { useRefreshWithScrollToTop, useScrollToTopOnChange } from '@/hooks';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useTabPressCycleSegment } from '@/hooks/useTabPressCycleSegment';
import { fetchSignalDisclosures } from '@/integrations/signal-api/disclosures';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { fetchSignalDisclosureDigests } from '@/integrations/signal-api/disclosureDigests';
import type { SignalApiDisclosure, SignalApiDisclosureDigestItem } from '@/integrations/signal-api/types';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { hasSignalApi } from '@/services/env';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import { markDisclosureFeedSeen } from '@/services/disclosureUnreadPreference';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { formatRelativeFromIso } from '@/utils/date';
import type { AppLocale, MessageId } from '@/locales/messages';
import {
  disclosureTypeFilterLabelId,
  disclosureTypeFiltersForScope,
  resolveDisclosureTypeScope,
  typeCategoryApiParam,
  type DisclosureTypeFilterKey,
} from '@/domain/disclosures';

type FilterKey = 'us' | 'kr' | 'watch';

type ListQuery = {
  filter: FilterKey;
  typeFilter: DisclosureTypeFilterKey;
  symbolFilter: string;
};

const FILTER_ORDER: FilterKey[] = ['us', 'kr', 'watch'];

const FILTERS: { key: FilterKey; label: MessageId }[] = [
  { key: 'us', label: 'disclosuresFilterUs' },
  { key: 'kr', label: 'disclosuresFilterKr' },
  { key: 'watch', label: 'disclosuresFilterWatch' },
];

function disclosureTime(item: SignalApiDisclosure, locale: string): string {
  return item.filedAt ? formatRelativeFromIso(item.filedAt, locale as AppLocale) : '—';
}

function disclosureDate(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function providerLabel(item: SignalApiDisclosure): string {
  if (item.provider === 'sec') return 'SEC';
  if (item.provider === 'dart') return 'DART';
  return String(item.provider || '—').toUpperCase();
}

export default function DisclosuresScreen() {
  const { symbol: symbolParam } = useLocalSearchParams<{ symbol?: string | string[] }>();
  const symbolFilter = useMemo(
    () => String(Array.isArray(symbolParam) ? symbolParam[0] : symbolParam || '').trim().toUpperCase(),
    [symbolParam],
  );
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const { useTwoPane } = useResponsiveLayout();
  const { setSubTabs, clearSubTabs } = useSidebarSubTabs();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const [filter, setFilter] = useState<FilterKey>('us');
  const [typeFilter, setTypeFilter] = useState<DisclosureTypeFilterKey>('all');
  const [items, setItems] = useState<SignalApiDisclosure[]>([]);
  const [digestItems, setDigestItems] = useState<SignalApiDisclosureDigestItem[]>([]);
  const [digestLoading, setDigestLoading] = useState(false);
  const [selectedDisclosureId, setSelectedDisclosureId] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const digestItemsRef = useRef<SignalApiDisclosureDigestItem[]>([]);
  const watchlistRef = useRef<string[]>([]);
  const hasInitialLoadRef = useRef(false);
  const loadSeqRef = useRef(0);
  digestItemsRef.current = digestItems;
  watchlistRef.current = watchlist;

  const { ref: listRef, scrollToTop } = useScrollToTopOnChange([filter, typeFilter, symbolFilter]);

  const currentQuery = useMemo<ListQuery>(
    () => ({ filter, typeFilter, symbolFilter }),
    [filter, symbolFilter, typeFilter],
  );

  const loadDigests = useCallback(async (refresh?: boolean) => {
    if (!hasSignalApi() || symbolFilter) return;
    if (digestItemsRef.current.length === 0) setDigestLoading(true);
    try {
      const market =
        filter === 'us' ? 'us' : filter === 'kr' ? 'kr' : undefined;
      const page = await fetchSignalDisclosureDigests(
        {
          market,
          limit: 16,
          batches: 1,
        },
        { cacheMode: signalCacheMode(refresh) },
      );
      setDigestItems(page.items);
    } catch {
      // 다이제스트 실패해도 리스트는 보여줌
    } finally {
      setDigestLoading(false);
    }
  }, [filter, symbolFilter]);

  const queryDisclosureList = useCallback(
    async (query: ListQuery, refresh?: boolean): Promise<SignalApiDisclosure[]> => {
      if (!hasSignalApi()) {
        throw new Error(t('errorSignalApiShort'));
      }

      let watch = watchlistRef.current;
      if (query.filter === 'watch') {
        watch = await loadWatchlistSymbols();
        watchlistRef.current = watch;
        setWatchlist(watch);
      }

      const market = query.symbolFilter
        ? undefined
        : query.filter === 'us'
          ? 'us'
          : query.filter === 'kr'
            ? 'kr'
            : undefined;
      const symbols =
        query.symbolFilter || (query.filter === 'watch' ? watch.join(',') : undefined);
      const page = await fetchSignalDisclosures(
        {
          market,
          symbols,
          typeCategory: typeCategoryApiParam(query.typeFilter),
          limit: 60,
        },
        { cacheMode: signalCacheMode(refresh) },
      );
      return page.items;
    },
    [t],
  );

  useEffect(() => {
    void loadDigests();
  }, [loadDigests]);

  useEffect(() => {
    const query = currentQuery;

    let cancelled = false;
    const seq = ++loadSeqRef.current;
    if (!hasInitialLoadRef.current) setLoading(true);

    void (async () => {
      try {
        const rows = await queryDisclosureList(query);
        if (cancelled || seq !== loadSeqRef.current) return;
        setItems(rows);
        setError(null);
      } catch (e) {
        if (cancelled || seq !== loadSeqRef.current) return;
        if (!hasSignalApi()) {
          setItems([]);
        }
        setError(formatSignalApiError(e, t, 'disclosuresLoadError'));
      } finally {
        if (cancelled || seq !== loadSeqRef.current) return;
        hasInitialLoadRef.current = true;
        setLoading(false);
        setInitialLoadDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentQuery, queryDisclosureList, t]);

  useFocusEffect(
    useCallback(() => {
      if (!symbolFilter) {
        void markDisclosureFeedSeen();
      }
    }, [symbolFilter]),
  );

  const onPickTypeFilter = useCallback((key: DisclosureTypeFilterKey) => {
    if (typeFilter === key) return;
    setTypeFilter(key);
  }, [typeFilter]);

  const typeScope = useMemo(
    () => resolveDisclosureTypeScope({ marketFilter: filter, symbolFilter }),
    [filter, symbolFilter],
  );
  const typeFilterOptions = useMemo(
    () => [...disclosureTypeFiltersForScope(typeScope)],
    [typeScope],
  );

  useEffect(() => {
    if (typeFilter === 'all') return;
    if (!typeFilterOptions.includes(typeFilter)) {
      setTypeFilter('all');
    }
  }, [typeFilter, typeFilterOptions]);

  useEffect(() => {
    if (!useTwoPane) return;
    if (!items.length) {
      setSelectedDisclosureId(null);
      return;
    }
    if (!selectedDisclosureId || !items.some((item) => item.id === selectedDisclosureId)) {
      setSelectedDisclosureId(items[0].id);
    }
  }, [items, selectedDisclosureId, useTwoPane]);

  const onRefreshBase = useCallback(async () => {
    const prevIds = new Set(items.map((item) => item.id));
    setRefreshing(true);
    setRefreshNotice(null);
    const seq = ++loadSeqRef.current;
    const query = currentQuery;
    try {
      const latest = await queryDisclosureList(query, true);
      if (seq !== loadSeqRef.current) return;
      setItems(latest);
      setError(null);
      await loadDigests(true);
      const latestIds = latest.map((item) => item.id);
      const newCount = latestIds.filter((id) => !prevIds.has(id)).length;
      if (newCount > 0) {
        setRefreshNotice(t('disclosuresRefreshNotice', { count: String(newCount) }));
      }
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(formatSignalApiError(e, t, 'disclosuresLoadError'));
    } finally {
      if (seq === loadSeqRef.current) {
        setRefreshing(false);
      }
    }
  }, [currentQuery, items, loadDigests, queryDisclosureList, t]);

  const onRefresh = useRefreshWithScrollToTop(onRefreshBase, scrollToTop);

  const onPickFilter = useCallback(
    (key: FilterKey) => {
      if (filter === key) return;
      setError(null);
      setRefreshNotice(null);
      setTypeFilter('all');
      setFilter(key);
    },
    [filter],
  );

  useTabPressCycleSegment(symbolFilter ? null : filter, FILTER_ORDER, onPickFilter);

  useFocusEffect(
    useCallback(() => {
      if (!useTwoPane || symbolFilter) return;
      setSubTabs(
        FILTERS.map((item) => ({
          key: item.key,
          label: t(item.label),
          active: filter === item.key,
          onPress: () => onPickFilter(item.key),
        })),
      );
      return () => clearSubTabs();
    }, [clearSubTabs, filter, onPickFilter, setSubTabs, symbolFilter, t, useTwoPane]),
  );

  const clearSymbolFilter = useCallback(() => {
    router.setParams({ symbol: undefined });
  }, [router]);

  const emptyText =
    filter === 'watch' && watchlist.length === 0
      ? t('symbolDetailNoDisclosures')
      : typeFilter !== 'all'
        ? t('disclosuresEmptyType')
        : t('disclosuresEmpty');

  const selectedDisclosure = useMemo(
    () => items.find((item) => item.id === selectedDisclosureId) ?? null,
    [items, selectedDisclosureId],
  );

  const bottomPad = tabScreenScrollBottomPadding(tabBarHeight, insets.bottom);
  const fabStackBottomOffset = fabStackBottom(tabBarHeight, insets.bottom);

  const listHeaderEl = useMemo(
    () => (
      <View style={[styles.listHeader, useTwoPane && styles.listHeaderWide]}>
        {!symbolFilter && filter !== 'watch' && digestItems.length > 0 ? (
          <DisclosureDigestSection items={digestItems} loading={digestLoading && digestItems.length === 0} />
        ) : null}
        {symbolFilter ? (
          <View style={styles.symbolFilterRow}>
            <Text style={styles.symbolFilterText} numberOfLines={1}>
              {symbolFilter}
            </Text>
            <Pressable
              onPress={clearSymbolFilter}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('feedTagFilterClear')}>
              <Text style={styles.symbolFilterClear}>{t('feedTagFilterClear')}</Text>
            </Pressable>
          </View>
        ) : null}
        {typeFilterOptions.length > 0 ? (
          <View style={styles.typeFilterRow}>
            <Pressable
              onPress={() => onPickTypeFilter('all')}
              style={[styles.typeFilterChip, typeFilter === 'all' && styles.typeFilterChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: typeFilter === 'all' }}>
              <Text style={[styles.typeFilterText, typeFilter === 'all' && styles.typeFilterTextActive]}>
                {t('disclosuresFilterAll')}
              </Text>
            </Pressable>
            {typeFilterOptions.map((key) => {
              const active = typeFilter === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => onPickTypeFilter(key)}
                  style={[styles.typeFilterChip, active && styles.typeFilterChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}>
                  <Text style={[styles.typeFilterText, active && styles.typeFilterTextActive]}>
                    {t(disclosureTypeFilterLabelId(key))}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    ),
    [clearSymbolFilter, digestItems, digestLoading, error, filter, onPickTypeFilter, styles, symbolFilter, t, typeFilter, typeFilterOptions, useTwoPane],
  );

  const renderDisclosureCard = useCallback(
    ({ item }: { item: SignalApiDisclosure }) => {
      const selected = useTwoPane && selectedDisclosureId === item.id;
      return (
        <Pressable
          style={({ pressed }) => [
            styles.card,
            selected && styles.cardSelected,
            pressed && styles.cardPressed,
          ]}
          onPress={() => {
            if (useTwoPane) {
              setSelectedDisclosureId(item.id);
              return;
            }
            router.push(`/disclosures/${encodeURIComponent(item.id)}` as Href);
          }}>
          <View style={styles.cardTop}>
            <View style={styles.badges}>
              <Text style={styles.badge}>{providerLabel(item)}</Text>
              {item.formType ? <Text style={styles.badgeMuted}>{item.formType}</Text> : null}
            </View>
            <Text style={styles.time}>{disclosureTime(item, locale)}</Text>
          </View>
          <Text style={styles.cardTitle}>{item.title}</Text>
          {item.summary ? (
            <Text style={styles.summary} numberOfLines={useTwoPane ? 2 : 3}>
              {item.summary}
            </Text>
          ) : null}
          <View style={styles.cardBottom}>
            <Text style={styles.symbol}>{item.symbol || item.companyName || '—'}</Text>
            {item.url ? (
              <Pressable
                onPress={() => void WebBrowser.openBrowserAsync(item.url!)}
                hitSlop={10}
                style={styles.openBtn}>
                <Text style={styles.openText}>{t('disclosuresOriginalOpen')}</Text>
                <FontAwesome name="external-link" size={12} color={theme.green} />
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      );
    },
    [locale, router, selectedDisclosureId, styles, t, theme.green, useTwoPane],
  );

  const detailPaneEl = useTwoPane ? (
    <View style={styles.detailPane}>
      {selectedDisclosure ? (
        <WebWheelScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent}>
          <View style={styles.detailHero}>
            <View style={styles.badges}>
              <Text style={styles.badge}>{providerLabel(selectedDisclosure)}</Text>
              {selectedDisclosure.formType ? (
                <Text style={styles.badgeMuted}>{selectedDisclosure.formType}</Text>
              ) : null}
            </View>
            <Text style={styles.detailTitle}>{selectedDisclosure.title}</Text>
            <Text style={styles.detailCompany}>
              {selectedDisclosure.symbol || selectedDisclosure.companyName || '—'}
              {selectedDisclosure.companyName && selectedDisclosure.symbol
                ? ` · ${selectedDisclosure.companyName}`
                : ''}
            </Text>
          </View>
          <View style={styles.detailCard}>
            <View style={styles.detailFactRow}>
              <Text style={styles.detailFactLabel}>{t('disclosuresFiledAt')}</Text>
              <Text style={styles.detailFactValue}>{disclosureDate(selectedDisclosure.filedAt, locale)}</Text>
            </View>
            <View style={styles.detailFactRow}>
              <Text style={styles.detailFactLabel}>{t('disclosuresPeriodEnd')}</Text>
              <Text style={styles.detailFactValue}>
                {disclosureDate(selectedDisclosure.periodEndDate, locale)}
              </Text>
            </View>
            <View style={styles.detailFactRow}>
              <Text style={styles.detailFactLabel}>{t('disclosuresProvider')}</Text>
              <Text style={styles.detailFactValue}>{providerLabel(selectedDisclosure)}</Text>
            </View>
          </View>
          {selectedDisclosure.summary ? (
            <View style={styles.detailCard}>
              <Text style={styles.detailSectionTitle}>{t('disclosuresSummary')}</Text>
              <Text style={styles.detailSummary}>{selectedDisclosure.summary}</Text>
            </View>
          ) : null}
          {selectedDisclosure.url ? (
            <Pressable
              style={styles.detailOpenBtn}
              onPress={() => void WebBrowser.openBrowserAsync(selectedDisclosure.url!)}>
              <Text style={styles.detailOpenText}>{t('disclosuresOriginalOpen')}</Text>
              <FontAwesome name="external-link" size={13} color={theme.green} />
            </Pressable>
          ) : null}
        </WebWheelScrollView>
      ) : (
        <View style={styles.detailEmpty}>
          <Text style={styles.empty}>{emptyText}</Text>
        </View>
      )}
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={useTwoPane ? [] : ['top']}>
      {!useTwoPane ? <SignalHeader compact onBrandPress={() => void onRefresh()} /> : null}
      <View style={[styles.mainColumn, useTwoPane && styles.mainColumnWide]}>
        {!useTwoPane || refreshNotice ? <View style={styles.topFixed}>
          {refreshNotice ? <FeedUpdateBanner variant="notice" message={refreshNotice} /> : null}
          {!symbolFilter && !useTwoPane ? (
            <View style={styles.segment}>
              {FILTERS.map((f) => {
                const selected = filter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => onPickFilter(f.key)}
                    style={[styles.segBtn, selected && styles.segBtnActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}>
                    <Text style={[styles.segText, selected && styles.segTextActive]}>{t(f.label)}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View> : null}
        {!initialLoadDone && loading ? (
          <View style={styles.loadingWrap}>
            <SignalLoadingIndicator message={t('commonLoading')} />
          </View>
        ) : (
          <View style={useTwoPane ? styles.wideBody : styles.compactBody}>
            <WebWheelFlatList
              ref={listRef as never}
              data={items}
              keyExtractor={(item) => item.id}
              style={[styles.list, useTwoPane && styles.wideList]}
              contentContainerStyle={[
                useTwoPane ? styles.wideListContent : styles.listContent,
                { paddingBottom: bottomPad },
              ]}
              ListHeaderComponent={listHeaderEl}
              refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
              removeClippedSubviews={Platform.OS === 'android'}
              renderItem={renderDisclosureCard}
            />
            {detailPaneEl}
          </View>
        )}
      </View>
      {hasSignalApi() && !useTwoPane ? (
        <FloatingGlassFab
          bottom={fabStackBottomOffset}
          onPress={() => void onRefresh()}
          iconName="sync"
          accessibilityLabel={t('fabRefreshA11y')}
          disabled={refreshing}
        />
      ) : null}
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  const segmentTab = getSegmentTabBarStyles(theme, sf);
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
      paddingHorizontal: 16,
    },
    topFixed: {
      flexShrink: 0,
      zIndex: 2,
      elevation: Platform.OS === 'android' ? 2 : 0,
      paddingHorizontal: SCREEN_FIXED_HEADER_PADDING_HORIZONTAL,
      paddingTop: SCREEN_FIXED_HEADER_PADDING_TOP,
      paddingBottom: SCREEN_FIXED_HEADER_PADDING_BOTTOM,
      backgroundColor: theme.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    compactBody: { ...webFlexFill },
    wideBody: {
      ...webFlexFill,
      flexDirection: 'row',
      gap: 12,
      paddingTop: SCREEN_WIDE_CONTENT_PADDING_TOP,
    },
    list: { ...webScrollViewportStyle },
    wideList: {
      flex: 0.45,
      minWidth: 360,
    },
    listContent: { paddingHorizontal: 16, paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP },
    wideListContent: { paddingTop: 0 },
    listHeader: {
      paddingTop: SCREEN_LIST_HEADER_PADDING_TOP,
      paddingBottom: SCREEN_LIST_HEADER_PADDING_BOTTOM,
    },
    listHeaderWide: {
      paddingTop: 0,
    },
    segment: segmentTab.segment,
    segBtn: segmentTab.segBtn,
    segBtnActive: segmentTab.segBtnActive,
    segText: segmentTab.segText,
    segTextActive: segmentTab.segTextActive,
    symbolFilterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    symbolFilterText: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(12),
      fontWeight: '800',
      color: theme.text,
    },
    symbolFilterClear: {
      fontSize: sf(12),
      fontWeight: '800',
      color: theme.green,
    },
    typeFilterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 2,
      marginBottom: 12,
    },
    typeFilterChip: {
      minHeight: 32,
      paddingHorizontal: 11,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeFilterChipActive: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    typeFilterText: {
      fontSize: sf(12),
      lineHeight: sf(17),
      fontWeight: '800',
      color: theme.textDim,
    },
    typeFilterTextActive: {
      color: theme.green,
    },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    error: {
      marginBottom: 12,
      padding: 12,
      borderRadius: 12,
      color: theme.danger,
      backgroundColor: theme.dangerDim,
      fontSize: sf(13),
      fontWeight: '800',
    },
    empty: {
      padding: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.textMuted,
      backgroundColor: theme.card,
      fontSize: sf(14),
      fontWeight: '800',
      textAlign: 'center',
    },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: ft.pad(14),
      marginBottom: 10,
    },
    cardSelected: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    cardPressed: { backgroundColor: theme.bgElevated, borderColor: theme.greenBorder },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 },
    badges: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
    badge: {
      color: theme.green,
      backgroundColor: theme.greenDim,
      borderColor: theme.greenBorder,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 7,
      fontSize: ft.ff(10),
      fontWeight: ft.emphasisWeight,
      overflow: 'hidden',
    },
    badgeMuted: {
      color: theme.textMuted,
      backgroundColor: theme.bgElevated,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 7,
      fontSize: ft.ff(10),
      fontWeight: ft.emphasisWeight,
      overflow: 'hidden',
    },
    time: { color: theme.textDim, fontSize: ft.ff(11), fontWeight: ft.metaWeight },
    cardTitle: {
      color: theme.text,
      fontSize: ft.ff(15),
      lineHeight: ft.ff(21),
      fontWeight: ft.titleWeight,
    },
    summary: {
      marginTop: 7,
      color: theme.textMuted,
      fontSize: ft.ff(13),
      lineHeight: ft.ff(19),
      fontWeight: ft.bodyWeight,
    },
    cardBottom: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    symbol: { flex: 1, minWidth: 0, color: theme.textMuted, fontSize: ft.ff(12), fontWeight: ft.emphasisWeight },
    openBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    openText: { color: theme.green, fontSize: ft.ff(12), fontWeight: ft.emphasisWeight },
    detailPane: {
      flex: 0.55,
      minWidth: 0,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      overflow: 'hidden',
      marginBottom: 12,
    },
    detailScroll: { flex: 1, minHeight: 0 },
    detailScrollContent: {
      padding: 18,
      gap: 12,
    },
    detailHero: {
      gap: 10,
      paddingBottom: 4,
    },
    detailTitle: {
      color: theme.text,
      fontSize: sf(22),
      lineHeight: sf(30),
      fontWeight: '900',
    },
    detailCompany: {
      color: theme.textMuted,
      fontSize: sf(13),
      lineHeight: sf(19),
      fontWeight: '800',
    },
    detailCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      padding: 14,
      gap: 10,
    },
    detailFactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    detailFactLabel: {
      color: theme.textMuted,
      fontSize: sf(12),
      fontWeight: '800',
    },
    detailFactValue: {
      flex: 1,
      minWidth: 0,
      color: theme.text,
      fontSize: sf(13),
      fontWeight: '900',
      textAlign: 'right',
    },
    detailSectionTitle: {
      color: theme.text,
      fontSize: sf(14),
      fontWeight: '900',
    },
    detailSummary: {
      color: theme.textMuted,
      fontSize: ft.ff(14),
      lineHeight: ft.ff(21),
      fontWeight: ft.bodyWeight,
    },
    detailOpenBtn: {
      minHeight: 44,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    detailOpenText: {
      color: theme.green,
      fontSize: sf(14),
      fontWeight: '900',
    },
    detailEmpty: {
      flex: 1,
      padding: 18,
      justifyContent: 'center',
    },
  });
}
