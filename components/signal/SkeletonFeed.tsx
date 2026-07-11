import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

function SkeletonLine({ width, styles }: { width: string | number; styles: ReturnType<typeof makeStyles> }) {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  const wStyle =
    typeof width === 'string' ? ({ width: width as `${number}%` } as const) : { width };

  return <Animated.View style={[styles.line, wStyle, { opacity }]} />;
}

export function SkeletonFeed() {
  const { theme } = useSignalTheme();
  const styles = makeStyles(theme);
  return (
    <View style={styles.card}>
      <SkeletonLine width="40%" styles={styles} />
      <View style={{ height: 10 }} />
      <SkeletonLine width="92%" styles={styles} />
      <View style={{ height: 8 }} />
      <SkeletonLine width="88%" styles={styles} />
      <View style={{ height: 8 }} />
      <SkeletonLine width="76%" styles={styles} />
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
      marginBottom: 14,
    },
    line: {
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.bgElevated,
    },
  });
}
