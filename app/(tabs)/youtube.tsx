import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import { useFocusEffect } from '@react-navigation/native';

import { SignalHeader } from '@/components/signal/SignalHeader';
import { YoutubeCard } from '@/components/signal/YoutubeCard';
import { TAB_BAR_FLOAT_MARGIN_BOTTOM } from '@/constants/tabBar';
import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { hasYoutube } from '@/services/env';
import { loadSelectedChannels, saveSelectedChannels } from '@/services/youtubeChannelSelection';
import { loadCurationHandles } from '@/services/youtubeCurationList';
import { peekYoutubeCache, fetchEconomyYoutubeCached, YOUTUBE_CACHE_TTL_MS } from '@/services/youtubeCache';
import { fetchChannelDisplayNames, type ChannelHandleMeta } from '@/services/youtube';
import type { YoutubeItem } from '@/types/signal';

type SortKey = 'popular' | 'latest';

export default function YoutubeScreen() {
  const { theme } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const [sort, setSort] = useState<SortKey>('latest');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<YoutubeItem[]>([]);
  const [channelMeta, setChannelMeta] = useState<ChannelHandleMeta[]>([]);
  const [curationHandles, setCurationHandles] = useState<string[] | null>(null);
  const [selectedHandles, setSelectedHandles] = useState<string[] | null>(null);
  const [channelModalVisible, setChannelModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const curation = await loadCurationHandles();
        const [meta, saved] = await Promise.all([
          fetchChannelDisplayNames(curation),
          loadSelectedChannels(),
        ]);
        if (!cancelled) {
          setCurationHandles(curation);
          setChannelMeta(meta);
          setSelectedHandles(saved);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const load = useCallback(
    async (opts?: { forceRefresh?: boolean; channelHandles?: string[] }) => {
      setError(null);
      const handles = opts?.channelHandles ?? selectedHandles;
      if (handles === null) return;

      if (!hasYoutube()) {
        setItems([]);
        setError('EXPO_PUBLIC_YOUTUBE_API_KEY 가 필요합니다. Google Cloud에서 YouTube Data API v3를 활성화한 뒤 키를 .env에 넣으세요.');
        setLoading(false);
        return;
      }

      if (handles.length === 0) {
        setItems([]);
        setError('채널을 1개 이상 선택해 주세요.');
        setLoading(false);
        return;
      }

      const order = sort === 'popular' ? 'viewCount' : 'date';

      if (!opts?.forceRefresh) {
        const cached = peekYoutubeCache(order, handles);
        if (cached) {
          setItems(cached);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      try {
        const list = await fetchEconomyYoutubeCached(order, {
          forceRefresh: opts?.forceRefresh,
          channelHandles: handles,
        });
        setItems(list);
      } finally {
        setLoading(false);
      }
    },
    [sort, selectedHandles],
  );

  useEffect(() => {
    if (selectedHandles === null) return;
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '유튜브를 불러오지 못했습니다.');
          setItems([]);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, selectedHandles]);

  const onRefresh = useCallback(async () => {
    if (!selectedHandles?.length) return;
    setRefreshing(true);
    try {
      await load({ forceRefresh: true, channelHandles: selectedHandles });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '새로고침 실패');
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

  const filterReady = Boolean(selectedHandles && curationHandles);

  const renderChannelFilterBody = () => (
    <>
      <View style={styles.footerHead}>
        <Text style={styles.footerTitle}>포함 채널</Text>
        <Pressable onPress={selectAllChannels} style={styles.allBtn} accessibilityRole="button">
          <Text style={styles.allBtnText}>전체 선택</Text>
        </Pressable>
      </View>
      <Text style={styles.footerSub}>탭: 포함 on/off · 최소 1개</Text>
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
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 28 + tabBarHeight + TAB_BAR_FLOAT_MARGIN_BOTTOM + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />}>
        <SignalHeader />
        <Text style={styles.section}>경제 유튜브</Text>
        <Text style={styles.hint}>
          우하단 필터로 큐레이션 채널 선택 · 최신순/인기순 · {Math.round(YOUTUBE_CACHE_TTL_MS / 60000)}분 캐시
        </Text>

        <View style={styles.segment}>
          <Pressable
            onPress={() => setSort('latest')}
            style={[styles.segBtn, sort === 'latest' && styles.segBtnActive]}
            accessibilityState={{ selected: sort === 'latest' }}>
            <Text style={[styles.segText, sort === 'latest' && styles.segTextActive]}>최신순</Text>
          </Pressable>
          <Pressable
            onPress={() => setSort('popular')}
            style={[styles.segBtn, sort === 'popular' && styles.segBtnActive]}
            accessibilityState={{ selected: sort === 'popular' }}>
            <Text style={[styles.segText, sort === 'popular' && styles.segTextActive]}>인기순</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
          </View>
        ) : null}

        {loading && selectedHandles !== null ? <Text style={styles.loading}>불러오는 중…</Text> : null}

        {selectedHandles === null ? <Text style={styles.loading}>채널 설정 불러오는 중…</Text> : null}

        {!loading &&
          items.map((item) => (
            <YoutubeCard key={item.id} item={item} />
          ))}

        {!loading && items.length === 0 && !error ? (
          <Text style={styles.empty}>
            검색 결과가 없습니다. YouTube Data API v3가 프로젝트에서 사용 설정돼 있는지, 일일 쿼터가 남아 있는지 확인한 뒤 앱을 새로고침해 보세요.
          </Text>
        ) : null}

        <View style={styles.note}>
          <Text style={styles.noteText}>
            요약은 영상 설명(snippet.description)과 제목을 Claude에 넣어 생성합니다. 같은 탭·같은 채널 선택은 약 {Math.round(YOUTUBE_CACHE_TTL_MS / 60000)}분간 캐시됩니다.
          </Text>
        </View>
      </ScrollView>

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
          accessibilityLabel="큐레이션 채널 필터 열기">
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
              <Text style={styles.modalTitle}>큐레이션 채널</Text>
              <Pressable
                onPress={() => setChannelModalVisible(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="닫기">
                <Text style={styles.modalClose}>닫기</Text>
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
    scroll: { paddingHorizontal: 16, paddingBottom: 28 },
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
      backgroundColor: '#12121A',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 4,
      marginBottom: 14,
      gap: 4,
    },
    segBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segBtnActive: {
      backgroundColor: theme.green,
    },
    segText: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.textDim,
    },
    segTextActive: {
      color: '#0A0A0F',
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
    loading: { fontSize: 13, color: theme.textMuted, marginBottom: 12 },
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
