import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  label: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * 브리핑 종류·회차 메타 칩 (오늘 정리 / 장전·장중·미장·마감).
 * 알림함 typeBadge와 동일 계열 — 화면별 칩 스타일 금지.
 */
export function BriefingMetaChip({ label, style }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const trimmed = label.trim();
  if (!trimmed) return null;

  return (
    <View style={[styles.chip, style]} accessibilityRole="text" accessibilityLabel={trimmed}>
      <Text style={styles.text} numberOfLines={1}>
        {trimmed}
      </Text>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    chip: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      flexShrink: 0,
    },
    text: {
      fontSize: sf(10),
      lineHeight: sf(14),
      fontWeight: '700',
      color: theme.green,
    },
  });
}
