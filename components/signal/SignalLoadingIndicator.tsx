import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

/** `SignalHeader` 로고 막대와 동일 비율 */
const BAR_HEIGHTS = [16, 26, 36, 46];
const BAR_WIDTH = 9;
const BAR_GAP = 4;

type Props = {
  message?: string;
};

export function SignalLoadingIndicator({ message }: Props) {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const opacities = useRef(BAR_HEIGHTS.map(() => new Animated.Value(0.32))).current;
  const groupScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const wave = Animated.loop(
      Animated.sequence([
        Animated.stagger(
          85,
          opacities.map((op) =>
            Animated.sequence([
              Animated.timing(op, { toValue: 1, duration: 320, useNativeDriver: true }),
              Animated.timing(op, { toValue: 0.35, duration: 320, useNativeDriver: true }),
            ]),
          ),
        ),
        Animated.delay(260),
      ]),
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(groupScale, { toValue: 1.06, duration: 780, useNativeDriver: true }),
        Animated.timing(groupScale, { toValue: 1, duration: 780, useNativeDriver: true }),
      ]),
    );
    wave.start();
    pulse.start();
    return () => {
      wave.stop();
      pulse.stop();
    };
  }, [groupScale, opacities]);

  const label = message ?? t('commonLoading');

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={label}>
      <Animated.View style={{ transform: [{ scale: groupScale }] }}>
        <View style={styles.barsRow}>
          {BAR_HEIGHTS.map((h, i) => (
            <Animated.View
              key={i}
              style={[styles.bar, { height: h, opacity: opacities[i] }]}
            />
          ))}
        </View>
      </Animated.View>
      <Text style={styles.caption}>{label}</Text>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
      paddingHorizontal: 12,
    },
    barsRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: BAR_GAP,
      height: 46,
    },
    bar: {
      width: BAR_WIDTH,
      backgroundColor: theme.green,
      borderRadius: 3,
    },
    caption: {
      marginTop: 14,
      fontSize: 13,
      fontWeight: '600',
      color: theme.textMuted,
      letterSpacing: -0.2,
    },
  });
}
