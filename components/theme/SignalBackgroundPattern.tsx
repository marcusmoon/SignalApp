import { Image, Platform, StyleSheet, View } from 'react-native';

import {
  themeBackgroundPatternCoverUri,
  themeBackgroundPatternUri,
} from '@/constants/themeBackgroundPattern';
import type { ThemeColorScheme } from '@/constants/theme';

type Props = {
  scheme: ThemeColorScheme;
};

/** Non-interactive dot grid over the root shell background (native). Web uses CSS on html. */
export function SignalBackgroundPattern({ scheme }: Props) {
  if (Platform.OS === 'web') return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image
        source={{ uri: themeBackgroundPatternCoverUri(scheme) }}
        style={styles.coverPattern}
        resizeMode="cover"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
}

/** Web overlay when html CSS pattern is covered by transparent RN layers. */
export function SignalBackgroundPatternWeb({ scheme }: Props) {
  if (Platform.OS !== 'web') return null;

  const uri = themeBackgroundPatternUri(scheme);

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: 1,
          backgroundImage: `url("${uri}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '28px 28px',
        } as never,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  coverPattern: {
    ...StyleSheet.absoluteFillObject,
    opacity: 1,
  },
});
