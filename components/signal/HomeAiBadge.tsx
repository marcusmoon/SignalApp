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
      <Text style={styles.text}>✦ AI</Text>
    </View>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    chip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: theme.accentBlue,
      borderWidth: 1,
      borderColor: theme.accentBlue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: {
      color: '#FFFFFF',
      fontSize: sf(10),
      lineHeight: sf(15),
      fontWeight: '900',
    },
  });
}
