import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

/** `SignalHeader` 로고 막대와 동일 비율 */
const BAR_PRESETS = {
  default: {
    heights: [16, 26, 36, 46],
    width: 9,
    gap: 6,
    rowHeight: 46,
    captionSize: 13,
    captionMarginTop: 14,
    padV: 24,
    padH: 12,
    pulseMax: 1.06,
  },
  /** 홈 섹션 등 인라인 영역 — 전체 화면 로딩과 구분 */
  compact: {
    heights: [10, 16, 22, 28],
    width: 6,
    gap: 3,
    rowHeight: 28,
    captionSize: 11,
    captionMarginTop: 8,
    padV: 10,
    padH: 8,
    pulseMax: 1.04,
  },
} as const;

export type SignalLoadingIndicatorSize = keyof typeof BAR_PRESETS;

type Props = {
  message?: string;
  size?: SignalLoadingIndicatorSize;
};

export function SignalLoadingIndicator({ message, size = 'default' }: Props) {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const preset = BAR_PRESETS[size];
  const styles = useMemo(() => makeStyles(theme, preset), [theme, preset]);
  const opacities = useRef(preset.heights.map(() => new Animated.Value(0.32))).current;
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
        Animated.timing(groupScale, { toValue: preset.pulseMax, duration: 780, useNativeDriver: true }),
        Animated.timing(groupScale, { toValue: 1, duration: 780, useNativeDriver: true }),
      ]),
    );
    wave.start();
    pulse.start();
    return () => {
      wave.stop();
      pulse.stop();
    };
  }, [groupScale, opacities, preset.pulseMax]);

  const label = message ?? t('commonLoading');

  return (
    <View style={styles.wrap} accessibilityRole="progressbar" accessibilityLabel={label}>
      <Animated.View style={{ transform: [{ scale: groupScale }] }}>
        <View style={styles.barsRow}>
          {preset.heights.map((h, i) => (
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

function makeStyles(theme: AppTheme, preset: (typeof BAR_PRESETS)[SignalLoadingIndicatorSize]) {
  return StyleSheet.create({
    wrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: preset.padV,
      paddingHorizontal: preset.padH,
    },
    barsRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: preset.gap,
      height: preset.rowHeight,
    },
    bar: {
      width: preset.width,
      backgroundColor: theme.green,
      borderRadius: preset.width <= 6 ? 2 : 3,
    },
    caption: {
      marginTop: preset.captionMarginTop,
      fontSize: preset.captionSize,
      fontWeight: '600',
      color: theme.textMuted,
      letterSpacing: -0.2,
    },
  });
}
