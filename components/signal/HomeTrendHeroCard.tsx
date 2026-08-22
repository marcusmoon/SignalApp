import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HomeKeywordChipStrip } from '@/components/signal/HomeKeywordChipStrip';
import { ChangeTintedText } from '@/components/signal/ChangeTintedText';
import { SectionCapRule } from '@/components/signal/SectionCapRule';
import { COMFORT_GAP_SM, COMFORT_PADDING_ROW_V } from '@/constants/comfortDensity';
import {
  HOME_CARD_PAD_H,
  HOME_HERO_HEADLINE_LINE_PX,
  HOME_HERO_HEADLINE_PX,
} from '@/constants/homeScan';
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
  /** `● Intraday ——` style cap between trend chips and hero body */
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
          <SectionCapRule
            label={dividerLabel}
            accessibilityRole="text"
            accessibilityLabel={dividerLabel}
            style={styles.sessionRule}
          />
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
      paddingHorizontal: HOME_CARD_PAD_H,
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
      marginVertical: 2,
    },
    heroBody: {
      gap: COMFORT_GAP_SM,
    },
    heroHeadline: {
      fontSize: ft.ff(HOME_HERO_HEADLINE_PX),
      lineHeight: sf(HOME_HERO_HEADLINE_LINE_PX),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
