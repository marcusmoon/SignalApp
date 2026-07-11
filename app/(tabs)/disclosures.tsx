import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useFocusEffect, useIsFocused } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedNewContentChip } from '@/components/signal/FeedNewContentChip';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { DisclosureDigestSection } from '@/components/disclosures/DisclosureDigestSection';
import { WebWheelFlatList } from '@/components/layout/WebWheelFlatList';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH, wideContentFill } from '@/constants/responsiveLayout';
import { webFlexFill, webScrollViewportStyle, webShellBackground } from '@/constants/webLayout';
import { getScreenFixedHeaderStyles } from '@/constants/screenFixedHeader';
import {
  tabScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import {
  SCREEN_LIST_CONTENT_PADDING_TOP,
  SCREEN_LIST_HEADER_PADDING_BOTTOM,
  SCREEN_LIST_HEADER_PADDING_TOP,
} from '@/constants/segmentTabBar';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useRegisterWebHeaderRefresh } from '@/contexts/WebHeaderRefreshContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useScrollToTopOnChange } from '@/hooks';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { fetchSignalDisclosures } from '@/integrations/signal-api/disclosures';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { fetchSignalDisclosureDigests } from '@/integrations/signal-api/disclosureDigests';
import type { SignalApiDisclosure, SignalApiDisclosureDigestItem } from '@/integrations/signal-api/types';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { hasSignalApi } from '@/services/env';
import { markDisclosureFeedSeen } from '@/services/disclosureUnreadPreference';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { formatFeedItemTimeLabel } from '@/utils/date';
import type { AppLocale } from '@/locales/messages';
import { useSafeSetRouteParams } from '@/utils/safeRouteParams';

type ListQuery = {
  symbolFilter: string;
};

function disclosureTime(item: SignalApiDisclosure, locale: string): string {
  return formatFeedItemTimeLabel(item.filedAt, locale as AppLocale);
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
  const { symbol: symbolParam } = useLocalSearchParams<{
    symbol?: string | string[];
  }>();
  const symbolFilter = useMemo(
    () => String(Array.isArray(symbolParam) ? symbolParam[0] : symbolParam || '').trim().toUpperCase(),
    [symbolParam],
  );
  const router = useRouter();
  const setRouteParams = useSafeSetRouteParams();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isFocused = useIsFocused();
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const { useTwoPane } = useResponsiveLayout();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const [items, setItems] = useState<SignalApiDisclosure[]>([]);
  const [digestItems, setDigestItems] = useState<SignalApiDisclosureDigestItem[]>([]);
  const [digestLoading, setDigestLoading] = useState(false);
  const [selectedDisclosureId, setSelectedDisclosureId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newContentAvailable, setNewContentAvailable] = useState(false);
  const latestSeenIdRef = useRef<string | null>(null);
  const digestItemsRef = useRef<SignalApiDisclosureDigestItem[]>([]);
  const hasInitialLoadRef = useRef(false);
  const loadSeqRef = useRef(0);
  digestItemsRef.current = digestItems;

  const markHasNewContent = useCallback(() => {
    setNewContentAvailable(true);
  }, []);

  const clearNewContent = useCallback(() => {
    setNewContentAvailable(false);
  }, []);

  const syncLatestSeen = useCallback(
    (latestId: string | null | undefined) => {
      const id = latestId?.trim();
      if (!id) return;
      latestSeenIdRef.current = id;
      clearNewContent();
    },
    [clearNewContent],
  );

  const { ref: listRef } = useScrollToTopOnChange([symbolFilter], {
    resyncDeps: [items, digestItems],
  });
  const listScrollResetKey = symbolFilter ?? '';

  const currentQuery = useMemo<ListQuery>(() => ({ symbolFilter }), [symbolFilter]);

  const loadDigests = useCallback(async (refresh?: boolean) => {
    if (!hasSignalApi() || symbolFilter) return;
    if (digestItemsRef.current.length === 0) setDigestLoading(true);
    try {
      const page = await fetchSignalDisclosureDigests(
        {
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
  }, [symbolFilter]);

  const queryDisclosureList = useCallback(
    async (query: ListQuery, refresh?: boolean): Promise<SignalApiDisclosure[]> => {
      if (!hasSignalApi()) {
        throw new Error(t('errorSignalApiShort'));
      }

      const symbols = query.symbolFilter || undefined;
      const page = await fetchSignalDisclosures(
        {
          symbols,
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

  /** 백그라운드 폴링: 3분마다 시장별 최신 공시 ID 확인 → chip 표시 (다이제스트·리스트는 탭 시 함께 갱신) */
  useEffect(() => {
    if (symbolFilter || !hasSignalApi()) return;
    const POLL_MS = 3 * 60 * 1000;
    const poll = async () => {
      try {
        const page = await fetchSignalDisclosures({ limit: 1, offset: 0 }, { cacheMode: 'bypass' });
        const latestId = page.items[0]?.id ?? null;
        if (!latestId) return;
        const seen = latestSeenIdRef.current;
        if (!seen) return;
        if (latestId !== seen) markHasNewContent();
      } catch {
        /* ignore polling errors */
      }
    };
    const id = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(id);
  }, [markHasNewContent, symbolFilter]);

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
        syncLatestSeen(rows[0]?.id);
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
  }, [currentQuery, queryDisclosureList, syncLatestSeen, t]);

  useFocusEffect(
    useCallback(() => {
      if (!symbolFilter) {
        void markDisclosureFeedSeen();
      }
    }, [symbolFilter]),
  );

  const emptyText = t('disclosuresEmpty');

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
    setRefreshing(true);
    clearNewContent();
    const seq = ++loadSeqRef.current;
    const query = currentQuery;
    try {
      const latest = await queryDisclosureList(query, true);
      if (seq !== loadSeqRef.current) return;
      setItems(latest);
      setError(null);
      syncLatestSeen(latest[0]?.id);
      await loadDigests(true);
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(formatSignalApiError(e, t, 'disclosuresLoadError'));
    } finally {
      if (seq === loadSeqRef.current) {
        setRefreshing(false);
      }
    }
  }, [clearNewContent, currentQuery, loadDigests, queryDisclosureList, syncLatestSeen, t]);

  const onRefresh = onRefreshBase;
  useRegisterWebHeaderRefresh(() => void onRefresh());

  const clearSymbolFilter = useCallback(() => {
    setRouteParams({ symbol: undefined });
  }, [setRouteParams]);

  const emptyText = t('disclosuresEmpty');

  const selectedDisclosure = useMemo(
    () => items.find((item) => item.id === selectedDisclosureId) ?? null,
    [items, selectedDisclosureId],
  );

  const bottomPad = tabScreenScrollBottomPadding(tabBarHeight, insets.bottom);
  const showDigest = !symbolFilter;

  const listHeaderEl = useMemo(
    () => (
      <View style={styles.listHeader}>
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
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    ),
    [clearSymbolFilter, error, styles, symbolFilter, t],
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
        {!useTwoPane && showDigest ? (
          <View style={[styles.topFixed, useTwoPane && styles.topFixedWide]}>
            <DisclosureDigestSection
              items={digestItems}
              loading={digestLoading && digestItems.length === 0}
              onRefresh={() => void onRefresh()}
              refreshing={refreshing}
            />
          </View>
        ) : null}
        {!initialLoadDone && loading ? (
          <View style={styles.loadingWrap}>
            <SignalLoadingIndicator message={t('commonLoading')} />
          </View>
        ) : (
          <View style={useTwoPane ? styles.wideBody : styles.compactBody}>
            <View style={useTwoPane ? styles.listColumnWide : styles.listColumn}>
              {showDigest && useTwoPane ? (
                <View style={[styles.topFixed, styles.topFixedWide, styles.listColumnDigestStrip]}>
                  <DisclosureDigestSection
                    items={digestItems}
                    loading={digestLoading && digestItems.length === 0}
                    columns={2}
                    onRefresh={() => void onRefresh()}
                    refreshing={refreshing}
                  />
                </View>
              ) : null}
              {isFocused && !symbolFilter ? (
                <FeedNewContentChip
                  visible={newContentAvailable}
                  refreshing={refreshing}
                  message={t('feedNewContentAvailable')}
                  onPress={() => void onRefresh()}
                />
              ) : null}
              <WebWheelFlatList
                scrollResetKey={listScrollResetKey}
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
            </View>
            {detailPaneEl}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
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
    topFixed: fixedHeader.strip,
    topFixedWide: fixedHeader.stripWide,
    compactBody: { ...webFlexFill },
    listColumn: {
      ...webFlexFill,
    },
    listColumnWide: {
      flex: 0.45,
      minWidth: 360,
      minHeight: 0,
    },
    listColumnDigestStrip: {
      flexShrink: 0,
      paddingHorizontal: 0,
    },
    wideBody: {
      ...webFlexFill,
      flexDirection: 'row',
      gap: 12,
    },
    list: { ...webScrollViewportStyle },
    wideList: {
      flex: 1,
      minHeight: 0,
    },
    listContent: { paddingHorizontal: 16, paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP },
    wideListContent: {
      paddingHorizontal: 16,
      paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP,
    },
    listHeader: {
      paddingTop: SCREEN_LIST_HEADER_PADDING_TOP,
      paddingBottom: SCREEN_LIST_HEADER_PADDING_BOTTOM,
    },
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
