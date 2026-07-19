import { Stack, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { signalDrillStackOptions } from '@/components/layout/signalDrillStackOptions';
import { WebWheelFlatList } from '@/components/layout/WebWheelFlatList';
import { ChangeTintedText } from '@/components/signal/ChangeTintedText';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import {
  SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL,
  SCREEN_EMBEDDED_WIDE_PADDING_TOP,
  SCREEN_LIST_CONTENT_PADDING_TOP,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { useIpadSidebarNavActions } from '@/contexts/IpadSidebarNavContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useScrollToTopOnChange } from '@/hooks/useScrollToTopOnChange';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { fetchSignalEtfInsightsPage } from '@/integrations/signal-api/etfInsights';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiEtfInsight } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { formatFeedItemTimeLabel, formatLocalYmdLabel } from '@/utils/date';

const PAGE_SIZE = 20;

export type EtfInsightsListContentProps = {
  embedded?: boolean;
  onBack?: () => void;
};

export function EtfInsightsListContent({ embedded = false, onBack }: EtfInsightsListContentProps) {
  const router = useRouter();
  const ipadNav = useIpadSidebarNavActions();
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo, embedded),
    [theme, scaleFont, feedTypo, embedded],
  );
  const [items, setItems] = useState<SignalApiEtfInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(0);
  const [error, setError] = useState<string | null>(null);
  const { ref: listRef } = useScrollToTopOnChange([], { resyncDeps: [items, loading] });

  const load = useCallback(
    async (forceRefresh?: boolean) => {
      if (!hasSignalApi()) {
        setItems([]);
        setError(t('errorSignalApiShort'));
        setLoading(false);
        return;
      }
      setError(null);
      try {
        const page = await fetchSignalEtfInsightsPage(
          { limit: PAGE_SIZE, offset: 0 },
          { cacheMode: signalCacheMode(forceRefresh) },
        );
        setItems(page.items);
        setHasMore(page.meta.hasMore === true);
        setNextOffset(page.meta.nextOffset);
      } catch (e) {
        setError(formatSignalApiError(e, t, 'etfInsightLoadError'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const onEndReached = useCallback(async () => {
    if (!hasMore || loadingMore || nextOffset == null) return;
    setLoadingMore(true);
    try {
      const page = await fetchSignalEtfInsightsPage(
        { limit: PAGE_SIZE, offset: nextOffset },
        { cacheMode: 'bypass' },
      );
      setItems((prev) => {
        const seen = new Set(prev.map((row) => row.id));
        return [...prev, ...page.items.filter((row) => !seen.has(row.id))];
      });
      setHasMore(page.meta.hasMore === true);
      setNextOffset(page.meta.nextOffset);
    } catch {
      // keep existing list
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, nextOffset]);

  const openDetail = useCallback(
    (row: SignalApiEtfInsight) => {
      if (ipadNav.isAvailable) {
        // List is the wide root (or home drill); detail should return to the list.
        ipadNav.showEtfInsight(row.id, { drillFrom: 'etfInsights' });
        return;
      }
      router.push({
        pathname: '/etf-insight',
        params: { id: row.id },
      } as Href);
    },
    [ipadNav, router],
  );

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['bottom']}>
      {!embedded ? (
        <Stack.Screen
          options={signalDrillStackOptions({
            title: t('homeEtfInsightTitle'),
            onBack: () => router.back(),
          })}
        />
      ) : null}
      {onBack ? <WideSubpaneHeader title={t('homeEtfInsightTitle')} onBack={onBack} /> : null}
      {loading ? (
        <View style={styles.loadingWrap}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : (
        <WebWheelFlatList
          ref={listRef as never}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          onEndReached={() => void onEndReached()}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !error ? <Text style={styles.emptyText}>{t('etfInsightListEmpty')}</Text> : null
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={theme.green} />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const dateLabel = item.insightDate
              ? formatLocalYmdLabel(item.insightDate, locale, {
                  month: 'short',
                  day: 'numeric',
                  weekday: 'short',
                })
              : '';
            const timeLabel = formatFeedItemTimeLabel(item.publishedAt, locale);
            return (
              <Pressable
                onPress={() => openDetail(item)}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                {dateLabel ? <Text style={styles.cardMeta}>{dateLabel}</Text> : null}
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.summary?.trim() ? (
                  <ChangeTintedText style={styles.cardSummary} numberOfLines={3}>
                    {item.summary.trim()}
                  </ChangeTintedText>
                ) : null}
                {timeLabel ? <Text style={styles.cardTime}>{timeLabel}</Text> : null}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

export default function EtfInsightsScreen() {
  const { useTwoPane } = useResponsiveLayout();
  if (useTwoPane) {
    return <WideOverlayRouteRedirect kind="etf-insights" />;
  }
  return <EtfInsightsListContent />;
}

function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
  embedded: boolean,
) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      flexGrow: 1,
      paddingHorizontal: embedded ? SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL : 16,
      paddingTop: embedded ? SCREEN_EMBEDDED_WIDE_PADDING_TOP : SCREEN_LIST_CONTENT_PADDING_TOP,
      paddingBottom: 28,
      gap: 10,
      maxWidth: embedded ? APP_WIDE_CONTENT_MAX_WIDTH : APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      width: '100%',
    },
    card: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 6,
    },
    pressed: {
      opacity: 0.88,
    },
    cardMeta: {
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: '600',
      color: theme.textDim,
    },
    cardTitle: {
      fontSize: ft.ff(15),
      lineHeight: sf(22),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    cardSummary: {
      fontSize: ft.ff(13),
      lineHeight: sf(19),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
    },
    cardTime: {
      marginTop: 2,
      fontSize: sf(11),
      lineHeight: sf(15),
      color: theme.textDim,
    },
    emptyText: {
      fontSize: ft.ff(13),
      lineHeight: sf(19),
      color: theme.textDim,
      textAlign: 'center',
      paddingVertical: 40,
    },
    errorBox: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.danger,
      backgroundColor: theme.dangerDim,
      padding: 12,
      marginBottom: 8,
    },
    errorText: {
      fontSize: sf(13),
      lineHeight: sf(18),
      fontWeight: '600',
      color: theme.danger,
    },
    footerLoading: {
      paddingVertical: 16,
      alignItems: 'center',
    },
  });
}
