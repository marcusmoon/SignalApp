import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { hasFinnhub } from '@/services/env';
import { fetchCalendarEventsMerged } from '@/services/finnhub';
import { SignalBannerAd } from '@/components/signal/SignalBannerAd';
import type { CalendarEvent } from '@/types/signal';

const typeLabel: Record<string, string> = {
  earnings: '실적',
  macro: '지표',
  fed: 'Fed',
};

export default function CalendarScreen() {
  const { theme } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const typeColor = useMemo(
    () => ({
      earnings: theme.green,
      macro: theme.accentBlue,
      fed: theme.accentOrange,
    }),
    [theme],
  );

  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  const load = useCallback(async () => {
    setError(null);
    if (!hasFinnhub()) {
      setEvents([]);
      setError('EXPO_PUBLIC_FINNHUB_TOKEN 이 필요합니다.');
      return;
    }
    const list = await fetchCalendarEventsMerged(14);
    setEvents(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '캘린더를 불러오지 못했습니다.');
          setEvents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '새로고침 실패');
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 28 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />}>
        <Text style={styles.hint}>Finnhub 실적 · 경제지표 (무료 플랜은 일부 비어 있을 수 있음)</Text>

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <Text style={styles.loading}>불러오는 중…</Text>
        ) : (
          events.map((ev) => (
            <View key={ev.id} style={styles.card}>
              <View style={styles.row}>
                <View style={[styles.badge, { borderColor: typeColor[ev.type] + '55' }]}>
                  <Text style={[styles.badgeText, { color: typeColor[ev.type] }]}>{typeLabel[ev.type]}</Text>
                </View>
                <Text style={styles.time}>{ev.time}</Text>
              </View>
              <Text style={styles.date}>{ev.date}</Text>
              <Text style={styles.title}>{ev.title}</Text>
            </View>
          ))
        )}

        {!loading && events.length === 0 && !error ? (
          <Text style={styles.empty}>표시할 일정이 없습니다.</Text>
        ) : null}

        <SignalBannerAd />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 },
    hint: { fontSize: 11, color: theme.textDim, marginBottom: 12 },
    loading: { fontSize: 13, color: theme.textMuted, marginBottom: 12 },
    errBox: {
      padding: 12,
      borderRadius: 10,
      backgroundColor: '#2A1515',
      borderWidth: 1,
      borderColor: '#553333',
      marginBottom: 12,
    },
    errText: { fontSize: 12, color: '#E0A0A0', lineHeight: 18 },
    empty: { fontSize: 13, color: theme.textMuted, marginTop: 8 },
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 10,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    badge: {
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: '#14141A',
    },
    badgeText: { fontSize: 10, fontWeight: '800' },
    time: { fontSize: 11, color: theme.textMuted },
    date: { fontSize: 12, color: theme.green, fontWeight: '700', marginBottom: 4 },
    title: { fontSize: 15, fontWeight: '700', color: theme.text },
  });
}
