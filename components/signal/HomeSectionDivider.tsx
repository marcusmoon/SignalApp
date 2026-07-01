import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

export function HomeSectionDivider() {
  const { theme } = useSignalTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
    },
  });
}
