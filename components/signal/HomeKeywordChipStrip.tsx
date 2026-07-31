import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SymbolLogo } from '@/components/signal/SymbolLogo';
import { FEED_CHIP_PX } from '@/constants/feedTypography';
import { UI_RADIUS_CARD, UI_RADIUS_CARD_LG } from '@/constants/uiCornerRadius';
import type { AppTheme } from '@/constants/theme';
import type { HomeKeywordChip } from '@/domain/home/aggregateHomeKeywords';
import {
  homeKeywordChipLabel,
  homeKeywordIsSymbolChip,
} from '@/domain/home/homeKeywordDisplay';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';

type Props = {
  items: HomeKeywordChip[];
  symbolNames: Map<string, string>;
  onPressItem: (chip: HomeKeywordChip) => void;
  accessibilityLabel: string;
};

/**
 * Compact home keyword card — no section title. A lead tag icon + wrap
 * chips mark the block; the card border keeps it distinct from the hero.
 */
export function HomeKeywordChipStrip({
  items,
  symbolNames,
  onPressItem,
  accessibilityLabel,
}: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { useTwoPane, mode } = useResponsiveLayout();
  const featuredLimit = useTwoPane ? 2 : 1;
  const featuredItems = items.slice(0, Math.min(featuredLimit, items.length));
  const compactItems = items.slice(featuredItems.length);
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo, { useTwoPane, mode }),
    [theme, scaleFont, feedTypo, useTwoPane, mode],
  );

  if (items.length === 0) return null;

  return (
    <View
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel}>
      <View style={styles.featuredGrid}>
        {featuredItems.map((chip) => {
          const isSymbol = homeKeywordIsSymbolChip(chip);
          const label = homeKeywordChipLabel(chip, symbolNames);
          const why = String(chip.why || '').trim();
          const a11y = why ? `${label}. ${why}` : label;
          return (
            <Pressable
              key={`featured:${chip.kind}:${chip.label}`}
              onPress={() => onPressItem(chip)}
              accessibilityRole="button"
              accessibilityLabel={a11y}
              style={({ pressed }) => [
                styles.featuredChip,
                isSymbol ? styles.featuredChipSymbol : null,
                pressed && styles.pressed,
              ]}>
              <View style={styles.featuredHeadRow}>
                <View style={[styles.featuredLead, isSymbol ? styles.featuredLeadSymbol : null]}>
                  {isSymbol ? (
                    <SymbolLogo symbol={chip.label} size={16} />
                  ) : (
                  <Ionicons name={iconNameForKind(chip.kind)} size={14} color={theme.green} />
                  )}
                </View>
                <Text
                  style={[styles.featuredTitle, isSymbol ? styles.featuredTitleSymbol : null]}
                  numberOfLines={1}>
                  {label}
                </Text>
              </View>
              {why ? (
                <Text
                  style={styles.featuredWhy}
                  numberOfLines={useTwoPane ? 2 : 1}>
                  {why}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      {compactItems.length > 0 ? (
        <View style={styles.row}>
          <View style={styles.leadIcon} accessibilityElementsHidden>
            <Ionicons name="pricetags-outline" size={14} color={theme.green} />
          </View>
          {compactItems.map((chip) => {
            const isSymbol = homeKeywordIsSymbolChip(chip);
            const label = homeKeywordChipLabel(chip, symbolNames);
            const why = String(chip.why || '').trim();
            const a11y = why ? `${label}. ${why}` : label;
            return (
              <Pressable
                key={`${chip.kind}:${chip.label}`}
                onPress={() => onPressItem(chip)}
                accessibilityRole="button"
                accessibilityLabel={a11y}
                style={({ pressed }) => [
                  styles.chip,
                  isSymbol ? styles.chipSymbol : null,
                  pressed && styles.pressed,
                ]}>
                {isSymbol ? <SymbolLogo symbol={chip.label} size={14} /> : null}
                <Text
                  style={[styles.chipText, isSymbol ? styles.chipTextSymbol : null]}
                  numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function iconNameForKind(kind: string): keyof typeof Ionicons.glyphMap {
  switch (kind) {
    case 'sector':
      return 'grid-outline';
    case 'macro':
      return 'pulse-outline';
    case 'event':
      return 'calendar-outline';
    default:
      return 'sparkles-outline';
  }
}

function makeStyles(
  theme: AppTheme,
  sf: (n: number) => number,
  ft: FeedContentTypography,
  layout: { useTwoPane: boolean; mode: 'compact' | 'regular' | 'wide' },
) {
  const isCompact = layout.mode === 'compact';
  return StyleSheet.create({
    card: {
      borderRadius: UI_RADIUS_CARD_LG,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: isCompact ? 10 : 12,
      paddingVertical: isCompact ? 10 : 12,
      gap: isCompact ? 8 : 10,
    },
    featuredGrid: {
      flexDirection: layout.useTwoPane ? 'row' : 'column',
      alignItems: 'stretch',
      gap: 8,
    },
    featuredChip: {
      flex: layout.useTwoPane ? 1 : 0,
      minHeight: layout.useTwoPane ? 64 : 54,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      paddingHorizontal: isCompact ? 10 : 11,
      paddingVertical: isCompact ? 8 : 9,
      gap: isCompact ? 4 : 5,
    },
    featuredChipSymbol: {
      backgroundColor: theme.greenDim,
      borderColor: theme.greenBorder,
    },
    featuredHeadRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      minWidth: 0,
    },
    featuredLead: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    featuredLeadSymbol: {
      backgroundColor: theme.card,
      borderColor: theme.greenBorder,
    },
    featuredTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(isCompact ? 12 : 13),
      lineHeight: sf(isCompact ? 17 : 18),
      fontWeight: ft.emphasisWeight,
      color: theme.text,
    },
    featuredTitleSymbol: {
      color: theme.green,
    },
    featuredWhy: {
      fontSize: sf(isCompact ? 10 : 11),
      lineHeight: sf(isCompact ? 14 : 15),
      color: theme.textMuted,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: isCompact ? 6 : 7,
    },
    leadIcon: {
      width: 18,
      height: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 2,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      borderRadius: 999,
      overflow: 'hidden',
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      maxWidth: '100%',
    },
    chipSymbol: {
      backgroundColor: theme.greenDim,
      borderColor: theme.greenBorder,
    },
    chipText: {
      fontSize: ft.ff(FEED_CHIP_PX),
      lineHeight: sf(15),
      fontWeight: ft.emphasisWeight,
      color: theme.text,
      maxWidth: layout.useTwoPane ? 136 : 112,
    },
    chipTextSymbol: {
      color: theme.green,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
