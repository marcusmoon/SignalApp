import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchSignalQuantSignals } from '@/integrations/signal-api';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiQuantSignal } from '@/integrations/signal-api/types';
import type { MessageId } from '@/locales/messages';
import { hasSignalApi } from '@/services/env';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';

const PAGE_LIMIT = 24;

const REASON_LABELS: Record<string, MessageId> = {
  after_hours_up: 'quantReasonAfterHoursUp',
  after_hours_down: 'quantReasonAfterHoursDown',
  regular_up: 'quantReasonRegularUp',
  regular_down: 'quantReasonRegularDown',
  after_hours_source: 'quantReasonAfterHoursSource',
  fresh_quote: 'quantReasonFreshQuote',
  stale_quote: 'quantReasonStaleQuote',
  price_stable: 'quantReasonPriceStable',
};

const RISK_LABELS: Record<string, MessageId> = {
  low: 'quantRiskLow',
  medium: 'quantRiskMedium',
  high: 'quantRiskHigh',
};

function isKrwQuote(item: SignalApiQuantSignal): boolean {
  return Boolean(item.krxSymbol || item.quote?.krxSymbol || item.quote?.segment === 'kr_after_hours');
}

function formatPrice(value: number | null | undefined, krw: boolean): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (krw) {
    return `₩${Math.round(value).toLocaleString('ko-KR')}`;
  }
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: value >= 100 ? 2 : 2,
    maximumFractionDigits: value >= 100 ? 2 : 4,
  })}`;
}

function formatPct(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function scoreColor(theme: AppTheme, score: number): string {
  if (score >= 75) return theme.danger;
  if (score >= 62) return theme.green;
  if (score >= 45) return theme.text;
  return theme.textDim;
}

export default function QuantScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const [items, setItems] = useState<SignalApiQuantSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async ({ refresh = false }: { refresh?: boolean } = {}) => {
      if (!hasSignalApi()) {
        setItems([]);
        setError(t('errorSignalApiShort'));
        setLoading(false);
        return;
      }
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const symbols = await loadWatchlistSymbols();
        const rows = await fetchSignalQuantSignals({ symbols, limit: PAGE_LIMIT });
        setItems(rows);
      } catch (e) {
        setItems([]);
        setError(formatSignalApiError(e, t, 'quantError'));
      } finally {
        if (refresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const renderItem = useCallback(
    ({ item }: { item: SignalApiQuantSignal }) => (
      <QuantCard item={item} styles={styles} theme={theme} t={t} />
    ),
    [styles, t, theme],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <OtaUpdateBanner />
        <View style={styles.loadingWrap}>
          <SignalLoadingIndicator />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <OtaUpdateBanner />
      <FlatList
        data={items}
        keyExtractor={(item) => item.krxSymbol || item.symbol}
        renderItem={renderItem}
        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={() => load({ refresh: true })} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{t('screenQuant')}</Text>
            <Text style={styles.subtitle}>{t('quantSubtitle')}</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <FontAwesome name="calculator" size={18} color={theme.textMuted} />
            <Text style={styles.emptyText}>{t('quantEmpty')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function QuantCard({
  item,
  styles,
  theme,
  t,
}: {
  item: SignalApiQuantSignal;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
  t: (id: MessageId, vars?: Record<string, string | number>) => string;
}) {
  const krw = isKrwQuote(item);
  const quote = item.quote;
  const moveColor = Number(quote.changePercent ?? 0) >= 0 ? theme.danger : theme.accentBlue;
  const scoreTone = scoreColor(theme, item.score);
  const displayName = item.name || item.displaySymbol || item.symbol;
  const symbol = item.krxSymbol || item.displaySymbol || item.symbol;
  const reasonCodes = item.reasonCodes.length > 0 ? item.reasonCodes.slice(0, 4) : ['price_stable'];
  const riskLabel = t(RISK_LABELS[item.risk] ?? 'quantRiskLow');

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.symbolBlock}>
          <Text style={styles.symbolText} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.nameText} numberOfLines={1}>
            {symbol}
          </Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>{t('quantScore')}</Text>
          <Text style={[styles.scoreValue, { color: scoreTone }]}>{item.score}</Text>
        </View>
      </View>

      <View style={styles.priceRow}>
        <Text style={styles.priceText}>{formatPrice(quote.currentPrice, krw)}</Text>
        <Text style={[styles.changeText, { color: moveColor }]}>{formatPct(quote.changePercent)}</Text>
      </View>

      <View style={styles.factorGrid}>
        <Factor label={t('quantFactorMomentum')} value={item.factors.momentum} styles={styles} theme={theme} />
        <Factor label={t('quantFactorRegular')} value={item.factors.regularSession} styles={styles} theme={theme} />
        <Factor label={t('quantFactorFreshness')} value={item.factors.freshness} styles={styles} theme={theme} />
      </View>

      <View style={styles.reasonRow}>
        <Text style={styles.riskChip}>{riskLabel}</Text>
        {reasonCodes.map((code) => (
          <Text key={code} style={styles.reasonChip}>
            {t(REASON_LABELS[code] ?? 'quantReasonPriceStable')}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Factor({
  label,
  value,
  styles,
  theme,
}: {
  label: string;
  value: number;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
}) {
  const pct = `${Math.max(0, Math.min(100, Math.round(value)))}%` as DimensionValue;
  return (
    <View style={styles.factor}>
      <View style={styles.factorTop}>
        <Text style={styles.factorLabel}>{label}</Text>
        <Text style={styles.factorValue}>{Math.round(value)}</Text>
      </View>
      <View style={styles.factorTrack}>
        <View style={[styles.factorFill, { width: pct, backgroundColor: value >= 62 ? theme.green : theme.textMuted }]} />
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 28,
      gap: 10,
    },
    header: {
      marginBottom: 4,
      gap: 6,
    },
    title: {
      fontSize: sf(22),
      fontWeight: '900',
      color: theme.text,
      letterSpacing: 0,
    },
    subtitle: {
      fontSize: sf(13),
      lineHeight: sf(18),
      color: theme.textMuted,
    },
    errorText: {
      marginTop: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.danger,
      backgroundColor: theme.dangerDim,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: sf(13),
      fontWeight: '700',
      color: theme.danger,
    },
    card: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 14,
      gap: 12,
    },
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    symbolBlock: { flex: 1, minWidth: 0 },
    symbolText: {
      fontSize: sf(17),
      fontWeight: '900',
      color: theme.text,
      letterSpacing: 0,
    },
    nameText: {
      marginTop: 3,
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.textDim,
    },
    scoreBox: {
      minWidth: 58,
      alignItems: 'flex-end',
      gap: 1,
    },
    scoreLabel: {
      fontSize: sf(10),
      fontWeight: '800',
      color: theme.textMuted,
    },
    scoreValue: {
      fontSize: sf(26),
      fontWeight: '900',
      letterSpacing: 0,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 10,
    },
    priceText: {
      fontSize: sf(18),
      fontWeight: '900',
      color: theme.text,
    },
    changeText: {
      fontSize: sf(14),
      fontWeight: '900',
    },
    factorGrid: {
      gap: 8,
    },
    factor: { gap: 5 },
    factorTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    factorLabel: {
      fontSize: sf(11),
      fontWeight: '800',
      color: theme.textMuted,
    },
    factorValue: {
      fontSize: sf(11),
      fontWeight: '900',
      color: theme.text,
    },
    factorTrack: {
      height: 5,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: theme.bgElevated,
    },
    factorFill: {
      height: '100%',
      borderRadius: 999,
    },
    reasonRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    riskChip: {
      overflow: 'hidden',
      borderRadius: 999,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      paddingHorizontal: 8,
      paddingVertical: 4,
      fontSize: sf(11),
      fontWeight: '800',
      color: theme.green,
    },
    reasonChip: {
      overflow: 'hidden',
      borderRadius: 999,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 8,
      paddingVertical: 4,
      fontSize: sf(11),
      fontWeight: '800',
      color: theme.textMuted,
    },
    emptyCard: {
      marginTop: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 18,
      alignItems: 'center',
      gap: 8,
    },
    emptyText: {
      textAlign: 'center',
      fontSize: sf(13),
      fontWeight: '700',
      color: theme.textMuted,
    },
  });
}
