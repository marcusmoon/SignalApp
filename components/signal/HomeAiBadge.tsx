import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
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
  return StyleSheet.create({
    chip: {
      minHeight: 20,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: theme.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: {
      color: '#FFFFFF',
      fontSize: sf(10),
      lineHeight: sf(14),
      fontWeight: '900',
    },
  });
}
