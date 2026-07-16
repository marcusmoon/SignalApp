import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { HomeDigestFeedRow } from '@/components/signal/HomeDigestFeedRow';
import { briefingSourceIconEntries } from '@/components/signal/SourceIconStack';
import { SymbolLogo } from '@/components/signal/SymbolLogo';
import type { AppTheme } from '@/constants/theme';
import { CONTENT_ACCENT_LINE_WIDTH } from '@/constants/homeSectionAccent';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
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
  SignalApiMarketBriefingSector,
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
};

function BriefingSection({
  title,
  children,
  styles,
  accent = 'green',
}: {
  title: string;
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
  const isKrMarket = market === 'kr';
  const companyName = item.name?.trim() || '';
  const identityLabel = isKrMarket && companyName ? companyName : item.symbol;
  const showCompanyName = isKrMarket && Boolean(companyName);

  return (
    <View style={[styles.companyRow, bordered && styles.listRowBordered]}>
      <View style={styles.companyTopRow}>
        <View
          style={[
            styles.companyIdentity,
            showCompanyName ? styles.companyIdentityKr : null,
          ]}>
          <SymbolLogo symbol={item.symbol} size={20} />
          <Text
            style={[
              styles.companyIdentityLabel,
              showCompanyName ? styles.companyIdentityName : styles.companyIdentityTicker,
            ]}
            numberOfLines={1}>
            {identityLabel}
          </Text>
        </View>
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
      <Text style={styles.companySummary}>{item.summary}</Text>
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

function trendColor(trend: string, theme: AppTheme): string {
  if (trend === '▲' || trend === 'up' || trend === '강세') return theme.green;
  if (trend === '▽' || trend === 'down' || trend === '약세') return theme.accentOrange;
  return theme.textMuted;
}

function SectorRow({
  item,
  theme,
  styles,
  bordered,
}: {
  item: SignalApiMarketBriefingSector;
  theme: AppTheme;
  styles: ReturnType<typeof makeStyles>;
  bordered: boolean;
}) {
  const color = trendColor(item.trend, theme);
  return (
    <View style={[styles.sectorRow, bordered && styles.listRowBordered]}>
      <Text style={[styles.sectorTrend, { color }]}>{item.trend}</Text>
      <Text style={styles.sectorName} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={styles.sectorSummary}>{item.summary}</Text>
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
              <Text style={styles.overviewKicker}>{t('briefingDetailOverview')}</Text>
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
          styles={styles}
          accent="green">
          <View style={styles.sectionFeedCard}>
            {briefing.sectors.map((item, index) => (
              <SectorRow
                key={`${item.name}-${index}`}
                item={item}
                theme={theme}
                styles={styles}
                bordered={index < briefing.sectors!.length - 1}
              />
            ))}
          </View>
        </BriefingSection>
      ) : null}

      {briefing.companies.length > 0 ? (
        <BriefingSection
          title={t('briefingDetailCompanies')}
          styles={styles}
          accent="green">
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
        <BriefingSection
          title={t('briefingDetailMacro')}
          styles={styles}
          accent="orange">
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
        <BriefingSection
          title={t('briefingDetailSources')}
          styles={styles}
          accent="muted">
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
    sectionAccent: {
      width: CONTENT_ACCENT_LINE_WIDTH,
      height: 20,
      borderRadius: 2,
      backgroundColor: theme.green,
      flexShrink: 0,
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
    sectorRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 5,
    },
    sectorTrend: {
      fontSize: ft.ff(15),
      fontWeight: ft.titleWeight,
      width: 20,
      textAlign: 'center',
      flexShrink: 0,
    },
    sectorName: {
      fontSize: ft.ff(13),
      fontWeight: ft.emphasisWeight,
      color: theme.text,
      width: 88,
      flexGrow: 0,
      flexShrink: 0,
    },
    sectorSummary: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      fontSize: ft.signalBodyFont(13),
      fontWeight: ft.signalMetaWeight,
      color: theme.textDim,
      lineHeight: sf(18),
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
    companyIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
      minWidth: 72,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: theme.bgElevated,
    },
    companyIdentityKr: {
      flexShrink: 1,
      minWidth: 56,
      maxWidth: '58%',
    },
    companyIdentityLabel: {
      fontSize: ft.ff(12),
      letterSpacing: -0.1,
      flexShrink: 1,
      minWidth: 0,
    },
    companyIdentityTicker: {
      fontWeight: ft.emphasisWeight,
      color: theme.green,
      fontVariant: ['tabular-nums'],
    },
    companyIdentityName: {
      fontWeight: ft.bodyWeight,
      color: theme.text,
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
