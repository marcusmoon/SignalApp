import { useCallback, useEffect, useMemo, useState } from 'react';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { TAB_BAR_FLOAT_MARGIN_BOTTOM } from '@/constants/tabBar';
import type { AppTheme } from '@/constants/theme';
import { AdPlaceholder } from '@/components/signal/AdPlaceholder';
import { NewsCard } from '@/components/signal/NewsCard';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SkeletonFeed } from '@/components/signal/SkeletonFeed';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { hasFinnhub } from '@/services/env';
import { fetchGeneralNews } from '@/services/finnhub';
import { summarizeNewsWithClaude } from '@/services/anthropic';
import type { NewsItem } from '@/types/signal';

export default function FeedScreen() {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<NewsItem[]>([]);

  const load = useCallback(async () => {
    setError(null);
    if (!hasFinnhub()) {
      setItems([]);
      setError(t('feedErrorToken'));
      return;
    }
    const raw = await fetchGeneralNews();
    const slice = raw.slice(0, 12);
    const summarized = await summarizeNewsWithClaude(slice);
    setItems(summarized);
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('feedErrorLoad'));
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
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('feedErrorRefresh'));
    } finally {
      setRefreshing(false);
    }
  }, [load, t]);

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
        <Text style={styles.section}>{t('feedSectionTitle')}</Text>
        <Text style={styles.hint}>{t('feedHint')}</Text>

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <>
            <SkeletonFeed />
            <SkeletonFeed />
            <SkeletonFeed />
          </>
        ) : (
          items.map((item, index) => (
            <View key={item.id}>
              <NewsCard item={item} />
              {(index + 1) % 5 === 0 ? <AdPlaceholder /> : null}
            </View>
          ))
        )}

        {!loading && items.length === 0 && !error ? (
          <Text style={styles.empty}>{t('feedEmpty')}</Text>
        ) : null}

        {!loading ? (
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>{t('feedDisclaimer')}</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    scroll: {
      paddingHorizontal: 16,
      paddingBottom: 28,
    },
    section: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 4,
    },
    hint: {
      fontSize: 11,
      color: theme.textDim,
      marginBottom: 12,
    },
    errBox: {
      padding: 12,
      borderRadius: 10,
      backgroundColor: '#2A1515',
      borderWidth: 1,
      borderColor: '#553333',
      marginBottom: 12,
    },
    errText: {
      fontSize: 12,
      color: '#E0A0A0',
      lineHeight: 18,
    },
    empty: {
      fontSize: 13,
      color: theme.textMuted,
      marginTop: 8,
    },
    disclaimer: {
      marginTop: 8,
      padding: 12,
      borderRadius: 10,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    disclaimerText: {
      fontSize: 11,
      color: theme.textDim,
      lineHeight: 16,
    },
  });
}
