import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { SIGNAL } from '@/constants/theme';

function SkeletonLine({ width }: { width: string | number }) {
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
  return (
    <View style={styles.card}>
      <SkeletonLine width="40%" />
      <View style={{ height: 10 }} />
      <SkeletonLine width="92%" />
      <View style={{ height: 8 }} />
      <SkeletonLine width="88%" />
      <View style={{ height: 8 }} />
      <SkeletonLine width="76%" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: SIGNAL.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SIGNAL.border,
    padding: 14,
    marginBottom: 10,
  },
  line: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1E1E28',
  },
});
