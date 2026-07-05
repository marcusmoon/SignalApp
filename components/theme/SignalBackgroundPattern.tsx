import { Image, Platform, StyleSheet, View } from 'react-native';

import { themeBackgroundPatternUri } from '@/constants/themeBackgroundPattern';
import type { ThemeColorScheme } from '@/constants/theme';

type Props = {
  scheme: ThemeColorScheme;
};

/** Non-interactive dot grid over the root shell background (native). Web uses CSS on html/body. */
export function SignalBackgroundPattern({ scheme }: Props) {
  if (Platform.OS === 'web') return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        source={{ uri: themeBackgroundPatternUri(scheme) }}
        style={styles.pattern}
        resizeMode="repeat"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
  },
});
