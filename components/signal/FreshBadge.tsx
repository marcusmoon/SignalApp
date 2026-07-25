import { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { accentAlpha } from '@/constants/sourceAccent';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type Props = {
  style?: StyleProp<ViewStyle>;
};

/** 최근 갱신 콘텐츠 표시용 뱃지 */
export function FreshBadge({ style }: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <View
      style={[styles.chip, style]}
      accessibilityLabel={t('digestFreshBadgeA11y')}
      accessibilityRole="text">
      <Text style={styles.text}>{t('digestFreshBadge')}</Text>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  const accent = theme.green;
  const isDark = theme.colorScheme === 'dark';
  return StyleSheet.create({
    chip: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: accentAlpha(accent, isDark ? 0.16 : 0.1),
      borderWidth: 1,
      borderColor: accentAlpha(accent, isDark ? 0.32 : 0.2),
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    text: {
      color: accentAlpha(accent, isDark ? 0.92 : 0.82),
      fontSize: sf(9),
      lineHeight: sf(13),
      fontWeight: '700',
      letterSpacing: 0.2,
    },
  });
}
