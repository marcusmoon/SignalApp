import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { fetchSignalMarketBriefing } from '@/integrations/signal-api/marketBriefings';
import type { SignalApiMarketBriefing } from '@/integrations/signal-api/types';

function shortMd(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return isoDate;
  return `${Number(m[2])}/${Number(m[3])}`;
}

function shortDateTime(value: string | null | undefined): string {
  const text = String(value || '').trim();
  if (text.length >= 16) return `${shortMd(text.slice(0, 10))} ${text.slice(11, 16)}`;
  if (text.length >= 10) return shortMd(text.slice(0, 10));
  return text || '—';
}

export default function MarketBriefingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<SignalApiMarketBriefing | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const row = await fetchSignalMarketBriefing(String(id || ''));
        if (!cancelled) setBriefing(row);
      } catch (e) {
        if (!cancelled) setError(formatSignalApiError(e, t, 'briefingErrorLoad'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, t]);

  const marketLabel = briefing?.market === 'us' ? t('briefingMarketUs') : t('briefingMarketKr');
  const sessionLabel =
    briefing?.session === 'morning'
      ? t('briefingSessionMorning')
      : briefing?.session === 'lunch'
        ? t('briefingSessionLunch')
        : briefing?.session === 'evening'
          ? t('briefingSessionEvening')
          : briefing?.session === 'close'
            ? t('briefingSessionClose')
            : t('briefingSessionOvernight');

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: briefing?.title || t('screenBriefing') }} />
      {loading ? (
        <View style={styles.center}>
          <SignalLoadingIndicator />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {briefing ? (
            <View style={styles.card}>
              <Text style={styles.kicker}>
                {marketLabel} · {sessionLabel} · {shortDateTime(briefing.publishedAt)}
              </Text>
              <Text style={styles.title}>{briefing.title}</Text>
              <Text style={styles.headline}>{briefing.headline}</Text>
              {briefing.summary ? <Text style={styles.summary}>{briefing.summary}</Text> : null}

              {briefing.overview.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('briefingDetailOverview')}</Text>
                  {briefing.overview.map((line, index) => (
                    <Text key={`overview-${index}`} style={styles.bullet}>
                      {`• ${line}`}
                    </Text>
                  ))}
                </View>
              ) : null}

              {briefing.companies.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('briefingDetailCompanies')}</Text>
                  {briefing.companies.map((item, index) => (
                    <View key={`${item.symbol}-${index}`} style={styles.rowCard}>
                      <Text style={styles.rowTitle}>{item.symbol}</Text>
                      <Text style={styles.rowBody}>{item.summary}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {briefing.macro.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('briefingDetailMacro')}</Text>
                  {briefing.macro.map((item, index) => (
                    <View key={`${item.title}-${index}`} style={styles.rowCard}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      <Text style={styles.rowBody}>{item.summary}</Text>
                      {item.sourceUrl ? (
                        <Pressable onPress={() => void Linking.openURL(item.sourceUrl || '')}>
                          <Text style={styles.link}>{item.sourceName || item.sourceUrl}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              {briefing.sourceRefs.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>{t('briefingDetailSources')}</Text>
                  {briefing.sourceRefs.map((item, index) => (
                    <Pressable
                      key={`${item.title}-${index}`}
                      disabled={!item.url}
                      onPress={() => {
                        if (item.url) void Linking.openURL(item.url);
                      }}
                      style={({ pressed }) => [styles.sourceRow, pressed && item.url && styles.sourceRowPressed]}>
                      <Text style={styles.sourceTitle}>{item.title}</Text>
                      <Text style={styles.sourceMeta}>
                        {[item.sourceName, shortDateTime(item.publishedAt || item.checkedAt)].filter(Boolean).join(' · ')}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 16, paddingBottom: 32 },
    error: { fontSize: sf(13), color: theme.accentOrange },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.card,
      padding: 16,
    },
    kicker: {
      fontSize: sf(11),
      fontWeight: '900',
      color: theme.green,
      marginBottom: 8,
    },
    title: {
      fontSize: sf(22),
      fontWeight: '900',
      color: theme.text,
      lineHeight: sf(29),
      marginBottom: 8,
    },
    headline: {
      fontSize: sf(14),
      fontWeight: '800',
      color: theme.textDim,
      lineHeight: sf(20),
      marginBottom: 10,
    },
    summary: {
      fontSize: sf(14),
      fontWeight: '700',
      color: theme.text,
      lineHeight: sf(20),
    },
    section: {
      marginTop: 18,
      gap: 8,
    },
    sectionTitle: {
      fontSize: sf(13),
      fontWeight: '900',
      color: theme.text,
    },
    bullet: {
      fontSize: sf(13),
      fontWeight: '700',
      color: theme.text,
      lineHeight: sf(19),
    },
    rowCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      padding: 12,
      gap: 6,
    },
    rowTitle: {
      fontSize: sf(13),
      fontWeight: '900',
      color: theme.text,
    },
    rowBody: {
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.textDim,
      lineHeight: sf(17),
    },
    link: {
      fontSize: sf(11),
      fontWeight: '800',
      color: theme.green,
    },
    sourceRow: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      padding: 12,
      gap: 4,
    },
    sourceRowPressed: {
      opacity: 0.82,
    },
    sourceTitle: {
      fontSize: sf(12),
      fontWeight: '800',
      color: theme.text,
    },
    sourceMeta: {
      fontSize: sf(11),
      fontWeight: '700',
      color: theme.textMuted,
    },
  });
}
