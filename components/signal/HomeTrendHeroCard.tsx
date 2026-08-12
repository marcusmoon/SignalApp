import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HomeKeywordChipStrip } from '@/components/signal/HomeKeywordChipStrip';
import { ChangeTintedText } from '@/components/signal/ChangeTintedText';
import { COMFORT_GAP_SM, COMFORT_PADDING_ROW_V } from '@/constants/comfortDensity';
import { FEED_DIGEST_TITLE_PX } from '@/constants/feedTypography';
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
  heroSessionTag?: ReactNode;
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
  heroSessionTag,
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
      {hasKeywords && hasHero ? <View style={styles.divider} /> : null}
      {hasHero ? (
        <Pressable
          onPress={onPressHero}
          accessibilityRole="button"
          accessibilityLabel={heroAccessibilityLabel}
          style={({ pressed }) => [styles.heroBody, pressed && styles.pressed]}>
          {heroSessionTag ? <View style={styles.heroTagRow}>{heroSessionTag}</View> : null}
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
    heroBody: {
      gap: COMFORT_GAP_SM,
    },
    heroTagRow: {
      flexDirection: 'row',
      alignItems: 'center',
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
