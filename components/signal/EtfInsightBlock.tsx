import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChangeHeatmapGrid, type ChangeHeatmapCell } from '@/components/signal/ChangeHeatmapGrid';
import { ChangeTintedText } from '@/components/signal/ChangeTintedText';
import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import {
  briefingSourceIconEntries,
  SourceIconStack,
} from '@/components/signal/SourceIconStack';
import { SymbolIdentityChip } from '@/components/signal/SymbolIdentityChip';
import { SymbolLinkedTintedText } from '@/components/signal/SymbolLinkedTintedText';
import { FEED_META_TIME_PX } from '@/constants/feedTypography';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { parseEtfFlowHighlights } from '@/domain/etfInsights/flowHighlights';
import {
  etfInsightDisplayTicker,
  isKoreaEtfSymbol,
  openEtfInsightSymbol,
} from '@/domain/etfInsights/openSymbol';
import { useQuoteChangeColors } from '@/hooks/useQuoteChangeColors';
import {
  getQuoteChangeColors,
  type QuotesChangeColorConvention,
} from '@/domain/quotes/changeColorConvention';
import type { SignalApiEtfInsight } from '@/integrations/signal-api/types';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
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

function trendColor(trend: string, theme: AppTheme, up: string, down: string): string {
  if (trend === '▲' || trend === 'up' || trend === '강세' || trend === '상승' || trend === '상승세') {
    return up;
  }
  if (
    trend === '▽' ||
    trend === '▼' ||
    trend === 'down' ||
    trend === '약세' ||
    trend === '하락' ||
    trend === '하락세'
  ) {
    return down;
  }
  return theme.textMuted;
}

function parseHeatCells(insight: SignalApiEtfInsight, t: (key: string, params?: Record<string, string>) => string): ChangeHeatmapCell[] {
  const raw = Array.isArray(insight.heatmap) ? insight.heatmap : [];
  const cells: ChangeHeatmapCell[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index] && typeof raw[index] === 'object' ? (raw[index] as Record<string, unknown>) : {};
    const etf = String(item.etf ?? item.symbol ?? '').trim();
    const sector = String(item.sector ?? item.name ?? item.label ?? '').trim();
    if (!etf && !sector) continue;
    const market = String(item.market ?? '').trim() || null;
    const pct =
      typeof item.changePercent === 'number' && Number.isFinite(item.changePercent)
        ? item.changePercent
        : null;
    const ticker = etfInsightDisplayTicker(etf) || sector || '—';
    const korea = etf ? isKoreaEtfSymbol(etf, market) : false;
    const a11y = etf
      ? korea
        ? t('quotesNaverFinanceA11y', { symbol: ticker })
        : t('quotesYahooFinanceA11y', { symbol: ticker })
      : undefined;
    cells.push({
      key: `${insight.id}-heat-${etf || sector}-${index}`,
      title: ticker,
      subtitle: sector && etf ? sector : null,
      changePercent: pct,
      displayPercent: pct,
      onPress: etf ? () => openEtfInsightSymbol(etf, market) : undefined,
      accessibilityLabel: a11y,
    });
  }
  return cells.sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
}

/** 시장 브리핑과 보완: 히트맵(시각) · 테마=종목 플로우(내러티브) */
export function EtfInsightBlock({ insight, theme, scaleFont }: Props) {
  const { t, locale } = useLocale();
  const { effectiveColorScheme, feedTypo } = useSignalTheme();
  const quoteChange = useQuoteChangeColors();
  const changeColorConvention = (quoteChange.convention ?? 'korea') as QuotesChangeColorConvention;
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const changeColors = useMemo(
    () => getQuoteChangeColors(changeColorConvention, effectiveColorScheme),
    [changeColorConvention, effectiveColorScheme],
  );

  const insights = (insight.insights || []).map((line) => String(line || '').trim()).filter(Boolean);
  const themes = useMemo(() => {
    const raw = Array.isArray(insight.themes) ? insight.themes : [];
    return raw
      .map((item, index) => {
        if (typeof item === 'string') {
          const summary = item.trim();
          if (!summary) return null;
          return {
            key: `${insight.id}-theme-${index}`,
            name: '',
            summary,
            momentum: '',
            etfs: [] as string[],
          };
        }
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        const name = String(row.name ?? row.label ?? row.title ?? '').trim();
        const summary = String(row.summary ?? '').trim();
        const momentum = String(row.momentum ?? '').trim();
        const etfs = Array.isArray(row.etfs)
          ? row.etfs.map((v) => String(v || '').trim()).filter(Boolean)
          : [];
        if (!name && !summary) return null;
        return {
          key: `${insight.id}-theme-${index}`,
          name,
          summary,
          momentum,
          etfs,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);
  }, [insight.id, insight.themes]);
  const heatmapCells = useMemo(() => parseHeatCells(insight, t as never), [insight, t]);
  const flows = useMemo(
    () => parseEtfFlowHighlights(insight.flowHighlights, insight.id),
    [insight.flowHighlights, insight.id],
  );
  /** 테마 본문 링크용 — 히트맵·테마 `etfs` 티커만 (섹터명 오탐 방지) */
  const themeBodyLinkSymbols = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    const add = (raw: unknown) => {
      const symbol = String(raw ?? '').trim();
      if (!symbol) return;
      const key = symbol.toUpperCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(symbol);
    };
    const heatRaw = Array.isArray(insight.heatmap) ? insight.heatmap : [];
    for (const item of heatRaw) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      add(row.etf ?? row.symbol);
    }
    for (const row of themes) {
      for (const sym of row.etfs) add(sym);
    }
    return out;
  }, [insight.heatmap, themes]);
  const sources = useMemo(() => {
    const raw = Array.isArray(insight.sourceRefs) ? insight.sourceRefs : [];
    return raw.filter((ref) => {
      const title = String(ref?.title || ref?.sourceName || ref?.url || '').trim();
      return Boolean(title);
    });
  }, [insight.sourceRefs]);
  const rotation = insight.rotation && typeof insight.rotation === 'object' ? insight.rotation : null;
  const rotationFrom = String(rotation?.from ?? '').trim();
  const rotationTo = String(rotation?.to ?? '').trim();
  const summaryText = insight.summary?.trim() || '';
  const hasLead = Boolean(summaryText) || insights.length > 0 || Boolean(rotationFrom || rotationTo);

  return (
    <View style={styles.block}>
      {hasLead ? (
        <View style={styles.leadPanel}>
          {summaryText ? <ChangeTintedText style={styles.summary}>{summaryText}</ChangeTintedText> : null}

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
              {summaryText || rotationFrom || rotationTo ? <View style={styles.leadDivider} /> : null}
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

      {heatmapCells.length > 0 ? (
        <InsightSection title={t('etfInsightHeatmap')} styles={styles}>
          <ChangeHeatmapGrid
            cells={heatmapCells}
            theme={theme}
            scaleFont={scaleFont}
            changeColorConvention={changeColorConvention}
          />
        </InsightSection>
      ) : null}

      {themes.length > 0 ? (
        <InsightSection title={t('etfInsightThemes')} styles={styles}>
          <View style={styles.sectionFeedCard}>
            {themes.map((item, index) => {
              const linkSymbols =
                item.etfs.length > 0
                  ? [...item.etfs, ...themeBodyLinkSymbols]
                  : themeBodyLinkSymbols;
              const momentumColor = item.momentum
                ? trendColor(item.momentum, theme, changeColors.up, changeColors.down)
                : theme.textMuted;
              return (
                <View
                  key={item.key}
                  style={[styles.themeRow, index < themes.length - 1 && styles.listRowBordered]}>
                  {item.name || item.momentum ? (
                    <View style={styles.themeTopRow}>
                      {item.name ? (
                        <Text style={styles.themeName} numberOfLines={1}>
                          {item.name}
                        </Text>
                      ) : (
                        <View style={styles.themeNameSpacer} />
                      )}
                      {item.momentum ? (
                        <Text style={[styles.themeMomentum, { color: momentumColor }]} numberOfLines={1}>
                          {item.momentum}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  {item.summary ? (
                    <SymbolLinkedTintedText
                      style={styles.themeSummary}
                      linkSymbols={linkSymbols}>
                      {item.summary}
                    </SymbolLinkedTintedText>
                  ) : null}
                </View>
              );
            })}
          </View>
        </InsightSection>
      ) : null}

      {flows.length > 0 ? (
        <InsightSection title={t('etfInsightFlows')} styles={styles}>
          <View style={styles.sectionFeedCard}>
            {flows.map((flow, index) => {
              const ticker = flow.etf ? etfInsightDisplayTicker(flow.etf) : '';
              const actionLabel =
                flow.actionKind === 'inflow'
                  ? t('etfInsightFlowInflow')
                  : flow.actionKind === 'outflow'
                    ? t('etfInsightFlowOutflow')
                    : flow.action;
              const actionColor =
                flow.actionKind === 'inflow'
                  ? changeColors.up
                  : flow.actionKind === 'outflow'
                    ? changeColors.down
                    : theme.textMuted;
              const trailBits = [actionLabel, flow.amountLabel].filter(Boolean);
              const korea = flow.etf ? isKoreaEtfSymbol(flow.etf, flow.market) : false;
              const openSymbol = flow.etf
                ? () => openEtfInsightSymbol(flow.etf!, flow.market)
                : undefined;
              const sourceName = flow.sourceName?.trim() || null;
              const sourceUrl = flow.url?.trim() || null;
              const sourceEntries =
                sourceName || sourceUrl
                  ? briefingSourceIconEntries([
                      { sourceName: sourceName || t('etfInsightFlowOpenSource'), url: sourceUrl },
                    ])
                  : [];
              const openSource = sourceUrl
                ? () => {
                    void Linking.openURL(sourceUrl);
                  }
                : undefined;
              return (
                <View
                  key={flow.key}
                  style={[styles.flowRow, index < flows.length - 1 && styles.listRowBordered]}>
                  <View style={styles.flowTopRow}>
                    {flow.etf ? (
                      <SymbolIdentityChip
                        symbol={flow.etf}
                        label={ticker}
                        labelKind="ticker"
                        onPress={openSymbol}
                        accessibilityLabel={
                          korea
                            ? t('quotesNaverFinanceA11y', { symbol: ticker })
                            : t('quotesYahooFinanceA11y', { symbol: ticker })
                        }
                      />
                    ) : flow.signal ? (
                      <ChangeTintedText style={styles.themeNameFallback}>{flow.signal}</ChangeTintedText>
                    ) : null}
                    {trailBits.length > 0 ? (
                      <Text style={[styles.flowTrail, { color: actionColor }]}>
                        {trailBits.join(' · ')}
                      </Text>
                    ) : null}
                  </View>
                  {flow.etf && flow.signal ? (
                    <ChangeTintedText style={styles.themeSummary}>{flow.signal}</ChangeTintedText>
                  ) : null}
                  {sourceEntries.length > 0 ? (
                    <Pressable
                      onPress={openSource}
                      disabled={!openSource}
                      style={({ pressed }) => [
                        styles.flowSourceFooter,
                        pressed && openSource ? styles.flowSourcePressed : null,
                      ]}
                      accessibilityRole={openSource ? 'link' : 'text'}
                      accessibilityLabel={
                        sourceName || (openSource ? t('etfInsightFlowOpenSource') : undefined)
                      }>
                      <SourceIconStack sources={sourceEntries} size={18} maxVisible={2} />
                      {sourceName ? <Text style={styles.flowSourceTrail}>{sourceName}</Text> : null}
                    </Pressable>
                  ) : null}
                </View>
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
              return (
                <HomeDigestFeedRow
                  key={`${insight.id}-src-${index}`}
                  title={title}
                  titleLines={null}
                  trailText={ref.sourceName?.trim() || null}
                  timeLabel={
                    ref.publishedAt ? formatFeedItemTimeLabel(ref.publishedAt, locale) : null
                  }
                  sourceEntries={briefingSourceIconEntries([ref])}
                  bordered={index < sources.length - 1}
                  onPress={
                    ref.url
                      ? () => {
                          void Linking.openURL(ref.url!);
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
    themeRow: {
      gap: 4,
      paddingVertical: 7,
    },
    themeTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      minWidth: 0,
    },
    themeName: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: ft.ff(14),
      lineHeight: sf(20),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    themeNameSpacer: {
      flex: 1,
      minWidth: 0,
    },
    themeMomentum: {
      fontSize: ft.ff(12),
      lineHeight: sf(16),
      fontWeight: ft.metaWeight,
      flexShrink: 0,
      fontVariant: ['tabular-nums'],
    },
    themeSummary: {
      fontSize: ft.signalBodyFont(13),
      fontWeight: ft.signalMetaWeight,
      color: theme.textDim,
      lineHeight: sf(19),
    },
    themeNameFallback: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.ff(14),
      lineHeight: sf(20),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    flowRow: {
      gap: 4,
      paddingVertical: 7,
    },
    flowTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      minWidth: 0,
    },
    flowTrail: {
      fontSize: ft.ff(12),
      lineHeight: sf(16),
      fontWeight: ft.metaWeight,
      flexShrink: 1,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
    flowSourceFooter: {
      marginTop: 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      minWidth: 0,
      maxWidth: '100%',
    },
    flowSourcePressed: {
      opacity: 0.72,
    },
    flowSourceTrail: {
      flexShrink: 1,
      minWidth: 0,
      fontSize: ft.ff(FEED_META_TIME_PX),
      lineHeight: sf(14),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
  });
}
