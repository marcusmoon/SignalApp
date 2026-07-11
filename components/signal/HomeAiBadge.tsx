import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { accentAlpha } from '@/constants/sourceAccent';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

export function HomeAiBadge() {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  return (
    <View style={styles.chip} accessibilityLabel={t('homeAiGeneratedA11y')} accessibilityRole="text">
      <Text style={styles.text}>AI</Text>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  const accent = theme.accentBlue;
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
