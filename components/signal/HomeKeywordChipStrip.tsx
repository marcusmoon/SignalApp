import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { SymbolLogo } from '@/components/signal/SymbolLogo';
import {
  HOME_KEYWORD_CHIP_LINE_PX,
  HOME_KEYWORD_CHIP_LOGO,
  HOME_KEYWORD_CHIP_MAX_WIDTH,
  HOME_KEYWORD_CHIP_PX,
} from '@/constants/homeScan';
import { UI_RADIUS_CARD } from '@/constants/uiCornerRadius';
import type { AppTheme } from '@/constants/theme';
import type { HomeKeywordChip } from '@/domain/home/aggregateHomeKeywords';
import {
  homeKeywordChipIdentity,
  homeKeywordIsSymbolChip,
  type HomeKeywordSymbolProfile,
} from '@/domain/home/homeKeywordDisplay';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';

type Props = {
  items: HomeKeywordChip[];
  symbolProfiles: Map<string, HomeKeywordSymbolProfile>;
  onPressItem: (chip: HomeKeywordChip) => void;
  /** `embedded`: chips only — parent supplies the outer card border. */
  variant?: 'card' | 'embedded';
};

/**
 * Home keyword chip card — wrap chips only.
 * Symbol chips prefer DB-backed `symbolMeta` name/logo via `symbolProfiles`.
 */
export function HomeKeywordChipStrip({
  items,
  symbolProfiles,
  onPressItem,
  variant = 'card',
}: Props) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, feedTypo),
    [theme, scaleFont, feedTypo],
  );

  if (items.length === 0) return null;

  return (
    <View style={variant === 'card' ? styles.card : styles.embedded}>
      <View style={styles.row}>
        {items.map((chip) => {
          const isSymbol = homeKeywordIsSymbolChip(chip);
          const identity = isSymbol ? homeKeywordChipIdentity(chip, symbolProfiles) : null;
          const label = identity
            ? identity.displayName || identity.displaySymbol
            : chip.label;
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
              {identity ? (
                <>
                  <SymbolLogo
                    symbol={identity.symbol}
                    size={HOME_KEYWORD_CHIP_LOGO}
                    imageUrl={identity.imageUrl}
                  />
                  <Text
                    style={[styles.chipText, styles.chipTextSymbol]}
                    numberOfLines={1}>
                    {label}
                  </Text>
                </>
              ) : (
                <Text style={styles.chipText} numberOfLines={1}>
                  {label}
                </Text>
              )}
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
    embedded: {
      paddingHorizontal: 0,
      paddingVertical: 0,
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
      gap: 5,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 6,
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
      fontSize: ft.ff(HOME_KEYWORD_CHIP_PX),
      lineHeight: sf(HOME_KEYWORD_CHIP_LINE_PX),
      fontWeight: ft.emphasisWeight,
      color: theme.text,
      maxWidth: HOME_KEYWORD_CHIP_MAX_WIDTH,
    },
    chipTextSymbol: {
      color: theme.green,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
