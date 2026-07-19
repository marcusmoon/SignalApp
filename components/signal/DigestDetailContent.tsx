import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { BriefingDetailShell } from '@/components/signal/BriefingDetailShell';
import type { DigestSourceSheetRow } from '@/components/news/DigestSourcesSheet';
import { newsDigestSourceSheetRows } from '@/components/news/DigestPager';
import { disclosureDigestSourceSheetRows } from '@/components/disclosures/DisclosureDigestSection';
import { ChangeTintedText } from '@/components/signal/ChangeTintedText';
import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
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

export type DigestDetailKind = 'news' | 'disclosure';

export type DigestDetailContentProps = {
  kind: DigestDetailKind;
  id?: string | null;
  embedded?: boolean;
  onBack?: () => void;
};

export function DigestDetailContent({
  kind,
  id,
  embedded = false,
  onBack,
}: DigestDetailContentProps) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const [newsItem, setNewsItem] = useState<SignalApiNewsDigestItem | null>(null);
  const [disclosureItem, setDisclosureItem] = useState<SignalApiDisclosureDigestItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emptyKey = kind === 'news' ? 'newsDigestEmpty' : 'disclosureDigestEmpty';
  const loadErrorKey = kind === 'news' ? 'newsIssuesLoadError' : 'disclosureFlowLoadError';
  const item = kind === 'news' ? newsItem : disclosureItem;
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

  const sourceRows: DigestSourceSheetRow[] = useMemo(() => {
    if (!item) return [];
    if (kind === 'news') {
      return newsDigestSourceSheetRows(item as SignalApiNewsDigestItem, locale as AppLocale);
    }
    return disclosureDigestSourceSheetRows(item as SignalApiDisclosureDigestItem, locale as AppLocale);
  }, [item, kind, locale]);

  const headline = item?.title?.trim() || '';
  const summary = item?.summary?.trim() || '';
  const summaryBody = summary && summary !== headline ? summary : '';

  return (
    <BriefingDetailShell
      embedded={embedded}
      onBack={onBack}
      chromeTitle={t(kind === 'news' ? 'newsIssuesTitle' : 'disclosureFlowTitle')}
      loading={loading}
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      error={error}
      emptyText={!error && !item ? t(emptyKey) : null}
      headline={item ? headline : null}
      scrollResetKey={scrollResetKey}
      contentRevision={item}>
      {item ? (
        <View style={styles.root}>
          {summaryBody ? (
            <View style={styles.leadPanel}>
              <ChangeTintedText style={styles.summary}>{summaryBody}</ChangeTintedText>
            </View>
          ) : null}

          {sourceRows.length > 0 ? (
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t('feedDigestSourcesTitle')}</Text>
              </View>
              <View style={styles.sectionFeedCard}>
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
          ) : null}
        </View>
      ) : null}
    </BriefingDetailShell>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  const leadTint =
    theme.green.startsWith('#') && theme.green.length === 7 ? `${theme.green}0A` : theme.bgElevated;
  return StyleSheet.create({
    root: {
      gap: 20,
    },
    leadPanel: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: leadTint,
      padding: ft.pad(16),
      gap: 14,
    },
    summary: {
      fontSize: ft.signalBodyFont(15),
      lineHeight: sf(23),
      fontWeight: ft.signalBodyWeight,
      color: theme.text,
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
    sectionTitle: {
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
