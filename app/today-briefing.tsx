import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import { HomeSectionAccentLine } from '@/components/signal/HomeSectionAccentLine';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { briefingSourceIconEntries } from '@/components/signal/SourceIconStack';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { CONTENT_ACCENT_LINE_WIDTH } from '@/constants/homeSectionAccent';
import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import {
  SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL,
  SCREEN_EMBEDDED_WIDE_PADDING_TOP,
  SCREEN_HEADER_CONTENT_GAP,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useScrollToTopOnChange } from '@/hooks/useScrollToTopOnChange';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { fetchSignalTodayBriefing } from '@/integrations/signal-api/todayBriefings';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import type { SignalApiTodayBriefing } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { formatLocalYmdLabel, formatFeedItemTimeLabel, toYmd } from '@/utils/date';

function parseDateParam(value: unknown): string {
  const raw = String(Array.isArray(value) ? value[0] : value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : toYmd(new Date());
}

async function fetchTodayBriefingWithFallback(
  date: string,
  locale: string,
  cacheMode: ReturnType<typeof signalCacheMode>,
): Promise<SignalApiTodayBriefing | null> {
  const primary = await fetchSignalTodayBriefing({ date, locale }, { cacheMode }).catch(() => null);
  if (primary || locale === 'ko') return primary;
  return fetchSignalTodayBriefing({ date, locale: 'ko' }, { cacheMode }).catch(() => null);
}

export type TodayBriefingContentProps = {
  date: string;
  embedded?: boolean;
  onBack?: () => void;
};

export function TodayBriefingContent({ date, embedded = false, onBack }: TodayBriefingContentProps) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo, embedded), [theme, scaleFont, feedTypo, embedded]);
  const [item, setItem] = useState<SignalApiTodayBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { ref: scrollRef } = useScrollToTopOnChange([date], { resyncDeps: [item, loading] });
  const scrollResetKey = date;

  const dateLabel = useMemo(
    () =>
      formatLocalYmdLabel(date, locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      }),
    [date, locale],
  );

  const load = useCallback(async (forceRefresh?: boolean) => {
    if (!hasSignalApi()) {
      setItem(null);
      setError(t('errorSignalApiShort'));
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setItem(await fetchTodayBriefingWithFallback(date, locale, signalCacheMode(forceRefresh)));
    } catch (e) {
      setError(formatSignalApiError(e, t, 'todayBriefingLoadError'));
    } finally {
      setLoading(false);
    }
  }, [date, locale, t]);

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

  const leadText = item?.headline?.trim() || item?.summary?.trim() || '';
  const bodyText = item?.summary?.trim() || '';

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['bottom']}>
      {!embedded ? <Stack.Screen options={{ title: t('todayBriefingDetailKicker') }} /> : null}
      {embedded ? null : (
        <View style={styles.dateBar}>
          <Text style={styles.dateHeader}>{dateLabel}</Text>
        </View>
      )}
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
          {onBack ? (
            <WideSubpaneHeader title={t('todayBriefingDetailKicker')} onBack={onBack} />
          ) : null}
          {embedded ? <Text style={styles.dateHeader}>{dateLabel}</Text> : null}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!error && !item ? (
            <Text style={styles.emptyText}>{t('todayBriefingEmpty')}</Text>
          ) : null}

          {item ? (
            <>
              <View style={styles.heroCard}>
                <HomeSectionAccentLine section="todayBriefing" />
                {leadText ? <Text style={styles.headline}>{leadText}</Text> : null}
                {bodyText && bodyText !== leadText ? <Text style={styles.summary}>{bodyText}</Text> : null}
              </View>

              {item.keyPoints.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <View style={styles.sectionHead}>
                    <View style={styles.sectionAccent} />
                    <Text style={styles.sectionHeading}>{t('todayBriefingKeyPoints')}</Text>
                  </View>
                  <View style={styles.sectionFeedCard}>
                    {item.keyPoints.map((point, index) => (
                      <HomeDigestFeedRow
                        key={`${item.id}-point-${index}`}
                        title={point}
                        titleLines={4}
                        bordered={index < item.keyPoints.length - 1}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {item.sourceRefs.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <View style={styles.sectionHead}>
                    <View style={[styles.sectionAccent, styles.sectionAccentMuted]} />
                    <Text style={styles.sectionHeading}>{t('todayBriefingSources')}</Text>
                  </View>
                  <View style={styles.sectionFeedCard}>
                    {item.sourceRefs.map((ref, index) => (
                      <HomeDigestFeedRow
                        key={`${item.id}-source-${index}`}
                        title={ref.title || ref.sourceName || ref.url || ''}
                        titleLines={3}
                        trailText={ref.sourceName?.trim() || null}
                        timeLabel={formatFeedItemTimeLabel(ref.publishedAt, locale)}
                        sourceEntries={briefingSourceIconEntries([ref])}
                        bordered={index < item.sourceRefs.length - 1}
                        onPress={
                          ref.url
                            ? () => {
                                void Linking.openURL(ref.url!);
                              }
                            : undefined
                        }
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : null}
        </WebWheelScrollView>
      )}
    </SafeAreaView>
  );
}

export default function TodayBriefingScreen() {
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const { useTwoPane } = useResponsiveLayout();
  const date = useMemo(() => parseDateParam(params.date), [params.date]);

  if (useTwoPane) {
    return <WideOverlayRouteRedirect kind="today-briefing" params={{ date }} />;
  }

  return <TodayBriefingContent date={date} />;
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
    dateBar: {
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingTop: SCREEN_HEADER_CONTENT_GAP,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    dateHeader: {
      fontSize: sf(14),
      lineHeight: sf(20),
      fontWeight: '600',
      color: theme.textMuted,
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
    heroCard: {
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingLeft: 18,
      paddingRight: 14,
      paddingVertical: 14,
      gap: 16,
    },
    headline: {
      fontSize: ft.ff(17),
      lineHeight: sf(25),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    summary: {
      fontSize: ft.signalBodyFont(15),
      lineHeight: sf(23),
      fontWeight: ft.signalBodyWeight,
      color: theme.textMuted,
    },
    sectionWrap: {
      gap: 16,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minWidth: 0,
    },
    sectionAccent: {
      width: CONTENT_ACCENT_LINE_WIDTH,
      height: 20,
      borderRadius: 2,
      backgroundColor: theme.green,
      flexShrink: 0,
    },
    sectionAccentMuted: {
      backgroundColor: theme.textMuted,
    },
    sectionHeading: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.signalTitleFont(16),
      fontWeight: ft.titleWeight,
      letterSpacing: -0.15,
      color: theme.text,
    },
    sectionFeedCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      paddingHorizontal: 10,
      paddingVertical: 8,
      overflow: 'hidden',
    },
  });
}
