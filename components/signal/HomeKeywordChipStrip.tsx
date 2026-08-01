import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SymbolLogo } from '@/components/signal/SymbolLogo';
import { FEED_BADGE_PX, FEED_CHIP_PX } from '@/constants/feedTypography';
import { UI_RADIUS_CARD } from '@/constants/uiCornerRadius';
import type { AppTheme } from '@/constants/theme';
import type { HomeKeywordChip } from '@/domain/home/aggregateHomeKeywords';
import {
  homeKeywordChipLabel,
  homeKeywordIsSymbolChip,
} from '@/domain/home/homeKeywordDisplay';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';

type Props = {
  items: HomeKeywordChip[];
  symbolNames: Map<string, string>;
  onPressItem: (chip: HomeKeywordChip) => void;
  accessibilityLabel: string;
  /** Relative/absolute as-of from contributing source timestamps. */
  asOfLabel?: string | null;
};

/**
 * Home keyword strip — trend lead + optional as-of outside the card;
 * wrap chips inside. No featured tiles / why / kind icons.
 */
export function HomeKeywordChipStrip({
  items,
  symbolNames,
  onPressItem,
  accessibilityLabel,
  asOfLabel = null,
}: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo),
    [theme, scaleFont, feedTypo],
  );

  if (items.length === 0) return null;

  const when = asOfLabel?.trim() || '';
  const a11y = when ? `${accessibilityLabel}, ${when}` : accessibilityLabel;

  return (
    <View style={styles.root} accessibilityRole="summary" accessibilityLabel={a11y}>
      {when ? (
        <View style={styles.asOfRow} accessibilityElementsHidden>
          <View style={styles.asOfChip}>
            <Text style={styles.asOfText} numberOfLines={1}>
              {when}
            </Text>
          </View>
        </View>
      ) : null}
      <View style={styles.body}>
        <View style={styles.leadIcon} accessibilityElementsHidden>
          <Ionicons name="trending-up-outline" size={14} color={theme.green} />
        </View>
        <View style={styles.card}>
          <View style={styles.row}>
            {items.map((chip) => {
              const isSymbol = homeKeywordIsSymbolChip(chip);
              const label = homeKeywordChipLabel(chip, symbolNames);
              const why = String(chip.why || '').trim();
              const chipA11y = why ? `${label}. ${why}` : label;
              return (
                <Pressable
                  key={`${chip.kind}:${chip.label}`}
                  onPress={() => onPressItem(chip)}
                  accessibilityRole="button"
                  accessibilityLabel={chipA11y}
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
        </View>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    root: {
      gap: 6,
    },
    asOfRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingLeft: 24,
    },
    asOfChip: {
      flexShrink: 0,
      maxWidth: '46%',
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: theme.bgElevated,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
    },
    asOfText: {
      fontSize: ft.ff(FEED_BADGE_PX + 1),
      lineHeight: sf(13),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
      textAlign: 'right',
    },
    body: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    leadIcon: {
      width: 18,
      height: 18,
      marginTop: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    card: {
      flex: 1,
      minWidth: 0,
      borderRadius: UI_RADIUS_CARD,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.card,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
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
      maxWidth: 120,
    },
    chipTextSymbol: {
      color: theme.green,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
