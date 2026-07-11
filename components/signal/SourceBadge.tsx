import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { SourceAccent } from '@/constants/sourceAccent';
import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  label: string;
  accent: SourceAccent;
  /** 라벨 숨기고 마크만 */
  iconOnly?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function SourceBadge({ label, accent, iconOnly = false, style }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <View
      style={[
        styles.pill,
        iconOnly && styles.pillIconOnly,
        { backgroundColor: accent.dim, borderColor: accent.border },
        style,
      ]}
      accessibilityLabel={label}>
      <View style={[styles.mark, { backgroundColor: accent.accent, borderColor: accent.border }]}>
        <Text style={styles.glyph} numberOfLines={1}>
          {accent.glyph}
        </Text>
      </View>
      {iconOnly ? null : (
        <Text style={[styles.label, { color: accent.accent }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    pill: {
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      maxWidth: '100%',
      gap: 6,
      paddingLeft: 4,
      paddingRight: 10,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
    },
    pillIconOnly: {
      paddingRight: 4,
    },
    mark: {
      width: 20,
      height: 20,
      borderRadius: 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      flexShrink: 0,
    },
    glyph: {
      fontSize: sf(9),
      lineHeight: sf(11),
      fontWeight: '900',
      color: '#FFFFFF',
      letterSpacing: -0.2,
    },
    label: {
      flexShrink: 1,
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '800',
    },
  });
}
