import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_FLOAT_MARGIN_BOTTOM } from '@/constants/tabBar';
import { SignalHeader } from '@/components/signal/SignalHeader';
import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchConcallSummaries } from '@/services/concalls';
import type { ConcallSummary } from '@/types/signal';

export default function CallsScreen() {
  const { theme } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ConcallSummary[]>([]);

  const load = useCallback(async () => {
    setError(null);
    const list = await fetchConcallSummaries(3);
    setItems(list);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '컨콜 요약을 불러오지 못했습니다.');
          setItems([]);
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
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 28 + tabBarHeight + TAB_BAR_FLOAT_MARGIN_BOTTOM + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />}>
        <SignalHeader />
        <Text style={styles.section}>컨콜 요약</Text>
        <Text style={styles.hint}>
          Finnhub 실적 일정 → API Ninjas 트랜스크립트 → Claude 요약 (Ninjas·Anthropic 키 권장)
        </Text>

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
          </View>
        ) : null}

        {loading ? <Text style={styles.loading}>불러오는 중…</Text> : null}

        {!loading &&
          items.map((c) => (
            <View key={c.id} style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.ticker}>{c.ticker}</Text>
                <Text style={styles.q}>{c.quarter}</Text>
              </View>
              {c.bullets.map((b, i) => (
                <Text key={i} style={styles.bullet}>
                  · {b}
                </Text>
              ))}
              {c.guidance ? (
                <View style={styles.block}>
                  <Text style={styles.label}>가이던스</Text>
                  <Text style={styles.body}>{c.guidance}</Text>
                </View>
              ) : null}
              {c.risk ? (
                <View style={styles.block}>
                  <Text style={styles.label}>리스크</Text>
                  <Text style={styles.body}>{c.risk}</Text>
                </View>
              ) : null}
              <Text style={styles.ai}>
                {c.source === 'claude' ? 'Claude AI 요약' : '폴백 / 안내'}
              </Text>
            </View>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    scroll: { paddingHorizontal: 16, paddingBottom: 28 },
    section: { fontSize: 16, fontWeight: '800', color: theme.text, marginBottom: 4 },
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
    card: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 10,
    },
    head: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 10 },
    ticker: { fontSize: 18, fontWeight: '900', color: theme.green },
    q: { fontSize: 12, color: theme.textMuted, fontWeight: '600' },
    bullet: { fontSize: 13, color: theme.text, lineHeight: 20, marginBottom: 6 },
    block: {
      marginTop: 8,
      padding: 10,
      borderRadius: 8,
      backgroundColor: '#0E0E14',
      borderWidth: 1,
      borderColor: theme.border,
    },
    label: { fontSize: 10, fontWeight: '800', color: theme.accentBlue, marginBottom: 4 },
    body: { fontSize: 12, color: theme.textMuted, lineHeight: 18 },
    ai: { marginTop: 10, fontSize: 10, fontWeight: '700', color: theme.textDim },
  });
}
