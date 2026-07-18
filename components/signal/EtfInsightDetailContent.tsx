import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { EtfInsightBlock } from '@/components/signal/EtfInsightBlock';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import {
  SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL,
  SCREEN_EMBEDDED_WIDE_PADDING_TOP,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useScrollToTopOnChange } from '@/hooks/useScrollToTopOnChange';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import {
  fetchSignalEtfInsightById,
  fetchSignalEtfInsightForDate,
} from '@/integrations/signal-api/etfInsights';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiEtfInsight } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';

export type EtfInsightDetailContentProps = {
  id?: string | null;
  date?: string | null;
  embedded?: boolean;
  onBack?: () => void;
};

export function EtfInsightDetailContent({
  id,
  date,
  embedded = false,
  onBack,
}: EtfInsightDetailContentProps) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo, embedded),
    [theme, scaleFont, feedTypo, embedded],
  );
  const [item, setItem] = useState<SignalApiEtfInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { ref: scrollRef } = useScrollToTopOnChange([id, date], { resyncDeps: [item, loading] });
  const scrollResetKey = `${id || ''}|${date || ''}`;

  const load = useCallback(
    async (forceRefresh?: boolean) => {
      if (!hasSignalApi()) {
        setItem(null);
        setError(t('errorSignalApiShort'));
        setLoading(false);
        return;
      }
      setError(null);
      try {
        const cacheMode = signalCacheMode(forceRefresh);
        const next = id?.trim()
          ? await fetchSignalEtfInsightById(id.trim(), { cacheMode })
          : date
            ? await fetchSignalEtfInsightForDate(date, { cacheMode })
            : null;
        setItem(next);
      } catch (e) {
        setError(formatSignalApiError(e, t, 'etfInsightLoadError'));
      } finally {
        setLoading(false);
      }
    },
    [date, id, t],
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


  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['bottom']}>
      {/* 단건 상세 — Stack 제목·dateBar 없음. 뒤로만 */}
      {!embedded ? <Stack.Screen options={{ title: '' }} /> : null}
      {loading ? (
        <View style={styles.loadingWrap}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : (
        <WebWheelScrollView
          ref={scrollRef as never}
          scrollResetKey={scrollResetKey}
          contentRevision={item}
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}>
          {onBack ? <WideSubpaneHeader onBack={onBack} /> : null}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!error && !item ? <Text style={styles.emptyText}>{t('etfInsightEmpty')}</Text> : null}

          {item ? (
            <>
              <Text style={styles.headline}>{item.title}</Text>
              <EtfInsightBlock insight={item} theme={theme} scaleFont={scaleFont} />
            </>
          ) : null}
        </WebWheelScrollView>
      )}
    </SafeAreaView>
  );
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
    scroll: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: embedded ? SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL : 16,
      paddingTop: embedded ? SCREEN_EMBEDDED_WIDE_PADDING_TOP : 14,
      paddingBottom: 28,
      gap: 14,
      maxWidth: embedded ? APP_WIDE_CONTENT_MAX_WIDTH : APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      width: '100%',
    },
    loadingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorBox: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.danger,
      backgroundColor: theme.dangerDim,
      padding: 12,
    },
    errorText: {
      fontSize: sf(13),
      lineHeight: sf(18),
      fontWeight: '600',
      color: theme.danger,
    },
    emptyText: {
      fontSize: ft.ff(13),
      lineHeight: sf(19),
      fontWeight: ft.bodyWeight,
      color: theme.textDim,
      textAlign: 'center',
      paddingVertical: 24,
    },
    headline: {
      fontSize: ft.ff(17),
      lineHeight: sf(25),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
  });
}
