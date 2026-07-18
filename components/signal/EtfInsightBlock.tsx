import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ChangeTintedText } from '@/components/signal/ChangeTintedText';
import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import { briefingSourceIconEntries } from '@/components/signal/SourceIconStack';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useQuoteChangeColors } from '@/hooks/useQuoteChangeColors';
import {
  getQuoteChangeColors,
  isQuoteChangePositive,
} from '@/domain/quotes/changeColorConvention';
import type { SignalApiEtfInsight } from '@/integrations/signal-api/types';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';
import { formatFeedItemTimeLabel } from '@/utils/date';

type Props = {
  insight: SignalApiEtfInsight;
  theme: AppTheme;
  scaleFont: (n: number) => number;
};

function InsightSection({
  title,
  children,
  styles,
}: {
  title: string;
  children: ReactNode;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function formatChangePct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function heatmapTrend(item: Record<string, unknown>): string {
  const trend = String(item.trend ?? '').trim();
  if (trend) return trend;
  const pct = item.changePercent;
  if (typeof pct === 'number' && Number.isFinite(pct)) {
    if (pct > 0.15) return '▲';
    if (pct < -0.15) return '▽';
  }
  return '→';
}

function trendColor(trend: string, theme: AppTheme, up: string, down: string): string {
  if (trend === '▲' || trend === 'up' || trend === '강세' || trend === '상승') return up;
  if (trend === '▽' || trend === 'down' || trend === '약세' || trend === '하락') return down;
  return theme.textMuted;
}

/** 시장 브리핑 `MarketBriefingBlock`과 같은 밀도·섹션 구조 */
export function EtfInsightBlock({ insight, theme, scaleFont }: Props) {
  const { t, locale } = useLocale();
  const { effectiveColorScheme, feedTypo } = useSignalTheme();
  const quoteChange = useQuoteChangeColors();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const changeColors = getQuoteChangeColors(quoteChange.convention ?? 'korea', effectiveColorScheme);

  const insights = (insight.insights || []).map((line) => String(line || '').trim()).filter(Boolean);
  const themes = Array.isArray(insight.themes) ? insight.themes : [];
  const heatmap = Array.isArray(insight.heatmap) ? insight.heatmap : [];
  const flows = Array.isArray(insight.flowHighlights) ? insight.flowHighlights : [];
  const sources = Array.isArray(insight.sourceRefs) ? insight.sourceRefs : [];
  const rotation = insight.rotation && typeof insight.rotation === 'object' ? insight.rotation : null;
  const rotationFrom = String(rotation?.from ?? '').trim();
  const rotationTo = String(rotation?.to ?? '').trim();
  const hasLead = Boolean(insight.summary?.trim()) || insights.length > 0 || Boolean(rotationFrom || rotationTo);

  return (
    <View style={styles.block}>
      {hasLead ? (
        <View style={styles.leadPanel}>
          {insight.summary?.trim() ? (
            <ChangeTintedText style={styles.summary}>{insight.summary.trim()}</ChangeTintedText>
          ) : null}

          {rotationFrom || rotationTo ? (
            <View style={styles.rotationRow}>
              <Text style={styles.rotationKicker}>{t('etfInsightRotation')}</Text>
              <Text style={styles.rotationText} numberOfLines={2}>
                {[rotationFrom, rotationTo].filter(Boolean).join(' → ')}
              </Text>
            </View>
          ) : null}

          {insights.length > 0 ? (
            <View style={styles.overviewBlock}>
              {insight.summary?.trim() || rotationFrom || rotationTo ? (
                <View style={styles.leadDivider} />
              ) : null}
              <Text style={styles.overviewKicker}>{t('etfInsightKeyPoints')}</Text>
              <View style={styles.overviewList}>
                {insights.map((line, index) => (
                  <View key={`${insight.id}-point-${index}`} style={styles.overviewRow}>
                    <View style={styles.overviewDot} />
                    <ChangeTintedText style={styles.overviewText}>{line}</ChangeTintedText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {heatmap.length > 0 ? (
        <InsightSection title={t('etfInsightHeatmap')} styles={styles}>
          <View style={styles.sectionFeedCard}>
            {heatmap.map((raw, index) => {
              const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
              const sector = String(item.sector ?? item.name ?? item.label ?? '').trim();
              const etf = String(item.etf ?? item.symbol ?? '').trim();
              const pct = typeof item.changePercent === 'number' ? item.changePercent : null;
              const trend = heatmapTrend(item);
              const color = trendColor(trend, theme, changeColors.up, changeColors.down);
              const positive = pct == null ? null : isQuoteChangePositive({ changePercent: pct });
              const pctColor =
                positive === null ? theme.textMuted : positive ? changeColors.up : changeColors.down;
              return (
                <View
                  key={`${insight.id}-heat-${index}`}
                  style={[styles.heatRow, index < heatmap.length - 1 && styles.listRowBordered]}>
                  <Text style={[styles.heatTrend, { color }]}>{trend}</Text>
                  <View style={styles.heatIdentity}>
                    <Text style={styles.heatSector} numberOfLines={1}>
                      {sector || etf || '—'}
                    </Text>
                    {sector && etf ? (
                      <Text style={styles.heatTicker} numberOfLines={1}>
                        {etf}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.heatPct, { color: pctColor }]}>{formatChangePct(pct)}</Text>
                </View>
              );
            })}
          </View>
        </InsightSection>
      ) : null}

      {themes.length > 0 ? (
        <InsightSection title={t('etfInsightThemes')} styles={styles}>
          <View style={styles.sectionFeedCard}>
            {themes.map((raw, index) => {
              const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
              const name = String(item.name ?? item.label ?? item.title ?? '').trim();
              const summary = String(item.summary ?? '').trim();
              const momentum = String(item.momentum ?? '').trim();
              const etfs = Array.isArray(item.etfs)
                ? item.etfs.map((v) => String(v || '').trim()).filter(Boolean)
                : [];
              const momentumColor = trendColor(momentum, theme, changeColors.up, changeColors.down);
              return (
                <View
                  key={`${insight.id}-theme-${index}`}
                  style={[styles.themeRow, index < themes.length - 1 && styles.listRowBordered]}>
                  <View style={styles.themeTop}>
                    <Text style={styles.themeName} numberOfLines={2}>
                      {name || '—'}
                    </Text>
                    {momentum ? (
                      <Text style={[styles.themeMomentum, { color: momentumColor }]}>{momentum}</Text>
                    ) : null}
                  </View>
                  {etfs.length > 0 ? (
                    <Text style={styles.themeEtfs} numberOfLines={1}>
                      {etfs.join(' · ')}
                    </Text>
                  ) : null}
                  {summary ? <ChangeTintedText style={styles.themeSummary}>{summary}</ChangeTintedText> : null}
                </View>
              );
            })}
          </View>
        </InsightSection>
      ) : null}

      {flows.length > 0 ? (
        <InsightSection title={t('etfInsightFlows')} styles={styles}>
          <View style={styles.sectionFeedCard}>
            {flows.map((raw, index) => {
              const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
              const title =
                typeof raw === 'string'
                  ? raw.trim()
                  : String(item?.label ?? item?.name ?? item?.title ?? item?.symbol ?? '').trim();
              const trail =
                item && typeof item.value === 'string'
                  ? item.value.trim()
                  : item && typeof item.changePercent === 'number'
                    ? formatChangePct(item.changePercent)
                    : null;
              if (!title) return null;
              return (
                <HomeDigestFeedRow
                  key={`${insight.id}-flow-${index}`}
                  title={title}
                  titleLines={null}
                  trailText={trail}
                  bordered={index < flows.length - 1}
                />
              );
            })}
          </View>
        </InsightSection>
      ) : null}

      {sources.length > 0 ? (
        <InsightSection title={t('etfInsightSources')} styles={styles}>
          <View style={styles.sectionFeedCard}>
            {sources.map((ref, index) => {
              const title = String(ref.title || ref.sourceName || ref.url || '').trim();
              if (!title) return null;
              return (
                <HomeDigestFeedRow
                  key={`${insight.id}-src-${index}`}
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
        </InsightSection>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  const leadTint =
    theme.green.startsWith('#') && theme.green.length === 7 ? `${theme.green}0A` : theme.bgElevated;

  return StyleSheet.create({
    block: {
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
    leadDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginBottom: 2,
    },
    summary: {
      fontSize: ft.signalBodyFont(15),
      lineHeight: sf(23),
      fontWeight: ft.signalBodyWeight,
      color: theme.text,
    },
    rotationRow: {
      gap: 4,
    },
    rotationKicker: {
      fontSize: ft.ff(12),
      lineHeight: sf(16),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    rotationText: {
      fontSize: ft.ff(14),
      lineHeight: sf(20),
      fontWeight: ft.emphasisWeight,
      color: theme.green,
    },
    overviewBlock: {
      gap: 10,
    },
    overviewKicker: {
      fontSize: ft.ff(12),
      lineHeight: sf(16),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
      letterSpacing: 0.1,
    },
    overviewList: {
      gap: 10,
    },
    overviewRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    overviewDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.green,
      marginTop: sf(8),
      flexShrink: 0,
    },
    overviewText: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.signalBodyFont(15),
      lineHeight: sf(23),
      fontWeight: ft.signalBodyWeight,
      color: theme.textDim,
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
    listRowBordered: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    heatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
    },
    heatTrend: {
      fontSize: ft.ff(15),
      fontWeight: ft.titleWeight,
      width: 20,
      textAlign: 'center',
      flexShrink: 0,
    },
    heatIdentity: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    heatSector: {
      fontSize: ft.ff(13),
      fontWeight: ft.emphasisWeight,
      color: theme.text,
    },
    heatTicker: {
      fontSize: ft.ff(11),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
      fontVariant: ['tabular-nums'],
    },
    heatPct: {
      fontSize: ft.ff(13),
      fontWeight: ft.emphasisWeight,
      fontVariant: ['tabular-nums'],
      flexShrink: 0,
    },
    themeRow: {
      gap: 4,
      paddingVertical: 8,
    },
    themeTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    themeName: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.ff(14),
      lineHeight: sf(20),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    themeMomentum: {
      fontSize: ft.ff(12),
      lineHeight: sf(16),
      fontWeight: ft.emphasisWeight,
      flexShrink: 0,
    },
    themeEtfs: {
      fontSize: ft.ff(11),
      lineHeight: sf(15),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
      fontVariant: ['tabular-nums'],
    },
    themeSummary: {
      fontSize: ft.signalBodyFont(13),
      fontWeight: ft.signalMetaWeight,
      color: theme.textDim,
      lineHeight: sf(19),
    },
  });
}
