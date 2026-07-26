import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signalDrillStackOptions } from '@/components/layout/signalDrillStackOptions';
import { WebWheelFlatList } from '@/components/layout/WebWheelFlatList';
import { ChangeTintedText } from '@/components/signal/ChangeTintedText';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { SymbolLogo } from '@/components/signal/SymbolLogo';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import {
  SCREEN_LIST_CONTENT_PADDING_TOP,
} from '@/constants/screenLayout';
import { APP_CONTENT_SIDE_PADDING } from '@/constants/responsiveLayout';
import type { AppTheme } from '@/constants/theme';
import { useIpadSidebarNavActions } from '@/contexts/IpadSidebarNavContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useQuoteChangeColors } from '@/hooks';
import { useScrollToTopOnChange } from '@/hooks/useScrollToTopOnChange';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { fetchSignalScreenerRun } from '@/integrations/signal-api/screener';
import type { SignalApiScreenerItem, SignalApiScreenerRun } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { formatFeedItemTimeLabel } from '@/utils/date';
import { formatQuoteDpPct } from '@/domain/quotes/rows';

function formatPctRatio(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function formatNum(value: number | null | undefined, digits = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export default function ScreenerScreen() {
  const router = useRouter();
  const ipadNav = useIpadSidebarNavActions();
  const params = useLocalSearchParams<{ date?: string; market?: string; method?: string }>();
  const dateParam = String(params.date || '').trim();
  const marketParam = String(params.market || 'kr').trim() || 'kr';
  const methodParam = String(params.method || 'fujimoto').trim() || 'fujimoto';
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const quoteChange = useQuoteChangeColors();
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo),
    [theme, scaleFont, feedTypo],
  );
  const [run, setRun] = useState<SignalApiScreenerRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const items = run?.items ?? [];
  const { ref: listRef } = useScrollToTopOnChange([], { resyncDeps: [items, loading] });

  const load = useCallback(
    async (forceRefresh?: boolean) => {
      if (!hasSignalApi()) {
        setRun(null);
        setError(t('errorSignalApiShort'));
        setLoading(false);
        return;
      }
      setError(null);
      try {
        const next = await fetchSignalScreenerRun(
          {
            market: marketParam,
            method: methodParam,
            date: dateParam || undefined,
          },
          { cacheMode: signalCacheMode(forceRefresh) },
        );
        setRun(next);
      } catch (e) {
        setError(formatSignalApiError(e, t, 'screenerLoadError'));
      } finally {
        setLoading(false);
      }
    },
    [dateParam, marketParam, methodParam, t],
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

  const openSymbol = useCallback(
    (row: SignalApiScreenerItem) => {
      const symbol = String(row.symbol || '').trim();
      if (!symbol) return;
      if (ipadNav.isAvailable) {
        ipadNav.showSymbol(symbol, { drillFrom: 'home' });
        return;
      }
      router.push(`/symbol/${encodeURIComponent(symbol)}` as never);
    },
    [ipadNav, router],
  );

  const title = run?.title?.trim() || t('screenerTitle');
  const timeLabel = formatFeedItemTimeLabel(run?.publishedAt || run?.generatedAt, locale);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen
        options={signalDrillStackOptions({
          title: t('screenerTitle'),
          onBack: () => router.back(),
        })}
      />
      {loading ? (
        <View style={styles.loadingWrap}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : (
        <WebWheelFlatList
          ref={listRef as never}
          data={items}
          keyExtractor={(item) => item.id || item.symbol}
          contentContainerStyle={styles.listContent}
          refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
              <Text style={styles.headline}>{title}</Text>
              <Text style={styles.guide}>{t('screenerGuide')}</Text>
              {timeLabel ? <Text style={styles.meta}>{timeLabel}</Text> : null}
            </View>
          }
          ListEmptyComponent={
            !error ? <Text style={styles.emptyText}>{t('screenerEmpty')}</Text> : null
          }
          renderItem={({ item }) => {
            const pct = item.changePercent;
            const hasPct = typeof pct === 'number' && Number.isFinite(pct);
            const up = hasPct && pct >= 0;
            return (
              <Pressable
                onPress={() => openSymbol(item)}
                accessibilityRole="button"
                accessibilityLabel={item.name || item.symbol}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <SymbolLogo symbol={item.symbol} size={28} />
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.symbol} numberOfLines={1}>
                      {item.symbol}
                    </Text>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {hasPct ? (
                      <Text
                        style={[
                          styles.change,
                          { color: up ? quoteChange.colors.up : quoteChange.colors.down },
                        ]}>
                        {formatQuoteDpPct(pct)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.metrics} numberOfLines={1}>
                    {t('screenerMetricsLine', {
                      rsi: formatNum(item.rsi),
                      per: formatNum(item.per),
                      pbr: formatNum(item.pbr),
                      rev: formatPctRatio(item.revenueYoY),
                    })}
                  </Text>
                  {item.note?.trim() ? (
                    <ChangeTintedText style={styles.note} numberOfLines={2}>
                      {item.note.trim()}
                    </ChangeTintedText>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent: {
      flexGrow: 1,
      paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP,
      paddingHorizontal: APP_CONTENT_SIDE_PADDING,
      paddingBottom: 28,
      gap: 10,
    },
    headerBlock: { gap: 6, marginBottom: 8 },
    headline: {
      color: theme.text,
      fontSize: ft.ff(17),
      fontWeight: ft.titleWeight,
    },
    guide: {
      color: theme.textMuted,
      fontSize: ft.ff(13),
      lineHeight: sf(18),
      fontWeight: ft.metaWeight,
    },
    meta: { color: theme.textMuted, fontSize: ft.ff(12), fontWeight: ft.metaWeight },
    errorBox: {
      padding: 12,
      borderRadius: 10,
      backgroundColor: theme.bgElevated,
      marginBottom: 4,
    },
    errorText: { color: theme.danger, fontSize: ft.ff(14), fontWeight: ft.bodyWeight },
    emptyText: {
      color: theme.textMuted,
      fontSize: ft.ff(14),
      textAlign: 'center',
      marginTop: 40,
      fontWeight: ft.bodyWeight,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    pressed: { opacity: 0.85 },
    rowBody: { flex: 1, gap: 4 },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    symbol: {
      color: theme.text,
      fontSize: ft.ff(14),
      fontWeight: ft.titleWeight,
      minWidth: 58,
    },
    name: { flex: 1, color: theme.text, fontSize: ft.ff(14), fontWeight: ft.bodyWeight },
    change: { fontSize: ft.ff(12), fontWeight: ft.metaWeight },
    metrics: { color: theme.textMuted, fontSize: ft.ff(12), fontWeight: ft.metaWeight },
    note: {
      color: theme.text,
      fontSize: ft.ff(13),
      lineHeight: sf(18),
      fontWeight: ft.bodyWeight,
    },
  });
}
