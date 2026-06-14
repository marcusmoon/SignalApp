import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
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

function marketColorConvention(market: string): QuotesChangeColorConvention {
  return market === 'us' ? 'us' : 'korea';
}

function formatBriefingPrice(price: number | null | undefined, market: string): string {
  if (price == null || !Number.isFinite(price)) return '—';
  if (market === 'kr') {
    return `${Math.round(price).toLocaleString('ko-KR')}원`;
  }
  if (price >= 1000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return price.toFixed(2);
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
  sessionLabel: string;
  marketLabel: string;
  featured?: boolean;
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
      <View style={styles.sectionPanel}>{children}</View>
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
        ? `${changeColors.up}18`
        : `${changeColors.down}18`;

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
          <View style={[styles.companyQuoteBox, { backgroundColor: changeBg }]}>
            {hasPrice ? <Text style={styles.companyPrice}>{formatBriefingPrice(item.price, market)}</Text> : null}
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

export function MarketBriefingBlock({
  briefing,
  theme,
  scaleFont,
  sessionLabel,
  marketLabel,
  featured = false,
}: Props) {
  const { t } = useLocale();
  const { effectiveColorScheme } = useSignalTheme();
  const styles = makeStyles(theme, scaleFont, featured);
  const changeColors = getQuoteChangeColors(
    marketColorConvention(briefing.market),
    effectiveColorScheme,
  );

  return (
    <View style={styles.block}>
      <View style={styles.sessionBar}>
        <Text style={styles.sessionLabel}>
          {marketLabel} · {sessionLabel}
        </Text>
        <Text style={styles.sessionWhen}>{shortDateTime(briefing.publishedAt)}</Text>
      </View>

      <View style={styles.heroPanel}>
        <Text style={styles.title}>{briefing.title}</Text>
        <Text style={styles.headline}>{briefing.headline}</Text>
        {briefing.summary ? <Text style={styles.summary}>{briefing.summary}</Text> : null}
      </View>

      {briefing.overview.length > 0 ? (
        <BriefingSection title={t('briefingDetailOverview')} count={briefing.overview.length} styles={styles}>
          <View style={styles.overviewList}>
            {briefing.overview.map((line, index) => (
              <View key={`overview-${index}`} style={styles.overviewRow}>
                <View style={styles.overviewDot} />
                <Text style={styles.overviewText}>{line}</Text>
              </View>
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
                    {[item.sourceName, shortDateTime(item.publishedAt || item.checkedAt)]
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

      <View style={styles.blockFoot} />
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, featured: boolean) {
  const heroTint =
    theme.green.startsWith('#') && theme.green.length === 7 ? `${theme.green}0C` : theme.bgElevated;

  return StyleSheet.create({
    block: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: featured ? theme.greenBorder : theme.border,
      backgroundColor: theme.card,
      overflow: 'hidden',
      marginBottom: 18,
    },
    sessionBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: featured ? theme.greenDim : theme.bgElevated,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    sessionLabel: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(12),
      fontWeight: '900',
      letterSpacing: 0.4,
      color: theme.green,
      textTransform: 'uppercase',
    },
    sessionWhen: {
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.textMuted,
    },
    heroPanel: {
      marginHorizontal: 12,
      marginTop: 12,
      paddingVertical: 16,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: heroTint,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      gap: 8,
    },
    title: {
      fontSize: sf(featured ? 22 : 20),
      lineHeight: sf(featured ? 29 : 27),
      fontWeight: '900',
      letterSpacing: -0.45,
      color: theme.text,
    },
    headline: {
      fontSize: sf(16),
      lineHeight: sf(24),
      fontWeight: '800',
      color: theme.textDim,
    },
    summary: {
      fontSize: sf(15),
      lineHeight: sf(23),
      fontWeight: '600',
      color: theme.text,
      marginTop: 2,
    },
    sectionWrap: {
      marginTop: 14,
      paddingHorizontal: 12,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    sectionAccent: {
      width: 4,
      height: 18,
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
      fontSize: sf(14),
      fontWeight: '900',
      letterSpacing: -0.15,
      color: theme.text,
    },
    sectionCountBadge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 7,
      borderRadius: 11,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionCountText: {
      fontSize: sf(11),
      fontWeight: '900',
      color: theme.textMuted,
    },
    sectionPanel: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      padding: 12,
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
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.green,
      marginTop: sf(8),
      flexShrink: 0,
    },
    overviewText: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(15),
      lineHeight: sf(23),
      fontWeight: '600',
      color: theme.text,
    },
    cardStack: {
      gap: 10,
    },
    companyCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 12,
      gap: 10,
    },
    companyHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    companySymbolBox: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    companySymbol: {
      fontSize: sf(16),
      fontWeight: '900',
      letterSpacing: -0.2,
      color: theme.green,
    },
    companyName: {
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.textMuted,
    },
    companyQuoteBox: {
      flexShrink: 0,
      alignItems: 'flex-end',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
      gap: 2,
      minWidth: 88,
    },
    companyPrice: {
      fontSize: sf(14),
      fontWeight: '900',
      color: theme.text,
      fontVariant: ['tabular-nums'],
    },
    companyChange: {
      fontSize: sf(13),
      fontWeight: '900',
      fontVariant: ['tabular-nums'],
    },
    companySummary: {
      fontSize: sf(14),
      lineHeight: sf(22),
      fontWeight: '600',
      color: theme.textDim,
      paddingTop: 2,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    macroCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      borderLeftWidth: 3,
      borderLeftColor: theme.accentOrange,
      paddingVertical: 11,
      paddingHorizontal: 12,
      gap: 6,
    },
    macroTitle: {
      fontSize: sf(14),
      fontWeight: '900',
      color: theme.text,
      lineHeight: sf(20),
    },
    macroBody: {
      fontSize: sf(14),
      lineHeight: sf(21),
      fontWeight: '600',
      color: theme.textDim,
    },
    link: {
      fontSize: sf(12),
      fontWeight: '800',
      color: theme.green,
      marginTop: 2,
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingVertical: 11,
      paddingHorizontal: 12,
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
      fontSize: sf(13),
      fontWeight: '800',
      color: theme.text,
      lineHeight: sf(19),
    },
    sourceMeta: {
      fontSize: sf(11),
      fontWeight: '700',
      color: theme.textMuted,
    },
    blockFoot: {
      height: 12,
    },
  });
}
