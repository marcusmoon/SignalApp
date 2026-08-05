import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { ChangeTintedText } from '@/components/signal/ChangeTintedText';
import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import { briefingSourceIconEntries } from '@/components/signal/SourceIconStack';
import { SymbolIdentityChip } from '@/components/signal/SymbolIdentityChip';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  briefingSectorHeatCells,
  type BriefingSectorHeatCell,
  sectorSummaryWhyText,
} from '@/domain/briefings/sectorHeatmap';
import { formatHeatChangePct, heatFillColor } from '@/domain/heatmaps/changeHeat';
import type { AppLocale } from '@/locales/messages';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import {
  getQuoteChangeColors,
  isQuoteChangePositive,
  type QuotesChangeColorConvention,
} from '@/domain/quotes/changeColorConvention';
import type {
  SignalApiMarketBriefing,
  SignalApiMarketBriefingCompany,
  SignalApiMarketBriefingMacroItem,
} from '@/integrations/signal-api/types';
import { formatFeedItemTimeLabel } from '@/utils/date';

function formatBriefingPrice(price: number | null | undefined, market: string): string {
  if (price == null || !Number.isFinite(price)) return '—';
  if (market === 'kr') {
    return `${Math.round(price).toLocaleString('ko-KR')}원`;
  }
  if (price >= 1000) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${price.toFixed(2)}`;
}

function formatChangePct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

type Props = {
  briefing: SignalApiMarketBriefing;
  theme: AppTheme;
  scaleFont: (n: number) => number;
  changeColorConvention: QuotesChangeColorConvention;
  /** 셸 헤드라인으로 summary를 쓴 경우 lead 중복 숨김 */
  omitSummary?: boolean;
};

function BriefingSection({
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

function CompanyHighlightRow({
  item,
  market,
  theme,
  styles,
  changeColors,
  bordered,
}: {
  item: SignalApiMarketBriefingCompany;
  market: string;
  theme: AppTheme;
  styles: ReturnType<typeof makeStyles>;
  changeColors: { up: string; down: string };
  bordered: boolean;
}) {
  const hasPrice = item.price != null && Number.isFinite(item.price);
  const hasChange = item.changePercent != null && Number.isFinite(item.changePercent);
  const changePositive = hasChange ? isQuoteChangePositive({ changePercent: item.changePercent }) : null;
  const changeColor =
    changePositive === null ? theme.textMuted : changePositive ? changeColors.up : changeColors.down;
  const companyName = item.name?.trim() || '';
  const resolvedName = item.symbolMeta?.name?.trim() || companyName || null;
  const resolvedLogoUrl = item.symbolMeta?.logoUrl || null;

  return (
    <View style={[styles.companyRow, bordered && styles.listRowBordered]}>
      <View style={styles.companyTopRow}>
        <SymbolIdentityChip
          symbol={item.symbol}
          identifier={item.symbol}
          name={resolvedName}
          imageUrl={resolvedLogoUrl}
          expandable={Boolean(resolvedName)}
        />
        {hasPrice || hasChange ? (
          <View style={styles.companyQuoteInline}>
            {hasPrice ? (
              <Text style={styles.companyPrice} numberOfLines={1}>
                {formatBriefingPrice(item.price, market)}
              </Text>
            ) : null}
            {hasChange ? (
              <Text style={[styles.companyChange, { color: changeColor }]} numberOfLines={1}>
                {formatChangePct(item.changePercent)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      <ChangeTintedText style={styles.companySummary}>
        {item.summary}
      </ChangeTintedText>
    </View>
  );
}

function MacroHighlightRow({
  item,
  bordered,
  locale,
}: {
  item: SignalApiMarketBriefingMacroItem;
  bordered: boolean;
  locale: AppLocale;
}) {
  const sourceName = item.sourceName?.trim() || null;
  const sourceUrl = item.sourceUrl?.trim() || null;

  return (
    <HomeDigestFeedRow
      title={item.title}
      titleLines={null}
      summary={item.summary}
      summaryLines={null}
      trailText={sourceName}
      timeLabel={formatFeedItemTimeLabel(item.publishedAt || item.checkedAt, locale)}
      sourceEntries={
        sourceName ? briefingSourceIconEntries([{ sourceName, url: sourceUrl }]) : []
      }
      bordered={bordered}
      onPress={
        sourceUrl
          ? () => {
              void Linking.openURL(sourceUrl);
            }
          : undefined
      }
    />
  );
}

/** 섹터 흐름: 리스트 + 히트맵 순. 첫 행만 heat (이름·등락). 종목·티커는 본문/companies에 맡김 */
function SectorFlowRow({
  cell,
  theme,
  styles,
  changeColors,
  bordered,
}: {
  cell: BriefingSectorHeatCell;
  theme: AppTheme;
  styles: ReturnType<typeof makeStyles>;
  changeColors: { up: string; down: string };
  bordered: boolean;
}) {
  const why = sectorSummaryWhyText(cell.summary);
  const heatPct = cell.heatPercent;
  const positive = heatPct == null ? null : isQuoteChangePositive({ changePercent: heatPct });
  const pctColor =
    positive === null ? theme.textMuted : positive ? changeColors.up : changeColors.down;
  const topFill = heatFillColor(heatPct, changeColors.up, changeColors.down, theme.bgElevated);
  const pctLabel =
    cell.changePercent != null && Number.isFinite(cell.changePercent)
      ? formatHeatChangePct(cell.changePercent)
      : cell.trend || '—';

  return (
    <View style={[styles.sectorFlowRow, bordered && styles.listRowBordered]}>
      <View style={[styles.sectorFlowTop, { backgroundColor: topFill }]}>
        <Text style={styles.sectorName}>{cell.name}</Text>
        <Text style={[styles.sectorHeatPct, { color: pctColor }]}>{pctLabel}</Text>
      </View>
      {why ? (
        <ChangeTintedText style={styles.sectorSummary}>
          {why}
        </ChangeTintedText>
      ) : null}
    </View>
  );
}

export function MarketBriefingBlock({
  briefing,
  theme,
  scaleFont,
  changeColorConvention,
  omitSummary = false,
}: Props) {
  const { t, locale } = useLocale();
  const { effectiveColorScheme, feedTypo } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const changeColors = getQuoteChangeColors(changeColorConvention, effectiveColorScheme);

  const summaryText = omitSummary ? '' : briefing.summary?.trim() || '';
  const hasLead = Boolean(summaryText) || briefing.overview.length > 0;
  const sectorFlowRows = useMemo(
    () => briefingSectorHeatCells(briefing.sectors, briefing.id),
    [briefing.id, briefing.sectors],
  );

  return (
    <View style={styles.block}>
      {hasLead ? (
        <View style={styles.leadPanel}>
          {summaryText ? <ChangeTintedText style={styles.summary}>{summaryText}</ChangeTintedText> : null}

          {briefing.overview.length > 0 ? (
            <View style={styles.overviewBlock}>
              {summaryText ? <View style={styles.leadDivider} /> : null}
              <Text style={styles.overviewKicker}>{t('briefingDetailOverview')}</Text>
              <View style={styles.overviewList}>
                {briefing.overview.map((line, index) => (
                  <View key={`overview-${index}`} style={styles.overviewRow}>
                    <View style={styles.overviewDot} />
                    <ChangeTintedText style={styles.overviewText}>{line}</ChangeTintedText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {sectorFlowRows.length > 0 ? (
        <BriefingSection title={t('briefingDetailSectors')} styles={styles}>
          <View style={styles.sectionFeedCard}>
            {sectorFlowRows.map((cell, index) => (
              <SectorFlowRow
                key={cell.key}
                cell={cell}
                theme={theme}
                styles={styles}
                changeColors={changeColors}
                bordered={index < sectorFlowRows.length - 1}
              />
            ))}
          </View>
        </BriefingSection>
      ) : null}

      {briefing.companies.length > 0 ? (
        <BriefingSection title={t('briefingDetailCompanies')} styles={styles}>
          <View style={styles.sectionFeedCard}>
            {briefing.companies.map((item, index) => (
              <CompanyHighlightRow
                key={`${item.symbol}-${index}`}
                item={item}
                market={briefing.market}
                theme={theme}
                styles={styles}
                changeColors={changeColors}
                bordered={index < briefing.companies.length - 1}
              />
            ))}
          </View>
        </BriefingSection>
      ) : null}

      {briefing.macro.length > 0 ? (
        <BriefingSection title={t('briefingDetailMacro')} styles={styles}>
          <View style={styles.sectionFeedCard}>
            {briefing.macro.map((item, index) => (
              <MacroHighlightRow
                key={`${item.title}-${index}`}
                item={item}
                locale={locale}
                bordered={index < briefing.macro.length - 1}
              />
            ))}
          </View>
        </BriefingSection>
      ) : null}

      {briefing.sourceRefs.length > 0 ? (
        <BriefingSection title={t('briefingDetailSources')} styles={styles}>
          <View style={styles.sectionFeedCard}>
            {briefing.sourceRefs.map((item, index) => (
              <HomeDigestFeedRow
                key={`${item.title}-${index}`}
                title={item.title}
                titleLines={null}
                trailText={item.sourceName?.trim() || null}
                timeLabel={formatFeedItemTimeLabel(item.publishedAt || item.checkedAt, locale)}
                sourceEntries={briefingSourceIconEntries([item])}
                bordered={index < briefing.sourceRefs.length - 1}
                onPress={
                  item.url
                    ? () => {
                        void Linking.openURL(item.url!);
                      }
                    : undefined
                }
              />
            ))}
          </View>
        </BriefingSection>
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
      flexShrink: 1,
      fontSize: ft.signalTitleFont(16),
      fontWeight: ft.titleWeight,
      letterSpacing: -0.15,
      color: theme.text,
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

    listRowBordered: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    sectorFlowRow: {
      gap: 6,
      paddingVertical: 7,
    },
    sectorFlowTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
      minWidth: 0,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 7,
    },
    sectorName: {
      flex: 1,
      fontSize: ft.ff(14),
      lineHeight: sf(18),
      fontWeight: ft.titleWeight,
      color: theme.text,
      flexShrink: 1,
      minWidth: 0,
    },
    sectorHeatPct: {
      flexShrink: 0,
      fontSize: ft.ff(13),
      lineHeight: sf(17),
      fontWeight: ft.emphasisWeight,
      fontVariant: ['tabular-nums'],
    },
    sectorSummary: {
      fontSize: ft.signalBodyFont(13),
      fontWeight: ft.signalMetaWeight,
      color: theme.textDim,
      lineHeight: sf(19),
    },
    companyRow: {
      gap: 4,
      paddingVertical: 7,
    },
    companyTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      minWidth: 0,
    },
    companyQuoteInline: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'flex-end',
      gap: 6,
      flexShrink: 1,
      minWidth: 0,
    },
    companyPrice: {
      fontSize: ft.ff(12),
      lineHeight: sf(16),
      fontWeight: ft.emphasisWeight,
      color: theme.text,
      fontVariant: ['tabular-nums'],
    },
    companyChange: {
      fontSize: ft.ff(12),
      lineHeight: sf(16),
      fontWeight: ft.metaWeight,
      fontVariant: ['tabular-nums'],
    },
    companySummary: {
      fontSize: ft.signalBodyFont(13),
      fontWeight: ft.signalMetaWeight,
      color: theme.textDim,
      lineHeight: sf(19),
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
