import { useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { HOME_SECTION_ACCENT_WIDTH, homeSectionAccentColor, type HomeAccentSection } from '@/constants/homeSectionAccent';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

type HomeSectionAccentLineProps = {
  section: HomeAccentSection;
  opacity?: number;
  style?: ViewStyle;
};

export function HomeSectionAccentLine({ section, opacity = 1, style }: HomeSectionAccentLineProps) {
  const { theme } = useSignalTheme();
  const color = homeSectionAccentColor(section, theme);
  const styles = useMemo(() => makeStyles(color, opacity), [color, opacity]);

  return (
    <View
      style={[styles.line, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

function makeStyles(color: string, opacity: number) {
  return StyleSheet.create({
    line: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: HOME_SECTION_ACCENT_WIDTH,
      backgroundColor: color,
      opacity,
    },
  });
}
