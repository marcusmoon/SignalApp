import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { ChangeTintedText } from '@/components/signal/ChangeTintedText';
import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { briefingSourceIconEntries } from '@/components/signal/SourceIconStack';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import {
  SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL,
  SCREEN_EMBEDDED_WIDE_PADDING_TOP,
  SCREEN_HEADER_CONTENT_GAP,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useScrollToTopOnChange } from '@/hooks/useScrollToTopOnChange';
import {
  etfInsightHeatmapLabel,
  etfInsightLabeledRows,
  etfInsightRotationLines,
  etfInsightThemeLabel,
} from '@/domain/etfInsights/display';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import {
  fetchSignalEtfInsightById,
  fetchSignalEtfInsightForDate,
} from '@/integrations/signal-api/etfInsights';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiEtfInsight } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';
import { formatFeedItemTimeLabel, formatLocalYmdLabel } from '@/utils/date';

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
  const { t, locale } = useLocale();
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

  const dateLabel = useMemo(() => {
    const ymd = item?.insightDate || date || '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
    return formatLocalYmdLabel(ymd, locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  }, [date, item?.insightDate, locale]);

  const themes = useMemo(
    () => etfInsightLabeledRows(item?.themes || [], etfInsightThemeLabel),
    [item],
  );
  const flows = useMemo(() => etfInsightLabeledRows(item?.flowHighlights || []), [item]);
  const heatmap = useMemo(
    () => etfInsightLabeledRows(item?.heatmap || [], etfInsightHeatmapLabel),
    [item],
  );
  const rotationLines = useMemo(() => etfInsightRotationLines(item?.rotation), [item]);
  const insights = item?.insights?.filter((line) => String(line || '').trim()) || [];
  const sources = item?.sourceRefs || [];
  const leadText = item?.title?.trim() || '';
  const bodyText = item?.summary?.trim() || '';

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['bottom']}>
      {!embedded ? <Stack.Screen options={{ title: t('etfInsightDetailKicker') }} /> : null}
      {embedded ? null : dateLabel ? (
        <View style={styles.dateBar}>
          <Text style={styles.dateHeader}>{dateLabel}</Text>
        </View>
      ) : null}
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
          {onBack ? <WideSubpaneHeader title={t('etfInsightDetailKicker')} onBack={onBack} /> : null}
          {embedded && dateLabel ? <Text style={styles.dateHeader}>{dateLabel}</Text> : null}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!error && !item ? <Text style={styles.emptyText}>{t('etfInsightEmpty')}</Text> : null}

          {item ? (
            <>
              <View style={styles.heroCard}>
                {leadText ? <Text style={styles.headline}>{leadText}</Text> : null}
                {bodyText ? <Text style={styles.summary}>{bodyText}</Text> : null}
                {rotationLines[0] ? (
                  <Text style={styles.rotationLine} numberOfLines={2}>
                    {rotationLines[0]}
                  </Text>
                ) : null}
              </View>

              {insights.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionHeading}>{t('etfInsightKeyPoints')}</Text>
                  </View>
                  <View style={styles.sectionFeedCard}>
                    {insights.map((line, index) => (
                      <HomeDigestFeedRow
                        key={`${item.id}-insight-${index}`}
                        title={line}
                        titleLines={null}
                        bordered={index < insights.length - 1}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {themes.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionHeading}>{t('etfInsightThemes')}</Text>
                  </View>
                  <View style={styles.sectionFeedCard}>
                    {themes.map((row, index) => (
                      <HomeDigestFeedRow
                        key={`${item.id}-theme-${index}`}
                        title={row.label}
                        titleLines={null}
                        trailText={row.trail}
                        summary={row.summary}
                        summaryLines={3}
                        bordered={index < themes.length - 1}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {heatmap.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionHeading}>{t('etfInsightHeatmap')}</Text>
                  </View>
                  <View style={styles.sectionFeedCard}>
                    {heatmap.map((row, index) => (
                      <View
                        key={`${item.id}-heat-${index}`}
                        style={[
                          styles.heatmapRow,
                          index < heatmap.length - 1 && styles.heatmapRowBorder,
                        ]}>
                        <Text style={styles.heatmapLabel} numberOfLines={2}>
                          {row.label}
                        </Text>
                        {row.trail ? (
                          <ChangeTintedText style={styles.heatmapTrail}>{row.trail}</ChangeTintedText>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {flows.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionHeading}>{t('etfInsightFlows')}</Text>
                  </View>
                  <View style={styles.sectionFeedCard}>
                    {flows.map((row, index) => (
                      <HomeDigestFeedRow
                        key={`${item.id}-flow-${index}`}
                        title={row.label}
                        titleLines={null}
                        trailText={row.trail}
                        bordered={index < flows.length - 1}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {sources.length > 0 ? (
                <View style={styles.sectionWrap}>
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionHeading}>{t('etfInsightSources')}</Text>
                  </View>
                  <View style={styles.sectionFeedCard}>
                    {sources.map((ref, index) => {
                      const title = String(ref.title || ref.sourceName || ref.url || '').trim();
                      if (!title) return null;
                      return (
                        <HomeDigestFeedRow
                          key={`${item.id}-src-${index}`}
                          title={title}
                          titleLines={null}
                          trailText={ref.sourceName?.trim() || null}
                          timeLabel={formatFeedItemTimeLabel(ref.publishedAt, locale)}
                          sourceEntries={briefingSourceIconEntries([ref])}
                          bordered={index < sources.length - 1}
                          onPress={
                            ref.url
                              ? () => {
                                  void openConfiguredExternalLink({
                                    webUrl: ref.url!,
                                    openInAppBrowser: true,
                                  });
                                }
                              : undefined
                          }
                        />
                      );
                    })}
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
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 10,
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
    rotationLine: {
      fontSize: sf(13),
      lineHeight: sf(18),
      fontWeight: '600',
      color: theme.green,
    },
    sectionWrap: {
      gap: 12,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minWidth: 0,
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
    heatmapRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 4,
    },
    heatmapRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    heatmapLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.ff(14),
      lineHeight: sf(20),
      fontWeight: ft.bodyWeight,
      color: theme.text,
    },
    heatmapTrail: {
      fontSize: sf(13),
      lineHeight: sf(18),
      fontWeight: '700',
      color: theme.textMuted,
    },
  });
}
