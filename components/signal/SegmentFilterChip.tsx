import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { SourceAccent } from '@/constants/sourceAccent';
import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  label: string;
  accent: SourceAccent;
  active?: boolean;
};

/** 세그먼트·필터 pill 안의 색상 마크 + 라벨 */
export function SegmentFilterChip({ label, accent, active = false }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.mark,
          active
            ? { backgroundColor: '#FFFFFF', borderColor: 'rgba(255,255,255,0.65)' }
            : { backgroundColor: accent.dim, borderColor: accent.border },
        ]}>
        <Text style={[styles.glyph, active && styles.glyphActive]} numberOfLines={1}>
          {accent.glyph}
        </Text>
      </View>
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      minWidth: 0,
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
      fontSize: sf(10),
      lineHeight: sf(12),
      fontWeight: '900',
    },
    glyphActive: {
      opacity: 1,
    },
    label: {
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: '800',
      color: theme.textDim,
      flexShrink: 1,
    },
    labelActive: {
      color: '#FFFFFF',
    },
  });
}
