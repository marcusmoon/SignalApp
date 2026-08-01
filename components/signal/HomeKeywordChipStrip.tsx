import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SymbolLogo } from '@/components/signal/SymbolLogo';
import { FEED_CHIP_PX } from '@/constants/feedTypography';
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
};

/**
 * Home keyword chip card — wrap chips only.
 * Section header (trend icon · title · as-of) lives in HomeFocusContent.
 */
export function HomeKeywordChipStrip({ items, symbolNames, onPressItem }: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo),
    [theme, scaleFont, feedTypo],
  );

  if (items.length === 0) return null;

  return (
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
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    card: {
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
