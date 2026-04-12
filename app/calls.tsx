import { useCallback, useEffect, useMemo, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { TAB_BAR_FLOAT_MARGIN_BOTTOM } from '@/constants/tabBar';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { MessageId } from '@/locales/messages';
import { fetchConcallSummaryForEarningsRow } from '@/services/concalls';
import { loadCacheFeaturePrefs } from '@/services/cacheFeaturePreferences';
import { hasFinnhub } from '@/services/env';
import type { FinnhubEarningsRow } from '@/integrations/finnhub';
import type { ConcallSummary } from '@/types/signal';

function parseIntParam(v: string | string[] | undefined): number | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (s == null || s === '') return null;
  const n = Number.parseInt(String(s), 10);
  return Number.isFinite(n) ? n : null;
}

export default function CallsSummaryScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const params = useLocalSearchParams<{
    ticker?: string;
    year?: string;
    quarter?: string;
    date?: string;
    hour?: string;
  }>();

  const ticker = useMemo(() => {
    const raw = params.ticker;
    const s = Array.isArray(raw) ? raw[0] : raw;
    return String(s ?? '')
      .trim()
      .toUpperCase();
  }, [params.ticker]);
  const year = parseIntParam(params.year);
  const quarter = parseIntParam(params.quarter);
  const earnDate = useMemo(() => {
    const raw = params.date;
    const s = (Array.isArray(raw) ? raw[0] : raw) ?? '';
    return /^\d{4}-\d{2}-\d{2}$/.test(String(s)) ? String(s) : '';
  }, [params.date]);
  const earnHour = useMemo(() => {
    const raw = params.hour;
    const s = (Array.isArray(raw) ? raw[0] : raw) ?? '';
    return String(s);
  }, [params.hour]);

  const rowStub = useMemo((): FinnhubEarningsRow | null => {
    if (!ticker || year == null || quarter == null || !earnDate) return null;
    return {
      symbol: ticker,
      date: earnDate,
      epsActual: null,
      epsEstimate: null,
      hour: earnHour,
      quarter,
      revenueActual: null,
      revenueEstimate: null,
      year,
    };
  }, [ticker, year, quarter, earnDate, earnHour]);

  const hasTarget = rowStub != null;

  const [loading, setLoading] = useState(!!hasTarget);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ConcallSummary | null>(null);

  const bottomChrome = insets.bottom + TAB_BAR_FLOAT_MARGIN_BOTTOM;

  const providerLabel = useCallback(
    (source: ConcallSummary['source']): string => {
      const key: MessageId =
        source === 'claude'
          ? 'callsAiProviderClaude'
          : source === 'openai'
            ? 'callsAiProviderOpenai'
            : 'callsAiProviderFallback';
      return t(key);
    },
    [t],
  );

  const load = useCallback(
    async (forceRefresh?: boolean) => {
      if (!hasTarget || !rowStub) {
        setSummary(null);
        setError(null);
        setLoading(false);
        return;
      }
      if (!hasFinnhub()) {
        setError(t('feedErrorToken'));
        setSummary(null);
        setLoading(false);
        return;
      }
      setError(null);
      const { concallEnabled } = await loadCacheFeaturePrefs();
      try {
        const s = await fetchConcallSummaryForEarningsRow(ticker, rowStub, {
          forceRefresh: !!forceRefresh,
          cacheEnabled: concallEnabled,
        });
        setSummary(s);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('callsErrorLoad'));
        setSummary(null);
      } finally {
        setLoading(false);
      }
    },
    [hasTarget, rowStub, t, ticker],
  );

  useEffect(() => {
    if (!hasTarget) {
      setLoading(false);
      setSummary(null);
      return;
    }
    setLoading(true);
    void load(false);
  }, [hasTarget, load]);

  const onRefresh = useCallback(async () => {
    if (!hasTarget) return;
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [hasTarget, load]);

  const screenTitle = hasTarget ? t('callsSingleTitle', { symbol: ticker }) : t('callsSectionTitle');

  const hasTranscript = !!(summary?.transcriptSnippet && summary.transcriptSnippet.trim().length > 0);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: screenTitle }} />
      <OtaUpdateBanner />
      {!hasTarget ? (
        <View style={[styles.centerPad, { paddingBottom: bottomChrome }]}>
          <Text style={styles.emptyLead}>{t('callsEmptyNoParamsLead')}</Text>
          <Text style={styles.emptySub}>{t('callsEmptyNoParamsSub')}</Text>
          <Pressable
            style={styles.linkBtn}
            onPress={() => router.push('/(tabs)/quotes')}
            accessibilityRole="button">
            <Text style={styles.linkBtnText}>{t('callsEmptyGoQuotes')}</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <View style={[styles.centerPad, { paddingBottom: bottomChrome }]}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 28 + bottomChrome }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />
          }
          showsVerticalScrollIndicator={false}>
          {error ? (
            <View style={styles.errBox}>
              <Text style={styles.errText}>{error}</Text>
            </View>
          ) : null}

          {summary ? (
            <View>
              <View style={styles.metaBlock}>
                <Text style={styles.fyLine}>{summary.quarter}</Text>
                <Text style={styles.dateLine}>{earnDate}</Text>
              </View>

              {hasTranscript ? (
                <>
                  <Text style={styles.sectionHeading}>{t('callsTranscriptHeading')}</Text>
                  <Text style={styles.transcript} selectable>
                    {summary.transcriptSnippet}
                  </Text>
                  <Text style={[styles.sectionHeading, styles.sectionHeadingSpaced]}>
                    {t('callsSummaryHeading')}
                  </Text>
                </>
              ) : null}

              <View style={hasTranscript ? styles.summaryBlock : styles.summaryBlockNoTx}>
                {summary.bullets.map((b, i) => (
                  <Text key={i} style={styles.bullet}>
                    {b}
                  </Text>
                ))}
                {/* 트랜스크립트가 있으면 전문·불릿이 역할을 나누므로 가이던스/리스크 블록은 생략(불릿과 중복이 잦음) */}
                {!hasTranscript && summary.guidance ? (
                  <View style={styles.inlineBlock}>
                    <Text style={styles.inlineLabel}>{t('callsLabelGuidance')}</Text>
                    <Text style={styles.inlineBody}>{summary.guidance}</Text>
                  </View>
                ) : null}
                {!hasTranscript && summary.risk ? (
                  <View style={styles.inlineBlock}>
                    <Text style={styles.inlineLabel}>{t('callsLabelRisk')}</Text>
                    <Text style={styles.inlineBody}>{summary.risk}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.provider}>{providerLabel(summary.source)}</Text>
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
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 18, paddingTop: 14 },
    centerPad: { flex: 1, paddingHorizontal: 24, paddingTop: 32, justifyContent: 'center' },
    emptyLead: { fontSize: sf(15), fontWeight: '700', color: theme.text, marginBottom: 10, lineHeight: sf(22) },
    emptySub: { fontSize: sf(13), color: theme.textDim, lineHeight: sf(20), marginBottom: 20 },
    linkBtn: {
      alignSelf: 'flex-start',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    linkBtnText: { fontSize: sf(14), fontWeight: '800', color: theme.green },
    errBox: {
      padding: 12,
      borderRadius: 10,
      backgroundColor: '#2A1515',
      borderWidth: 1,
      borderColor: '#553333',
      marginBottom: 16,
    },
    errText: { fontSize: sf(12), color: '#E0A0A0', lineHeight: sf(18) },
    metaBlock: {
      paddingBottom: 16,
      marginBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    fyLine: { fontSize: sf(20), fontWeight: '900', color: theme.text, letterSpacing: -0.3, marginBottom: 4 },
    dateLine: { fontSize: sf(13), fontWeight: '600', color: theme.textMuted },
    sectionHeading: {
      fontSize: sf(12),
      fontWeight: '800',
      letterSpacing: 0.35,
      color: theme.textMuted,
      marginBottom: 10,
    },
    sectionHeadingSpaced: { marginTop: 22 },
    transcript: {
      fontSize: sf(12),
      lineHeight: sf(19),
      fontWeight: '400',
      color: theme.textDim,
      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
      marginBottom: 4,
    },
    summaryBlock: { marginTop: 4 },
    summaryBlockNoTx: { marginTop: 12 },
    bullet: {
      fontSize: sf(15),
      color: theme.text,
      lineHeight: sf(24),
      fontWeight: '500',
      marginBottom: 12,
    },
    inlineBlock: { marginTop: 14 },
    inlineLabel: { fontSize: sf(11), fontWeight: '800', color: theme.accentBlue, marginBottom: 4 },
    inlineBody: { fontSize: sf(14), color: theme.textDim, lineHeight: sf(22), fontWeight: '500' },
    provider: { marginTop: 24, fontSize: sf(11), fontWeight: '600', color: theme.textDim },
  });
}
