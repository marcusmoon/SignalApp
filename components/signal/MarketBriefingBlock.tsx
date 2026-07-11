import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import type { AppTheme } from '@/constants/theme';
import { CONTENT_ACCENT_LINE_WIDTH } from '@/constants/homeSectionAccent';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
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
  SignalApiMarketBriefingSector,
} from '@/integrations/signal-api/types';
import { formatInstantLabel } from '@/utils/date';

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
};

function BriefingSection({
  title,
  count,
  children,
  styles,
  accent = 'green',
}: {
  title: string;
  count?: number;
  children: ReactNode;
  styles: ReturnType<typeof makeStyles>;
  accent?: 'green' | 'orange' | 'muted';
}) {
  return (
    <View style={styles.sectionWrap}>
      <View style={styles.sectionHead}>
        <View
          style={[
            styles.sectionAccent,
            accent === 'orange' && styles.sectionAccentOrange,
            accent === 'muted' && styles.sectionAccentMuted,
          ]}
        />
        <Text style={styles.sectionTitle}>{title}</Text>
        {count != null && count > 0 ? (
          <View style={styles.sectionCountBadge}>
            <Text style={styles.sectionCountText}>{count}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function CompanyHighlightCard({
  item,
  market,
  theme,
  styles,
  changeColors,
}: {
  item: SignalApiMarketBriefingCompany;
  market: string;
  theme: AppTheme;
  styles: ReturnType<typeof makeStyles>;
  changeColors: { up: string; down: string };
}) {
  const hasPrice = item.price != null && Number.isFinite(item.price);
  const hasChange = item.changePercent != null && Number.isFinite(item.changePercent);
  const changePositive = hasChange ? isQuoteChangePositive({ changePercent: item.changePercent }) : null;
  const changeColor =
    changePositive === null ? theme.textMuted : changePositive ? changeColors.up : changeColors.down;
  const changeBg =
    changePositive === null
      ? theme.bgElevated
      : changePositive
        ? `${changeColors.up}22`
        : `${changeColors.down}22`;
  const changeBorderColor = changePositive === null ? theme.border : `${changeColor}55`;

  return (
    <View style={styles.companyCard}>
      <View style={styles.companyHead}>
        <View style={styles.companySymbolBox}>
          <Text style={styles.companySymbol}>{item.symbol}</Text>
          {item.name ? (
            <Text style={styles.companyName} numberOfLines={1}>
              {item.name}
            </Text>
          ) : null}
        </View>
        {(hasPrice || hasChange) && (
          <View
            style={[
              styles.companyQuoteBox,
              { backgroundColor: changeBg, borderColor: changeBorderColor },
            ]}>
            {hasPrice ? (
              <Text style={[styles.companyPrice, hasChange && { color: changeColor }]}>
                {formatBriefingPrice(item.price, market)}
              </Text>
            ) : null}
            {hasChange ? (
              <Text style={[styles.companyChange, { color: changeColor }]}>
                {formatChangePct(item.changePercent)}
              </Text>
            ) : null}
          </View>
        )}
      </View>
      <Text style={styles.companySummary}>{item.summary}</Text>
    </View>
  );
}

function MacroHighlightCard({
  item,
  styles,
}: {
  item: SignalApiMarketBriefingMacroItem;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.macroCard}>
      <Text style={styles.macroTitle}>{item.title}</Text>
      <Text style={styles.macroBody}>{item.summary}</Text>
      {item.sourceUrl ? (
        <Pressable onPress={() => void Linking.openURL(item.sourceUrl || '')} hitSlop={6}>
          <Text style={styles.link}>{item.sourceName || item.sourceUrl}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function trendColor(trend: string, theme: AppTheme): string {
  if (trend === '▲' || trend === 'up' || trend === '강세') return theme.green;
  if (trend === '▽' || trend === 'down' || trend === '약세') return theme.accentOrange;
  return theme.textMuted;
}

function SectorRow({
  item,
  theme,
  styles,
}: {
  item: SignalApiMarketBriefingSector;
  theme: AppTheme;
  styles: ReturnType<typeof makeStyles>;
}) {
  const color = trendColor(item.trend, theme);
  return (
    <View style={styles.sectorRow}>
      <Text style={[styles.sectorTrend, { color }]}>{item.trend}</Text>
      <Text style={styles.sectorName}>{item.name}</Text>
      <Text style={styles.sectorSummary} numberOfLines={2}>{item.summary}</Text>
    </View>
  );
}

export function MarketBriefingBlock({
  briefing,
  theme,
  scaleFont,
  changeColorConvention,
}: Props) {
  const { t, locale } = useLocale();
  const { effectiveColorScheme, feedTypo } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const changeColors = getQuoteChangeColors(changeColorConvention, effectiveColorScheme);

  const hasLead = Boolean(briefing.summary) || briefing.overview.length > 0;

  return (
    <View style={styles.block}>
      {hasLead ? (
        <View style={styles.leadPanel}>
          {briefing.summary ? <Text style={styles.summary}>{briefing.summary}</Text> : null}

          {briefing.overview.length > 0 ? (
            <View style={styles.overviewBlock}>
              {briefing.summary ? <View style={styles.leadDivider} /> : null}
              <View style={styles.sectionHead}>
                <View style={styles.sectionAccent} />
                <Text style={styles.sectionTitle}>{t('briefingDetailOverview')}</Text>
                <View style={styles.sectionCountBadge}>
                  <Text style={styles.sectionCountText}>{briefing.overview.length}</Text>
                </View>
              </View>
              <View style={styles.overviewList}>
                {briefing.overview.map((line, index) => (
                  <View key={`overview-${index}`} style={styles.overviewRow}>
                    <View style={styles.overviewDot} />
                    <Text style={styles.overviewText}>{line}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {briefing.sectors && briefing.sectors.length > 0 ? (
        <BriefingSection
          title={t('briefingDetailSectors')}
          count={briefing.sectors.length}
          styles={styles}
          accent="green">
          <View style={styles.cardStack}>
            {briefing.sectors.map((item, index) => (
              <SectorRow
                key={`${item.name}-${index}`}
                item={item}
                theme={theme}
                styles={styles}
              />
            ))}
          </View>
        </BriefingSection>
      ) : null}

      {briefing.companies.length > 0 ? (
        <BriefingSection
          title={t('briefingDetailCompanies')}
          count={briefing.companies.length}
          styles={styles}
          accent="green">
          <View style={styles.cardStack}>
            {briefing.companies.map((item, index) => (
              <CompanyHighlightCard
                key={`${item.symbol}-${index}`}
                item={item}
                market={briefing.market}
                theme={theme}
                styles={styles}
                changeColors={changeColors}
              />
            ))}
          </View>
        </BriefingSection>
      ) : null}

      {briefing.macro.length > 0 ? (
        <BriefingSection
          title={t('briefingDetailMacro')}
          count={briefing.macro.length}
          styles={styles}
          accent="orange">
          <View style={styles.cardStack}>
            {briefing.macro.map((item, index) => (
              <MacroHighlightCard key={`${item.title}-${index}`} item={item} styles={styles} />
            ))}
          </View>
        </BriefingSection>
      ) : null}

      {briefing.sourceRefs.length > 0 ? (
        <BriefingSection
          title={t('briefingDetailSources')}
          count={briefing.sourceRefs.length}
          styles={styles}
          accent="muted">
          <View style={styles.cardStack}>
            {briefing.sourceRefs.map((item, index) => (
              <Pressable
                key={`${item.title}-${index}`}
                disabled={!item.url}
                onPress={() => {
                  if (item.url) void Linking.openURL(item.url);
                }}
                style={({ pressed }) => [
                  styles.sourceRow,
                  pressed && item.url && styles.sourceRowPressed,
                ]}>
                <View style={styles.sourceMain}>
                  <Text style={styles.sourceTitle}>{item.title}</Text>
                  <Text style={styles.sourceMeta}>
                    {[item.sourceName, formatInstantLabel(item.publishedAt || item.checkedAt, locale)]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                {item.url ? <FontAwesome name="external-link" size={12} color={theme.textMuted} /> : null}
              </Pressable>
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
      borderRadius: 16,
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
      gap: 16,
    },
    summary: {
      fontSize: ft.signalBodyFont(17),
      lineHeight: sf(26),
      fontWeight: ft.signalBodyWeight,
      color: theme.text,
    },
    sectionWrap: {
      gap: 16,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    sectionAccent: {
      width: CONTENT_ACCENT_LINE_WIDTH,
      height: 20,
      borderRadius: 2,
      backgroundColor: theme.green,
    },
    sectionAccentOrange: {
      backgroundColor: theme.accentOrange,
    },
    sectionAccentMuted: {
      backgroundColor: theme.textMuted,
    },
    sectionTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.signalTitleFont(16),
      fontWeight: ft.signalTitleWeight,
      letterSpacing: -0.15,
      color: theme.text,
    },
    sectionCountBadge: {
      minWidth: 24,
      height: 24,
      paddingHorizontal: 8,
      borderRadius: 12,
      backgroundColor: theme.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionCountText: {
      fontSize: ft.ff(12),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    overviewList: {
      gap: 20,
    },
    overviewRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 20,
    },
    overviewDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.green,
      marginTop: sf(9),
      flexShrink: 0,
    },
    overviewText: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.signalBodyFont(16),
      lineHeight: sf(25),
      fontWeight: ft.signalBodyWeight,
      color: theme.text,
    },
    cardStack: {
      gap: 16,
    },
    sectorRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
      paddingVertical: 7,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    sectorTrend: {
      fontSize: sf(15),
      fontWeight: '900',
      width: 20,
      textAlign: 'center',
    },
    sectorName: {
      fontSize: ft.ff(13),
      fontWeight: ft.emphasisWeight,
      color: theme.text,
      width: 64,
    },
    sectorSummary: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.signalBodyFont(13),
      fontWeight: ft.signalMetaWeight,
      color: theme.textDim,
      lineHeight: sf(18),
    },
    companyCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      padding: ft.pad(14),
      gap: 16,
    },
    companyHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
    },
    companySymbolBox: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    companySymbol: {
      fontSize: ft.signalTitleFont(17),
      fontWeight: ft.signalTitleWeight,
      letterSpacing: -0.2,
      color: theme.green,
    },
    companyName: {
      fontSize: ft.ff(13),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
    },
    companyQuoteBox: {
      flexShrink: 0,
      alignItems: 'flex-end',
      borderWidth: 1,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 10,
      gap: 2,
      minWidth: 92,
    },
    companyPrice: {
      fontSize: sf(15),
      fontWeight: '900',
      color: theme.text,
      fontVariant: ['tabular-nums'],
    },
    companyChange: {
      fontSize: sf(14),
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    companySummary: {
      fontSize: ft.signalBodyFont(15),
      lineHeight: sf(23),
      fontWeight: ft.signalBodyWeight,
      color: theme.textDim,
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    macroCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      borderLeftWidth: CONTENT_ACCENT_LINE_WIDTH,
      borderLeftColor: theme.accentOrange,
      paddingVertical: ft.row(12),
      paddingHorizontal: ft.pad(14),
      gap: 8,
    },
    macroTitle: {
      fontSize: ft.ff(15),
      fontWeight: ft.titleWeight,
      color: theme.text,
      lineHeight: sf(22),
    },
    macroBody: {
      fontSize: ft.signalBodyFont(15),
      lineHeight: sf(23),
      fontWeight: ft.signalBodyWeight,
      color: theme.textDim,
    },
    link: {
      fontSize: sf(13),
      fontWeight: '800',
      color: theme.green,
      marginTop: 2,
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    sourceRowPressed: {
      opacity: 0.82,
    },
    sourceMain: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    sourceTitle: {
      fontSize: ft.ff(14),
      fontWeight: ft.bodyWeight,
      color: theme.text,
      lineHeight: sf(20),
    },
    sourceMeta: {
      fontSize: ft.ff(12),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
  });
}
