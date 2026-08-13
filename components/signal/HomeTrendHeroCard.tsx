import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HomeKeywordChipStrip } from '@/components/signal/HomeKeywordChipStrip';
import { ChangeTintedText } from '@/components/signal/ChangeTintedText';
import { COMFORT_GAP_SM, COMFORT_PADDING_ROW_V } from '@/constants/comfortDensity';
import { FEED_BADGE_PX, FEED_DIGEST_TITLE_PX } from '@/constants/feedTypography';
import { UI_FONT_WEIGHT_EMPHASIS } from '@/constants/uiFontWeight';
import { UI_RADIUS_CARD_LG } from '@/constants/uiCornerRadius';
import type { AppTheme } from '@/constants/theme';
import type { HomeKeywordChip } from '@/domain/home/aggregateHomeKeywords';
import type { HomeKeywordSymbolProfile } from '@/domain/home/homeKeywordDisplay';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';

type Props = {
  keywords: HomeKeywordChip[];
  symbolProfiles: Map<string, HomeKeywordSymbolProfile>;
  onPressKeyword: (chip: HomeKeywordChip) => void;
  heroHeadline: string | null;
  /** `· Intraday ——` style cap between trend chips and hero body */
  sessionDividerLabel?: string | null;
  onPressHero: () => void;
  heroAccessibilityLabel: string;
  compact?: boolean;
};

/**
 * Home trend keywords + hero briefing in one card.
 * Chips and headline stay visually distinct inside a single border.
 */
export function HomeTrendHeroCard({
  keywords,
  symbolProfiles,
  onPressKeyword,
  heroHeadline,
  sessionDividerLabel,
  onPressHero,
  heroAccessibilityLabel,
  compact = false,
}: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo),
    [theme, scaleFont, feedTypo],
  );

  const hasKeywords = keywords.length > 0;
  const headline = String(heroHeadline || '').trim();
  const hasHero = Boolean(headline);
  const dividerLabel = String(sessionDividerLabel || '').trim();
  if (!hasKeywords && !hasHero) return null;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      {hasKeywords ? (
        <HomeKeywordChipStrip
          items={keywords}
          symbolProfiles={symbolProfiles}
          onPressItem={onPressKeyword}
          variant="embedded"
        />
      ) : null}
      {hasKeywords && hasHero ? (
        dividerLabel ? (
          <View
            style={styles.sessionRule}
            accessibilityRole="text"
            accessibilityLabel={dividerLabel}>
            <Text style={styles.sessionRuleLabel}>
              <Text style={styles.sessionRuleDot}>· </Text>
              {dividerLabel}
            </Text>
            <View style={styles.sessionRuleLine} />
          </View>
        ) : (
          <View style={styles.divider} />
        )
      ) : null}
      {hasHero ? (
        <Pressable
          onPress={onPressHero}
          accessibilityRole="button"
          accessibilityLabel={heroAccessibilityLabel}
          style={({ pressed }) => [styles.heroBody, pressed && styles.pressed]}>
          <ChangeTintedText style={styles.heroHeadline}>{headline}</ChangeTintedText>
        </Pressable>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    card: {
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 12,
      paddingVertical: COMFORT_PADDING_ROW_V,
      gap: COMFORT_GAP_SM,
      overflow: 'hidden',
      shadowColor: '#000000',
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 1,
    },
    cardCompact: {
      minHeight: 0,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginVertical: 2,
    },
    sessionRule: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginVertical: 2,
    },
    sessionRuleLabel: {
      flexShrink: 0,
      fontSize: ft.ff(FEED_BADGE_PX + 1),
      lineHeight: sf(16),
      fontWeight: UI_FONT_WEIGHT_EMPHASIS,
      color: theme.textMuted,
    },
    sessionRuleDot: {
      opacity: 0.72,
    },
    sessionRuleLine: {
      flex: 1,
      minWidth: 16,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
    },
    heroBody: {
      gap: COMFORT_GAP_SM,
    },
    heroHeadline: {
      fontSize: ft.ff(FEED_DIGEST_TITLE_PX),
      lineHeight: sf(20),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
