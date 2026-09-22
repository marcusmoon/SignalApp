import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View, Text } from 'react-native';

import { HomeKeywordChipStrip } from '@/components/signal/HomeKeywordChipStrip';
import { ChangeTintedText } from '@/components/signal/ChangeTintedText';
import { SectionCapRule } from '@/components/signal/SectionCapRule';
import { HOME_HERO_HEADLINE_PX, HOME_HERO_HEADLINE_LINE_PX } from '@/constants/homeScan';
import type { AppTheme } from '@/constants/theme';
import type { HomeKeywordChip } from '@/domain/home/aggregateHomeKeywords';
import type { HomeKeywordSymbolProfile } from '@/domain/home/homeKeywordDisplay';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useLocale } from '@/contexts/LocaleContext';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';

type Props = {
  keywords: HomeKeywordChip[];
  symbolProfiles: Map<string, HomeKeywordSymbolProfile>;
  onPressKeyword: (chip: HomeKeywordChip) => void;
  heroHeadline: string | null;
  heroSummary?: string | null;
  /** Session context, omitted when it repeats the section heading. */
  sessionDividerLabel?: string | null;
  onPressHero: () => void;
  heroAccessibilityLabel: string;
  compact?: boolean;
};

/** Lead with the market narrative; related topics remain a secondary navigation. */
export function HomeTrendHeroCard({
  keywords,
  symbolProfiles,
  onPressKeyword,
  heroHeadline,
  heroSummary,
  sessionDividerLabel,
  onPressHero,
  heroAccessibilityLabel,
  compact = false,
}: Props) {
  const { theme, feedTypo } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(
    () => makeStyles(theme, feedTypo),
    [theme, feedTypo],
  );

  const hasKeywords = keywords.length > 0;
  const headline = String(heroHeadline || '').trim();
  const hasHero = Boolean(headline);
  const summary = heroSummary?.trim() !== headline ? heroSummary?.trim() : '';
  const dividerLabel = String(sessionDividerLabel || '').trim();
  if (!hasKeywords && !hasHero) return null;

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      {hasHero && dividerLabel && dividerLabel !== heroAccessibilityLabel ? (
        <SectionCapRule
          label={dividerLabel}
          accessibilityRole="text"
          accessibilityLabel={dividerLabel}
          style={styles.sessionRule}
        />
      ) : null}
      {hasHero ? (
        <Pressable
          onPress={onPressHero}
          accessibilityRole="button"
          accessibilityLabel={heroAccessibilityLabel}
          style={({ pressed }) => [styles.heroBody, pressed && styles.pressed]}>
          <ChangeTintedText style={styles.heroHeadline}>{headline}</ChangeTintedText>
          {summary ? (
            <ChangeTintedText style={styles.heroSummary} numberOfLines={3}>
              {summary}
            </ChangeTintedText>
          ) : null}
          <View style={styles.readAction}>
            <Text style={styles.readActionText}>{t('homeReadBriefing')}</Text>
            <Ionicons name="arrow-forward" size={16} color={theme.green} />
          </View>
        </Pressable>
      ) : null}
      {hasKeywords ? (
        <View style={styles.keywordArea}>
          <View style={styles.keywordList}>
            <HomeKeywordChipStrip
              items={keywords}
              symbolProfiles={symbolProfiles}
              onPressItem={onPressKeyword}
              variant="embedded"
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme, ft: FeedContentTypography) {
  return StyleSheet.create({
    card: {
      borderTopWidth: 2,
      borderTopColor: theme.green,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingVertical: 18,
      gap: 16,
    },
    cardCompact: {
      minHeight: 0,
    },
    sessionRule: {
      marginVertical: 2,
    },
    heroBody: {
      gap: 12,
      maxWidth: 880,
    },
    heroHeadline: {
      fontSize: ft.ff(HOME_HERO_HEADLINE_PX),
      lineHeight: ft.ff(HOME_HERO_HEADLINE_LINE_PX),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    heroSummary: {
      fontSize: ft.ff(15),
      lineHeight: ft.ff(24),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
    },
    readAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    readActionText: { fontSize: ft.ff(13), color: theme.green, fontWeight: ft.metaWeight },
    keywordArea: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, minWidth: 0 },
    keywordList: { flex: 1, minWidth: 0 },
    pressed: {
      opacity: 0.72,
    },
  });
}
