import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';
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

const PAGE_LIMIT = 10;

type QuantLensKey = 'health' | 'timing' | 'risk' | 'scenario';

type LensView = {
  label: string;
  scoreLabel: string;
  score: number;
  status: string;
  tone: 'positive' | 'neutral' | 'caution';
  bullets: string[];
  metrics: { label: string; value: string }[];
};

const LENS_KEYS: QuantLensKey[] = ['health', 'timing', 'risk', 'scenario'];

const LENS_LABELS: Record<QuantLensKey, MessageId> = {
  health: 'quantLensHealth',
  timing: 'quantLensTiming',
  risk: 'quantLensRisk',
  scenario: 'quantLensScenario',
};

const REASON_LABELS: Record<string, MessageId> = {
  trend_up: 'quantReasonTrendUp',
  trend_down: 'quantReasonTrendDown',
  golden_cross_zone: 'quantReasonGoldenCross',
  dead_cross_zone: 'quantReasonDeadCross',
  momentum_strong: 'quantReasonMomentumStrong',
  momentum_weak: 'quantReasonMomentumWeak',
  near_52w_high: 'quantReasonNear52wHigh',
  near_52w_low: 'quantReasonNear52wLow',
  overbought: 'quantReasonOverbought',
  overbought_mild: 'quantReasonOverboughtMild',
  oversold: 'quantReasonOversold',
  oversold_mild: 'quantReasonOversoldMild',
  volume_spike: 'quantReasonVolumeSpike',
  volume_active: 'quantReasonVolumeActive',
  volume_dry: 'quantReasonVolumeDry',
  range_bound: 'quantReasonRangeBound',
};

const RISK_LABELS: Record<string, MessageId> = {
  low: 'quantRiskLow',
  medium: 'quantRiskMedium',
  high: 'quantRiskHigh',
  unknown: 'quantRiskUnknown',
};

const ACTION_LABELS: Record<string, MessageId> = {
  buy: 'quantActionBuy',
  accumulate: 'quantActionAccumulate',
  hold: 'quantActionHold',
  reduce: 'quantActionReduce',
  avoid: 'quantActionAvoid',
};

function isKrwQuote(item: SignalApiQuantSignal): boolean {
  return /^\d{6}$/.test(String(item.symbol || '')) || item.liveQuote?.segment === 'kr_after_hours';
}

function actionTone(theme: AppTheme, action: string): string {
  if (action === 'buy') return theme.danger;
  if (action === 'accumulate') return theme.green;
  if (action === 'reduce') return theme.accentBlue;
  if (action === 'avoid') return theme.textDim;
  return theme.textMuted;
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

function formatNumber(value: number | null | undefined, digits = 0, suffix = ''): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}${suffix}`;
}

function scoreColor(theme: AppTheme, score: number): string {
  if (score >= 75) return theme.danger;
  if (score >= 62) return theme.green;
  if (score >= 45) return theme.text;
  return theme.textDim;
}

function normalizeScore(value: number | null | undefined, fallback = 50): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function actionPriority(action: string): number {
  if (action === 'buy') return 5;
  if (action === 'accumulate') return 4;
  if (action === 'hold') return 3;
  if (action === 'reduce') return 2;
  if (action === 'avoid') return 1;
  return 0;
}

function riskPressure(item: SignalApiQuantSignal): number {
  const volatility = normalizeScore(item.indicators.volatility, 35);
  const rsi = item.indicators.rsi14;
  const overheat = typeof rsi === 'number' && Number.isFinite(rsi) ? Math.max(0, rsi - 60) * 1.8 : 0;
  const trendPenalty = Math.max(0, -(Number(item.indicators.vsSma20Pct) || 0)) * 2;
  const riskBase = item.risk === 'high' ? 24 : item.risk === 'medium' ? 12 : 0;
  return normalizeScore(volatility + overheat + trendPenalty + riskBase, 40);
}

function lensTone(score: number, inverse = false): LensView['tone'] {
  const effective = inverse ? 100 - score : score;
  if (effective >= 62) return 'positive';
  if (effective >= 42) return 'neutral';
  return 'caution';
}

function statusForScore(t: (id: MessageId, vars?: Record<string, string | number>) => string, score: number): string {
  if (score >= 70) return t('quantLensStatusStrong');
  if (score >= 55) return t('quantLensStatusWatch');
  if (score >= 40) return t('quantLensStatusNeutral');
  return t('quantLensStatusWeak');
}

function statusForRisk(t: (id: MessageId, vars?: Record<string, string | number>) => string, pressure: number): string {
  if (pressure >= 70) return t('quantLensStatusRiskHigh');
  if (pressure >= 50) return t('quantLensStatusRiskWatch');
  return t('quantLensStatusRiskLow');
}

function buildLensView(
  item: SignalApiQuantSignal,
  lens: QuantLensKey,
  t: (id: MessageId, vars?: Record<string, string | number>) => string,
): LensView {
  const indicators = item.indicators;
  const trend = normalizeScore(item.factors.trend);
  const momentum = normalizeScore(item.factors.momentum);
  const volume = normalizeScore(item.factors.volume);
  const confidence = normalizeScore(item.confidence);
  const ret20 = indicators.return20d;
  const vs20 = indicators.vsSma20Pct;
  const rsi = indicators.rsi14;
  const volatility = indicators.volatility;
  const positives = item.perspective?.positives?.filter(Boolean) ?? [];
  const cautions = item.perspective?.cautions?.filter(Boolean) ?? [];

  if (lens === 'health') {
    const score = normalizeScore(trend * 0.35 + momentum * 0.25 + volume * 0.2 + confidence * 0.2);
    return {
      label: t('quantLensHealth'),
      scoreLabel: t('quantLensHealthScore'),
      score,
      status: statusForScore(t, score),
      tone: lensTone(score),
      bullets: [
        positives[0] || t('quantLensHealthBulletTrend', { value: trend }),
        t('quantLensHealthBulletMomentum', { value: momentum }),
        t('quantLensHealthBulletConfidence', { value: confidence }),
      ],
      metrics: [
        { label: t('quantFactorTrend'), value: String(trend) },
        { label: t('quantFactorVolume'), value: String(volume) },
        { label: t('quantConfidence'), value: String(confidence) },
      ],
    };
  }

  if (lens === 'timing') {
    const score = normalizeScore(item.score);
    const pullbackLabel =
      typeof vs20 === 'number' && Number.isFinite(vs20) && vs20 < 0
        ? t('quantLensTimingPullback', { value: formatPct(vs20) })
        : t('quantLensTimingTrend', { value: formatPct(vs20) });
    return {
      label: t('quantLensTiming'),
      scoreLabel: t('quantChecklistScore'),
      score,
      status: t(ACTION_LABELS[item.action] ?? 'quantActionHold'),
      tone: lensTone(score),
      bullets: [
        item.headline || pullbackLabel,
        pullbackLabel,
        positives[0] || t('quantLensTimingBulletMomentum', { value: formatPct(ret20) }),
      ],
      metrics: [
        { label: t('quant20dReturn'), value: formatPct(ret20) },
        { label: t('quantIndicatorSma20'), value: formatPct(vs20) },
        { label: t('quantIndicatorRsi'), value: formatNumber(rsi, 0) },
      ],
    };
  }

  if (lens === 'risk') {
    const pressure = riskPressure(item);
    return {
      label: t('quantLensRisk'),
      scoreLabel: t('quantLensRiskScore'),
      score: pressure,
      status: statusForRisk(t, pressure),
      tone: lensTone(pressure, true),
      bullets: [
        cautions[0] || t('quantLensRiskBulletVolatility', { value: formatNumber(volatility, 0, '%') }),
        cautions[1] || t('quantLensRiskBulletRsi', { value: formatNumber(rsi, 0) }),
        t(RISK_LABELS[item.risk] ?? 'quantRiskUnknown'),
      ],
      metrics: [
        { label: t('quantIndicatorVol'), value: formatNumber(volatility, 0, '%') },
        { label: t('quantIndicatorRsi'), value: formatNumber(rsi, 0) },
        { label: t('quantIndicatorSma20'), value: formatPct(vs20) },
      ],
    };
  }

  const scenarioScore = normalizeScore(confidence * 0.4 + trend * 0.35 + Math.max(0, 100 - riskPressure(item)) * 0.25);
  return {
    label: t('quantLensScenario'),
    scoreLabel: t('quantLensScenarioScore'),
    score: scenarioScore,
    status: statusForScore(t, scenarioScore),
    tone: lensTone(scenarioScore),
    bullets: [
      item.perspective?.principle || t('quantLensScenarioBulletThesis'),
      positives[0] || t('quantLensScenarioBulletTrend', { value: trend }),
      cautions[0] || t('quantLensScenarioBulletCheckpoint'),
    ],
    metrics: [
      { label: t('quantConfidence'), value: String(confidence) },
      { label: t('quantFactorTrend'), value: String(trend) },
      { label: t('quantLensDataBars'), value: String(item.barCount || 0) },
    ],
  };
}

export default function QuantScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const [items, setItems] = useState<SignalApiQuantSignal[]>([]);
  const [lens, setLens] = useState<QuantLensKey>('timing');
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
        // Show the managed KOSPI market-cap universe in rank order rather than
        // filtering to the personal watchlist.
        const rows = await fetchSignalQuantSignals({ limit: PAGE_LIMIT });
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

  const displayItems = useMemo(() => {
    const rows = [...items];
    if (lens === 'health') {
      return rows.sort((a, b) => buildLensView(b, lens, t).score - buildLensView(a, lens, t).score);
    }
    if (lens === 'risk') {
      return rows.sort((a, b) => riskPressure(b) - riskPressure(a));
    }
    if (lens === 'scenario') {
      return rows.sort((a, b) => buildLensView(b, lens, t).score - buildLensView(a, lens, t).score);
    }
    return rows.sort((a, b) => actionPriority(b.action) - actionPriority(a.action) || b.score - a.score);
  }, [items, lens, t]);

  const renderItem = useCallback(
    ({ item }: { item: SignalApiQuantSignal }) => (
      <QuantCard item={item} lens={lens} styles={styles} theme={theme} t={t} />
    ),
    [lens, styles, t, theme],
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
        data={displayItems}
        keyExtractor={(item) => item.symbol}
        renderItem={renderItem}
        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={() => load({ refresh: true })} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{t('screenQuant')}</Text>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <View style={styles.lensTabs}>
              {LENS_KEYS.map((key) => {
                const active = lens === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setLens(key)}
                    style={[styles.lensTab, active && styles.lensTabActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}>
                    <Text style={[styles.lensTabText, active && styles.lensTabTextActive]}>
                      {t(LENS_LABELS[key])}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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
  lens,
  styles,
  theme,
  t,
}: {
  item: SignalApiQuantSignal;
  lens: QuantLensKey;
  styles: ReturnType<typeof makeStyles>;
  theme: AppTheme;
  t: (id: MessageId, vars?: Record<string, string | number>) => string;
}) {
  const krw = isKrwQuote(item);
  const indicators = item.indicators;
  const return20d = indicators.return20d;
  const moveColor = Number(return20d ?? 0) >= 0 ? theme.danger : theme.accentBlue;
  const scoreTone = scoreColor(theme, item.score);
  const displayName = item.name || item.displaySymbol || item.symbol;
  const symbol = item.displaySymbol || item.symbol;
  const reasonCodes = item.reasonCodes.length > 0 ? item.reasonCodes.slice(0, 4) : ['range_bound'];
  const riskLabel = t(RISK_LABELS[item.risk] ?? 'quantRiskUnknown');
  const actionLabel = t(ACTION_LABELS[item.action] ?? 'quantActionHold');
  const actionColor = actionTone(theme, item.action);
  const rank = typeof item.rank === 'number' && item.rank > 0 ? item.rank : null;
  const interpretation = item.interpretation?.trim() || null;
  const perspective = item.perspective ?? null;
  const positives = Array.isArray(perspective?.positives) ? perspective.positives.filter(Boolean).slice(0, 3) : [];
  const cautions = Array.isArray(perspective?.cautions) ? perspective.cautions.filter(Boolean).slice(0, 2) : [];
  const lensView = buildLensView(item, lens, t);
  const lensScoreTone = lensView.tone === 'positive' ? theme.green : lensView.tone === 'caution' ? theme.danger : theme.textMuted;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.symbolBlock}>
          {rank ? <Text style={styles.rankBadge}>{t('quantRankBadge', { rank })}</Text> : null}
          <Text style={styles.symbolText} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.nameText} numberOfLines={1}>
            {symbol}
          </Text>
        </View>
        <View style={styles.scoreBox}>
          <Text style={styles.scoreLabel}>{lensView.scoreLabel}</Text>
          <Text style={[styles.scoreValue, { color: lens === 'risk' ? lensScoreTone : scoreTone }]}>
            {lensView.score}
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Text style={[styles.actionBadge, { color: actionColor, borderColor: actionColor }]}>{actionLabel}</Text>
        <Text style={styles.confidenceText}>
          {t('quantConfidence')} {item.confidence}
        </Text>
      </View>

      <View style={[styles.lensBox, { borderColor: lensScoreTone }]}>
        <View style={styles.lensBoxHead}>
          <Text style={[styles.lensBadge, { color: lensScoreTone, borderColor: lensScoreTone }]}>
            {lensView.status}
          </Text>
          <Text style={styles.lensTitle}>{lensView.label}</Text>
        </View>
        <View style={styles.lensMetricRow}>
          {lensView.metrics.map((metric) => (
            <View key={`${lens}-${metric.label}`} style={styles.lensMetric}>
              <Text style={styles.lensMetricLabel}>{metric.label}</Text>
              <Text style={styles.lensMetricValue}>{metric.value}</Text>
            </View>
          ))}
        </View>
        <View style={styles.checkBlock}>
          {lensView.bullets.filter(Boolean).slice(0, 3).map((text, index) => (
            <View key={`${lens}-bullet-${index}`} style={styles.checkRow}>
              <FontAwesome
                name={lens === 'risk' ? 'exclamation-circle' : index === 0 ? 'check-circle' : 'circle'}
                size={12}
                color={lensScoreTone}
              />
              <Text style={styles.checkText}>{text}</Text>
            </View>
          ))}
        </View>
      </View>

      {perspective && lens === 'timing' ? (
        <View style={styles.perspectiveBox}>
          <View style={styles.perspectiveHead}>
            <Text style={styles.perspectiveKicker}>{t('quantPerspectiveLabel')}</Text>
            <Text style={styles.perspectiveTitle}>{perspective.label}</Text>
          </View>
          {perspective.principle ? (
            <Text style={styles.perspectivePrinciple}>
              {t('quantPerspectivePrinciple')} · {perspective.principle}
            </Text>
          ) : null}
          {positives.length > 0 ? (
            <View style={styles.checkBlock}>
              <Text style={styles.checkBlockTitle}>{t('quantPerspectivePositive')}</Text>
              {positives.map((text, index) => (
                <View key={`positive-${index}`} style={styles.checkRow}>
                  <FontAwesome name="check-circle" size={12} color={theme.green} />
                  <Text style={styles.checkText}>{text}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {cautions.length > 0 ? (
            <View style={styles.checkBlock}>
              <Text style={styles.checkBlockTitle}>{t('quantPerspectiveCaution')}</Text>
              {cautions.map((text, index) => (
                <View key={`caution-${index}`} style={styles.checkRow}>
                  <FontAwesome name="exclamation-circle" size={12} color={theme.textMuted} />
                  <Text style={styles.checkText}>{text}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {interpretation ? (
        <View style={styles.interpretBox}>
          {item.headline ? <Text style={styles.interpretHeadline}>{item.headline}</Text> : null}
          <Text style={styles.interpretText}>{interpretation}</Text>
        </View>
      ) : null}

      <View style={styles.priceRow}>
        <Text style={styles.priceText}>{formatPrice(indicators.lastClose, krw)}</Text>
        <Text style={[styles.changeText, { color: moveColor }]}>
          {t('quant20dReturn')} {formatPct(return20d)}
        </Text>
      </View>

      <View style={styles.factorGrid}>
        <Factor label={t('quantFactorTrend')} value={item.factors.trend} styles={styles} theme={theme} />
        <Factor label={t('quantFactorMomentum')} value={item.factors.momentum} styles={styles} theme={theme} />
      </View>

      <View style={styles.indicatorRow}>
        <Indicator label={t('quantIndicatorRsi')} text={formatNumber(indicators.rsi14, 0)} styles={styles} />
        <Indicator label={t('quantIndicatorSma20')} text={formatPct(indicators.vsSma20Pct)} styles={styles} />
        <Indicator label={t('quantIndicatorVol')} text={formatNumber(indicators.volatility, 0, '%')} styles={styles} />
      </View>

      <View style={styles.reasonRow}>
        <Text style={styles.riskChip}>{riskLabel}</Text>
        {reasonCodes.map((code) => (
          <Text key={code} style={styles.reasonChip}>
            {t(REASON_LABELS[code] ?? 'quantReasonRangeBound')}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Indicator({
  label,
  text,
  styles,
}: {
  label: string;
  text: string;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.indicator}>
      <Text style={styles.indicatorLabel}>{label}</Text>
      <Text style={styles.indicatorValue}>{text}</Text>
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
      gap: 10,
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
    lensTabs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      paddingTop: 2,
    },
    lensTab: {
      minHeight: 34,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lensTabActive: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    lensTabText: {
      fontSize: sf(12),
      lineHeight: sf(17),
      fontWeight: '900',
      color: theme.textMuted,
    },
    lensTabTextActive: {
      color: theme.green,
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
    symbolBlock: { flex: 1, minWidth: 0, gap: 3 },
    rankBadge: {
      alignSelf: 'flex-start',
      overflow: 'hidden',
      borderRadius: 6,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      paddingHorizontal: 7,
      paddingVertical: 2,
      fontSize: sf(10),
      fontWeight: '900',
      color: theme.accentBlue,
    },
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
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    actionBadge: {
      overflow: 'hidden',
      borderRadius: 8,
      borderWidth: 1.5,
      paddingHorizontal: 10,
      paddingVertical: 4,
      fontSize: sf(14),
      fontWeight: '900',
      letterSpacing: 0,
    },
    confidenceText: {
      fontSize: sf(11),
      fontWeight: '800',
      color: theme.textMuted,
    },
    perspectiveBox: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      paddingHorizontal: 12,
      paddingVertical: 11,
      gap: 9,
    },
    perspectiveHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    },
    perspectiveKicker: {
      overflow: 'hidden',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.card,
      paddingHorizontal: 7,
      paddingVertical: 2,
      fontSize: sf(10),
      fontWeight: '900',
      color: theme.green,
    },
    perspectiveTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(14),
      lineHeight: sf(19),
      fontWeight: '900',
      color: theme.text,
    },
    perspectivePrinciple: {
      fontSize: sf(11),
      lineHeight: sf(16),
      fontWeight: '700',
      color: theme.textMuted,
    },
    checkBlock: {
      gap: 5,
    },
    checkBlockTitle: {
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '900',
      color: theme.text,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 7,
    },
    checkText: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(12),
      lineHeight: sf(17),
      fontWeight: '700',
      color: theme.text,
    },
    lensBox: {
      borderRadius: 14,
      borderWidth: 1,
      backgroundColor: theme.bgElevated,
      paddingHorizontal: 12,
      paddingVertical: 11,
      gap: 9,
    },
    lensBoxHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
    },
    lensBadge: {
      overflow: 'hidden',
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '900',
      backgroundColor: theme.card,
    },
    lensTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(14),
      lineHeight: sf(19),
      fontWeight: '900',
      color: theme.text,
    },
    lensMetricRow: {
      flexDirection: 'row',
      gap: 7,
    },
    lensMetric: {
      flex: 1,
      minWidth: 0,
      borderRadius: 10,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 8,
      paddingVertical: 7,
      gap: 2,
    },
    lensMetricLabel: {
      fontSize: sf(10),
      lineHeight: sf(14),
      fontWeight: '800',
      color: theme.textMuted,
    },
    lensMetricValue: {
      fontSize: sf(13),
      lineHeight: sf(18),
      fontWeight: '900',
      color: theme.text,
    },
    interpretBox: {
      borderRadius: 12,
      backgroundColor: theme.bgElevated,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
    },
    interpretHeadline: {
      fontSize: sf(12),
      fontWeight: '900',
      color: theme.text,
    },
    interpretText: {
      fontSize: sf(12),
      lineHeight: sf(18),
      fontWeight: '600',
      color: theme.textDim,
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
    indicatorRow: {
      flexDirection: 'row',
      gap: 8,
    },
    indicator: {
      flex: 1,
      borderRadius: 10,
      backgroundColor: theme.bgElevated,
      paddingHorizontal: 8,
      paddingVertical: 6,
      gap: 2,
    },
    indicatorLabel: {
      fontSize: sf(10),
      fontWeight: '800',
      color: theme.textMuted,
    },
    indicatorValue: {
      fontSize: sf(13),
      fontWeight: '900',
      color: theme.text,
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
