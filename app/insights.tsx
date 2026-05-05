import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';

import { InsightCard } from '@/components/signal/InsightCard';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchSignalInsights } from '@/integrations/signal-api';
import type { SignalApiInsight } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';

const PAGE_SIZE = 20;

export default function InsightsScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const nextOffsetRef = useRef(0);
  const [items, setItems] = useState<SignalApiInsight[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hasSignalApi()) {
        setError(t('errorSignalApiShort'));
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        nextOffsetRef.current = 0;
        const { items: rows, meta } = await fetchSignalInsights({ limit: PAGE_SIZE, offset: 0 });
        if (cancelled) return;
        setItems(rows);
        nextOffsetRef.current = rows.length;
        setHasMore(meta.hasMore);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('insightListError'));
          setItems([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const loadMore = useCallback(async () => {
    if (!hasSignalApi() || !hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const off = nextOffsetRef.current;
      const { items: rows, meta } = await fetchSignalInsights({ limit: PAGE_SIZE, offset: off });
      setItems((prev) => [...prev, ...rows]);
      nextOffsetRef.current = off + rows.length;
      setHasMore(meta.hasMore);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loading, loadingMore]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      if (!hasSignalApi()) {
        setError(t('errorSignalApiShort'));
        return;
      }
      nextOffsetRef.current = 0;
      const { items: rows, meta } = await fetchSignalInsights({ limit: PAGE_SIZE, offset: 0 });
      setItems(rows);
      nextOffsetRef.current = rows.length;
      setHasMore(meta.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('insightListError'));
      setItems([]);
      setHasMore(false);
    } finally {
      setRefreshing(false);
    }
  }, [t]);

  const listFooter =
    loadingMore ? (
      <View style={styles.footerLoading}>
        <ActivityIndicator color={theme.green} />
        <Text style={styles.footerMuted}>{t('feedLoadingMore')}</Text>
      </View>
    ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <OtaUpdateBanner />
      <Text style={styles.lead}>{t('insightListLead')}</Text>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.green} />
          <Text style={styles.muted}>{t('commonLoading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.err}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <InsightCard
              insight={item}
              theme={theme}
              scaleFont={scaleFont}
              compact={false}
              onOpenUrl={(url) => void WebBrowser.openBrowserAsync(url)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />}
          ListEmptyComponent={<Text style={styles.muted}>{t('insightListEmpty')}</Text>}
          ListFooterComponent={listFooter}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.35}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    lead: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 12,
      fontSize: sf(13),
      fontWeight: '700',
      color: theme.textMuted,
      lineHeight: sf(19),
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 28,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: 24,
    },
    muted: {
      fontSize: sf(13),
      color: theme.textMuted,
      textAlign: 'center',
    },
    err: {
      fontSize: sf(13),
      color: '#E0A0A0',
      textAlign: 'center',
      lineHeight: sf(19),
    },
    footerLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 16,
    },
    footerMuted: {
      fontSize: sf(12),
      color: theme.textMuted,
    },
  });
}
