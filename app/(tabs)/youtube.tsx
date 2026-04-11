import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';

import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { YoutubeCard } from '@/components/signal/YoutubeCard';
import { SCROLL_CONTENT_LOADING_STYLE, SCROLL_LOADING_BODY_STYLE } from '@/constants/scrollLoadingLayout';
import {
  SEGMENT_TAB_ACTIVE_TEXT,
  SEGMENT_TAB_BACKGROUND,
  SEGMENT_TAB_BTN_PADDING_V,
  SEGMENT_TAB_BTN_RADIUS,
  SEGMENT_TAB_FONT_SIZE,
  SEGMENT_TAB_FONT_WEIGHT,
  SEGMENT_TAB_GAP,
  SEGMENT_TAB_LINE_HEIGHT,
  SEGMENT_TAB_OUTER_RADIUS,
  SEGMENT_TAB_PADDING,
} from '@/constants/segmentTabBar';
import { TAB_BAR_FLOAT_MARGIN_BOTTOM } from '@/constants/tabBar';
import type { AppTheme } from '@/constants/theme';
import { useResetRefreshingOnTabBlur } from '@/hooks/useResetRefreshingOnTabBlur';
import { useTabScreenLoadingRecovery } from '@/hooks/useTabScreenLoadingRecovery';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { loadCacheFeaturePrefs } from '@/services/cacheFeaturePreferences';
import { hasYoutube } from '@/services/env';
import { loadSelectedChannels, saveSelectedChannels } from '@/services/youtubeChannelSelection';
import { loadCurationHandles } from '@/services/youtubeCurationList';
import { peekYoutubeCache, fetchEconomyYoutubeCached, YOUTUBE_CACHE_TTL_MS } from '@/services/youtubeCache';
import { fetchChannelDisplayNames, YOUTUBE_ERROR_QUOTA, type ChannelHandleMeta } from '@/services/youtube';
import type { YoutubeItem } from '@/types/signal';
import { shouldShowTabScrollFullScreenLoading } from '@/utils/tabScrollLoadingGate';
import {
  msUntilNextPacificMidnight,
  quotaResetHoursMinutes,
  YOUTUBE_DATA_API_QUOTAS_CONSOLE_URL,
} from '@/utils/youtubeQuota';

type SortKey = 'popular' | 'latest';

/** 채널 배열이 동일하면 상태 갱신·load 재실행을 막기 위한 키 (탭 복귀 시 매번 새 배열 참조 방지) */
function normalizeHandlesKey(handles: string[]): string {
  return [...handles].map((h) => h.trim().toLowerCase()).sort().join('\0');
}

export default function YoutubeScreen() {
  const { t } = useLocale();
  const { theme } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [sort, setSort] = useState<SortKey>('latest');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [quotaResetMs, setQuotaResetMs] = useState(() => msUntilNextPacificMidnight());
  const [items, setItems] = useState<YoutubeItem[]>([]);
  const [channelMeta, setChannelMeta] = useState<ChannelHandleMeta[]>([]);
  const [curationHandles, setCurationHandles] = useState<string[] | null>(null);
  const [selectedHandles, setSelectedHandles] = useState<string[] | null>(null);
  const [channelModalVisible, setChannelModalVisible] = useState(false);
  /** load() 안에서 이미 화면에 목록이 있는지 — 캐시 재적중 시 전체 로딩 스킵 */
  const itemsRef = useRef<YoutubeItem[]>([]);
  itemsRef.current = items;

  const youtubeCacheMinutesStr = useMemo(() => String(Math.round(YOUTUBE_CACHE_TTL_MS / 60000)), []);
  const youtubeScreenHintLine = useMemo(
    () => t('youtubeScreenHint', { minutes: youtubeCacheMinutesStr }),
    [t, youtubeCacheMinutesStr],
  );
  const youtubeAiCacheHintLine = useMemo(
    () => t('youtubeAiCacheHint', { minutes: youtubeCacheMinutesStr }),
    [t, youtubeCacheMinutesStr],
  );

  useTabScreenLoadingRecovery(items, setLoading);

  useFocusEffect(
    useCallback(() => {
      /**
       * 탭 이탈 시 cancelled 로 setState 를 건너뛰면 selectedHandles 가 영구 null 이 되거나
       * 채널 로드가 끝나도 반영되지 않아 본문이 비는 경우가 있음 → 완료 시 항상 반영.
       */
      void (async () => {
        const curation = await loadCurationHandles();
        const [meta, saved] = await Promise.all([
          fetchChannelDisplayNames(curation),
          loadSelectedChannels(),
        ]);
        setCurationHandles((prev) => {
          if (prev !== null && normalizeHandlesKey(prev) === normalizeHandlesKey(curation)) {
            return prev;
          }
          return curation;
        });
        setChannelMeta(meta);
        setSelectedHandles((prev) => {
          if (prev !== null && normalizeHandlesKey(prev) === normalizeHandlesKey(saved)) {
            return prev;
          }
          return saved;
        });
      })();
    }, []),
  );

  const applyLoadError = useCallback(
    (e: unknown, fallbackId: 'youtubeErrorLoad' | 'youtubeErrorRefresh') => {
      const quota = e instanceof Error && e.message === YOUTUBE_ERROR_QUOTA;
      setIsQuotaError(quota);
      const msg =
        e instanceof Error
          ? quota
            ? t('youtubeErrorQuota')
            : e.message
          : t(fallbackId);
      setError(msg);
    },
    [t],
  );

  useEffect(() => {
    if (!isQuotaError) return;
    const tick = () => setQuotaResetMs(msUntilNextPacificMidnight());
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [isQuotaError]);

  const load = useCallback(
    async (opts?: {
      forceRefresh?: boolean;
      channelHandles?: string[];
      errorFallback?: 'youtubeErrorLoad' | 'youtubeErrorRefresh';
    }) => {
      setError(null);
      setIsQuotaError(false);
      const handles = opts?.channelHandles ?? selectedHandles;
      if (handles === null) return;

      if (!hasYoutube()) {
        setItems([]);
        setIsQuotaError(false);
        setError(t('youtubeErrorKeyMissing'));
        setLoading(false);
        return;
      }

      if (handles.length === 0) {
        setItems([]);
        setIsQuotaError(false);
        setError(t('youtubeErrorSelectChannel'));
        setLoading(false);
        return;
      }

      const order = sort === 'popular' ? 'viewCount' : 'date';
      const errKey = opts?.errorFallback ?? 'youtubeErrorLoad';

      const hadItems = itemsRef.current.length > 0;
      if (!hadItems) {
        setLoading(true);
      }
      try {
        const { youtubeEnabled } = await loadCacheFeaturePrefs();
        if (!opts?.forceRefresh && youtubeEnabled) {
          const cached = peekYoutubeCache(order, handles);
          if (cached) {
            setItems(cached);
            return;
          }
        }
        if (hadItems) {
          setLoading(true);
        }
        const list = await fetchEconomyYoutubeCached(order, {
          forceRefresh: opts?.forceRefresh,
          channelHandles: handles,
          cacheEnabled: youtubeEnabled,
        });
        setItems(list);
      } catch (e) {
        applyLoadError(e, errKey);
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [sort, selectedHandles, t, applyLoadError],
  );

  useEffect(() => {
    if (selectedHandles === null) return;
    void load();
  }, [load, selectedHandles]);

  const onRefresh = useCallback(async () => {
    if (!selectedHandles?.length) return;
    setRefreshing(true);
    try {
      await load({
        forceRefresh: true,
        channelHandles: selectedHandles,
        errorFallback: 'youtubeErrorRefresh',
      });
    } finally {
      setRefreshing(false);
    }
  }, [load, selectedHandles]);

  const toggleChannel = useCallback(
    async (handle: string) => {
      if (!selectedHandles) return;
      let next: string[];
      if (selectedHandles.includes(handle)) {
        if (selectedHandles.length <= 1) return;
        next = selectedHandles.filter((h) => h !== handle);
      } else {
        next = [...selectedHandles, handle];
      }
      setSelectedHandles(next);
      await saveSelectedChannels(next);
      await load({ forceRefresh: true, channelHandles: next });
    },
    [selectedHandles, load],
  );

  const selectAllChannels = useCallback(async () => {
    if (!curationHandles?.length) return;
    const next = [...curationHandles];
    setSelectedHandles(next);
    await saveSelectedChannels(next);
    await load({ forceRefresh: true, channelHandles: next });
  }, [load, curationHandles]);

  const titleForHandle = (handle: string) =>
    channelMeta.find((c) => c.handle === handle)?.title ?? `@${handle}`;

  const quotaResetHintLine = useMemo(() => {
    const { hours, minutes } = quotaResetHoursMinutes(quotaResetMs);
    if (hours === 0 && minutes === 0) return t('youtubeErrorQuotaResetImminent');
    return t('youtubeErrorQuotaResetHint', { hours, minutes });
  }, [quotaResetMs, t]);

  const filterReady = Boolean(selectedHandles && curationHandles);
  /**
   * 채널 부트스트랩 전: 목록이 있으면 가리지 않음(탭 복귀·경합).
   * 채널 준비 후: 캐시 없이 최신↔인기 전환·강제 새로고침 등으로 `loading`이면 스크롤 영역에 로딩(이미 카드가 있어도 표시).
   */
  const showScrollLoading =
    selectedHandles === null
      ? shouldShowTabScrollFullScreenLoading({
          itemsLength: items.length,
          loading,
          awaitingBootstrap: true,
        })
      : loading;

  const renderChannelFilterBody = () => (
    <>
      <View style={styles.footerHead}>
        <Text style={styles.footerTitle}>{t('youtubeFooterIncluded')}</Text>
        <Pressable onPress={selectAllChannels} style={styles.allBtn} accessibilityRole="button">
          <Text style={styles.allBtnText}>{t('youtubeFooterSelectAll')}</Text>
        </Pressable>
      </View>
      <Text style={styles.footerSub}>{t('youtubeFooterSub')}</Text>
      {selectedHandles &&
        curationHandles &&
        curationHandles.map((handle) => {
          const on = selectedHandles.includes(handle);
          return (
            <Pressable
              key={handle}
              onPress={() => void toggleChannel(handle)}
              style={[styles.channelRow, on && styles.channelRowOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}>
              <FontAwesome
                name={on ? 'check-square' : 'square-o'}
                size={15}
                color={on ? theme.green : theme.textDim}
                style={styles.checkIcon}
              />
              <Text style={[styles.channelName, !on && styles.channelNameOff]} numberOfLines={1}>
                {titleForHandle(handle)}
              </Text>
            </Pressable>
          );
        })}
    </>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SignalHeader />
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={styles.mainColumn}>
        <View style={styles.topFixed}>
          <Text style={styles.section}>{t('youtubeScreenTitle')}</Text>
          <Text style={styles.hint}>{youtubeScreenHintLine}</Text>

          <View style={styles.segment}>
            <Pressable
              onPress={() => setSort('latest')}
              style={[styles.segBtn, sort === 'latest' && styles.segBtnActive]}
              accessibilityState={{ selected: sort === 'latest' }}>
              <Text style={[styles.segText, sort === 'latest' && styles.segTextActive]}>
                {t('youtubeSortLatest')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSort('popular')}
              style={[styles.segBtn, sort === 'popular' && styles.segBtnActive]}
              accessibilityState={{ selected: sort === 'popular' }}>
              <Text style={[styles.segText, sort === 'popular' && styles.segTextActive]}>
                {t('youtubeSortPopular')}
              </Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          removeClippedSubviews={false}
          contentContainerStyle={[
            styles.scrollContent,
            showScrollLoading ? SCROLL_CONTENT_LOADING_STYLE : null,
            { paddingBottom: 28 + tabBarHeight + TAB_BAR_FLOAT_MARGIN_BOTTOM + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            showScrollLoading ? undefined : (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />
            )
          }>
          {showScrollLoading ? (
            <View style={SCROLL_LOADING_BODY_STYLE}>
              <SignalLoadingIndicator message={t('commonLoading')} />
            </View>
          ) : (
            <>
              {error ? (
                <View style={styles.errBox}>
                  <Text style={styles.errText}>{error}</Text>
                  {isQuotaError ? (
                    <>
                      <Text style={styles.errSub}>{quotaResetHintLine}</Text>
                      <Pressable
                        onPress={() => void Linking.openURL(YOUTUBE_DATA_API_QUOTAS_CONSOLE_URL)}
                        style={({ pressed }) => [styles.errLinkWrap, pressed && { opacity: 0.85 }]}
                        accessibilityRole="link"
                        accessibilityLabel={t('youtubeErrorQuotaConsoleLink')}>
                        <Text style={styles.errLink}>{t('youtubeErrorQuotaConsoleLink')}</Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              ) : null}

              {items.map((item) => (
                <YoutubeCard key={item.id} item={item} />
              ))}

              {!error && items.length === 0 ? (
                <Text style={styles.empty}>{t('youtubeEmptySearch')}</Text>
              ) : null}

              <View style={styles.note}>
                <Text style={styles.noteText}>{youtubeAiCacheHintLine}</Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>

      {filterReady ? (
        <Pressable
          onPress={() => setChannelModalVisible(true)}
          style={({ pressed }) => [
            styles.filterFab,
            {
              bottom: tabBarHeight + TAB_BAR_FLOAT_MARGIN_BOTTOM + insets.bottom + 8,
            },
            pressed && styles.filterFabPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('a11yYoutubeFilter')}>
          {Platform.OS === 'web' ? (
            <View style={styles.filterFabBlurFallback} />
          ) : (
            <BlurView
              intensity={Platform.OS === 'ios' ? 100 : 85}
              tint="dark"
              experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View pointerEvents="none" style={styles.filterFabRing} />
          <FontAwesome name="filter" size={19} color={theme.green} />
        </Pressable>
      ) : null}

      <Modal
        animationType="slide"
        transparent
        visible={channelModalVisible}
        onRequestClose={() => setChannelModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setChannelModalVisible(false)} />
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <View style={styles.modalGrab} />
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{t('youtubeModalTitle')}</Text>
              <Pressable
                onPress={() => setChannelModalVisible(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={t('youtubeModalClose')}>
                <Text style={styles.modalClose}>{t('youtubeModalClose')}</Text>
              </Pressable>
            </View>
            <ScrollView
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {renderChannelFilterBody()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    mainColumn: { flex: 1, minHeight: 0 },
    topFixed: {
      flexShrink: 0,
      paddingHorizontal: 16,
      paddingTop: 8,
      backgroundColor: theme.bg,
    },
    scrollView: { flex: 1, minHeight: 0 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 28 },
    section: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 4 },
    hint: { fontSize: 11, color: theme.textDim, marginBottom: 10 },
    filterFab: {
      position: 'absolute',
      right: 16,
      width: 52,
      height: 52,
      borderRadius: 26,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 10,
    },
    filterFabBlurFallback: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(10,10,15,0.88)',
      borderRadius: 26,
    },
    filterFabRing: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 26,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    filterFabPressed: {
      opacity: 0.9,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: theme.bg,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.border,
      paddingHorizontal: 16,
      maxHeight: '78%',
    },
    modalGrab: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      marginTop: 10,
      marginBottom: 6,
    },
    modalHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      paddingTop: 4,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: theme.text,
    },
    modalClose: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.green,
    },
    modalScroll: {
      flexGrow: 0,
    },
    footerHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 3,
    },
    footerTitle: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.textMuted,
      letterSpacing: 0.15,
    },
    allBtn: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    allBtnText: {
      fontSize: 10,
      fontWeight: '800',
      color: theme.green,
    },
    footerSub: {
      fontSize: 9,
      color: theme.textDim,
      marginBottom: 6,
      lineHeight: 12,
    },
    channelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 5,
      paddingHorizontal: 8,
      marginBottom: 3,
      borderRadius: 7,
      backgroundColor: '#14141C',
      borderWidth: 1,
      borderColor: theme.border,
    },
    channelRowOn: {
      borderColor: theme.green + '66',
      backgroundColor: theme.greenDim,
    },
    checkIcon: {
      marginRight: 7,
    },
    channelName: {
      flex: 1,
      fontSize: 11,
      fontWeight: '600',
      color: theme.text,
      lineHeight: 14,
    },
    channelNameOff: {
      color: theme.textDim,
      fontWeight: '500',
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: SEGMENT_TAB_BACKGROUND,
      borderRadius: SEGMENT_TAB_OUTER_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: SEGMENT_TAB_PADDING,
      marginBottom: 14,
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
      fontSize: SEGMENT_TAB_FONT_SIZE,
      lineHeight: SEGMENT_TAB_LINE_HEIGHT,
      fontWeight: SEGMENT_TAB_FONT_WEIGHT,
      color: theme.textDim,
    },
    segTextActive: {
      color: SEGMENT_TAB_ACTIVE_TEXT,
    },
    errBox: {
      padding: 12,
      borderRadius: 10,
      backgroundColor: '#2A1515',
      borderWidth: 1,
      borderColor: '#553333',
      marginBottom: 12,
    },
    errText: { fontSize: 12, color: '#E0A0A0', lineHeight: 18 },
    errSub: {
      fontSize: 11,
      color: '#C89898',
      lineHeight: 16,
      marginTop: 8,
    },
    errLinkWrap: {
      alignSelf: 'flex-start',
      marginTop: 10,
    },
    errLink: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.green,
      textDecorationLine: 'underline',
    },
    empty: { fontSize: 13, color: theme.textMuted, marginTop: 8 },
    note: {
      marginTop: 6,
      padding: 12,
      borderRadius: 10,
      backgroundColor: '#12121A',
      borderWidth: 1,
      borderColor: theme.border,
    },
    noteText: {
      fontSize: 11,
      color: theme.textDim,
      lineHeight: 16,
    },
  });
}
