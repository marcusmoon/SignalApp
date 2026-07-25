import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  style?: StyleProp<ViewStyle>;
};

/** 홈 뉴스 흐름 등 최근 갱신 표시용 뱃지 — 단색 칩 + 흰 글자 */
export function NewBadge({ style }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <View
      style={[styles.chip, style]}
      accessibilityLabel={t('homeNewsFlowNewA11y')}
      accessibilityRole="text">
      <Text style={styles.text}>NEW</Text>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    chip: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: theme.green,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    text: {
      color: '#FFFFFF',
      fontSize: sf(9),
      lineHeight: sf(13),
      fontWeight: '700',
      letterSpacing: 0.2,
    },
  });
}
