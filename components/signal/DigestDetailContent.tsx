import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import type { DigestSourceSheetRow } from '@/components/news/DigestSourcesSheet';
import { newsDigestSourceSheetRows } from '@/components/news/DigestPager';
import { disclosureDigestSourceSheetRows } from '@/components/disclosures/DisclosureDigestSection';
import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import { HomeSectionHeader } from '@/components/signal/HomeSectionHeader';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { COMFORT_GAP_LG, COMFORT_GAP_SM, COMFORT_PADDING_ROW_V } from '@/constants/comfortDensity';
import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import {
  SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL,
  SCREEN_EMBEDDED_WIDE_PADDING_TOP,
  SCREEN_HEADER_CONTENT_GAP,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD_LG } from '@/constants/uiCornerRadius';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useScrollToTopOnChange } from '@/hooks/useScrollToTopOnChange';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { fetchSignalDisclosureDigestById } from '@/integrations/signal-api/disclosureDigests';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { fetchSignalNewsDigestById } from '@/integrations/signal-api/newsDigests';
import type {
  SignalApiDisclosureDigestItem,
  SignalApiNewsDigestItem,
} from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import type { AppLocale } from '@/locales/messages';
import { formatLocalYmdLabel } from '@/utils/date';

export type DigestDetailKind = 'news' | 'disclosure';

export type DigestDetailContentProps = {
  kind: DigestDetailKind;
  id?: string | null;
  embedded?: boolean;
  onBack?: () => void;
};

function ymdFromDigest(item: { generatedDate?: string | null; generatedAt?: string | null }): string {
  const dateOnly = String(item.generatedDate || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return dateOnly;
  const iso = String(item.generatedAt || '').trim();
  if (!iso) return '';
  const parsed = new Date(iso);
  if (!Number.isFinite(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

export function DigestDetailContent({
  kind,
  id,
  embedded = false,
  onBack,
}: DigestDetailContentProps) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo, embedded),
    [theme, scaleFont, feedTypo, embedded],
  );
  const [newsItem, setNewsItem] = useState<SignalApiNewsDigestItem | null>(null);
  const [disclosureItem, setDisclosureItem] = useState<SignalApiDisclosureDigestItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleKey = kind === 'news' ? 'newsIssuesTitle' : 'disclosureFlowTitle';
  const emptyKey = kind === 'news' ? 'newsDigestEmpty' : 'disclosureDigestEmpty';
  const loadErrorKey = kind === 'news' ? 'newsIssuesLoadError' : 'disclosureFlowLoadError';
  const item = kind === 'news' ? newsItem : disclosureItem;
  const { ref: scrollRef } = useScrollToTopOnChange([kind, id], { resyncDeps: [item, loading] });
  const scrollResetKey = `${kind}|${id || ''}`;

  const load = useCallback(
    async (forceRefresh?: boolean) => {
      const cleanId = String(id || '').trim();
      if (!hasSignalApi()) {
        setNewsItem(null);
        setDisclosureItem(null);
        setError(t('errorSignalApiShort'));
        setLoading(false);
        return;
      }
      if (!cleanId) {
        setNewsItem(null);
        setDisclosureItem(null);
        setError(null);
        setLoading(false);
        return;
      }
      setError(null);
      try {
        const cacheMode = signalCacheMode(forceRefresh);
        if (kind === 'news') {
          const next = await fetchSignalNewsDigestById(cleanId, { cacheMode, locale });
          setNewsItem(next);
          setDisclosureItem(null);
        } else {
          const next = await fetchSignalDisclosureDigestById(cleanId, { cacheMode, locale });
          setDisclosureItem(next);
          setNewsItem(null);
        }
      } catch (e) {
        setError(formatSignalApiError(e, t, loadErrorKey));
      } finally {
        setLoading(false);
      }
    },
    [id, kind, loadErrorKey, locale, t],
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
    const ymd = item ? ymdFromDigest(item) : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
    return formatLocalYmdLabel(ymd, locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  }, [item, locale]);

  const sourceRows: DigestSourceSheetRow[] = useMemo(() => {
    if (!item) return [];
    if (kind === 'news') {
      return newsDigestSourceSheetRows(item as SignalApiNewsDigestItem, locale as AppLocale);
    }
    return disclosureDigestSourceSheetRows(item as SignalApiDisclosureDigestItem, locale as AppLocale);
  }, [item, kind, locale]);

  const headline = item?.title?.trim() || '';
  const summary = item?.summary?.trim() || '';

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? [] : ['bottom']}>
      {!embedded ? <Stack.Screen options={{ title: t(titleKey) }} /> : null}
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
          {onBack ? <WideSubpaneHeader title={t(titleKey)} onBack={onBack} /> : null}
          {embedded && dateLabel ? <Text style={styles.dateHeader}>{dateLabel}</Text> : null}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {!error && !item ? <Text style={styles.emptyText}>{t(emptyKey)}</Text> : null}

          {item ? (
            <>
              <View style={styles.section}>
                <HomeSectionHeader title={headline || t(titleKey)} showChevron={false} />
                {summary ? (
                  <View style={styles.feedCard}>
                    <Text style={styles.summary}>{summary}</Text>
                  </View>
                ) : null}
              </View>

              {sourceRows.length > 0 ? (
                <View style={styles.section}>
                  <HomeSectionHeader title={t('feedDigestSourcesTitle')} showChevron={false} />
                  <View style={[styles.feedCard, styles.feedCardCompact]}>
                    <View style={styles.sourceList}>
                      {sourceRows.map((row, index) => {
                        const refUrl = row.url || undefined;
                        return (
                          <HomeDigestFeedRow
                            key={row.key}
                            title={row.title}
                            titleLines={3}
                            trailText={row.subtitle?.trim() || null}
                            timeLabel={row.timeLabel?.trim() || null}
                            sourceEntries={row.sourceEntries}
                            bordered={index < sourceRows.length - 1}
                            onPress={
                              refUrl
                                ? () => {
                                    void Linking.openURL(refUrl).catch(() => null);
                                  }
                                : undefined
                            }
                          />
                        );
                      })}
                    </View>
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
      gap: COMFORT_GAP_LG,
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
    section: {
      gap: COMFORT_GAP_SM,
    },
    feedCard: {
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 12,
      paddingVertical: COMFORT_PADDING_ROW_V,
      overflow: 'hidden',
    },
    feedCardCompact: {
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    summary: {
      fontSize: ft.ff(13),
      lineHeight: sf(19),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
    },
    sourceList: {
      gap: 0,
    },
  });
}
