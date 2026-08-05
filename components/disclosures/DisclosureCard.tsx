import * as WebBrowser from 'expo-web-browser';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SourceBadge } from '@/components/signal/SourceBadge';
import { SymbolIdentityChip } from '@/components/signal/SymbolIdentityChip';
import {
  FEED_ARTICLE_TITLE_PX,
  FEED_BODY_PX,
  FEED_CHIP_PX,
  FEED_META_TIME_PX,
} from '@/constants/feedTypography';
import { newsSourceAccent } from '@/constants/newsSourceAccent';
import type { AppTheme } from '@/constants/theme';
import { UI_RADIUS_CARD } from '@/constants/uiCornerRadius';
import {
  disclosureFiledTimeLabel,
  disclosureProviderLabel,
  isImportantDisclosure,
  resolveDisclosureTypeCategory,
  disclosureMeaningLabelId,
} from '@/domain/disclosures';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import { useIpadSidebarNavActions } from '@/contexts/IpadSidebarNavContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { SignalApiDisclosure } from '@/integrations/signal-api/types';
import { useRouter } from 'expo-router';

type Props = {
  item: SignalApiDisclosure;
  layout?: 'card' | 'grouped';
  compactMeta?: boolean;
  selected?: boolean;
  onPress?: () => void;
};

export function DisclosureCard({
  item,
  layout = 'card',
  compactMeta = false,
  selected = false,
  onPress,
}: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const router = useRouter();
  const ipadNav = useIpadSidebarNavActions();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);

  const providerName = disclosureProviderLabel(item.provider);
  const sourceAccent = useMemo(
    () => newsSourceAccent(providerName, theme, item.url),
    [item.url, providerName, theme],
  );
  const symbol = item.symbol?.trim().toUpperCase() ?? '';
  const companyName = item.symbolMeta?.name?.trim() || item.companyName?.trim() || '';
  const companyLogoUrl = item.symbolMeta?.logoUrl || null;
  const canOpenSymbol = symbol.length > 0;
  const timeLabel = disclosureFiledTimeLabel(item, locale);

  const openSymbol = useCallback(() => {
    if (!symbol) return;
    if (ipadNav.isAvailable) {
      ipadNav.showSymbol(symbol, { drillFrom: 'tabs' });
      return;
    }
    router.push(`/symbol/${symbol}`);
  }, [ipadNav, router, symbol]);

  const typeCategory = resolveDisclosureTypeCategory(item);
  const footerChips = useMemo(() => {
    const chips: string[] = [];
    if (isImportantDisclosure(item)) {
      chips.push(t('disclosuresImportantBadge'));
    }
    if (typeCategory !== 'other') {
      chips.push(t(disclosureMeaningLabelId(typeCategory)));
    }
    return chips.slice(0, 2);
  }, [item, t, typeCategory]);

  const grouped = layout === 'grouped';
  const filingUrl = item.url?.trim() ?? '';
  const canOpenFiling = filingUrl.length > 0;
  const rowPressEnabled = Boolean(onPress) || canOpenFiling;

  const openRow = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }
    if (!canOpenFiling) return;
    void WebBrowser.openBrowserAsync(filingUrl);
  }, [canOpenFiling, filingUrl, onPress]);

  const rowA11yLabel = [item.title, providerName, timeLabel].filter(Boolean).join(', ');
  const sourceContent = <SourceBadge label={providerName} accent={sourceAccent} variant="news" />;

  const metaBlock = compactMeta ? (
    <View style={styles.compactMetaRow}>
      {canOpenSymbol ? (
        <Pressable onPress={openSymbol} hitSlop={8} style={styles.compactTickerWrap}>
          <SymbolIdentityChip
            symbol={symbol}
            identifier={symbol}
            name={companyName || null}
            imageUrl={companyLogoUrl}
            logoSize={18}
            chrome="plain"
            expandable={Boolean(companyName)}
          />
        </Pressable>
      ) : companyName && companyName !== providerName ? (
        <Text style={styles.compactTicker} numberOfLines={1}>
          {companyName}
        </Text>
      ) : null}
      <View style={styles.compactMetaMain}>{sourceContent}</View>
      <View style={styles.timePill}>
        <Text style={styles.time} numberOfLines={1}>
          {timeLabel}
        </Text>
      </View>
    </View>
  ) : (
    <View style={styles.metaRow}>
      {canOpenSymbol ? (
        <Pressable onPress={openSymbol} hitSlop={8} style={styles.metaLead}>
          <SymbolIdentityChip
            symbol={symbol}
            identifier={symbol}
            name={companyName || null}
            imageUrl={companyLogoUrl}
            logoSize={20}
            chrome="plain"
            expandable={Boolean(companyName)}
          />
        </Pressable>
      ) : (
        <View style={styles.metaLead}>{sourceContent}</View>
      )}
      <View style={styles.metaTrail}>
        <View style={styles.timePill}>
          <Text style={styles.time}>{timeLabel}</Text>
        </View>
      </View>
    </View>
  );

  const tagsBlock =
    footerChips.length > 0 ? (
      <View style={[styles.footer, grouped && styles.footerGrouped]}>
        <View style={styles.footerTagsCol}>
          {footerChips.map((label) => (
            <View key={`${item.id}-${label}`} style={styles.tagChip}>
              <Text style={styles.tagChipText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
    ) : null;

  return (
    <View
      style={[
        styles.card,
        grouped && styles.cardGrouped,
        selected && styles.cardSelected,
      ]}>
      <Pressable
        onPress={openRow}
        disabled={!rowPressEnabled}
        style={({ pressed }) => [styles.rowPress, rowPressEnabled && pressed && styles.rowPressPressed]}
        accessibilityRole={rowPressEnabled ? 'button' : undefined}
        accessibilityLabel={rowPressEnabled ? rowA11yLabel : undefined}>
        {metaBlock}
        <Text style={[styles.title, footerChips.length === 0 && styles.titleLast]} numberOfLines={3}>
          {item.title}
        </Text>
      </Pressable>
      {tagsBlock}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: ft.pad(14),
      paddingTop: ft.pad(14),
      paddingBottom: ft.pad(6),
      marginBottom: 14,
    },
    cardGrouped: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderRadius: 0,
      marginBottom: 0,
      paddingHorizontal: ft.pad(16),
      paddingTop: ft.pad(16),
      paddingBottom: ft.pad(8),
    },
    cardSelected: {
      backgroundColor: theme.greenDim,
    },
    rowPress: {
      alignSelf: 'stretch',
    },
    rowPressPressed: {
      opacity: 0.92,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: ft.pad(8),
      marginBottom: ft.pad(6),
    },
    metaLead: {
      flex: 1,
      minWidth: 0,
    },
    tickerLead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
      flexShrink: 1,
    },
    metaTrail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ft.pad(6),
      flexShrink: 0,
    },
    ticker: {
      flexShrink: 1,
      color: theme.green,
      fontSize: ft.ff(FEED_BODY_PX),
      fontWeight: ft.emphasisWeight,
      letterSpacing: 0.5,
    },
    timePill: {
      flexShrink: 0,
      paddingHorizontal: ft.pad(8),
      paddingVertical: ft.pad(3),
      borderRadius: 999,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    time: {
      color: theme.textMuted,
      fontSize: ft.ff(FEED_META_TIME_PX),
      fontWeight: ft.metaWeight,
    },
    compactMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: ft.pad(8),
      marginBottom: ft.pad(8),
      minWidth: 0,
    },
    compactTickerWrap: {
      flexShrink: 1,
      minWidth: 0,
      maxWidth: '38%',
    },
    compactTicker: {
      flexShrink: 1,
      color: theme.green,
      fontSize: ft.ff(FEED_BODY_PX),
      fontWeight: ft.emphasisWeight,
      letterSpacing: 0.4,
    },
    compactMetaMain: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      color: theme.text,
      fontSize: ft.ff(FEED_ARTICLE_TITLE_PX),
      lineHeight: sf(22),
      fontWeight: ft.titleWeight,
      marginBottom: ft.pad(6),
    },
    titleLast: {
      marginBottom: ft.pad(6),
    },
    footerTagsCol: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      alignItems: 'center',
      paddingRight: 4,
    },
    tagChip: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 7,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tagChipText: {
      fontSize: ft.ff(FEED_CHIP_PX),
      lineHeight: ft.ff(14),
      fontWeight: ft.metaWeight,
      color: theme.green,
    },
    footer: {
      marginTop: ft.pad(6),
      paddingTop: ft.pad(8),
      paddingBottom: ft.pad(2),
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    footerGrouped: {
      marginTop: 4,
      paddingTop: 8,
      borderTopWidth: 0,
    },
  });
}
